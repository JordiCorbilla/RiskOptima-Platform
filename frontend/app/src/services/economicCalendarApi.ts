export type Impact = "Low" | "Medium" | "High";

export interface EconomicEvent {
  id?: string;
  source: string;
  sourceEventId: string;
  country: string;
  currency: string;
  eventName: string;
  category?: string | null;
  eventTimeUtc: string;
  impact: Impact;
  actual?: string | null;
  forecast?: string | null;
  previous?: string | null;
  unit?: string | null;
  sourceUrl?: string | null;
}

export interface EventFilters {
  from?: string;
  to?: string;
  currency?: string;
  impact?: Impact | "";
  search?: string;
}

const CALENDAR_API_BASE = import.meta.env.VITE_CALENDAR_API_BASE_URL ?? "/calendar-api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${CALENDAR_API_BASE}${path}`, init);
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(detail.detail ?? "Calendar API request failed");
  }
  return response.json() as Promise<T>;
}

export function getCalendarEvents(filters: EventFilters): Promise<EconomicEvent[]> {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) query.set(key, String(value));
  });
  return request<EconomicEvent[]>(`/events?${query.toString()}`);
}

export function getTodayCalendarEvents(): Promise<EconomicEvent[]> {
  return request<EconomicEvent[]>("/events/today");
}

export function getWeekCalendarEvents(): Promise<EconomicEvent[]> {
  return request<EconomicEvent[]>("/events/week");
}

export function getHighImpactCalendarEvents(): Promise<EconomicEvent[]> {
  return request<EconomicEvent[]>("/events/high-impact");
}

export function importCalendarEvents(events: EconomicEvent[]): Promise<{ imported: number }> {
  return request<{ imported: number }>("/events/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(events)
  });
}
