import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

vi.mock("./services/api", () => ({
  listPortfolios: vi.fn().mockResolvedValue([]),
  getPortfolio: vi.fn(),
  updatePortfolio: vi.fn(),
  generatePortfolioRun: vi.fn(),
  listPortfolioRuns: vi.fn().mockResolvedValue([]),
  getPortfolioSignals: vi.fn(),
  getNotebookWorkbench: vi.fn(),
  uploadPortfolio: vi.fn()
}));

describe("App", () => {
  it("renders the portfolio risk dashboard shell", async () => {
    render(<App />);

    expect(screen.getByRole("img", { name: /RiskOptima/i })).toBeInTheDocument();
    expect(screen.getByText("Portfolio Risk Dashboard")).toBeInTheDocument();
    expect(await screen.findByText("No portfolio loaded")).toBeInTheDocument();
  });
});
