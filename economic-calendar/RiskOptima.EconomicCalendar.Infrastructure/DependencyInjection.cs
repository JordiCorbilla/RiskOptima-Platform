using Microsoft.EntityFrameworkCore;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RiskOptima.EconomicCalendar.Application;

namespace RiskOptima.EconomicCalendar.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("EconomicCalendar")
            ?? "Data Source=data/economic-calendar.db";
        var builder = new SqliteConnectionStringBuilder(connectionString);
        if (!string.IsNullOrWhiteSpace(builder.DataSource) && builder.DataSource != ":memory:")
        {
            var directory = Path.GetDirectoryName(Path.GetFullPath(builder.DataSource));
            if (!string.IsNullOrWhiteSpace(directory))
            {
                Directory.CreateDirectory(directory);
            }
        }
        services.AddDbContext<EconomicCalendarDbContext>(options => options.UseSqlite(connectionString));
        services.AddScoped<IEconomicEventRepository, EfEconomicEventRepository>();
        services.AddSingleton<IEconomicCalendarProvider>(_ =>
        {
            var path = configuration["EconomicCalendar:SeedFile"] ?? "data/economic-events.sample.json";
            return new JsonFileEconomicCalendarProvider(path);
        });
        return services;
    }
}
