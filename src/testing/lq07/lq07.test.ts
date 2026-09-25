import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePredictPromptId } from "../../content/ids.ts";
import { validateExperiment } from "../../content/schemas/experiment.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { LQ07_DEFAULTS, LQ07_QUESTION } from "../../experiments/lq07/definition.ts";
import { validateLq07Parameters } from "../../experiments/lq07/parameters.ts";
import { decodeLq07Settings, encodeLq07Settings } from "../../experiments/lq07/permalink.ts";
import { createLq07Session, evaluateLq07 } from "../../experiments/lq07/session.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("LQ-07 fluorescence energy budget & Stokes's rule contract", () => {
  test("manifest validates, prompt ids parse, and presets are present", () => {
    const raw = strictParse(
      readFileSync(join(root, "content/experiments/lq-07.yaml"), "utf8"),
      "yaml",
    );
    const manifest = validateExperiment(raw);
    expect(manifest.id).toBe("lq-07");
    expect(manifest.explanatoryQuestion).toBe(LQ07_QUESTION);
    expect(manifest.notModeled.length).toBeGreaterThan(0);

    const ids =
      "enabled" in manifest.predictMode && manifest.predictMode.enabled
        ? manifest.predictMode.prompts.map((p) => p.promptId)
        : [];
    expect(ids).toContain("lq-07-predict-higher-frequency");
    expect(ids).toContain("lq-07-predict-weak-light");
    for (const id of ids) {
      const parsed = parsePredictPromptId(id);
      expect(parsed.ok).toBe(true);
    }
  });

  test("readings-owner record exists and validates as YAML", () => {
    const raw = strictParse(
      readFileSync(
        join(root, "content/editorial/readings-owners/am-lq-07-fluorescence-zjai.yaml"),
        "utf8",
      ),
      "yaml",
    );
    expect(raw).toBeDefined();
    expect((raw as { ownerBeadId: string }).ownerBeadId).toBe("am-lq-07-fluorescence-zjai");
  });

  test("teaching tapes validate as YAML", () => {
    const stokesTape = strictParse(
      readFileSync(join(root, "content/experiments/tapes/stokes-rule-energy-budget.yaml"), "utf8"),
      "yaml",
    );
    expect((stokesTape as { tapeId: string }).tapeId).toBe("stokes-rule-energy-budget");

    const stageGTape = strictParse(
      readFileSync(join(root, "content/experiments/tapes/lq-07-journey-stage-g.yaml"), "utf8"),
      "yaml",
    );
    expect((stageGTape as { tapeId: string }).tapeId).toBe("lq-07-journey-stage-g");
  });

  test("golden fixture: nu1 = 850 THz gives h*nu1 = 3.515318 eV and nu2,max = 850 THz under paper assumptions", () => {
    const evalResult = evaluateLq07({
      ...LQ07_DEFAULTS,
      nu1: 850,
      nu2: 850,
      regime: "standard-stokes",
    });

    expect(evalResult.budget.status).toBe("value");
    expect(evalResult.budget.allowed).toBe(true);
    expect(evalResult.budget.e1Ev).toBeCloseTo(3.515318, 5);
    expect(evalResult.budget.nu2MaxHz / 1e12).toBeCloseTo(850, 5);
    expect(evalResult.budget.energyDeficitEv).toBe(0);
    expect(evalResult.budget.eOtherEv).toBeCloseTo(0, 8);
  });

  test("golden fixture: nu2 = 900 THz is disallowed with 0.206783 eV deficit", () => {
    const evalResult = evaluateLq07({
      ...LQ07_DEFAULTS,
      nu1: 850,
      nu2: 900,
      regime: "standard-stokes",
    });

    expect(evalResult.budget.status).toBe("value");
    expect(evalResult.budget.allowed).toBe(false);
    expect(evalResult.budget.e2Ev).toBeCloseTo(3.722101, 5);
    expect(evalResult.budget.energyDeficitEv).toBeCloseTo(0.206783, 5);
  });

  test("deviation case (1): k = 2 gives nu2,max = 1700 THz and permits 900 THz", () => {
    const evalResult = evaluateLq07({
      ...LQ07_DEFAULTS,
      nu1: 850,
      nu2: 900,
      regime: "deviation-multi-quantum",
      multiQuantumK: 2,
    });

    expect(evalResult.budget.status).toBe("value");
    expect(evalResult.budget.allowed).toBe(true);
    expect(evalResult.budget.nu2MaxHz / 1e12).toBeCloseTo(1700, 5);
    expect(evalResult.budget.energyDeficitEv).toBe(0);
    expect(evalResult.budget.eOtherEv).toBeCloseTo(2 * 3.515318 - 3.722101, 4);
  });

  test("deviation case (2): non-Wien temperatures yield outside-domain refusal", () => {
    const eval20k = evaluateLq07({
      ...LQ07_DEFAULTS,
      nu1: 850,
      nu2: 850,
      regime: "deviation-non-wien",
      sourceTemperatureK: 20000,
    });
    expect(eval20k.budget.status).toBe("outside-domain");
    expect(eval20k.budget.refusalCode).toBe("outside-wien-domain");

    const eval5800 = evaluateLq07({
      ...LQ07_DEFAULTS,
      nu1: 850,
      nu2: 850,
      regime: "deviation-non-wien",
      sourceTemperatureK: 5800,
    });
    expect(eval5800.budget.status).toBe("value");
    expect(eval5800.budget.allowed).toBe(true);
  });

  test("modern thermal allowance: n = 10, T_body = 300 K gives nu2,max = 912.51 THz", () => {
    const evalResult = evaluateLq07({
      ...LQ07_DEFAULTS,
      nu1: 850,
      nu2: 900,
      regime: "modern-thermal",
      bodyTemperatureK: 300,
    });

    expect(evalResult.budget.status).toBe("value");
    expect(evalResult.budget.allowed).toBe(true);
    expect(evalResult.budget.thermalExtraEv).toBeCloseTo(0.25852, 4);
    expect(evalResult.budget.nu2MaxHz / 1e12).toBeCloseTo(912.51, 1);
  });

  test("adversarial fixture: Stokes rule is not an absolute law (deviation 1 permits anti-Stokes)", () => {
    // Under standard Stokes assumptions, 900 THz from 850 THz is forbidden
    const standard = evaluateLq07({
      ...LQ07_DEFAULTS,
      nu1: 850,
      nu2: 900,
      regime: "standard-stokes",
    });
    expect(standard.budget.allowed).toBe(false);

    // Under deviation case (1) with k = 2, 900 THz MUST be allowed
    const deviation1 = evaluateLq07({
      ...LQ07_DEFAULTS,
      nu1: 850,
      nu2: 900,
      regime: "deviation-multi-quantum",
      multiQuantumK: 2,
    });
    expect(deviation1.budget.allowed).toBe(true);

    // Adversarial assertion: a view that treats Stokes's rule as universally forbidden fails
    expect(deviation1.budget.allowed).not.toBe(standard.budget.allowed);
  });

  test("rates are not-applicable in multi-quantum deviation regime", () => {
    const evalResult = evaluateLq07({
      ...LQ07_DEFAULTS,
      nu1: 850,
      nu2: 900,
      regime: "deviation-multi-quantum",
      multiQuantumK: 2,
    });

    expect(evalResult.rates.status).toBe("not-applicable");
    const rateOut = evalResult.outputs.find((o) => o.quantityId === "emittedRate");
    expect(rateOut?.status).toBe("not-applicable");
  });

  test("permalink encoding and decoding roundtrip", () => {
    const params = {
      ...LQ07_DEFAULTS,
      nu1: 920,
      nu2: 780,
      regime: "deviation-multi-quantum" as const,
      multiQuantumK: 3,
      absorbedPowerMicrowatts: 2.5,
      quantumYield: 0.75,
    };
    const query = encodeLq07Settings(params);
    const decoded = decodeLq07Settings(query);
    expect(decoded.kind).toBe("settings");
    if (decoded.kind === "settings") {
      expect(decoded.parameters.nu1).toBe(920);
      expect(decoded.parameters.nu2).toBe(780);
      expect(decoded.parameters.regime).toBe("deviation-multi-quantum");
      expect(decoded.parameters.multiQuantumK).toBe(3);
      expect(decoded.parameters.absorbedPowerMicrowatts).toBe(2.5);
      expect(decoded.parameters.quantumYield).toBe(0.75);
    }
  });

  test("session creation and snapshot conform to ExperimentSession contract", () => {
    const session = createLq07Session("lq07-test-session", LQ07_DEFAULTS);
    const snap = session.getSnapshot();
    expect(snap.status).toBe("accepted");
    expect(snap.accepted?.experimentId).toBe("lq-07");
    expect(snap.accepted?.instanceId).toBe("lq07-test-session");
    expect(snap.accepted?.outputs.length).toBeGreaterThanOrEqual(6);

    session.apply({ ...LQ07_DEFAULTS, nu1: 900, nu2: 800 });
    const updated = session.getSnapshot();
    expect(updated.accepted?.parameters.nu1).toBe(900);
    expect(updated.accepted?.parameters.nu2).toBe(800);
  });

  test("parameter validation catches invalid inputs", () => {
    const valid = validateLq07Parameters(LQ07_DEFAULTS);
    expect(valid.kind).toBe("accepted");

    const badNu1 = validateLq07Parameters({ ...LQ07_DEFAULTS, nu1: -100 });
    expect(badNu1.kind).toBe("refused");

    const badYield = validateLq07Parameters({ ...LQ07_DEFAULTS, quantumYield: 1.5 });
    expect(badYield.kind).toBe("refused");

    const badK = validateLq07Parameters({ ...LQ07_DEFAULTS, multiQuantumK: 0 });
    expect(badK.kind).toBe("refused");
  });
});

