import { afterAll, describe, expect, test } from "bun:test";
import { TestLogger } from "../../testing/log/logger.ts";
import { LQ03_DEFAULTS } from "./definition.ts";
import { validateLq03Parameters } from "./parameters.ts";
import { buildLq03Snapshot, createLq03Session, evaluateLq03 } from "./session.ts";

const logger = new TestLogger("lq03-numeric-representations");
afterAll(() => logger.flush());

describe("LQ-03 keeps logarithmic representations distinct from numeric densities", () => {
  test("the admitted high-frequency tail never publishes a negative density or false zero", () => {
    const parameters = { ...LQ03_DEFAULTS, T: 500, probeNu: 1e16 };
    expect(validateLq03Parameters(parameters).kind).toBe("accepted");

    const evaluation = evaluateLq03(parameters);
    expect(evaluation.planck.frequency.status).toBe("value");
    if (evaluation.planck.frequency.status !== "value") return;
    expect(evaluation.planck.frequency.linearRepresentable).toBe(false);
    expect(evaluation.planck.frequency.logFrequencyEnergyDensity).toBeLessThan(-900);

    const session = createLq03Session("spectrum-underflow");
    expect(session.apply(parameters).kind).toBe("accepted");
    const snapshot = session.getSnapshot().accepted;
    expect(snapshot).not.toBeNull();
    const density = snapshot?.outputs.find(
      (output) => output.quantityId === "frequencyEnergyDensity",
    );
    expect(density).toMatchObject({
      status: "outside-domain",
      domainKind: "numerical",
      condition: "linear-representation-unavailable",
      unit: "J/(m^3 Hz)",
    });
    expect(density).not.toHaveProperty("value");
    // Other outputs still belong to these accepted settings and remain useful.
    expect(snapshot?.parameters).toEqual(parameters);
    const band = snapshot?.outputs.find((output) => output.quantityId === "bandEnergy");
    expect(band?.status).toBe("value");
    for (const output of snapshot?.outputs ?? []) {
      if (output.status !== "value") continue;
      expect(typeof output.value).toBe("number");
      expect(Number.isFinite(output.value)).toBe(true);
      expect(output.value).toBeGreaterThanOrEqual(0);
    }
    // A saved result retains the numerical limitation instead of relabelling its logarithm.
    expect(JSON.parse(JSON.stringify(density))).not.toHaveProperty("value");
    session.disconnect();
    logger.log({ testId: "positive-tail-snapshot", instrumentId: "lq-03", outcome: "passed" });
  });

  test("the coordinate comparison explicitly lacks unrepresentable values instead of carrying NaN", () => {
    const { coordinateTransform, planck } = evaluateLq03({
      ...LQ03_DEFAULTS,
      T: 500,
      probeNu: 1e16,
    });
    expect(coordinateTransform.naiveWavelengthDensity).toBeNull();
    expect(coordinateTransform.correctWavelengthDensity).toBeNull();
    expect(JSON.parse(JSON.stringify(coordinateTransform))).toEqual(coordinateTransform);
    expect(planck.wavelength.status).toBe("value");
    if (planck.wavelength.status !== "value") return;
    expect(Number.isFinite(planck.wavelength.logWavelengthEnergyDensity)).toBe(true);
    logger.log({ testId: "coordinate-underflow", instrumentId: "lq-03", outcome: "passed" });
  });

  test("the Jacobian can make the wavelength density representable when the frequency density is not", () => {
    const { coordinateTransform, planck } = evaluateLq03({
      ...LQ03_DEFAULTS,
      T: 500,
      probeNu: 7.5e15,
    });
    expect(planck.frequency.status).toBe("value");
    expect(planck.wavelength.status).toBe("value");
    if (planck.frequency.status !== "value" || planck.wavelength.status !== "value") return;
    expect(planck.frequency.linearRepresentable).toBe(false);
    expect(planck.wavelength.linearRepresentable).toBe(true);
    expect(coordinateTransform.naiveWavelengthDensity).toBeNull();
    expect(coordinateTransform.correctWavelengthDensity).toBe(planck.wavelength.value);
    expect(coordinateTransform.correctWavelengthDensity).toBeGreaterThan(0);
    logger.log({ testId: "jacobian-recovers-value", instrumentId: "lq-03", outcome: "passed" });
  });

  test("representable densities retain their physical value and units", () => {
    const snapshot = buildLq03Snapshot("spectrum-finite", "run-finite", LQ03_DEFAULTS);
    const density = snapshot.outputs.find(
      (output) => output.quantityId === "frequencyEnergyDensity",
    );
    const reference = evaluateLq03(LQ03_DEFAULTS).planck.frequency;
    expect(reference.status).toBe("value");
    if (reference.status !== "value") return;
    expect(density).toMatchObject({
      status: "value",
      value: reference.value,
      unit: "J/(m^3 Hz)",
    });
    expect(reference.value).toBeGreaterThan(0);
    logger.log({ testId: "ordinary-density", instrumentId: "lq-03", outcome: "passed" });
  });

  test("an unrepresentable positive band stays an explicit numerical limit in the accepted snapshot", () => {
    const parameters = { ...LQ03_DEFAULTS, T: 500, nu1: 9.9e15, nu2: 1e16 };
    expect(validateLq03Parameters(parameters).kind).toBe("accepted");
    const snapshot = buildLq03Snapshot("spectrum-tail-band", "run-tail-band", parameters);
    const band = snapshot.outputs.find((output) => output.quantityId === "bandEnergy");
    expect(band).toMatchObject({
      status: "outside-domain",
      domainKind: "numerical",
      condition: "band-energy-not-representable",
      boundary: { alternativeModel: "Choose a different band or temperature." },
    });
    expect(band).not.toHaveProperty("value");
    logger.log({ testId: "band-limit-snapshot", instrumentId: "lq-03", outcome: "passed" });
  });
});
