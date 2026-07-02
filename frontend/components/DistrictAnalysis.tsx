"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type MetricMeta, type DistrictValue } from "@/lib/api";
import { perfColor, normalize } from "@/lib/format";
import { Card, CardHead, Field, Select, Empty, Spinner } from "./ui";
import { Plot } from "./Plot";
import { GeoChoropleth, STATE_TOPO } from "./GeoChoropleth";

export function DistrictAnalysis() {
  const [states, setStates] = useState<string[]>([]);
  const [categories, setCategories] = useState<Record<string, MetricMeta[]>>({});
  const [state, setState] = useState("");
  const [category, setCategory] = useState("");
  const [attribute, setAttribute] = useState("");
  const [xMetric, setXMetric] = useState("");
  const [rows, setRows] = useState<DistrictValue[]>([]);
  const [xRows, setXRows] = useState<DistrictValue[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(20);

  useEffect(() => {
    Promise.all([api.geoStates(), api.districtCategories()]).then(([s, cats]) => {
      setStates(s);
      setCategories(cats);
      const firstCat = Object.keys(cats)[0] ?? "";
      setCategory(firstCat);
      setAttribute(cats[firstCat]?.[0]?.key ?? "");
      setXMetric(cats[firstCat]?.[1]?.key ?? cats[firstCat]?.[0]?.key ?? "");
      setState(s.find((x) => STATE_TOPO[x]) ?? s[0] ?? "");
    });
  }, []);

  const attrOptions = useMemo(
    () => (categories[category] ?? []).map((m) => ({ label: m.label, value: m.key })),
    [categories, category],
  );
  const allMetricOptions = useMemo(
    () => Object.values(categories).flat().map((m) => ({ label: m.label, value: m.key })),
    [categories],
  );
  const labelFor = useMemo(() => {
    const m = new Map<string, string>();
    Object.values(categories).flat().forEach((x) => m.set(x.key, x.label));
    return (k: string) => m.get(k) ?? k;
  }, [categories]);

  useEffect(() => {
    if (!state || !attribute) return;
    setLoading(true);
    api
      .districts(state, attribute)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [state, attribute]);

  useEffect(() => {
    if (!state || !xMetric) return;
    api.districts(state, xMetric).then(setXRows).catch(() => setXRows([]));
  }, [state, xMetric]);

  const nonNull = rows.filter((r) => r.value != null) as { district: string; value: number }[];
  const norm = normalize(nonNull.map((r) => r.value));
  const hasMap = !!STATE_TOPO[state];

  const rankAsc = [...nonNull].sort((a, b) => a.value - b.value);
  const rankingsData = [
    {
      type: "bar",
      orientation: "h",
      x: rankAsc.map((r) => r.value),
      y: rankAsc.map((r) => r.district),
      marker: { color: rankAsc.map((r) => perfColor(norm(r.value))), line: { color: "white", width: 1 } },
      hovertemplate: "<b>%{y}</b><br>%{x:.1f}%<extra></extra>",
    },
  ];

  // Performance matrix: join x + y by district.
  const xByDistrict = new Map(xRows.filter((r) => r.value != null).map((r) => [r.district, r.value as number]));
  const scatterPts = nonNull
    .filter((r) => xByDistrict.has(r.district))
    .map((r) => ({ district: r.district, x: xByDistrict.get(r.district)!, y: r.value }));
  const scatterData = [
    {
      type: "scatter",
      mode: "markers",
      x: scatterPts.map((p) => p.x),
      y: scatterPts.map((p) => p.y),
      text: scatterPts.map((p) => p.district),
      marker: { size: 11, color: scatterPts.map((p) => norm(p.y)), colorscale: "Viridis", line: { color: "white", width: 1 }, opacity: 0.85 },
      hovertemplate: "<b>%{text}</b><br>" + labelFor(xMetric) + ": %{x:.1f}%<br>" + labelFor(attribute) + ": %{y:.1f}%<extra></extra>",
    },
  ];

  // Table
  const tableRows = [...nonNull]
    .sort((a, b) => b.value - a.value)
    .map((r, i) => ({ ...r, rank: i + 1 }))
    .filter((r) => r.district.toLowerCase().includes(search.toLowerCase()))
    .slice(0, limit);

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="control-panel">
        <div className="flex items-center gap-3 mb-5">
          <span className="chip bg-white/20">🏘️</span>
          <h3 className="text-xl font-bold text-white m-0">District Analysis Controls</h3>
        </div>
        <div className="grid sm:grid-cols-3 gap-5">
          <Field label="🗺️ Select State">
            <Select value={state} onChange={setState} options={states.map((s) => ({ label: s, value: s }))} placeholder="Choose a state…" />
          </Field>
          <Field label="📚 Category">
            <Select
              value={category}
              onChange={(c) => {
                setCategory(c);
                setAttribute(categories[c]?.[0]?.key ?? "");
              }}
              options={Object.keys(categories).map((k) => ({ label: k, value: k }))}
            />
          </Field>
          <Field label="📊 District Attribute">
            <Select value={attribute} onChange={setAttribute} options={attrOptions} placeholder="Choose…" />
          </Field>
        </div>
      </div>

      {loading && !rows.length ? (
        <Card><Spinner label="Loading districts…" /></Card>
      ) : (
        <>
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHead icon="🗺️" title={`District Map — ${state}`} grad="grad-3" />
              {hasMap ? (
                <GeoChoropleth
                  src={`/geo/${STATE_TOPO[state]}.topo.json`}
                  nameProp="district"
                  values={rows.map((r) => ({ name: r.district, value: r.value }))}
                  label={labelFor(attribute)}
                />
              ) : (
                <Empty icon="🗺️" message={`No district geometry available for ${state}. Rankings, matrix and table below still work.`} />
              )}
            </Card>
            <Card>
              <CardHead icon="🏆" title="District Rankings" grad="grad-2" />
              {nonNull.length ? (
                <Plot data={rankingsData} height={520} layout={{ margin: { l: 150, r: 30, t: 10, b: 40 }, xaxis: { title: "%", gridcolor: "rgba(203,213,225,0.5)" }, yaxis: { automargin: true, tickfont: { size: 10 } } }} />
              ) : (
                <Empty message="No data for this selection." />
              )}
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHead
                icon="📊"
                title="Performance Matrix"
                grad="grad-4"
                right={
                  <div className="w-48">
                    <Select value={xMetric} onChange={setXMetric} options={allMetricOptions} />
                  </div>
                }
              />
              {scatterPts.length ? (
                <Plot
                  data={scatterData}
                  height={420}
                  layout={{
                    xaxis: { title: labelFor(xMetric) + " (%)", gridcolor: "rgba(203,213,225,0.5)" },
                    yaxis: { title: labelFor(attribute) + " (%)", gridcolor: "rgba(203,213,225,0.5)" },
                    margin: { l: 60, r: 20, t: 20, b: 55 },
                  }}
                />
              ) : (
                <Empty message="Pick an X metric to plot the district performance matrix." />
              )}
            </Card>

            <Card>
              <CardHead icon="📋" title="District Summary Table" grad="grad-6" />
              <div className="flex items-end gap-3 mb-4">
                <div className="flex-1">
                  <label className="text-sm font-semibold text-slate-600 mb-1 block">🔍 Search Districts</label>
                  <input className="text-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type a district name…" />
                </div>
                <div className="w-36">
                  <label className="text-sm font-semibold text-slate-600 mb-1 block">Show</label>
                  <Select
                    value={String(limit)}
                    onChange={(v) => setLimit(Number(v))}
                    options={[
                      { label: "Top 10", value: "10" },
                      { label: "Top 20", value: "20" },
                      { label: "Top 50", value: "50" },
                      { label: "All", value: "999" },
                    ]}
                  />
                </div>
              </div>
              <div className="max-h-[420px] overflow-y-auto scroll-thin rounded-xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-2.5">#</th>
                      <th className="text-left px-4 py-2.5">District</th>
                      <th className="text-right px-4 py-2.5">{labelFor(attribute)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((r) => (
                      <tr key={r.district} className="border-t border-slate-100 hover:bg-brand-50/60 transition-colors">
                        <td className="px-4 py-2.5 num text-slate-400">{r.rank}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-700">{r.district}</td>
                        <td className="px-4 py-2.5 text-right num font-semibold text-slate-900">{r.value.toFixed(1)}%</td>
                      </tr>
                    ))}
                    {!tableRows.length && (
                      <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">No districts match.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
