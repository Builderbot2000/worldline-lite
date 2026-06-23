// Layout-solver tests: determinism, pinned anchors, and that a purely SEMANTIC
// lever (no seeds) solves into a real, adjacency-respecting map.
// Run:  node --test tools/mapgen
import { test } from "node:test";
import assert from "node:assert/strict";
import { solveLayout, resolveSeeds, sizeWeight } from "./layout.mjs";
import { buildArtifacts } from "./generate.mjs";

const SPACE = { extent: [0, 0, 100, 100], y_axis: "down" };
const SEA = { edges: ["W"], inset: 12 };

// A semantic ring: each region adjacent to its two neighbors. No coordinates.
const RING = {
  schema: "worldline-geo-seed/v2",
  seed: 1337,
  name: "Ring World",
  space: SPACE,
  sea: SEA,
  regions: [
    { id: "a", name: "A", terrain: "x", size: "large",  adjacent: ["b", "e"] },
    { id: "b", name: "B", terrain: "x", size: "medium", adjacent: ["a", "c"] },
    { id: "c", name: "C", terrain: "x", size: "medium", adjacent: ["b", "d"] },
    { id: "d", name: "D", terrain: "x", size: "small",  adjacent: ["c", "e"] },
    { id: "e", name: "E", terrain: "x", size: "medium", adjacent: ["d", "a"] },
  ],
};

test("size → weight mapping", () => {
  assert.equal(sizeWeight("large"), 1.3);
  assert.equal(sizeWeight(2.5), 2.5);     // numeric passthrough
  assert.equal(sizeWeight(undefined), 1.0);
});

test("solveLayout is deterministic (same seed → identical positions)", () => {
  const a = solveLayout(RING.regions, [], SPACE, SEA, 1337);
  const b = solveLayout(RING.regions, [], SPACE, SEA, 1337);
  assert.deepEqual(a, b);
});

test("a different master seed gives a different layout", () => {
  const a = solveLayout(RING.regions, [], SPACE, SEA, 1337);
  const b = solveLayout(RING.regions, [], SPACE, SEA, 9001);
  assert.notDeepEqual(a, b);
});

test("solved seeds land inside the land box (out of the sea band)", () => {
  const pos = solveLayout(RING.regions, [], SPACE, SEA, 1337);
  for (const id of Object.keys(pos)) {
    const [x, y] = pos[id];
    assert.ok(x >= SEA.inset, `${id} x=${x} is in the western sea band`);
    assert.ok(x <= 100 && y >= 0 && y <= 100, `${id} out of extent`);
  }
});

test("pinned (explicitly-seeded) regions are not moved", () => {
  const regions = RING.regions.map((r) => (r.id === "a" ? { ...r, seed: [30, 30] } : r));
  const pos = solveLayout(regions, [], SPACE, SEA, 1337);
  assert.deepEqual(pos.a, [30, 30]);
});

test("resolveSeeds is a no-op for a fully-authored lever", () => {
  const authored = {
    ...RING,
    regions: RING.regions.map((r, i) => ({ ...r, seed: [20 + i * 10, 50], weight: 1 })),
  };
  const resolved = resolveSeeds(authored);
  assert.deepEqual(resolved.regions, authored.regions);
});

test("cardinal relations bias placement (north_of respects y-down axis)", () => {
  const rels = [{ type: "north_of", a: "a", b: "d" }];
  const pos = solveLayout(RING.regions, rels, SPACE, SEA, 1337);
  assert.ok(pos.a[1] < pos.d[1], "north_of should place A above D on a y-down axis");
});

test("a seedless lever builds a full map with all regions grown", () => {
  const { geometry, summary } = buildArtifacts(RING, JSON.stringify(RING));
  assert.equal(geometry.regions.length, RING.regions.length);
  for (const r of geometry.regions) assert.ok(r.polygon.length >= 3, `${r.id} did not grow`);
  // the solver should realize most of the declared ring adjacency
  assert.ok(summary.adjacency.realized >= summary.adjacency.declared - 1,
    `realized ${summary.adjacency.realized}/${summary.adjacency.declared} adjacencies`);
});
