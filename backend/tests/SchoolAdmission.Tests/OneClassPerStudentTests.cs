using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;

namespace SchoolAdmission.Tests;

[Collection(PostgresCollection.Name)]
public class OneClassPerStudentTests(PostgresFixture db)
{
    [Fact]
    public async Task A_student_with_a_held_seat_cannot_apply_to_another_class()
    {
        await using var api = new ApiFactory(db.ConnectionString);
        var client = api.CreateClient();
        var (first, second) = (await client.CreateClassAsync(seats: 5), await client.CreateClassAsync(seats: 5));
        var student = Api.NewStudentId();

        Assert.Equal(HttpStatusCode.Created, (await client.HoldAsync(first.Id, student)).StatusCode);
        var again = await client.HoldAsync(second.Id, student);

        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
        Assert.Contains("ALREADY_IN_ANOTHER_CLASS", await again.Content.ReadAsStringAsync());
        Assert.Equal(0, (await client.GetClassAsync(second.Id)).HeldSeats);
    }

    [Fact]
    public async Task An_admitted_student_cannot_apply_to_another_class()
    {
        await using var api = new ApiFactory(db.ConnectionString);
        var client = api.CreateClient();
        var (first, second) = (await client.CreateClassAsync(seats: 5), await client.CreateClassAsync(seats: 5));
        var student = Api.NewStudentId();
        var hold = await (await client.HoldAsync(first.Id, student)).ReadHoldAsync();
        await client.ConfirmAsync(hold.HoldId, student);

        Assert.Equal(HttpStatusCode.Conflict, (await client.HoldAsync(second.Id, student)).StatusCode);
    }

    [Fact]
    public async Task After_cancelling_the_student_may_apply_elsewhere()
    {
        await using var api = new ApiFactory(db.ConnectionString);
        var client = api.CreateClient();
        var (first, second) = (await client.CreateClassAsync(seats: 5), await client.CreateClassAsync(seats: 5));
        var student = Api.NewStudentId();
        var hold = await (await client.HoldAsync(first.Id, student)).ReadHoldAsync();
        await client.SendAsStudentAsync(HttpMethod.Delete, $"/holds/{hold.HoldId}", student);

        Assert.Equal(HttpStatusCode.Created, (await client.HoldAsync(second.Id, student)).StatusCode);
    }

