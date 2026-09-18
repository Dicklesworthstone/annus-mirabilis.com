import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  evaluateLedgers,
  evaluateMe01,
  initializeMassEnergyLedger,
  kineticIdentification,
  MassEnergyError,
} from "./massEnergy.ts";

describe("massEnergy.noCircularity: non-circularity doctrine and absolute energy rejection", () => {
  describe("static checks", () => {
    it("massEnergy.ts docstring and implementation enforce non-circularity doctrine", () => {
      const filePath = fileURLToPath(new URL("./massEnergy.ts", import.meta.url));
      const content = readFileSync(filePath, "utf-8");

      expect(content).toContain("This module never initializes a body's");
      expect(content).toContain("energy as M times c squared");
      expect(content).toContain("absolute-energy-not-admitted");
    });
  });

  describe("runtime circularity ban: rejection of Mc^2 and gamma Mc^2 seeds", () => {
    it("rejects string 'Mc^2' with absolute-energy-not-admitted code and circularity message", () => {
      expect(() => initializeMassEnergyLedger({ restEnergyBefore: "Mc^2" })).toThrow(
        "Circularity violation",
      );
      try {
        initializeMassEnergyLedger({ restEnergyBefore: "Mc^2" });
        expect.unreachable();
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(MassEnergyError);
        expect((err as MassEnergyError).code).toBe("absolute-energy-not-admitted");
      }
    });

    it("rejects string variations: 'M*c^2', 'M c²', 'gamma*Mc^2', 'γMc²'", () => {
      const variations = ["M*c^2", "M c²", "M·c²", "m*c^2"];
      for (const v of variations) {
        expect(() => initializeMassEnergyLedger({ restEnergyBefore: v })).toThrow();
      }

      const movingVariations = ["gamma*Mc^2", "γMc²", "gamma-mc2", "gamma*m*c^2"];
      for (const v of movingVariations) {
        expect(() => initializeMassEnergyLedger({ movingEnergyBefore: v })).toThrow();
      }
    });

    it("rejects structured formula and numericFrom circular seeds", () => {
      expect(() =>
        initializeMassEnergyLedger({ restEnergyBefore: { numericFrom: "mc2" } }),
      ).toThrow("Circularity violation");

      expect(() =>
        initializeMassEnergyLedger({ restEnergyBefore: { formula: "E₀ = Mc²" } }),
      ).toThrow("Circularity violation");

      expect(() =>
        initializeMassEnergyLedger({ movingEnergyBefore: { numericFrom: "gamma-mc2" } }),
      ).toThrow("Circularity violation");
    });

    it("evaluateLedgers rejects initial body energy with Mc^2", () => {
      expect(() => evaluateLedgers(1.0, 0.6, 0, "Mc^2")).toThrow();
    });

    it("evaluateMe01 rejects initial body energy with Mc^2", () => {
      expect(() =>
        evaluateMe01({
          emittedEnergyRestFrame: 1.0,
          frameSpeed: 0.6,
          emissionAngle: 0,
          initialBodyEnergy: "Mc^2",
        }),
      ).toThrow();
    });
  });

  describe("rejection of numeric absolute rest energy in historical model", () => {
    it("rejects literal numeric restEnergyBefore with code absolute-energy-not-admitted", () => {
      expect(() => initializeMassEnergyLedger({ restEnergyBefore: 1.0 })).toThrow();
      try {
        initializeMassEnergyLedger({ restEnergyBefore: 1.0 });
        expect.unreachable();
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(MassEnergyError);
        expect((err as MassEnergyError).code).toBe("absolute-energy-not-admitted");
        expect((err as MassEnergyError).message).toContain(
          "Supplying a numeric absolute rest energy",
        );
      }
    });

    it("rejects literal numeric movingEnergyBefore", () => {
      expect(() => initializeMassEnergyLedger({ movingEnergyBefore: 1.25 })).toThrow();
      try {
        initializeMassEnergyLedger({ movingEnergyBefore: 1.25 });
        expect.unreachable();
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(MassEnergyError);
        expect((err as MassEnergyError).code).toBe("absolute-energy-not-admitted");
      }
    });

    it("rejects numeric string '1000' or structured numeric value", () => {
      expect(() => initializeMassEnergyLedger({ restEnergyBefore: "1000" })).toThrow();
      expect(() =>
        initializeMassEnergyLedger({ restEnergyBefore: { kind: "numeric", value: 500 } }),
      ).toThrow();
    });

    it("kineticIdentification rejects numeric absolute energy", () => {
      expect(() =>
        kineticIdentification(1.0, 0.6, "unchanged", { restEnergyBefore: 1e12 }),
      ).toThrow();
      try {
        kineticIdentification(1.0, 0.6, "unchanged", { restEnergyBefore: 1e12 });
        expect.unreachable();
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(MassEnergyError);
        expect((err as MassEnergyError).code).toBe("absolute-energy-not-admitted");
      }
    });
  });

  describe("valid symbolic initialization", () => {
    it("returns symbolic E₀, E₁, H₀, H₁ when unseeded or symbolically seeded", () => {
      const ledger = initializeMassEnergyLedger();
      expect(ledger.restBodyBefore.status).toBe("symbolic");
      expect(ledger.restBodyAfter.status).toBe("symbolic");
      expect(ledger.movingBodyBefore.status).toBe("symbolic");
      expect(ledger.movingBodyAfter.status).toBe("symbolic");

      if (ledger.restBodyBefore.status === "symbolic") {
        expect(ledger.restBodyBefore.unspecifiedSymbols).toContain("E₀");
      }
      if (ledger.movingBodyBefore.status === "symbolic") {
        expect(ledger.movingBodyBefore.unspecifiedSymbols).toContain("H₀");
      }
    });
  });
});
