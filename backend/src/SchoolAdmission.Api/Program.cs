using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api.Contracts;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Endpoints;
using SchoolAdmission.Api.Errors;
using SchoolAdmission.Api.Services;

// Local development reads backend/.env. Real environment variables (as set by Docker) always win.
DotNetEnv.Env.NoClobber().TraversePath().Load();

var builder = WebApplication.CreateBuilder(args);

// Configuration is read lazily (inside the factories below) so tests can override it.
builder.Services.AddDbContext<AppDbContext>((services, options) =>
{
    var connectionString = services.GetRequiredService<IConfiguration>().GetConnectionString("Default");
    if (string.IsNullOrWhiteSpace(connectionString))
        throw new InvalidOperationException("Set the database connection string in ConnectionStrings__Default.");
    options.UseNpgsql(connectionString).UseSnakeCaseNamingConvention();
});

builder.Services.AddOptions<AdmissionOptions>().Configure<IConfiguration>((options, configuration) =>
{
    var seconds = configuration.GetValue("HOLD_DURATION_SECONDS", 600);
    options.HoldDuration = TimeSpan.FromSeconds(seconds > 0 ? seconds : 600);
});

builder.Services.AddScoped<AdmissionService>();
builder.Services.AddHostedService<HoldExpirySweeper>();
builder.Services.AddLoadProtection();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();
builder.Services.AddCors();

builder.Services.ConfigureHttpJsonOptions(options =>
{
    // HELD, CONFIRMED, EXPIRED, CANCELLED — always strings, never numbers.
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseUpper));
});

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages(async context =>
{
    // Give bare 4xx responses (unknown route, wrong method, ...) a JSON body like every other error.
    var response = context.HttpContext.Response;
    if (response.HasStarted || response.ContentLength > 0) return;
    var reason = ReasonPhrases.GetReasonPhrase(response.StatusCode);
    await response.WriteAsJsonAsync(new ErrorResponse(
        $"HTTP_{response.StatusCode}", string.IsNullOrEmpty(reason) ? "Request failed." : reason));
});

// FRONTEND_URL may hold several comma-separated origins.
var frontendOrigins = (app.Configuration["FRONTEND_URL"] ?? "http://localhost:5173")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    .Select(origin => origin.TrimEnd('/'))
    .ToArray();
app.UseCors(policy => policy.WithOrigins(frontendOrigins).AllowAnyHeader().AllowAnyMethod());
app.UseLoadProtection();

app.MapAdmissionEndpoints();

await DatabaseInitializer.MigrateAsync(app.Services, app.Logger);
app.Logger.LogInformation("Allowing CORS from {Origins}", string.Join(", ", frontendOrigins));

app.Run();

public partial class Program;
