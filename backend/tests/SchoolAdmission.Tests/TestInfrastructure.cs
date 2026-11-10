using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Testcontainers.PostgreSql;

namespace SchoolAdmission.Tests;

/// <summary>
/// A real PostgreSQL for the whole test run: TEST_DATABASE_URL if set (used by the compose test
/// service), otherwise a throwaway Testcontainers instance. An in-memory provider would not
/// reproduce row locking, which is exactly what the concurrency tests exercise.
/// </summary>
public sealed class PostgresFixture : IAsyncLifetime
{
    private PostgreSqlContainer? _container;

    public string ConnectionString { get; private set; } = "";

    public async Task InitializeAsync()
    {
        var external = Environment.GetEnvironmentVariable("TEST_DATABASE_URL");
        if (!string.IsNullOrWhiteSpace(external))
        {
            ConnectionString = external;
            return;
        }

        _container = new PostgreSqlBuilder().WithImage("postgres:16-alpine").Build();
        await _container.StartAsync();
        ConnectionString = _container.GetConnectionString() + ";Maximum Pool Size=40";
    }

    public async Task DisposeAsync()
    {
        if (_container is not null) await _container.DisposeAsync();
    }
}

[CollectionDefinition(Name)]
public class PostgresCollection : ICollectionFixture<PostgresFixture>
{
    public const string Name = "postgres";
}

/// <summary>
/// An in-process backend. Two instances sharing one database behave like two processes.
/// Per-IP rate limits are off by default (every test client shares one address); pass
/// <paramref name="settings"/> to turn them on or to change any other setting.
/// </summary>
public sealed class ApiFactory(
    string connectionString,
    int holdDurationSeconds = 600,
    IReadOnlyDictionary<string, string>? settings = null) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("ConnectionStrings:Default", connectionString);
        builder.UseSetting("HOLD_DURATION_SECONDS", holdDurationSeconds.ToString());
        builder.UseSetting("SWEEP_INTERVAL_SECONDS", "1");
        builder.UseSetting("RATE_LIMIT_PER_MINUTE", "0");
        builder.UseSetting("APPLY_RATE_LIMIT_PER_MINUTE", "0");
        foreach (var (key, value) in settings ?? new Dictionary<string, string>())
            builder.UseSetting(key, value);
    }
}

public record ClassDto(string Id, string Name, int TotalSeats, int HeldSeats, int ConfirmedSeats, int AvailableSeats);

public record ApplicantDto(string StudentId, string StudentName, string ContactNumber);

public record HoldDto(string HoldId, string ClassId, string ClassName, string StudentId, string Status, DateTime ExpiresAt);

public static class Api
{
    public static string NewStudentId() => "2015" + Random.Shared.NextInt64(0, 10_000_000_000_000).ToString("D13");

    public static async Task<ClassDto> CreateClassAsync(this HttpClient client, int seats)
    {
        var response = await client.PostAsJsonAsync("/classes", new { name = $"Class {Guid.NewGuid():N}", totalSeats = seats });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<ClassDto>())!;
    }

    /// <summary>Valid applicant details, for tests that are not about the form itself.</summary>
    public static readonly object Applicant = new { studentName = "Test Student", contactNumber = "01712345678" };

    public static Task<HttpResponseMessage> SendAsStudentAsync(
        this HttpClient client, HttpMethod method, string url, string? studentId, object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        if (body is not null) request.Content = JsonContent.Create(body);
        if (studentId is not null) request.Headers.Add("X-Student-Id", studentId);
        return client.SendAsync(request);
    }

    public static Task<HttpResponseMessage> HoldAsync(this HttpClient client, string classId, string studentId) =>
        client.ApplyAsync(classId, studentId, Applicant);

    public static Task<HttpResponseMessage> ApplyAsync(this HttpClient client, string classId, string? studentId, object body) =>
        client.SendAsStudentAsync(HttpMethod.Post, $"/classes/{classId}/holds", studentId, body);

    public static Task<HttpResponseMessage> ConfirmAsync(this HttpClient client, string holdId, string studentId) =>
        client.SendAsStudentAsync(HttpMethod.Post, $"/holds/{holdId}/confirm", studentId);

    public static async Task<ClassDto> GetClassAsync(this HttpClient client, string classId) =>
        (await client.GetFromJsonAsync<ClassDto>($"/classes/{classId}"))!;
}
