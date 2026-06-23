# Turn 1 — Spring, Year 1 (worked example)

A full turn of "The March of Haldmark," showing how the Game Director drives the six phases and
how the subagents talk via the I/O blocks. Read this alongside
[`turn-structure.md`](../../../.claude/skills/nation-run/templates/turn-structure.md). The
resulting committed state is in [`state-ledger.md`](../state-ledger.md).

---

## Phase 1 — World Tick  · (dispatched to `world-sim`, `economy`, `adjudicator`)

**world-sim →** *Veska continues massing levies along the Veil; scouts report a new muster camp.
No attack yet — pressure, not war.* Proposes:
```delta
relations.Veska.opinion: -5 (Veska masses levies near the Veil)
flags: veska_mobilizing
```

**economy →** baseline season: income 480 / expenses 410 (net +70). Flags a weather risk on the
spring grain and asks for a roll:
```roll-request
action: Spring grain harvest in a cold year
base_difficulty: fair
modifiers:
  - unusually cold spring (-20)
stakes: a poor harvest cuts grain production this turn
```

**adjudicator →**
```roll-result
odds: ~40% for a normal harvest (fair 60 - 20)
roll: 1d100 = 58   (rolled via Bash: echo $((RANDOM % 100 + 1)))
threshold: ≤40 normal
tier: PARTIAL
result: A cold snap nips the early planting — a noticeably thinner harvest, not a famine.
```

**economy →** translates the PARTIAL into:
```delta
resources.grain.stock: -110 (cold spring: production ~750 vs consumption 860)
```

*Director holds all Phase-1 deltas for Phase 5.*

---

## Phase 2 — Intel Briefing  · (dispatched to `narrator`, with `lorekeeper` callback)

**narrator →**

> **Saltgate, the Warden's hall, first thaw.** The Veil has not frozen hard this year, and
> neither have Veska's ambitions. Riders bring word of a fresh muster camp across the water.
>
> *Spymaster Orla:* "They're not coming this season, my lord — but they're counting our spears."
> *Reeve Caddoc (Treasury):* "Coffers hold: twelve hundred crowns, and we run a small surplus.
> The cold's bitten the barley, though. We'll feel it by autumn."
> *Marshal Brett:* "The Veil line is bare. Earthworks there would change Veska's arithmetic."
>
> **The Council awaits your orders, Warden.** On the table: the open Veil frontier, a thin
> harvest, and the Adran League — rich, cautious, and not yet our friend.

*(lorekeeper confirms Orla, Caddoc, Brett, and Marshal as established Council NPCs.)*

---

## Phase 3 — Player Orders

The player declares; the Director restates them as discrete orders:
1. **Crash-fund bastion earthworks at the Veil** — allocate 200 cr to the Bastion Fortification track.
2. **Send an envoy to the Adran League** proposing a trade pact (outcome uncertain → roll).
3. **Raise the Saltgate harbor tariff** to shore up income.

---

## Phase 4 — Resolution  · (`economy`, `world-sim`, `adjudicator`)

**economy — Order 1 (bastion works):**
```delta
treasury: -200 (crash-funding Veil bastion earthworks)
research.Bastion_Fortification: +25 (concentrated season of works)
resources.timber.stock: -80 (timber drawn for earthworks)
```

**economy + world-sim — Order 2 (Adran envoy):** uncertain → roll.
```roll-request
action: Persuade the Adran League to sign a trade pact
base_difficulty: fair
modifiers:
  + standing goodwill, opinion +15 (+10)
  + we offer Saltgate harbor access (+5)
  - League wary of entanglement against Veska (-15)
stakes: a trade pact (income + relations); failure costs a little face
```
```roll-result
odds: ~60% (fair 60, net 0)
roll: 1d100 = 63   (rolled via Bash)
threshold: ≤60 success
tier: PARTIAL
result: The League signs a *trade* pact and opens its ports — but strikes out every defensive clause.
```
**world-sim →** translates the PARTIAL:
```delta
income: +40 (Adran trade pact)
trade_balance: +40 (Adran trade pact)
relations.Adran.opinion: +10 (pact signed)
relations.Adran.status: friendly (was neutral)
treaties.+adran_trade_pact: {type: trade, terms: mutual port access, no defense clause, expiry: T9}
```

**economy — Order 3 (tariff):**
```delta
income: +30 (Saltgate tariff raised)
trade_balance: -10 (tariff dampens volume)
approval: -3 (merchants grumble)
unrest: +3 (tariff resented in the port wards)
```
*(The narrator's "good news" of the pact offsets +2 approval — netted by the ledger-keeper.)*

---

## Phase 5 — Bookkeeping  · (`ledger-keeper`)

The Director hands **all** Phase-1 + Phase-4 deltas to the ledger-keeper:
```commit
turn: 1
applied:
  treasury: 1,200 → 1,070 (-130)        # base net +70, less 200 crash-funding
  income: 480 → 550 (+70)               # +40 pact, +30 tariff
  trade_balance: +60 → +90 (+30)        # +40 pact, -10 tariff
  approval: 58 → 57 (-1)                 # -3 tariff, +2 pact news (netted)
  unrest: 22 → 25 (+3)
  research.Bastion_Fortification: 0% → 25% (+25)
  resources.grain.stock: 3,000 → 2,890 (-110)
  resources.timber.stock: 1,400 → 1,420 (+20)   # +100 growth - 80 works
  resources.iron.stock: 600 → 580 (-20)         # ongoing deficit
  relations.Veska.opinion: -25 → -30 (-5)
  relations.Adran.opinion: +15 → +25 (+10); status → friendly
  treaties: + adran_trade_pact (expiry T9)
adjustments:
  - economy double-listed the bastion cost (project expense line + one-time charge); kept the one-time 200 cr only
flags_set: [veska_mobilizing, iron_deficit_watch]
conflicts: none
new_snapshot: runs/_example/state-ledger.md updated; changelog appended
```

---

## Phase 6 — Report  · (`narrator`, `lorekeeper` records canon)

**narrator →**

> The spades broke ground along the Veil before the mud had dried; by the equinox a raw line of
> earthworks frowns across the water at Veska's camp — *and they have noticed.* Their envoy's
> smile in Saltgate was thinner this season.
>
> Southward, better news: Adran ships now ride into the harbor under a signed pact, and customs
> coin follows them. The higher tariff bites the port wards, though — Reeve Caddoc warns of
> "mutterings on the Saltgate quays." And autumn's grain will run lean.
>
> **The diff:** treasury 1,200 → **1,070** (works); income 480 → **550** (pact + tariff);
> Adran **neutral → friendly**; Veska opinion **−25 → −30**; unrest **22 → 25**; grain falling.
>
> **Next season:** Veska keeps mustering (war-ready ~T6). The Veil line is begun, not finished.
> Do you press the fortifications, court the Kelsdar as a northern buffer, or address the
> grumbling on the quays before unrest hardens?

*(lorekeeper appends to `lore.md`: "T1 — Adran Trade Pact signed (trade only, expires T9). Veska
mobilization confirmed at the Veil.")*

→ **Loop to Phase 1, Turn 2.**
