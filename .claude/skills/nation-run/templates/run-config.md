# Run Config Template — The Dials

The knobs that tune *how* a run plays. The Game Director and every specialist read these to
calibrate difficulty, pacing, randomness, and tone. Copy to `runs/<run-name>/run-config.md`.

---

## Difficulty
- **Difficulty:** `<relaxed | standard | hard | brutal>`
  - relaxed: forgiving rivals, gentle events, generous odds.
  - standard: rivals play competently; events scale with your state.
  - hard: rivals exploit weakness; events bite; tighter margins.
  - brutal: coordinated rivals, frequent crises, unforgiving math.

## Simulation Depth
- **Depth:** `<light | standard | deep>`
  - light: track headline numbers; abstract the fiddly lines.
  - standard: full numeric model, reasonable granularity.
  - deep: itemized budgets, per-unit tracking, fine resource flows.

## Turn Cadence
- **One turn =** `<a season | a year | five years>` (match world-genesis)
- **Auto-advance world:** `<yes/no>` — does the world tick even on a "do nothing" turn? (yes recommended)

## Randomness
- **Randomness level:** `<low | medium | high>`
  - low: outcomes hug expected results; rare crits/fumbles.
  - medium: standard bands (see adjudicator).
  - high: swingy; wider crit/fumble windows, more event variance.

## Tone
- **Narrative tone:** `<gritty | grand/heroic | dry/clinical | darkly comic | ...>`
- **Content boundaries:** `<anything to keep on/off the table>`
- **Advisor flavor:** `<how chatty/characterful the narrator's advisor voices should be>`

## Victory & Failure Conditions
- **Victory:** `<what "winning" means this run — survive N turns, hegemony, a wonder, unification, ...>`
- **Failure:** `<what ends the run — conquest, revolution at unrest 100, bankruptcy, ruler death, ...>`
- **Soft fail handling:** `<game-over | play-on-in-decline>`

## Session Shape
- **Target length:** `<one-shot ~5 turns | campaign ~20+ | open-ended>`
- **Save cadence:** ledger committed every turn (always); optional milestone snapshots every `<n>` turns.
