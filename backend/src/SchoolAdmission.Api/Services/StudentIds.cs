using SchoolAdmission.Api.Errors;

namespace SchoolAdmission.Api.Services;

public static class StudentIds
{
    public const string HeaderName = "X-Student-Id";

    /// <summary>Validates the birth registration number: exactly 17 digits.</summary>
    public static string Require(string? raw)
    {
        var value = raw?.Trim();
        if (string.IsNullOrEmpty(value))
            throw ApiException.BadRequest("MISSING_STUDENT_ID",
                $"The {HeaderName} header is required. Enter the student's 17-digit birth registration number.");

        if (value.Length != 17 || !value.All(char.IsAsciiDigit))
            throw ApiException.BadRequest("INVALID_STUDENT_ID",
                "The birth registration number must be exactly 17 digits.");

        return value;
    }
}
