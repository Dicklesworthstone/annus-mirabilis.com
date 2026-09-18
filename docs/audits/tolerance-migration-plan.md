# Tolerance Migration Plan (am-w0nt)

This document records the baseline census, classification, and ordered migration plan for hand-rolled relative comparisons across the repository, replacing the identifier-based probe (`EPSILON` or `/rel/i`) with syntactic shape detection of `Math.abs(<expr>) / <expr>` in `src/units/tolerance.test.ts`.

## 1. Baseline Census & Measurements (AC5)

- **Old Probe (Substring/Identifier probe)**:
  - Total flagged: 9
  - True positives: 7
  - False positives: 2
    - `src/physics/reference/events.ts:855`: `const betaRel = Math.abs(vRelRes.value);` (absolute value with no division; flagged purely on identifier substring `"rel"`)
    - `src/testing/fields.dipole.test.ts:28`: `expect(withinTolerance(Math.abs(B_eq.z), 8.0e-4, { relative: 1e-6 }).ok).toBe(true);` (legitimate use of `withinTolerance`; flagged because line contained both `Math.abs` and `relative:`)
  - Invisible hand-rolled comparisons missed: 37

- **New Detector (Syntactic / Shape probe: `Math.abs(<expr>) / <expr>`)**:
  - Catches hand-rolled relative comparisons regardless of identifier naming (`expect(Math.abs(x - ref) / ref)`, `const err = Math.abs(...) / ...`).
  - False positives on `betaRel` or `withinTolerance(...)`: 0 (AC4 satisfied).
  - Total existing baseline population: 43 occurrences across 23 files (all recorded in `BASELINE` in `src/units/tolerance.test.ts`).

---

## 2. Classification of Existing Population (AC2)

### A. Genuine Duplicates (Awaiting Migration to `withinTolerance`)
These 16 files (31 occurrences) perform ad-hoc relative error checks and should be migrated to `withinTolerance(actual, reference, spec)`:

1. **`src/experiments/bm02/session.test.ts` (8 occurrences)**:
   - Lines 19, 25, 31, 36, 58, 61, 150, 152: `expect(Math.abs(val - expected) / expected).toBeLessThan(tol)`
   - Migration: Replace with `expect(withinTolerance(val, expected, { relative: tol }).ok).toBe(true)`.

2. **`src/experiments/lq04/session.test.ts` (1 occurrence)**:
   - Line 150: `const relativeDisagreement = Math.abs(withC.deltaSWithC - evaluation.radiationEntropy) / Math.abs(evaluation.radiationEntropy)`
   - Migration: Replace with `withinTolerance(withC.deltaSWithC, evaluation.radiationEntropy, ...)` check.

3. **`src/physics/reference/fields.sr02.test.ts` (1 occurrence)**:
   - Line 49: `expect(Math.abs(naive - gmo.value) / gmo.value).toBeGreaterThan(0.1)`
   - Migration: Use `withinTolerance` outside/mismatch assertion.

4. **`src/physics/reference/fields.ts` (3 occurrences)**:
   - Line 1649: `const quadratureError = Math.abs(totalChargeQuadrature - totalChargeAnalytic) / totalChargeAnalytic`
   - Lines 1828, 1829: `const relErrorDx = Math.abs(...) / scaleDx`, `relErrorDt`
   - Migration: Use `withinTolerance` to evaluate consistency and attach typed `ScientificResult`.

5. **`src/physics/reference/massEnergy.coefficient.test.ts` (2 occurrences)**:
   - Lines 87, 97: `Math.abs(val(naive) - series) / series`, `Math.abs(val(naive) - 5e-17) / 5e-17`
   - Migration: Migrate to `withinTolerance`.

6. **`src/physics/reference/massEnergy.pulses.test.ts` (2 occurrences)**:
   - Lines 84, 91: `const relErr = Math.abs(sum - expectedSum) / expectedSum`, `compRelErr`
   - Migration: Migrate to `withinTolerance`.

7. **`src/testing/bm04.reference.test.ts` (2 occurrences)**:
   - Lines 124, 186: `expect(Math.abs(...) / expected).toBeLessThan(...)`
   - Migration: Migrate to `withinTolerance`.

8. **`src/testing/diffusion.driftDiffusion.test.ts` (2 occurrences)**:
   - Lines 144, 229: `Math.abs(...) / Math.max(...)`
   - Migration: Replace with `withinTolerance(..., { relative: 1e-14, relativeTo: "larger" })`.

