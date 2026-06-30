from functools import lru_cache

from app.core.config import get_settings
from app.repositories.portfolio_repository import PortfolioRepository, SQLitePortfolioRepository


@lru_cache
def get_portfolio_repository() -> PortfolioRepository:
    return SQLitePortfolioRepository(get_settings().database_path)