describe("LQ-07 emission follows the budget's verdict", () => {
  const status = (evaluation: ReturnType<typeof evaluateLq07>, id: string) =>
    evaluation.outputs.find((o) => o.quantityId === id)?.status;

  test("a forbidden transition reports no emitted rate, power or heat, and keeps the absorbed rate", () => {
    // nu2 = 1000 THz above nu1 = 850 THz: one quantum cannot supply the emitted one. Before the
    // fix the rate panel showed 0.588 uW emitted from 1 uW absorbed at yield 0.5.
    const forbidden = evaluateLq07({ ...LQ07_DEFAULTS, nu2: 1000 });
    expect(forbidden.budget.allowed).toBe(false);
    expect(forbidden.rates.status).toBe("not-applicable");
    for (const id of ["emittedRate", "emittedPowerWatts", "dissipatedHeatWatts"])
      expect(status(forbidden, id)).toBe("not-applicable");
    expect(status(forbidden, "absorbedRate")).toBe("value");
  });

  test("an allowed transition still counts its emission", () => {
    const allowed = evaluateLq07({ ...LQ07_DEFAULTS, nu2: 600 });
    expect(allowed.budget.allowed).toBe(true);
    expect(allowed.rates.status).toBe("value");
    expect(status(allowed, "emittedPowerWatts")).toBe("value");
  });

  test("anti-Stokes emission under the thermal allowance draws heat from the body instead of clamping it to zero", () => {
    // nu2 = 900 THz is inside the modern thermal bound (about 912.5 THz at 300 K). At yield 1 the
    // emitted power exceeds the absorbed 1 uW, so the heat term is negative, not 0.
    const cooling = evaluateLq07({
      ...LQ07_DEFAULTS,
      regime: "modern-thermal",
      nu2: 900,
      quantumYield: 1,
    });
    expect(cooling.budget.allowed).toBe(true);
    expect(cooling.rates.emittedPowerWatts).toBeGreaterThan(1e-6);
    expect(cooling.rates.dissipatedHeatWatts).toBeLessThan(0);
    expect(cooling.rates.dissipatedHeatWatts).toBeCloseTo(
      1e-6 - cooling.rates.emittedPowerWatts,
      20,
    );
  });
});

