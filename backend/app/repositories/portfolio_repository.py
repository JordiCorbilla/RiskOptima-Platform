from abc import ABC, abstractmethod
from datetime import datetime, timezone
import json
import sqlite3
from pathlib import Path

from app.domain.models import Portfolio, Position, PortfolioSummary


class PortfolioRepository(ABC):
    @abstractmethod
    def save(self, name: str, positions: list[Position], base_currency: str = "USD") -> Portfolio:
        raise NotImplementedError

    @abstractmethod
    def list(self) -> list[PortfolioSummary]:
        raise NotImplementedError

    @abstractmethod
    def get(self, portfolio_id: int) -> Portfolio | None:
        raise NotImplementedError


class SQLitePortfolioRepository(PortfolioRepository):
    def __init__(self, database_path: Path):
        self.database_path = database_path
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialise()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialise(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS portfolios (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    base_currency TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    positions_json TEXT NOT NULL
                )
                """
            )

    def save(self, name: str, positions: list[Position], base_currency: str = "USD") -> Portfolio:
        created_at = datetime.now(timezone.utc)
        payload = json.dumps([position.model_dump(mode="json") for position in positions])
        with self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO portfolios (name, base_currency, created_at, positions_json)
                VALUES (?, ?, ?, ?)
                """,
                (name, base_currency, created_at.isoformat(), payload),
            )
            portfolio_id = int(cursor.lastrowid)
        return Portfolio(
            id=portfolio_id,
            name=name,
            base_currency=base_currency,
            created_at=created_at,
            positions=positions,
        )

    def list(self) -> list[PortfolioSummary]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT id, name, base_currency, created_at, positions_json FROM portfolios ORDER BY created_at DESC"
            ).fetchall()
        summaries: list[PortfolioSummary] = []
        for row in rows:
            positions = [Position.model_validate(item) for item in json.loads(row["positions_json"])]
            portfolio = Portfolio(
                id=row["id"],
                name=row["name"],
                base_currency=row["base_currency"],
                created_at=datetime.fromisoformat(row["created_at"]),
                positions=positions,
            )
            summaries.append(
                PortfolioSummary(
                    id=portfolio.id,
                    name=portfolio.name,
                    base_currency=portfolio.base_currency,
                    created_at=portfolio.created_at,
                    position_count=len(portfolio.positions),
                    market_value=portfolio.market_value,
                )
            )
        return summaries

    def get(self, portfolio_id: int) -> Portfolio | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT id, name, base_currency, created_at, positions_json FROM portfolios WHERE id = ?",
                (portfolio_id,),
            ).fetchone()
        if row is None:
            return None
        return Portfolio(
            id=row["id"],
            name=row["name"],
            base_currency=row["base_currency"],
            created_at=datetime.fromisoformat(row["created_at"]),
            positions=[Position.model_validate(item) for item in json.loads(row["positions_json"])],
        )
