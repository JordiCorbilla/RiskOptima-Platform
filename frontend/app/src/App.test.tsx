import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

vi.mock("./services/api", () => ({
  listPortfolios: vi.fn().mockResolvedValue([]),
  getPortfolio: vi.fn(),
  updatePortfolio: vi.fn(),
  generatePortfolioRun: vi.fn(),
  getPortfolioSignals: vi.fn(),
  uploadPortfolio: vi.fn()
}));

describe("App", () => {
  it("renders the portfolio risk dashboard shell", async () => {
    render(<App />);

    expect(screen.getByText("RiskOptima")).toBeInTheDocument();
    expect(screen.getByText("Portfolio Risk Dashboard")).toBeInTheDocument();
    expect(await screen.findByText("No portfolio loaded")).toBeInTheDocument();
  });
});
