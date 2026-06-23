# Worldline Lite — map generation (`worldline-mapgen`)

Specialized geography generation, exposed to the agent team as an **MCP server**. The agent
authors a small, human-readable **seed lever** (`runs/<run>/genesis.json`); the generator turns it
into beautiful geography written back into the data store as plain data
(`runs/<run>/geometry.json` + a catalog `map.json`). The renderer then renders that data directly.

This keeps the project's law intact: **the data store is the single source of truth (levers the
agent flips); the renderer only renders projections of it and invents nothing.** Geography is
*generated into the store*, not invented at draw time.

Zero dependencies — pure Node (`.mjs`), no `npm install`, no `node_modules`.

## How the agent uses it

1. Author `runs/<run>/genesis.json` — seeds, weights, adjacency, sea band, river/feature intents.
2. `validate_genesis { run }` — lint (ids unique, seeds in-bounds, adjacency symmetric). No writes.
3. `generate_geography { run }` — grow + refine + place, then write `geometry.json` and `map.json`.

The MCP server is registered for the project in [`.mcp.json`](../../.mcp.json); tools surface as
`mcp__worldline-mapgen__generate_geography` and `…__validate_genesis`. Generation is
**deterministic** (seeded) — the same lever always yields byte-identical geometry, so you can
re-tune seeds and re-run freely while setting up a world.

You can also run it directly without MCP:

```sh
node -e 'import("./tools/mapgen/generate.mjs").then(m => console.log(m.generate({ run: "biopunk", root: process.cwd() })))'
node --test tools/mapgen          # determinism + seam + adjacency tests
```

## The seed lever — `genesis.json` (`worldline-geo-seed/v1`)

```jsonc
{
  "schema": "worldline-geo-seed/v1",
  "seed": 1337,                      // master RNG seed → determinism
  "name": "The Iron Retreat",
  "space": {
    "extent": [0, 0, 100, 100],      // coordinate frame (x0,y0,w,h)
    "units": "grid-sectors", "y_axis": "down",
    "grid": { "step": 10 },
    "detail": { "depth": 5, "coast": 0.09, "border": 0.045, "cap": 25 }  // refinement knobs
  },
  "sea": { "edges": ["W"], "inset": 12 },   // which frame edges are water; coast comes in `inset` deep
  "regions": [
    { "id": "arlin", "name": "Arlin Dome", "terrain": "arid inland corridor",
      "seed": [48, 52],              // where the region grows from
      "weight": 1.3,                 // relative size (bigger = claims more land)
      "adjacent": ["helion", "brinewake", "aquifer", "redline", "continuity"],
      "label_at": [48, 52] }
  ],
  "rivers":   [ { "id": "desal-pipeline", "name": "Desal Corridor", "from": "aquifer", "mouth": "E" } ],
  "features": [
    { "id": "arlin-capital",  "name": "Arlin",          "kind": "city",       "region": "arlin" },
    { "id": "salvage-lanes",  "name": "Salvage Lanes",  "kind": "harbor",     "region": "brinewake" },
    { "id": "pipeline-choke", "name": "Pipeline Choke", "kind": "chokepoint", "between": ["aquifer", "arlin"] }
  ]
}
```

You author **intent**, never coordinates:
- **regions** grow by *multiplicatively-weighted Voronoi* from their `seed`, sized by `weight`.
  `adjacent` is a declared floor — `generate_geography` reports any declared adjacency that didn't
  actually come out so you can nudge seeds.
- **sea** is a band along the named frame `edges`, `inset` units deep. Coastal regions get a coast.
- **rivers** run from a region toward a `mouth` frame edge (`N`/`S`/`E`/`W`), meandering.
- **features**: `city`→region centre, `harbor`→nearest coast vertex of its `region`,
  `chokepoint`→midpoint of the shared border `between` two regions.

## The generated geometry — `geometry.json` (`worldline-geo/v1`)

What the renderer reads. Refined region polygons, the sea, pre-classified boundaries
(`coast`/`border`/`frame`), rivers, and placed features. Shared borders appear **once** and are
byte-identical from both sides (seam-free by construction — the boundary between two regions is the
same lattice arc, simplified once, then refined once). `map.json` becomes a thin **catalog**
(ids/name/terrain/adjacent/label_at + the `layers[]` render contract) with a `"geometry"` pointer.

## Files

| File | Role |
|---|---|
| `refine.mjs` | seeded fractal edge refinement + seam-free edge collection (the geometry core) |
| `voronoi.mjs` | grow region polygons from seeds (weighted Voronoi → shared arcs → simplify) |
| `rivers.mjs` | deterministic river courses |
| `features.mjs` | deterministic feature placement on real coasts / borders |
| `generate.mjs` | orchestrator + validation + fs read/write |
| `mcp-server.mjs` | zero-dep stdio MCP server exposing the tools |
| `*.test.mjs` | determinism / seam / adjacency tests (`node --test tools/mapgen`) |
