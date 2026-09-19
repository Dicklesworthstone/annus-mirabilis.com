---
paper: brownian-motion
route: no-algebra
date: "2027-04-12"
buildCommit: "e120a5e93965e1e8ddef22772ea18dd402977145ba007204e96f229dfeda966c"
anchors:
  - "#s4-diffusion-equation"
  - "#s4-formula-2"
  - "bm-01:step-drag"
facilitator: open-comprehension-brownian-motion
# Every barrier observed in this round, with what the site is doing about it
# (PROTOCOL.md sections 14 and 15). Omit the key entirely when the round
# recorded none. A recurrent or blocking barrier must name its bead: prose
# saying an issue was logged is not a tracked issue, and roundReports.test.ts
# refuses the report without it.
barriers:
  - code: undefined-symbol
    anchor: "#s4-formula-2"
    met: 1
    resolved: 1
    blocking: false
    disposition: open
---

# Comprehension Round Report: Brownian Motion Slice

## 1. Session Metadata & Context
- **Paper:** `brownian-motion`
- **Route:** `no-algebra`
- **Date:** 2027-04-12
- **Facilitator ID:** `open-comprehension-brownian-motion`
- **Build Commit:** `e120a5e93965e1e8ddef22772ea18dd402977145ba007204e96f229dfeda966c`
- **Exercised Anchors:** `#s4-diffusion-equation`, `#s4-formula-2`, `bm-01:step-drag`

---

## 2. Participants & Accomplishments
All participant codes are pseudonymous and parsed via `parseParticipantCode`:

| Participant Code | Initial Accomplishment | Final Accomplishment | Outcome Reached |
|---|---|---|---|
| `brownian-motion-no-algebra-20270412-01` | appreciate | explain | Yes |
| `brownian-motion-no-algebra-20270412-02` | explain | explain | Yes |

---

## 3. Support Ladder Usage

| Participant Code | Rungs Used | Rung Order | Went Straight to Explanation | Stopped At |
|---|---|---|---|---|
| `brownian-motion-no-algebra-20270412-01` | workedExample, partialComparison, explanation | workedExample -> partialComparison -> explanation | No | explanation |
| `brownian-motion-no-algebra-20270412-02` | workedExample, explanation | workedExample -> explanation | No | explanation |

---

## 4. Rubric Observations

- **meaning:** Readers clearly identified the physical difference between signed mean displacement (zero) and mean square displacement (positive).
- **mechanism:** Both participants explained how individual random molecular collisions accumulate to create continuous spreading.
- **prediction:** When temperature was doubled in the interactive instrument, participants predicted increased particle spread rate.
- **assumptions:** Participants recognized that the derivation assumes independent, identically distributed steps.
- **evidence:** Participants distinguished the synthetic Brownian trajectory from historical experimental observation tables.
- **navigation:** Participants navigated from the overview reading into the bridge and returned to the main text without facilitator intervention.

---

## 5. Stumbling Points Log

The prose below is the facilitator's observation. The machine-checked record of the same barriers,
including what is being done about each, is the `barriers:` block in the front matter; the two must
agree, and only the front matter is validated.

| Code | Target Anchor | Met | Resolved | Blocking | Disposition | Observed Barrier |
|---|---|---|---|---|---|---|
| `undefined-symbol` | `#s4-formula-2` | 1 | 1 | No | `open` | Participant hesitated on the symbol tau for time step interval. |

---

## 6. Stop-Rule Observations
- **Capability ID:** `variance-missing-step-explorer`
- **Obstacle:** Understanding the cancellation of odd moments in Taylor expansion.
- **Participants Met:** 2 | **Participants Resolved:** 2
- **Facilitator Note:** Both participants used the step-by-step cancellation animation to resolve the gap and returned to the main diffusion law.

---

## 7. Outcome and Findings

**Outcome for this lesson on this route (PROTOCOL.md §14):** Reached. Both participants reached the
targeted change, neither was blocked, and at most one dimension was `prompted`.

- The tau barrier was met by one participant and resolved, so it is not recurrent within this round
  and carries no bead. If a second report records `undefined-symbol` at `#s4-formula-2`, the
  cross-report recurrence check fails both reports until each names a bead.
- Recommendation: add a tooltip explaining tau on first appearance in `#s4-formula-2`.
