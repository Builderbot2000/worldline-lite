# State Ledger - Integrated Automatics Corporation

## Header
- **Run:** genesis
- **Turn:** 0  ·  **In-world date:** Late Dry Season Y0
- **Status:** active

## Treasury & Economy
| Field | Value (D) |
|---|---|
| treasury | 420 cr (0) |
| income | 260 cr/turn (0) |
| expenses | 245 cr/turn (0) |
| net_balance | 0 cr/turn |
| debt | 180 cr (0) |
| gdp | 2,100 cr (0) |
| inflation | 6% (0) |
| trade_balance | -15 cr/turn (0) |

## Population & Society
| Field | Value (D) |
|---|---|
| population | 240,000 (0) |
| demographics | Administrators 6% / Contract Specialists 18% / Civic Labourers 49% / Unregistered Persons 17% / Contract Legionnaires 10% |
| approval | 46 (0) |
| stability | 41 (0) |
| unrest | 57 (0) |
| legitimacy | 52 (0) |

## Military
- **manpower_pool:** 8,500 (0)   ·   **logistics:** 52 (0)   ·   **doctrine:** tier 3   ·   **military_upkeep:** 120 cr/turn
- **units:**
  | Name | Type | Qty (D) | Equip | Readiness (D) |
  |---|---|---|---|---|
  | Arlin Contract Legion | infantry | 2,200 (0) | 3 | 62 (0) |
  | Dome Security Cohorts | garrison infantry | 1,800 (0) | 2 | 68 (0) |
  | Perimeter Drone Lances | drone cavalry | 350 (0) | 3 | 55 (0) |

## Technology & Infrastructure
- **tech_level:** information-age enclave   ·   **infrastructure:** tier 3 (0)
- **research_tracks:** Closed-Loop Algae Vats (20% +12/turn), Desal Brine Reclamation (5% +9/turn), Civic Identity Stack (0% +8/turn)

## Resources
| Resource | Stock (D) | Prod/turn | Cons/turn | Strategic? |
|---|---|---|---|---|
| pure_biomass | 740 (0) | 110 | 165 | y |
| potable_water_rights | 980 (0) | 140 | 155 | y |
| grid_stable_power | 620 (0) | 130 | 122 | y |
| structural_alloy_feedstock | 410 (0) | 58 | 64 | y |
| verified_technical_labor | 300 (0) | 24 | 20 | n |

## Diplomacy
- **relations:**
  | Power | Opinion (D) | Status |
  |---|---|---|
  | Helion Dome Compact | +5 (0) | neutral |
  | Brinewake Cartel | +12 (0) | neutral |
  | Aquifer Directorate | -8 (0) | wary |
  | Redline Security Front | -20 (0) | hostile |
  | Continuity Assembly | +3 (0) | neutral |
- **treaties:** none
- **opinion_modifiers:** none

## National Traits & Modifiers
- Closed-Loop Engineers - infrastructure and project efficiency +15% - permanent
- Population Overhang - pure_biomass consumption +12% until food capacity expanded - permanent

## Flags
biomass_deficit_watch
water_deficit_watch
alloy_deficit_watch

---

## Changelog
### Turn 0 - Late Dry Season Y0
- treasury: 420 -> 420 (0) - initialization baseline from nation-sheet
- income: 260 -> 260 (0) - initialization baseline from nation-sheet
- expenses: 245 -> 245 (0) - initialization baseline from nation-sheet
- net_balance: computed 0 cr/turn - (income 260 - expenses 245 + trade_balance -15)
- demographics, military, diplomacy, research, and resource rows initialized with zero deltas
- flags: biomass_deficit_watch, water_deficit_watch, alloy_deficit_watch
- adjustments: none
- conflicts: none
