namespace RiskOptima.EconomicCalendar.Application;

public interface IEconomicCalendarProvider
{
    Task<IReadOnlyCollection<EconomicEventDto>> GetEventsAsync(DateOnly from, DateOnly to, CancellationToken ct);
}
