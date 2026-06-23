# Worldline Lite — Renderer

Part 3 of the system: a **pure view** over the data store. It reads a run's `state.json` and
`map.json` and draws a pannable 2D map plus stat panels. It computes nothing and decides nothing —
swap or restyle it freely without touching the simulation.

Zero dependencies: vanilla JS + SVG, no build step, works offline.

## Run it

`fetch` needs HTTP (not `file://`), so serve the **project root** and open the renderer.

**Easiest (Windows):** run the bundled script — it serves the root and opens your browser:

```powershell
.\renderer\serve.ps1              # opens the _example run
.\renderer\serve.ps1 my-run       # opens runs/my-run
.\renderer\serve.ps1 my-run 9000  # ...on port 9000
```

**Manual / any platform:**

```sh
# from the project root (worldline-lite/)
python -m http.server 8000
#   then open:  http://localhost:8000/renderer/?run=_example
```

(Any static server works — `npx serve`, etc.) The `run` query param selects which folder under
`runs/` to load; it defaults to `_example`.

Controls: scroll to zoom, drag to pan. The **Base** dropdown picks the layer that colors the
regions; the **overlay toggles** beside it switch stacked layers (features, armies, diplomacy…)
on and off. Which layers exist is declared in `map.json` — see *Layers* below.

## The data contract

The renderer is a function of the files per run in `runs/<run>/`: a catalog `map.json`, the
generated `geometry.json`, and the per-turn `state.json`.

### `geometry.json` — the generated geography (the renderer draws this directly)
Refined region polygons, the sea, pre-classified boundaries (`coast`/`border`/`frame`), rivers, and
placed features. It is **generated** from the run's `genesis.json` seed lever by the
[`worldline-mapgen`](../tools/mapgen/README.md) tool — geography is computed into the data store,
not invented at draw time. Shared borders are seam-free by construction. The renderer renders it
as-is and computes no geometry of its own.

Runs that predate the generator have no `geometry.json`; for those the renderer falls back to
refining the hand-authored `map.json` `polygon`s with a frozen copy of the same algorithm (so they
render exactly as before). `runs/_example/` is such a legacy run.

### `map.json` — the catalog + render contract (authored/generated once, at genesis)
The stable ids and the `layers[]` catalog the renderer binds against. With the generator it is a
thin catalog (`id`/`name`/`terrain`/`adjacent`/`label_at` + `layers`) carrying a `"geometry"`
pointer; dense `polygon` arrays are optional (legacy runs still embed them). Coordinates are
abstract (any units; the `viewBox` defines the canvas).

```jsonc
{
  "schema": "worldline-map/v1",
  "name": "The Riven Coast",
  "viewBox": [0, 0, 100, 100],
  "sea": [[x, y], ...],                       // optional water backdrop polygon
  "regions": [
    {
      "id": "haldmark",                        // stable id; state.json references this
      "name": "Haldmark",
      "terrain": "hilly coast",                // drives the Terrain overlay
      "polygon": [[x, y], ...],                // region outline
      "adjacent": ["veska", "kelsdar"],        // optional; for future fronts/movement
      "label_at": [x, y]                       // label + unit-marker anchor
    }
  ],
  "features": [
    { "id": "saltgate", "kind": "harbor", "name": "Saltgate", "at": [x, y] },
    { "id": "veil", "kind": "river", "name": "The Veil", "path": [[x, y], ...] }
  ]
}
```
Feature `kind`s with built-in icons: `harbor ⚓`, `chokepoint ⛰`, `city ▣`; any other kind gets a
distinct deterministic glyph (not one shared fallback). `river` draws a polyline along `path`.

### `space` — the coordinate system (the stable spatial primitive)

The one canonical frame every coordinate in the file resolves against — region polygons,
feature `at`, `label_at`, unit positions, and any future fields. Authored once at genesis and
**never mutated**, so layers always register with each other across turns. If omitted, it is
synthesized from `viewBox` for older runs.

```jsonc
"space": {
  "id": "riven/v1",
  "extent": [0, 0, 100, 100],   // authoritative bounds; the SVG viewBox derives from this
  "units": "leagues",           // gives scale meaning (abstract is fine)
  "y_axis": "down",             // stated, not assumed
  "grid": { "step": 10 },       // graticule spacing
  "detail": { "depth": 5, "coast": 0.11, "border": 0.05 }   // geometry quality (see below)
}
```

The **Grid** layer (`type: "graticule"`) renders this space visibly — reference lines, a frame,
and edge coordinate ticks. It's the coordinate system made visible, and toggles like any overlay.

**Geometry quality (`space.detail`).** Grown region polygons are crude (a handful of vertices). The
[`worldline-mapgen`](../tools/mapgen/README.md) generator refines every *unique* edge with seeded
fractal midpoint-displacement, so coastlines and borders look organic instead of straight — while
regions that share an edge (and the sea) get *identical* wiggle, leaving no seams. The result is
baked into `geometry.json`. It's deterministic and tuned here: `depth` = subdivision levels
(2^depth segments/edge), `coast`/`border` = roughness as a fraction of edge length, `cap` = max edge
length used for amplitude. Set `depth: 0` to disable. (For legacy runs without `geometry.json`, the
renderer applies the same refinement at load.)

