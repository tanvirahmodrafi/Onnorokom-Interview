using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using SchoolAdmission.Api.Contracts;

namespace SchoolAdmission.Api.Services;

/// <summary>
/// Keeps a flood of requests from exhausting the database connection pool:
/// a per-client-IP budget per minute (applications have their own, smaller one) → 429, and a cap on
/// requests working at once, with a short queue behind it → 503 when the queue is full.
/// This is load shedding only. Seat safety still lives entirely in PostgreSQL (AGENTS.md rule 1).
/// </summary>
public static class LoadProtection
{
    public static IServiceCollection AddLoadProtection(this IServiceCollection services)
    {
        services.AddRateLimiter(_ => { });
        // Configuration is read lazily, like the rest of Program.cs, so tests can override it.
        services.AddOptions<RateLimiterOptions>().Configure<IConfiguration>((options, configuration) =>
        {
            var perMinute = configuration.GetValue("RATE_LIMIT_PER_MINUTE", 600);
            var appliesPerMinute = configuration.GetValue("APPLY_RATE_LIMIT_PER_MINUTE", 30);

            // One bucket per client and kind, not a chain of limiters: ASP.NET tries a non-waiting
            // acquire before a waiting one, and a chain would spend a permit on each attempt.
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
            {
                var (kind, limit) = IsApply(context) ? ("apply", appliesPerMinute) : ("all", perMinute);
                return limit <= 0 || IsExempt(context)
                    ? RateLimitPartition.GetNoLimiter("exempt")
                    : RateLimitPartition.GetFixedWindowLimiter(
                        $"{kind}:{context.Connection.RemoteIpAddress?.ToString() ?? "unknown"}",
                        _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = limit,
                            Window = TimeSpan.FromMinutes(1),
                            QueueLimit = 0,
                        });
            });

            options.OnRejected = async (context, ct) =>
            {
                var response = context.HttpContext.Response;
                response.StatusCode = StatusCodes.Status429TooManyRequests;
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                    response.Headers.RetryAfter = Math.Ceiling(retryAfter.TotalSeconds).ToString("0");
                await response.WriteAsJsonAsync(new ErrorResponse("TOO_MANY_REQUESTS",
                    "Too many requests from this network. Please wait a minute and try again."), ct);
            };
        });

        services.AddSingleton(provider =>
        {
            var configuration = provider.GetRequiredService<IConfiguration>();
            return new RequestGate(new ConcurrencyLimiter(new ConcurrencyLimiterOptions
            {
                PermitLimit = Math.Max(1, configuration.GetValue("MAX_CONCURRENT_REQUESTS", 32)),
                QueueLimit = Math.Max(0, configuration.GetValue("MAX_QUEUED_REQUESTS", 500)),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            }));
        });
        return services;
    }

    /// <summary>Call after UseCors, so 429/503 responses still carry CORS headers and the UI can read them.</summary>
    public static IApplicationBuilder UseLoadProtection(this IApplicationBuilder app)
    {
        app.UseRateLimiter();

        var gate = app.ApplicationServices.GetRequiredService<RequestGate>();
        return app.Use(async (context, next) =>
        {
            if (IsExempt(context))
            {
                await next(context);
                return;
            }

            using var lease = await gate.Limiter.AcquireAsync(1, context.RequestAborted);
            if (lease.IsAcquired)
            {
                await next(context);
                return;
            }

            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            context.Response.Headers.RetryAfter = "1";
            await context.Response.WriteAsJsonAsync(new ErrorResponse("SERVER_BUSY",
                "The server is very busy right now. Please try again in a moment."), context.RequestAborted);
        });
    }

    private sealed record RequestGate(ConcurrencyLimiter Limiter);

    // Health checks must keep answering under load; CORS preflights carry no work.
    private static bool IsExempt(HttpContext context) =>
        HttpMethods.IsOptions(context.Request.Method) || context.Request.Path.StartsWithSegments("/health");

    private static bool IsApply(HttpContext context) =>
        HttpMethods.IsPost(context.Request.Method) &&
        context.Request.Path.StartsWithSegments("/classes") &&
        context.Request.Path.Value!.EndsWith("/holds", StringComparison.Ordinal);
}
