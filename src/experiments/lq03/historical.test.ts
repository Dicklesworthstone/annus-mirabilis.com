import { describe, expect, test } from "bun:test";
import { withHistoricalGuard } from "../../physics/reference/constants.ts";
import { withinTolerance } from "../../units/tolerance.ts";
import { decodeTapePermalink, encodeTapePermalink } from "../permalink/codec.ts";
import { replayTapeOnSession, tapeForSettings } from "../permalink/sessionTape.ts";
import { LQ03_DEFAULTS, type Lq03Parameters } from "./definition.ts";
import { validateLq03Parameters } from "./parameters.ts";
import { createLq03Session, evaluateLq03, evaluateLq03Spectrum } from "./session.ts";
import { LQ03_TAPE } from "./tape.ts";

const HISTORICAL = "einstein-1905-light-quanta-printed";
const historical: Lq03Parameters = { ...LQ03_DEFAULTS, constantSetId: HISTORICAL };

function close(actual: number, expected: number) {
  expect(withinTolerance(actual, expected, { relative: 2e-12 }).ok).toBe(true);
}

describe("LQ-03 historical spectra remain identified from input to shared result", () => {
  test("the accepted evaluation uses corrected printed coefficients and the historical speed of light", () => {
    const evaluated = withHistoricalGuard(() => evaluateLq03(historical));
    expect(evaluated.planck.frequency.status).toBe("value");
    expect(evaluated.bandEnergyFromFrequency.status).toBe("value");
    expect(evaluated.bandEnergyFromWavelength.status).toBe("value");
    if (
      evaluated.planck.frequency.status !== "value" ||
      evaluated.bandEnergyFromFrequency.status !== "value" ||
      evaluated.bandEnergyFromWavelength.status !== "value"
    )
      return;
    close(evaluated.probeX, 5.8392);
    close(evaluated.planck.frequency.value, 3.8469575732999924e-16);
    close(evaluated.bandEnergyFromFrequency.value, 0.11891950109099571);
    close(evaluated.bandEnergyFromWavelength.value, 0.11891950109099571);
    expect(evaluated.coordinateTransform.lambdaAtProbe).toBe(5e-7);
    const session = withHistoricalGuard(() => createLq03Session("historical-spectrum", historical));
    const snapshot = session.getSnapshot().accepted;
    expect(snapshot?.parameters.constantSetId).toBe(HISTORICAL);
    expect(
      snapshot?.outputs.find((output) => output.quantityId === "frequencyEnergyDensity"),
    ).toMatchObject({ status: "value", value: evaluated.planck.frequency.value });
    expect(evaluateLq03Spectrum(historical)).not.toEqual(evaluateLq03Spectrum(LQ03_DEFAULTS));
  });

  test("switching constants starts a new identified run, while display changes keep the chosen spectrum", () => {
    const session = createLq03Session("switch-spectrum");
    const first = session.getSnapshot().accepted;
    expect(session.apply(historical).kind).toBe("accepted");
    const selected = session.getSnapshot().accepted;
    expect(selected?.runId).not.toBe(first?.runId);
    expect(selected?.parentRunId).toBe(first?.runId ?? null);
    expect(selected?.parameters).toEqual(historical);
    expect(
      session.apply({ ...historical, coordinate: "wavelength", convention: "per-m" }).kind,
    ).toBe("accepted");
    expect(session.getSnapshot().accepted?.runId).toBe(selected?.runId);
    expect(session.getSnapshot().accepted?.outputs).toEqual(selected?.outputs);
    const accepted = session.getSnapshot().accepted;
    expect(session.apply({ ...historical, constantSetId: "unregistered" }).kind).toBe("refused");
    expect(session.getSnapshot().accepted).toBe(accepted);
  });

  test("validation admits only the two offered constant sets and preserves legacy records without a new field", () => {
    for (const constantSetId of [HISTORICAL, "modern-si-2019"])
      expect(validateLq03Parameters({ ...LQ03_DEFAULTS, constantSetId }).kind).toBe("accepted");
    for (const constantSetId of [undefined, null, "", "planck-1900-1901-printed", "modern"])
      expect(validateLq03Parameters({ ...LQ03_DEFAULTS, constantSetId }).kind).toBe("refused");
    const old = validateLq03Parameters(LQ03_DEFAULTS);
    expect(old.kind).toBe("accepted");
    if (old.kind === "accepted") expect(Object.hasOwn(old.data, "constantSetId")).toBe(false);
  });

  test("a historical tape round trip restores its actual constants and refuses a modern header", () => {
    const tape = tapeForSettings(LQ03_TAPE, historical);
    expect(tape).not.toBeNull();
    if (!tape) return;
    expect(tape.constantSetId).toBe(HISTORICAL);
    expect(tape.initialConditions.constantSetId).toBe(HISTORICAL);
    const decoded = decodeTapePermalink(encodeTapePermalink(tape));
    expect(decoded.kind).toBe("success");
    if (decoded.kind !== "success") return;
    const restored = createLq03Session("restored-spectrum");
    expect(replayTapeOnSession(LQ03_TAPE, restored, decoded.tape).kind).toBe("success");
    expect(restored.acceptedParameters()).toEqual(historical);
    const accepted = restored.getSnapshot().accepted;
    expect(
      replayTapeOnSession(LQ03_TAPE, restored, {
        ...decoded.tape,
        constantSetId: "modern-si-2019",
      }).kind,
    ).not.toBe("success");
    expect(restored.getSnapshot().accepted).toBe(accepted);
  });

  test("an old modern tape has its original field shape and restores modern values after a historical run", () => {
    const tape = tapeForSettings(LQ03_TAPE, LQ03_DEFAULTS);
    expect(tape).not.toBeNull();
    if (!tape) return;
    expect(tape.constantSetId).toBe("modern-si-2019");
    expect(Object.hasOwn(tape.initialConditions, "constantSetId")).toBe(false);
    const restored = createLq03Session("old-spectrum", historical);
    expect(replayTapeOnSession(LQ03_TAPE, restored, tape).kind).toBe("success");
    expect(restored.acceptedParameters()).toEqual(LQ03_DEFAULTS);
    expect(Object.hasOwn(restored.acceptedParameters(), "constantSetId")).toBe(false);
    expect(restored.getSnapshot().accepted?.outputs).toEqual(
      createLq03Session("original-spectrum").getSnapshot().accepted?.outputs,
    );
  });
});
