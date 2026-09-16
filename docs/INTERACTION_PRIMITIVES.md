# Interaction Primitives & Accessible Action Families

This document specifies the six reusable interaction families across Annus Mirabilis instruments, their visual and nonvisual equivalence contracts, and the exported parity test harness.

---

## 1. The Six Interaction Families

Every interaction in an instrument manifest belongs to one of the six standard families. No instrument may invent private or unclassified controls.

| Family ID | Scientific Domain | Visual Form | Equivalent Accessible Form | First Consumers |
|---|---|---|---|---|
| `clock-event` | Clock and event geometry | Select points on diagram | Choose named events from table, inspect frame simultaneity | SR-01, SR-03 |
| `radiation-entropy` | Radiation entropy | Resize constrained-state volume slider | Enter ratio ($V/V_0$) or select half/same/double presets with fixed energy and band | LQ-04 |
| `fields-boosts` | Fields, boosts, candidate maps | Rotate arrow / drag handle | Select component/axis, type signed magnitude, inspect transformed components | SR-04, SR-08 |
| `energy-accounting` | Energy accounting & mass | Drag boundary around objects | Select included system members checklist, inspect boundary energy flux & mass | ME-03 |
| `derivations` | Derivation chains & algebra | Highlight clickable equation terms | Select named subexpression, read role, trigger "Advance Justified Step" | ME-01, SR-04 |
| `probability-diffusion` | Probability & diffusion | Drag interval bracket handles | Stepper / numeric min-max text inputs with named presets | BM-01, LQ-05 |

---

## 2. Shared Invariants

1. **Stamp Requirement:** Every shared primitive root element carries `data-interaction-family="<family id>"`.
2. **Typed Actions:** Visual and nonvisual interaction paths emit identical `TypedActionPayload` records containing `instrumentId`, `actionId`, `inputs`, and `commandClass`.
3. **No Drag-Only Actions:** Drag-only gestures without an actionable accessible alternative are strictly forbidden and rejected by `checkAccessibleEquivalence` with `drag-only-action-forbidden`.
4. **Live Region Announcements:** Exactly one announcement per committed action is rendered to an accessible live region (`aria-live="polite"`).

---

## 3. The LQ-05 Decision

**Decision:** LQ-05 (*Independent Configurations*) is **not** a `PartitionControl` consumer.
- **Rationale:** LQ-05 presents independent molecules distributed in a volume and asks for the probability that all $n$ particles occupy a subvolume fraction $f$. It is a spatial probability question over the interval $[0, f]$ of the box.
- `PartitionControl` is specifically reserved for constrained-state entropy comparisons at fixed total energy $E$ and frequency band $\Delta\nu$ (first consumer: LQ-04).
- LQ-05 uses the base `probability-diffusion` interval family.

---

## 4. Exported Parity Suite Contract

The parity suite (`src/experiments/interactions/parity.suite.ts`) provides a unified test runner:
- `familyParityCases(family, { owner, ownerSource, ownerLabel, mode })`
- `ownerSource` (`"reference-evaluator"` or `"runtime-fixture"`) and `ownerLabel` are required arguments.
- In `mode: "consumer"`, any run citing `ownerSource: "runtime-fixture"` throws a fixture guard error, enforcing that consumers run parity against real physics owners.
