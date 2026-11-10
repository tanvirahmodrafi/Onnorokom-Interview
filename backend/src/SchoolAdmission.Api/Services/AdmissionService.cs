using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;
using SchoolAdmission.Api.Contracts;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Domain;
using SchoolAdmission.Api.Errors;

namespace SchoolAdmission.Api.Services;

/// <summary>
/// All seat logic. Every guarantee here is enforced by PostgreSQL (row locks, conditional updates,
/// a partial unique index), never by in-process state, so it holds across several backend processes.
/// </summary>
public class AdmissionService(AppDbContext db, IOptions<AdmissionOptions> options)
{
    public const int MaxNameLength = 200;
    public const int MaxTotalSeats = 100_000;
    public const int MaxStudentNameLength = 100;

    // Stored when a hold is made without applicant details, so responses never contain null.
    public const string NameNotProvided = "Not provided";
    public const string ContactNotProvided = "00000000000";

    private static readonly HoldStatus[] ActiveStatuses = [HoldStatus.Held, HoldStatus.Confirmed];

    private readonly TimeSpan _holdDuration = options.Value.HoldDuration;

    // ---- Classes -------------------------------------------------------------------------------

    public async Task<ClassResponse> CreateClassAsync(CreateClassRequest request, CancellationToken ct)
    {
        var name = request.Name?.Trim();
        if (string.IsNullOrEmpty(name))
            throw ApiException.BadRequest("INVALID_NAME", "Class name is required.");
        if (name.Length > MaxNameLength)
            throw ApiException.BadRequest("INVALID_NAME", $"Class name must be at most {MaxNameLength} characters.");
        if (request.TotalSeats is not { } totalSeats || totalSeats < 1 || totalSeats > MaxTotalSeats)
            throw ApiException.BadRequest("INVALID_TOTAL_SEATS",
                $"Total seats must be a whole number between 1 and {MaxTotalSeats}.");

        var normalizedName = name.ToUpperInvariant();
        var entity = new SchoolClass
        {
            Id = Guid.NewGuid(),
            Name = name,
            NormalizedName = normalizedName,
            TotalSeats = totalSeats,
            CreatedAt = Now(),
        };
        db.Classes.Add(entity);

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            throw ApiException.Conflict("CLASS_EXISTS", $"A class named \"{name}\" already exists.");
        }

