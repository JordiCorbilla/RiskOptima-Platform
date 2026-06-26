import type { PortfolioSummary, RiskReport } from "../types/api";

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

export function getRiskReport(portfolioId: number): Promise<RiskReport> {
  return request<RiskReport>(`/portfolios/${portfolioId}/risk`);
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
