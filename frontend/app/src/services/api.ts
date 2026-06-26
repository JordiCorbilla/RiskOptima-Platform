import type { GeneratedRun, Portfolio, PortfolioSummary, RenderedChart, RiskReport } from "../types/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(detail.detail ?? "API request failed");
  }
  return response.json() as Promise<T>;
}

export function listPortfolios(): Promise<PortfolioSummary[]> {
  return request<PortfolioSummary[]>("/portfolios");
}

export function getPortfolio(portfolioId: number): Promise<Portfolio> {
  return request<Portfolio>(`/portfolios/${portfolioId}`);
}

export function updatePortfolio(portfolio: Portfolio): Promise<Portfolio> {
  return request<Portfolio>(`/portfolios/${portfolio.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: portfolio.name,
      base_currency: portfolio.base_currency,
      positions: portfolio.positions
    })
  });
}

export function getRiskReport(portfolioId: number): Promise<RiskReport> {
  return request<RiskReport>(`/portfolios/${portfolioId}/risk`);
}

export function getRenderedCharts(portfolioId: number): Promise<{ charts: RenderedChart[] }> {
  return request<{ charts: RenderedChart[] }>(`/portfolios/${portfolioId}/renders`);
}

export function uploadPortfolio(file: File, name: string): Promise<{ id: number }> {
  const form = new FormData();
  form.append("file", file);
  form.append("name", name);
  return request<PortfolioSummary>("/portfolios/upload", {
    method: "POST",
    body: form
  });
}

export function generatePortfolioRun(
  portfolioId: number,
  payload: { start_date?: string; as_of_date?: string; force?: boolean }
): Promise<GeneratedRun> {
  return request<GeneratedRun>(`/portfolios/${portfolioId}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}
