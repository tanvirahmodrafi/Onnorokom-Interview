using Microsoft.AspNetCore.Mvc;
using SchoolAdmission.Api.Contracts;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Services;

namespace SchoolAdmission.Api.Endpoints;

public static class AdmissionEndpoints
{
    public static IEndpointRouteBuilder MapAdmissionEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/classes", async (CreateClassRequest body, AdmissionService service, CancellationToken ct) =>
        {
            var created = await service.CreateClassAsync(body, ct);
            return Results.Created($"/classes/{created.Id}", created);
        });

        app.MapGet("/classes", (AdmissionService service, CancellationToken ct) =>
            service.ListClassesAsync(ct));

        app.MapGet("/classes/{classId}", (string classId, AdmissionService service, CancellationToken ct) =>
            service.GetClassAsync(classId, ct));

        app.MapDelete("/classes/{classId}", async (string classId, AdmissionService service, CancellationToken ct) =>
        {
            await service.DeleteClassAsync(classId, ct);
            return Results.NoContent();
        });

        // Admin: who holds or has a seat in the class, and taking a student out of it.
        app.MapGet("/classes/{classId}/students", (string classId, AdmissionService service, CancellationToken ct) =>
            service.ListClassStudentsAsync(classId, ct));

        app.MapDelete("/classes/{classId}/students/{studentId}", async (
            string classId,
            string studentId,
            AdmissionService service,
            CancellationToken ct) =>
        {
            await service.RemoveStudentAsync(classId, StudentIds.Require(studentId), ct);
            return Results.NoContent();
        });

        app.MapPost("/classes/{classId}/holds", async (
            string classId,
            [FromHeader(Name = StudentIds.HeaderName)] string? studentId,
            CreateHoldRequest? body,
            AdmissionService service,
            CancellationToken ct) =>
        {
            var hold = await service.CreateHoldAsync(classId, StudentIds.Require(studentId), body, ct);
            return Results.Created($"/holds/{hold.HoldId}", hold);
        });

        // The spec's example sends no header here, so reading a hold's status does not require one.
        app.MapGet("/holds/{holdId}", (string holdId, AdmissionService service, CancellationToken ct) =>
            service.GetHoldAsync(holdId, ct));

        app.MapPost("/holds/{holdId}/confirm", (
            string holdId,
            [FromHeader(Name = StudentIds.HeaderName)] string? studentId,
            AdmissionService service,
            CancellationToken ct) => service.ConfirmHoldAsync(holdId, StudentIds.Require(studentId), ct));

        app.MapDelete("/holds/{holdId}", async (
            string holdId,
            [FromHeader(Name = StudentIds.HeaderName)] string? studentId,
            AdmissionService service,
            CancellationToken ct) =>
        {
            await service.CancelHoldAsync(holdId, StudentIds.Require(studentId), ct);
            return Results.NoContent();
        });

        app.MapGet("/me/holds", (
            [FromHeader(Name = StudentIds.HeaderName)] string? studentId,
            AdmissionService service,
            CancellationToken ct) => service.ListStudentHoldsAsync(StudentIds.Require(studentId), ct));

        // Checks the database too, so a load balancer stops routing here when it is unreachable.
        app.MapGet("/health", async (AppDbContext db, CancellationToken ct) =>
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(3));
            bool reachable;
            try
            {
                reachable = await db.Database.CanConnectAsync(timeout.Token);
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                reachable = false;
            }
            return reachable
                ? Results.Ok(new { status = "ok" })
                : Results.Json(new ErrorResponse("DATABASE_UNAVAILABLE", "The database cannot be reached."),
                    statusCode: StatusCodes.Status503ServiceUnavailable);
        });

        return app;
    }
}
