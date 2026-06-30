// Worldline Lite — renderer. Zero-dependency, zero-config (no build, no module
// server needed). A pure view over the data store: reads a run's state.json +
// map.json (+ generated geometry.json) and draws them. Decides nothing —
// geography is GENERATED into the data store by tools/mapgen, not invented here.
// For older runs without geometry.json we fall back to refining the hand-authored
// polygons with a frozen copy of the generator's algorithm (see legacyGeometry).
//
// Layers are DATA, not code. map.json declares a `layers[]` catalog; each entry
// binds a name to one of a small, fixed vocabulary of render primitives below.
// The agent team can add/remove/retitle layers freely without touching this file —
// it can only need a code change to invent a genuinely new VISUAL primitive.

const SVGNS = "http://www.w3.org/2000/svg";
const params = new URLSearchParams(location.search);
const RUN = params.get("run") || "_example";

// ---- Renderer-owned palettes & ramps (layers reference these by name) ------
// Only CLOSED, renderer-owned enums live here. Open, store-owned vocabularies
// (terrain and the like) are never enumerated in renderer code: the generator
// bakes their colors into `layer.colors`, and `categoryColor` covers anything
// not handed a color — so the renderer is agnostic to the vocabulary.
const PALETTES = {
  stance:  { player: "#c9a44a", hostile: "#b4513f", friendly: "#4f8a6b", neutral: "#6b6150", default: "#6b6150" },
};
const RAMPS = {
  "calm-crisis": ["#4f7a5e", "#b4513f"],   // low → high (e.g. unrest)
  default:       ["#5a6a78", "#c9a44a"],
};
const NODATA = "#403b34";                  // region present, value absent

// Semantic icons for known feature kinds; unknown kinds get a distinct,
// deterministic glyph (never a single shared fallback) via `iconFor`.
const FEATURE_ICONS = { harbor: "⚓", chokepoint: "⛰", city: "▣" };
const GLYPHS = ["◆", "◈", "▲", "⬟", "⬢", "✦", "❖", "⬣", "◉", "⬠", "✚", "⯁"];

// FNV-1a string hash → 32-bit unsigned. Mirrors tools/mapgen/refine.mjs.
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
// Deterministic muted distinct hue from a category string, with no knowledge of
// any vocabulary. MUST match tools/mapgen/generate.mjs `categoryColor` so a
// baked color and a fallback color agree for the same string.
function categoryColor(s) {
  const h = hashStr(String(s));
  return hslHex(h % 360, 0.24, 0.38 + ((h >>> 9) % 10) / 100);
}
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
const iconFor = (kind) => FEATURE_ICONS[kind] || GLYPHS[hashStr(String(kind)) % GLYPHS.length];

// Which layer types fill regions (one at a time → "base") vs draw on top ("overlay").
const BASE_TYPES = ["choropleth", "heatmap"];
const OVERLAY_TYPES = ["graticule", "icons", "markers", "flow"];
// Fixed z-order for stacked overlays (renderer-owned, never author-controlled).
// The graticule sits lowest so it reads as a backdrop beneath symbols.
const OVERLAY_Z = { graticule: -1, icons: 0, markers: 1, flow: 2 };

let MAP = null, STATE = null;
let activeBase = null;               // layer id of the current region fill
const activeOverlays = new Set();    // layer ids drawn on top

init();

async function init() {
  try {
    [MAP, STATE] = await Promise.all([
      fetchJSON(`../runs/${RUN}/map.json`),
      fetchJSON(`../runs/${RUN}/state.json`),
    ]);
  } catch (e) {
    return showError(
      `Could not load run "${RUN}".\n${e.message}\n\n` +
      `Serve the project root over http (fetch needs http, not file://):\n` +
      `  python -m http.server 8000\n` +
      `then open  http://localhost:8000/renderer/?run=${RUN}`
    );
  }
  renderHeader();
  await loadGeometry();
  initLayers();
  renderLayerControls();
  drawMap();
  renderPanels();
  enablePanZoom();
}

