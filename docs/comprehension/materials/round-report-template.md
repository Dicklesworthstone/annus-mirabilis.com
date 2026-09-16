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

| Code | Target Anchor | Observed Barrier |
|---|---|---|
| `undefined-symbol` | `#s4-formula-2` | Participant hesitated on the symbol tau for time step interval. |

---

## 6. Stop-Rule Observations
- **Capability ID:** `variance-missing-step-explorer`
- **Obstacle:** Understanding the cancellation of odd moments in Taylor expansion.
- **Participants Met:** 2 | **Participants Resolved:** 2
- **Facilitator Note:** Both participants used the step-by-step cancellation animation to resolve the gap and returned to the main diffusion law.

---

## 7. Findings & Tracked Issues
- Issue logged for notation clarity on time interval tau: bead link `am-bm-slice-notation-tau-fix`.
- Recommendation: Add a tooltip explaining tau on first appearance in `#s4-formula-2`.
