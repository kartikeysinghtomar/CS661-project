"use client";

import { useEffect, useRef } from "react";

// plotly.js-dist-min has no bundled types; we only need a couple of methods.
type PlotlyModule = {
  react: (el: HTMLElement, data: unknown[], layout: unknown, config: unknown) => void;
  purge: (el: HTMLElement) => void;
  Plots: { resize: (el: HTMLElement) => void };
};

let plotlyPromise: Promise<PlotlyModule> | null = null;
function loadPlotly(): Promise<PlotlyModule> {
  if (!plotlyPromise) {
    plotlyPromise = import("plotly.js-dist-min").then((m) => (m.default ?? m) as unknown as PlotlyModule);
  }
  return plotlyPromise;
}

export const FONT_FAMILY = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

/** Shared base layout so every chart matches the design system. */
export function baseLayout(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(248,250,252,0.6)",
    font: { family: FONT_FAMILY, color: "#475569", size: 12 },
    margin: { l: 50, r: 24, t: 20, b: 40 },
    hoverlabel: {
      bgcolor: "white",
      bordercolor: "rgba(0,0,0,0.08)",
      font: { color: "#111827", size: 12, family: FONT_FAMILY },
    },
    ...overrides,
  };
}

interface Props {
  data: unknown[];
  layout?: Record<string, unknown>;
  height?: number;
  className?: string;
}

export function Plot({ data, layout = {}, height = 400, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const el = ref.current;
    if (!el) return;
    loadPlotly().then((Plotly) => {
      if (!alive || !ref.current) return;
      Plotly.react(ref.current, data, { autosize: true, height, ...baseLayout(layout) }, {
        displayModeBar: false,
        responsive: true,
      });
    });
    return () => {
      alive = false;
    };
  }, [data, layout, height]);

  useEffect(() => {
    const el = ref.current;
    function onResize() {
      if (el) loadPlotly().then((P) => P.Plots.resize(el));
    }
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (el) loadPlotly().then((P) => P.purge(el));
    };
  }, []);

  return <div ref={ref} className={className} style={{ width: "100%", height }} />;
}
