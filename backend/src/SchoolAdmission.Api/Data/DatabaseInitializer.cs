using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace SchoolAdmission.Api.Data;

public static class DatabaseInitializer
{
    // Arbitrary key shared by every backend process; serializes migrations when several start at once.
    private const long MigrationLockKey = 72_100_2026;

    public static async Task MigrateAsync(IServiceProvider services, ILogger logger, CancellationToken ct = default)
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await using var scope = services.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var connectionString = db.Database.GetConnectionString()!;

                // The lock below needs a connection to the target database, so it must exist first.
                await EnsureDatabaseExistsAsync(connectionString, ct);

                await using var lockConnection = new NpgsqlConnection(connectionString);
                await lockConnection.OpenAsync(ct);
                await ExecuteAsync(lockConnection, $"SELECT pg_advisory_lock({MigrationLockKey})", ct);
                try
                {
                    await db.Database.MigrateAsync(ct);
                }
                finally
                {
                    await ExecuteAsync(lockConnection, $"SELECT pg_advisory_unlock({MigrationLockKey})", ct);
                }

                logger.LogInformation("Database is up to date");
                return;
            }
            catch (Exception ex) when ((ex is NpgsqlException or TimeoutException or System.Net.Sockets.SocketException) && attempt < 15)
            {
                logger.LogWarning("Database not reachable yet ({Message}); retrying in 2s", ex.Message);
                await Task.Delay(TimeSpan.FromSeconds(2), ct);
            }
        }
    }

    private static async Task EnsureDatabaseExistsAsync(string connectionString, CancellationToken ct)
    {
        var target = new NpgsqlConnectionStringBuilder(connectionString);
        var databaseName = target.Database ?? throw new InvalidOperationException("The connection string has no Database.");
        var maintenance = new NpgsqlConnectionStringBuilder(connectionString) { Database = "postgres", Pooling = false };

        await using var connection = new NpgsqlConnection(maintenance.ConnectionString);
        await connection.OpenAsync(ct);

        await using var exists = new NpgsqlCommand("SELECT 1 FROM pg_database WHERE datname = @name", connection);
        exists.Parameters.AddWithValue("name", databaseName);
        if (await exists.ExecuteScalarAsync(ct) is not null) return;

        try
        {
            var quoted = "\"" + databaseName.Replace("\"", "\"\"") + "\"";
            await ExecuteAsync(connection, $"CREATE DATABASE {quoted}", ct);
        }
        catch (PostgresException ex) when (ex.SqlState is PostgresErrorCodes.DuplicateDatabase or PostgresErrorCodes.UniqueViolation)
        {
            // Another process created it at the same moment.
        }
    }

    private static async Task ExecuteAsync(NpgsqlConnection connection, string sql, CancellationToken ct)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync(ct);
    }
}
