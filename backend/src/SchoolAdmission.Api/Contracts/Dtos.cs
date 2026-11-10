using System.Text.Json.Serialization;
using SchoolAdmission.Api.Domain;

namespace SchoolAdmission.Api.Contracts;

public record CreateClassRequest(string? Name, int? TotalSeats);

/// <summary>
/// Optional body of POST /classes/{id}/holds. The brief's call sends only the header, so a missing
/// body is allowed (placeholders are stored); if either field is sent, both are required.
/// </summary>
public record CreateHoldRequest(string? StudentName, string? ContactNumber);

public record ClassResponse(
    Guid Id,
    string Name,
    int TotalSeats,
    int HeldSeats,
    int ConfirmedSeats,
    int AvailableSeats,
    DateTime CreatedAt);

/// <summary>
/// One shape for every hold endpoint. It is a superset of each response in the spec
/// (extra fields are allowed, missing or renamed ones are not). No field is ever null:
/// confirmedAt is left out of the JSON until the fee is paid.
/// </summary>
public record HoldResponse(
    Guid HoldId,
    Guid ClassId,
    string ClassName,
    string StudentId,
    HoldStatus Status,
    DateTime ExpiresAt,
    DateTime CreatedAt,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] DateTime? ConfirmedAt,
    string StudentName,
    string ContactNumber);

public record ErrorResponse(string Error, string Message);
