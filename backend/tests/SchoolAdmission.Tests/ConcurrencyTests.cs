using System.Net;

namespace SchoolAdmission.Tests;

[Collection(PostgresCollection.Name)]
public class ConcurrencyTests(PostgresFixture db)
{
    [Fact]
    public async Task Hundred_parallel_holds_on_ten_seats_admit_exactly_ten()
    {
        await using var api = new ApiFactory(db.ConnectionString);
        var client = api.CreateClient();
        var schoolClass = await client.CreateClassAsync(seats: 10);

        var responses = await Task.WhenAll(Enumerable.Range(0, 100)
            .Select(_ => client.HoldAsync(schoolClass.Id, Api.NewStudentId())));

        Assert.Equal(10, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(90, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));

        var after = await client.GetClassAsync(schoolClass.Id);
        Assert.Equal(10, after.HeldSeats);
        Assert.Equal(0, after.AvailableSeats);
    }

    [Fact]
    public async Task Two_backend_instances_on_one_database_never_overbook()
    {
        // Two independent apps (separate DI containers and connection pools) sharing one database,
        // like two backend processes on different ports.
        await using var first = new ApiFactory(db.ConnectionString);
        await using var second = new ApiFactory(db.ConnectionString);
        var clients = new[] { first.CreateClient(), second.CreateClient() };
        var schoolClass = await clients[0].CreateClassAsync(seats: 7);

        var responses = await Task.WhenAll(Enumerable.Range(0, 80)
            .Select(i => clients[i % 2].HoldAsync(schoolClass.Id, Api.NewStudentId())));

        Assert.Equal(7, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(73, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        Assert.Equal(7, (await clients[1].GetClassAsync(schoolClass.Id)).HeldSeats);
    }

    [Fact]
    public async Task Same_student_applying_in_parallel_gets_only_one_hold()
    {
        await using var api = new ApiFactory(db.ConnectionString);
        var client = api.CreateClient();
        var schoolClass = await client.CreateClassAsync(seats: 50);
        var student = Api.NewStudentId();

        var responses = await Task.WhenAll(Enumerable.Range(0, 20)
            .Select(_ => client.HoldAsync(schoolClass.Id, student)));

        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Created);
        Assert.All(responses.Where(r => r.StatusCode != HttpStatusCode.Created),
            r => Assert.Equal(HttpStatusCode.Conflict, r.StatusCode));
        Assert.Equal(1, (await client.GetClassAsync(schoolClass.Id)).HeldSeats);
    }

    [Fact]
    public async Task Parallel_confirms_of_one_hold_all_succeed_and_count_once()
    {
        await using var api = new ApiFactory(db.ConnectionString);
        var client = api.CreateClient();
        var schoolClass = await client.CreateClassAsync(seats: 3);
        var student = Api.NewStudentId();
        var hold = await (await client.HoldAsync(schoolClass.Id, student)).ReadHoldAsync();

        var responses = await Task.WhenAll(Enumerable.Range(0, 10)
            .Select(_ => client.ConfirmAsync(hold.HoldId, student)));

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
        var after = await client.GetClassAsync(schoolClass.Id);
        Assert.Equal(1, after.ConfirmedSeats);
        Assert.Equal(0, after.HeldSeats);
        Assert.Equal(2, after.AvailableSeats);
    }
}
