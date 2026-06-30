using Microsoft.EntityFrameworkCore;
using RiskOptima.EconomicCalendar.Application;
using RiskOptima.EconomicCalendar.Domain;
using RiskOptima.EconomicCalendar.Infrastructure;

namespace RiskOptima.EconomicCalendar.Tests;

public sealed class EconomicEventRepositoryTests
{
    [Fact]
    public async Task QueryAsync_filters_by_date_range()
    {
        await using var db = CreateDbContext();
        var repository = new EfEconomicEventRepository(db);
        await repository.UpsertAsync(
            [
                Event("before", "2026-06-28T12:30:00Z", EventImpact.High),
                Event("inside", "2026-06-29T12:30:00Z", EventImpact.High),
                Event("after", "2026-07-04T12:30:00Z", EventImpact.High)
            ],
            CancellationToken.None);

        var result = await repository.QueryAsync(
            new EventQuery(new DateOnly(2026, 6, 29), new DateOnly(2026, 7, 1), null, null, null),
            CancellationToken.None);

        Assert.Single(result);
        Assert.Equal("inside", result.Single().SourceEventId);
    }

    [Fact]
    public async Task QueryAsync_filters_by_impact()
    {
        await using var db = CreateDbContext();
        var repository = new EfEconomicEventRepository(db);
        await repository.UpsertAsync(
            [
                Event("medium", "2026-06-29T12:30:00Z", EventImpact.Medium),
                Event("high", "2026-06-29T14:00:00Z", EventImpact.High)
            ],
            CancellationToken.None);

        var result = await repository.QueryAsync(
            new EventQuery(null, null, null, EventImpact.High, null),
            CancellationToken.None);

        Assert.Single(result);
        Assert.Equal("high", result.Single().SourceEventId);
    }

    [Fact]
    public async Task UpsertAsync_updates_existing_source_event()
    {
        await using var db = CreateDbContext();
        var repository = new EfEconomicEventRepository(db);
        await repository.UpsertAsync([Event("nfp", "2026-07-02T12:30:00Z", EventImpact.High, forecast: "185K")], CancellationToken.None);
        await repository.UpsertAsync([Event("nfp", "2026-07-02T12:30:00Z", EventImpact.High, forecast: "210K")], CancellationToken.None);

        var result = await repository.QueryAsync(new EventQuery(null, null, null, null, "Non-Farm"), CancellationToken.None);

        Assert.Single(result);
        Assert.Equal("210K", result.Single().Forecast);
    }

    private static EconomicCalendarDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<EconomicCalendarDbContext>()
            .UseSqlite("Data Source=:memory:")
            .Options;
        var db = new EconomicCalendarDbContext(options);
        db.Database.OpenConnection();
        db.Database.EnsureCreated();
        return db;
    }

    private static EconomicEventDto Event(string id, string time, EventImpact impact, string? forecast = null) =>
        new(
            null,
            "manual",
            id,
            "United States",
            "USD",
            id == "nfp" ? "Non-Farm Employment Change" : $"Event {id}",
            "Macro",
            DateTimeOffset.Parse(time),
            impact,
            null,
            forecast,
            "139K",
            null,
            "https://www.tradingeconomics.com/calendar");
}
