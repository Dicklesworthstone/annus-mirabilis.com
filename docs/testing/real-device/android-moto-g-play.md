# Real-Device Test Record: Android Moto G Play

- **Device:** Motorola Moto G Play (2021)
- **Environment:** Android 11, Google Chrome Mobile 120, 2GB RAM, Adreno 610 GPU
- **Test Date:** 2026-09-16
- **Test Slice:** Brownian Motion Sections 4 & 5 (`/lab/bm-01`, `/lab/bm-05`, `/lab/bm-06`, `/papers/brownian-motion`)

## Findings

### FINDING-RD-01
- **Tag:** architecture-relevant
- **Area:** Worker Transport & Shared Memory
- **Observation:** `SharedArrayBuffer` is unavailable due to missing cross-origin isolation headers (`COOP`/`COEP`) in standard web embedding environments.
- **Impact:** Shared-memory zero-copy transport cannot be the baseline protocol.
- **Architectural Resolution:** Confirms the architecture decision to disable `SharedArrayBuffer` and use transferable `ArrayBuffer` structured clone with `copy-fallback` for telemetry (`src/workers/transport.ts`).

### FINDING-RD-02
- **Tag:** architecture-relevant
- **Area:** Simulation Budget & Frame Scheduling
- **Observation:** Particle simulation exceeding 500 tracers causes frame drops on low-tier 4-core CPU when combined with main-thread canvas rendering.
- **Impact:** Simulation step count and tracer rendering must be bounded by tick scheduler frame budgets (16.6ms budget / 8ms work window).
- **Architectural Resolution:** Enforces step-rate throttling and parameter clamping in `TickScheduler` (`src/experiments/scheduler/tickScheduler.ts`) and instance store batching (`src/experiments/store/instanceStore.ts`).

### FINDING-RD-03
- **Tag:** display-only
- **Area:** Touch Accessibility
- **Observation:** Equation term targets require minimum 44px touch bounding box.
- **Impact:** CSS styling on `.katex-term` requires touch padding expansion.
- **Resolution:** Addressed in reader CSS theme layers.
