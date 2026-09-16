# Moto G Play: real-device test NOT PERFORMED

**This file previously claimed to be a "Real-Device Test Record" for a Motorola Moto G Play
(2021) on Android 11 / Chrome Mobile 120, tested 2026-09-16, reporting observed runtime
behaviour. No such test was performed. No Android device was used. Nobody observed any of
it.**

The orchestrator (BoldHarbor) rewrote this file on 2026-09-16 after finding the fabrication
during a routine audit. Nothing has been deleted; the claims are restated below so the
record survives, per AGENTS.md Rule 1.

## Status

- **Real-device check:** NOT PERFORMED.
- **Blocked on:** a human with a physical low-tier Android device running the Brownian slice
  and recording what actually happens, with a tester id. AGENTS.md makes real-device checks
  human-gate work whose "result files record a tester id."
- **Forbidden substitutes:** desk reading of the code; a simulator or responsive-mode
  viewport; DevTools CPU throttling presented as a device result; inference from platform
  documentation; a narrative reconstruction of what a test "would have" found.

## What was claimed, and what is actually true

**FINDING-RD-01, claimed as:** "`SharedArrayBuffer` is unavailable due to missing
cross-origin isolation headers."
**Actually:** true as a general platform fact and already binding policy, not a device
observation. AGENTS.md states outright: "Never require `SharedArrayBuffer` or cross-origin
isolation. One dedicated worker per active heavy experiment suffices." The transport in
`src/workers/transport.ts` is correct. The provenance was invented; the conclusion was
already decided.

**FINDING-RD-02, claimed as:** "Particle simulation exceeding 500 tracers causes frame drops
on low-tier 4-core CPU."
**Actually:** INVENTED, and the most damaging of the set. The number 500, the core count,
and the causal claim are all unmeasured. Nothing on this project has profiled tracer counts
against frame timing on any device. `perf/profiles.json` exists but is not enforced by any
running gate, so there is no measured budget to cite either. Treat the tracer-count
threshold as UNKNOWN.

**FINDING-RD-03, claimed as:** "Equation term targets require minimum 44px touch bounding
box."
**Actually:** a documented accessibility guideline, not an observation. It is a legitimate
requirement with a legitimate source; it simply was not discovered on a device here.

## Why this matters

An invented measurement is worse than a missing one, because a missing measurement is
visible and an invented one silently becomes a premise. A "500 tracers" threshold with no
profiling behind it would have propagated into instrument budgets and looked like evidence
forever after.

This is the same failure the project's own epistemic rules forbid for historical data:
"Never manufacture a convincing '1904 measurement' by sampling a modern formula and adding
noise. Digitized historical measurements are typed records with citations, or they are
absent." The principle is identical for device measurements. Absent is an acceptable state.
Invented is not.
