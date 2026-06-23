// Worldline Lite — layout solver. Turns a SEMANTIC region graph (who is adjacent
// to whom, who is north/east of whom, relative sizes) into the TECHNICAL seed
// positions + weights the grower needs — so the agent team authors meaning, not
// coordinates. Deterministic: seeded from genesis.seed, fixed iteration count.
//
// Method: Fruchterman–Reingold force-directed layout. Declared adjacency edges
// pull regions together (springs); every pair pushes apart (repulsion); optional
// cardinal `relations` add a soft directional bias. Positions are clamped into
// the usable LAND box (the extent minus the sea band) so no region grows in water.
//
// This is the first "skeleton strategy": it solves placement on the existing
// continent mask. Archetype-specific masks (archipelago, inland-sea, pangaea)
// plug in later by swapping the land box for an arbitrary land predicate — the
// force model here is mask-agnostic.

import { mulberry32 } from "./refine.mjs";

const GOLDEN = 2.399963229728653;   // golden angle (rad) — even deterministic spread

// Semantic size → multiplicative Voronoi weight (bigger claims more land).
const SIZE_WEIGHT = { tiny: 0.6, small: 0.8, medium: 1.0, large: 1.3, huge: 1.6 };
export function sizeWeight(size) {
  if (typeof size === "number") return size;
  return SIZE_WEIGHT[size] ?? 1.0;
}

