"""FastAPI entrypoint.

Architectural notes worth calling out in the README/interview:
  - Lifespan-managed singleton instead of module-level globals.
  - orjson for ~3x faster JSON serialisation than the stdlib encoder.
  - All heavy aggregates (rankings, correlations) are precomputed at startup
    and cached via @cached_property — request handlers are pure lookups.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import data_service
from .config import settings
from .data_service import DataService
from .schemas import (
    AgeBreakdown,
    CompositeRequest,
    CompositeResponse,
    CorrelationMatrix,
    DistrictValue,
    Insight,
    MetricMeta,
    MetricResponse,
    StateMatrix,
    StateValue,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    data_service.service = DataService()
    yield
    data_service.service = None


app = FastAPI(
    title="CensusScope API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def _svc() -> DataService:
    if data_service.service is None:
        raise HTTPException(503, "Data service not initialised")
    return data_service.service


# ----------------- metric catalogue -----------------

@app.get("/api/metrics", response_model=list[MetricMeta])
def list_metrics() -> list[MetricMeta]:
    return _svc().metrics


@app.get("/api/categories")
def list_categories() -> dict[str, list[MetricMeta]]:
    grouped: dict[str, list[MetricMeta]] = {}
    for m in _svc().metrics:
        grouped.setdefault(m.category, []).append(m)
    return grouped


@app.get("/api/district-metrics", response_model=list[MetricMeta])
def list_district_metrics() -> list[MetricMeta]:
    return _svc().district_metrics


@app.get("/api/district-categories")
def list_district_categories() -> dict[str, list[MetricMeta]]:
    grouped: dict[str, list[MetricMeta]] = {}
    for m in _svc().district_metrics:
        grouped.setdefault(m.category, []).append(m)
    return grouped


@app.get("/api/geo-states")
def geo_states() -> list[str]:
    """States that have district data (used by the district-analysis picker)."""
    return _svc().states_with_districts()


@app.get("/api/populations")
def populations() -> dict[str, float]:
    return _svc().population_by_state


# ----------------- state level -----------------

@app.get("/api/states/{metric_key}", response_model=MetricResponse)
def state_metric(metric_key: str) -> MetricResponse:
    svc = _svc()
    meta = svc.metric_index.get(metric_key)
    if not meta:
        raise HTTPException(404, f"Unknown metric: {metric_key}")
    df = svc.state_rankings.get(metric_key)
    if df is None or df.empty:
        raise HTTPException(404, "No data for metric")
    values = [
        StateValue(
            state=row["State name"],
            value=None if (row[metric_key] is None or (isinstance(row[metric_key], float) and row[metric_key] != row[metric_key])) else float(row[metric_key]),
            rank=int(row["rank"]),
            percentile=round(float(row["percentile"]), 2),
        )
        for _, row in df.iterrows()
    ]
    return MetricResponse(metric=meta, values=values, stats=svc.metric_stats(metric_key))


@app.get("/api/insights/{metric_key}", response_model=list[Insight])
def insights(metric_key: str) -> list[Insight]:
    svc = _svc()
    if metric_key not in svc.metric_index:
        raise HTTPException(404, f"Unknown metric: {metric_key}")
    return [Insight(**i) for i in svc.insights(metric_key)]


@app.get("/api/age-breakdown/{state}", response_model=AgeBreakdown)
def age_breakdown(state: str) -> AgeBreakdown:
    svc = _svc()
    groups, values = svc.age_breakdown(state.title())
    return AgeBreakdown(state=state.title(), groups=groups, values=values)


@app.get("/api/state-matrix", response_model=StateMatrix)
def state_matrix(metrics: str) -> StateMatrix:
    """Values per state for a comma-separated set of metrics + national averages."""
    svc = _svc()
    keys = [k.strip() for k in metrics.split(",") if k.strip()]
    data = svc.state_matrix(keys)
    if not data["metrics"]:
        raise HTTPException(404, "No valid metrics supplied")
    return StateMatrix(**data)


@app.get("/api/correlations", response_model=CorrelationMatrix)
def correlations(metrics: str | None = None) -> CorrelationMatrix:
    """Return correlation submatrix. `metrics` is a comma-separated subset; omit for all."""
    svc = _svc()
    m = svc.correlation_matrix
    if metrics:
        keys = [k.strip() for k in metrics.split(",") if k.strip() in m.columns]
        if keys:
            m = m.loc[keys, keys]
    return CorrelationMatrix(metrics=list(m.columns), matrix=m.values.tolist())


# ----------------- district level -----------------

@app.get("/api/districts/{state}/{metric_key}", response_model=list[DistrictValue])
def district_metric(state: str, metric_key: str) -> list[DistrictValue]:
    svc = _svc()
    if metric_key not in svc.district_df.columns:
        raise HTTPException(404, f"Unknown district metric: {metric_key}")
    df = svc.districts_for_state(state.title())
    if df.empty:
        raise HTTPException(404, f"No districts for state: {state}")
    out: list[DistrictValue] = []
    for _, row in df[["District name", "State name", metric_key]].iterrows():
        v = row[metric_key]
        out.append(DistrictValue(
            district=row["District name"],
            state=row["State name"],
            value=None if (v is None or (isinstance(v, float) and v != v)) else float(v),
        ))
    return out


# ----------------- composite index (standout feature) -----------------

@app.post("/api/composite", response_model=CompositeResponse)
def composite(req: CompositeRequest) -> CompositeResponse:
    svc = _svc()
    rows = svc.composite_score(req.weights, req.level, req.state_filter)
    return CompositeResponse(level=req.level, rows=rows)


@app.get("/api/health")
def health() -> dict[str, str | int]:
    svc = data_service.service
    return {
        "status": "ok" if svc else "starting",
        "states": 0 if not svc else len(svc.state_df),
        "districts": 0 if not svc else len(svc.district_df),
        "metrics": 0 if not svc else len(svc.metrics),
    }
