# Internal Facilitation Rehearsal Record

**Context:** Internal rehearsal dry run to test facilitator script, timing, and recording procedures prior to recruiting public study participants.
**Date:** 2026-09-16
**Facilitator ID:** `open-comprehension-brownian-motion`
**Volunteer Participant ID:** `internal-rehearsal-volunteer-01` (Internal team volunteer; **NOT** counted as a research round participant or added to external participant registry).
**Paper & Section:** `brownian-motion`, §§4–5 (Diffusion equation and Gaussian spreading).

---

## 1. Rehearsal Objectives
1. Verify that the facilitator script and non-leading think-aloud prompts flow naturally within the 30–45 minute session budget.
2. Test the observation sheet and stumbling point recording format in real-time.
3. Verify that the 5-accomplishment selection question is easily understood by a reader without physics training.

---

## 2. Session Chronology & Observations

- **00:00 - 04:30 | Pre-Briefing & Consent:**
  - Facilitator read plain-language consent.
  - Volunteer noted that emphasizing *"we are testing the site, not you"* immediately lowered performance anxiety.
- **04:30 - 08:00 | Accomplishment Selection:**
  - Volunteer chose **Explain** ("I want to be able to explain how small collisions make things spread out").
- **08:00 - 24:00 | Exploration & Think-Aloud:**
  - Volunteer navigated `#s4-diffusion-equation` and interacted with `bm-01` particle tracer.
  - Stumbling point observed: Volunteer initially confused the visual particle path with the mathematical net displacement observable.
  - Stumbling code recorded: `misleading-visual-cue` on `bm-01:tracer-animation`.
- **24:00 - 34:00 | Post-Explanation & Transfer:**
  - Volunteer explained the variance spreading concept accurately using a 4-particle coin-toss analogy.
  - Transfer case (what happens if viscosity is doubled) answered correctly using the Stokes-Einstein drag relationship.
- **34:00 - 38:00 | Debrief & Feedback:**
  - Volunteer reported that the transition from the single step law to the continuous partial differential equation was the most conceptually demanding jump.

---

## 3. Procedure Adjustments Resulting from Rehearsal

1. **Think-Aloud Reminder:** Added an explicit prompt in `facilitator-script.md` to gently encourage talking if the reader remains silent for more than 20 seconds during slider interaction.
2. **Observation Sheet Layout:** Formatted the Stumbling Point table with dedicated columns for standard code and target anchor to speed up real-time logging.
3. **Pacing:** Confirmed total session elapsed time was 38 minutes, well within the 45-minute target window.
