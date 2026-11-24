import { describe, expect, test } from "bun:test";
import { getConstantSet, withHistoricalGuard } from "../../physics/reference/constants.ts";
import {
  radiationEntropyVolumeChange,
  wienSpectralEntropyDensity,
  wienTemperatureFromDensity,
} from "../../physics/reference/radiation.ts";
import { withinTolerance } from "../../units/tolerance.ts";
import { decodeTapePermalink, encodeTapePermalink } from "../permalink/codec.ts";
import { replayTapeOnSession, tapeForSettings } from "../permalink/sessionTape.ts";
import { LQ04_DEFAULTS, type Lq04Parameters } from "./definition.ts";
import { validateLq04Parameters } from "./parameters.ts";
import { createLq04Session, evaluateLq04 } from "./session.ts";
import { LQ04_TAPE } from "./tape.ts";

const HISTORICAL = "einstein-1905-light-quanta-printed";
const historical: Lq04Parameters = { ...LQ04_DEFAULTS, constantSetId: HISTORICAL };
const alphaSI = 6.1e-58; // 6.1e-57 erg s4/cm3, converted to J s4/m3.
const beta = 4.866e-11;
const thermalSI = 8.31 / 6.17e23; // The set's editorial R and printed N, not modern k_B.

function close(actual: number, expected: number, relative = 2e-12) {
  expect(withinTolerance(actual, expected, { relative, absolute: 1e-25 }).ok).toBe(true);
}

