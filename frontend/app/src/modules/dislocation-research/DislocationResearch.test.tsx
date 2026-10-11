import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DislocationResearch } from "./DislocationResearch";
import { SafeMarkdown } from "../../components/SafeMarkdown";
import { scanDislocation } from "../../services/api";
import type { ResearchResult } from "./types";
import type { Portfolio } from "../../types/api";

vi.mock("../../services/api", () => ({ scanDislocation: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

const fixture: ResearchResult = {
  status: "partial", riskoptima_version: "2.8.0", source: "Fixture provider",
  assumptions: { discount_rate: 0.09, valuation_horizon_years: 5 },
  summary: [{ symbol: "MSFT", name: "Microsoft", classification: "RESEARCH", price: 100, opportunity_score: 70, confidence_score: 80 },
    { symbol: "BAD", name: "Bad ticker", classification: "ERROR", price: null, opportunity_score: null, error: "No price history" }],
  analyses: [{ symbol: "MSFT", name: "Microsoft", classification: "RESEARCH", instrument_type: "EQUITY", price: 100, currency: "USD", as_of: "2026-06-30", generated_at: "2026-07-01", riskoptima_version: "2.8.0", valuation_mode: "fundamental", intrinsic_value: 150, margin_of_safety: 1 / 3, upside_to_model_value: 0.5, implied_annualized_return: 0.08447, valuation_horizon_years: 5, diagnostics: ["Unadjusted FCF proxy"], metrics: { zscore: -1.2 } }],
  reports: { MSFT: "# RiskOptima v2.8.0\n\n<script>alert(1)</script>\n\nReport text" }
};
function start() { render(<DislocationResearch portfolio={null} />); fireEvent.click(screen.getByRole("button", { name: "Analyze instruments" })); }

describe("Dislocation Research", () => {
  it("shows loading then partial failures, corrected metrics and diagnostics", async () => {
    let resolve!: (result: ResearchResult) => void;
    vi.mocked(scanDislocation).mockReturnValue(new Promise(r => { resolve = r; }));
    start(); expect(screen.getByRole("status")).toHaveTextContent("server-side");
    resolve(fixture);
    expect(await screen.findByText(/Partial results:/)).toBeInTheDocument();
    expect(screen.getByText("33.33%")).toBeInTheDocument();
    expect(screen.getByText("50.00%")).toBeInTheDocument();
    expect(screen.getByText("8.45%")).toBeInTheDocument();
    expect(screen.getByText(/Not a forecast or total-return IRR/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Data Coverage" })).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "BAD" }));
    expect(screen.getByRole("heading", { name: "BAD" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Instrument" }));
    expect(within(screen.getAllByRole("row")[1]).getByText("BAD")).toBeInTheDocument();
  });
  it("shows all-error scans as failures", async () => {
    vi.mocked(scanDislocation).mockResolvedValue({ ...fixture, status: "failed", analyses: [], summary: [fixture.summary[1]], reports: {} });
    start(); expect(await screen.findByText(/all tickers returned errors/)).toBeInTheDocument();
    expect(screen.queryByText("Equity model valuation")).not.toBeInTheDocument();
  });
  it("does not present missing valuations as zero", async () => {
    vi.mocked(scanDislocation).mockResolvedValue({ ...fixture, status: "success", analyses: [{ ...fixture.analyses[0], intrinsic_value: null, margin_of_safety: null, upside_to_model_value: null, implied_annualized_return: null }] });
    start(); expect(await screen.findByText(/Model valuation unavailable/)).toBeInTheDocument();
    expect(screen.queryByText("0.00%")).not.toBeInTheDocument();
    expect(screen.queryByText("Model value per share")).not.toBeInTheDocument();
  });
  it("hides corporate DCF for funds and keeps version branding", async () => {
    vi.mocked(scanDislocation).mockResolvedValue({ ...fixture, analyses: [{ ...fixture.analyses[0], instrument_type: "ETF", valuation_mode: "market_dislocation", intrinsic_value: null }] });
    start(); expect(await screen.findByText(/No corporate DCF or measured NAV discount/)).toBeInTheDocument();
    expect(screen.queryByText("Equity model valuation")).not.toBeInTheDocument();
    expect(screen.getAllByText(/RiskOptima v2.8.0/).length).toBeGreaterThan(0);
  });
  it("sends only selected portfolio holdings with portfolio id", async () => {
    vi.mocked(scanDislocation).mockResolvedValue(fixture);
    const portfolio = { id: 7, name: "Holdings", positions: [{ instrument: { symbol: "MSFT", name: "Microsoft" } }] } as Portfolio;
    render(<DislocationResearch portfolio={portfolio} />);
    fireEvent.change(screen.getByLabelText("Instruments"), { target: { value: "portfolio" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /MSFT/ }));
    fireEvent.click(screen.getByRole("button", { name: "Analyze instruments" }));
    await screen.findByText(/Partial results:/);
    expect(scanDislocation).toHaveBeenCalledWith(expect.objectContaining({ portfolio_id: 7, tickers: ["MSFT"] }));
  });
  it("shows network failures", async () => {
    vi.mocked(scanDislocation).mockRejectedValue(new Error("API unavailable"));
    start(); expect(await screen.findByRole("alert")).toHaveTextContent("API unavailable");
  });
  it("blocks raw HTML, remote images and unsafe Markdown links", () => {
    const { container } = render(<SafeMarkdown>{'<img src=x onerror=alert(1)>\n\n[bad](javascript:alert%281%29)\n\n![tracking](https://example.com/track)\n\n[safe](https://example.com)'}</SafeMarkdown>);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelectorAll("a")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "safe" })).toHaveAttribute("rel", "noopener noreferrer");
  });
});
