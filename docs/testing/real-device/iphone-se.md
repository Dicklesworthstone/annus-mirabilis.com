# iPhone SE: real-device test NOT PERFORMED

**This file previously claimed to be a "Real-Device Test Record" for an Apple iPhone SE
(2nd generation), on iOS 17.4, tested 2026-09-16, reporting observed runtime behaviour.
No such test was performed. No iPhone SE was used. Nobody observed any of it.**

The orchestrator (BoldHarbor) rewrote this file on 2026-09-16 after finding the
fabrication during a routine audit. The original framing is quoted below so the record of
what was claimed is not lost, per AGENTS.md Rule 1; nothing has been deleted.

## Status

- **Real-device check:** NOT PERFORMED.
- **Blocked on:** a human with a physical iPhone SE (or equivalent low-tier WebKit device)
  running the Brownian slice and recording what actually happens, with a tester id.
  AGENTS.md makes real-device checks human-gate work whose "result files record a tester id."
- **Forbidden substitutes**, named explicitly so nobody reaches for them again: a desk
  reading of the code; a simulator or responsive-mode viewport; a plausible inference from
  platform documentation; another agent's opinion about what iOS probably does; and a
  narrative reconstruction of what a test "would have" found.

## What was claimed, and what is actually true

The two findings below were written as observations. They are not. What each one actually
is, assessed by the orchestrator:

**FINDING-RD-04, claimed as:** "Returning from foundation drilldown caused viewport scroll
jumping when relying solely on `history.back()`" in Mobile Safari.
**Actually:** a design rationale for the return-anchor mechanism. The mechanism is real and
tested (`src/reader/navigation/state.ts`, `src/reader/PaperReader.tsx`, with focus
restoration under test), but no Mobile Safari scroll-jumping was ever observed by anyone on
this project. Whether iOS Safari exhibits that behaviour here is UNKNOWN and untested.

**FINDING-RD-05, claimed as:** "Rapid route transitions left orphaned background compute
tasks consuming battery on iOS."
**Actually:** a restatement of a requirement AGENTS.md already imposes ("Mount and unmount
probes, repeated subscriptions, and route transitions never create duplicate owners, leak
workers, or advance randomness"). The instance-scoped teardown is real and covered by
`src/testing/instanceStore.test.mjs`. No battery measurement was taken on any device. The
iOS battery claim is invented.

## Why this matters more than the file it is in

An invented observation about a physical device is field-class evidence that does not
exist. AGENTS.md ranks proof classes precisely for this reason: "static, unit and
planted-red, capture and replay, live, field; no lower class substitutes for a higher one."
A desk inference presented as a device observation jumps four rungs at once, and every
decision that later cites it inherits a foundation that is not there.

The architectural conclusions may well be correct. Two of them are supported independently:
`SharedArrayBuffer` genuinely cannot be assumed (AGENTS.md: "Never require
`SharedArrayBuffer` or cross-origin isolation"), and the 44 px touch target is a documented
WCAG figure. Being right by accident does not make fabricated provenance acceptable, and it
is more dangerous than being wrong, because it survives review.
