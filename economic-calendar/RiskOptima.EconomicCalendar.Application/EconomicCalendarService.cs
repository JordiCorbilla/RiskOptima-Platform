using RiskOptima.EconomicCalendar.Domain;

namespace RiskOptima.EconomicCalendar.Application;

public sealed class EconomicCalendarService(IEconomicEventRepository repository, IEconomicCalendarProvider provider)
{
    public Task<IReadOnlyCollection<EconomicEventDto>> GetEventsAsync(EventQuery query, CancellationToken ct) =>
        repository.QueryAsync(query, ct);

    public Task<IReadOnlyCollection<EconomicEventDto>> GetTodayAsync(CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return repository.QueryAsync(new EventQuery(today, today, null, null, null), ct);
    }

    public Task<IReadOnlyCollection<EconomicEventDto>> GetThisWeekAsync(CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var start = today.AddDays(-(int)today.DayOfWeek);
        var end = start.AddDays(6);
        return repository.QueryAsync(new EventQuery(start, end, null, null, null), ct);
    }

    public Task<IReadOnlyCollection<EconomicEventDto>> GetHighImpactAsync(CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return repository.QueryAsync(new EventQuery(today, today.AddDays(14), null, EventImpact.High, null), ct);
    }

    public async Task<int> ImportProviderEventsAsync(DateOnly from, DateOnly to, CancellationToken ct)
    {
        var events = await provider.GetEventsAsync(from, to, ct);
        return await repository.UpsertAsync(events, ct);
    }

    public Task<int> ImportAsync(IEnumerable<EconomicEventDto> events, CancellationToken ct) =>
        repository.UpsertAsync(events, ct);
}
