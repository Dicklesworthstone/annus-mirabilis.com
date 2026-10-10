/**
 * ROW 10: "A moving mirror receives the fixed-surface incident power"
 * (am-ver-adversarial-audit-1ef).
 *
 * A mirror receding at beta sweeps out less radiation per unit time than a stationary one, so the
 * intercepted power is I*Am*(1 - beta). The row asks that the intercepted power, the reflected
 * power and the mechanical work Fv "balance together", and that I*Am does not -- so the check is on
 * the LEDGER, not on any single quantity. That is the right shape: each term alone can be made to
 * look reasonable, and only the balance catches the substitution.
 */

import { expect, test } from "bun:test";
import { movingMirror } from "../../physics/reference/waves.ts";
import { wrongFixedSurfaceIncidentPower } from "./wrongComputations.ts";

const BETA = 0.3;
const INTENSITY = 1000;
const AREA = 2;
/** Normal incidence, so the geometry contributes nothing and the sweep factor is isolated. */
const PHI = 0;

function ledger() {
  const out = movingMirror(BETA, PHI, { Am: AREA, u: INTENSITY });
  expect(out.status).toBe("value");
  if (out.status !== "value") throw new Error("owner refused");
  return out;
}

test("the owner's ledger balances: intercepted = reflected + mechanical work", () => {
  const m = ledger();
  expect(m.incidentPower).toBeCloseTo(m.reflectedPower + m.workRate, 6);
  // Its own residual says so too, to within floating point.
  expect(Math.abs(m.energyBalanceResidual)).toBeLessThan(1e-9);
  // Measured: 1400 = 753.846... + 646.153...
  expect(m.incidentPower).toBeCloseTo(1400, 9);
  expect(m.reflectedPower).toBeCloseTo(753.8461538461539, 9);
  expect(m.workRate).toBeCloseTo(646.153846153846, 9);
});

test("the intercepted power is I*Am*(1 - beta), which is what makes the sweep visible", () => {
  const m = ledger();
  expect(m.incidentPower).toBeCloseTo(INTENSITY * AREA * (1 - BETA), 9);
  // And the fixed-surface value is a different number: 2000 against 1400.
  expect(wrongFixedSurfaceIncidentPower(INTENSITY, AREA)).toBeCloseTo(2000, 9);
});

test("the WRONG power breaks the LEDGER, by exactly I*Am*beta", () => {
  const m = ledger();
  const wrong = wrongFixedSurfaceIncidentPower(INTENSITY, AREA);
  const residual = wrong - (m.reflectedPower + m.workRate);
  expect(residual).not.toBeCloseTo(0, 6);
  // 600 = 1000 * 2 * 0.3, so the shortfall is the swept fraction and not an arbitrary mismatch.
  expect(residual).toBeCloseTo(INTENSITY * AREA * BETA, 6);
});

test("beta = 0 is the degenerate case, documented so nobody tests there", () => {
  // The fourth coincidence in this audit, after row 7's 90 degrees, row 14's n = 1 and row 8's
  // rest frame: a mirror at rest DOES receive I*Am, so a fixture at beta = 0 passes under both.
  const atRest = movingMirror(0, PHI, { Am: AREA, u: INTENSITY });
  expect(atRest.status).toBe("value");
  if (atRest.status !== "value") throw new Error("owner refused");
  expect(atRest.incidentPower).toBeCloseTo(wrongFixedSurfaceIncidentPower(INTENSITY, AREA), 9);
  expect(atRest.workRate).toBeCloseTo(0, 9);
});
