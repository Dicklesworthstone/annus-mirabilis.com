import { afterAll, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TracerLab } from "../../components/lab/TracerLab.tsx";
import { withHistoricalGuard } from "../../physics/reference/constants.ts";
import { TestLogger } from "../../testing/log/logger.ts";
import { createBm01Host } from "../../workers/host/bm01Host.ts";
import { createBm01Recording, measureBm01 } from "../../workers/operations/bm01.ts";
import { BM01_PROTOCOL, decodeLabResponse } from "../../workers/protocol/bm01.ts";
import { draftTapeForSettings, loadDraftTape } from "../permalink/draftTape.ts";
import { applyWorkerSettings } from "../permalink/workerSessionTape.ts";
import { encodeResult } from "../results/codec.ts";
import { bm01ComparisonIdentity } from "./comparison.ts";
import { fromTracerDraft, toTracerDraft } from "./controls.ts";
import { BM01_DEFAULTS, type Bm01Parameters } from "./definition.ts";
import { BM01_DRAFT_TAPE } from "./draftTape.ts";
import { validateBm01Parameters } from "./parameters.ts";
import { decodeBm01Settings, encodeBm01Settings } from "./permalink.ts";
import { createBm01Session, type PreparedBm01Example } from "./session.ts";

const logger = new TestLogger("bm01-constant-set");
afterAll(() => logger.flush());
const passed = (testId: string) => logger.log({ testId, instrumentId: "bm-01", outcome: "passed" });
const historical: Bm01Parameters = {
  ...BM01_DEFAULTS,
  constantSetId: "einstein-1905-brownian-printed",
  T: 290.15,
  eta: 0.00135,
  a: 5e-7,
  M: 4,
  H: 60,
};
const modern = { ...historical, constantSetId: "modern-si-2019" };
const quiet = { yieldControl: async () => {} };
const recorded = await withHistoricalGuard(() => createBm01Recording(historical, quiet));
if (recorded.kind !== "accepted") throw new Error("The historical tracer fixture must record.");
const historicalResult = withHistoricalGuard(() => measureBm01(recorded.data, historical, false));
if (historicalResult.kind !== "accepted") throw new Error("The historical fixture must measure.");
const scalar = (outputs: typeof historicalResult.data.outputs, id: string): number => {
  const output = outputs.find((entry) => entry.quantityId === id);
  if (output?.status !== "value" || typeof output.value !== "number")
    throw new Error(`Missing ${id}.`);
  return output.value;
};
const sourceDigest = `source:sha256:${"a".repeat(64)}`;
const example: PreparedBm01Example = {
  sourceDigest,
  snapshotFunctionName: "stokesEinsteinD",
  snapshotFunctionHash: "test-fixture",
  parameters: historical,
  results: historicalResult.data.outputs.map(encodeResult),
  stepIndex: historicalResult.data.stepIndex,
  simulationTime: historicalResult.data.simulationTime,
};

test("the historical owner uses R/N for both printed intervals and never reads modern kB", () => {
  const outputs = historicalResult.data.outputs;
  const expectedD = ((8.31 / 6e23) * 290.15) / (6 * Math.PI * 0.00135 * 5e-7);
  expect(scalar(outputs, "diffusionCoefficient")).toBe(expectedD);
  expect(scalar(outputs, "boltzmannConstant")).toBe(8.31 / 6e23);
  expect(scalar(outputs, "lambdaX1s") * 1e6).toBeCloseTo(0.7947833, 7);
  expect(scalar(outputs, "lambdaX60s") * 1e6).toBeCloseTo(6.156365, 6);
  expect(scalar(outputs, "lambdaX60s") / scalar(outputs, "lambdaX1s")).toBeCloseTo(
    Math.sqrt(60),
    13,
  );
  const later = withHistoricalGuard(() =>
    measureBm01(recorded.data, { ...historical, interval: 60 }, true),
  );
  expect(later.kind).toBe("accepted");
  if (later.kind !== "accepted") return;
  expect(scalar(later.data.outputs, "rmsDisplacement1d")).toBe(scalar(outputs, "lambdaX60s"));
  expect(scalar(later.data.outputs, "reusedRecording")).toBe(1);
  expect(later.data.stepIndex).toBe(3000);
  expect(later.data.simulationTime).toBe(60);
  passed("printed-intervals-from-historical-owner");
});