describe("LQ-04 historical entropy uses one identified set from spectrum to replay", () => {
  test("the coefficient-only entropy owner uses alpha and beta without a quantum constant", () => {
    const set = getConstantSet(HISTORICAL);
    const spectralOnly = {
      ...set,
      entries: set.entries.filter((entry) =>
        ["wienConstantAlpha", "wienConstantBeta", "speedOfLight"].includes(entry.quantityId),
      ),
    };
    const rho =
      alphaSI * historical.frequency ** 3 * Math.exp((-beta * historical.frequency) / 3000);
    const parameters = {
      E: rho * historical.referenceVolume * historical.bandwidth,
      nu: historical.frequency,
      dNu: historical.bandwidth,
      V: historical.referenceVolume / 2,
      V0: historical.referenceVolume,
    };
    withHistoricalGuard(() => {
      const fromRegistry = radiationEntropyVolumeChange(parameters, spectralOnly);
      const fromCoefficients = radiationEntropyVolumeChange(parameters, { A: alphaSI, B: beta });
      expect(fromRegistry).toEqual(fromCoefficients);
      expect(fromRegistry.status).toBe("value");
      const temperature = wienTemperatureFromDensity(rho, parameters.nu, spectralOnly);
      expect(temperature.status).toBe("value");
      if (temperature.status === "value") close(temperature.value, 3000);
      const entropy = wienSpectralEntropyDensity(rho, parameters.nu, spectralOnly);
      expect(entropy.status).toBe("value");
      if (entropy.status === "value")
        close(entropy.value, (rho / (beta * parameters.nu)) * ((beta * parameters.nu) / 3000 + 1));
    });
  });

  test("historical endpoint entropies obey the volume law and the temperature slope in SI", () => {
    const rho =
      alphaSI * historical.frequency ** 3 * Math.exp((-beta * historical.frequency) / 3000);
    const energy = rho * historical.referenceVolume * historical.bandwidth;
    for (const volumeRatio of [0.01, 0.5, 1, 2, 100]) {
      const result = withHistoricalGuard(() => evaluateLq04({ ...historical, volumeRatio }));
      expect(result.status).toBe("value");
      if (result.status !== "value") continue;
      close(result.energy, energy);
      close(result.initialX, (beta * historical.frequency) / 3000);
      close(result.finalX, result.initialX + Math.log(volumeRatio));
      close(
        (result.radiationEntropy * beta * historical.frequency) / energy,
        Math.log(volumeRatio),
      );
      close(result.radiationEntropyNumeric, result.radiationEntropy);
      close(result.effectiveIndependentCount, energy / (thermalSI * beta * historical.frequency));
      close(result.entropyVolumeCoefficient, thermalSI * result.effectiveIndependentCount);
      for (const [comparison, temperature] of [
        [result.initialEntropySlopeComparison, result.initialTemperature],
        [result.finalEntropySlopeComparison, result.finalTemperature],
      ] as const) {
        expect(comparison.status).toBe("value");
        if (comparison.status === "value") close(comparison.slope, 1 / temperature, 1e-8);
      }
    }
    const modern = evaluateLq04(LQ04_DEFAULTS);
    expect(modern.status).toBe("value");
    if (modern.status === "value") expect(energy).not.toBe(modern.energy);
  });

  test("the historical teaching constant and domain refusals stay attached to the same spectrum", () => {
    const result = withHistoricalGuard(() =>
      evaluateLq04({ ...historical, volumeRatio: 0.5, showUnfixedConstantPanel: true }),
    );
    expect(result.status).toBe("value");
    if (result.status !== "value") return;
    close(result.unfixedConstant.extraTerm ?? Number.NaN, -5e-7);
    close(result.unfixedConstant.deltaSWithC ?? Number.NaN, result.radiationEntropy - 5e-7);
    expect(
      withHistoricalGuard(() => evaluateLq04({ ...historical, volumeRatio: 1e-4 })).status,
    ).toBe("outside-domain");
    expect(withHistoricalGuard(() => evaluateLq04({ ...historical, bandwidth: 1e14 })).status).toBe(
      "outside-domain",
    );
  });

  test("constants start a new run; volume changes preserve the chosen reference energy", () => {
    const session = createLq04Session("historical-entropy");
    const first = session.getSnapshot().accepted;
    expect(session.apply(historical).kind).toBe("accepted");
    const selected = session.getSnapshot().accepted;
    expect(selected?.runId).not.toBe(first?.runId);
    expect(selected?.parentRunId).toBe(first?.runId ?? null);
    expect(selected?.parameters).toEqual(historical);
    expect(session.apply({ ...historical, volumeRatio: 0.5 }).kind).toBe("accepted");
    const halved = session.getSnapshot().accepted;
    expect(halved?.runId).toBe(selected?.runId);
    expect(halved?.parameters.constantSetId).toBe(HISTORICAL);
    expect(halved?.outputs.find((output) => output.quantityId === "radiationEnergy")).toEqual(
      selected?.outputs.find((output) => output.quantityId === "radiationEnergy"),
    );
    expect(session.apply({ ...historical, constantSetId: "unregistered" }).kind).toBe("refused");
    expect(session.getSnapshot().accepted).toBe(halved);
  });

  test("parameter admission preserves legacy records and refuses unrecognized constant identities", () => {
    for (const constantSetId of [HISTORICAL, "modern-si-2019"])
      expect(validateLq04Parameters({ ...LQ04_DEFAULTS, constantSetId }).kind).toBe("accepted");
    for (const constantSetId of [undefined, null, "", "planck-1900-1901-printed", "modern"])
      expect(validateLq04Parameters({ ...LQ04_DEFAULTS, constantSetId }).kind).toBe("refused");
    const old = validateLq04Parameters(LQ04_DEFAULTS);
    expect(old.kind).toBe("accepted");
    if (old.kind === "accepted") expect(Object.hasOwn(old.data, "constantSetId")).toBe(false);
  });

  test("historical tapes restore their own constants and reject a conflicting modern header", () => {
    const settings = { ...historical, volumeRatio: 0.5 };
    const tape = tapeForSettings(LQ04_TAPE, settings);
    expect(tape).not.toBeNull();
    if (!tape) return;
    expect(tape.constantSetId).toBe(HISTORICAL);
    expect(tape.initialConditions.constantSetId).toBe(HISTORICAL);
    const decoded = decodeTapePermalink(encodeTapePermalink(tape));
    expect(decoded.kind).toBe("success");
    if (decoded.kind !== "success") return;
    const restored = createLq04Session("restored-entropy");
    expect(replayTapeOnSession(LQ04_TAPE, restored, decoded.tape).kind).toBe("success");
    expect(restored.acceptedParameters()).toEqual(settings);
    const accepted = restored.getSnapshot().accepted;
    expect(
      replayTapeOnSession(LQ04_TAPE, restored, {
        ...decoded.tape,
        constantSetId: "modern-si-2019",
      }).kind,
    ).not.toBe("success");
    expect(restored.getSnapshot().accepted).toBe(accepted);
  });

  test("old modern tapes keep their field shape and replace a historical run without borrowing its constants", () => {
    const tape = tapeForSettings(LQ04_TAPE, LQ04_DEFAULTS);
    expect(tape).not.toBeNull();
    if (!tape) return;
    expect(tape.constantSetId).toBe("modern-si-2019");
    expect(Object.hasOwn(tape.initialConditions, "constantSetId")).toBe(false);
    const restored = createLq04Session("old-entropy", historical);
    expect(replayTapeOnSession(LQ04_TAPE, restored, tape).kind).toBe("success");
    expect(restored.acceptedParameters()).toEqual(LQ04_DEFAULTS);
    expect(Object.hasOwn(restored.acceptedParameters(), "constantSetId")).toBe(false);
    expect(restored.getSnapshot().accepted?.outputs).toEqual(
      createLq04Session("original-entropy").getSnapshot().accepted?.outputs,
    );
  });
});
