using RiskOptima.EconomicCalendar.Application;

namespace RiskOptima.EconomicCalendar.Infrastructure;

public static class DatabaseSeeder
{
    public static async Task SeedAsync(EconomicCalendarDbContext db, IEconomicCalendarProvider provider, IEconomicEventRepository repository, CancellationToken ct)
    {
        await db.Database.EnsureCreatedAsync(ct);
        var from = DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-1));
        var to = DateOnly.FromDateTime(DateTime.UtcNow.AddYears(2));
        var events = await provider.GetEventsAsync(from, to, ct);
        if (events.Count > 0)
        {
            await repository.UpsertAsync(events, ct);
        }
    }
}
