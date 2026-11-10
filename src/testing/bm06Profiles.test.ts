import { describe, expect, test } from "bun:test";
import { BM06_DEFAULTS, type Bm06Parameters } from "../experiments/bm06/definition.ts";
import { validateBm06Parameters } from "../experiments/bm06/parameters.ts";
import { decodeBm06Settings, encodeBm06Settings } from "../experiments/bm06/permalink.ts";
import { intervalProbability } from "../physics/reference/diffusion/distributions.ts";
import {
  type Bm06Evaluation,
  evaluateBm06,
  HOST_GRID_STEPPER,
} from "../workers/operations/bm06.ts";
import { remeasureBm06 } from "../workers/operations/bm06Measurement.ts";
import { BM06_PROTOCOL, decodeLabResponse } from "../workers/protocol/bm06.ts";

const quiet = { yieldControl: async () => {} };
const profiles = ["spike", "step", "two-spikes"] as const;
const comparisons = ["cellProbabilities", "maxCellMassDifference", "wallContact"];
const digest = `source:sha256:${"d".repeat(64)}`;
async function accepted(p: Bm06Parameters): Promise<Bm06Evaluation> {
  const result = await evaluateBm06(p, quiet);
  if (result.kind !== "accepted") throw new Error(`Expected acceptance: ${JSON.stringify(result)}`);
  return result.data;
}
function output(data: Bm06Evaluation, id: string) {
  const found = data.outputs.find((o) => o.quantityId === id);
  if (!found) throw new Error(`No ${id}`);
  return found;
}
function scalar(data: Bm06Evaluation, id: string): number {
  const found = output(data, id);
  if (found.status !== "value" || typeof found.value !== "number") throw new Error(id);
  return found.value;
}
function cells(data: Bm06Evaluation, id: string): Float64Array {
  const found = output(data, id);
  if (found.status !== "value" || !(found.value instanceof Float64Array)) throw new Error(id);
  return found.value;
}

describe("BM-06 initial distributions are carried through the numerical experiment", () => {
  test("all three initial shapes have probability one at t = 0, including odd and even grids", async () => {
    for (const n of [3, 6, 101]) {
      for (const gridProfile of profiles) {
        const p = { ...BM06_DEFAULTS, gridEnabled: true, gridProfile, n, t: 0 };
        const data = await accepted(p);
        const mass = cells(data, "cellMasses");
        const expected = new Float64Array(n);
        if (gridProfile === "spike") expected[Math.floor(n / 2)] = 1;
        else if (gridProfile === "step") expected.fill(1 / Math.floor(n / 2), 0, Math.floor(n / 2));
        else {
          expected[Math.floor(n / 4)] = 0.5;
          expected[Math.floor((3 * n) / 4)] = 0.5;
        }
        for (let i = 0; i < n; i++) expect(mass[i]).toBeCloseTo(expected[i] ?? -1, 14);
        expect(mass.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 14);
        expect(output(data, "probabilityDensity").status).toBe("analytic-limit");
        expect(data.stepIndex).toBe(0);
        if (gridProfile !== "step")
          expect([...cells(data, "cellProbabilities")]).toEqual([...expected]);
      }
    }
  });

  test("every profile spreads nonnegatively and conserves its initial probability", async () => {
    for (const gridProfile of profiles) {
      const data = await accepted({ ...BM06_DEFAULTS, gridEnabled: true, gridProfile });
      const mass = cells(data, "cellMasses");
      expect(mass.every((value) => Number.isFinite(value) && value >= 0)).toBe(true);
      expect(mass.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 12);
      expect(mass.filter((value) => value > 0).length).toBeGreaterThan(2);
    }
  });

  test("the left-half step is scaled by its initial mass, never by an observed final sum", async () => {
    const drifted = await evaluateBm06(
      { ...BM06_DEFAULTS, gridEnabled: true, gridProfile: "step" },
      quiet,
      {
        async step(run, control) {
          const result = await HOST_GRID_STEPPER.step(run, control);
          if (result.kind !== "accepted") return result;
          return {
            kind: "accepted",
            data: {
              ...result.data,
              field: Float64Array.from(result.data.field, (value) => value * 0.75),
            },
          };
        },
      },
    );
    if (drifted.kind !== "accepted") throw new Error("The planted mass error was not inspectable.");
    expect(cells(drifted.data, "cellMasses").reduce((sum, value) => sum + value, 0)).toBeCloseTo(
      0.75,
      12,
    );
  });

  test("two-spike comparison integrates an equal mixture at the actual rounded source cells", async () => {
    const p = {
      ...BM06_DEFAULTS,
      gridEnabled: true,
      gridProfile: "two-spikes" as const,
      n: 6,
      t: 0.1,
    };
    const data = await accepted(p);
    const D = scalar(data, "activeDiffusionCoefficient");
    const comparison = cells(data, "cellProbabilities");
    // n = 6 puts the sources at cells 1 and 4. Neither source is the central cell 3.
    for (let i = 0; i < p.n; i++) {
      let expected = 0;
      for (const source of [1, 4]) {
        const probability = intervalProbability(
          (i - source - 0.5) * p.dx,
          (i - source + 0.5) * p.dx,
          p.t,
          D,
        ).result;
        if (probability.status !== "value" || typeof probability.value !== "number")
          throw new Error("No source probability");
        expected += probability.value / 2;
      }
      expect(comparison[i]).toBe(expected);
    }
    const point = await accepted({ ...p, gridProfile: "spike" });
    expect([...comparison]).not.toEqual([...cells(point, "cellProbabilities")]);
    // The primary point-start experiment is independent of the optional grid's initial condition.
    expect([...cells(data, "probabilityDensity")]).toEqual([...cells(point, "probabilityDensity")]);
    expect(scalar(data, "intervalProbability")).toBe(scalar(point, "intervalProbability"));
  });

  test("the step exposes numerical probabilities without a fictitious Gaussian comparison", async () => {
    const data = await accepted({ ...BM06_DEFAULTS, gridEnabled: true, gridProfile: "step" });
    expect(cells(data, "cellMasses").length).toBe(BM06_DEFAULTS.n);
    for (const id of comparisons) expect(output(data, id).status).toBe("not-applicable");
  });

  test("the decoder rejects a Gaussian value substituted for a step comparison, and vice versa", async () => {
    const step = { ...BM06_DEFAULTS, gridEnabled: true, gridProfile: "step" as const };
    const spike = { ...step, gridProfile: "spike" as const };
    const stepData = await accepted(step);
    const spikeData = await accepted(spike);
    for (const [parameters, data, foreign] of [
      [step, stepData, spikeData],
      [spike, spikeData, stepData],
    ] as const) {
      const token = {
        experimentId: "bm-06",
        instanceId: "profiles",
        runId: "run-profiles",
        parentRunId: null,
        actionIndex: 1,
        revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
        parameters,
      };
      const message = {
        messageKind: "result",
        protocolVersion: BM06_PROTOCOL,
        sourceDigest: digest,
        token,
        result: { kind: "accepted", data },
      };
      expect(() => decodeLabResponse(message, token, digest)).not.toThrow();
      for (const id of comparisons) {
        const planted = structuredClone({
          ...message,
          result: {
            ...message.result,
            data: {
              ...data,
              outputs: data.outputs.map((o) => (o.quantityId === id ? output(foreign, id) : o)),
            },
          },
        });
        expect(() => decodeLabResponse(planted, token, digest)).toThrow(/requested mode/);
      }
    }
  });
});

