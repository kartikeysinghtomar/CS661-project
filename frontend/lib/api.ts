/**
 * Typed API client for the CensusScope FastAPI backend.
 * Requests are proxied through Next's rewrite (/api/* -> :8000) and GETs are
 * memoised in-process so repeat reads within a session are instant.
 */

export interface MetricMeta {
  key: string;
  label: string;
  category: string;
  unit: string;
}

export interface StateValue {
  state: string;
  value: number | null;
  rank: number | null;
  percentile: number | null;
}

export interface MetricResponse {
  metric: MetricMeta;
  values: StateValue[];
  stats: Record<string, number>;
}

export interface DistrictValue {
  district: string;
  state: string;
  value: number | null;
}

export interface Insight {
  icon: string;
  title: string;
  value: string;
  detail: string;
  color: string;
}

export interface AgeBreakdown {
  state: string;
  groups: string[];
  values: number[];
}

export interface StateMatrix {
  metrics: MetricMeta[];
  states: string[];
  values: Record<string, (number | null)[]>;
  national_avg: (number | null)[];
}

export interface CorrelationMatrix {
  metrics: string[];
  matrix: number[][];
}

export interface CompositeRow {
  name: string;
  score: number;
  components: Record<string, number | null>;
}

const cache = new Map<string, Promise<unknown>>();

async function get<T>(path: string): Promise<T> {
  if (cache.has(path)) return cache.get(path) as Promise<T>;
  const p = fetch(path)
    .then((r) => {
      if (!r.ok) throw new Error(`API ${r.status}: ${path}`);
      return r.json() as Promise<T>;
    })
    .catch((err) => {
      cache.delete(path); // don't memoise failures
      throw err;
    });
  cache.set(path, p);
  return p;
}

export const api = {
  metrics: () => get<MetricMeta[]>("/api/metrics"),
  categories: () => get<Record<string, MetricMeta[]>>("/api/categories"),
  districtMetrics: () => get<MetricMeta[]>("/api/district-metrics"),
  districtCategories: () => get<Record<string, MetricMeta[]>>("/api/district-categories"),
  geoStates: () => get<string[]>("/api/geo-states"),
  populations: () => get<Record<string, number>>("/api/populations"),
  stateMetric: (key: string) => get<MetricResponse>(`/api/states/${encodeURIComponent(key)}`),
  districts: (state: string, key: string) =>
    get<DistrictValue[]>(`/api/districts/${encodeURIComponent(state)}/${encodeURIComponent(key)}`),
  insights: (key: string) => get<Insight[]>(`/api/insights/${encodeURIComponent(key)}`),
  ageBreakdown: (state: string) => get<AgeBreakdown>(`/api/age-breakdown/${encodeURIComponent(state)}`),
  stateMatrix: (keys: string[]) =>
    get<StateMatrix>(`/api/state-matrix?metrics=${encodeURIComponent(keys.join(","))}`),
  correlations: (keys?: string[]) =>
    get<CorrelationMatrix>(
      `/api/correlations${keys?.length ? `?metrics=${encodeURIComponent(keys.join(","))}` : ""}`,
    ),
  composite: (body: { weights: Record<string, number>; level: "state" | "district"; state_filter?: string }) =>
    fetch("/api/composite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json() as Promise<{ level: string; rows: CompositeRow[] }>),
};
