import { useEffect, useMemo, useState } from "react";
import {
  type EconomicEvent,
  type EventFilters,
  type Impact,
  getCalendarEvents,
  getHighImpactCalendarEvents,
  getTodayCalendarEvents,
  getWeekCalendarEvents,
  importCalendarEvents
} from "../services/economicCalendarApi";

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
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short"
  }).format(new Date(date));
}

function countdown(date: string) {
  const diff = new Date(date).getTime() - Date.now();
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

export function EconomicCalendar() {
  const [filters, setFilters] = useState<EventFilters>({
    from: todayIso(),
    to: addDaysIso(14),
    currency: "",
    impact: "",
    search: ""
  });
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [todayEvents, setTodayEvents] = useState<EconomicEvent[]>([]);
  const [weekEvents, setWeekEvents] = useState<EconomicEvent[]>([]);
  const [highImpactEvents, setHighImpactEvents] = useState<EconomicEvent[]>([]);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function refreshCalendar(nextFilters = filters) {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [eventData, todayData, weekData, highData] = await Promise.all([
        getCalendarEvents(nextFilters),
        getTodayCalendarEvents(),
        getWeekCalendarEvents(),
        getHighImpactCalendarEvents()
      ]);
      setEvents(eventData);
      setTodayEvents(todayData);
      setWeekEvents(weekData);
      setHighImpactEvents(highData);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load economic calendar.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshCalendar().catch(() => setErrorMessage("Unable to load economic calendar."));
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      refreshCalendar(filters).catch(() => setErrorMessage("Unable to load economic calendar."));
    }, 150);
    return () => window.clearTimeout(handle);
  }, [filters]);

  const groups = useMemo(() => groupByDate(events), [events]);
  const currencies = useMemo(
    () => Array.from(new Set([...weekEvents, ...events].map((event) => event.currency))).sort(),
    [events, weekEvents]
  );
  const majorEvent = nextMajor(events);
  const highNext24h = highImpactEvents.filter((event) => {
    const time = new Date(event.eventTimeUtc).getTime();
    return time >= Date.now() && time <= Date.now() + 24 * 60 * 60 * 1000;
  }).length;

  function setQuickView(view: "today" | "week" | "high") {
    if (view === "today") setFilters({ ...filters, from: todayIso(), to: todayIso(), impact: "" });
    if (view === "week") setFilters({ ...filters, from: todayIso(), to: addDaysIso(7), impact: "" });
    if (view === "high") setFilters({ ...filters, from: todayIso(), to: addDaysIso(14), impact: "High" });
  }

  async function onImportFile(file: File | null) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as EconomicEvent[];
      const result = await importCalendarEvents(parsed);
      setImportMessage(`Imported or updated ${result.imported} event${result.imported === 1 ? "" : "s"}.`);
      await refreshCalendar();
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "Import file must be a JSON array of events.");
    }
  }

  return (
    <div className="calendar-workspace">
      <header className="calendar-hero">
        <div>
          <p>Macro Event Monitor</p>
          <h1>Economic Calendar</h1>
          <span>Local-first market event calendar for macro risk monitoring, event windows, and portfolio overlays.</span>
        </div>
        <label className="icon-button calendar-import-button">
          Import JSON
          <input type="file" accept=".json,application/json" onChange={(event) => onImportFile(event.target.files?.[0] ?? null)} />
        </label>
      </header>

      {importMessage ? <div className="run-progress">{importMessage}</div> : null}
      {errorMessage ? <div className="alert-panel">{errorMessage}</div> : null}

      <section className="calendar-kpi-grid">
        <div>
          <span>Events today</span>
          <strong>{todayEvents.length}</strong>
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
          <strong>{weekEvents.length}</strong>
        </div>
      </section>

      <section className="calendar-toolbar">
        <div className="calendar-quick-actions">
          <button onClick={() => setQuickView("today")}>Today</button>
          <button onClick={() => setQuickView("week")}>This week</button>
          <button onClick={() => setQuickView("high")}>High impact only</button>
        </div>
        <div className="calendar-filters">
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
            <input
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              placeholder="CPI, FOMC, labour..."
            />
          </label>
        </div>
      </section>

      <section className="calendar-panel">
        <div className="panel-heading">
          <h2>Upcoming Economic Events</h2>
          <span>
            {events.length} event{events.length === 1 ? "" : "s"}
          </span>
        </div>
        {loading ? <div className="empty-state">Loading calendar...</div> : null}
        {!loading && !errorMessage && events.length === 0 ? <div className="empty-state">No events match the current filters.</div> : null}
        {Object.entries(groups).map(([date, dayEvents]) => (
          <div className="calendar-day-group" key={date}>
            <div className="calendar-day-heading">
              <strong>{formatDate(date)}</strong>
              <span>
                {dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}
              </span>
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
                      <td>
                        <strong>{event.currency}</strong>
                      </td>
                      <td>{event.country}</td>
                      <td>
                        <span className={`impact impact--${event.impact.toLowerCase()}`}>{event.impact}</span>
                      </td>
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
    </div>
  );
}
