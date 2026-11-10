import { expect, test } from "bun:test";
import rawExample from "../../generated/bm06-example.json";
import { evaluateBm06 } from "../../workers/operations/bm06.ts";
import { encodeResult } from "../results/codec.ts";
import type { AcceptedSnapshot } from "../store/instanceStore.ts";
import { BM06_DEFAULTS } from "./definition.ts";
import { bm06PredictionCurve } from "./prediction.ts";
import { createBm06Session, type PreparedBm06Example } from "./session.ts";

const example = rawExample as unknown as PreparedBm06Example;
function accepted(prepared = example) {
  let workers = 0;
  const session = createBm06Session("density-comparison-test", prepared, () => {
    workers++;
    throw new Error("A comparison must never create a worker");
  });
  const snapshot = session.getSnapshot().accepted as AcceptedSnapshot;
  const result = bm06PredictionCurve(snapshot);
  expect(workers).toBe(0);
  expect(session.getSnapshot().accepted).toBe(snapshot);
  return { snapshot, result };
}

test("density comparison transforms every accepted sample without recomputing or resampling the law", () => {
  const { snapshot, result } = accepted();
  expect(result.kind).toBe("curve");
  if (result.kind !== "curve") return;
  const x = snapshot.outputs.find((output) => output.quantityId === "positionCoordinate1d");
  const y = snapshot.outputs.find((output) => output.quantityId === "probabilityDensity");
  const rms = snapshot.outputs.find((output) => output.quantityId === "rmsDisplacement1d");
  if (
    x?.status !== "value" ||
    typeof x.value === "number" ||
    y?.status !== "value" ||
    typeof y.value === "number" ||
    rms?.status !== "value" ||
    typeof rms.value !== "number"
  )
    throw new Error("Prepared density outputs missing");
  expect(result.points.length).toBe(x.value.length);
  for (let i = 0; i < x.value.length; i++)
    expect(result.points[i]).toEqual([x.value.at(i) / rms.value, y.value.at(i) * rms.value]);
});

test("the actual zero-time limit is explained rather than drawn as a finite curve", async () => {
  const parameters = { ...BM06_DEFAULTS, t: 0 };
  const evaluated = await evaluateBm06(parameters, { yieldControl: async () => {} });
  expect(evaluated.kind).toBe("accepted");
  if (evaluated.kind !== "accepted") return;
  const { result } = accepted({
    ...example,
    parameters,
    results: evaluated.data.outputs.map(encodeResult),
    stepIndex: evaluated.data.stepIndex,
    simulationTime: evaluated.data.simulationTime,
  });
  expect(result.kind).toBe("unavailable");
  if (result.kind === "unavailable") expect(result.reason).toContain("zero time");
});

test("missing density samples leave an explicit unavailable comparison", () => {
  const { snapshot } = accepted();
  const result = bm06PredictionCurve({
    ...snapshot,
    outputs: snapshot.outputs.filter((output) => output.quantityId !== "probabilityDensity"),
  });
  expect(result.kind).toBe("unavailable");
});
