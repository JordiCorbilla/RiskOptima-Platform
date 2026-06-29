using System.Text.Json;
using System.Text.Json.Serialization;
using RiskOptima.EconomicCalendar.Application;

namespace RiskOptima.EconomicCalendar.Infrastructure;

public sealed class JsonFileEconomicCalendarProvider(string filePath) : IEconomicCalendarProvider
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    public async Task<IReadOnlyCollection<EconomicEventDto>> GetEventsAsync(DateOnly from, DateOnly to, CancellationToken ct)
    {
        if (!File.Exists(filePath))
        {
            return [];
        }

        await using var stream = File.OpenRead(filePath);
        var events = await JsonSerializer.DeserializeAsync<List<EconomicEventDto>>(stream, SerializerOptions, ct) ?? [];
        var fromUtc = from.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var toExclusiveUtc = to.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        return events
            .Where(e => e.EventTimeUtc >= fromUtc && e.EventTimeUtc < toExclusiveUtc)
            .OrderBy(e => e.EventTimeUtc)
            .ToList();
    }
}
