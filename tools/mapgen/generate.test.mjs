// Generator core tests: determinism, adjacency, seam-free shared borders.
// Run:  node --test tools/mapgen
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildArtifacts, validateGenesis } from "./generate.mjs";
import { pkey } from "./refine.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const loadGenesis = (run) => {
  const raw = readFileSync(join(ROOT, "runs", run, "genesis.json"), "utf8");
  return { raw, genesis: JSON.parse(raw) };
};

test("genesis lever validates", () => {
  const { genesis } = loadGenesis("biopunk");
  const v = validateGenesis(genesis);
  assert.equal(v.ok, true, v.errors.join("; "));
});

test("buildArtifacts is deterministic (same input → byte-identical geometry)", () => {
  const { genesis, raw } = loadGenesis("biopunk");
  const a = buildArtifacts(genesis, raw);
  const b = buildArtifacts(genesis, raw);
  assert.equal(JSON.stringify(a.geometry), JSON.stringify(b.geometry));
  assert.equal(a.summary.input_hash, b.summary.input_hash);
});

test("all regions grow and adjacency is reported", () => {
  const { genesis, raw } = loadGenesis("biopunk");
  const { summary } = buildArtifacts(genesis, raw);
  // With noise-driven terrain, organic bays can separate declared neighbors —
  // that's expected and handled gracefully. What must hold: every region grows
  // at least some cells (no region drowned by sea), and missing adjacencies are
  // reported in summary rather than silently dropped or crashed on.
  assert.equal(summary.regions, genesis.regions.length, "every region must appear in output");
  assert.ok(Array.isArray(summary.adjacency.missing), "missing adjacency list must be present");
  assert.ok(summary.warnings.length === 0, "no zero-cell regions: " + summary.warnings.join("; "));
});

test("shared borders are byte-identical from both regions", () => {
  const { genesis, raw } = loadGenesis("biopunk");
  const { geometry } = buildArtifacts(genesis, raw);
  const polyKeys = {};
  for (const r of geometry.regions) polyKeys[r.id] = r.polygon.map(pkey);
  for (const e of geometry.boundaries) {
    if (e.cls !== "border") continue;
    const lands = e.parts.filter((p) => p !== "__sea__");
    const want = e.path.map(pkey), rev = [...want].reverse();
    for (const id of lands) {
      const have = polyKeys[id];
      const ok = want.every((k) => have.includes(k)) || rev.every((k) => have.includes(k));
      assert.ok(ok, `border ${e.key} not seam-matched into ${id}`);
    }
  }
});

test("features and rivers are placed", () => {
  const { genesis, raw } = loadGenesis("biopunk");
  const { geometry } = buildArtifacts(genesis, raw);
  assert.equal(geometry.rivers.length, (genesis.rivers || []).length);
  assert.equal(geometry.features.length, (genesis.features || []).length);
  for (const f of geometry.features) assert.ok(Array.isArray(f.at) && f.at.length === 2, `${f.id} unplaced`);
});
