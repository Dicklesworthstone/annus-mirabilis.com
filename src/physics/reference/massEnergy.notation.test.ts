import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  evaluateMe01,
  evaluateMe02,
  evaluatePhotonBox,
  printedMassConversion,
} from "./massEnergy.ts";

describe("massEnergy.notation: paper-4 notation integrity and beta audit", () => {
  it("never presents beta as a printed paper-4 glyph in source code docstrings or exports", () => {
    const filePath = fileURLToPath(new URL("./massEnergy.ts", import.meta.url));
    const content = readFileSync(filePath, "utf-8");

    // Must explicitly document that paper 4 prints explicit radical, not beta
    expect(content).toContain("Paper 4 is expected to write");
    expect(content).toContain("explicit radical");

    // Must NOT state that beta was printed in Paper 4
    expect(content).not.toMatch(/printed.*glyph.*[β\bbeta\b].*paper\s*4/i);
    expect(content).not.toMatch(/paper\s*4.*prints.*beta/i);
  });

  it("historical model identity in Me01 names explicit radical as expected printed form", () => {
    const snap = evaluateMe01({
      emittedEnergyRestFrame: 1.0,
      frameSpeed: 0.6,
      emissionAngle: 0,
      notation: "printed",
    });

    expect(snap.notation).toBe("printed");
    // Verify no scientific result label or description in snap uses beta as printed
    const results = [
      snap.pulse1Moving,
      snap.pulse2Moving,
      snap.pulseSumMoving,
      snap.restBodyBefore,
      snap.restBodyAfter,
      snap.movingBodyBefore,
      snap.movingBodyAfter,
      snap.subtractionDifference,
      snap.kineticEnergyDifference,
      snap.additiveEnergyConstant,
    ];

    for (const r of results) {
      if ("description" in r && typeof r.description === "string") {
        expect(r.description).not.toContain("printed beta");
      }
    }
  });

  it("Me02 outputs never label beta as a printed glyph", () => {
    const snap = evaluateMe02({ beta: 0.6, emittedEnergy: 1.0 });
    const results = [
      snap.exactDifference,
      snap.quadraticApproximation,
      snap.finiteSpeedProxy,
      snap.limitingCoefficient,
      snap.proxyExcess,
      snap.inertialMassDecrease,
      snap.massChangeSigned,
    ];

    for (const r of results) {
      expect(r.quantityId).not.toBe("beta");
      if ("description" in r && typeof r.description === "string") {
        expect(r.description).not.toContain("printed beta");
      }
    }
  });

  it("printedMassConversion labels explicitly reference speedOfLight and speedOfLightSquared without beta", () => {
    const res = printedMassConversion({ emittedEnergyJoules: 1.0 });
    expect(res.printed.entryLabels.join(" ")).not.toContain("beta");
    expect(res.printed.entryLabels.join(" ")).toContain(
      "speedOfLightSquared (printed: 9e20 erg/g)",
    );
    expect(res.printed.entryLabels.join(" ")).toContain("speedOfLight (editorial: 3e10 cm/s)");
  });

  it("photon-in-a-box outputs bind registry quantity ids without beta confusion", () => {
    const box = evaluatePhotonBox();
    expect(box.boxMass.quantityId).toBe("boxMass");
    expect(box.boxLength.quantityId).toBe("boxLength");
    expect(box.pulseFlightTime.quantityId).toBe("pulseFlightTime");
    expect(box.recoilSpeed.quantityId).toBe("recoilSpeed");
    expect(box.pulseMomentum.quantityId).toBe("pulseMomentum");
    expect(box.centerOfMassShift.quantityId).toBe("centerOfMassShift");
    expect(box.lightMassAssigned.quantityId).toBe("lightMassAssigned");
  });
});