test("the same physical inputs with modern constants produce the distinct modern result and scaled paths", async () => {
  const other = await createBm01Recording(modern, quiet);
  expect(other.kind).toBe("accepted");
  if (other.kind !== "accepted") return;
  const measured = measureBm01(other.data, modern, false);
  expect(measured.kind).toBe("accepted");
  if (measured.kind !== "accepted") return;
  expect(scalar(measured.data.outputs, "boltzmannConstant")).toBe(1.380649e-23);
  expect(scalar(measured.data.outputs, "lambdaX1s") * 1e6).toBeCloseTo(0.7935339, 7);
  expect(scalar(measured.data.outputs, "lambdaX60s") * 1e6).toBeCloseTo(6.146687, 6);
  expect(scalar(measured.data.outputs, "lambdaX1s")).not.toBe(
    scalar(historicalResult.data.outputs, "lambdaX1s"),
  );
  const scale = Math.sqrt(8.31 / 6e23 / 1.380649e-23);
  let largestResidual = 0;
  for (let i = 0; i < other.data.values.length; i++) {
    largestResidual = Math.max(
      largestResidual,
      Math.abs((recorded.data.values[i] ?? 0) - (other.data.values[i] ?? 0) * scale),
    );
  }
  expect(largestResidual).toBeLessThan(1e-18);
  expect(other.data.draws).toBe(recorded.data.draws);
  // A recording made with one thermal constant cannot be relabelled as the other set.
  expect(measureBm01(recorded.data, modern, true).kind).toBe("outcome");
  passed("modern-versus-historical-paths");
});

test("the form, legacy URLs and tape settings preserve the selected set and every seed bit", () => {
  for (const constantSetId of ["modern-si-2019", "einstein-1905-brownian-printed"]) {
    for (const seed of ["9007199254740993", "18446744073709551615"]) {
      const p = { ...historical, constantSetId, seed };
      expect(fromTracerDraft(toTracerDraft(p))).toEqual(p);
      expect(decodeBm01Settings(encodeBm01Settings(p))).toEqual({
        kind: "settings",
        parameters: p,
      });
      const tape = draftTapeForSettings(BM01_DRAFT_TAPE, p);
      expect(tape?.constantSetId).toBe(constantSetId);
      if (!tape) throw new Error("Accepted tracer settings must be shareable.");
      expect(loadDraftTape(BM01_DRAFT_TAPE, tape)).toEqual({ kind: "loaded", settings: p });
      expect(loadDraftTape(BM01_DRAFT_TAPE, { ...tape, constantSetId: "different-set" }).kind).toBe(
        "not-restored",
      );
    }
  }
  expect(decodeBm01Settings("?walkthrough=einstein-0-8-micron&stop=2").kind).toBe("absent");
  passed("constant-and-seed-sharing");
});

test("older settings stay explicitly modern and unknown constant sets are refused", () => {
  const { constantSetId: _set, ...legacy } = BM01_DEFAULTS;
  expect(validateBm01Parameters(legacy)).toEqual({ kind: "accepted", data: BM01_DEFAULTS });
  const q = new URLSearchParams(encodeBm01Settings(BM01_DEFAULTS));
  q.delete("constantSetId");
  expect(decodeBm01Settings(`?${q}`)).toEqual({ kind: "settings", parameters: BM01_DEFAULTS });
  expect(validateBm01Parameters({ ...historical, constantSetId: "unknown" }).kind).toBe("refused");
  expect(
    decodeBm01Settings(
      encodeBm01Settings(historical).replace("einstein-1905-brownian-printed", "unknown"),
    ).kind,
  ).toBe("invalid");
  passed("legacy-modern-and-invalid-sets");
});

