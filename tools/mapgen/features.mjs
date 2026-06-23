// Worldline Lite — deterministic feature placement.
// Turns feature INTENTS (city in a region, harbor for a region, chokepoint
// between two regions) into placed points the renderer's `icons` layer draws.
// Placement reads the generated geometry, so features sit on the real coast /
// real shared border rather than at hand-guessed coordinates.

// intents: [{ id, name, kind, region?, between?:[a,b] }]
// geo: result of computeGeometry — { regions, boundaries }
// centroids: { id:[x,y] } from growRegions
export function placeFeatures(intents, geo, centroids) {
  const out = [];
  for (const f of intents || []) {
    const at = placeOne(f, geo, centroids);
    if (at) out.push({ id: f.id, name: f.name || f.id, kind: f.kind, at: [round(at[0]), round(at[1])] });
  }
  return out;
}

function placeOne(f, geo, centroids) {
  if (f.kind === "chokepoint" && f.between && f.between.length === 2) {
    return chokepoint(f.between, geo);
  }
  if (f.kind === "harbor" && f.region) {
    return harbor(f.region, geo, centroids);
  }
  // city / default: region anchor (centroid)
  if (f.region) return centroids[f.region] || null;
  if (f.between) return chokepoint(f.between, geo);
  return null;
}

// Midpoint of the shared border between a and b. If several arcs are shared,
// pick the shortest (narrowest contact). Deterministic.
function chokepoint([a, b], geo) {
  const want = new Set([a, b]);
  const borders = geo.boundaries.filter(
    (e) => e.cls === "border" && e.parts.length === 2 && e.parts.every((p) => want.has(p)));
  if (!borders.length) return null;
  borders.sort((p, q) => pathLen(p.path) - pathLen(q.path) || keyCmp(p, q));
  return midOfPath(borders[0].path);
}

// Coast vertex of `region` nearest its centroid.
function harbor(region, geo, centroids) {
  const c = centroids[region];
  const coasts = geo.boundaries.filter((e) => e.cls === "coast" && e.parts.includes(region));
  if (!c || !coasts.length) return c || null;
  let best = null, bestD = Infinity;
  for (const e of coasts) for (const p of e.path) {
    const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

function midOfPath(path) {
  if (path.length === 1) return path[0];
  // arc-length midpoint for stability
  let total = 0;
  for (let i = 1; i < path.length; i++) total += seg(path[i - 1], path[i]);
  let half = total / 2;
  for (let i = 1; i < path.length; i++) {
    const d = seg(path[i - 1], path[i]);
    if (half <= d) {
      const t = d ? half / d : 0;
      return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t,
              path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t];
    }
    half -= d;
  }
  return path[path.length - 1];
}

const seg = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const pathLen = (path) => path.reduce((s, p, i) => i ? s + seg(path[i - 1], p) : 0, 0);
const keyCmp = (p, q) => (p.key < q.key ? -1 : p.key > q.key ? 1 : 0);
const round = (n) => Math.round(n * 100) / 100;
