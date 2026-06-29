using RiskOptima.EconomicCalendar.Domain;

namespace RiskOptima.EconomicCalendar.Application;

public sealed record EventQuery(
    DateOnly? From,
    DateOnly? To,
    string? Currency,
    EventImpact? Impact,
    string? Search);
