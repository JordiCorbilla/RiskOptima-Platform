using RiskOptima.EconomicCalendar.Domain;

namespace RiskOptima.EconomicCalendar.Application;

public sealed record EconomicEventDto(
    Guid? Id,
    string Source,
    string SourceEventId,
    string Country,
    string Currency,
    string EventName,
    string? Category,
    DateTimeOffset EventTimeUtc,
    EventImpact Impact,
    string? Actual,
    string? Forecast,
    string? Previous,
    string? Unit,
    string? SourceUrl)
{
    public static EconomicEventDto FromEntity(EconomicEvent entity) =>
        new(
            entity.Id,
            entity.Source,
            entity.SourceEventId,
            entity.Country,
            entity.Currency,
            entity.EventName,
            entity.Category,
            entity.EventTimeUtc,
            entity.Impact,
            entity.Actual,
            entity.Forecast,
            entity.Previous,
            entity.Unit,
            entity.SourceUrl);
}
