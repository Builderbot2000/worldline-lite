# State Ledger — The March of Haldmark (example run)

> Canonical save, written only by the `ledger-keeper`. Shown here **as of the end of Turn 1**.

## Header
- **Run:** _example (The Riven Coast)
- **Turn:** 1  ·  **In-world date:** Spring, Year 1
- **Status:** active

## Treasury & Economy
| Field | Value (Δ) |
|---|---|
| treasury | 1,070 cr (−130) |
| income | 550 cr/turn (+70) |
| expenses | 410 cr/turn (0) |
| net_balance | +140 cr/turn |
| debt | 400 cr (0) |
| gdp | 6,200 cr (0) |
| inflation | 3% (0) |
| trade_balance | +90 cr/turn (+30) |

## Population & Society
| Field | Value (Δ) |
|---|---|
| population | 540,000 (0) |
| demographics | Holders 6% / Townsfolk 24% / Freeholders & labor 70% |
| approval | 57 (−1) |
| stability | 62 (0) |
| unrest | 25 (+3) |
| legitimacy | 70 (0) |

## Military
- **manpower_pool:** 14,000 (0)   ·   **logistics:** 45 (0)   ·   **doctrine:** tier 2   ·   **military_upkeep:** 240 cr/turn
- **units:**
  | Name | Type | Qty (Δ) | Equip | Readiness (Δ) |
  |---|---|---|---|---|
  | 1st Haldmark Levy | infantry (pike) | 4,000 (0) | 2 | 55 (0) |
  | Saltgate Guard | infantry (garrison) | 1,500 (0) | 3 | 70 (0) |
  | Coast Wardens | light cavalry | 800 (0) | 2 | 60 (0) |

## Technology & Infrastructure
- **tech_level:** late-medieval   ·   **infrastructure:** tier 2 (0)
- **research_tracks:** Bastion Fortification (25% +10/turn), Coastal Shipwrightry (0% +8/turn)

## Resources
| Resource | Stock (Δ) | Prod/turn | Cons/turn | Strategic? |
|---|---|---|---|---|
| grain | 2,890 (−110) | 900 | 860 | n |
| timber | 1,420 (+20) | 220 | 120 | n |
| iron | 580 (−20) | 90 | 110 | y |

## Diplomacy
- **relations:**
  | Power | Opinion (Δ) | Status |
  |---|---|---|
  | Veska | −30 (−5) | hostile |
  | Adran League | +25 (+10) | friendly |
  | Kelsdar Clans | −5 (0) | neutral |

- **treaties:** Adran Trade Pact (trade clause only, no defensive obligation) — expires T9
- **opinion_modifiers:** Veska "Haldmark fortifies the Veil" −3/turn drift; Adran "Trade Pact" +5 (no decay)

## National Traits & Modifiers
- Mountain Border (Kelsdar passes) — northern defense ×1.25 — permanent
- Harbor Customs (Saltgate) — trade income +20% — permanent
- Iron-Poor — equipment upgrades cost ×1.5 iron — permanent

## Flags
veska_mobilizing (set T1) ; iron_deficit_watch (stock falling ~20/turn)

---

## Changelog

### Turn 1 — Spring, Year 1
- treasury: 1,200 → 1,070 (−130) — base net +70, less 200 cr crash-funding of Veil bastion works
- income: 480 → 550 (+70) — Adran trade pact (+40), Saltgate tariff rise (+30)
- trade_balance: +60 → +90 (+30) — pact (+40), tariff friction (−10)
- approval: 58 → 57 (−1) — merchant grumbling at tariff (−3), pact good news (+2)
- unrest: 22 → 25 (+3) — tariff rise
- research.Bastion_Fortification: 0% → 25% (+25) — crash works at the Veil
- grain.stock: 3,000 → 2,890 (−110) — cold spring cut the harvest (Adjudicator: PARTIAL)
- timber.stock: 1,400 → 1,420 (+20) — net of +100 growth less +80 drawn for bastion works
- iron.stock: 600 → 580 (−20) — ongoing deficit (consumption > production)
- relations.Veska.opinion: −25 → −30 (−5) — Veska masses levies near the Veil
- relations.Adran.opinion: +15 → +25 (+10); status neutral → friendly — trade pact signed
- treaties: + Adran Trade Pact (expires T9)
- adjustments: economy double-listed the bastion cost as both a project expense line and a one-time charge; **kept the one-time 200 cr charge only**, expenses line unchanged
- flags: set veska_mobilizing; iron_deficit_watch noted (no crisis yet)
