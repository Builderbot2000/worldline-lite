# World Genesis Template

Defines the **setting** a run takes place in. The framework is genre-agnostic — this file is
where a run commits to a genre, era, and rules. Fill it once at setup (the skill walks you
through it). Copy to `runs/<run-name>/world-genesis.md`.

> Replace every `<...>` and delete the parenthetical hints.

---

## Identity
- **World name:** `<name>`
- **Genre:** `<fantasy | alt-history | modern | near-future | sci-fi | post-apoc | custom>`
- **Era / tech level:** `<bronze age | renaissance | industrial | information | interstellar | ...>`
- **Scale of play:** `<city-state | regional power | great power>` (sets order of magnitude for
  treasury, population, and forces — keep consistent all run)

## Physics & Rules Toggles
Switch on/off the systems that exist in this world (off by default):
- **Magic:** `<off | low | high>` — if on, one line on how it works and what it can/can't do.
- **Psionics / espers:** `<off | on>`
- **FTL / space travel:** `<off | on>`
- **Supernatural / divine intervention:** `<off | on>`
- **Other special rules:** `<e.g. "no gunpowder", "AI uplift", "mana powers the economy">`

## Geography & Map
- **Map style:** `<continent | archipelago | star cluster | wasteland | ...>`
- **The player nation's region:** `<short description of terrain, neighbors, chokepoints>`
- **Notable features:** `<rivers, trade routes, borders, hazards that matter mechanically>`

## Major Powers (the living world)
List 3–7 powers the World-Sim will run. One line each now; flesh out winners into
`rival-nation.md` sheets.
1. `<Power>` — `<one-line identity + how they relate to the player nation>`
2. `<Power>` — `<...>`
3. `<Power>` — `<...>`

## Resource Set
Choose the resources this world tracks (these become entries in the state ledger). 3–6 is plenty.
- `<resource>` — `<what it's used for; strategic? y/n>`
- `<resource>` — `<...>`
- `<resource>` — `<...>`

## Tensions & Themes
- **Central tension:** `<the conflict the world is built around — succession, scarcity, frontier,
  cold war, cataclysm aftermath, ...>`
- **Tone seeds:** `<what should feel heavy/light; what the run is "about">`
- **Starting clock (optional):** `<a looming event with a turn count, e.g. "the Horde arrives ~T10">`

## Active Rules Pack
- **Turn cadence:** `<one turn = a season | a year | five years | ...>` (mirror in run-config)
- **Special mechanics for this setting:** `<anything the specialists must honor — e.g. "winter
  attrition every 4th turn", "mana shortages cause unrest", "spice funds the navy">`
