namespace SchoolAdmission.Api.Domain;

/// <summary>One shift of one class (e.g. "Class 6 - Morning Shift"), with its own seat pool.</summary>
public class SchoolClass
{
    public Guid Id { get; set; }
    public required string Name { get; set; }

    /// <summary>Upper-cased name, used to keep class names unique regardless of case.</summary>
    public required string NormalizedName { get; set; }

    public int TotalSeats { get; set; }
    public DateTime CreatedAt { get; set; }

    public List<Hold> Holds { get; set; } = [];
}