    [Fact]
    public async Task Parallel_applications_to_different_classes_give_exactly_one_seat()
    {
        await using var api = new ApiFactory(db.ConnectionString);
        var client = api.CreateClient();
        var classes = new List<ClassDto>();
        for (var i = 0; i < 5; i++) classes.Add(await client.CreateClassAsync(seats: 5));
        var student = Api.NewStudentId();

        var responses = await Task.WhenAll(classes.SelectMany(c => Enumerable.Range(0, 4).Select(_ => c))
            .Select(c => client.HoldAsync(c.Id, student)));

        Assert.Equal(1, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.All(responses.Where(r => r.StatusCode != HttpStatusCode.Created),
            r => Assert.Equal(HttpStatusCode.Conflict, r.StatusCode));
        var held = 0;
        foreach (var c in classes) held += (await client.GetClassAsync(c.Id)).HeldSeats;
        Assert.Equal(1, held);
    }

    [Fact]
    public async Task Applicant_details_are_stored_and_shown_to_the_admin()
    {
        await using var api = new ApiFactory(db.ConnectionString);
        var client = api.CreateClient();
        var schoolClass = await client.CreateClassAsync(seats: 5);
        var student = Api.NewStudentId();

        var created = await client.ApplyAsync(schoolClass.Id, student,
            new { studentName = "  Rahim Uddin ", contactNumber = "017-1234 5678" });

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var students = await client.GetFromJsonAsync<List<ApplicantDto>>($"/classes/{schoolClass.Id}/students");
        var row = Assert.Single(students!);
        Assert.Equal(("Rahim Uddin", "01712345678"), (row.StudentName, row.ContactNumber));
    }

    [Theory]
    [InlineData("", "01712345678", "INVALID_STUDENT_NAME")]
    [InlineData("Karim", "12345", "INVALID_CONTACT_NUMBER")]
    [InlineData("Karim", "0171234567x", "INVALID_CONTACT_NUMBER")]
    [InlineData("Karim", null, "INVALID_CONTACT_NUMBER")]
    public async Task Bad_applicant_details_are_rejected(string name, string? contact, string code)
    {
        await using var api = new ApiFactory(db.ConnectionString);
        var client = api.CreateClient();
        var schoolClass = await client.CreateClassAsync(seats: 5);

        var response = await client.ApplyAsync(schoolClass.Id, Api.NewStudentId(),
            new { studentName = name, contactNumber = contact });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains(code, await response.Content.ReadAsStringAsync());
        Assert.Equal(0, (await client.GetClassAsync(schoolClass.Id)).HeldSeats);
    }

    [Fact]
    public async Task The_briefs_header_only_apply_works_and_stores_placeholders()
    {
        await using var api = new ApiFactory(db.ConnectionString);
        var client = api.CreateClient();
        var schoolClass = await client.CreateClassAsync(seats: 5);

        var response = await client.SendAsStudentAsync(
            HttpMethod.Post, $"/classes/{schoolClass.Id}/holds", Api.NewStudentId());

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var hold = JsonNode.Parse(await response.Content.ReadAsStringAsync())!.AsObject();
        Assert.Equal("Not provided", (string)hold["studentName"]!);
        Assert.Equal("00000000000", (string)hold["contactNumber"]!);
        Assert.Equal(1, (await client.GetClassAsync(schoolClass.Id)).HeldSeats);
    }

    [Fact]
    public async Task Hold_responses_have_no_nulls_and_confirmedAt_appears_once_paid()
    {
        await using var api = new ApiFactory(db.ConnectionString);
        var client = api.CreateClient();
        var schoolClass = await client.CreateClassAsync(seats: 5);
        var student = Api.NewStudentId();

        var created = await client.HoldAsync(schoolClass.Id, student);
        var held = JsonNode.Parse(await created.Content.ReadAsStringAsync())!.AsObject();
        Assert.False(held.ContainsKey("confirmedAt"));
        Assert.DoesNotContain(held, p => p.Value is null);

        var confirmed = await client.ConfirmAsync((string)held["holdId"]!, student);
        var paid = JsonNode.Parse(await confirmed.Content.ReadAsStringAsync())!.AsObject();
        Assert.NotNull(paid["confirmedAt"]);
        Assert.DoesNotContain(paid, p => p.Value is null);
    }
}

[Collection(PostgresCollection.Name)]
public class CancelAdmissionTests(PostgresFixture db)
{
    [Fact]
    public async Task A_parent_can_cancel_a_confirmed_admission_and_apply_elsewhere()
    {
        await using var api = new ApiFactory(db.ConnectionString);
        var client = api.CreateClient();
        var (first, second) = (await client.CreateClassAsync(seats: 1), await client.CreateClassAsync(seats: 1));
        var student = Api.NewStudentId();
        var hold = await (await client.HoldAsync(first.Id, student)).ReadHoldAsync();
        await client.ConfirmAsync(hold.HoldId, student);

        var cancel = await client.SendAsStudentAsync(HttpMethod.Delete, $"/holds/{hold.HoldId}", student);

        Assert.Equal(HttpStatusCode.NoContent, cancel.StatusCode);
        var view = await client.GetClassAsync(first.Id);
        Assert.Equal((0, 1), (view.ConfirmedSeats, view.AvailableSeats));
        Assert.Equal("CANCELLED", (await client.GetFromJsonAsync<HoldDto>($"/holds/{hold.HoldId}"))!.Status);
        Assert.Equal(HttpStatusCode.Created, (await client.HoldAsync(second.Id, student)).StatusCode);
    }

    [Fact]
    public async Task Only_the_owner_can_cancel_a_confirmed_admission()
    {
        await using var api = new ApiFactory(db.ConnectionString);
        var client = api.CreateClient();
        var schoolClass = await client.CreateClassAsync(seats: 1);
        var owner = Api.NewStudentId();
        var hold = await (await client.HoldAsync(schoolClass.Id, owner)).ReadHoldAsync();
        await client.ConfirmAsync(hold.HoldId, owner);

        var cancel = await client.SendAsStudentAsync(HttpMethod.Delete, $"/holds/{hold.HoldId}", Api.NewStudentId());

        Assert.Equal(HttpStatusCode.Forbidden, cancel.StatusCode);
        Assert.Equal(1, (await client.GetClassAsync(schoolClass.Id)).ConfirmedSeats);
    }
}
