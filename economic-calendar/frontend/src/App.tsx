import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EconomicEvent, EventFilters, Impact } from "./api";
import { getEvents, getHighImpactEvents, getTodayEvents, getWeekEvents, importEvents } from "./api";

const impacts: Array<Impact | ""> = ["", "Low", "Medium", "High"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short" }).format(new Date(date));
}

function formatTime(date: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" }).format(new Date(date));
}

function countdown(date: string) {
  const target = new Date(date).getTime();
  const now = Date.now();
  const diff = target - now;
  if (diff <= 0) return "released";
  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return `in ${hours}h ${remainingMinutes}m`;
  if (hours < 48) return "tomorrow";
  return `in ${Math.ceil(hours / 24)}d`;
}

function groupByDate(events: EconomicEvent[]) {
  return events.reduce<Record<string, EconomicEvent[]>>((groups, event) => {
    const key = event.eventTimeUtc.slice(0, 10);
    groups[key] = groups[key] ?? [];
    groups[key].push(event);
    return groups;
  }, {});
}

function nextMajor(events: EconomicEvent[]) {
  return events
    .filter((event) => event.impact === "High" && new Date(event.eventTimeUtc).getTime() >= Date.now())
    .sort((left, right) => new Date(left.eventTimeUtc).getTime() - new Date(right.eventTimeUtc).getTime())[0];
}

export function App() {
  const [filters, setFilters] = useState<EventFilters>({
    from: todayIso(),
    to: addDaysIso(14),
    currency: "",
    impact: "",
    search: ""
  });
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const eventsQuery = useQuery({
    queryKey: ["events", filters],
    queryFn: () => getEvents(filters)
  });
  const todayQuery = useQuery({ queryKey: ["events", "today"], queryFn: getTodayEvents });
  const weekQuery = useQuery({ queryKey: ["events", "week"], queryFn: getWeekEvents });
  const highImpactQuery = useQuery({ queryKey: ["events", "high-impact"], queryFn: getHighImpactEvents });

  const importMutation = useMutation({
    mutationFn: importEvents,
    onSuccess: (result) => {
      setImportMessage(`Imported or updated ${result.imported} event${result.imported === 1 ? "" : "s"}.`);
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (error) => setImportMessage(error instanceof Error ? error.message : "Import failed.")
  });

  const events = eventsQuery.data ?? [];
  const groups = useMemo(() => groupByDate(events), [events]);
  const currencies = useMemo(
    () => Array.from(new Set([...(weekQuery.data ?? []), ...events].map((event) => event.currency))).sort(),
    [events, weekQuery.data]
  );
  const majorEvent = nextMajor(events);
  const highNext24h = (highImpactQuery.data ?? []).filter((event) => {
    const time = new Date(event.eventTimeUtc).getTime();
    return time >= Date.now() && time <= Date.now() + 24 * 60 * 60 * 1000;
  }).length;

  function setQuickView(view: "today" | "week" | "high") {
    if (view === "today") {
      setFilters({ ...filters, from: todayIso(), to: todayIso(), impact: "" });
    }
    if (view === "week") {
      setFilters({ ...filters, from: todayIso(), to: addDaysIso(7), impact: "" });
    }
    if (view === "high") {
      setFilters({ ...filters, from: todayIso(), to: addDaysIso(14), impact: "High" });
    }
  }

  async function onImportFile(file: File | null) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as EconomicEvent[];
      importMutation.mutate(parsed);
    } catch {
      setImportMessage("Import file must be a JSON array of events.");
    }
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <span>RiskOptima</span>
          <h1>Economic Calendar</h1>
          <p>Local-first market event calendar for macro risk monitoring, event windows, and future portfolio overlays.</p>
        </div>
        <label className="import-button">
          Import JSON
          <input type="file" accept=".json,application/json" onChange={(event) => onImportFile(event.target.files?.[0] ?? null)} />
        </label>
      </header>

      {importMessage ? <div className="notice">{importMessage}</div> : null}

      <section className="kpi-grid">
        <div>
          <span>Events today</span>
          <strong>{todayQuery.data?.length ?? 0}</strong>
        </div>
        <div>
          <span>High impact next 24h</span>
          <strong>{highNext24h}</strong>
        </div>
        <div>
          <span>Next major event</span>
          <strong>{majorEvent?.eventName ?? "None"}</strong>
          {majorEvent ? <small>{countdown(majorEvent.eventTimeUtc)}</small> : null}
        </div>
        <div>
          <span>Total this week</span>
          <strong>{weekQuery.data?.length ?? 0}</strong>
        </div>
      </section>

      <section className="toolbar">
        <div className="quick-actions">
          <button onClick={() => setQuickView("today")}>Today</button>
          <button onClick={() => setQuickView("week")}>This week</button>
          <button onClick={() => setQuickView("high")}>High impact only</button>
        </div>
        <div className="filters">
          <label>
            From
            <input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
          </label>
          <label>
            To
            <input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
          </label>
          <label>
            Currency
            <select value={filters.currency} onChange={(event) => setFilters({ ...filters, currency: event.target.value })}>
              <option value="">All</option>
              {currencies.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </label>
          <label>
            Impact
            <select value={filters.impact} onChange={(event) => setFilters({ ...filters, impact: event.target.value as Impact | "" })}>
              {impacts.map((impact) => (
                <option key={impact || "all"} value={impact}>
                  {impact || "All"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Search
            <input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="CPI, FOMC, labour..." />
          </label>
        </div>
      </section>

      <section className="calendar-panel">
        <div className="panel-heading">
          <h2>Upcoming Economic Events</h2>
          <span>{events.length} event{events.length === 1 ? "" : "s"}</span>
        </div>
        {eventsQuery.isLoading ? <div className="empty-state">Loading calendar...</div> : null}
        {eventsQuery.error ? <div className="error-state">{eventsQuery.error instanceof Error ? eventsQuery.error.message : "Unable to load events."}</div> : null}
        {!eventsQuery.isLoading && !eventsQuery.error && events.length === 0 ? <div className="empty-state">No events match the current filters.</div> : null}
        {Object.entries(groups).map(([date, dayEvents]) => (
          <div className="day-group" key={date}>
            <div className="day-heading">
              <strong>{formatDate(date)}</strong>
              <span>{dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Countdown</th>
                    <th>Currency</th>
                    <th>Country</th>
                    <th>Impact</th>
                    <th>Event</th>
                    <th>Actual</th>
                    <th>Forecast</th>
                    <th>Previous</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {dayEvents.map((event) => (
                    <tr key={`${event.source}-${event.sourceEventId}`}>
                      <td>{formatTime(event.eventTimeUtc)}</td>
                      <td>{countdown(event.eventTimeUtc)}</td>
                      <td><strong>{event.currency}</strong></td>
                      <td>{event.country}</td>
                      <td><span className={`impact impact--${event.impact.toLowerCase()}`}>{event.impact}</span></td>
                      <td>
                        <strong>{event.eventName}</strong>
                        {event.category ? <small>{event.category}</small> : null}
                      </td>
                      <td>{event.actual ?? "-"}</td>
                      <td>{event.forecast ?? "-"}</td>
                      <td>{event.previous ?? "-"}</td>
                      <td>{event.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
