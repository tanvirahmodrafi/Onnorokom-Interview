using System.Net;
using System.Net.Http.Json;
using Npgsql;

namespace SchoolAdmission.Tests;

/// <summary>Under a flood the API answers 429/503 with a JSON body. It never hangs or returns 500.</summary>
[Collection(PostgresCollection.Name)]
public class LoadProtectionTests(PostgresFixture db)
{
    private record ErrorDto(string Error, string Message);

    [Fact]
    public async Task Too_many_requests_from_one_client_get_429_with_retry_after()
    {
        await using var api = new ApiFactory(db.ConnectionString,
            settings: new Dictionary<string, string> { ["RATE_LIMIT_PER_MINUTE"] = "3" });
        var client = api.CreateClient();

        for (var i = 0; i < 3; i++)
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/classes")).StatusCode);
        var limited = await client.GetAsync("/classes");

        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
        Assert.Equal("TOO_MANY_REQUESTS", (await limited.Content.ReadFromJsonAsync<ErrorDto>())!.Error);
        Assert.True(limited.Headers.RetryAfter?.Delta > TimeSpan.Zero);

        // Health checks are never rate limited.
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health")).StatusCode);
    }

    [Fact]
    public async Task Waiting_for_a_busy_server_does_not_use_up_the_rate_limit()
    {
        // Regression: chaining the per-IP limiter with the concurrency limiter charged queued requests twice.
        await using var api = new ApiFactory(db.ConnectionString, settings: new Dictionary<string, string>
        {
            ["RATE_LIMIT_PER_MINUTE"] = "100",
            ["MAX_CONCURRENT_REQUESTS"] = "1",
        });
        var client = api.CreateClient();

        var responses = await Task.WhenAll(Enumerable.Range(0, 100).Select(_ => client.GetAsync("/classes")));

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
    }

    [Fact]
    public async Task Applications_have_their_own_stricter_limit()
    {
        await using var api = new ApiFactory(db.ConnectionString,
            settings: new Dictionary<string, string> { ["APPLY_RATE_LIMIT_PER_MINUTE"] = "2" });
        var client = api.CreateClient();
        var cls = await client.CreateClassAsync(10);

        Assert.Equal(HttpStatusCode.Created, (await client.HoldAsync(cls.Id, Api.NewStudentId())).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await client.HoldAsync(cls.Id, Api.NewStudentId())).StatusCode);
        var limited = await client.HoldAsync(cls.Id, Api.NewStudentId());

        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
        // Reading is still allowed, and the rejected application took no seat.
        Assert.Equal(2, (await client.GetClassAsync(cls.Id)).HeldSeats);
    }

    [Fact]
    public async Task A_full_request_queue_gets_503_server_busy_not_500()
    {
        await using var api = new ApiFactory(db.ConnectionString, settings: new Dictionary<string, string>
        {
            ["MAX_CONCURRENT_REQUESTS"] = "1",
            ["MAX_QUEUED_REQUESTS"] = "0",
        });
        var client = api.CreateClient();

        var responses = await Task.WhenAll(Enumerable.Range(0, 50).Select(_ => client.GetAsync("/classes")));

        Assert.All(responses, r => Assert.Contains(r.StatusCode, new[] { HttpStatusCode.OK, HttpStatusCode.ServiceUnavailable }));
        var busy = responses.First(r => r.StatusCode == HttpStatusCode.ServiceUnavailable);
        Assert.Equal("SERVER_BUSY", (await busy.Content.ReadFromJsonAsync<ErrorDto>())!.Error);
    }

    [Fact]
    public async Task An_exhausted_connection_pool_gets_503_server_busy_not_500()
    {
        // Two pooled connections (startup migration needs both) that time out after one second.
        var tiny = new NpgsqlConnectionStringBuilder(db.ConnectionString) { MaxPoolSize = 2, Timeout = 1 }.ConnectionString;
        // The expiry sweeper is slowed down so it cannot take one of the two connections mid-test.
        await using var api = new ApiFactory(tiny,
            settings: new Dictionary<string, string> { ["SWEEP_INTERVAL_SECONDS"] = "3600" });
        var client = api.CreateClient();
        var cls = await client.CreateClassAsync(10);

        // Lock the class row from outside, so two applications each hold a pooled connection while they wait.
        await using var blocker = new NpgsqlConnection(db.ConnectionString);
        await blocker.OpenAsync();
        await using var tx = await blocker.BeginTransactionAsync();
        await using (var lockRow = new NpgsqlCommand("SELECT 1 FROM classes WHERE id = @id FOR UPDATE", blocker, tx))
        {
            lockRow.Parameters.AddWithValue("id", Guid.Parse(cls.Id));
            await lockRow.ExecuteNonQueryAsync();
        }
        var waiting = new[] { client.HoldAsync(cls.Id, Api.NewStudentId()), client.HoldAsync(cls.Id, Api.NewStudentId()) };
        await Task.Delay(500);

        var starved = await client.GetAsync("/classes");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, starved.StatusCode);
        Assert.Equal("SERVER_BUSY", (await starved.Content.ReadFromJsonAsync<ErrorDto>())!.Error);

        await tx.RollbackAsync();
        Assert.All(await Task.WhenAll(waiting), r => Assert.Equal(HttpStatusCode.Created, r.StatusCode));
    }

    [Fact]
    public async Task Health_checks_the_database()
    {
        await using var api = new ApiFactory(db.ConnectionString);

        var response = await api.CreateClient().GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
