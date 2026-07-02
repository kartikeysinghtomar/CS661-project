"""API response schemas. Pydantic models double as documentation."""

from pydantic import BaseModel, Field


class MetricMeta(BaseModel):
    """A single census metric (column) with display metadata."""

    key: str = Field(..., description="Original column name from the CSV")
    label: str = Field(..., description="Human-readable label")
    category: str
    unit: str = "%"


class StateValue(BaseModel):
    state: str
    value: float | None
    rank: int | None = None
    percentile: float | None = None


class MetricResponse(BaseModel):
    metric: MetricMeta
    values: list[StateValue]
    stats: dict[str, float]  # min, max, mean, median, std


class DistrictValue(BaseModel):
    district: str
    state: str
    value: float | None


class CorrelationMatrix(BaseModel):
    metrics: list[str]
    matrix: list[list[float]]


class CompositeRequest(BaseModel):
    """User-defined weighted composite index across multiple metrics."""

    weights: dict[str, float]  # metric_key -> weight (0..1, normalised server-side)
    level: str = Field("state", pattern="^(state|district)$")
    state_filter: str | None = None


class CompositeResponse(BaseModel):
    level: str
    rows: list[dict]  # [{name, score, components: {metric: value}}]


class Insight(BaseModel):
    icon: str
    title: str
    value: str
    detail: str
    color: str


class AgeBreakdown(BaseModel):
    state: str
    groups: list[str]
    values: list[float]


class StateMatrix(BaseModel):
    """Values for a set of metrics across all states, plus national averages.

    Powers the comparison radar chart and multi-metric views client-side.
    """

    metrics: list[MetricMeta]
    states: list[str]
    values: dict[str, list[float | None]]  # state -> [value per metric]
    national_avg: list[float | None]       # national mean per metric