describe("LQ-07 never publishes a rate it cannot write as a number", () => {
  // An absorbed power of 1e300 µW once passed validation and a shared link could carry it. The
  // owner's counts overflowed to Infinity and were published as values, and on live 254d3459
  // applying such a link replaced the laboratory with "This page could not be displayed". Since
  // dispatch 170 validation refuses it (the declared domain ends at 10^6 µW); the owner's own guard
  // below still has to hold for any caller that reaches it.
  test("a finite power whose counts overflow puts the rates outside the domain, with a reason", () => {
    const params = { ...LQ07_DEFAULTS, absorbedPowerMicrowatts: 1e300 };
    const checked = validateLq07Parameters(params);
    expect(checked.kind).toBe("refused");
    if (checked.kind === "refused") expect(checked.refusal.code).toBe("outside-model-domain");
    const evaluation = evaluateLq07(params);
    expect(evaluation.rates.status).toBe("outside-domain");
    expect(evaluation.rates.reason).toContain("too large");
    for (const output of evaluation.outputs) {
      if (output.status === "value" && typeof output.value === "number")
        expect({ id: output.quantityId, finite: Number.isFinite(output.value) }).toEqual({
          id: output.quantityId,
          finite: true,
        });
    }
    const refused = evaluation.outputs
      .filter((o) => o.status === "outside-domain")
      .map((o) => o.quantityId);
    expect(refused).toContain("absorbedRate");
    expect(refused).toContain("emittedRate");
  });

  test("a large power the counts can still hold stays a value", () => {
    const evaluation = evaluateLq07({ ...LQ07_DEFAULTS, absorbedPowerMicrowatts: 1e30 });
    expect(evaluation.rates.status).toBe("value");
    expect(Number.isFinite(evaluation.rates.emittedRatePerSecond)).toBe(true);
  });
});
