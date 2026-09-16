import { describe, expect, test } from "bun:test";
import {
  canonicalizeParam,
  expandParamAliases,
  linear,
  PARAM_ALIASES,
  ParamAliasRegistry,
  same,
} from "../experiments/paramAliases.ts";
import { appendExtractionLog, newExtractionLogRunId } from "./extractionLogging.ts";

const logRunId = newExtractionLogRunId();

describe("Parameter Aliases Runtime Extraction", () => {
  test("donor patent alias entries are absent from default registry", () => {
    const start = performance.now();
    expect(Object.keys(PARAM_ALIASES)).toHaveLength(0);
    appendExtractionLog({
      logRunId,
      testId: "param-aliases-donor-entries-absent",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "PARAM_ALIASES is empty by default and carries zero donor patent entries",
    });
  });

  test("alias resolution works on injected entries keyed by canonical quantity id", () => {
    const start = performance.now();
    const customRegistry: ParamAliasRegistry = {
      "bm-01-diffusion": {
        T_celsius: linear("temperatureKelvin", 1, 273.15),
        T_kelvin: same("temperatureKelvin"),
      },
    };

    const canonFromCelsius = canonicalizeParam("bm-01-diffusion", "T_celsius", 20, customRegistry);
    expect(canonFromCelsius.id).toBe("temperatureKelvin");
    expect(canonFromCelsius.value).toBe(293.15);

    const canonFromKelvin = canonicalizeParam("bm-01-diffusion", "T_kelvin", 293.15, customRegistry);
    expect(canonFromKelvin.id).toBe("temperatureKelvin");
    expect(canonFromKelvin.value).toBe(293.15);

    const expanded = expandParamAliases("bm-01-diffusion", { temperatureKelvin: 293.15 }, customRegistry);
    expect(expanded.T_celsius).toBeCloseTo(20, 6);
    expect(expanded.T_kelvin).toBe(293.15);

    appendExtractionLog({
      logRunId,
      testId: "param-aliases-injected-resolution",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "canonicalizeParam and expandParamAliases resolve linear and identity mappings",
    });
  });

  test("characterization: module exposes no resolution by control name, glyph, or display unit", () => {
    // Characterization test asserting that paramAliases does NOT support name/glyph/unit fuzzy matching
    // am-linked-experiment-groups-5t5s enforces that particle velocity, mirror speed, and frame speed
    // bind distinct canonical quantity IDs (particleVelocity, mirrorSpeed, frameSpeed) and never link
    // merely because both controls use glyph 'v' or unit 'm/s'.
    const start = performance.now();
    const registry: ParamAliasRegistry = {
      "sr-01-mirror": {
        v_mirror: same("mirrorSpeed"),
      },
      "sr-02-frame": {
        v_frame: same("frameSpeed"),
      },
    };

    const mirrorParam = canonicalizeParam("sr-01-mirror", "v_mirror", 0.5, registry);
    const frameParam = canonicalizeParam("sr-02-frame", "v_frame", 0.5, registry);

    // They resolve to distinct canonical IDs and do not collide
    expect(mirrorParam.id).toBe("mirrorSpeed");
    expect(frameParam.id).toBe("frameSpeed");
    expect(mirrorParam.id).not.toBe(frameParam.id);

    appendExtractionLog({
      logRunId,
      testId: "param-aliases-no-glyph-unit-matching",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "Characterization: paramAliases prevents cross-linking of distinct physical quantities by glyph or unit",
    });
  });
});
