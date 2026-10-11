"""Capture desktop/mobile views using explicit synthetic provider fixtures.

Run from the repository root with PYTHONPATH=backend, local library override,
Playwright installed, and the UI running on port 5174. Requires Microsoft Edge.
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
from playwright.sync_api import sync_playwright

from app.domain.dislocation import ResearchRequest
from app.services.dislocation_service import run_research
from app.services.risk_service import _ensure_riskoptima_path

_ensure_riskoptima_path()
from riskoptima.dislocation import MarketSnapshot


class FixtureProvider:
    def get_snapshot(self, symbol, period="5y"):
        if symbol == "BAD":
            raise ValueError("Fixture: price history unavailable for BAD")
        dates = pd.bdate_range("2025-01-01", periods=300)
        prices = 100 + np.linspace(0, 20, 300) + 3 * np.sin(np.arange(300) / 7)
        info = {"quoteType": "ETF" if symbol == "SPY" else "EQUITY", "currency": "USD"}
        if symbol != "SPY":
            info.update(freeCashflow=1_000_000_000, sharesOutstanding=100_000_000, earningsGrowth=0.04)
        return MarketSnapshot(symbol, pd.DataFrame({"Close": prices}, index=dates), info)


def response(symbols):
    request = ResearchRequest(tickers=symbols, config={"use_markov_regime": False})
    result = run_research(request, [(s, "Synthetic research fixture") for s in symbols], FixtureProvider())
    result.source = "Synthetic provider fixture (visual verification only)"
    return result.model_dump_json()


def main():
    screenshots = Path("docs/screenshots")
    screenshots.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="msedge", headless=True)
        for name, width, height in [("desktop", 1440, 1000), ("mobile", 390, 844)]:
            page = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=1)
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.route("**/api/portfolios", lambda route: route.fulfill(json=[]))
            page.route("**/api/portfolio-samples", lambda route: route.fulfill(json=[]))
            page.route("**/api/dislocation/scan", lambda route: route.fulfill(content_type="application/json", body=response(route.request.post_data_json["tickers"])))
            page.goto("http://127.0.0.1:5174/")
            page.get_by_role("button", name="Dislocation Research", exact=True).click()
            page.get_by_label("Ticker symbols").fill("MSFT, SPY, BAD")
            page.get_by_role("button", name="Analyze instruments", exact=True).click()
            page.get_by_text("Partial results:", exact=False).wait_for()
            page.get_by_text("Synthetic provider fixture (visual verification only)", exact=False).first.wait_for()
            assert page.locator(".research-markdown table").count() > 0
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
            page.screenshot(path=str(screenshots / f"dislocation-{name}.png"), full_page=True)
            page.evaluate("window.scrollTo(0, window.innerWidth < 600 ? document.querySelector('.dislocation-page').getBoundingClientRect().top + window.scrollY : 0)")
            page.screenshot(path=str(screenshots / f"dislocation-{name}-viewport.png"))
            page.get_by_role("button", name="Instrument", exact=True).click()
            assert "BAD" in page.locator(".research-table tbody tr").first.inner_text()
            page.get_by_role("button", name="SPY", exact=True).click()
            page.get_by_text("No corporate DCF or measured NAV discount", exact=False).wait_for()
            page.screenshot(path=str(screenshots / f"dislocation-fund-{name}.png"), full_page=True)
            page.get_by_label("Ticker symbols").fill("BAD")
            page.get_by_role("button", name="Analyze instruments", exact=True).click()
            page.get_by_text("all tickers returned errors", exact=False).wait_for()
            assert not errors, errors
            print(json.dumps({"viewport": name, "overflow": False, "page_errors": errors, "partial_fund_all_error_states": "passed"}))
            page.close()
        browser.close()


if __name__ == "__main__":
    main()
