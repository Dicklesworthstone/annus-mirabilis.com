import { describe, expect, test } from "bun:test";
import { withMode1904Guard } from "../../physics/reference/constants.ts";
import { SHELF_IDS, shelfDefaults } from "./definition.ts";
import {
  getHistoricalShelfExample,
  HISTORICAL_SHELF_BINDINGS,
  historicalShelfModelLabel,
} from "./historicalExample.ts";

describe("1904 shelf worked examples use their guarded scientific owners", () => {
  test("every shelf has finite, identified default readings under the historical guard", () => {
    for (const instrumentId of SHELF_IDS) {
      const example = withMode1904Guard(() => getHistoricalShelfExample(instrumentId));
      expect(example.modeId).toBe("1904");
      const binding = HISTORICAL_SHELF_BINDINGS[instrumentId];
      expect(binding.instrumentId).toBe(instrumentId);
      expect(binding.modeId).toBe(`${instrumentId}:1904`);
      expect(binding.presetId).toBe(`${instrumentId}-1904`);
      expect(binding.standalonePath).toBe(`/lab/${instrumentId}/1904/`);
      expect(example.parameters).toEqual(shelfDefaults(instrumentId, "1904"));
      expect(example.readings.length).toBeGreaterThan(0);
      expect(example.notModeled.length).toBeGreaterThan(0);
      for (const reading of example.readings) {
        const output = example.outputs.find((item) => item.quantityId === reading.id);
        expect(output?.ownerId).toBe("shelf-optics");
        expect(output?.unit).toBe(reading.unit);
        expect(output?.status).toBe("value");
        if (output?.status === "value") {
          expect(typeof output.value).toBe("number");
          expect(Number.isFinite(output.value)).toBe(true);
        }
      }
      const serialized = JSON.stringify(example);
      expect(serialized).not.toMatch(/299792458|modern-si-2019|laterSpeed|laterIncrement/);
      expect(example.parameters).not.toHaveProperty("constantSet");
      expect(example.parameters).not.toHaveProperty("waterSpeed");
      expect(example.parameters).not.toHaveProperty("windSpeed");
    }
  });

  test("the same MM case preserves both distinguishable and null predictions", () => {
    const { outputs } = getHistoricalShelfExample("shelf-michelson-morley");
    const ether = outputs.find((item) => item.quantityId === "etherShift");
    const contracted = outputs.find((item) => item.quantityId === "contractedShift");
    expect(ether?.status).toBe("value");
    expect(contracted?.status).toBe("value");
    if (ether?.status === "value" && contracted?.status === "value") {
      expect(ether.value).toBeCloseTo(0.4, 6);
      expect(contracted.value).toBe(0);
    }
  });

  test("the Maxwell example keeps both directions and explicitly dates the Lorentz substitution", () => {
    const example = getHistoricalShelfExample("shelf-maxwell-galilean");
    for (const [id, value] of [
      ["galilean-forward", 0.84],
      ["galilean-backward", 1.56],
      ["lorentz-forward", 0],
      ["lorentz-backward", 0],
    ] as const) {
      const output = example.outputs.find((item) => item.quantityId === id);
      expect(output?.status).toBe("value");
      if (output?.status === "value") expect(output.value).toBeCloseTo(value, 12);
    }
    expect(historicalShelfModelLabel("lorentz")).toBe("Lorentz's 1904 substitution");
  });
});
