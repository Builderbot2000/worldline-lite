# I/O Conventions — How the Agents Interoperate

Subagents are **stateless** and communicate only through **text returned to the Game Director**.
These are the fixed text contracts that let a stateless team run a consistent simulation without
any code. All field names come from [`numeric-model.md`](numeric-model.md).

There are three blocks: **Delta Block** (specialists → director), **Roll Request / Result**
(specialist ↔ adjudicator, via director), and **Commit Block** (ledger-keeper → canonical state).

---

## 1. Delta Block — proposing state changes

Any specialist that wants to change state returns a fenced `delta` block. It **proposes**; it
never commits. One line per change: `field: signed-amount (reason)`. Use dotted paths for nested
fields (units, relations, resources).

````
```delta
treasury: -250 (built grain silos)
resources.grain.stock: +1200 (harvest + new silos)
approval: +4 (food security reassures the public)
units.2nd_levy.readiness: +15 (winter drills)
relations.Veska.opinion: -8 (border incident)
flags: famine_risk_cleared
```
````

Rules:
- **Signed amounts only** for numeric fields (`+`/`-`). For list/roster adds or removes, write
  `units.+coastal_guard: {type: infantry, qty: 2000, equipment_tier: 2, readiness: 60}` or
  `treaties.-veska_nonaggression: expired`.
- **Every line needs a parenthetical reason** — it becomes the changelog and the audit trail.
- `flags:` lines record non-numeric events/state the lorekeeper or future turns should know.
- Specialists do **not** clamp or cross-check against other fields — that's the ledger-keeper's
  job. Just report your domain's deltas.

---

## 2. Roll Request / Result — resolving uncertainty

When an outcome is uncertain, the requesting specialist (or the director) sends the adjudicator a
**Roll Request**. The adjudicator returns a **Roll Result**. Nothing is random until the
adjudicator rolls — specialists must not invent results.

**Request** (what the director passes into the adjudicator):
````
```roll-request
action: Storm the river fort before reinforcements arrive
base_difficulty: hard            # trivial|easy|fair|hard|severe|forlorn
modifiers:
  + doctrine tier 4 (+15)
  + local guide / surprise (+10)
  - river crossing under fire (-20)
  - defender fortified, tier 3 (-15)
stakes: control of the crossing; failure costs ~15% of the assault force
```
````

**Result** (what the adjudicator returns):
````
```roll-result
odds: ~45% success (net modifier -10 on a fair baseline)
roll: 1d100 = 63   (rolled via Bash $RANDOM)
threshold: ≤45 success
tier: PARTIAL        # CRIT | SUCCESS | PARTIAL | FAIL | FUMBLE
result: The fort falls but at heavy cost; the garrison fires the bridge as they retreat.
suggested_deltas: see military/world-sim to translate this into a delta block
```
````

Outcome tiers (the adjudicator picks the band from the roll vs threshold):
- **CRIT** — roll far beats threshold (or natural ≤5): success + bonus.
- **SUCCESS** — roll meets threshold cleanly.
- **PARTIAL** — near miss / barely made it: succeeds with a cost or complication.
- **FAIL** — misses: the action doesn't achieve its goal.
- **FUMBLE** — roll far misses (or natural ≥96): failure + extra setback.

The adjudicator **judges**; the requesting specialist then writes the resulting `delta` block.

---

## 3. Commit Block — the ledger-keeper applies changes

The ledger-keeper is the **only** agent that writes canonical state. It collects all proposed
`delta` blocks for the turn, validates them, applies them to `state-ledger.md`, and returns a
**Commit Block** summarizing what changed and any corrections it had to make.

````
```commit
turn: 7
applied:
  treasury: 1,240 → 990 (-250)
  resources.grain.stock: 3,400 → 4,600 (+1,200)
  approval: 58 → 62 (+4)
  units.2nd_levy.readiness: 45 → 60 (+15)
  relations.Veska.opinion: 12 → 4 (-8)
adjustments:
  - unrest delta -30 requested but floor is 0; clamped 22 → 0 (-22 effective)
  - rejected: treasury -250 AND -300 double-counted the silo cost; kept one
flags_set: [famine_risk_cleared]
conflicts: none
new_snapshot: runs/<run>/state-ledger.md updated; changelog appended
```
````

Validation duties (the consistency guard):
- **Bounds**: clamp 0–100 fields, tier ranges, non-negative stocks; surface what was clamped.
- **Conservation**: manpower drawn can't exceed `manpower_pool`; spend can't exceed `treasury` +
  available `debt` capacity; population changes reconcile with demographics.
- **De-duplication**: two specialists charging for the same thing get merged once.
- **Cascade to Crisis**: if a clamp implies an overflow (unrest hits 100, treasury underwater
  with no debt room), set a `flags:` entry so the next World Tick raises a Crisis.

If anything is irreconcilable, the ledger-keeper does **not** guess — it returns a `conflicts:`
note and the director re-queries the relevant specialist.
