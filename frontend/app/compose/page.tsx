"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, type MetricMeta, type CompositeRow } from "@/lib/api";
import { Card, CardHead, cn } from "@/components/ui";

export default function ComposePage() {
  const [categories, setCategories] = useState<Record<string, MetricMeta[]>>({});
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [rows, setRows] = useState<CompositeRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.categories().then((c) => {
      setCategories(c);
      // Seed with a couple of sensible default metrics.
      const first = Object.values(c)[0]?.[0]?.key;
      if (first) setWeights({ [first]: 1 });
    });
  }, []);

  const active = useMemo(() => Object.entries(weights).filter(([, w]) => w > 0), [weights]);

  useEffect(() => {
    if (!active.length) {
      setRows([]);
      return;
    }
    setLoading(true);
    api
      .composite({ weights: Object.fromEntries(active), level: "state" })
      .then((r) => setRows(r.rows.slice(0, 15)))
      .finally(() => setLoading(false));
  }, [active]);

  const labelFor = useMemo(() => {
    const m = new Map<string, string>();
    Object.values(categories).flat().forEach((x) => m.set(x.key, x.label));
    return (k: string) => m.get(k) ?? k;
  }, [categories]);

  const maxScore = rows[0]?.score ?? 100;

  return (
    <main className="min-h-screen pb-10">
      <header className="bg-grad-6 text-white">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Link href="/atlas" className="text-white/70 text-sm hover:text-white transition-colors">
            ← Explorer
          </Link>
          <h1 className="text-3xl sm:text-4xl font-extrabold mt-1">⚙️ Composite Index Builder</h1>
          <p className="text-white/80 mt-1 max-w-2xl">
            Pick the metrics that matter to you, weight them, and watch a custom 0–100 state ranking emerge.
            Scores are min–max normalised and weighted server-side.
          </p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid lg:grid-cols-[1fr_1.1fr] gap-6">
        {/* Metric picker + weights */}
        <Card hover={false}>
          <CardHead icon="🎚️" title="Metrics & Weights" grad="grad-1" />
          <div className="space-y-5 max-h-[70vh] overflow-y-auto scroll-thin pr-1">
            {Object.entries(categories).map(([cat, metrics]) => (
              <div key={cat}>
                <div className="eyebrow mb-2">{cat}</div>
                <div className="space-y-2">
                  {metrics.map((m) => {
                    const w = weights[m.key] ?? 0;
                    return (
                      <div key={m.key} className={cn("rounded-lg p-2 transition-colors", w > 0 && "bg-brand-50")}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-slate-700">{m.label}</span>
                          <span className="num text-xs text-slate-400 w-8 text-right">{w.toFixed(1)}</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.1}
                          value={w}
                          onChange={(e) => setWeights((cur) => ({ ...cur, [m.key]: Number(e.target.value) }))}
                          className="w-full accent-brand-600"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Live ranking */}
        <Card hover={false}>
          <CardHead icon="🏅" title="Your Custom Ranking" grad="grad-4" right={loading ? <span className="text-xs text-slate-400">updating…</span> : undefined} />
          {rows.length ? (
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={r.name} className="flex items-center gap-3">
                  <span className="num text-slate-400 w-6 text-right">{i + 1}</span>
                  <span className="w-36 shrink-0 text-sm font-medium text-slate-700 truncate">{r.name}</span>
                  <div className="flex-1 h-6 rounded-md bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-grad-6 rounded-md flex items-center justify-end pr-2"
                      style={{ width: `${Math.max((r.score / maxScore) * 100, 8)}%` }}
                    >
                      <span className="num text-xs font-semibold text-white">{r.score.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              ))}
              <p className="text-xs text-slate-400 pt-3">
                Weighted from: {active.map(([k]) => labelFor(k)).join(", ") || "—"}
              </p>
            </div>
          ) : (
            <p className="text-slate-400 py-10 text-center">Move a slider above zero to build your index.</p>
          )}
        </Card>
      </div>
    </main>
  );
}