describe("BM-06 profile settings preserve the experiment when shared", () => {
  test("version 2 roundtrips each profile; version 1 preserves the original central spike", () => {
    for (const gridProfile of profiles) {
      const p = { ...BM06_DEFAULTS, gridEnabled: true, gridProfile };
      const encoded = encodeBm06Settings(p);
      expect(encoded).toContain("bm=2");
      expect(decodeBm06Settings(encoded)).toEqual({ kind: "settings", parameters: p });
    }
    const old = new URLSearchParams(encodeBm06Settings({ ...BM06_DEFAULTS, gridEnabled: true }));
    old.set("bm", "1");
    old.delete("gridProfile");
    expect(decodeBm06Settings(`?${old}`)).toEqual({
      kind: "settings",
      parameters: { ...BM06_DEFAULTS, gridEnabled: true, gridProfile: "spike" },
    });
  });

  test("missing, unknown, numeric and duplicate aliases cannot silently choose a distribution", () => {
    const good = encodeBm06Settings(BM06_DEFAULTS);
    for (const profile of ["gaussian", "0", "1", "twoSpikes", "__proto__"]) {
      expect(validateBm06Parameters({ ...BM06_DEFAULTS, gridProfile: profile }).kind).toBe(
        "refused",
      );
      expect(
        decodeBm06Settings(good.replace("gridProfile=spike", `gridProfile=${profile}`)).kind,
      ).toBe("invalid");
    }
    expect(decodeBm06Settings(good.replace("&gridProfile=spike", "")).kind).toBe("invalid");
    expect(decodeBm06Settings(`${good}&gridProfile=step`).kind).toBe("invalid");
    expect(decodeBm06Settings(good.replace("bm=2", "bm=1")).kind).toBe("invalid");
    expect(validateBm06Parameters({ ...BM06_DEFAULTS, gridProfile: 0 }).kind).toBe("refused");
  });
});

test("an interval remeasurement uses the accepted copied D and preserves the profile field", async () => {
  const p = {
    ...BM06_DEFAULTS,
    gridEnabled: true,
    gridProfile: "two-spikes" as const,
    copiedDiffusivityInstanceId: "bm01-copy",
    copiedDiffusivityRunId: "run-copy",
    copiedDiffusivitySnapshotVersion: 2,
    copiedDiffusivityValue: 8e-13,
  };
  const data = await accepted(p);
  const next = { ...p, lower: 0, upper: 0.5e-6 };
  const changed = remeasureBm06(p, data, next);
  if (changed?.kind !== "accepted") throw new Error("The interval was not remeasured.");
  const fresh = await accepted(next);
  expect(scalar(changed.data, "intervalProbability")).toBe(scalar(fresh, "intervalProbability"));
  const wrong = intervalProbability(
    next.lower,
    next.upper,
    next.t,
    scalar(data, "diffusionCoefficient"),
  ).result;
  if (wrong.status !== "value") throw new Error("No model-only probability");
  expect(scalar(changed.data, "intervalProbability")).not.toBe(wrong.value);
  expect(cells(changed.data, "gridDensity")).toBe(cells(data, "gridDensity"));
  expect(changed.data.stepIndex).toBe(data.stepIndex);
  expect(remeasureBm06(p, data, { ...p, gridProfile: "step" })).toBeNull();
});
