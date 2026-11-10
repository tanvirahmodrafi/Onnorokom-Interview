using Microsoft.AspNetCore.Diagnostics;
using Npgsql;
using SchoolAdmission.Api.Contracts;

namespace SchoolAdmission.Api.Errors;

/// <summary>Turns every exception into a JSON error body; only truly unexpected ones become a 500.</summary>
public class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext http, Exception exception, CancellationToken ct)
    {
        var (status, body) = exception switch
        {
            ApiException api => (api.StatusCode, new ErrorResponse(api.Code, api.Message)),

            // Malformed JSON, wrong field types, missing body, bad headers.
            BadHttpRequestException bad => (bad.StatusCode, new ErrorResponse(
                "BAD_REQUEST", "The request is malformed. Check that the body is valid JSON with the expected fields.")),

            OperationCanceledException when http.RequestAborted.IsCancellationRequested =>
                (499, new ErrorResponse("CLIENT_CLOSED_REQUEST", "The request was cancelled.")),

            // No database connection came free in time (pool exhausted under load): retryable, not a bug.
            _ when IsDatabaseTimeout(exception) => (StatusCodes.Status503ServiceUnavailable, new ErrorResponse(
                "SERVER_BUSY", "The server is very busy right now. Please try again in a moment.")),

            _ => (StatusCodes.Status500InternalServerError, new ErrorResponse(
                "INTERNAL_ERROR", "Something went wrong on the server. Please try again.")),
        };

        if (status == StatusCodes.Status503ServiceUnavailable)
        {
            // Under a flood this fires per request, so no stack trace.
            logger.LogWarning("Database busy for {Method} {Path}: {Message}",
                http.Request.Method, http.Request.Path, exception.GetBaseException().Message);
            http.Response.Headers.RetryAfter = "1";
        }
        else if (status >= 500)
            logger.LogError(exception, "Unhandled exception for {Method} {Path}", http.Request.Method, http.Request.Path);

        http.Response.StatusCode = status;
        await http.Response.WriteAsJsonAsync(body, ct);
        return true;
    }

    // Npgsql reports an exhausted pool (and command timeouts) as an NpgsqlException wrapping a
    // TimeoutException; EF Core may wrap that once more.
    private static bool IsDatabaseTimeout(Exception exception)
    {
        var sawNpgsql = false;
        for (var e = exception; e is not null; e = e.InnerException)
        {
            if (e is NpgsqlException) sawNpgsql = true;
            if (e is TimeoutException && sawNpgsql) return true;
        }
        return false;
    }
}
