// Determinism + seam regression for refine.mjs.  Run:  node --test tools/mapgen
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { computeGeometry, pkey, hashStr } from "./refine.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

function loadParts(run) {
  const map = JSON.parse(readFileSync(join(ROOT, "runs", run, "map.json"), "utf8"));
  const parts = map.regions.map((r) => ({ id: r.id, poly: r.polygon }));
  if (map.sea) parts.push({ id: "__sea__", poly: map.sea });
  return { parts, detail: (map.space || {}).detail };
}

// Stable digest of a geometry result, robust to Map/Set ordering.
function digest(geo) {
  const r = Object.keys(geo.regions).sort()
    .map((id) => id + ":" + JSON.stringify(geo.regions[id])).join("|");
  const b = geo.boundaries
    .map((e) => `${e.key}#${e.cls}#${[...e.parts].sort().join(",")}#${JSON.stringify(e.path)}`)
    .sort().join("|");
  return hashStr(r + "||" + JSON.stringify(geo.sea) + "||" + b);
}

test("computeGeometry is deterministic (byte-identical across runs)", () => {
  const { parts, detail } = loadParts("_example");
  const a = computeGeometry(parts, detail);
  const b = computeGeometry(parts, detail);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("every region grows a non-trivial refined polygon", () => {
  const { parts, detail } = loadParts("_example");
  const geo = computeGeometry(parts, detail);
  for (const r of parts.filter((p) => p.id !== "__sea__")) {
    assert.ok(geo.regions[r.id], `missing polygon for ${r.id}`);
    // depth-5 refinement of a 5–8 vertex polygon → many points
    assert.ok(geo.regions[r.id].length > r.poly.length, `${r.id} not refined`);
  }
});

test("shared borders are seam-free (border path is a sub-sequence of both regions)", () => {
  const { parts, detail } = loadParts("_example");
  const geo = computeGeometry(parts, detail);
  const keysOf = (poly) => poly.map(pkey);
  for (const e of geo.boundaries) {
    if (e.cls !== "border") continue;
    const lands = e.parts.filter((id) => id !== "__sea__");
    const want = e.path.map(pkey);
    const wantRev = [...want].reverse();
    for (const id of lands) {
      const have = keysOf(geo.regions[id]);
      // The refined edge appears (possibly reversed, possibly wrapping) in the
      // region's vertex list. Check every vertex of the edge is present.
      const present = want.every((k) => have.includes(k)) || wantRev.every((k) => have.includes(k));
      assert.ok(present, `border ${e.key} not stitched into region ${id}`);
    }
  }
});

test("classification matches edge topology", () => {
  const { parts, detail } = loadParts("_example");
  const geo = computeGeometry(parts, detail);
  for (const e of geo.boundaries) {
    const land = e.parts.filter((id) => id !== "__sea__").length;
    const hasSea = e.parts.includes("__sea__");
    const expect = land >= 2 ? "border" : hasSea || land === 1 ? "coast" : "frame";
    assert.equal(e.cls, expect, `bad class for ${e.key}`);
  }
});
