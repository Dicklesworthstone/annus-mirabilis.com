import { describe, expect, test } from "bun:test";
import { withMode1904Guard } from "../../physics/reference/constants.ts";
import {
  evaluateHistoricalSr04,
  SR04_HISTORICAL_DEFAULTS,
  SR04_HISTORICAL_EXAMPLE,
  SR04_HISTORICAL_MODE,
  validateHistoricalSr04,
} from "./historical.ts";

describe("the bounded Galilean comparison available on the 1904 desk", () => {
  test("the default subtracts ordinary speeds and retains both signed light fractions under the constant guard", () => {
    const result = withMode1904Guard(() => evaluateHistoricalSr04(SR04_HISTORICAL_DEFAULTS));
    expect(result).toEqual(SR04_HISTORICAL_EXAMPLE);
    expect(result.modeId).toBe(SR04_HISTORICAL_MODE);
    expect(result.slowCaseGalilean).toEqual({ status: "value", value: -20 });
    expect(result.rightRayFraction).toEqual({ status: "value", value: 0.4 });
    expect(result.leftRayFraction).toEqual({ status: "value", value: -1.6 });
    expect(Object.keys(result).sort()).toEqual([
      "leftRayFraction",
      "modeId",
      "parameters",
      "rightRayFraction",
      "slowCaseGalilean",
    ]);
  });

  test("moving the observer in the opposite direction swaps the light-speed magnitudes", () => {
    const result = withMode1904Guard(() =>
      evaluateHistoricalSr04({
        objectSpeed: -50,
        observerSpeed: 20,
        vOverC: -0.6,
      }),
    );
    expect(result.slowCaseGalilean).toEqual({ status: "value", value: -70 });
    expect(result.rightRayFraction).toEqual({ status: "value", value: 1.6 });
    expect(result.leftRayFraction).toEqual({ status: "value", value: -0.4 });
    const rest = evaluateHistoricalSr04({ objectSpeed: 20, observerSpeed: 20, vOverC: 0 });
    expect(rest.slowCaseGalilean).toEqual({ status: "value", value: 0 });
    expect(rest.rightRayFraction).toEqual({ status: "value", value: 1 });
    expect(rest.leftRayFraction).toEqual({ status: "value", value: -1 });
  });

  test("accepted values include zero, fractional slow speeds and both declared boundaries", () => {
    for (const inputs of [
      { objectSpeed: 0, observerSpeed: -0.25, vOverC: 0 },
      { objectSpeed: -10_000, observerSpeed: 10_000, vOverC: -0.95 },
      { objectSpeed: 10_000, observerSpeed: -10_000, vOverC: 0.95 },
    ]) {
      const accepted = validateHistoricalSr04(inputs);
      expect(accepted.kind).toBe("accepted");
      if (accepted.kind !== "accepted") continue;
      expect(accepted.data).toEqual(inputs);
      expect(Object.isFrozen(accepted.data)).toBe(true);
      const result = withMode1904Guard(() => evaluateHistoricalSr04(accepted.data));
      expect(result.slowCaseGalilean.status).toBe("value");
      expect(result.rightRayFraction.status).toBe("value");
      expect(result.leftRayFraction.status).toBe("value");
    }
  });

  test("nonfinite, nonnumeric and out-of-range settings are refused by field without changing the defaults", () => {
    for (const [key, values] of [
      ["objectSpeed", [NaN, Infinity, -Infinity, "10", null, 10_001, -10_001]],
      ["observerSpeed", [NaN, Infinity, "", true, 10_001, -10_001]],
      ["vOverC", [NaN, Infinity, "0.6", -1, 1, -0.95001, 0.95001]],
    ] as const) {
      for (const value of values) {
        const result = validateHistoricalSr04({ ...SR04_HISTORICAL_DEFAULTS, [key]: value });
        expect(result.kind).toBe("refused");
        if (result.kind !== "refused") continue;
        expect(result.refusal.affected.parameterIds).toEqual([key]);
        expect(result.refusal.code).toBe("invalid-parameter");
        expect(result.refusal.rankedRepairs[0]?.label).toBe(result.refusal.details?.requirements);
      }
    }
    expect(SR04_HISTORICAL_DEFAULTS).toEqual({ objectSpeed: 10, observerSpeed: 30, vOverC: 0.6 });
  });

  test("a settings record cannot import later-mode fields, omit a value, or execute an accessor", () => {
    let read = false;
    const accessor = {
      ...SR04_HISTORICAL_DEFAULTS,
      get vOverC() {
        read = true;
        return 0.6;
      },
    };
    for (const input of [
      null,
      [],
      1,
      "settings",
      { objectSpeed: 10, observerSpeed: 30 },
      { ...SR04_HISTORICAL_DEFAULTS, showLaterAids: true },
      { ...SR04_HISTORICAL_DEFAULTS, enabledConstraints: "right-moving-light" },
      Object.create(SR04_HISTORICAL_DEFAULTS),
      accessor,
    ])
      expect(validateHistoricalSr04(input).kind).toBe("refused");
    expect(read).toBe(false);
  });

  test("a completed snapshot retains its own immutable parameters and values", () => {
    const input = { ...SR04_HISTORICAL_DEFAULTS };
    const result = evaluateHistoricalSr04(input);
    input.vOverC = -0.6;
    input.objectSpeed = 300;
    expect(result.parameters).toEqual(SR04_HISTORICAL_DEFAULTS);
    expect(result.slowCaseGalilean).toEqual({ status: "value", value: -20 });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.parameters)).toBe(true);
    expect(Object.isFrozen(result.rightRayFraction)).toBe(true);
  });
});
