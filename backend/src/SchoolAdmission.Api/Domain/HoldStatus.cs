namespace SchoolAdmission.Api.Domain;

public enum HoldStatus
{
    Held,
    Confirmed,
    Expired,
    Cancelled,

    /// <summary>Taken out of the class by the school admin (frees the seat, even if paid).</summary>
    Removed,
}
