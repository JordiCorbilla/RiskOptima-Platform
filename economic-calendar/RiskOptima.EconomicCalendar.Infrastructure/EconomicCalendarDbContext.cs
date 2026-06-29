using Microsoft.EntityFrameworkCore;
using RiskOptima.EconomicCalendar.Domain;

namespace RiskOptima.EconomicCalendar.Infrastructure;

public sealed class EconomicCalendarDbContext(DbContextOptions<EconomicCalendarDbContext> options) : DbContext(options)
{
    public DbSet<EconomicEvent> Events => Set<EconomicEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<EconomicEvent>();
        entity.HasKey(e => e.Id);
        entity.HasIndex(e => new { e.Source, e.SourceEventId }).IsUnique();
        entity.Property(e => e.Source).HasMaxLength(64);
        entity.Property(e => e.SourceEventId).HasMaxLength(160);
        entity.Property(e => e.Country).HasMaxLength(120);
        entity.Property(e => e.Currency).HasMaxLength(12);
        entity.Property(e => e.EventName).HasMaxLength(240);
        entity.Property(e => e.Category).HasMaxLength(120);
        entity.Property(e => e.Impact).HasConversion<string>().HasMaxLength(16);
        entity.Property(e => e.EventTimeUtc).HasConversion(
            value => value.UtcDateTime,
            value => new DateTimeOffset(DateTime.SpecifyKind(value, DateTimeKind.Utc)));
        entity.Property(e => e.CreatedUtc).HasConversion(
            value => value.UtcDateTime,
            value => new DateTimeOffset(DateTime.SpecifyKind(value, DateTimeKind.Utc)));
        entity.Property(e => e.UpdatedUtc).HasConversion(
            value => value.UtcDateTime,
            value => new DateTimeOffset(DateTime.SpecifyKind(value, DateTimeKind.Utc)));
    }
}
