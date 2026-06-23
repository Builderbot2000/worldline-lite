# Numeric Model — Shared Stat Vocabulary

This is the single source of truth for **what is tracked** in a nation run. Every stat-driven
subagent (`economy`, `military`, `world-sim`, `adjudicator`, `ledger-keeper`) and every template
(`nation-sheet`, `state-ledger`) uses **these exact field names**. If a value isn't defined here,
it isn't part of the simulation — add it here first.

> **Genre-agnostic note:** field *names* are fixed; their *flavor* is set by World Genesis. A
> "manpower pool" might be conscripts, clone vats, or levied militia depending on setting. A
> resource might be "oil" or "mana crystals." The math is identical.

---

## Conventions

- **Units.** Money is in **credits (cr)**, a setting-neutral abstract currency. Population and
  manpower are in **absolute counts**. Percentages are `0–100`. Bands (Low/Med/High/etc.) are
  used where exact numbers add no value.
- **Per-turn deltas.** Every numeric field stores both a **current value** and a **last-turn
  delta** (e.g. `Treasury: 1,240 cr (+85)`). Deltas reset each turn.
- **Bounded fields** clamp to their range; the ledger-keeper flags any proposed delta that would
  breach a bound and resolves it (e.g. unrest can't exceed 100; overflow becomes a Crisis event).
- **Scale.** Pick a scale at genesis (city-state / regional power / great power) — it sets the
  order of magnitude for treasury, population, and forces. Keep it consistent within a run.

---

## 1. Treasury & Economy

| Field | Type | Notes |
|---|---|---|
| `treasury` | cr | Liquid reserves. May go negative only if `debt` covers it (else Crisis). |
| `income` | cr/turn | Sum of revenue lines (tax, trade, tribute, production sales). |
| `expenses` | cr/turn | Sum of upkeep lines (military, admin, projects, debt interest). |
| `net_balance` | cr/turn | `income − expenses`; applied to treasury each World Tick. |
| `debt` | cr | Outstanding borrowing. Accrues `interest` into expenses. |
| `gdp` | cr | Economic output; drives tax ceiling and prestige. |
| `inflation` | % | High inflation erodes treasury value and approval. |
| `trade_balance` | cr/turn | Net of imports/exports; tied to diplomacy & resources. |

## 2. Population & Society

| Field | Type | Notes |
|---|---|---|
| `population` | count | Total. Grows/shrinks from food, war, migration, events. |
| `demographics` | bands | Named class/group shares (e.g. Elite 5% / Middle 30% / Labor 65%). Setting-defined. |
| `approval` | 0–100 | Public support of the current government/player. |
| `stability` | 0–100 | Resistance to disorder. Low stability raises event severity. |
| `unrest` | 0–100 | Active discontent. ≥ threshold (default 70) triggers a Crisis. |
| `legitimacy` | 0–100 | Right-to-rule; gates certain policies and succession. |

## 3. Military

| Field | Type | Notes |
|---|---|---|
| `manpower_pool` | count | Available recruits. Drawn from population; replenishes per turn. |
| `units` | roster | List of `{name, type, qty, equipment_tier (1–5), readiness 0–100}`. |
| `logistics` | 0–100 | Supply/projection capacity. Caps how many units can fight far from home. |
| `doctrine` | tier 1–5 | Training/organization quality; a combat modifier. |
| `military_upkeep` | cr/turn | Feeds `expenses`. Scales with units × equipment × readiness. |

## 4. Technology & Infrastructure

| Field | Type | Notes |
|---|---|---|
| `research_tracks` | list | `{name, progress 0–100, rate/turn}`. Completion unlocks a modifier/unit/policy. |
| `infrastructure` | tier 1–5 | Roads/ports/grid/comms. Multiplies income, logistics, and project speed. |
| `tech_level` | tier | Overall era position (set by genesis; advances slowly). |

## 5. Resources

A **configurable list** chosen at genesis. Each entry: `{name, stock, production/turn,
consumption/turn, strategic? bool}`. Shortfalls (`consumption > stock + production`) cause
penalties (starvation → population/unrest; energy → infrastructure/economy). Strategic resources
are diplomacy/war levers.

## 6. Diplomacy

| Field | Type | Notes |
|---|---|---|
| `relations` | matrix | Per known power: `opinion (−100..+100)`, `status` (war/hostile/neutral/friendly/ally). |
| `treaties` | list | `{parties, type (trade/defensive/nonaggression/vassalage…), terms, expiry}`. |
| `opinion_modifiers` | list | Per power: named reasons opinion is drifting (`+/− value, decay/turn`). |

## 7. National Traits & Modifiers

Persistent, **named** buffs/debuffs that the math reads as multipliers/addends:
`{name, source (government/ideology/terrain/event/tech), affects (field or system), magnitude,
duration (permanent or N turns)}`. Examples: *Mountainous (defense ×1.25)*, *War Weariness
(approval −10, 4 turns)*, *Mercantile Charter (trade_balance +15%)*.

---

## Derived / computed values (not stored — recomputed each turn)

- **Tax ceiling** = f(`gdp`, `infrastructure`, `approval`) — over-taxing past it spikes `unrest`.
- **Combat power** of a force = `Σ(qty × equipment_tier × readiness) × doctrine × applicable modifiers`.
- **Event severity multiplier** = f(low `stability`, high `unrest`, low `legitimacy`).

These are computed by the relevant specialist at resolution time and never committed as state.
