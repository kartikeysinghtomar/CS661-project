"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type MetricMeta, type MetricResponse, type Insight, type AgeBreakdown } from "@/lib/api";
import { perfColor, normalize } from "@/lib/format";
import { Card, CardHead, Field, Select, Empty, Spinner } from "./ui";
import { Plot, baseLayout } from "./Plot";
import { GeoChoropleth } from "./GeoChoropleth";

export function StateAnalysis() {
  const [categories, setCategories] = useState<Record<string, MetricMeta[]>>({});
  const [category, setCategory] = useState("");
  const [attribute, setAttribute] = useState("");
  const [resp, setResp] = useState<MetricResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [corr, setCorr] = useState<{ labels: string[]; matrix: number[][] } | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [age, setAge] = useState<AgeBreakdown | null>(null);

  useEffect(() => {
    api.categories().then((c) => {
      setCategories(c);
      const firstCat = Object.keys(c)[0] ?? "";
      setCategory(firstCat);
      setAttribute(c[firstCat]?.[0]?.key ?? "");
    });
  }, []);

  const attrOptions = useMemo(
    () => (categories[category] ?? []).map((m) => ({ label: m.label, value: m.key })),
    [categories, category],
  );

  // Fetch the selected metric + insights.
  useEffect(() => {
    if (!attribute) return;
    setLoading(true);
    Promise.all([api.stateMetric(attribute), api.insights(attribute)])
      .then(([r, ins]) => {
        setResp(r);
        setInsights(ins);
      })
      .finally(() => setLoading(false));
  }, [attribute]);

  // Correlation heatmap across the current category's metrics.
  useEffect(() => {
    const keys = (categories[category] ?? []).map((m) => m.key).slice(0, 10);
    if (keys.length < 2) {
      setCorr(null);
      return;
    }
    const labelByKey = new Map((categories[category] ?? []).map((m) => [m.key, m.label]));
    api.correlations(keys).then((c) =>
      setCorr({ labels: c.metrics.map((k) => labelByKey.get(k) ?? k), matrix: c.matrix }),
    );
  }, [categories, category]);

  // Age breakdown of the clicked/selected state.
  useEffect(() => {
    if (!selectedState) {
      setAge(null);
      return;
    }
    api.ageBreakdown(selectedState).then(setAge);
  }, [selectedState]);

  const meta = resp?.metric;
  const values = resp?.values ?? [];
  const nonNull = values.filter((v) => v.value != null) as { state: string; value: number }[];
  const norm = normalize(nonNull.map((v) => v.value));

  const mapValues = values.map((v) => ({ name: v.state, value: v.value }));

  // Rankings bar (all states, ascending so #1 sits on top).
  const rankAsc = [...nonNull].sort((a, b) => a.value - b.value);
  const rankingsData = [
    {
      type: "bar",
      orientation: "h",
      x: rankAsc.map((v) => v.value),
      y: rankAsc.map((v) => v.state),
      marker: { color: rankAsc.map((v) => perfColor(norm(v.value))), line: { color: "white", width: 1 } },
      hovertemplate: "<b>%{y}</b><br>%{x:.1f}%<extra></extra>",
    },
  ];

  // Distribution box plot.
  const boxData = [
    {
      type: "box",
      x: nonNull.map((v) => v.value),
      boxpoints: "all",
      jitter: 0.5,
      pointpos: 0,
      marker: { color: "#6366f1", size: 5, opacity: 0.6 },
      line: { color: "#4338ca" },
      fillcolor: "rgba(99,102,241,0.15)",
      name: "",
      hovertemplate: "%{x:.1f}%<extra></extra>",
    },
  ];

  // Top 7 pie.
  const top7 = [...nonNull].sort((a, b) => b.value - a.value).slice(0, 7);
  const pieData = [
    {
      type: "pie",
      labels: top7.map((v) => v.state),
      values: top7.map((v) => v.value),
      hole: 0.45,
      textinfo: "label+percent",
      textposition: "outside",
      marker: {
        colors: ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#3b82f6"],
        line: { color: "white", width: 2 },
      },
      hovertemplate: "<b>%{label}</b><br>%{value:.1f}%<extra></extra>",
    },
  ];

  const heatData = corr
    ? [
        {
          type: "heatmap",
          z: corr.matrix,
          x: corr.labels,
          y: corr.labels,
          colorscale: [
            [0, "#ef4444"],
            [0.5, "#f8fafc"],
            [1, "#4f46e5"],
          ],
          zmid: 0,
          hovertemplate: "%{y} ↔ %{x}<br>r = %{z:.2f}<extra></extra>",
          colorbar: { thickness: 12, len: 0.85 },
        },
      ]
    : [];

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Controls */}
      <div className="control-panel">
        <div className="flex items-center gap-3 mb-5">
          <span className="chip bg-white/20">🎯</span>
          <h3 className="text-xl font-bold text-white m-0">Analysis Controls</h3>
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="📊 Select Category">
            <Select
              value={category}
              onChange={(c) => {
                setCategory(c);
                setAttribute(categories[c]?.[0]?.key ?? "");
              }}
              options={Object.keys(categories).map((k) => ({ label: k, value: k }))}
            />
          </Field>
          <Field label="📈 Select Attribute">
            <Select value={attribute} onChange={setAttribute} options={attrOptions} placeholder="Choose…" />
          </Field>
        </div>
      </div>

      {loading && !resp ? (
        <Card><Spinner label="Crunching the numbers…" /></Card>
      ) : (
        <>
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHead icon="🗺️" title="India Choropleth Map" grad="grad-3" />
              <p className="text-sm text-slate-400 -mt-2 mb-3">Click a state to see its age breakdown below.</p>
              <GeoChoropleth
                src="/geo/india.topo.json"
                nameProp="name"
                values={mapValues}
                label={meta?.label ?? ""}
                onSelect={setSelectedState}
                selected={selectedState}
              />
            </Card>

            <Card>
              <CardHead icon="🏆" title="State Rankings" grad="grad-2" />
              <Plot
                data={rankingsData}
                height={520}
                layout={{
                  margin: { l: 130, r: 30, t: 10, b: 40 },
                  xaxis: { title: `${meta?.label ?? ""} (%)`, gridcolor: "rgba(203,213,225,0.5)" },
                  yaxis: { automargin: true, tickfont: { size: 10 } },
                }}
              />
            </Card>
          </div>

          {/* Age breakdown */}
          <Card>
            <CardHead icon="📊" title={selectedState ? `Age Breakdown — ${selectedState}` : "Age Breakdown"} grad="grad-5" />
            {age && age.groups.length ? (
              <Plot
                data={[
                  {
                    type: "bar",
                    x: age.groups,
                    y: age.values,
                    marker: { color: ["#667eea", "#764ba2", "#f5576c"], line: { color: "white", width: 1 } },
                    text: age.values.map((v) => `${v.toFixed(1)}%`),
                    textposition: "outside",
                    hovertemplate: "<b>Age %{x}</b><br>%{y:.1f}%<extra></extra>",
                  },
                ]}
                height={340}
                layout={{ yaxis: { title: "% of population", gridcolor: "rgba(203,213,225,0.5)" } }}
              />
            ) : (
              <Empty icon="👆" message="Click a state on the map above to see its age-group distribution." />
            )}
          </Card>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHead icon="📦" title="Distribution Summary" grad="grad-4" />
              <Plot data={boxData} height={360} layout={{ xaxis: { title: "%", gridcolor: "rgba(203,213,225,0.5)" }, margin: { l: 20, r: 20, t: 20, b: 45 } }} />
            </Card>
            <Card>
              <CardHead icon="🥧" title="Top 7 States" grad="grad-5" />
              <Plot data={pieData} height={360} layout={{ showlegend: false, margin: { l: 40, r: 40, t: 30, b: 30 } }} />
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHead icon="💡" title="Key Insights" grad="grad-1" />
              {insights.length ? (
                <div className="space-y-3">
                  {insights.map((ins, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-4 rounded-xl bg-slate-50/70"
                      style={{ border: `1px solid ${ins.color}22` }}
                    >
                      <span className="text-2xl">{ins.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="eyebrow">{ins.title}</div>
                        <div className="font-bold text-lg leading-tight" style={{ color: ins.color }}>
                          {ins.value}
                        </div>
                        <p className="text-sm text-slate-500 m-0">{ins.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty icon="💡" message="Select an attribute to discover key insights." />
              )}
            </Card>

            <Card>
              <CardHead icon="⭐" title="Correlation Heatmap" grad="grad-6" />
              {heatData.length ? (
                <Plot data={heatData} height={420} layout={{ margin: { l: 120, r: 20, t: 20, b: 120 }, xaxis: { tickangle: -40, automargin: true }, yaxis: { automargin: true } }} />
              ) : (
                <Empty icon="⭐" message="This category needs at least two metrics for a correlation view." />
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
