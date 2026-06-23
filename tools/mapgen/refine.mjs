// Worldline Lite — edge refinement. Single source of truth, shared by the
// geography generator (tools/mapgen) and the renderer's legacy fallback.
//
// Authored/grown region polygons are crude (a handful of vertices → straight
// coasts/borders). We refine every UNIQUE edge once with seeded fractal
// midpoint-displacement, so regions that share an edge (and the sea) get
// identical wiggle — no seams. Deterministic: the same input always yields the
// same output, because each edge seeds its RNG from a canonical key.
//
// This is the same algorithm that used to live inline in renderer/app.js
// (functions hashStr / mulberry32 / pkey / refineEdge / buildGeometry), moved
// out verbatim so geometry is GENERATED into the data store rather than
// invented at render time. Byte-for-byte compatible with the old renderer.

// Quantized point key: rounds to 3 decimals so coincident vertices (a shared
// border from two regions) collapse to one canonical key.
export const pkey = (p) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`;

// FNV-1a string hash → 32-bit unsigned. Seeds the per-edge RNG.
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// mulberry32 — small, fast, deterministic PRNG seeded from an integer.
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Recursive midpoint displacement: offset the midpoint along the edge normal,
// amplitude shrinking each level → a fractal coastline. Endpoints never move.
export function refineEdge(A, B, depth, rough, cap, rand) {
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

const clampInt = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(n)));

// Normalize a `space.detail` object to the four quality knobs, with the same
// defaults the renderer used.
export function quality(detail) {
  const d = detail || {};
  return {
    depth:  clampInt(d.depth ?? 5, 0, 7),   // subdivisions = 2^depth segments/edge
    coast:  d.coast ?? 0.10,                 // shoreline roughness (× edge length)
    border: d.border ?? 0.05,                // political-border roughness
    cap:    d.cap ?? 25,                      // max edge length used for amplitude
  };
}

// Refine a set of closed polygons into seam-free geometry.
//
//   parts:  [{ id, poly: [[x,y], ...] }]  — use id "__sea__" for the water body.
//   detail: a space.detail object (see quality()).
//
// Returns the canonical generated shape:
//   { regions: { <id>: [[x,y],...] }, sea: [[x,y],...]|null,
//     boundaries: [ { key, cls: "coast"|"border"|"frame", parts: [...], path: [[x,y],...] } ] }
//
// `boundaries` carries each unique refined edge ONCE, already classified — the
// renderer just iterates it (no edge logic), so shared edges are seam-free by
// construction.
export function computeGeometry(parts, detail) {
  const edges = new Map();

  // Pass 1: collect unique edges and which parts touch each (→ classification).
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

  // Pass 2: classify + refine each edge once, deterministically.
  const q = quality(detail);
  for (const [key, e] of edges) {
    const land = [...e.parts].filter((id) => id !== "__sea__").length;
    const hasSea = e.parts.has("__sea__");
    e.cls = land >= 2 ? "border" : hasSea || land === 1 ? "coast" : "frame";
    const rough = e.cls === "border" ? q.border : e.cls === "coast" ? q.coast : 0;
    const rand = mulberry32(hashStr(key));
    e.refined = refineEdge(e.A, e.B, rough ? q.depth : 0, rough, q.cap, rand);
  }

  const directedEdge = (a, b) => {
    const [A, B] = pkey(a) < pkey(b) ? [a, b] : [b, a];
    const e = edges.get(pkey(A) + "|" + pkey(B));
    if (!e) return [a, b];
    return pkey(a) === pkey(A) ? e.refined : e.refined.slice().reverse();
  };

  // Pass 3: stitch each part's refined edges back into a closed polygon.
  const regions = {};
  let sea = null;
  for (const part of parts) {
    const out = [];
    const pts = part.poly;
    for (let i = 0; i < pts.length; i++) {
      const seg = directedEdge(pts[i], pts[(i + 1) % pts.length]);
      out.push(...seg.slice(0, -1));   // drop shared vertex; next edge supplies it
    }
    if (part.id === "__sea__") sea = out;
    else regions[part.id] = out;
  }

  const boundaries = [...edges.values()].map((e) => ({
    key: e.key,
    cls: e.cls,
    parts: [...e.parts],
    path: e.refined,
  }));

  return { regions, sea, boundaries };
}
