using System.Net;
using System.Net.Http.Json;

namespace SchoolAdmission.Tests;

[Collection(PostgresCollection.Name)]
public class AdminTests(PostgresFixture db)
{
    [Fact]
    public async Task Class_students_lists_held_and_confirmed_only()
    {
        await using var api = new ApiFactory(db.ConnectionString);
        var client = api.CreateClient();
        var schoolClass = await client.CreateClassAsync(seats: 5);
        var (held, paid, cancelled) = (Api.NewStudentId(), Api.NewStudentId(), Api.NewStudentId());

        await client.HoldAsync(schoolClass.Id, held);
        var paidHold = await (await client.HoldAsync(schoolClass.Id, paid)).ReadHoldAsync();
        await client.ConfirmAsync(paidHold.HoldId, paid);
        var cancelledHold = await (await client.HoldAsync(schoolClass.Id, cancelled)).ReadHoldAsync();
        await client.SendAsStudentAsync(HttpMethod.Delete, $"/holds/{cancelledHold.HoldId}", cancelled);

        var students = await client.GetFromJsonAsync<List<HoldDto>>($"/classes/{schoolClass.Id}/students");

        Assert.Equal([(held, "HELD"), (paid, "CONFIRMED")], students!.Select(s => (s.StudentId, s.Status)));
    }

    [Fact]
    public async Task Removing_a_confirmed_student_frees_the_seat_and_shows_removed()
    {
        await using var api = new ApiFactory(db.ConnectionString);
        var client = api.CreateClient();
        var schoolClass = await client.CreateClassAsync(seats: 1);
        var student = Api.NewStudentId();
        var hold = await (await client.HoldAsync(schoolClass.Id, student)).ReadHoldAsync();
        await client.ConfirmAsync(hold.HoldId, student);

        var remove = await client.DeleteAsync($"/classes/{schoolClass.Id}/students/{student}");

        Assert.Equal(HttpStatusCode.NoContent, remove.StatusCode);
        var view = await client.GetClassAsync(schoolClass.Id);
        Assert.Equal((0, 0, 1), (view.HeldSeats, view.ConfirmedSeats, view.AvailableSeats));
        var after = await client.GetFromJsonAsync<HoldDto>($"/holds/{hold.HoldId}");
        Assert.Equal("REMOVED", after!.Status);
        Assert.Empty((await client.GetFromJsonAsync<List<HoldDto>>($"/classes/{schoolClass.Id}/students"))!);
    }

    [Fact]
    public async Task A_removed_hold_cannot_be_paid_or_cancelled()
    {
        await using var api = new ApiFactory(db.ConnectionString);
        var client = api.CreateClient();
        var schoolClass = await client.CreateClassAsync(seats: 1);
        var student = Api.NewStudentId();
        var hold = await (await client.HoldAsync(schoolClass.Id, student)).ReadHoldAsync();

        await client.DeleteAsync($"/classes/{schoolClass.Id}/students/{student}");

        var pay = await client.ConfirmAsync(hold.HoldId, student);
        Assert.Equal(HttpStatusCode.Conflict, pay.StatusCode);
        Assert.Contains("HOLD_REMOVED", await pay.Content.ReadAsStringAsync());
        var cancel = await client.SendAsStudentAsync(HttpMethod.Delete, $"/holds/{hold.HoldId}", student);
        Assert.Equal(HttpStatusCode.Conflict, cancel.StatusCode);
    }

    [Fact]
    public async Task Removing_a_student_who_has_no_seat_is_404_and_a_bad_id_is_400()
    {
        await using var api = new ApiFactory(db.ConnectionString);
        var client = api.CreateClient();
        var schoolClass = await client.CreateClassAsync(seats: 1);

        Assert.Equal(HttpStatusCode.NotFound,
            (await client.DeleteAsync($"/classes/{schoolClass.Id}/students/{Api.NewStudentId()}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.DeleteAsync($"/classes/{Guid.NewGuid()}/students/{Api.NewStudentId()}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.DeleteAsync($"/classes/{schoolClass.Id}/students/123")).StatusCode);
    }

    [Fact]
    public async Task Deleting_a_class_removes_it_and_its_applications()
    {
        await using var api = new ApiFactory(db.ConnectionString);
        var client = api.CreateClient();
        var schoolClass = await client.CreateClassAsync(seats: 3);
        var student = Api.NewStudentId();
        var hold = await (await client.HoldAsync(schoolClass.Id, student)).ReadHoldAsync();

        var delete = await client.DeleteAsync($"/classes/{schoolClass.Id}");

        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/classes/{schoolClass.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/holds/{hold.HoldId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.HoldAsync(schoolClass.Id, Api.NewStudentId())).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.DeleteAsync($"/classes/{schoolClass.Id}")).StatusCode);
    }
}
