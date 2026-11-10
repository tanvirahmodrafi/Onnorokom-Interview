namespace SchoolAdmission.Api.Domain;

/// <summary>An application: a seat held for a student until it is paid for, cancelled or expires.</summary>
public class Hold
{
    public Guid Id { get; set; }
    public Guid ClassId { get; set; }
    public SchoolClass? Class { get; set; }

    /// <summary>17-digit birth registration number.</summary>
    public required string StudentId { get; set; }

    /// <summary>Applicant details from the application form. Always required.</summary>
    public required string StudentName { get; set; }
    public required string ContactNumber { get; set; }

    public HoldStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? ConfirmedAt { get; set; }
    public DateTime? CancelledAt { get; set; }

    /// <summary>
    /// The status as of <paramref name="now"/>. A HELD row past its expiry is already expired,
    /// even if the background sweeper has not rewritten it yet.
    /// </summary>
    public HoldStatus EffectiveStatus(DateTime now) =>
        Status == HoldStatus.Held && ExpiresAt <= now ? HoldStatus.Expired : Status;
}