function fetchJSON(url) {
  return fetch(url).then((r) => { if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json(); });
}
// Optional fetch — returns null instead of throwing when the file is absent.
function fetchJSONopt(url) {
  return fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
}

function renderHeader() {
  document.getElementById("world-name").textContent = STATE.world || MAP.name || RUN;
  document.getElementById("turn-badge").textContent = `Turn ${STATE.turn ?? "—"}`;
  document.getElementById("date-badge").textContent = STATE.date || "";
  document.title = `Worldline — ${STATE.world} (Turn ${STATE.turn})`;
}

// ---- Layer catalog ---------------------------------------------------------

// Use the declared catalog when present; otherwise synthesize a sensible default
// from whatever the run happens to contain, so older runs still render.
function getLayers() {
  if (MAP.layers && MAP.layers.length) return MAP.layers;
  const out = [
    { id: "graticule", name: "Grid", type: "graticule", on: true },
    { id: "terrain", name: "Geography", type: "choropleth", source: "map.regions[].terrain", default: true },
  ];
  if (STATE.map_overlay && STATE.map_overlay.ownership)
    out.push({ id: "ownership", name: "Political", type: "choropleth", source: "state.map_overlay.ownership", palette: "stance" });
  if (MAP.features)
    out.push({ id: "features", name: "Features", type: "icons", source: "map.features", on: true });
  if (STATE.military && STATE.military.units)
    out.push({ id: "armies", name: "Military", type: "markers", source: "state.military.units", group_by: "region", size_by: "qty", on: true });
  return out;
}

function initLayers() {
  const layers = getLayers();
  const bases = layers.filter((l) => BASE_TYPES.includes(l.type));
  activeBase = (bases.find((l) => l.default) || bases[0] || {}).id || null;
  activeOverlays.clear();
  for (const l of layers)
    if (OVERLAY_TYPES.includes(l.type) && l.on) activeOverlays.add(l.id);
}

function renderLayerControls() {
  const layers = getLayers();
  const bases = layers.filter((l) => BASE_TYPES.includes(l.type));
  const overlays = layers.filter((l) => OVERLAY_TYPES.includes(l.type));

  const baseSel = document.getElementById("base-layer");
  baseSel.innerHTML = bases
    .map((l) => `<option value="${l.id}"${l.id === activeBase ? " selected" : ""}>${l.name}</option>`)
    .join("");
  baseSel.onchange = (e) => { activeBase = e.target.value; drawMap(); };

  document.getElementById("overlay-toggles").innerHTML = overlays
    .map((l) =>
      `<label class="toggle"><input type="checkbox" value="${l.id}"` +
      `${activeOverlays.has(l.id) ? " checked" : ""}/>${l.name}</label>`)
    .join("");
  document.querySelectorAll("#overlay-toggles input").forEach((cb) => {
    cb.onchange = (e) => {
      e.target.checked ? activeOverlays.add(e.target.value) : activeOverlays.delete(e.target.value);
      drawMap();
    };
  });
}

// ---- Map -------------------------------------------------------------------

const LAYER_TYPES = {
  graticule:  drawGraticule,
  choropleth: drawChoropleth,
  heatmap:    drawHeatmap,
  icons:      drawIcons,
  markers:    drawMarkers,
  flow:       drawFlow,
};