        return new ClassResponse(entity.Id, entity.Name, entity.TotalSeats, 0, 0, entity.TotalSeats, entity.CreatedAt);
    }

    public Task<List<ClassResponse>> ListClassesAsync(CancellationToken ct) =>
        WithSeatCounts(db.Classes.OrderBy(c => c.CreatedAt), ct);

    public async Task<ClassResponse> GetClassAsync(string rawClassId, CancellationToken ct)
    {
        var classId = ParseClassId(rawClassId);
        var found = await WithSeatCounts(db.Classes.Where(c => c.Id == classId), ct);
        return found.SingleOrDefault() ?? throw ClassNotFound();
    }

    /// <summary>Deletes the class. Its holds go with it (ON DELETE CASCADE).</summary>
    public async Task DeleteClassAsync(string rawClassId, CancellationToken ct)
    {
        var classId = ParseClassId(rawClassId);
        // DELETE takes the same row lock as a hold attempt's FOR UPDATE, so an in-flight hold either
        // commits first (and is deleted with the class) or runs afterwards and gets 404.
        var deleted = await db.Classes.Where(c => c.Id == classId).ExecuteDeleteAsync(ct);
        if (deleted == 0) throw ClassNotFound();
    }

    /// <summary>The students who currently take up a seat in the class: live holds and admissions.</summary>
    public async Task<List<HoldResponse>> ListClassStudentsAsync(string rawClassId, CancellationToken ct)
    {
        var classId = ParseClassId(rawClassId);
        var now = Now();
        var schoolClass = await db.Classes.AsNoTracking().FirstOrDefaultAsync(c => c.Id == classId, ct)
            ?? throw ClassNotFound();

        var holds = await db.Holds.AsNoTracking()
            .Where(h => h.ClassId == classId &&
                        (h.Status == HoldStatus.Confirmed || (h.Status == HoldStatus.Held && h.ExpiresAt > now)))
            .OrderBy(h => h.CreatedAt)
            .ToListAsync(ct);
        return holds.Select(h => ToResponse(h, schoolClass.Name, now)).ToList();
    }

    /// <summary>Admin removes a student from a class, whether the seat is held or already paid for.</summary>
    public async Task RemoveStudentAsync(string rawClassId, string studentId, CancellationToken ct)
    {
        var classId = ParseClassId(rawClassId);
        var now = Now();

        // Conditional update, like confirm/cancel: a racing confirm either lands first (and the
        // admission is removed) or finds the row no longer HELD and reports HOLD_REMOVED.
        var removed = await db.Holds
            .Where(h => h.ClassId == classId && h.StudentId == studentId &&
                        (h.Status == HoldStatus.Confirmed || (h.Status == HoldStatus.Held && h.ExpiresAt > now)))
            .ExecuteUpdateAsync(s => s
                .SetProperty(h => h.Status, HoldStatus.Removed)
                .SetProperty(h => h.CancelledAt, now), ct);
        if (removed > 0) return;

        if (!await db.Classes.AnyAsync(c => c.Id == classId, ct)) throw ClassNotFound();
        throw ApiException.NotFound("STUDENT_NOT_IN_CLASS", "This student has no seat in this class.");
    }

    // HELD rows past expires_at are counted as free here, so a seat comes back the instant time
    // runs out, even before the background sweeper rewrites the row.
    private static async Task<List<ClassResponse>> WithSeatCounts(IQueryable<SchoolClass> classes, CancellationToken ct)
    {
        var now = Now();
        var rows = await classes.AsNoTracking()
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.TotalSeats,
                c.CreatedAt,
                Held = c.Holds.Count(h => h.Status == HoldStatus.Held && h.ExpiresAt > now),
                Confirmed = c.Holds.Count(h => h.Status == HoldStatus.Confirmed),
            })
            .ToListAsync(ct);

        return rows
            .Select(r => new ClassResponse(r.Id, r.Name, r.TotalSeats, r.Held, r.Confirmed,
                Math.Max(0, r.TotalSeats - r.Held - r.Confirmed), r.CreatedAt))
            .ToList();
    }

    // ---- Holds ---------------------------------------------------------------------------------

    public async Task<HoldResponse> CreateHoldAsync(
        string rawClassId, string studentId, CreateHoldRequest? applicant, CancellationToken ct)
    {
        var classId = ParseClassId(rawClassId);
        var details = ValidateApplicant(applicant);
        var now = Now();

        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        // Lock the class row. Every hold attempt for this class, from any backend process,
        // queues here, so the count-then-insert below cannot interleave and overbook (rule 1).
        var schoolClass = (await db.Classes
                .FromSql($"SELECT * FROM classes WHERE id = {classId} FOR UPDATE")
                .AsNoTracking()
                .ToListAsync(ct))
            .SingleOrDefault() ?? throw ClassNotFound();

        // Settle stale holds first so that their seats, and the student's right to apply (here or in
        // another class), are freed.
        await ExpireStaleHolds(now).Where(h => h.ClassId == classId || h.StudentId == studentId)
            .ExecuteUpdateAsync(s => s.SetProperty(h => h.Status, HoldStatus.Expired), ct);

        // One student, one class: any live application or admission blocks a new one.
        var mine = await db.Holds
            .Where(h => h.StudentId == studentId && ActiveStatuses.Contains(h.Status))
            .Select(h => new { h.ClassId, h.Status, ClassName = h.Class!.Name })
            .FirstOrDefaultAsync(ct);
        if (mine is not null)
            throw mine.ClassId == classId ? AlreadyApplied(mine.Status) : InAnotherClass(mine.ClassName);

        var active = await db.Holds
            .CountAsync(h => h.ClassId == classId && ActiveStatuses.Contains(h.Status), ct);

        if (active >= schoolClass.TotalSeats)
            throw ApiException.Conflict("CLASS_FULL", "No seats are left in this class.");

        var hold = new Hold
        {
            Id = Guid.NewGuid(),
            ClassId = classId,
            StudentId = studentId,
            StudentName = details.Name,
            ContactNumber = details.ContactNumber,
            Status = HoldStatus.Held,
            CreatedAt = now,
            ExpiresAt = now + _holdDuration,
        };
        db.Holds.Add(hold);

        try
        {
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            // Backstop: the partial unique index rejected a second live hold for this student (e.g. two
            // parallel applications to different classes, which lock different class rows).
            throw ApiException.Conflict("ALREADY_APPLIED",
                "This student already has an active application or admission.");
        }

        return ToResponse(hold, schoolClass.Name, now);
    }

    public async Task<HoldResponse> GetHoldAsync(string rawHoldId, CancellationToken ct)
    {
        var holdId = ParseHoldId(rawHoldId);
        var hold = await LoadHoldAsync(holdId, ct) ?? throw HoldNotFound();
        return ToResponse(hold, hold.Class!.Name, Now());
    }

    public async Task<List<HoldResponse>> ListStudentHoldsAsync(string studentId, CancellationToken ct)
    {
        var now = Now();
        var holds = await db.Holds.AsNoTracking()
            .Include(h => h.Class)
            .Where(h => h.StudentId == studentId)
            .OrderByDescending(h => h.CreatedAt)
            .ToListAsync(ct);
        return holds.Select(h => ToResponse(h, h.Class!.Name, now)).ToList();
    }

    public async Task<HoldResponse> ConfirmHoldAsync(string rawHoldId, string studentId, CancellationToken ct)
    {
        var holdId = ParseHoldId(rawHoldId);
        var now = Now();
        var hold = await LoadOwnHoldAsync(holdId, studentId, ct);

        if (hold.EffectiveStatus(now) == HoldStatus.Held)
        {
            // Conditional transition: of several concurrent confirms only one matches the row, and
            // a hold that expired in the meantime never matches (rules 4 and 5).
            await db.Holds
                .Where(h => h.Id == holdId && h.Status == HoldStatus.Held && h.ExpiresAt > now)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(h => h.Status, HoldStatus.Confirmed)
                    .SetProperty(h => h.ConfirmedAt, now), ct);
            hold = await LoadHoldAsync(holdId, ct) ?? throw HoldNotFound();
        }

        return hold.EffectiveStatus(now) switch
        {
            // Already confirmed (by this call or an earlier one): idempotent success.
            HoldStatus.Confirmed => ToResponse(hold, hold.Class!.Name, now),
            HoldStatus.Cancelled => throw ApiException.Conflict("HOLD_CANCELLED",
                "This application was cancelled, so the fee can no longer be paid."),
            HoldStatus.Removed => throw HoldRemoved(),
            _ => throw ApiException.Conflict("HOLD_EXPIRED",
                "The hold time ran out before the fee was paid. Please apply again if seats are available."),
        };
    }

    public async Task CancelHoldAsync(string rawHoldId, string studentId, CancellationToken ct)
    {
        var holdId = ParseHoldId(rawHoldId);
        var now = Now();
        var hold = await LoadOwnHoldAsync(holdId, studentId, ct);

        // A parent may withdraw a held seat or a confirmed (paid) admission; either way the seat is freed.
        if (hold.EffectiveStatus(now) is HoldStatus.Held or HoldStatus.Confirmed)
        {
            await db.Holds
                .Where(h => h.Id == holdId &&
                            (h.Status == HoldStatus.Confirmed || (h.Status == HoldStatus.Held && h.ExpiresAt > now)))
                .ExecuteUpdateAsync(s => s
                    .SetProperty(h => h.Status, HoldStatus.Cancelled)
                    .SetProperty(h => h.CancelledAt, now), ct);
            hold = await LoadHoldAsync(holdId, ct) ?? throw HoldNotFound();
        }

        switch (hold.EffectiveStatus(now))
        {
            case HoldStatus.Cancelled:
                return; // Cancelling twice is harmless.
            case HoldStatus.Removed:
                throw HoldRemoved();
            default:
                throw ApiException.Conflict("HOLD_EXPIRED", "This application has already expired.");
        }
    }

    /// <summary>Rewrites stored status of HELD rows whose time is up. Safe to run from many processes.</summary>
    public Task<int> ExpireStaleHoldsAsync(CancellationToken ct) =>
        ExpireStaleHolds(Now()).ExecuteUpdateAsync(s => s.SetProperty(h => h.Status, HoldStatus.Expired), ct);

    // ---- Helpers -------------------------------------------------------------------------------

    private IQueryable<Hold> ExpireStaleHolds(DateTime now) =>
        db.Holds.Where(h => h.Status == HoldStatus.Held && h.ExpiresAt <= now);

    private Task<Hold?> LoadHoldAsync(Guid holdId, CancellationToken ct) =>
        db.Holds.AsNoTracking().Include(h => h.Class).FirstOrDefaultAsync(h => h.Id == holdId, ct);

    private async Task<Hold> LoadOwnHoldAsync(Guid holdId, string studentId, CancellationToken ct)
    {
        var hold = await LoadHoldAsync(holdId, ct) ?? throw HoldNotFound();
        if (hold.StudentId != studentId)
            throw ApiException.Forbidden("NOT_YOUR_HOLD", "This application belongs to a different student.");
        return hold;
    }

    private static HoldResponse ToResponse(Hold hold, string className, DateTime now) => new(
        hold.Id, hold.ClassId, className, hold.StudentId, hold.EffectiveStatus(now),
        hold.ExpiresAt, hold.CreatedAt, hold.ConfirmedAt, hold.StudentName, hold.ContactNumber);

    private sealed record Applicant(string Name, string ContactNumber);

    // No body (the brief's header-only call) gets placeholders; any field sent means both are required.
    private static Applicant ValidateApplicant(CreateHoldRequest? request)
    {
        if (request is null || (request.StudentName is null && request.ContactNumber is null))
            return new Applicant(NameNotProvided, ContactNotProvided);

        var name = request.StudentName?.Trim();
        if (string.IsNullOrEmpty(name) || name.Length > MaxStudentNameLength)
            throw ApiException.BadRequest("INVALID_STUDENT_NAME",
                $"Enter the student's name (at most {MaxStudentNameLength} characters).");

        var contact = new string((request.ContactNumber ?? "").Where(c => c is not (' ' or '-')).ToArray());
        var digits = contact.StartsWith('+') ? contact[1..] : contact;
        if (digits.Length is < 10 or > 15 || !digits.All(char.IsAsciiDigit))
            throw ApiException.BadRequest("INVALID_CONTACT_NUMBER",
                "Enter a contact number of 10 to 15 digits, e.g. 01712345678.");

        return new Applicant(name, contact);
    }

    private static ApiException HoldRemoved() =>
        ApiException.Conflict("HOLD_REMOVED", "The school removed this student from the class.");

    private static ApiException InAnotherClass(string className) => ApiException.Conflict("ALREADY_IN_ANOTHER_CLASS",
        $"This student already has an application or admission in {className}. A student can join one class only.");

    private static ApiException AlreadyApplied(HoldStatus existing) => existing == HoldStatus.Confirmed
        ? ApiException.Conflict("ALREADY_ADMITTED", "This student is already admitted to this class.")
        : ApiException.Conflict("ALREADY_APPLIED", "This student already has an active application for this class.");

    // IDs that are not GUIDs cannot exist, so they are reported as "not found" rather than a server error.
    private static Guid ParseClassId(string raw) => Guid.TryParse(raw, out var id) ? id : throw ClassNotFound();
    private static Guid ParseHoldId(string raw) => Guid.TryParse(raw, out var id) ? id : throw HoldNotFound();

    private static ApiException ClassNotFound() => ApiException.NotFound("CLASS_NOT_FOUND", "This class does not exist.");
    private static ApiException HoldNotFound() => ApiException.NotFound("HOLD_NOT_FOUND", "This application does not exist.");

    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };

    // PostgreSQL stores microseconds; trimming to milliseconds keeps API timestamps stable and JS-friendly.
    private static DateTime Now()
    {
        var now = DateTime.UtcNow;
        return new DateTime(now.Ticks - now.Ticks % TimeSpan.TicksPerMillisecond, DateTimeKind.Utc);
    }
}