// The usable land box: extent minus the sea band on named edges, minus a margin
// so seeds never sit on the very edge (regions would grow as thin slivers).
function landBox(extent, sea) {
  const [x0, y0, w, h] = extent;
  const inset = (sea && sea.inset) || 0;
  const edges = (sea && sea.edges) || [];
  const margin = Math.min(w, h) * 0.06;
  let lx0 = x0 + margin, ly0 = y0 + margin, lx1 = x0 + w - margin, ly1 = y0 + h - margin;
  if (edges.includes("W")) lx0 = x0 + inset + margin;
  if (edges.includes("E")) lx1 = x0 + w - inset - margin;
  if (edges.includes("N")) ly0 = y0 + inset + margin;
  if (edges.includes("S")) ly1 = y0 + h - inset - margin;
  return { lx0, ly0, lx1, ly1 };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Solve seed positions for every region from the adjacency/relations graph.
//
//   regions:   [{ id, adjacent?, seed?, ... }]   — seed present ⇒ pinned anchor
//   relations: [{ type, a, b }]                  — cardinal: north_of/south_of/east_of/west_of
//   space:     { extent: [x0,y0,w,h], y_axis }   — y_axis "down" ⇒ north is smaller y
//   sea:       { edges, inset }                  — defines the land box
//   masterSeed: number                           — determinism
//
// Returns { [id]: [x,y] } for ALL regions (pinned ones returned unchanged).
export function solveLayout(regions, relations, space, sea, masterSeed) {
  const ids = regions.map((r) => r.id);
  const n = ids.length;
  const idx = new Map(ids.map((id, i) => [id, i]));
  const box = landBox(space.extent, sea);
  const yDown = !space || space.y_axis !== "up";   // default axis points down

  const rand = mulberry32((masterSeed ?? 1) >>> 0);
  const cx = (box.lx0 + box.lx1) / 2, cy = (box.ly0 + box.ly1) / 2;
  const span = Math.min(box.lx1 - box.lx0, box.ly1 - box.ly0);

  // ---- initial positions: pinned where given, else a golden-angle spiral ----
  const pos = new Array(n);
  const pinned = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    const r = regions[i];
    if (Array.isArray(r.seed) && r.seed.length === 2) {
      pos[i] = [r.seed[0], r.seed[1]];
      pinned[i] = true;
    } else {
      const a = i * GOLDEN, rad = (span / 2) * 0.75 * Math.sqrt((i + 0.5) / n);
      const jit = span * 0.02;
      pos[i] = [
        clamp(cx + rad * Math.cos(a) + (rand() - 0.5) * jit, box.lx0, box.lx1),
        clamp(cy + rad * Math.sin(a) + (rand() - 0.5) * jit, box.ly0, box.ly1),
      ];
    }
  }
  // Nothing to solve — every region is pinned.
  if (pinned.every(Boolean)) return Object.fromEntries(ids.map((id, i) => [id, pos[i]]));

  // ---- edge set (unordered, symmetric) from declared adjacency ----
  const edges = [];
  const seen = new Set();
  for (const r of regions)
    for (const nb of r.adjacent || []) {
      if (!idx.has(nb)) continue;
      const i = idx.get(r.id), j = idx.get(nb);
      if (i === j) continue;
      const k = i < j ? i + "," + j : j + "," + i;
      if (seen.has(k)) continue;
      seen.add(k);
      edges.push([i, j]);
    }

  // ---- force-directed iteration (Fruchterman–Reingold) ----
  const area = (box.lx1 - box.lx0) * (box.ly1 - box.ly0);
  const k = 0.9 * Math.sqrt(area / Math.max(n, 1));   // ideal separation
  const dirPull = k * 0.25;                            // strength of cardinal bias
  const ITERS = 400;
  let t = span * 0.10;                                 // temperature (max step)
  const cool = Math.pow(0.02, 1 / ITERS);             // → ~2% of t0 by the end

  const disp = Array.from({ length: n }, () => [0, 0]);
  const delta = (i, j) => {
    let dx = pos[i][0] - pos[j][0], dy = pos[i][1] - pos[j][1];
    let d = Math.hypot(dx, dy);
    if (d < 1e-6) { dx = (rand() - 0.5) * 1e-3; dy = (rand() - 0.5) * 1e-3; d = Math.hypot(dx, dy) || 1e-6; }
    return [dx, dy, d];
  };

  for (let it = 0; it < ITERS; it++) {
    for (let i = 0; i < n; i++) { disp[i][0] = 0; disp[i][1] = 0; }

    // repulsion between every pair: f = k^2 / d
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const [dx, dy, d] = delta(i, j);
        const f = (k * k) / d;
        const ux = dx / d, uy = dy / d;
        disp[i][0] += ux * f; disp[i][1] += uy * f;
        disp[j][0] -= ux * f; disp[j][1] -= uy * f;
      }

    // attraction along adjacency edges: f = d^2 / k
    for (const [i, j] of edges) {
      const [dx, dy, d] = delta(i, j);
      const f = (d * d) / k;
      const ux = dx / d, uy = dy / d;
      disp[i][0] -= ux * f; disp[i][1] -= uy * f;
      disp[j][0] += ux * f; disp[j][1] += uy * f;
    }

    // cardinal relations: soft positional bias ("a north_of b" ⇒ pull a toward
    // the side of b that is north). Respect the y-axis direction.
    for (const rel of relations || []) {
      const i = idx.get(rel.a), j = idx.get(rel.b);
      if (i === undefined || j === undefined) continue;
      const north = yDown ? -1 : 1;
      switch (rel.type) {
        case "north_of": disp[i][1] += dirPull * north; disp[j][1] -= dirPull * north; break;
        case "south_of": disp[i][1] -= dirPull * north; disp[j][1] += dirPull * north; break;
        case "east_of":  disp[i][0] += dirPull;         disp[j][0] -= dirPull;         break;
        case "west_of":  disp[i][0] -= dirPull;         disp[j][0] += dirPull;         break;
        default: break;   // across_sea etc. carry no layout force in this strategy
      }
    }

    // integrate: step capped by temperature; pinned anchors never move; clamp to land
    for (let i = 0; i < n; i++) {
      if (pinned[i]) continue;
      const m = Math.hypot(disp[i][0], disp[i][1]) || 1e-9;
      pos[i][0] = clamp(pos[i][0] + (disp[i][0] / m) * Math.min(m, t), box.lx0, box.lx1);
      pos[i][1] = clamp(pos[i][1] + (disp[i][1] / m) * Math.min(m, t), box.ly0, box.ly1);
    }
    t *= cool;
  }

  return Object.fromEntries(ids.map((id, i) => [id, [pos[i][0], pos[i][1]]]));
}

// Resolve a genesis lever's regions so every one has a concrete `seed` and
// `weight`. A no-op for fully-authored v1 levers (all seeds present ⇒ unchanged,
// byte-for-byte). For semantic v2 levers it solves placement from the graph.
export function resolveSeeds(genesis) {
  const regions = genesis.regions || [];
  const sized = regions.map((r) => ({ ...r, weight: r.weight ?? sizeWeight(r.size) }));
  const needs = sized.some((r) => !(Array.isArray(r.seed) && r.seed.length === 2));
  if (!needs) return { ...genesis, regions: sized };

  const positions = solveLayout(sized, genesis.relations, genesis.space, genesis.sea, genesis.seed);
  const round2 = (p) => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100];
  return {
    ...genesis,
    regions: sized.map((r) => ({
      ...r,
      seed: Array.isArray(r.seed) && r.seed.length === 2 ? r.seed : round2(positions[r.id]),
    })),
  };
}
