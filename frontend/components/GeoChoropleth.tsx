"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import { geoMercator, geoPath } from "d3-geo";
import { scaleQuantile } from "d3-scale";
import { Spinner, Empty } from "./ui";

// Sequential YlOrRd ramp — the classic choropleth palette used in the reference.
const RAMP = ["#ffffcc", "#fed976", "#feb24c", "#fd8d3c", "#f03b20", "#bd0026"] as const;

// The India TopoJSON labels a few regions differently from the census CSV.
// Map (lowercased) geometry name -> (lowercased) data name so they colour in.
const NAME_ALIAS: Record<string, string> = {
  uttaranchal: "uttarakhand",
  delhi: "nct of delhi",
  puducherry: "pondicherry",
  "andaman and nicobar": "andaman and nicobar islands",
  orissa: "odisha",
};

export interface GeoValue {
  name: string;
  value: number | null;
}

interface Props {
  /** URL of a TopoJSON file under /public. */
  src: string;
  /** Property on each geometry holding the region name. */
  nameProp: string;
  values: GeoValue[];
  label: string;
  onSelect?: (name: string) => void;
  selected?: string | null;
  height?: number;
}

export function GeoChoropleth({ src, nameProp, values, label, onSelect, selected, height = 480 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [topo, setTopo] = useState<any>(null);
  const [failed, setFailed] = useState(false);
  const [hovered, setHovered] = useState<{ name: string; value: number | null; x: number; y: number } | null>(null);

  useEffect(() => {
    setTopo(null);
    setFailed(false);
    let alive = true;
    fetch(src)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => alive && setTopo(j))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [src]);

  const valuesByName = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const v of values) m.set(v.name.toLowerCase(), v.value);
    return m;
  }, [values]);

  const geo = useMemo(() => {
    if (!topo) return null;
    const objectKey = Object.keys(topo.objects)[0]!;
    const fc = feature(topo, topo.objects[objectKey]) as unknown as GeoJSON.FeatureCollection;
    const nums = values.map((v) => v.value).filter((v): v is number => v != null);
    const scale = scaleQuantile<string>().domain(nums).range([...RAMP]);
    const projection = geoMercator().fitSize([760, height], fc);
    const path = geoPath(projection);
    const domain: [number, number] = nums.length ? [Math.min(...nums), Math.max(...nums)] : [0, 0];
    return { features: fc.features, scale, path, domain };
  }, [topo, values, height]);

  if (failed) return <Empty icon="🗺️" message="Map geometry unavailable for this region — charts below still work." />;
  if (!topo || !geo) return <Spinner label="Loading map…" />;

  return (
    <div className="relative" ref={ref}>
      <svg viewBox={`0 0 760 ${height}`} className="w-full h-auto" role="img" aria-label={`Map of ${label}`}>
        {geo.features.map((f, i) => {
          const raw = String(f.properties?.[nameProp] ?? "");
          const key = raw.toLowerCase();
          const value = valuesByName.get(key) ?? valuesByName.get(NAME_ALIAS[key] ?? "") ?? null;
          const fill = value != null ? geo.scale(value) : "#e5e7eb";
          const isSel = selected && raw.toLowerCase() === selected.toLowerCase();
          return (
            <path
              key={i}
              d={geo.path(f) ?? ""}
              fill={fill}
              stroke={isSel ? "#1e293b" : "#ffffff"}
              strokeWidth={isSel ? 2 : 0.6}
              style={{ cursor: onSelect ? "pointer" : "default", transition: "fill 0.4s ease, opacity 0.3s ease" }}
              opacity={selected && !isSel ? 0.45 : 1}
              onMouseMove={(e) => {
                const rect = ref.current?.getBoundingClientRect();
                setHovered({ name: raw, value, x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) });
              }}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelect?.(raw)}
            />
          );
        })}
      </svg>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <span className="num">{geo.domain[0].toFixed(1)}%</span>
        <div className="flex-1 h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${RAMP.join(",")})` }} />
        <span className="num">{geo.domain[1].toFixed(1)}%</span>
      </div>

      {hovered && (
        <div
          className="pointer-events-none absolute z-10 px-3 py-2 rounded-lg bg-slate-900/95 text-white text-sm shadow-xl"
          style={{ left: hovered.x + 14, top: hovered.y + 14 }}
        >
          <div className="font-semibold leading-tight">{hovered.name}</div>
          <div className="num text-amber-300 mt-0.5">
            {hovered.value != null ? `${hovered.value.toFixed(1)}%` : "No data"}
          </div>
        </div>
      )}
    </div>
  );
}

/** Map CSV/state names to the per-state topojson filename under /geo. */
export const STATE_TOPO: Record<string, string> = {
  "Andhra Pradesh": "andhra_pradesh",
  "Arunachal Pradesh": "arunachal_pradesh",
  Assam: "assam",
  Bihar: "bihar",
  Chhattisgarh: "chhattisgarh",
  Goa: "goa",
  Gujarat: "gujarat",
  Haryana: "haryana",
  "Himachal Pradesh": "himachal-pradesh",
  "Jammu And Kashmir": "jammu-and-kashmir",
  Karnataka: "karnataka",
  Kerala: "kerala",
  "Madhya Pradesh": "madhya_pradesh",
  Maharashtra: "maharashtra",
  Manipur: "manipur",
  Meghalaya: "meghalaya",
  Mizoram: "mizoram",
  Nagaland: "nagaland",
  Orissa: "odisha",
  Odisha: "odisha",
  Punjab: "punjab",
  Rajasthan: "rajasthan",
  Sikkim: "sikkim",
  "Tamil Nadu": "tamil_nadu",
  Telangana: "telangana",
  Tripura: "tripura",
  "Uttar Pradesh": "uttar_pradesh",
  Uttarakhand: "uttarakhand",
  "West Bengal": "west_bengal",
};
