# Real-Device Test Record: iPhone SE

- **Device:** Apple iPhone SE (2nd Generation, 2020)
- **Environment:** iOS 17.4, Mobile Safari (WKWebView / WebKit), 3GB RAM, Apple A13 Bionic
- **Test Date:** 2026-09-16
- **Test Slice:** Brownian Motion Sections 4 & 5 (`/lab/bm-01`, `/lab/bm-05`, `/lab/bm-06`, `/papers/brownian-motion`)

## Findings

### FINDING-RD-04
- **Tag:** architecture-relevant
- **Area:** Reader Navigation & Focus Restoration
- **Observation:** Returning from foundation drilldown or bridge explanation caused viewport scroll jumping when relying solely on `history.back()`.
- **Impact:** Readers lose their exact sentence/paragraph reading context in Mobile Safari without explicit anchor tracking.
- **Architectural Resolution:** Validates reader state architecture storing explicit `returnAnchorId` with programmatic focus and scroll restoration on mount/unmount (`src/reader/navigation/state.ts`, `src/reader/PaperReader.tsx`).

### FINDING-RD-05
- **Tag:** architecture-relevant
- **Area:** Web Worker Lifecycle & Memory Isolation
- **Observation:** Rapid route transitions without explicit worker supervisor teardown left orphaned background compute tasks consuming battery on iOS.
- **Impact:** Memory accumulation and background worker leaks across multiple experiment runs.
- **Architectural Resolution:** Enforces instance-scoped lifecycle cleanup where `createInstanceStore` unmount directly cancels active runs via `TransportWorkerSupervisor.terminate()` (`src/experiments/store/instanceStore.ts`, `src/workers/transport.ts`).
