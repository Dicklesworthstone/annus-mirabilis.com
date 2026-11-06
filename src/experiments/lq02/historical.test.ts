import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { validateExperiment } from "../../content/schemas/experiment.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";
import {
  constantValue,
  getConstantSet,
  withMode1904Guard,
} from "../../physics/reference/constants.ts";
import {
  DEFAULT_HISTORICAL_LQ02_INPUTS,
  DEFAULT_HISTORICAL_LQ02_SNAPSHOT,
  evaluateHistoricalLq02,
  HISTORICAL_LQ02_CONSTANT_SET,
  HISTORICAL_LQ02_MODE,
  HISTORICAL_LQ02_PRESET,
  validateHistoricalLq02Parameters,
} from "./historical.ts";

describe("LQ-02's 1904 composition", () => {
  test("mode is declared in the real instrument manifest", () => {
    const manifest = validateExperiment(
      strictParse(readFileSync("content/experiments/lq-02.yaml", "utf8"), "yaml"),
    );
    expect(manifest.modes?.find((mode) => mode.id === HISTORICAL_LQ02_MODE)?.historicalStatus).toBe(
      "historical-precursor",
    );
    expect(
      manifest.presets.find((preset) => preset.presetId === HISTORICAL_LQ02_PRESET)
        ?.parameterValues,
    ).toEqual(DEFAULT_HISTORICAL_LQ02_INPUTS);
  });

  test("strict guard admits the complete calculation while absolute energy remains symbolic", () => {
    const result = withMode1904Guard(() => evaluateHistoricalLq02(DEFAULT_HISTORICAL_LQ02_INPUTS));
    expect(result.kind).toBe("accepted");
    if (result.kind !== "accepted") return;
    expect(result.data.mode).toBe("lq-02:1904");
    expect(result.data.inputs.constantSetId).toBe("planck-1900-1901-printed");
    expect(result.data.energyUpToCutoff.status).toBe("symbolic");
    expect(result.data.relativeEnergy.status).toBe("value");
    expect(result.data.tenfoldGrowth.status).toBe("value");
    expect(result.data.totalWithoutCutoff.status).toBe("outside-domain");
    expect(JSON.stringify(result.data)).not.toMatch(/modernComparisons|2019|6\.17e\+23|299792458/);
  });

  test("Planck's own number comes from the registered 1901 source, not a matching calculation", () => {
    const registered = constantValue(
      getConstantSet(HISTORICAL_LQ02_CONSTANT_SET),
      "avogadroConstant",
    );
    const number = DEFAULT_HISTORICAL_LQ02_SNAPSHOT.planckNumber;
    expect(number.value).toBe(registered.value);
    expect(number.value).toBe(6.175e23);
    expect(number.year).toBe(1901);
    expect(number.source).toContain("p. 565");
  });

  test("changing temperature and upper frequency changes ratios but not absolute status", () => {
    const result = evaluateHistoricalLq02({
      ...DEFAULT_HISTORICAL_LQ02_INPUTS,
      T: 3000,
      nuCutoff: 2e14,
    });
    expect(result.kind).toBe("accepted");
    if (result.kind !== "accepted") return;
    expect(result.data.energyUpToCutoff.status).toBe("symbolic");
    if (result.data.relativeEnergy.status === "value")
      expect(result.data.relativeEnergy.value).toBe(16);
    if (result.data.shareAboveProbe.status === "value")
      expect(result.data.shareAboveProbe.value).toBeCloseTo(0.999875, 12);
  });

  test("an above-cutoff probe refuses only that share, preserving the finite allocation", () => {
    const result = evaluateHistoricalLq02({
      ...DEFAULT_HISTORICAL_LQ02_INPUTS,
      probeFrequency: 2e14,
    });
    expect(result.kind).toBe("accepted");
    if (result.kind !== "accepted") return;
    expect(result.data.energyUpToCutoff.status).toBe("symbolic");
    expect(result.data.relativeEnergy.status).toBe("value");
    expect(result.data.shareAboveProbe.status).toBe("outside-domain");
  });

  test("invalid settings and another period's constants cannot cross the boundary", () => {
    for (const constantSetId of [
      "modern-si-2019",
      "einstein-1905-light-quanta-printed",
      "unknown",
    ]) {
      expect(
        evaluateHistoricalLq02({ ...DEFAULT_HISTORICAL_LQ02_INPUTS, constantSetId }).kind,
      ).toBe("refused");
    }
    for (const key of ["T", "nuCutoff", "probeFrequency"] as const)
      for (const input of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, "1500"])
        expect(
          validateHistoricalLq02Parameters({ ...DEFAULT_HISTORICAL_LQ02_INPUTS, [key]: input })
            .kind,
        ).toBe("refused");
    expect(
      validateHistoricalLq02Parameters({ ...DEFAULT_HISTORICAL_LQ02_INPUTS, extra: 1 }).kind,
    ).toBe("refused");
    expect(validateHistoricalLq02Parameters({ T: 1500 }).kind).toBe("refused");
    const accessor = { ...DEFAULT_HISTORICAL_LQ02_INPUTS };
    Object.defineProperty(accessor, "T", {
      enumerable: true,
      get() {
        throw new Error("Do not invoke input accessors");
      },
    });
    expect(validateHistoricalLq02Parameters(accessor).kind).toBe("refused");
  });
});
