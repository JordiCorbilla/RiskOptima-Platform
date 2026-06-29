namespace RiskOptima.EconomicCalendar.Application;

public interface IEconomicEventRepository
{
    Task<IReadOnlyCollection<EconomicEventDto>> QueryAsync(EventQuery query, CancellationToken ct);
    Task<int> UpsertAsync(IEnumerable<EconomicEventDto> events, CancellationToken ct);
}