function drawMap() {
  const svg = document.getElementById("map");
  const [ex, ey, ew, eh] = getSpace().extent;
  // Scale factor relative to the 100-unit baseline design so CSS --u values
  // (stroke widths, font sizes, dash arrays) grow proportionally with map size.
  const scale = Math.max(ew, eh) / 100;

  // Inject scale-aware defs plus an extent-specific clip region.
  // The clipPath is defined in world coordinates so it tracks pan/zoom correctly.
  svg.innerHTML = makeDefs(scale) +
    `<clipPath id="map-clip"><rect x="${ex}" y="${ey}" width="${ew}" height="${eh}"/></clipPath>`;
  svg.setAttribute("viewBox", [ex, ey, ew, eh].join(" "));

  // All geography draws into a clipped group so no refined edge leaks past the border.
  // --u is the CSS scale unit; all SVG-space CSS values are written as calc(var(--u,1)*base).
  const g = document.createElementNS(SVGNS, "g");
  g.setAttribute("clip-path", "url(#map-clip)");
  g.style.setProperty("--u", scale);
  svg.appendChild(g);

  drawSea(g);
  drawCoastHalo(g);                                      // soft shallows under the shoreline

  const layers = getLayers();
  const base = layers.find((l) => l.id === activeBase);
  if (base) LAYER_TYPES[base.type](g, base);

  drawRegionLabels(g);
  drawGrain(g);                                          // paper texture over land, under symbols
  drawBoundaries(g);                                     // refined coastlines + political borders

  layers
    .filter((l) => l.id !== activeBase && activeOverlays.has(l.id) && LAYER_TYPES[l.type])
    .sort((a, b) => (OVERLAY_Z[a.type] ?? 0) - (OVERLAY_Z[b.type] ?? 0))
    .forEach((l) => LAYER_TYPES[l.type](g, l));

  renderLegend(base);
}

// The coordinate space — the one stable frame every layer resolves against.
// Authored once in map.json; synthesized from viewBox for older runs.
function getSpace() {
  const s = MAP.space || {};
  return {
    extent: s.extent || MAP.viewBox || [0, 0, 100, 100],
    units: s.units || "abstract",
    grid: s.grid || { step: 10 },
  };
}

// Graticule: the coordinate system made visible — reference grid, frame, edge ticks.
function drawGraticule(svg, layer) {
  const space = getSpace();
  const [x0, y0, w, h] = space.extent;
  const step = layer.step || space.grid.step || 10;
  const x1 = x0 + w, y1 = y0 + h;
  const eps = 1e-6;
  const g = document.createElementNS(SVGNS, "g");
  g.setAttribute("class", "graticule");

  const gridLine = (a, b, c, d) => {
    const l = document.createElementNS(SVGNS, "line");
    l.setAttribute("x1", a); l.setAttribute("y1", b);
    l.setAttribute("x2", c); l.setAttribute("y2", d);
    l.setAttribute("class", "grid-line");
    g.appendChild(l);
  };
  for (let x = x0; x <= x1 + eps; x += step) {
    gridLine(x, y0, x, y1);
    g.appendChild(gridText([x, y0 - 0.8], fmtCoord(x), "grid-label top"));
  }
  for (let y = y0; y <= y1 + eps; y += step) {
    gridLine(x0, y, x1, y);
    g.appendChild(gridText([x0 - 0.8, y + 0.5], fmtCoord(y), "grid-label left"));
  }

  const frame = document.createElementNS(SVGNS, "rect");
  frame.setAttribute("x", x0); frame.setAttribute("y", y0);
  frame.setAttribute("width", w); frame.setAttribute("height", h);
  frame.setAttribute("class", "grid-frame");
  g.appendChild(frame);

  svg.appendChild(g);
}
const fmtCoord = (n) => `${Math.round(n)}`;
function gridText([x, y], str, cls) {
  const el = text([x, y], str, cls);
  return el;
}

// ---- Geometry --------------------------------------------------------------
// Geography is DATA. The generated runs/<run>/geometry.json carries refined
// region polygons, classified boundaries (coast/border), the sea, rivers, and
// placed features — produced by tools/mapgen. We render it directly.
//
// Older runs that predate the generator have only hand-authored crude polygons
// in map.json; for those we refine on load via the SAME shared module the
// generator uses (refine.mjs), so the result is byte-identical to before.

// Normalized shape used everywhere below:
//   { regions: { <id>: [[x,y]...] }, sea: [[x,y]...]|null,
//     boundaries: [ { cls, parts, path } ], features: [ ... ] }
let GEO = { regions: {}, sea: null, boundaries: [], features: [] };

