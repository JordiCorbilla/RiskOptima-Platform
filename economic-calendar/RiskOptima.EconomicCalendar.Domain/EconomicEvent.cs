namespace RiskOptima.EconomicCalendar.Domain;

public sealed class EconomicEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Source { get; set; }
    public required string SourceEventId { get; set; }
    public required string Country { get; set; }
    public required string Currency { get; set; }
    public required string EventName { get; set; }
    public string? Category { get; set; }
    public DateTimeOffset EventTimeUtc { get; set; }
    public EventImpact Impact { get; set; }
    public string? Actual { get; set; }
    public string? Forecast { get; set; }
    public string? Previous { get; set; }
    public string? Unit { get; set; }
    public string? SourceUrl { get; set; }
    public DateTimeOffset CreatedUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedUtc { get; set; } = DateTimeOffset.UtcNow;
}
