import numpy as np
import pandas as pd

from app.domain.models import Portfolio


FACTOR_NAMES = ["Market", "Size", "Value", "Momentum", "Rates"]


def generate_synthetic_market_data(portfolio: Portfolio, periods: int = 504, seed: int | None = None) -> tuple[pd.DataFrame, pd.DataFrame]:
    symbols = [position.instrument.symbol for position in portfolio.positions]
    if not symbols:
        raise ValueError("Portfolio has no positions")

    derived_seed = seed if seed is not None else portfolio.id * 10_003 + len(symbols)
    rng = np.random.default_rng(derived_seed)
    dates = pd.bdate_range(end=pd.Timestamp.today().normalize(), periods=periods)

    factor_cov = np.array(
        [
            [0.00011, 0.00002, 0.00001, 0.00003, -0.00001],
            [0.00002, 0.00008, 0.00001, 0.00001, 0.00000],
            [0.00001, 0.00001, 0.00007, -0.00001, 0.00001],
            [0.00003, 0.00001, -0.00001, 0.00010, -0.00001],
            [-0.00001, 0.00000, 0.00001, -0.00001, 0.00004],
        ]
    )
    factors = rng.multivariate_normal(np.array([0.00035, 0.00005, 0.00003, 0.00008, 0.0]), factor_cov, size=periods)
    factor_returns = pd.DataFrame(factors, index=dates, columns=FACTOR_NAMES)

    asset_returns: dict[str, np.ndarray] = {}
    for idx, position in enumerate(portfolio.positions):
        asset_class = position.instrument.asset_class
        beta = position.instrument.beta
        loadings = np.array(
            [
                beta,
                0.15 + 0.05 * (idx % 3),
                0.10 if asset_class.value in {"Equity", "Credit"} else -0.05,
                0.20 - 0.04 * (idx % 4),
                -0.35 if asset_class.value == "Fixed Income" else 0.05,
            ]
        )
        idiosyncratic_vol = 0.006 + 0.0015 * (idx % 5)
        noise = rng.normal(0.0, idiosyncratic_vol, size=periods)
        asset_returns[position.instrument.symbol] = factors @ loadings + noise

    return pd.DataFrame(asset_returns, index=dates), factor_returns


def generate_price_paths(portfolio: Portfolio, returns: pd.DataFrame) -> pd.DataFrame:
    start_prices = {position.instrument.symbol: position.price for position in portfolio.positions}
    prices = (1.0 + returns).cumprod()
    for symbol, price in start_prices.items():
        prices[symbol] = prices[symbol] * price
    return prices
