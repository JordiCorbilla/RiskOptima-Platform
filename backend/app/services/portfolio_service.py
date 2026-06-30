from io import BytesIO

import pandas as pd

from app.domain.models import AssetClass, Instrument, Position


REQUIRED_COLUMNS = {"symbol", "quantity", "price"}


def parse_portfolio_csv(content: bytes) -> list[Position]:
    frame = pd.read_csv(BytesIO(content))
    frame.columns = [column.strip().lower() for column in frame.columns]
    missing = REQUIRED_COLUMNS - set(frame.columns)
    if missing:
        raise ValueError(f"CSV is missing required columns: {', '.join(sorted(missing))}")

    positions: list[Position] = []
    for row_number, row in frame.iterrows():
        symbol = str(row["symbol"]).strip().upper()
        if not symbol:
            raise ValueError(f"Row {row_number + 2} has an empty symbol")
        asset_class_value = str(row.get("asset_class", "Equity")).strip() or "Equity"
        try:
            asset_class = AssetClass(asset_class_value)
        except ValueError:
            asset_class = AssetClass.equity

        instrument = Instrument(
            symbol=symbol,
            name=str(row.get("name", symbol)).strip() or symbol,
            asset_class=asset_class,
            sector=str(row.get("sector", "Diversified")).strip() or "Diversified",
            currency=str(row.get("currency", "USD")).strip().upper() or "USD",
            beta=float(row.get("beta", 1.0)),
        )
        positions.append(
            Position(
                instrument=instrument,
                quantity=float(row["quantity"]),
                price=float(row["price"]),
            )
        )
    if not positions:
        raise ValueError("CSV did not contain any positions")
    return positions
