"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type MetricMeta, type MetricResponse, type StateMatrix } from "@/lib/api";
import { relColor, perfColor, normalize, SERIES_COLORS } from "@/lib/format";
import { Card, CardHead, Field, Select, Empty, cn } from "./ui";
import { Plot } from "./Plot";

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const lo = sorted[base] ?? 0;
  const hi = sorted[base + 1];
  return hi !== undefined ? lo + rest * (hi - lo) : lo;
}

export function Comparison() {
  const [categories, setCategories] = useState<Record<string, MetricMeta[]>>({});
  const [allStates, setAllStates] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [attribute, setAttribute] = useState("");
  const [mode, setMode] = useState<"absolute" | "relative">("absolute");
  const [resp, setResp] = useState<MetricResponse | null>(null);
  const [matrix, setMatrix] = useState<StateMatrix | null>(null);
  const [pop, setPop] = useState<Record<string, number>>({});

  useEffect(() => {
    Promise.all([api.categories(), api.stateMetric("Male_Literate_pct"), api.populations()]).then(
      ([cats, r, populations]) => {
        setCategories(cats);
        const firstCat = Object.keys(cats)[0] ?? "";
        setCategory(firstCat);
        setAttribute(cats[firstCat]?.[0]?.key ?? "");
        const names = r.values.map((v) => v.state);
        setAllStates(names);
        setSelected(names.slice(0, 3));
        setPop(populations);
      },
    );
  }, []);

  const attrOptions = useMemo(
    () => (categories[category] ?? []).map((m) => ({ label: m.label, value: m.key })),
    [categories, category],
  );
  const attrLabel = useMemo(
    () => attrOptions.find((o) => o.value === attribute)?.label ?? attribute,
    [attrOptions, attribute],
  );

  useEffect(() => {
    if (attribute) api.stateMetric(attribute).then(setResp);
  }, [attribute]);

  useEffect(() => {
    const keys = (categories[category] ?? []).map((m) => m.key).slice(0, 8);
    if (keys.length >= 3) api.stateMatrix(keys).then(setMatrix);
    else setMatrix(null);
  }, [categories, category]);

  function toggle(name: string) {
    setSelected((cur) =>
      cur.includes(name) ? cur.filter((s) => s !== name) : cur.length < 5 ? [...cur, name] : cur,
    );
  }

  const ready = selected.length >= 2 && !!resp;
  const valueByState = new Map((resp?.values ?? []).map((v) => [v.state, v.value]));
  const nationalAvg = resp?.stats.mean ?? 0;
  const allVals = (resp?.values ?? []).map((v) => v.value).filter((v): v is number => v != null).sort((a, b) => a - b);
  const top10 = allVals.length ? quantile(allVals, 0.9) : 0;

  const picked = selected
    .map((s) => ({ state: s, value: valueByState.get(s) ?? null }))
    .filter((p) => p.value != null) as { state: string; value: number }[];

  // Bar chart (absolute or relative).
  const barValues = picked.map((p) => (mode === "relative" ? ((p.value - nationalAvg) / nationalAvg) * 100 : p.value));
  const barColors =
    mode === "relative"
      ? barValues.map(relColor)
      : (() => {
          const n = normalize(picked.map((p) => p.value));
          return picked.map((p) => perfColor(n(p.value)));
        })();
  const barData = [
    {
      type: "bar",
      orientation: "h",
      y: picked.map((p) => p.state),
      x: barValues,
      marker: { color: barColors, line: { color: "white", width: 2 } },
      text: barValues.map((v) => `${v.toFixed(1)}%`),
      textposition: "outside",
      hovertemplate: "<b>%{y}</b><br>%{x:.1f}%<extra></extra>",
    },
  ];

  // Radar.
  const radarData =
    matrix && selected.length >= 2
      ? selected
          .filter((s) => matrix.values[s])
          .map((s, idx) => {
            const vals = (matrix.values[s] ?? []).map((v) => v ?? 0);
            const labels = matrix.metrics.map((m) => m.label);
            const c = SERIES_COLORS[idx % SERIES_COLORS.length] ?? "#3b82f6";
            return {
              type: "scatterpolar",
              r: [...vals, vals[0] ?? 0],
              theta: [...labels, labels[0] ?? ""],
              fill: "toself",
              name: s,
              line: { color: c, width: 2 },
              fillcolor: hexToRgba(c, 0.12),
            };
          })
      : [];

  // Development pathway.
  const pathwayPts = picked.map((p) => {
    const potential = p.value < top10 ? Math.min(top10, p.value + (top10 - p.value) * 0.7) : p.value * 1.05;
    return { state: p.state, current: p.value, potential, gap: potential - p.value };
  });
  const pathwayData = [
    {
      type: "scatter",
      mode: "markers+text",
      x: pathwayPts.map((p) => p.current),
      y: pathwayPts.map((p) => p.potential),
      text: pathwayPts.map((p) => p.state),
      textposition: "top center",
      textfont: { size: 10 },
      marker: {
        size: pathwayPts.map((p) => Math.min(Math.max((pop[p.state] ?? 0) / 1_000_000 + 12, 16), 42)),
        color: pathwayPts.map((p) => perfColor(normalize(picked.map((x) => x.value))(p.current))),
        line: { color: "white", width: 2 },
        opacity: 0.8,
      },
      hovertemplate: "<b>%{text}</b><br>Current: %{x:.1f}%<br>Potential: %{y:.1f}%<extra></extra>",
    },
    ...(pathwayPts.length
      ? [
          {
            type: "scatter",
            mode: "lines",
            x: [Math.min(...pathwayPts.map((p) => p.current)), Math.max(...pathwayPts.map((p) => p.potential))],
            y: [Math.min(...pathwayPts.map((p) => p.current)), Math.max(...pathwayPts.map((p) => p.potential))],
            line: { dash: "dash", color: "#94a3b8", width: 2 },
            hoverinfo: "skip",
            showlegend: false,
          },
        ]
      : []),
  ];

  // Recommendations.
  const recs = (() => {
    if (!ready || !picked.length) return [];
    const sorted = [...picked].sort((a, b) => b.value - a.value);
    const leader = sorted[0];
    const laggard = sorted[sorted.length - 1];
    if (!leader || !laggard) return [];
    const out: { icon: string; text: string; color: string }[] = [];
    out.push({ icon: "🏆", text: `${leader.state} leads the group at ${leader.value.toFixed(1)}% for ${attrLabel}.`, color: "#10b981" });
    out.push({
      icon: "🎯",
      text: `${laggard.state} trails at ${laggard.value.toFixed(1)}% — a ${(leader.value - laggard.value).toFixed(1)}% gap to the leader.`,
      color: "#ef4444",
    });
    const above = picked.filter((p) => p.value > nationalAvg);
    out.push({
      icon: "🇮🇳",
      text: `${above.length} of ${picked.length} selected states are above the national average (${nationalAvg.toFixed(1)}%).`,
      color: "#3b82f6",
    });
    const bestImprover = [...pathwayPts].sort((a, b) => b.gap - a.gap)[0];
    if (bestImprover)
      out.push({ icon: "🚀", text: `${bestImprover.state} has the most headroom — up to +${bestImprover.gap.toFixed(1)}% toward top-decile performance.`, color: "#f59e0b" });
    return out;
  })();

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="control-panel">
        <div className="flex items-center gap-3 mb-2">
          <span className="chip bg-white/20">⚖️</span>
          <h3 className="text-xl font-bold text-white m-0">State Comparison Analysis</h3>
        </div>
        <p className="text-white/80 text-sm">Compare 2–5 states across demographic indicators.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHead icon="🎛️" title="Comparison Controls" grad="grad-3" />
          <div className="space-y-4">
            <div>
              <span className="text-sm font-semibold text-slate-600 mb-2 block">🗺️ Select States (2–5)</span>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto scroll-thin p-1">
                {allStates.map((s) => {
                  const on = selected.includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() => toggle(s)}
                      className={cn(
                        "pill border transition-all",
                        on ? "bg-brand-600 text-white border-brand-600" : "bg-white text-slate-600 border-slate-200 hover:border-brand-400",
                      )}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="📊 Category">
                <Select
                  value={category}
                  onChange={(c) => {
                    setCategory(c);
                    setAttribute(categories[c]?.[0]?.key ?? "");
                  }}
                  options={Object.keys(categories).map((k) => ({ label: k, value: k }))}
                />
              </Field>
              <Field label="📈 Attribute">
                <Select value={attribute} onChange={setAttribute} options={attrOptions} />
              </Field>
            </div>
            <div>
              <span className="text-sm font-semibold text-slate-600 mb-2 block">⚖️ Comparison Type</span>
              <div className="flex gap-2">
                {(["absolute", "relative"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={cn(
                      "flex-1 rounded-lg px-3 py-2 text-sm font-semibold border transition-all",
                      mode === m ? "bg-brand-600 text-white border-brand-600" : "bg-white text-slate-600 border-slate-200 hover:border-brand-400",
                    )}
                  >
                    {m === "absolute" ? "Absolute Values" : "vs National Avg"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHead icon="📊" title="State Comparison Chart" grad="grad-4" />
          {ready ? (
            <Plot
              data={barData}
              height={400}
              layout={{
                margin: { l: 120, r: 50, t: 10, b: 45 },
                xaxis: {
                  title: mode === "relative" ? `% diff from national avg (${nationalAvg.toFixed(1)}%)` : `${attrLabel} (%)`,
                  gridcolor: "rgba(203,213,225,0.5)",
                  zeroline: true,
                  zerolinecolor: "rgba(107,114,128,0.5)",
                },
                yaxis: { automargin: true },
              }}
            />
          ) : (
            <Empty icon="📊" message="Select at least 2 states and an attribute." />
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHead icon="🕸️" title="Multi-Dimensional Radar" grad="grad-5" />
          {radarData.length ? (
            <Plot
              data={radarData}
              height={420}
              layout={{
                polar: { bgcolor: "rgba(255,255,255,0.9)", radialaxis: { visible: true, gridcolor: "rgba(203,213,225,0.5)" }, angularaxis: { tickfont: { size: 10 } } },
                legend: { orientation: "h", y: -0.12, x: 0.5, xanchor: "center" },
                margin: { l: 60, r: 60, t: 30, b: 60 },
              }}
            />
          ) : (
            <Empty icon="🕸️" message="Choose 2+ states and a category with 3+ metrics." />
          )}
        </Card>

        <Card>
          <CardHead icon="📈" title="Development Pathway Analysis" grad="grad-6" />
          {ready && pathwayPts.length ? (
            <Plot
              data={pathwayData}
              height={420}
              layout={{
                xaxis: { title: `Current ${attrLabel} (%)`, gridcolor: "rgba(203,213,225,0.5)" },
                yaxis: { title: "Development potential (%)", gridcolor: "rgba(203,213,225,0.5)" },
                showlegend: false,
                margin: { l: 60, r: 20, t: 20, b: 55 },
              }}
            />
          ) : (
            <Empty icon="📈" message="Select at least 2 states and an attribute." />
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHead icon="📋" title="Comparison Data Table" grad="grad-1" />
          {ready ? (
            <div className="rounded-xl border border-slate-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-2.5">State</th>
                    <th className="text-right px-4 py-2.5">{attrLabel}</th>
                    <th className="text-right px-4 py-2.5">vs Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {[...picked].sort((a, b) => b.value - a.value).map((p) => {
                    const diff = p.value - nationalAvg;
                    return (
                      <tr key={p.state} className="border-t border-slate-100">
                        <td className="px-4 py-2.5 font-medium text-slate-700">{p.state}</td>
                        <td className="px-4 py-2.5 text-right num font-semibold text-slate-900">{p.value.toFixed(1)}%</td>
                        <td className="px-4 py-2.5 text-right num font-semibold" style={{ color: diff >= 0 ? "#10b981" : "#ef4444" }}>
                          {diff >= 0 ? "+" : ""}
                          {diff.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon="📋" message="Select states to populate the table." />
          )}
        </Card>

        <Card>
          <CardHead icon="💡" title="Insights & Recommendations" grad="grad-3" />
          {recs.length ? (
            <div className="space-y-3">
              {recs.map((r, i) => (
                <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-slate-50/70" style={{ border: `1px solid ${r.color}22` }}>
                  <span className="text-xl">{r.icon}</span>
                  <p className="text-sm text-slate-600 m-0 leading-relaxed">{r.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <Empty icon="💡" message="Select states and an attribute for tailored recommendations." />
          )}
        </Card>
      </div>
    </div>
  );
}
