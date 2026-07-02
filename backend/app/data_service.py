"""Data service.

The original `loader.py` mutated module-level globals and was effectively
untestable. Here state lives inside a `DataService` instance owned by the
FastAPI app; precomputation runs once at startup; everything downstream
reads from immutable cached frames.
"""

from __future__ import annotations

import logging
from functools import cached_property

import numpy as np
import pandas as pd

from .config import CATEGORY_RULES, settings
from .schemas import MetricMeta

log = logging.getLogger(__name__)


def _humanise(col: str) -> str:
    """Turn `Households_with_Internet_pct` into `Households with Internet`."""
    clean = col.replace("_pct", "").replace("_%", "").replace("%", "").replace("_", " ")
    return clean.strip().title()


def _categorise(col: str) -> str:
    """Declarative replacement for the buggy if/elif chain in the original."""
    col_lower = col.lower()
    for category, must_any, must_not in CATEGORY_RULES:
        if any(tok in col_lower for tok in must_any) and not any(tok in col_lower for tok in must_not):
            return category
    return "Other"


class DataService:
    """Loads, validates and precomputes. One instance per process."""

    def __init__(self) -> None:
        self.state_df: pd.DataFrame
        self.district_df: pd.DataFrame
        self.metrics: list[MetricMeta] = []
        self.district_metrics: list[MetricMeta] = []
        self._load()

    def _load(self) -> None:
        state_path = settings.data_dir / settings.state_csv
        district_path = settings.data_dir / settings.district_csv

        if not state_path.exists() or not district_path.exists():
            log.warning("CSV files not found in %s — service will return empty data.", settings.data_dir)
            self.state_df = pd.DataFrame()
            self.district_df = pd.DataFrame()
            return

        state_raw = pd.read_csv(state_path)
        district_raw = pd.read_csv(district_path)

        # State-level: keep percentage columns + identifiers (+ Population for
        # bubble sizing in the comparison pathway chart).
        pct_cols = [c for c in state_raw.columns if c.endswith("_pct")]
        keep = ["State name", *pct_cols]
        if "Population" in state_raw.columns:
            keep.append("Population")
        self.state_df = state_raw[keep].copy()
        self.state_df["State name"] = self.state_df["State name"].str.strip().str.title()

        # District-level: '%' suffix convention from the original CSV
        d_pct_cols = [c for c in district_raw.columns if "%" in str(c)]
        self.district_df = district_raw[["State name", "District name", *d_pct_cols]].copy()
        self.district_df["State name"] = self.district_df["State name"].str.strip().str.title()
        self.district_df["District name"] = self.district_df["District name"].str.strip().str.title()

        # Build metric registries once (state + district).
        self.metrics = [
            MetricMeta(key=c, label=_humanise(c), category=_categorise(c)) for c in pct_cols
        ]
        self.district_metrics = [
            MetricMeta(key=c, label=_humanise(c), category=_categorise(c)) for c in d_pct_cols
        ]
        log.info("Loaded %d states, %d districts, %d metrics",
                 len(self.state_df), len(self.district_df), len(self.metrics))

    # ---------------- precomputed views ----------------

    @cached_property
    def metric_index(self) -> dict[str, MetricMeta]:
        return {m.key: m for m in self.metrics}

    @cached_property
    def state_rankings(self) -> dict[str, pd.DataFrame]:
        """For each metric: a DataFrame with state, value, rank, percentile — precomputed."""
        out: dict[str, pd.DataFrame] = {}
        for m in self.metrics:
            if m.key not in self.state_df.columns:
                continue
            s = self.state_df[["State name", m.key]].dropna().copy()
            s = s.groupby("State name", as_index=False)[m.key].mean()
            s = s.sort_values(m.key, ascending=False).reset_index(drop=True)
            s["rank"] = s.index + 1
            s["percentile"] = s[m.key].rank(pct=True) * 100
            out[m.key] = s
        return out

    @cached_property
    def correlation_matrix(self) -> pd.DataFrame:
        """State-level Pearson correlation across all metrics. Computed once."""
        cols = [m.key for m in self.metrics if m.key in self.state_df.columns]
        return self.state_df[cols].corr(method="pearson").round(3)

    def metric_stats(self, key: str) -> dict[str, float]:
        s = self.state_rankings.get(key)
        if s is None or s.empty:
            return {}
        v = s[key]
        return {
            "min": float(v.min()),
            "max": float(v.max()),
            "mean": float(v.mean()),
            "median": float(v.median()),
            "std": float(v.std()),
        }

    @cached_property
    def district_metric_index(self) -> dict[str, MetricMeta]:
        return {m.key: m for m in self.district_metrics}

    @cached_property
    def state_means(self) -> dict[str, float]:
        """National mean per metric (mean across states, matching the reference)."""
        out: dict[str, float] = {}
        for m in self.metrics:
            if m.key in self.state_df.columns:
                out[m.key] = float(self.state_df[m.key].mean())
        return out

    @cached_property
    def population_by_state(self) -> dict[str, float]:
        if "Population" not in self.state_df.columns:
            return {}
        g = self.state_df.groupby("State name")["Population"].sum()
        return {k: float(v) for k, v in g.items()}

    def districts_for_state(self, state_title: str) -> pd.DataFrame:
        return self.district_df[self.district_df["State name"] == state_title].copy()

    def states_with_districts(self) -> list[str]:
        return sorted(self.district_df["State name"].dropna().unique().tolist())

    def age_breakdown(self, state_title: str) -> tuple[list[str], list[float]]:
        """Return the three main age-group percentages for a state."""
        age_map = [
            ("0–29", "Age_Group_0_29_pct"),
            ("30–49", "Age_Group_30_49_pct"),
            ("50+", "Age_Group_50_pct"),
        ]
        row = self.state_df[self.state_df["State name"] == state_title]
        groups, values = [], []
        if row.empty:
            return groups, values
        for label, col in age_map:
            if col in self.state_df.columns:
                v = row[col].mean()
                if pd.notna(v):
                    groups.append(label)
                    values.append(round(float(v), 2))
        return groups, values

    def insights(self, key: str) -> list[dict]:
        """Five key insights for a metric — faithful to the reference dashboard."""
        s = self.state_rankings.get(key)
        if s is None or s.empty:
            return []
        vals = s[key]
        best = s.iloc[0]
        worst = s.iloc[-1]
        national_avg = float(vals.mean())
        gap = float(best[key]) - float(worst[key])
        above = int((vals > national_avg).sum())
        total = int(len(vals))
        p75 = float(vals.quantile(0.75))
        top_performers = int((vals >= p75).sum())
        std = float(vals.std())
        low = key.lower()

        insights = [
            {"icon": "🏆", "title": "Top Performer", "value": str(best["State name"]),
             "detail": f"{float(best[key]):.1f}%", "color": "#10b981"},
            {"icon": "🇮🇳", "title": "National Average", "value": f"{national_avg:.1f}%",
             "detail": f"{above}/{total} states above average", "color": "#3b82f6"},
            {"icon": "📊", "title": "Performance Gap", "value": f"{gap:.1f}%",
             "detail": f"Between {best['State name']} and {worst['State name']}", "color": "#f59e0b"},
        ]
        if "literate" in low or "education" in low:
            insights.append({"icon": "📚", "title": "Education Focus", "value": f"{top_performers} states",
                             "detail": f"Achieve >75th percentile ({p75:.1f}%)", "color": "#8b5cf6"})
        elif "employment" in low or "worker" in low:
            insights.append({"icon": "💼", "title": "Employment Pattern", "value": f"±{std:.1f}%",
                             "detail": "Standard deviation across states", "color": "#8b5cf6"})
        elif "household" in low or "amenit" in low:
            insights.append({"icon": "🏠", "title": "Infrastructure", "value": f"{top_performers} states",
                             "detail": "Lead in household amenities", "color": "#8b5cf6"})
        else:
            insights.append({"icon": "📈", "title": "Variability", "value": f"{std:.1f}%",
                             "detail": "Standard deviation indicates spread", "color": "#8b5cf6"})
        insights.append({"icon": "🎯", "title": "Improvement Potential", "value": str(worst["State name"]),
                         "detail": f"{float(worst[key]):.1f}% — has growth opportunity", "color": "#ef4444"})
        return insights

    def state_matrix(self, keys: list[str]) -> dict:
        """Values per state for a set of metrics + national averages (radar)."""
        keys = [k for k in keys if k in self.state_df.columns]
        metas = [self.metric_index[k] for k in keys if k in self.metric_index]
        df = self.state_df.groupby("State name", as_index=True)[keys].mean()
        states = df.index.tolist()
        values = {
            st: [None if pd.isna(df.loc[st, k]) else round(float(df.loc[st, k]), 2) for k in keys]
            for st in states
        }
        national = [round(self.state_means.get(k, 0.0), 2) for k in keys]
        return {"metrics": metas, "states": states, "values": values, "national_avg": national}

    def composite_score(self, weights: dict[str, float], level: str, state_filter: str | None) -> list[dict]:
        """Weighted multi-metric composite. Each metric is min-max normalised
        across the level, then a weighted sum produces a 0-100 score."""
        weights = {k: v for k, v in weights.items() if v > 0}
        if not weights:
            return []
        total_w = sum(weights.values())
        weights = {k: v / total_w for k, v in weights.items()}

        if level == "state":
            df = self.state_df.copy()
            name_col = "State name"
        else:
            df = self.district_df.copy()
            if state_filter:
                df = df[df["State name"] == state_filter]
            name_col = "District name"

        usable = [k for k in weights if k in df.columns]
        if not usable:
            return []
        sub = df[[name_col, *usable]].dropna(subset=usable, how="all").copy()

        normed = pd.DataFrame(index=sub.index)
        for k in usable:
            col = sub[k]
            rng = col.max() - col.min()
            normed[k] = (col - col.min()) / rng if rng > 0 else 0.5

        sub["__score__"] = sum(normed[k] * weights[k] for k in usable) * 100
        sub = sub.sort_values("__score__", ascending=False)

        return [
            {
                "name": row[name_col],
                "score": round(float(row["__score__"]), 2),
                "components": {k: (None if pd.isna(row[k]) else round(float(row[k]), 2)) for k in usable},
            }
            for _, row in sub.iterrows()
        ]


# Lifespan-attached singleton (initialised in main.py)
service: DataService | None = None
