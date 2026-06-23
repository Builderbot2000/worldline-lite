# State Ledger Template — The Save File

The **canonical state** of a run — the single source of truth, owned and written only by the
`ledger-keeper`. Every numeric field carries `current (last-turn delta)`. Field names mirror
`reference/numeric-model.md`. Copy to `runs/<run-name>/state-ledger.md`; it's overwritten each
turn (with a changelog appended at the bottom). The starting values come from `nation-sheet.md`.

---

## Header
- **Run:** `<run-name>`
- **Turn:** `<n>`  ·  **In-world date:** `<date per cadence>`
- **Status:** `<active | victory | defeat>`

## Treasury & Economy
| Field | Value (Δ) |
|---|---|
| treasury | `<n> cr (<+/-d>)` |
| income | `<n> cr/turn (<+/-d>)` |
| expenses | `<n> cr/turn (<+/-d>)` |
| net_balance | `<n> cr/turn` |
| debt | `<n> cr (<+/-d>)` |
| gdp | `<n> cr (<+/-d>)` |
| inflation | `<n>% (<+/-d>)` |
| trade_balance | `<+/-n> cr/turn (<+/-d>)` |

## Population & Society
| Field | Value (Δ) |
|---|---|
| population | `<n> (<+/-d>)` |
| demographics | `<Elite n% / Middle n% / Labor n%>` |
| approval | `<0–100> (<+/-d>)` |
| stability | `<0–100> (<+/-d>)` |
| unrest | `<0–100> (<+/-d>)` |
| legitimacy | `<0–100> (<+/-d>)` |

## Military
- **manpower_pool:** `<n> (<+/-d>)`   ·   **logistics:** `<0–100> (<+/-d>)`   ·   **doctrine:** `<tier> `   ·   **military_upkeep:** `<n> cr/turn`
- **units:**
  | Name | Type | Qty (Δ) | Equip | Readiness (Δ) |
  |---|---|---|---|---|
  | `<1st Levy>` | `<infantry>` | `<n> (<+/-d>)` | `<t>` | `<r> (<+/-d>)` |

## Technology & Infrastructure
- **tech_level:** `<tier>`   ·   **infrastructure:** `<tier 1–5> (<+/-d>)`
- **research_tracks:** `<name (progress% +rate)>`, ...

## Resources
| Resource | Stock (Δ) | Prod/turn | Cons/turn | Strategic? |
|---|---|---|---|---|
| `<grain>` | `<n> (<+/-d>)` | `<n>` | `<n>` | `<y/n>` |

## Diplomacy
- **relations:**
  | Power | Opinion (Δ) | Status |
  |---|---|---|
  | `<Veska>` | `<n> (<+/-d>)` | `<neutral>` |
- **treaties:** `<list or none>`
- **opinion_modifiers:** `<Power: reason +/-value, decay/turn>`, ...

## National Traits & Modifiers
- `<name>` — `<affects>` `<magnitude>` — `<permanent | N turns left>`

## Flags
`<active world-state flags set by specialists / ledger-keeper — e.g. famine_risk, war_with_Veska, crisis_pending>`

---

## Changelog
> Append one block per turn (most recent at the bottom). This is the audit trail; never rewrite past entries.

### Turn `<n>` — `<in-world date>`
- `treasury: <before> → <after> (<+/-d>) — <reason>`
- `approval: <before> → <after> (<+/-d>) — <reason>`
- `<...one line per applied delta; mirror the ledger-keeper's commit block...>`
- adjustments: `<clamps/merges/rejections, if any>`
- flags: `<set/cleared>`
