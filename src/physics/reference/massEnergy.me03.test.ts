import { describe, expect, test } from "bun:test";
import { withinTolerance } from "../../units/tolerance.ts";
import {
  evaluateBoundaryLedger,
  evaluateEnergySourceCard,
  evaluateFourMomentum,
  evaluateLightComplexVolumeRatio,
  evaluateMaterialVolumeRatio,
  evaluateMe03,
  ME03_CARD_IDS,
} from "./massEnergy.ts";

function val(result: { status: string; value?: number | Float64Array }): number {
  expect(result.status).toBe("value");
  return result.value as number;
}

describe("ME-03 reference owner: system boundary, cards, and four-momentum", () => {
  describe("boundary ledgers", () => {
    test("body alone: delta E = -L, delta m = -L/c^2", () => {
      const ledger = evaluateBoundaryLedger("body-alone", "escapes", 1.0);
      expect(val(ledger.energyChange)).toBe(-1.0);
      expect(val(ledger.massChange)).toBeCloseTo(-1.0 / (299792458 * 299792458), 20);
    });

    test("radiation: delta E = +L, mass is not applicable in 1905 kinematics", () => {
      const ledger = evaluateBoundaryLedger("radiation", "escapes", 1.0);
      expect(val(ledger.energyChange)).toBe(1.0);
      expect(ledger.massChange.status).toBe("not-applicable");
    });

    test("combined isolated system: delta E = 0, delta m = 0", () => {
      const ledger = evaluateBoundaryLedger("combined-isolated-system", "retained", 1.0, 0);
      expect(val(ledger.energyChange)).toBe(0);
      expect(val(ledger.massChange)).toBe(0);
    });

    test("heated sealed box: delta E = +Ein, delta m = +Ein/c^2", () => {
      const ledger = evaluateBoundaryLedger("combined-isolated-system", "retained", 1.0, 100.0);
      expect(val(ledger.energyChange)).toBe(100.0);
      expect(val(ledger.massChange)).toBeCloseTo(100.0 / (299792458 * 299792458), 20);
    });
  });

  describe("cited energy-source cards arithmetic", () => {
    test("radium-226 alpha decay: 0.0052292 u/decay, 5.229 mg/mol", () => {
      const card = evaluateEnergySourceCard("me-03-card-radium");
      expect(card.boundary.energyFigure.value).toBe(4.871);
      expect(card.boundary.energyFigure.unit).toBe("MeV");
      expect(card.boundary.matterCrossesBoundary.crosses).toBe(false);
      expect(card.boundary.closedButNotIsolated.value).toBe(true);
      expect(card.boundary.radiation.disposition).toBe("escapes");
      // Mass loss per decay ~ 8.683e-30 kg
      expect(card.massChangeKg).toBeCloseTo(8.683e-30, 32);
      expect(card.massChangeFormatted).toContain("0.0052292 u/decay");
      expect(card.massChangeFormatted).toContain("5.229 mg/mol");
    });

    test("the Sun: luminosity 3.828e26 W -> 4.259e9 kg/s", () => {
      const card = evaluateEnergySourceCard("me-03-card-sun");
      expect(card.boundary.energyFigure.value).toBe(3.828e26);
      expect(card.boundary.energyFigure.unit).toBe("W");
      expect(card.boundary.matterCrossesBoundary.crosses).toBe(true);
      expect(card.boundary.closedButNotIsolated.value).toBe(false);
      expect(card.massChangeKg).toBeCloseTo(4259224414.57, 1);
      expect(card.massChangeFormatted).toContain("4.259 × 10^9 kg/s");
    });

    test("burning coal: 24-35 MJ/kg -> (2.670-3.894)e-10 kg, 30 MJ midpoint is 3.338e-10 kg", () => {
      const card = evaluateEnergySourceCard("me-03-card-coal");
      expect(card.boundary.energyFigure.unit).toBe("MJ/kg");
      expect(card.boundary.matterCrossesBoundary.crosses).toBe(true);
      expect(card.boundary.closedButNotIsolated.value).toBe(false);

      const cSq = 299792458 * 299792458;
      const minMass = 24e6 / cSq;
      const maxMass = 35e6 / cSq;
      const midMass = 30e6 / cSq;

      expect(minMass).toBeCloseTo(2.670356e-10, 15);
      expect(maxMass).toBeCloseTo(3.894278e-10, 15);
      expect(card.massChangeKg).toBeCloseTo(midMass, 15);
      expect(minMass).toBeLessThan(card.massChangeKg);
      expect(card.massChangeKg).toBeLessThan(maxMass);
      expect(card.massChangeFormatted).toContain("(2.670–3.894) × 10^-10 kg");
    });

    test("a candle: 80 W for 1 h (288 kJ) -> 3.20 ng", () => {
      const card = evaluateEnergySourceCard("me-03-card-candle");
      expect(card.boundary.energyFigure.value).toBe(80);
      expect(card.boundary.energyFigure.unit).toBe("W");
      expect(card.boundary.matterCrossesBoundary.crosses).toBe(true);
      expect(card.boundary.closedButNotIsolated.value).toBe(false);
      expect(card.massChangeKg).toBeCloseTo(3.20443e-12, 16);
      expect(card.massChangeFormatted).toContain("3.20 ng");
    });

    test("a 100 W bulb for 1 Julian year -> 35.1 ug", () => {
      const card = evaluateEnergySourceCard("me-03-card-bulb");
      expect(card.boundary.energyFigure.value).toBe(3.15576e9);
      expect(card.boundary.energyFigure.unit).toBe("J");
      expect(card.boundary.matterCrossesBoundary.crosses).toBe(false);
      expect(card.boundary.closedButNotIsolated.value).toBe(true);
      expect(card.massChangeKg).toBeCloseTo(3.5113e-8, 12);
      expect(card.massChangeFormatted).toContain("35.1 µg");
    });

    test("heated sealed box: +E/c^2", () => {
      const card = evaluateEnergySourceCard("me-03-heated-sealed-box");
      expect(card.boundary.matterCrossesBoundary.crosses).toBe(false);
      expect(card.boundary.radiation.disposition).toBe("retained");
      expect(card.boundary.closedButNotIsolated.value).toBe(true);
      expect(card.massChangeKg).toBeCloseTo(1.0 / (299792458 * 299792458), 20);
    });

    test("sealed lamp and mirror: 0 mass change for enclosure", () => {
      const card = evaluateEnergySourceCard("me-03-sealed-lamp-and-mirror");
      expect(card.boundary.matterCrossesBoundary.crosses).toBe(false);
      expect(card.boundary.radiation.disposition).toBe("retained");
      expect(card.boundary.closedButNotIsolated.value).toBe(true);
      expect(card.massChangeKg).toBe(0);
      expect(val(card.massChangeSigned)).toBe(0);
    });

    test("all 7 card ids evaluate with non-empty citations and boundaries", () => {
      expect(ME03_CARD_IDS.length).toBe(7);
      for (const id of ME03_CARD_IDS) {
        const card = evaluateEnergySourceCard(id);
        expect(card.id).toBe(id);
        expect(card.citation.length).toBeGreaterThan(10);
        expect(card.boundary.systemBefore.length).toBeGreaterThan(0);
        expect(card.boundary.systemAfter.length).toBeGreaterThan(0);
        expect(card.boundary.energyFigure.citationId.length).toBeGreaterThan(0);
      }
    });
  });

  describe("modern four-momentum invariant mass", () => {
    test("single pulse: invariant mass is 0", () => {
      const res = evaluateFourMomentum("single-pulse", 100);
      expect(val(res)).toBe(0);
    });

    test("two collinear pulses: invariant mass is 0", () => {
      const res = evaluateFourMomentum("two-collinear", 100);
      expect(val(res)).toBe(0);
    });

    test("two equal opposite pulses: invariant mass is L/c^2", () => {
      const totalEnergy = 100; // J
      const cSq = 299792458 * 299792458;
      const res = evaluateFourMomentum("two-opposite", totalEnergy);
      expect(val(res)).toBeCloseTo(totalEnergy / cSq, 20);
    });
  });

  describe("adversarial fixture: light complex vs material volume transformation", () => {
    test("ray transverse in stationary frame (cos phi = 0) EXPANDS by gamma, while material contracts by 1/gamma", () => {
      const beta = 0.6;
      const gamma = 1 / Math.sqrt(1 - beta * beta); // 1.25
      const matRatio = evaluateMaterialVolumeRatio(beta); // 0.8 = 1/gamma
      const lightRatioStat = evaluateLightComplexVolumeRatio(beta, 0); // gamma = 1.25

      expect(matRatio).toBeCloseTo(1 / gamma, 12);
      expect(lightRatioStat).toBeCloseTo(gamma, 12);
      // Demonstrates that a light complex does NOT contract like a material volume:
      expect(lightRatioStat).toBeGreaterThan(1.0);
      expect(matRatio).toBeLessThan(1.0);
    });

    test("ray transverse in moving frame (cos phi = beta) matches material contraction 1/gamma", () => {
      const beta = 0.6;
      const matRatio = evaluateMaterialVolumeRatio(beta); // 0.8
      const lightRatioMov = evaluateLightComplexVolumeRatio(beta, beta); // gamma * (1 - beta^2) = 1/gamma = 0.8

      expect(lightRatioMov).toBeCloseTo(matRatio, 12);
      expect(
        withinTolerance(lightRatioMov, matRatio, {
          relative: 1e-12,
          relativeTo: "reference",
        }).ok,
      ).toBe(true);
    });
  });

  describe("evaluateMe03 full snapshot", () => {
    test("default parameters yield valid snapshot with 7 cards and correct speed of light", () => {
      const snap = evaluateMe03();
      expect(snap.boundary).toBe("body-alone");
      expect(snap.disposition).toBe("escapes");
      expect(snap.emittedEnergy).toBe(1.0);
      expect(snap.speedOfLight).toBe(299792458);
      expect(snap.cards["me-03-card-radium"]).toBeDefined();
      expect(snap.cards["me-03-card-sun"]).toBeDefined();
      expect(val(snap.energyChange)).toBe(-1.0);
    });
  });
});
