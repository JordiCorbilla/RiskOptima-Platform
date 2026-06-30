from __future__ import annotations

from pathlib import Path

from app.domain.models import Position, SamplePortfolioSummary
from app.services.portfolio_service import parse_portfolio_csv


SAMPLE_NAMES = {
    "institutional_portfolio": "Institutional Sample Portfolio",
    "concentrated_growth_portfolio": "Concentrated Growth Portfolio",
    "vanguard_multi_asset_portfolio": "Vanguard Multi-Asset Model",
}


def _sample_data_path() -> Path:
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "sample_data"
        if candidate.exists():
            return candidate
    raise FileNotFoundError("sample_data directory was not found")


def _sample_name(slug: str) -> str:
    return SAMPLE_NAMES.get(slug, slug.replace("_", " ").replace("-", " ").title())


def _read_positions(path: Path) -> list[Position]:
    return parse_portfolio_csv(path.read_bytes())


def _sample_file(slug: str) -> Path:
    if not slug or slug != Path(slug).name or "/" in slug or "\\" in slug:
        raise ValueError(f"Sample portfolio '{slug}' was not found")
    root = _sample_data_path().resolve()
    path = (root / f"{slug}.csv").resolve()
    if path.parent != root or not path.exists() or path.suffix.lower() != ".csv":
        raise ValueError(f"Sample portfolio '{slug}' was not found")
    return path


def list_sample_portfolios() -> list[SamplePortfolioSummary]:
    samples: list[SamplePortfolioSummary] = []
    for path in sorted(_sample_data_path().glob("*.csv")):
        positions = _read_positions(path)
        samples.append(
            SamplePortfolioSummary(
                slug=path.stem,
                name=_sample_name(path.stem),
                filename=path.name,
                position_count=len(positions),
                market_value=sum(position.market_value for position in positions),
            )
        )
    return samples


def get_sample_portfolio(slug: str) -> tuple[str, list[Position]]:
    path = _sample_file(slug)
    return _sample_name(path.stem), _read_positions(path)
