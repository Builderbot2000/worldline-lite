// Worldline Lite — geography generator orchestrator.
// Lever → data: reads a genesis.json seed lever and produces the generated
// geometry.json (+ an optional catalog map.json) as DATA in the run's store.
// The renderer then renders that data directly; nothing is invented at draw time.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { growRegions } from "./voronoi.mjs";
import { computeGeometry, hashStr } from "./refine.mjs";
import { deriveRivers } from "./rivers.mjs";
import { placeFeatures } from "./features.mjs";

const round2 = (p) => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100];

// ---- deterministic category color contract ---------------------------------
// A string → muted distinct hue, with NO knowledge of any vocabulary. The
// generator bakes these into the catalog (so colors live in the store next to
// the values they describe); the renderer mirrors this exact function as its
// fallback for any category it wasn't handed a color for. The two MUST stay in
// sync — see renderer/app.js `categoryColor`.
function hslHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r, g, b] =
    hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] :
    hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = l - c / 2;
  const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return "#" + to(r) + to(g) + to(b);
}
export function categoryColor(s) {
  const h = hashStr(String(s));
  return hslHex(h % 360, 0.24, 0.38 + ((h >>> 9) % 10) / 100);  // hue spread; muted S, L 0.38–0.47
}

// ---- validation (pure, no fs) ----------------------------------------------
export function validateGenesis(g) {
  const errors = [], warnings = [];
  if (!g || typeof g !== "object") return { ok: false, errors: ["genesis is not an object"], warnings };
  if (g.schema !== "worldline-geo-seed/v1") warnings.push(`unexpected schema "${g.schema}"`);
  if (!g.space || !Array.isArray(g.space.extent) || g.space.extent.length !== 4)
    errors.push("space.extent must be [x0,y0,w,h]");
  const [x0, y0, w, h] = (g.space && g.space.extent) || [0, 0, 100, 100];
  const ids = new Set();
  for (const r of g.regions || []) {
    if (!r.id) errors.push("a region is missing id");
    if (ids.has(r.id)) errors.push(`duplicate region id "${r.id}"`);
    ids.add(r.id);
    if (!Array.isArray(r.seed) || r.seed.length !== 2) errors.push(`region "${r.id}" needs seed [x,y]`);
    else if (r.seed[0] < x0 || r.seed[0] > x0 + w || r.seed[1] < y0 || r.seed[1] > y0 + h)
      warnings.push(`region "${r.id}" seed is outside extent`);
  }
  if (!(g.regions || []).length) errors.push("no regions");
  // adjacency symmetry (declared)
  for (const r of g.regions || [])
    for (const n of r.adjacent || []) {
      if (!ids.has(n)) { errors.push(`region "${r.id}" adjacent to unknown "${n}"`); continue; }
      const other = g.regions.find((x) => x.id === n);
      if (!(other.adjacent || []).includes(r.id))
        warnings.push(`adjacency not symmetric: "${r.id}"→"${n}" but not back`);
    }
  return { ok: errors.length === 0, errors, warnings };
}

// ---- build artifacts (pure: genesis object → { geometry, map, summary }) ----
export function buildArtifacts(genesis, rawString) {
  const grown = growRegions(genesis);
  const detail = genesis.space.detail;
  const geo = computeGeometry(grown.parts, detail);

  const labelAt = {};
  for (const r of genesis.regions)
    labelAt[r.id] = r.label_at || grown.centroids[r.id];

  const rivers = deriveRivers(genesis.rivers, {
    extent: genesis.space.extent, centroids: grown.centroids, detail,
  });
  const features = placeFeatures(genesis.features, geo, grown.centroids);

  const input_hash = "fnv1a:" + hashStr(rawString != null ? rawString : JSON.stringify(genesis))
    .toString(16).padStart(8, "0");

  const geometry = {
    schema: "worldline-geo/v1",
    generated_from: "genesis.json",
    input_hash,
    name: genesis.name,
    space: genesis.space,
    sea: geo.sea ? geo.sea.map(round2) : null,
    regions: genesis.regions
      .filter((r) => geo.regions[r.id])
      .map((r) => ({ id: r.id, polygon: geo.regions[r.id].map(round2), label_at: labelAt[r.id] })),
    boundaries: geo.boundaries.map((e) => ({
      key: e.key, cls: e.cls, parts: e.parts, path: e.path.map(round2),
    })),
    rivers,
    features,
  };

  // adjacency report: declared vs realized (land-to-land only; sea contact is expected)
  const realized = new Set(
    grown.adjacency
      .filter((p) => !p.includes("__sea__"))
      .map((p) => p.slice().sort().join(" ")));
  const declared = new Set();
  for (const r of genesis.regions)
    for (const n of r.adjacent || []) declared.add([r.id, n].sort().join(" "));
  const missing = [...declared].filter((p) => !realized.has(p));   // declared but not grown
  const extra = [...realized].filter((p) => !declared.has(p));     // grown but not declared

  const map = buildCatalog(genesis);

  const edges = { coast: 0, border: 0, frame: 0 };
  for (const e of geo.boundaries) edges[e.cls]++;

  const summary = {
    regions: geometry.regions.length,
    edges, rivers: rivers.length, features: features.length,
    input_hash, deterministic: true,
    adjacency: { declared: declared.size, realized: realized.size, missing, extra },
    warnings: grown.warnings,
  };
  return { geometry, map, summary };
}

