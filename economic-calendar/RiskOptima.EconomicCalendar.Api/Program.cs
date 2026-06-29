using RiskOptima.EconomicCalendar.Application;
using RiskOptima.EconomicCalendar.Domain;
using RiskOptima.EconomicCalendar.Infrastructure;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
        policy.WithOrigins(
                "http://localhost:5177",
                "http://127.0.0.1:5177",
                "http://localhost:4177",
                "http://127.0.0.1:4177")
            .AllowAnyHeader()
            .AllowAnyMethod());
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});
builder.Services.AddScoped<EconomicCalendarService>();
builder.Services.AddInfrastructure(builder.Configuration);

var app = builder.Build();

app.UseCors("frontend");
app.UseSwagger();
app.UseSwaggerUI();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<EconomicCalendarDbContext>();
    var provider = scope.ServiceProvider.GetRequiredService<IEconomicCalendarProvider>();
    var repository = scope.ServiceProvider.GetRequiredService<IEconomicEventRepository>();
    await DatabaseSeeder.SeedAsync(db, provider, repository, app.Lifetime.ApplicationStopping);
}

var events = app.MapGroup("/api/events").WithTags("Economic Events");

events.MapGet("/", async (
    DateOnly? from,
    DateOnly? to,
    string? currency,
    EventImpact? impact,
    string? search,
    EconomicCalendarService service,
    CancellationToken ct) =>
{
    var query = new EventQuery(from, to, currency, impact, search);
    return Results.Ok(await service.GetEventsAsync(query, ct));
})
.WithName("GetEvents");

events.MapGet("/today", async (EconomicCalendarService service, CancellationToken ct) =>
    Results.Ok(await service.GetTodayAsync(ct)))
    .WithName("GetTodayEvents");

events.MapGet("/week", async (EconomicCalendarService service, CancellationToken ct) =>
    Results.Ok(await service.GetThisWeekAsync(ct)))
    .WithName("GetWeekEvents");

events.MapGet("/high-impact", async (EconomicCalendarService service, CancellationToken ct) =>
    Results.Ok(await service.GetHighImpactAsync(ct)))
    .WithName("GetHighImpactEvents");

events.MapPost("/import", async (
    IReadOnlyCollection<EconomicEventDto> request,
    EconomicCalendarService service,
    CancellationToken ct) =>
{
    var count = await service.ImportAsync(request, ct);
    return Results.Ok(new { imported = count });
})
.WithName("ImportEvents");

app.Run();
