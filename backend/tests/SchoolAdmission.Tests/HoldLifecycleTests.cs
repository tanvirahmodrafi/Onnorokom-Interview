using System.Net;
using System.Net.Http.Json;

namespace SchoolAdmission.Tests;

[Collection(PostgresCollection.Name)]
public class HoldLifecycleTests(PostgresFixture db)
{
    [Fact]
    public async Task Hold_response_matches_the_contract()
    {
        await using var api = new ApiFactory(db.ConnectionString);
        var client = api.CreateClient();
        var schoolClass = await client.CreateClassAsync(seats: 2);
        var student = Api.NewStudentId();

        var response = await client.HoldAsync(schoolClass.Id, student);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        Assert.Contains("\"status\":\"HELD\"", json);
        Assert.Matches("\"expiresAt\":\"[0-9T:.-]+Z\"", json);
        var hold = await response.ReadHoldAsync();
        Assert.Equal(schoolClass.Id, hold.ClassId);
        Assert.Equal(student, hold.StudentId);

        var view = await client.GetClassAsync(schoolClass.Id);
        Assert.Equal((2, 1, 0, 1), (view.TotalSeats, view.HeldSeats, view.ConfirmedSeats, view.AvailableSeats));
    }

    [Fact]
    public async Task Second_application_to_the_same_class_is_rejected()
    {
        await using var api = new ApiFactory(db.ConnectionString);
        var client = api.CreateClient();
        var schoolClass = await client.CreateClassAsync(seats: 5);
        var student = Api.NewStudentId();

        Assert.Equal(HttpStatusCode.Created, (await client.HoldAsync(schoolClass.Id, student)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.HoldAsync(schoolClass.Id, student)).StatusCode);
    }

    [Fact]
    public async Task Only_the_owner_can_confirm_or_cancel()
    {
        await using var api = new ApiFactory(db.ConnectionString);
        var client = api.CreateClient();
        var schoolClass = await client.CreateClassAsync(seats: 1);
        var owner = Api.NewStudentId();
        var hold = await (await client.HoldAsync(schoolClass.Id, owner)).ReadHoldAsync();

        var stranger = Api.NewStudentId();
        Assert.Equal(HttpStatusCode.Forbidden, (await client.ConfirmAsync(hold.HoldId, stranger)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.SendAsStudentAsync(HttpMethod.Delete, $"/holds/{hold.HoldId}", stranger)).StatusCode);
    }

    [Fact]
    public async Task Cancelling_frees_the_seat_and_blocks_payment()
    {
        await using var api = new ApiFactory(db.ConnectionString);
        var client = api.CreateClient();
        var schoolClass = await client.CreateClassAsync(seats: 1);
        var student = Api.NewStudentId();
        var hold = await (await client.HoldAsync(schoolClass.Id, student)).ReadHoldAsync();

        var cancel = await client.SendAsStudentAsync(HttpMethod.Delete, $"/holds/{hold.HoldId}", student);

        Assert.Equal(HttpStatusCode.NoContent, cancel.StatusCode);
        Assert.Equal(1, (await client.GetClassAsync(schoolClass.Id)).AvailableSeats);
        Assert.Equal(HttpStatusCode.Conflict, (await client.ConfirmAsync(hold.HoldId, student)).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await client.HoldAsync(schoolClass.Id, Api.NewStudentId())).StatusCode);
    }

    [Fact]
    public async Task Expired_hold_releases_its_seat_on_its_own_and_cannot_be_paid()
    {
        await using var api = new ApiFactory(db.ConnectionString, holdDurationSeconds: 2);
        var client = api.CreateClient();
        var schoolClass = await client.CreateClassAsync(seats: 1);
        var student = Api.NewStudentId();
        var hold = await (await client.HoldAsync(schoolClass.Id, student)).ReadHoldAsync();
        Assert.Equal(0, (await client.GetClassAsync(schoolClass.Id)).AvailableSeats);

        await Task.Delay(TimeSpan.FromSeconds(4)); // hold duration + at least one sweeper tick

        var status = await client.GetFromJsonAsync<HoldDto>($"/holds/{hold.HoldId}");
        Assert.Equal("EXPIRED", status!.Status);
        Assert.Equal(1, (await client.GetClassAsync(schoolClass.Id)).AvailableSeats);
        Assert.Equal(HttpStatusCode.Conflict, (await client.ConfirmAsync(hold.HoldId, student)).StatusCode);

        // The same student may apply again once the old hold has expired.
        Assert.Equal(HttpStatusCode.Created, (await client.HoldAsync(schoolClass.Id, student)).StatusCode);
    }

    [Fact]
    public async Task My_holds_lists_only_this_students_applications()
    {
        await using var api = new ApiFactory(db.ConnectionString);
        var client = api.CreateClient();
        var first = await client.CreateClassAsync(seats: 3);
        var second = await client.CreateClassAsync(seats: 3);
        var student = Api.NewStudentId();
        // One class per student, so the first application is cancelled before applying elsewhere.
        var earlier = await (await client.HoldAsync(first.Id, student)).ReadHoldAsync();
        await client.SendAsStudentAsync(HttpMethod.Delete, $"/holds/{earlier.HoldId}", student);
        await client.HoldAsync(second.Id, student);
        await client.HoldAsync(first.Id, Api.NewStudentId());

        var response = await client.SendAsStudentAsync(HttpMethod.Get, "/me/holds", student);
        var mine = await response.Content.ReadFromJsonAsync<List<HoldDto>>();

        Assert.Equal(2, mine!.Count);
        Assert.All(mine, h => Assert.Equal(student, h.StudentId));
        Assert.Contains(mine, h => h.ClassName == first.Name);
    }
}

public static class ResponseExtensions
{
    public static async Task<HoldDto> ReadHoldAsync(this HttpResponseMessage response)
    {
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<HoldDto>())!;
    }
}
