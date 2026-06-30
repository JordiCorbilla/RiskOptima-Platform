using RiskOptima.EconomicCalendar.Application;

namespace RiskOptima.EconomicCalendar.Infrastructure;

public sealed class TradingEconomicsProvider : IEconomicCalendarProvider
{
    public Task<IReadOnlyCollection<EconomicEventDto>> GetEventsAsync(DateOnly from, DateOnly to, CancellationToken ct) =>
        throw new NotImplementedException("Trading Economics provider is intentionally stubbed for v1.");
}
