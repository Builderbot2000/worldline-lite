# Nation Sheet Template — The Player Nation

The player nation's full stat block at the **start** of a run. Field names mirror
`reference/numeric-model.md` exactly; once play begins, the live values move into
`state-ledger.md` and this sheet stays as the "character sheet" / identity reference.
Copy to `runs/<run-name>/nation-sheet.md`.

---

## Identity
- **Nation name:** `<name>`
- **Government:** `<monarchy | republic | junta | theocracy | corporate state | hive | ...>`
- **Ideology / ethos:** `<one line>`
- **Ruler / head (the player's seat):** `<title + name>`
- **Capital:** `<name>`
- **Scale:** `<inherit from world-genesis: city-state | regional | great power>`

## Treasury & Economy
- **Treasury:** `<n> cr`
- **Income (per turn):** `<n> cr` — lines: `<tax n / trade n / tribute n / production n>`
- **Expenses (per turn):** `<n> cr` — lines: `<military n / admin n / projects n / interest n>`
- **Debt:** `<n> cr`
- **GDP:** `<n> cr`
- **Inflation:** `<n>%`
- **Trade balance:** `<+/-n> cr/turn`

## Population & Society
- **Population:** `<n>`
- **Demographics:** `<Elite n% / Middle n% / Labor n%>` (name groups to fit the setting)
- **Approval:** `<0–100>`
- **Stability:** `<0–100>`
- **Unrest:** `<0–100>`
- **Legitimacy:** `<0–100>`

## Military
- **Manpower pool:** `<n>`
- **Units:**
  | Name | Type | Qty | Equip (1–5) | Readiness (0–100) |
  |---|---|---|---|---|
  | `<1st Levy>` | `<infantry>` | `<n>` | `<t>` | `<r>` |
- **Logistics:** `<0–100>`
- **Doctrine:** `<tier 1–5>`
- **Military upkeep:** `<n> cr/turn`

## Technology & Infrastructure
- **Tech level:** `<tier / era from genesis>`
- **Research tracks:** `<name (progress%/rate)>`, ...
- **Infrastructure:** `<tier 1–5>`

## Resources
(one row per resource chosen in world-genesis)
| Resource | Stock | Production/turn | Consumption/turn | Strategic? |
|---|---|---|---|---|
| `<grain>` | `<n>` | `<n>` | `<n>` | `<y/n>` |

## Diplomacy
- **Relations:** (one row per known power)
  | Power | Opinion (−100..+100) | Status |
  |---|---|---|
  | `<Veska>` | `<n>` | `<neutral>` |
- **Treaties:** `<none | {parties, type, terms, expiry}>`

## National Traits & Modifiers
(persistent named buffs/debuffs — `{name, source, affects, magnitude, duration}`)
- `<Mountain Fastness>` — terrain — defense ×1.25 — permanent
- `<...>`

## Goals (player's win-conditions / ambitions)
- `<short, medium, long-term aims; informs the Director's hooks and run-config victory checks>`