test("an invalid prepared constant set is refused before a worker is created", () => {
  let opened = 0;
  let failure: unknown;
  try {
    createBm01Session(
      "invalid-prepared",
      { ...example, parameters: { ...historical, constantSetId: "unknown" } },
      () => {
        opened++;
        throw new Error("The worker must remain unopened.");
      },
    );
  } catch (error) {
    failure = error;
  }
  expect(failure).toMatchObject({
    code: "malformed-response",
    message: "Invalid prepared tracer settings.",
  });
  expect(opened).toBe(0);
  passed("invalid-prepared-constant-refused");
});

test("the protocol rejects a historical result that claims a modern thermal-constant producer", () => {
  const token = {
    experimentId: "bm-01",
    instanceId: "historical-protocol",
    runId: "historical-run",
    parentRunId: null,
    actionIndex: 1,
    revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
    parameters: historical,
  };
  const response = {
    messageKind: "result",
    protocolVersion: BM01_PROTOCOL,
    sourceDigest,
    token,
    result: historicalResult,
  };
  expect(() => decodeLabResponse(structuredClone(response), token, sourceDigest)).not.toThrow();
  const changed = structuredClone(response);
  const thermal = changed.result.data.outputs.find(
    (entry) => entry.quantityId === "boltzmannConstant",
  );
  if (!thermal) throw new Error("Fixture must include the thermal constant.");
  Object.assign(thermal, { ownerId: "constants.modernSI2019", value: 1.380649e-23 });
  expect(() => decodeLabResponse(changed, token, sourceDigest)).toThrow("selected constant set");
  passed("constant-provenance-refusal");
});

test("changing the constant set forks the live worker run and the displayed labels follow accepted settings", async () => {
  const factory = () => {
    let listener: ((message: unknown) => void) | null = null;
    const host = createBm01Host((message) => listener?.(structuredClone(message)), sourceDigest);
    return {
      send(message: unknown) {
        void host.receive(structuredClone(message));
      },
      listen(onMessage: (message: unknown) => void) {
        listener = onMessage;
        queueMicrotask(() => host.hello());
        return () => {
          listener = null;
        };
      },
      dispose() {
        host.dispose();
      },
    };
  };
  const session = createBm01Session("thermal-owner", example, factory);
  try {
    const before = session.getSnapshot().accepted;
    expect(await applyWorkerSettings(session, modern)).toEqual({ kind: "restored" });
    const after = session.getSnapshot().accepted;
    expect(after?.runId).not.toBe(before?.runId);
    expect(after?.parentRunId).toBe(before?.runId);
    expect(session.acceptedParameters().constantSetId).toBe("modern-si-2019");
    // SSR deliberately uses the immutable prepared example, not a later client snapshot.
    // Use a genuine modern calculation with Einstein's physical inputs to catch heuristic labels.
    const modernRecording = await createBm01Recording(modern, quiet);
    if (modernRecording.kind !== "accepted") throw new Error("Modern fixture must record.");
    const modernResult = measureBm01(modernRecording.data, modern, false);
    if (modernResult.kind !== "accepted") throw new Error("Modern fixture must measure.");
    const modernExample: PreparedBm01Example = {
      ...example,
      parameters: modern,
      results: modernResult.data.outputs.map(encodeResult),
    };
    const html = renderToStaticMarkup(createElement(TracerLab, { example: modernExample }));
    expect(html.includes('data-constant-set-id="modern-si-2019"')).toBe(true);
    expect(html.includes('data-constant-set-id="einstein-1905-brownian-printed"')).toBe(false);
    expect(html.includes('name="constantSetId"')).toBe(true);
    expect(() =>
      bm01ComparisonIdentity({
        schemaVersion: 1,
        baseline: example,
        doubledRadius: modernExample,
        streamVersion: "1",
        allocationId: "bm-01.latent.v1",
      }),
    ).toThrow("constant set");
  } finally {
    session.disconnect();
  }
  passed("constant-change-new-run-and-labels");
});
