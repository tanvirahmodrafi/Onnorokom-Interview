using System.Net;
using System.Text;

namespace SchoolAdmission.Tests;

[Collection(PostgresCollection.Name)]
public class ValidationTests(PostgresFixture db)
{
    [Theory]
    [InlineData("{\"name\":\"\",\"totalSeats\":10}")]
    [InlineData("{\"name\":\"   \",\"totalSeats\":10}")]
    [InlineData("{\"name\":\"A\",\"totalSeats\":0}")]
    [InlineData("{\"name\":\"A\",\"totalSeats\":-5}")]
    [InlineData("{\"name\":\"A\",\"totalSeats\":\"ten\"}")]
    [InlineData("{\"name\":\"A\",\"totalSeats\":1.5}")]
    [InlineData("{\"name\":\"A\",\"totalSeats\":99999999999}")]
    [InlineData("{\"name\":\"A\"}")]
    [InlineData("{\"name\":\"A\",")]
    [InlineData("null")]
    [InlineData("")]
    public async Task Bad_class_input_returns_400(string body)
    {
        await using var api = new ApiFactory(db.ConnectionString);
        var response = await api.CreateClient()
            .PostAsync("/classes", new StringContent(body, Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("123")]
    [InlineData("2015269123456789")]   // 16 digits
    [InlineData("201526912345678901")] // 18 digits
    [InlineData("2015269123456789a")]
    public async Task Bad_student_id_returns_400(string? studentId)
    {
        await using var api = new ApiFactory(db.ConnectionString);
        var client = api.CreateClient();
        var schoolClass = await client.CreateClassAsync(seats: 1);

        Assert.Equal(HttpStatusCode.BadRequest, (await client.HoldAsync(schoolClass.Id, studentId!)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.SendAsStudentAsync(HttpMethod.Get, "/me/holds", studentId)).StatusCode);
    }

    [Theory]
    [InlineData("GET", "/classes/does-not-exist")]
    [InlineData("GET", "/classes/00000000-0000-0000-0000-000000000000")]
    [InlineData("POST", "/classes/00000000-0000-0000-0000-000000000000/holds")]
    [InlineData("POST", "/classes/not-a-guid/holds")]
    [InlineData("GET", "/holds/not-a-guid")]
    [InlineData("GET", "/holds/00000000-0000-0000-0000-000000000000")]
    [InlineData("POST", "/holds/00000000-0000-0000-0000-000000000000/confirm")]
    [InlineData("DELETE", "/holds/not-a-guid")]
    public async Task Unknown_ids_return_404(string method, string url)
    {
        await using var api = new ApiFactory(db.ConnectionString);
        var response = await api.CreateClient().SendAsStudentAsync(new HttpMethod(method), url, Api.NewStudentId());

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Duplicate_class_name_is_rejected_regardless_of_case()
    {
        await using var api = new ApiFactory(db.ConnectionString);
        var client = api.CreateClient();
        var name = $"Class 7 - Day Shift {Guid.NewGuid():N}";

        var first = await client.PostAsync("/classes",
            new StringContent($"{{\"name\":\"{name}\",\"totalSeats\":5}}", Encoding.UTF8, "application/json"));
        var second = await client.PostAsync("/classes",
            new StringContent($"{{\"name\":\"{name.ToLowerInvariant()}\",\"totalSeats\":5}}", Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }
}
