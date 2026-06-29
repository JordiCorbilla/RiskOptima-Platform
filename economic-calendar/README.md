# RiskOptima Economic Calendar

Small local-first economic calendar module for the RiskOptima platform. It is intentionally simple for v1: .NET 10 Web API, React + TypeScript + Vite, SQLite storage, JSON seed data, no authentication, and no paid API dependency.

## Architecture

```text
RiskOptima.EconomicCalendar.Api             Minimal Web API, Swagger, CORS, startup seed
RiskOptima.EconomicCalendar.Application     DTOs, query contracts, provider/repository abstractions
RiskOptima.EconomicCalendar.Domain          EconomicEvent entity and EventImpact enum
RiskOptima.EconomicCalendar.Infrastructure  EF Core SQLite repository, JSON provider, provider stubs
frontend                                    React + TypeScript + Vite dashboard
data/economic-events.sample.json            Local seed/import file
```

## Run Locally

Backend:

```powershell
cd economic-calendar
dotnet run --project RiskOptima.EconomicCalendar.Api --launch-profile http
```

Swagger:

```text
http://localhost:5176/swagger
```

Frontend:

```powershell
cd economic-calendar/frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5177
```

## Import Events

The sample file is:

```text
data/economic-events.sample.json
```

Import with PowerShell:

```powershell
$json = Get-Content .\data\economic-events.sample.json -Raw
Invoke-RestMethod `
  -Uri http://localhost:5176/api/events/import `
  -Method Post `
  -ContentType "application/json" `
  -Body $json
```

The import endpoint upserts by `source + sourceEventId`.

## API

- `GET /api/events`
- `GET /api/events?from=2026-06-29&to=2026-07-10&currency=USD&impact=High&search=CPI`
- `GET /api/events/today`
- `GET /api/events/week`
- `GET /api/events/high-impact`
- `POST /api/events/import`

## Provider Abstraction

The application depends on:

```csharp
public interface IEconomicCalendarProvider
{
    Task<IReadOnlyCollection<EconomicEventDto>> GetEventsAsync(DateOnly from, DateOnly to, CancellationToken ct);
}
```

Current implementation:

- `JsonFileEconomicCalendarProvider`

Stubbed for v2:

- `TradingEconomicsProvider`

To add Trading Economics later, implement the stub, bind credentials/options in configuration, and register that provider in `RiskOptima.EconomicCalendar.Infrastructure.DependencyInjection`.

## Docker

```powershell
cd economic-calendar
docker compose up --build
```

Frontend: `http://localhost:5177`

Backend: `http://localhost:5176`

## Tests

```powershell
cd economic-calendar
dotnet test
```

Covered:

- Date filtering
- Impact filtering
- Import upsert behavior

## Roadmap

- Trading Economics provider
- SQL Server repository implementation
- SignalR live event updates
- Pre-event alert rules
- Market reaction analysis
- Backtesting around event windows
- Portfolio exposure overlay from the main RiskOptima portfolio platform
