// Worldline Lite — deterministic river derivation.
// A river runs from its source region toward a sea/frame edge ("mouth"), bending
// once and then meandering via the shared midpoint-displacement refiner. Seeded
// per river id, so the same intent always yields the same course.

import { refineEdge, hashStr, mulberry32 } from "./refine.mjs";

// intents: [{ id, name, from(regionId), mouth("N"|"S"|"E"|"W") }]
// ctx: { extent, centroids, detail }
export function deriveRivers(intents, ctx) {
  const out = [];
  const [x0, y0, w, h] = ctx.extent;
  const coast = (ctx.detail && ctx.detail.coast) || 0.10;
  const cap = (ctx.detail && ctx.detail.cap) || 25;

  for (const r of intents || []) {
    const src = ctx.centroids[r.from];
    if (!src) continue;
    const mouth = mouthPoint(r.mouth, src, [x0, y0, w, h]);
    const mid = [(src[0] + mouth[0]) / 2, (src[1] + mouth[1]) / 2];

    const rand = mulberry32(hashStr("river:" + r.id));
    // bend the midpoint a little off the straight line for character
    const bend = (rand() * 2 - 1) * 0.12 * Math.hypot(mouth[0] - src[0], mouth[1] - src[1]);
    const dx = mouth[0] - src[0], dy = mouth[1] - src[1], len = Math.hypot(dx, dy) || 1;
    mid[0] += (-dy / len) * bend; mid[1] += (dx / len) * bend;

    // refine each coarse leg with a river-ish roughness, then join
    const legA = refineEdge(src, mid, 5, coast * 0.8, cap, rand);
    const legB = refineEdge(mid, mouth, 5, coast * 0.8, cap, rand);
    const path = legA.concat(legB.slice(1)).map((p) => [round(p[0]), round(p[1])]);

    out.push({ id: r.id, name: r.name || r.id, kind: "river", path });
  }
  return out;
}

function mouthPoint(edge, src, [x0, y0, w, h]) {
  switch (edge) {
    case "N": return [src[0], y0];
    case "S": return [src[0], y0 + h];
    case "E": return [x0 + w, src[1]];
    case "W": return [x0, src[1]];
    default:  return [x0, src[1]];
  }
}
const round = (n) => Math.round(n * 100) / 100;
