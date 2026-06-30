using Microsoft.EntityFrameworkCore;
using RiskOptima.EconomicCalendar.Application;
using RiskOptima.EconomicCalendar.Domain;

namespace RiskOptima.EconomicCalendar.Infrastructure;

public sealed class EfEconomicEventRepository(EconomicCalendarDbContext db) : IEconomicEventRepository
{
    public async Task<IReadOnlyCollection<EconomicEventDto>> QueryAsync(EventQuery query, CancellationToken ct)
    {
        IQueryable<EconomicEvent> events = db.Events.AsNoTracking();

        if (query.From is not null)
        {
            var from = new DateTimeOffset(query.From.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));
            events = events.Where(e => e.EventTimeUtc >= from);
        }

        if (query.To is not null)
        {
            var toExclusive = new DateTimeOffset(query.To.Value.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));
            events = events.Where(e => e.EventTimeUtc < toExclusive);
        }

        if (!string.IsNullOrWhiteSpace(query.Currency))
        {
            var currency = query.Currency.Trim().ToUpperInvariant();
            events = events.Where(e => e.Currency.ToUpper() == currency);
        }

        if (query.Impact is not null)
        {
            events = events.Where(e => e.Impact == query.Impact);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim();
            events = events.Where(e =>
                e.EventName.Contains(search) ||
                e.Country.Contains(search) ||
                (e.Category != null && e.Category.Contains(search)));
        }

        return await events
            .OrderBy(e => e.EventTimeUtc)
            .ThenByDescending(e => e.Impact)
            .Select(e => EconomicEventDto.FromEntity(e))
            .ToListAsync(ct);
    }

    public async Task<int> UpsertAsync(IEnumerable<EconomicEventDto> events, CancellationToken ct)
    {
        var count = 0;
        var now = DateTimeOffset.UtcNow;
        foreach (var dto in events)
        {
            var source = dto.Source.Trim();
            var sourceEventId = dto.SourceEventId.Trim();
            var existing = await db.Events.SingleOrDefaultAsync(
                e => e.Source == source && e.SourceEventId == sourceEventId,
                ct);

            if (existing is null)
            {
                db.Events.Add(new EconomicEvent
                {
                    Id = dto.Id ?? Guid.NewGuid(),
                    Source = source,
                    SourceEventId = sourceEventId,
                    Country = dto.Country.Trim(),
                    Currency = dto.Currency.Trim().ToUpperInvariant(),
                    EventName = dto.EventName.Trim(),
                    Category = dto.Category,
                    EventTimeUtc = dto.EventTimeUtc.ToUniversalTime(),
                    Impact = dto.Impact,
                    Actual = dto.Actual,
                    Forecast = dto.Forecast,
                    Previous = dto.Previous,
                    Unit = dto.Unit,
                    SourceUrl = dto.SourceUrl,
                    CreatedUtc = now,
                    UpdatedUtc = now
                });
            }
            else
            {
                existing.Country = dto.Country.Trim();
                existing.Currency = dto.Currency.Trim().ToUpperInvariant();
                existing.EventName = dto.EventName.Trim();
                existing.Category = dto.Category;
                existing.EventTimeUtc = dto.EventTimeUtc.ToUniversalTime();
                existing.Impact = dto.Impact;
                existing.Actual = dto.Actual;
                existing.Forecast = dto.Forecast;
                existing.Previous = dto.Previous;
                existing.Unit = dto.Unit;
                existing.SourceUrl = dto.SourceUrl;
                existing.UpdatedUtc = now;
            }
            count += 1;
        }

        await db.SaveChangesAsync(ct);
        return count;
    }
}
