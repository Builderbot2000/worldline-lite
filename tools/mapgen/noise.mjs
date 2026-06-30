// Worldline Lite — multi-octave value noise for heightmap-driven terrain.
// Zero external dependencies; fully deterministic from genesis.seed.
//
// Replaces the hard rectangular sea band in voronoi.mjs with an organic
// noise-driven coast: the sea spec (edges + inset) becomes a bias gradient
// so the land/sea boundary meanders with bays, peninsulas, and inlets.

import { mulberry32 } from './refine.mjs';

// Smooth 2D value noise on a gridN×gridN lattice with smoothstep interpolation.
// Returns f(nx, ny) → [0, 1] for nx, ny ∈ [0, 1].
function makeValueNoise(gridN, seed) {
  const rand = mulberry32(seed);
  const g = gridN + 1;
  const grid = new Float32Array(g * g);
  for (let k = 0; k < grid.length; k++) grid[k] = rand();

  return (nx, ny) => {
    const gx = nx * gridN;
    const gy = ny * gridN;
    const ix = gx | 0;
    const iy = gy | 0;
    const x0 = Math.min(gridN - 1, ix);
    const y0 = Math.min(gridN - 1, iy);
    const x1 = x0 + 1;
    const y1 = y0 + 1;
    const fx = gx - ix;
    const fy = gy - iy;
    // Ken Perlin's smoothstep fade
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    return (
      grid[y0 * g + x0] * (1 - sx) * (1 - sy) +
      grid[y0 * g + x1] * sx       * (1 - sy) +
      grid[y1 * g + x0] * (1 - sx) * sy       +
      grid[y1 * g + x1] * sx       * sy
    );
  };
}

// Build a GRID×GRID heightmap from genesis.seed and sea spec.
//
// Returns { map: Float32Array[GRID*GRID], seaLevel: number }
// where map[j*GRID+i] < seaLevel ⟺ that cell is sea.
//
// Sea spec knobs (all optional, compose independently):
//
//   edges    — which map edges the sea comes from: ["W"], ["W","S"], etc.
//   inset    — gradient width in world units: how far the sea influence reaches
//              from each listed edge. Wider inset → more room for bays / peninsulas.
//   fraction — target sea coverage [0, 1]: fraction of all cells that are sea.
//              Seed-independent; different seeds give different coastline SHAPES
//              but the same total sea AREA. If omitted, defaults to inset/maxDim
//              per edge (roughly matching the old hard-band area).
//
// Algorithm:
//   1. Build a 4-octave fBm heightmap (continental → fine coastal detail).
//   2. Apply an edge-gradient bias so cells near `edges` trend toward sea.
//      At full bias (edge): height ∈ [-0.5, -0.25] → always sea.
//      At zero bias (interior): height ∈ [0, 1]    → always land.
//   3. Set seaLevel = the `fraction`-th percentile of all heightmap values,
//      so that exactly `fraction` of cells are below the threshold.
//
export function buildHeightmap(genesis, GRID) {
  const masterSeed = ((genesis.seed || 0) ^ 0xdeadbeef) >>> 0;
  const rng = mulberry32(masterSeed);
  const nextSeed = () => (rng() * 0xffffffff) >>> 0;

  // continental → regional → coastal → fine detail
  const layers = [
    { scale: 4,  amp: 1.000, seed: nextSeed() },
    { scale: 8,  amp: 0.500, seed: nextSeed() },
    { scale: 16, amp: 0.250, seed: nextSeed() },
    { scale: 32, amp: 0.125, seed: nextSeed() },
  ];
  const noises = layers.map(l => ({ fn: makeValueNoise(l.scale, l.seed), amp: l.amp }));
  const totalAmp = layers.reduce((s, l) => s + l.amp, 0);

  const seaSpec  = genesis.sea || {};
  const seaEdges = seaSpec.edges || [];
  const inset    = seaSpec.inset || 0;
  const [, , w, h] = genesis.space.extent;
  const maxDim   = Math.max(w, h);

  // Target sea fraction: explicit author value, or derived from inset so old
  // genesis files without `fraction` keep roughly the same sea area they had.
  const fraction = seaSpec.fraction != null
    ? Math.max(0, Math.min(0.95, seaSpec.fraction))
    : seaEdges.length > 0 && inset > 0
      ? Math.min(0.8, (inset / maxDim) * seaEdges.length)
      : 0;

  // Gradient margin: how far from each edge the bias reaches, as a [0,1] fraction.
  // 5× the hard inset gives the noise room to create genuine bays and peninsulas.
  const margin = inset > 0 && seaEdges.length > 0
    ? Math.min(0.85, (inset / maxDim) * 5)
    : fraction > 0 && seaEdges.length > 0
      ? Math.min(0.85, fraction * 3)  // derive margin from fraction when inset omitted
      : 0;

  const map = new Float32Array(GRID * GRID);
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const nx = i / (GRID - 1);
      const ny = j / (GRID - 1);

      let height = 0;
      for (const { fn, amp } of noises) height += fn(nx, ny) * amp;
      height /= totalAmp;   // → [0, 1]

      // Sea edge bias: pull height below zero near specified edges
      let bias = 0;
      if (margin > 0) {
        if (seaEdges.includes('W')) bias = Math.max(bias, 1 - nx / margin);
        if (seaEdges.includes('E')) bias = Math.max(bias, 1 - (1 - nx) / margin);
        if (seaEdges.includes('N')) bias = Math.max(bias, 1 - ny / margin);
        if (seaEdges.includes('S')) bias = Math.max(bias, 1 - (1 - ny) / margin);
        bias = Math.max(0, Math.min(1, bias));
      }

      map[j * GRID + i] = height * (1 - bias * 0.75) - bias * 0.5;
    }
  }

  // Percentile threshold: find the height value below which exactly `fraction`
  // of cells fall, so sea coverage is seed-independent.
  let seaLevel = 0;
  if (fraction > 0) {
    const sorted = Float32Array.from(map).sort();
    seaLevel = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
  }

  return { map, seaLevel };
}
