namespace SchoolAdmission.Api.Services;

/// <summary>
/// Periodically marks HELD rows past their expiry as EXPIRED so stored status matches reality.
/// Seat counts never depend on it (they already treat stale holds as free); it keeps the data tidy.
/// </summary>
public class HoldExpirySweeper(
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration,
    ILogger<HoldExpirySweeper> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var interval = TimeSpan.FromSeconds(Math.Max(1, configuration.GetValue("SWEEP_INTERVAL_SECONDS", 5)));
        using var timer = new PeriodicTimer(interval);

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var service = scope.ServiceProvider.GetRequiredService<AdmissionService>();
                var expired = await service.ExpireStaleHoldsAsync(stoppingToken);
                if (expired > 0)
                    logger.LogInformation("Expired {Count} hold(s)", expired);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "Hold expiry sweep failed; will retry on the next tick");
            }
        }
    }
}