// Catalog map.json the renderer/layers bind against (no dense polygons).
function buildCatalog(genesis) {
  const [, , w, h] = genesis.space.extent;
  return {
    schema: "worldline-map/v1",
    name: genesis.name,
    style: genesis.style,
    viewBox: genesis.space.extent,
    geometry: "geometry.json",
    space: genesis.space,
    regions: genesis.regions.map((r) => ({
      id: r.id, name: r.name, terrain: r.terrain,
      adjacent: r.adjacent || [], label_at: r.label_at,
    })),
    layers: (genesis.layers || DEFAULT_LAYERS).map((l) => bakeLayerColors(l, genesis.regions)),
  };
}

// Bake deterministic per-category colors into choropleths over an open,
// store-owned vocabulary (`map.regions[].<field>`, e.g. terrain), so the colors
// live in the data store beside the values and the renderer needs zero
// knowledge of the vocabulary. Closed renderer-owned enums (palette "stance",
// state-sourced overlays) are left untouched.
function bakeLayerColors(layer, regions) {
  const m = layer.type === "choropleth" && /^map\.regions\[\]\.(.+)$/.exec(layer.source || "");
  if (!m) return layer;
  const cats = [...new Set(regions.map((r) => r[m[1]]).filter((v) => v != null))];
  const colors = {};
  for (const c of cats) colors[c] = categoryColor(c);
  const { palette, ...rest } = layer;   // drop the renderer-owned palette ref
  return { ...rest, colors };
}

const DEFAULT_LAYERS = [
  { id: "graticule", name: "Grid",      type: "graticule", on: true },
  { id: "terrain",   name: "Geography", type: "choropleth", source: "map.regions[].terrain", default: true },  // colors baked from the vocabulary at build time
  { id: "ownership", name: "Political", type: "choropleth", source: "state.map_overlay.ownership", palette: "stance" },
  { id: "unrest",    name: "Unrest",    type: "heatmap",    source: "state.map_overlay.unrest", ramp: "calm-crisis" },
  { id: "features",  name: "Features",  type: "icons",      source: "map.features", on: true },
  { id: "armies",    name: "Forces",    type: "markers",    source: "state.military.units", group_by: "region", size_by: "qty", on: true },
  { id: "relations", name: "Diplomacy", type: "flow",       source: "state.diplomacy.relations", from: "state.player.region", to: "region", palette: "stance", color_by: "status", label_by: "opinion" },
];

// ---- fs wrapper -------------------------------------------------------------
export function generate(opts) {
  const root = opts.root || process.cwd();
  const runDir = join(root, "runs", opts.run);
  const genesisPath = opts.genesis_path || join(runDir, "genesis.json");
  const outPath = opts.out_path || join(runDir, "geometry.json");
  const mapPath = opts.map_path || join(runDir, "map.json");

  if (!existsSync(genesisPath)) throw new Error(`no genesis file at ${genesisPath}`);
  const rawString = readFileSync(genesisPath, "utf8");
  const genesis = JSON.parse(rawString);

  const v = validateGenesis(genesis);
  if (!v.ok) return { ok: false, errors: v.errors, warnings: v.warnings };

  const { geometry, map, summary } = buildArtifacts(genesis, rawString);

  const written = [];
  if (!opts.dry_run) {
    writeFileSync(outPath, stringifyCompact(geometry) + "\n");
    written.push(rel(root, outPath));
    if (opts.write_map !== false) {
      writeFileSync(mapPath, stringifyCompact(map) + "\n");
      written.push(rel(root, mapPath));
    }
  }
  return { ok: true, written, ...summary, warnings: [...summary.warnings, ...v.warnings] };
}

const rel = (root, p) => p.slice(root.length).replace(/^[\\/]/, "").replace(/\\/g, "/");

// Pretty JSON, but keep arrays of numbers and arrays of [x,y] pairs inline so
// coordinate lists stay one-per-line instead of exploding to 6 lines per point.
export function stringifyCompact(value, indent = 0) {
  const pad = "  ".repeat(indent), pad1 = "  ".repeat(indent + 1);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const allNums = value.every((v) => typeof v === "number");
    if (allNums) return "[" + value.join(", ") + "]";
    const allNumPairs = value.every((v) => Array.isArray(v) && v.every((n) => typeof n === "number"));
    if (allNumPairs)
      return "[\n" + value.map((v) => pad1 + "[" + v.join(", ") + "]").join(",\n") + "\n" + pad + "]";
    return "[\n" + value.map((v) => pad1 + stringifyCompact(v, indent + 1)).join(",\n") + "\n" + pad + "]";
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined);
    if (keys.length === 0) return "{}";
    return "{\n" + keys.map((k) =>
      pad1 + JSON.stringify(k) + ": " + stringifyCompact(value[k], indent + 1)).join(",\n") + "\n" + pad + "}";
  }
  return JSON.stringify(value);
}
