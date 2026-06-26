from __future__ import annotations

import base64
from io import BytesIO

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
import squarify

from app.domain.models import Portfolio
from app.services.market_data_service import generate_synthetic_market_data
from app.services.risk_service import _optimize_portfolio


def _png_data_url(fig: plt.Figure) -> str:
    buffer = BytesIO()
    fig.savefig(buffer, format="png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _portfolio_weights(portfolio: Portfolio) -> pd.Series:
    values = pd.Series({position.instrument.symbol: position.market_value for position in portfolio.positions})
    return values / values.sum()


def _portfolio_area_chart(portfolio: Portfolio, returns: pd.DataFrame, weights: pd.Series) -> dict[str, str]:
    recent_returns = returns.tail(5).add(1.0).prod().sub(1.0).reindex(weights.index)
    min_value = float(recent_returns.min())
    max_value = float(recent_returns.max())
    if np.isclose(min_value, max_value):
        min_value -= 0.0001
        max_value += 0.0001
    norm = matplotlib.colors.Normalize(vmin=min_value, vmax=max_value)
    colors = [matplotlib.cm.RdYlGn(norm(value)) for value in recent_returns]
    labels = [
        f"{symbol}\n{recent_returns[symbol] * 100:+.2f}%\nAllocation: {weights[symbol] * 100:.1f}%"
        for symbol in weights.index
    ]

    fig, ax = plt.subplots(figsize=(16, 9))
    squarify.plot(
        sizes=(weights * 100).values,
        label=labels,
        color=colors,
        alpha=0.86,
        ax=ax,
        edgecolor="#4f4f4f",
        linewidth=1.5,
        text_kwargs={"fontsize": 9, "weight": "bold"},
    )
    ax.set_title("[RiskOptima] Portfolio Area Chart: 5-Day Synthetic Returns", fontsize=16, pad=18)
    ax.axis("off")
    cbar_ax = fig.add_axes([0.92, 0.16, 0.02, 0.68])
    scalar_map = matplotlib.cm.ScalarMappable(cmap=matplotlib.cm.RdYlGn, norm=norm)
    plt.colorbar(scalar_map, cax=cbar_ax).set_label("5-Day Return", fontsize=10)
    return {"title": "Portfolio Area Chart", "description": "RiskOptima-style allocation map with recent synthetic returns.", "image": _png_data_url(fig)}


def _correlation_heatmap(returns: pd.DataFrame) -> dict[str, str]:
    fig, ax = plt.subplots(figsize=(14, 10))
    sns.heatmap(
        returns.corr(),
        annot=True,
        fmt=".2f",
        cmap="crest",
        center=0,
        linewidths=0.3,
        linecolor="gray",
        square=True,
        cbar_kws={"label": "Correlation"},
        ax=ax,
    )
    ax.set_title("[RiskOptima] Correlation Matrix - Synthetic Market Data", fontsize=16, pad=16)
    ax.tick_params(axis="x", rotation=90)
    ax.tick_params(axis="y", rotation=0)
    return {"title": "Correlation Matrix", "description": "RiskOptima heatmap treatment rendered from synthetic returns.", "image": _png_data_url(fig)}


def _efficient_frontier_chart(returns: pd.DataFrame, weights: pd.Series, optimization: dict) -> dict[str, str]:
    frontier = pd.DataFrame(optimization["efficient_frontier"])
    highlights = pd.DataFrame(optimization["highlight_points"])

    fig, ax = plt.subplots(figsize=(16, 9))
    scatter = ax.scatter(
        frontier["volatility"],
        frontier["return"],
        c=frontier["sharpe"],
        cmap="plasma",
        alpha=0.45,
        s=16,
        label="Simulated Portfolios",
    )
    fig.colorbar(scatter, ax=ax, label="Sharpe Ratio")
    ax.scatter(highlights["volatility"], highlights["return"], color=["black", "green", "red"], marker="*", s=220)
    for _, row in highlights.iterrows():
        ax.annotate(row["name"], (row["volatility"], row["return"]), xytext=(8, 8), textcoords="offset points", fontsize=10)
    ax.set_title("[RiskOptima] Efficient Frontier - Monte Carlo Simulation", fontsize=16, pad=16)
    ax.set_xlabel("Volatility")
    ax.set_ylabel("Return")
    ax.xaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1.0))
    ax.yaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1.0))
    ax.grid(visible=True, which="major", linestyle="--", linewidth=0.5, color="gray", alpha=0.7)
    ax.legend(loc="lower center", bbox_to_anchor=(0.5, -0.14), ncol=3)
    return {"title": "Efficient Frontier", "description": "Matplotlib rendering of the notebook-style efficient frontier.", "image": _png_data_url(fig)}


def _allocation_comparison_chart(optimization: dict) -> dict[str, str]:
    allocation = pd.DataFrame(optimization["allocation_comparison"]).set_index("symbol")
    fig, ax = plt.subplots(figsize=(16, 8))
    allocation.rename(
        columns={"current": "Current Portfolio", "max_sharpe": "Max Sharpe", "min_variance": "Minimum Variance"}
    ).plot(kind="bar", ax=ax, color=["#e69a9a", "#9ae69b", "#9ac7e6"], width=0.78)
    ax.set_title("[RiskOptima] Current vs Optimized Portfolio Weights", fontsize=16, pad=16)
    ax.set_xlabel("Asset")
    ax.set_ylabel("Weight")
    ax.yaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1.0))
    ax.grid(axis="y", linestyle="--", linewidth=0.5, alpha=0.6)
    ax.legend(loc="upper right")
    return {"title": "Optimized Weights", "description": "Current, max-Sharpe, and minimum-variance allocations.", "image": _png_data_url(fig)}


def build_rendered_charts(portfolio: Portfolio) -> list[dict[str, str]]:
    returns, _ = generate_synthetic_market_data(portfolio)
    weights = _portfolio_weights(portfolio)
    optimization = _optimize_portfolio(returns, weights)
    return [
        _portfolio_area_chart(portfolio, returns, weights),
        _correlation_heatmap(returns.reindex(columns=weights.index)),
        _efficient_frontier_chart(returns, weights, optimization),
        _allocation_comparison_chart(optimization),
    ]
