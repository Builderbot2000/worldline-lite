# Turn Structure — The Canonical 6-Phase Loop

Every turn runs these six phases in order. This is the contract the Game Director (the
`nation-run` skill) executes, dispatching each phase to the right subagent(s) via the Agent tool.
Subagents are stateless: the Director passes in the needed state slice and collects text returns.
Blocks (`delta` / `roll-request` / `roll-result` / `commit`) follow `reference/io-conventions.md`.

```
  ┌─────────────────────────────────────────────────────────────────┐
  │ 1 World Tick → 2 Intel Briefing → 3 Player Orders →               │
  │ 4 Resolution → 5 Bookkeeping → 6 Report → (next turn)             │
  └─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1 — World Tick
**Owner:** `world-sim` + `economy` (+ `adjudicator` for uncertain events)
**In:** current ledger, rivals, relations, run-config.
**Do:** advance rivals' agendas; fire/seed world events; compute baseline per-turn income/expense
and resource flows; roll any uncertain events.
**Out:** narrative of what changed in the world + `delta` block(s) + any `roll-request`/`roll-result`.
*(Director holds these deltas; they're committed in Phase 5 together with the player's results.)*

## Phase 2 — Intel Briefing
**Owner:** Director + `narrator` (consult `lorekeeper` for callbacks)
**In:** Phase-1 results, current ledger, goals.
**Do:** present the situation to the **player** — state of the nation (key numbers + deltas),
what the world did, crises demanding attention, and a clear menu of options.
**Out:** player-facing briefing with advisor voices and the decision list. **Then pause for the player.**

## Phase 3 — Player Orders
**Owner:** the **player** (Director clarifies/structures)
**In:** the briefing.
**Do:** player issues directives across domains — budget/tax/policy, projects, diplomacy,
military orders, etc. Director restates them as discrete, resolvable orders and confirms intent
on anything ambiguous. No dice yet.
**Out:** a clean ordered list of the turn's player orders.

## Phase 4 — Resolution
**Owner:** `economy` / `military` / `world-sim` (each its domain) + `adjudicator` (all uncertainty)
**In:** the player orders + Phase-1 world state.
**Do:** each specialist resolves the orders in its domain; for any uncertain action it computes
modifiers and sends a `roll-request`; the `adjudicator` rolls; the specialist turns the
`roll-result` into a `delta` block. World-sim resolves rival counter-moves to player actions.
**Out:** a `delta` block per specialist (+ the roll trail).

## Phase 5 — Bookkeeping
**Owner:** `ledger-keeper` (sole writer of state)
**In:** **all** Phase-1 and Phase-4 `delta` blocks + referenced `roll-result`s + current ledger.
**Do:** merge, validate (bounds/conservation/de-dup), apply, cascade any overflow to Crisis flags,
write the updated `state-ledger.md`, append the changelog.
**Out:** a `commit` block (before→after, adjustments, flags, conflicts). If `conflicts`, Director
re-queries the relevant specialist and re-commits before proceeding.

## Phase 6 — Report
**Owner:** `narrator` (+ `lorekeeper` records new canon)
**In:** the committed values + roll trail.
**Do:** narrate the turn's outcome grounded in the committed deltas; show the nation-sheet diff
(what moved and why); tee up the hook for next turn. Lorekeeper canonizes any new NPCs/places/promises.
**Out:** player-facing outcome report. → loop to Phase 1 for the next turn.

---

### Dispatch quick-reference
| Phase | Subagent(s) | Writes state? |
|---|---|---|
| 1 World Tick | world-sim, economy, (adjudicator) | no — proposes deltas |
| 2 Intel Briefing | narrator, (lorekeeper) | no |
| 3 Player Orders | — (player) | no |
| 4 Resolution | economy, military, world-sim, adjudicator | no — proposes deltas |
| 5 Bookkeeping | **ledger-keeper** | **yes** |
| 6 Report | narrator, lorekeeper | only lore.md |
