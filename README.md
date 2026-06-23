# Nation RPG — LLM-Driven Run Toolkit

Govern **one nation** while a team of specialist LLM agents simulates a **living world** around
you — rival powers, economies, wars, and events — turn by turn, with a real numeric simulation
underneath. Runs entirely on Claude Code's own multi-agent features (subagents + a Skill). **No
external API, no orchestration code** — just prompts, definitions, and your save files.

## How it works

A **Skill** (`nation-run`) makes the main Claude Code session act as the **Game Director**. The
Director runs a fixed 6-phase turn loop and dispatches each phase to specialist **subagents** via
the Agent tool. Subagents are stateless, so the **state lives in files** under `runs/<your-run>/`;
the Director passes each agent the slice it needs and collects what it returns. Only one agent —
the **ledger-keeper** — ever writes the canonical save.

```
World Tick → Intel Briefing → [you give orders] → Resolution → Bookkeeping → Report → (repeat)
```

## The agent team (`.claude/agents/`)

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

Specialists **propose** changes as `delta` blocks; the ledger-keeper validates and **commits**
them. All uncertainty routes through the adjudicator. These text contracts live in
[`.claude/skills/nation-run/reference/io-conventions.md`](.claude/skills/nation-run/reference/io-conventions.md);
the tracked stats live in
[`.claude/skills/nation-run/reference/numeric-model.md`](.claude/skills/nation-run/reference/numeric-model.md).

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

## Where a run lives (`runs/<your-run>/`)

```
world-genesis.md   # the setting (chosen at setup)
run-config.md      # difficulty, tone, randomness, victory/failure
nation-sheet.md    # your nation's identity + starting stats
state-ledger.md    # THE SAVE — canonical state + changelog (ledger-keeper only)
lore.md            # canon: NPCs, history, promises (lorekeeper)
rivals/<power>.md  # the DM-run powers
turns/turn-<n>.md  # per-turn log: briefing, orders, roll trail, commit, report
```

## See it in action

[`runs/_example/`](runs/_example/) is a complete worked reference — a low-fantasy coastal march
("Haldmark") with a filled World Genesis, Nation Sheet, a committed `state-ledger.md`, and
[`turns/turn-001.md`](runs/_example/turns/turn-001.md) showing all six phases with real delta,
roll, and commit blocks. It's a read-only reference; your own runs go in their own folders.

## Design notes

- **Genre-agnostic.** Fantasy, alt-history, modern, sci-fi — set per run via World Genesis. Field
  names are fixed; their flavor is yours.
- **Heavy simulation.** Every order resolves into explicit, audited numeric deltas — not vibes.
- **One nation, living world.** You play one seat; world-sim plays everyone else, in their own
  interest and reactive to you.
- **No code, no API.** Everything here is prompts and definitions executed by Claude Code's native
  subagents and skills. (The adjudicator's dice are a runtime `Bash` call for real randomness, not
  project code.)