async function loadGeometry() {
  const geom = await fetchJSONopt(`../runs/${RUN}/${MAP.geometry || "geometry.json"}`);
  if (geom && geom.regions) {
    GEO = {
      regions: Object.fromEntries(geom.regions.map((r) => [r.id, r.polygon])),
      sea: geom.sea || null,
      boundaries: geom.boundaries || [],
      features: [...(geom.features || []), ...(geom.rivers || [])],
    };
  } else {
    GEO = legacyGeometry();
  }
}

// Refine hand-authored polygons for pre-generator runs (those without a
// geometry.json). This is a FROZEN copy of tools/mapgen/refine.mjs — its only
// job is to reproduce the legacy renderer's output byte-for-byte, so it must not
// drift. New runs are generated upstream and skip this path entirely.
function legacyGeometry() {
  if (!MAP.regions) return { regions: {}, sea: null, boundaries: [], features: [] };
  const parts = MAP.regions.map((r) => ({ id: r.id, poly: r.polygon }));
  if (MAP.sea) parts.push({ id: "__sea__", poly: MAP.sea });
  return computeGeometryLegacy(parts, (MAP.space || {}).detail);
}

const pkey = (p) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`;
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function refineEdge(A, B, depth, rough, cap, rand) {
  if (depth <= 0 || !rough) return [A, B];
  const dx = B[0] - A[0], dy = B[1] - A[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const amp = rough * Math.min(len, cap);
  const M = [(A[0] + B[0]) / 2 + nx * (rand() * 2 - 1) * amp,
             (A[1] + B[1]) / 2 + ny * (rand() * 2 - 1) * amp];
  const left = refineEdge(A, M, depth - 1, rough * 0.55, cap, rand);
  const right = refineEdge(M, B, depth - 1, rough * 0.55, cap, rand);
  return left.concat(right.slice(1));
}
function computeGeometryLegacy(parts, detail) {
  const d = detail || {};
  const q = { depth: Math.max(0, Math.min(7, Math.round(d.depth ?? 5))),
              coast: d.coast ?? 0.10, border: d.border ?? 0.05, cap: d.cap ?? 25 };
  const edges = new Map();
  for (const part of parts) {
    const pts = part.poly;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const [A, B] = pkey(a) < pkey(b) ? [a, b] : [b, a];
      const key = pkey(A) + "|" + pkey(B);
      let e = edges.get(key);
      if (!e) { e = { key, A, B, parts: new Set(), refined: null }; edges.set(key, e); }
      e.parts.add(part.id);
    }
  }
  for (const [key, e] of edges) {
    const land = [...e.parts].filter((id) => id !== "__sea__").length;
    const hasSea = e.parts.has("__sea__");
    e.cls = land >= 2 ? "border" : hasSea || land === 1 ? "coast" : "frame";
    const rough = e.cls === "border" ? q.border : e.cls === "coast" ? q.coast : 0;
    e.refined = refineEdge(e.A, e.B, rough ? q.depth : 0, rough, q.cap, mulberry32(hashStr(key)));
  }
  const directedEdge = (a, b) => {
    const [A, B] = pkey(a) < pkey(b) ? [a, b] : [b, a];
    const e = edges.get(pkey(A) + "|" + pkey(B));
    if (!e) return [a, b];
    return pkey(a) === pkey(A) ? e.refined : e.refined.slice().reverse();
  };
  const regions = {}; let sea = null;
  for (const part of parts) {
    const out = [], pts = part.poly;
    for (let i = 0; i < pts.length; i++) {
      const seg = directedEdge(pts[i], pts[(i + 1) % pts.length]);
      out.push(...seg.slice(0, -1));
    }
    if (part.id === "__sea__") sea = out; else regions[part.id] = out;
  }
  const boundaries = [...edges.values()].map((e) => ({ cls: e.cls, parts: [...e.parts], path: e.refined }));
  return { regions, sea, boundaries, features: [] };
}

const refinedPoly = (id) => GEO.regions[id];

// Shoreline drawn in two roles: a soft wide "shallows" halo, then crisp coast &
// dashed political borders over the fills.
function drawCoastHalo(svg) {
  for (const e of GEO.boundaries)
    if (e.cls === "coast") svg.appendChild(path(e.path, "coast-halo"));
}
function drawBoundaries(svg) {
  for (const e of GEO.boundaries) {
    if (e.cls === "coast") svg.appendChild(path(e.path, "coastline"));
    else if (e.cls === "border") svg.appendChild(path(e.path, "border-line"));
  }
}

function drawSea(svg) {
  const s = GEO.sea || MAP.sea;
  if (!s) return;
  svg.appendChild(poly(s, { fill: "var(--sea)", class: "sea" }));
}

function drawGrain(svg) {
  const r = document.createElementNS(SVGNS, "rect");
  const [x, y, w, h] = MAP.viewBox || [0, 0, 100, 100];
  r.setAttribute("x", x); r.setAttribute("y", y);
  r.setAttribute("width", w); r.setAttribute("height", h);
  r.setAttribute("class", "grain");
  svg.appendChild(r);
}

// Shared region painter — each base layer just supplies a fill function.
function drawRegions(svg, fillFor, titleFor) {
  for (const r of MAP.regions || []) {
    const p = poly(refinedPoly(r.id) || r.polygon, { fill: fillFor(r), class: "region" });
    p.appendChild(title(titleFor ? titleFor(r) : r.name));
    svg.appendChild(p);
  }
}

function drawRegionLabels(svg) {
  for (const r of MAP.regions || [])
    if (r.label_at) svg.appendChild(text(r.label_at, r.name, "region-label"));
}

function drawChoropleth(svg, layer) {
  drawRegions(svg,
    (r) => colorFor(layer, regionValue(layer, r)),
    (r) => {
      const v = regionValue(layer, r);
      return `${r.name}${v != null ? " — " + v : ""}`;
    });
}

function drawHeatmap(svg, layer) {
  const vals = (MAP.regions || []).map((r) => num(regionValue(layer, r))).filter((v) => v != null);
  const min = vals.length ? Math.min(...vals) : 0;
  const max = vals.length ? Math.max(...vals) : 100;
  drawRegions(svg,
    (r) => {
      const v = num(regionValue(layer, r));
      return v == null ? "url(#nodata)" : heatColor(layer, v, min, max);
    },
    (r) => {
      const v = num(regionValue(layer, r));
      return `${r.name}${v != null ? ` — ${layer.name}: ${v}` : ""}`;
    });
}

function drawIcons(svg, layer) {
  // Catalog map.json carries no `features`; fall back to the generated
  // features + rivers in geometry.json.
  let items = resolvePath(layer.source);
  if (!items || !items.length) items = GEO.features;
  for (const f of items || []) {
    if (f.kind === "river" && f.path) { svg.appendChild(path(f.path, "river")); continue; }
    if (f.at) {
      svg.appendChild(text([f.at[0], f.at[1] + 1], iconFor(f.kind), "feature-icon"));
      svg.appendChild(text([f.at[0], f.at[1] + 3.6], f.name, "feature-label"));
    }
  }
}

function drawMarkers(svg, layer) {
  const groupKey = layer.group_by || "region";
  const sizeKey = layer.size_by || "qty";
  const byRegion = {};
  for (const it of resolvePath(layer.source) || []) {
    const g = it[groupKey];
    if (!g) continue;
    (byRegion[g] ||= []).push(it);
  }
  for (const [regionId, items] of Object.entries(byRegion)) {
    const region = regionById(regionId);
    if (!region || !region.label_at) continue;
    const total = items.reduce((s, it) => s + (num(it[sizeKey]) || 0), 0);
    const [x, y] = region.label_at;
    const c = document.createElementNS(SVGNS, "circle");
    c.setAttribute("cx", x); c.setAttribute("cy", y + 5);
    c.setAttribute("r", 2.6); c.setAttribute("class", "unit-marker");
    c.appendChild(title(items.map((it) => `${it.name}: ${(num(it[sizeKey]) || 0).toLocaleString()}`).join("\n")));
    svg.appendChild(c);
    svg.appendChild(text([x, y + 5.8], abbrev(total), "unit-count"));
  }
}

function drawFlow(svg, layer) {
  const fromId = layer.from ? resolvePath(layer.from) : null;
  const fromR = fromId ? regionById(fromId) : null;
  for (const it of resolvePath(layer.source) || []) {
    const src = layer.from ? fromR : regionById(it[layer.from_field || "from"]);
    const dst = regionById(it[layer.to || "region"]);
    if (!src || !dst || !src.label_at || !dst.label_at || src === dst) continue;
    const color = colorFor(layer, layer.color_by ? it[layer.color_by] : undefined);
    drawArrow(svg, src.label_at, dst.label_at, color,
      it[layer.label_by] != null ? signed(it[layer.label_by]) : "");
  }
}

// ---- Legend ----------------------------------------------------------------

function renderLegend(base) {
  const el = document.getElementById("legend");
  if (!base) { el.innerHTML = ""; return; }

  if (base.type === "choropleth") {
    const cats = [...new Set((MAP.regions || []).map((r) => regionValue(base, r)).filter((v) => v != null))];
    el.innerHTML = `<div class="legend-title">${base.name}</div>` +
      swatchRows(cats.map((c) => [colorFor(base, c), String(c)]));
  } else if (base.type === "heatmap") {
    const vals = (MAP.regions || []).map((r) => num(regionValue(base, r))).filter((v) => v != null);
    const [lo, hi] = [Math.min(...vals, 0), Math.max(...vals, 0)];
    const ramp = RAMPS[base.ramp] || RAMPS.default;
    el.innerHTML = `<div class="legend-title">${base.name}</div>` +
      `<div class="ramp" style="background:linear-gradient(90deg,${ramp[0]},${ramp[1]})"></div>` +
      `<div class="ramp-scale"><span>${lo}</span><span>${hi}</span></div>`;
  }
}
const swatchRows = (pairs) =>
  pairs.map(([c, label]) =>
    `<div class="row"><span class="sw" style="background:${c}"></span>${label}</div>`).join("");

// ---- Panels (unchanged behavior) -------------------------------------------

function renderPanels() {
  body("panel-economy").innerHTML = Object.entries(STATE.economy || {})
    .map(([k, m]) => statRow(k, fmt(m.value, m.unit), m.delta)).join("") +
    Object.entries(STATE.population || {})
      .map(([k, m]) => statRow(k, fmt(m.value), m.delta)).join("");

  body("panel-resources").innerHTML = (STATE.resources || []).map((r) => {
    const flow = (r.prod ?? 0) - (r.cons ?? 0);
    return statRow(
      `${r.name}${r.strategic ? " ★" : ""}`,
      `${fmt(r.stock)} <span class="meta">(${flow >= 0 ? "+" : ""}${flow}/t)</span>`,
      r.delta
    );
  }).join("");

  const m = STATE.military || {};
  body("panel-military").innerHTML =
    statRow("manpower", fmt(m.manpower_pool?.value), m.manpower_pool?.delta) +
    statRow("logistics", fmt(m.logistics?.value), m.logistics?.delta) +
    statRow("doctrine", m.doctrine || "—") +
    (m.units || []).map((u) =>
      `<div class="unit-row"><span class="name">${u.name}</span>` +
      `<div class="meta">${u.type} · ${u.qty.toLocaleString()} · equip ${u.equip} · ` +
      `readiness ${u.readiness}</div></div>`).join("");

  const d = STATE.diplomacy || {};
  body("panel-diplomacy").innerHTML =
    (d.relations || []).map((rel) =>
      `<div class="stat"><span class="k">${rel.power} ` +
      `<span class="tag ${rel.status}">${rel.status}</span></span>` +
      `<span class="v">${signed(rel.opinion)}${deltaSpan(rel.delta)}</span></div>`).join("") +
    (d.treaties || []).map((t) =>
      `<div class="meta" style="margin-top:4px">📜 ${t.name}` +
      `${t.expires_turn ? ` (→T${t.expires_turn})` : ""}</div>`).join("");

  body("panel-flags").innerHTML = (STATE.flags || []).length
    ? (STATE.flags).map((f) =>
        `<span class="tag ${f.severity || "watch"}">${f.label || f.id}</span>`).join("")
    : `<span class="meta">none</span>`;
}

// ---- Data-binding helpers --------------------------------------------------

// Resolve a dotted path against the data store. Paths start "map." or "state.".
// Intentionally dumb: dotted keys only, no expressions. Keep it that way.
function resolvePath(path) {
  if (!path) return undefined;
  const parts = path.split(".");
  let cur = parts[0] === "map" ? MAP : parts[0] === "state" ? STATE : undefined;
  for (let i = 1; i < parts.length && cur != null; i++) cur = cur[parts[i]];
  return cur;
}

// A choropleth/heatmap value for one region. Two source shapes:
//   "map.regions[].<field>"  → that field on the region
//   "<path to object>"       → object keyed by region id
function regionValue(layer, region) {
  const m = /^map\.regions\[\]\.(.+)$/.exec(layer.source || "");
  if (m) return region[m[1]];
  const obj = resolvePath(layer.source);
  return obj ? obj[region.id] : undefined;
}

function colorFor(layer, category) {
  if (layer.colors && category in layer.colors) return layer.colors[category];   // store-owned (incl. baked)
  const pal = PALETTES[layer.palette];                                           // closed renderer-owned enum
  if (category == null) return (pal && pal.default) || NODATA;
  if (pal) return pal[category] ?? pal.default ?? categoryColor(category);
  return categoryColor(category);                                                // open vocabulary → distinct hue
}

function heatColor(layer, v, min, max) {
  const ramp = RAMPS[layer.ramp] || RAMPS.default;
  const t = max > min ? (v - min) / (max - min) : 0.5;
  return lerp(ramp[0], ramp[1], Math.max(0, Math.min(1, t)));
}

const regionById = (id) => (MAP.regions || []).find((r) => r.id === id);
const num = (v) => (typeof v === "number" ? v : (v != null && v !== "" && !isNaN(+v) ? +v : null));

function lerp(a, b, t) {
  const pa = hex(a), pb = hex(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
const hex = (s) => {
  const h = s.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};

// ---- Generic SVG helpers ---------------------------------------------------

const body = (id) => document.getElementById(id).querySelector(".body");

function statRow(k, vHtml, delta) {
  return `<div class="stat"><span class="k">${k}</span>` +
    `<span class="v">${vHtml}${delta !== undefined ? deltaSpan(delta) : ""}</span></div>`;
}
function deltaSpan(d) {
  if (d === undefined || d === null) return "";
  const cls = d > 0 ? "pos" : d < 0 ? "neg" : "zero";
  const s = d > 0 ? `+${d}` : `${d}`;
  return ` <span class="delta ${cls}">${s}</span>`;
}
const signed = (n) => (typeof n === "number" ? (n > 0 ? `+${n}` : `${n}`) : `${n ?? ""}`);
const fmt = (v, unit) =>
  (typeof v === "number" ? v.toLocaleString() : (v ?? "—")) + (unit ? ` <span class="meta">${unit}</span>` : "");
const abbrev = (n) => (n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0) + "k" : `${n}`);

function poly(points, attrs = {}) {
  const el = document.createElementNS(SVGNS, "polygon");
  el.setAttribute("points", points.map((p) => p.join(",")).join(" "));
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}
function path(points, cls) {
  const el = document.createElementNS(SVGNS, "polyline");
  el.setAttribute("points", points.map((p) => p.join(",")).join(" "));
  el.setAttribute("class", cls);
  return el;
}
function text([x, y], str, cls) {
  const el = document.createElementNS(SVGNS, "text");
  el.setAttribute("x", x); el.setAttribute("y", y); el.setAttribute("class", cls);
  el.textContent = str;
  return el;
}
function title(str) {
  const el = document.createElementNS(SVGNS, "title");
  el.textContent = str;
  return el;
}

// Curved-ish arrow between two anchor points, with a head and optional label.
function drawArrow(svg, [x1, y1], [x2, y2], color, label) {
  const g = document.createElementNS(SVGNS, "g");
  g.setAttribute("class", "flow");
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const ex = x2 - ux * 3.2, ey = y2 - uy * 3.2;       // stop short so head sits clear

  const line = document.createElementNS(SVGNS, "line");
  line.setAttribute("x1", x1); line.setAttribute("y1", y1);
  line.setAttribute("x2", ex); line.setAttribute("y2", ey);
  line.setAttribute("stroke", color); line.setAttribute("class", "flow-line");
  g.appendChild(line);

  const px = -uy, py = ux;                              // perpendicular for arrowhead base
  const head = document.createElementNS(SVGNS, "polygon");
  head.setAttribute("points",
    `${x2 - ux * 0.4},${y2 - uy * 0.4} ` +
    `${ex + px * 1.4},${ey + py * 1.4} ` +
    `${ex - px * 1.4},${ey - py * 1.4}`);
  head.setAttribute("fill", color);
  g.appendChild(head);

  if (label) {
    const t = text([(x1 + x2) / 2, (y1 + y2) / 2 - 0.6], label, "flow-label");
    t.setAttribute("fill", color);
    g.appendChild(t);
  }
  svg.appendChild(g);
}

// ---- Pan / zoom ------------------------------------------------------------

function enablePanZoom() {
  const svg = document.getElementById("map");
  let vb = getSpace().extent.slice();
  let dragging = false, last = null;
  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    const k = e.deltaY > 0 ? 1.1 : 0.9;
    const [mx, my] = clientToVB(e, svg, vb);
    vb = [mx - (mx - vb[0]) * k, my - (my - vb[1]) * k, vb[2] * k, vb[3] * k];
    svg.setAttribute("viewBox", vb.join(" "));
  }, { passive: false });
  svg.addEventListener("mousedown", (e) => { dragging = true; last = [e.clientX, e.clientY]; });
  window.addEventListener("mouseup", () => { dragging = false; });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const rect = svg.getBoundingClientRect();
    const sx = vb[2] / rect.width, sy = vb[3] / rect.height;
    vb[0] -= (e.clientX - last[0]) * sx; vb[1] -= (e.clientY - last[1]) * sy;
    last = [e.clientX, e.clientY];
    svg.setAttribute("viewBox", vb.join(" "));
  });
}
function clientToVB(e, svg, vb) {
  const r = svg.getBoundingClientRect();
  return [vb[0] + ((e.clientX - r.left) / r.width) * vb[2],
          vb[1] + ((e.clientY - r.top) / r.height) * vb[3]];
}

function showError(msg) {
  const el = document.getElementById("error");
  el.hidden = false; el.textContent = msg;
}

// ---- SVG <defs> (re-injected each draw, since we clear innerHTML) -----------
// scale = max(ew,eh)/100 so patterns and filters stay proportional at any map size.
function makeDefs(scale) {
  const u = scale || 1;
  const sz = +(3 * u).toFixed(2);
  const bf = +(0.9 / u).toFixed(4);  // smaller frequency → larger grain at larger scale
  return `
<defs>
  <filter id="paper" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="${bf}" numOctaves="2" stitchTiles="stitch" result="n"/>
    <feColorMatrix in="n" type="matrix"
      values="0 0 0 0 0.93  0 0 0 0 0.89  0 0 0 0 0.82  0 0 0 0.5 0"/>
  </filter>
  <filter id="land-shadow" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="${+(0.6 * u).toFixed(2)}" stdDeviation="${+(0.7 * u).toFixed(2)}" flood-color="#000" flood-opacity="0.35"/>
  </filter>
  <pattern id="nodata" width="${sz}" height="${sz}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="${sz}" height="${sz}" fill="#2b2519"/>
    <line x1="0" y1="0" x2="0" y2="${sz}" stroke="#3a3022" stroke-width="${+(0.8 * u).toFixed(2)}"/>
  </pattern>
</defs>`;
}
