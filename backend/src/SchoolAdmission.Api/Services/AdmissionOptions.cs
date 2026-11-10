namespace SchoolAdmission.Api.Services;

public class AdmissionOptions
{
    public TimeSpan HoldDuration { get; set; } = TimeSpan.FromSeconds(600);
}
