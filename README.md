# Worldline Lite — an LLM-Driven Nation RPG

Govern **one nation** while a team of specialist LLM agents simulates a **living world** around
you — rival powers, economies, wars, and events — turn by turn, with a real numeric simulation
underneath.

Worldline Lite is built as **three cleanly separated parts**, each with one job:

1. **The agentic team** — the dungeon master. Reads your prompt, orchestrates every change, and
   narrates the world back to you.
2. **The data store** — the durable memory. Records the *non-fuzzy* facts (resources, units,
   territory, ledgers) that must be recalled exactly across a long campaign.
3. **The renderer** — the eyes. Visualizes whatever lives in the data store in an aesthetically
   pleasing way — a pannable 2D map plus live stat panels. *(Working first cut — see
   [Status](#status).)*

The split is the whole idea: prose and judgment belong to a probabilistic narrator, hard numbers
belong to a deterministic record, and pictures belong to a dedicated view. Read [Rationale](#rationale)
for why.

---

## Rationale

LLMs are wonderful dungeon masters and terrible accountants. They improvise, voice characters,
and weigh consequences beautifully — and they also quietly forget that you spent 40 of your 100
grain three turns ago, or that the bridge you burned should still be down. A campaign that asks one
model to do *both* the storytelling and the bookkeeping drifts: numbers wander, canon contradicts
itself, and the longer you play the worse it gets.

Worldline Lite separates the **fuzzy** from the **crisp**, and the **state** from the **view**:

- **The agentic team owns judgment and narration, not truth.** It decides *what happens* and says
  it well, but it is not allowed to be the source of record for a number. Every consequential
  change is emitted as an explicit, auditable proposal — never an unstated edit buried in prose.
- **The data store owns truth, not opinion.** It holds only information that is meant to be
  recalled *durably and exactly*: stockpiles, unit counts, territory, balances, standing flags. It
  doesn't narrate; it remembers. Because state is small, structured, and authoritative, a 50-turn
  campaign stays as internally consistent as turn 1.
- **The renderer owns presentation, not logic.** It is a pure function of the data store: read the
  facts, draw them. It never decides anything, so it can be swapped, restyled, or rebuilt without
  touching the simulation.

This separation buys three things that matter for long play: **durability** (the canon can't drift
because the model that narrates isn't the model of record), **auditability** (every number has a
delta and a dice roll behind it you can inspect), and **modularity** (you can improve the writing,
the bookkeeping, or the visuals independently).

> **"Lite":** it runs entirely on Claude Code's own multi-agent features — subagents plus a Skill.
> The agentic team and data store need **no external API and no orchestration code** — just
> prompts, file contracts, and your save files. The renderer is the one part that will be real
> code.

---

## Part 1 — The agentic team (the DM)

A **Skill** (`nation-run`) makes the main Claude Code session act as the **Game Director**. The
Director runs a fixed 6-phase turn loop and dispatches each phase to specialist **subagents** via
the Agent tool. Subagents are stateless, so they read the slice of state they need from the data
store, do their job, and return text; the Director routes the results onward.

```
World Tick → Intel Briefing → [you give orders] → Resolution → Bookkeeping → Report → (repeat)
```

| Agent | Role | Writes state? |
|---|---|---|
| **(Game Director)** | the `nation-run` skill / main session: runs the loop, dispatches, talks to you | no |
| **narrator** | turns the simulation into prose: briefings, advisor voices, outcome reports | no |
| **world-sim** | runs every rival nation, faction, and global event | no (proposes) |
| **economy** | budgets, trade, production, resources — the money math | no (proposes) |
| **military** | forces, logistics, and combat resolution | no (proposes) |
| **adjudicator** | the impartial dice — rolls real numbers for any uncertain outcome | no |
| **ledger-keeper** | validates everyone's proposed changes and commits the save | **yes** |
| **lorekeeper** | canon & continuity — NPCs, history, promises | only `lore.md` |

Specialists **propose** changes as `delta` blocks; the **ledger-keeper** alone validates and
**commits** them to the data store. All uncertainty routes through the **adjudicator** (real
randomness via a runtime `Bash` call, not preference). These text contracts live in
[`.claude/skills/nation-run/reference/io-conventions.md`](.claude/skills/nation-run/reference/io-conventions.md);
the tracked stats live in
[`.claude/skills/nation-run/reference/numeric-model.md`](.claude/skills/nation-run/reference/numeric-model.md).

The agent definitions are in [`.claude/agents/`](.claude/agents/).

## Part 2 — The data store (durable memory)

The data store holds the **non-fuzzy** information — the facts that storytelling must be able to
recall exactly. Today it is **file-based**, one folder per run under `runs/<your-run>/`:

```
world-genesis.md   # the setting (chosen at setup)
run-config.md      # difficulty, tone, randomness, victory/failure
nation-sheet.md    # your nation's identity + starting stats
state-ledger.md    # THE SAVE — canonical state + changelog (ledger-keeper only)
state.json         # structured mirror of the ledger for the renderer (ledger-keeper, per commit)
genesis.json       # the map seed lever — seeds/adjacency/sea/intents (authored once at genesis)
geometry.json      # generated geography (the worldline-mapgen tool turns genesis.json into this)
map.json           # catalog + render contract for the renderer (generated alongside geometry.json)
lore.md            # canon: NPCs, history, promises (lorekeeper)
rivals/<power>.md  # the DM-run powers
turns/turn-<n>.md  # per-turn log: briefing, orders, roll trail, commit, report
```

`state-ledger.md` is the **single source of truth**, written by **only one** agent. Everything
else is either input (genesis, config, sheet) or an append-only audit trail (turn logs). The
format is plain Markdown today so a run is human-readable and diff-able; the contracts are designed
so the backing store could later become structured data (JSON/SQLite) without changing the agents
that read and propose against it.

## Part 3 — The renderer (the view)

The renderer ([`renderer/`](renderer/)) reads the data store and **visualizes** it — a pannable 2D
region map (colored by diplomatic stance or terrain), map features (harbors, rivers, chokepoints),
unit markers, and live stat panels with per-turn deltas. It is a **read-only consumer of canonical
state**: it computes nothing and decides nothing, so it can be built and restyled independently of
the simulation.

It's a **zero-dependency** static web app (vanilla JS + SVG, no build step). It reads a catalog
`map.json`, the generated `geometry.json` (refined coasts/borders/rivers/features), and `state.json`
(the ledger-keeper's per-commit mirror). The geography itself is *generated into the data store* at
genesis by the [`worldline-mapgen`](tools/mapgen/README.md) MCP tool from a small `genesis.json`
seed lever — the agent team flips levers (seeds, adjacency, intents); the tool computes the
geometry; the renderer just draws it. Run it by serving the project root:

```sh
python -m http.server 8000        # from the project root
# open  http://localhost:8000/renderer/?run=_example
```

See [`renderer/README.md`](renderer/README.md) for the full data contract.

---

## Starting a run

Just invoke the skill — e.g. **`/nation-run`** or *"start a new nation run."* The Director will:
1. **Set up** the world with you using the templates in
   [`.claude/skills/nation-run/templates/`](.claude/skills/nation-run/templates/) — World Genesis
   (genre/era/setting, fully genre-agnostic), Run Config (difficulty/tone/victory), and your
   Nation Sheet — saved to `runs/<your-run>/`.
2. **Initialize** the canonical `state-ledger.md` from your nation sheet.
3. **Run Turn 1**, pausing at the Intel Briefing for your orders.

**Continuing:** invoke the skill again and name your run (or it picks the only active one) — it
loads the latest ledger and starts the next turn. Ask for **status** anytime to see the current
state without spending a turn.

## See it in action

[`runs/_example/`](runs/_example/) is a complete worked reference — a low-fantasy coastal march
("Haldmark") with a filled World Genesis, Nation Sheet, a committed `state-ledger.md`, and
[`turns/turn-001.md`](runs/_example/turns/turn-001.md) showing all six phases with real delta,
roll, and commit blocks. It's a read-only reference; your own runs go in their own folders.

## Status

| Part | State |
|---|---|
| **Agentic team** | working — agents + `nation-run` skill |
| **Data store** | working — file-based, Markdown ledger + `state.json`/`map.json` feed |
| **Renderer** | working first cut — static web app; 2D map + stat panels (more overlays/timeline planned) |

## Design notes

- **Genre-agnostic.** Fantasy, alt-history, modern, sci-fi — set per run via World Genesis. Field
  names are fixed; their flavor is yours.
- **Heavy simulation.** Every order resolves into explicit, audited numeric deltas — not vibes.
- **One nation, living world.** You play one seat; world-sim plays everyone else, in their own
  interest and reactive to you.
- **No code, no API (for parts 1–2).** The team and the store are prompts and definitions executed
  by Claude Code's native subagents and skills. (The adjudicator's dice are a runtime `Bash` call
  for real randomness, not project code.) The renderer is the one part that is real code — a
  small, zero-dependency static web app.