### Layers — how the map is drawn (declared in `map.json`)

Rendering is **data-driven**: `map.json` carries a `layers[]` catalog. Each entry binds a display
name to one of a small, fixed vocabulary of **render primitives**. The agent team can add, remove,
or retitle layers freely — and point them at any data the ledger-keeper writes — **without touching
the renderer**. A code change is only needed to invent a genuinely new *visual* primitive.

If `layers` is omitted, the renderer synthesizes a sensible default (Geography + Political +
Features + Military), so older runs still render.

```jsonc
"layers": [
  { "id": "terrain",   "name": "Geography", "type": "choropleth",
    "source": "map.regions[].terrain", "default": true },   // colors baked into the layer by the generator
  { "id": "ownership", "name": "Political",  "type": "choropleth",
    "source": "state.map_overlay.ownership", "palette": "stance" },
  { "id": "unrest",    "name": "Unrest",     "type": "heatmap",
    "source": "state.map_overlay.unrest", "ramp": "calm-crisis" },
  { "id": "features",  "name": "Features",   "type": "icons",
    "source": "map.features", "on": true },
  { "id": "armies",    "name": "Armies",     "type": "markers",
    "source": "state.military.units", "group_by": "region", "size_by": "qty", "on": true },
  { "id": "relations", "name": "Diplomacy",  "type": "flow",
    "source": "state.diplomacy.relations", "from": "state.player.region",
    "to": "region", "palette": "stance", "color_by": "status", "label_by": "opinion" }
]
```

| `type` | Draws | Key fields |
|---|---|---|
| `graticule` | reference grid + frame + ticks over `space` | (reads `space.grid`; optional `step`) |
| `choropleth` | regions filled by category | `source`, `palette` (or inline `colors`) |
| `heatmap` | regions filled by a number on a color ramp | `source`, `ramp` |
| `icons` | glyphs / rivers at points | `source` (array of features) |
| `markers` | grouped count bubble at a region | `source`, `group_by`, `size_by` |
| `flow` | arrows between regions | `source`, `from`, `to`, `color_by`, `label_by` |

**Rules of the contract:**
- `source` is a **dotted path** into the data store, starting `map.` or `state.` (e.g.
  `state.map_overlay.unrest`). The special form `map.regions[].<field>` reads a field off each
  region. For `choropleth`/`heatmap`, a non-`regions[]` source must resolve to an object keyed by
  region id. Paths are dumb lookups — no expressions.
- Choropleth colors resolve in this order: inline `colors: { category: "#hex" }` (the data store's
  own colors — what the generator **bakes** for open vocabularies like terrain), then a named,
  **renderer-owned** `palette` for *closed* enums (only `stance` today), then a **deterministic
  per-category hue** for anything still uncolored. So the renderer never needs to know a content
  vocabulary, and an unknown category gets a distinct color, never a single shared default. `ramp`
  (heatmap) names a renderer-owned color ramp (`calm-crisis`).
- Feature `kind`s resolve the same way: known semantic kinds keep their icon (`harbor ⚓`,
  `chokepoint ⛰`, `city ▣`); an unknown kind gets a distinct deterministic glyph, not one shared fallback.
- `choropleth`/`heatmap` are **base** layers (one shows at a time, picked by the Base dropdown).
  `icons`/`markers`/`flow` are **overlays** (stack via toggles); set `"on": true` to default-enable.
  `"default": true` picks the initial base layer.
- To add a new layer an agent typically just (1) writes the data under `map_overlay.*` (or reuses an
  existing section) and (2) appends a `layers[]` entry pointing at it. No renderer change.

### `state.json` — the canonical state snapshot (emitted every turn)
A structured mirror of `state-ledger.md`, written by the **ledger-keeper** on commit. Every numeric
field is `{ "value", "delta", "unit"? }` so the view can show deltas. Units bind to the map via
`region` ids and `map_overlay.ownership`.

```jsonc
{
  "schema": "worldline-state/v1",
  "world": "The Riven Coast", "turn": 1, "date": "Spring, Year 1", "status": "active",
  "player": { "name": "...", "region": "haldmark" },
  "economy":   { "treasury": { "value": 1070, "delta": -130, "unit": "cr" }, ... },
  "population": { "approval": { "value": 57, "delta": -1 }, ... },
  "military":  { "manpower_pool": {...}, "units": [
                   { "name", "type", "qty", "delta", "equip", "readiness", "region": "haldmark" } ] },
  "resources": [ { "id", "name", "stock", "delta", "prod", "cons", "strategic" } ],
  "diplomacy": { "relations": [ { "power", "region", "opinion", "delta", "status" } ],
                 "treaties":  [ { "name", "note", "expires_turn" } ] },
  "flags":     [ { "id", "label", "since_turn", "severity": "warning|watch" } ],
  "map_overlay": { "ownership": { "<region_id>": "player|hostile|friendly|neutral" } }
}
```

The renderer degrades gracefully: any missing section is simply skipped, so partial runs still
render. See [`runs/_example/`](../runs/_example/) for a complete worked pair.
