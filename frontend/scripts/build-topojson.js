#!/usr/bin/env node
/**
 * GeoJSON → TopoJSON conversion + simplification pipeline.
 *
 * Why this exists:
 *   The original project ships raw GeoJSON files (the Maharashtra one alone is
 *   several MB). Browsers parse and render this on every page load. TopoJSON
 *   delta-encodes shared arcs and, combined with mapshaper's simplification,
 *   typically cuts payload by 70–90% with no perceptible quality loss at
 *   dashboard zoom levels.
 *
 * Usage:
 *   node scripts/build-topojson.js
 *
 * Requires:
 *   npm install -g mapshaper
 */

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const SRC_DIR = path.join(__dirname, "..", "..", "backend", "data", "geojson");
const OUT_DIR = path.join(__dirname, "..", "public", "geo");
const SIMPLIFY_PERCENT = 15; // keep 15% of vertices — visually identical at dashboard zoom

fs.mkdirSync(OUT_DIR, { recursive: true });

const files = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith(".geojson") || f.endsWith(".json"));

console.log(`Converting ${files.length} GeoJSON files…`);
let totalBefore = 0;
let totalAfter = 0;

for (const f of files) {
  const src = path.join(SRC_DIR, f);
  const dst = path.join(OUT_DIR, f.replace(/\.(geojson\.json|geojson|json)$/, ".topo.json"));
  const sizeBefore = fs.statSync(src).size;
  totalBefore += sizeBefore;

  // mapshaper: simplify with Visvalingam weighted area, then export as topojson with quantization
  execSync(
    `npx mapshaper "${src}" -simplify ${SIMPLIFY_PERCENT}% weighted -o "${dst}" format=topojson quantization=1e5`,
    { stdio: "inherit" }
  );

  const sizeAfter = fs.statSync(dst).size;
  totalAfter += sizeAfter;
  const pct = (100 - (sizeAfter / sizeBefore) * 100).toFixed(1);
  console.log(`  ${f}: ${(sizeBefore / 1024).toFixed(1)}KB → ${(sizeAfter / 1024).toFixed(1)}KB (-${pct}%)`);
}

const overallPct = (100 - (totalAfter / totalBefore) * 100).toFixed(1);
console.log(`\nTotal: ${(totalBefore / 1024).toFixed(1)}KB → ${(totalAfter / 1024).toFixed(1)}KB (-${overallPct}%)`);