9. **`src/testing/events.clocks.test.ts` (1 occurrence)**:
   - Line 148: `const naiveRelDiff = Math.abs(naiveLoss - referenceLossPerSecond) / referenceLossPerSecond`
   - Migration: Migrate to `withinTolerance`.

10. **`src/testing/fields.dipole.test.ts` (2 occurrences)**:
    - Lines 51, 143: `const relDiv = Math.abs(divB) / scale`, `naiveRelErr`
    - Migration: Migrate to `withinTolerance`.

11. **`src/testing/fields.sr12.test.ts` (2 occurrences)**:
    - Lines 157, 277: `Math.abs(Q_mov - Q_stat) / Q_stat`, `invPrime.si - inv0.si / maxScale`
    - Migration: Migrate to `withinTolerance`.

12. **`src/testing/kinematics/kinematics.composition.test.ts` (2 occurrences)**:
    - Lines 38, 39: `naiveError`, `helperError`
    - Migration: Migrate to `withinTolerance`.

13. **`src/testing/kinematics/kinematics.factors.test.ts` (1 occurrence)**:
    - Line 63: `naiveError`
    - Migration: Migrate to `withinTolerance`.

14. **`src/testing/kinematics/kinematics.velocity.test.ts` (1 occurrence)**:
    - Line 51: `naiveSize`
    - Migration: Migrate to `withinTolerance`.

15. **`src/testing/scenarios/discrimination.test.ts` (1 occurrence)**:
    - Line 50: `expect(Math.abs(f - r) / f).toBeCloseTo(1.767e-8, 2)`
    - Migration: Migrate to `withinTolerance`.

---

### B. Legitimate Calculations & Non-Tolerance Logic (Candidates for Individual Review/Allowlisting)
These 7 files (12 occurrences) compute physical formulas, quadrature error estimates, or UI plotting coordinates rather than duplicate tolerance comparisons:

1. **`src/components/lab/CoefficientLab.tsx` (1 occurrence)**:
   - Line 70: `(Math.abs(value) / peak) * 200`
   - Reason: Normalization of SVG curve coordinates to 200px plot height.

2. **`src/components/lab/DriftDiffusionPlots.tsx` (2 occurrences)**:
   - Lines 176, 177: `(Math.abs(driftFlux) / maxFlux) * 180`, `diffFlux`
   - Reason: Canvas bar width scaling proportional to maximum flux.

3. **`src/physics/energyLedger.ts` (1 occurrence)**:
   - Line 311: `const ratio = Math.abs(diff1) / Math.max(1e-15, Math.abs(diff2))`
   - Reason: Timestep error convergence ratio estimation for adaptive solver order.

4. **`src/physics/reference/electron.ts` (3 occurrences)**:
   - Lines 647, 680, 737: `Math.abs(vx) / C_SI`
   - Reason: Computation of dimensionless relativistic velocity parameter $\beta = |v|/c$.

5. **`src/physics/reference/events.ts` (1 occurrence)**:
   - Line 753: `const estimatedError = Math.abs(fine.tau - coarse.tau) / 15`
   - Reason: Richardson extrapolation step-doubling error estimate ($2^4 - 1 = 15$) in Runge-Kutta integrator.

6. **`src/physics/reference/photoelectric.ts` (1 occurrence)**:
   - Line 435: `const fraction = 1 - Math.abs(collectorPotentialVolts) / vs`
   - Reason: Physical linear stopping potential fraction calculation.

7. **`src/physics/reference/waves.phase.test.ts` (2 occurrences)**:
   - Lines 37, 38: `Math.abs(normOrig) / (omega / c) ** 2`
   - Reason: Dimensionless 4-vector norm invariant verification normalized by wavevector squared.

8. **`src/reasoning/countermodel/render.ts` (1 occurrence)**:
   - Line 58: `Math.abs(sample.residual) / sample.allowed`
   - Reason: Ranking countermodel samples by normalized violation ratio for display.

---

## 3. Transition Policy & Ratchet Rules

1. **Ratchet Baseline**: The baseline in `src/units/tolerance.test.ts` defines the maximum allowed occurrences per file.
2. **Monotonic Shrinkage**: When an engineer or agent migrates a file to `withinTolerance`, they must decrease or remove that file's entry in `BASELINE`. The baseline count may never increase.
3. **Gate Enforcement**: Any file not listed in `BASELINE` (or any listed file exceeding its allotted count) fails `tolerance.test.ts` immediately.
4. **Permanent Allowlist Integrity**: The permanent `allowlist` remains strictly capped at the two earned entries:
   - `src/physics/reference/special/erf.ts`
   - `src/experiments/bm07/trajectoryCsv.ts`
