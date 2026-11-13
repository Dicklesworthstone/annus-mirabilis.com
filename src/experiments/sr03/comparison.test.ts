import { describe, expect, test } from "bun:test";
import {
  prepareSr03ComparisonExample,
  prepareSr03Comparisons,
} from "../../content/sr03Comparison.ts";
import { createSr03Host } from "../../workers/host/sr03Host.ts";
import { evaluateSr03 } from "../../workers/operations/sr03.ts";
import type { LabHello, LabResponse } from "../../workers/protocol/sr03.ts";
import type { WorkerChannel } from "../../workers/scheduler/sr03Scheduler.ts";
import { encodeResult } from "../results/codec.ts";
import {
  fixedSr03ComparisonParameters,
  SR03_COMPARISON,
  sr03ComparisonReadings,
  verifySr03Comparison,
} from "./comparison.ts";
import { createSr03ComparisonSession, type PreparedSr03Comparison } from "./comparisonSession.ts";
import { SR03_DEFAULTS, SR03_PARAMETER_CLASSES } from "./definition.ts";

// A protocol fixture identity, not a claim about a compiled artifact. Every numeric result below
// is calculated by the real SR-03 evaluator and every live request runs through its real host.
const sourceDigest = `source:sha256:${"a".repeat(64)}`;
const examples = await prepareSr03Comparisons(sourceDigest);
const example = examples[0];
if (!example) throw new Error("The prepared rod comparison is missing.");

function hostChannel(
  intercept: (message: LabResponse | LabHello) => LabResponse | LabHello = (m) => m,
) {
  let creations = 0,
    disposals = 0,
    requests = 0;
  let hold = false;
  const queued: (() => void)[] = [];
  const factory = (): WorkerChannel => {
    creations++;
    let receive: ((message: unknown) => void) | null = null;
    let onError: (() => void) | null = null;
    const host = createSr03Host((message) => {
      const copied = intercept(structuredClone(message));
      if (hold && copied.messageKind === "result") queued.push(() => receive?.(copied));
      else receive?.(copied);
    }, sourceDigest);
    return {
      send(message) {
        requests++;
        void host.receive(structuredClone(message)).catch(() => onError?.());
      },
      listen(onMessage, error) {
        receive = onMessage;
        onError = error;
        queueMicrotask(host.hello);
        return () => {
          receive = null;
          onError = null;
        };
      },
      dispose() {
        disposals++;
        host.dispose();
      },
    };
  };
  return {
    factory,
    counts: () => ({ creations, disposals, requests }),
    hold: () => {
      hold = true;
    },
    release: () => {
      hold = false;
      for (const deliver of queued.splice(0)) deliver();
    },
  };
}

async function settled(app: ReturnType<typeof createSr03ComparisonSession>) {
  if (!app.getSnapshot().pending) return;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error("Observer comparison did not settle."));
    }, 2000);
    const unsubscribe = app.subscribe(() => {
      if (!app.getSnapshot().pending) {
        unsubscribe();
        clearTimeout(timeout);
        resolve();
      }
    });
  });
}

describe("a fixed event pair, viewed by two observers", () => {
  test("every canonical input keeps the laboratory's command class, and only the observer is unlocked", () => {
    expect(Object.keys(SR03_COMPARISON.inputs).sort()).toEqual(Object.keys(SR03_DEFAULTS).sort());
    for (const [id, cls] of Object.entries(SR03_PARAMETER_CLASSES)) {
      expect(SR03_COMPARISON.inputs[id]?.command).toBe(
        cls === "input" ? "setup-change" : `${cls}-change`,
      );
      expect(SR03_COMPARISON.inputs[id]?.comparable).toBe(id === "measuringFrame");
    }
  });

  test("the complete worked comparison exists before a worker, and distinguishes separation from length", () => {
    const channel = hostChannel();
    const app = createSr03ComparisonSession("worked-rod", example, channel.factory);
    const state = app.getSnapshot();
    expect(state).toBe(app.getServerSnapshot());
    expect(channel.counts().creations).toBe(0);
    const a = sr03ComparisonReadings(state.baselineSnapshot),
      b = sr03ComparisonReadings(state.variantSnapshot);
    expect(a.dx).toBe(10);
    expect(a.cdt).toBe(0);
    expect(a.rodEnds).toBe(true);
    expect(a.separation).toBe(10);
    expect(b.dx).toBe(12.5);
    expect(b.cdt).toBe(-7.5);
    expect(b.separation).toBeNull();
    expect(b.rodLength).toBe(8);
    expect(b.verdict).toContain("not a length measurement");
    expect(state.variant.outputs.measuredLength?.status).toBe("not-applicable");
    expect(state.variant.outputs.measuredLength?.value).toBeNull();
    expect(state.result.kind).toBe("accepted");
    if (state.result.kind === "accepted") {
      expect(state.result.rows.find((row) => row.id === "measuredLength")?.ratio.status).toBe(
        "not-applicable",
      );
    }
    expect(
      verifySr03Comparison(state.baselineSnapshot, state.variantSnapshot, state.result),
    ).toBeNull();
    app.disconnect();
    expect(channel.counts().disposals).toBe(0);
  });

  test("timelike order survives, light remains lightlike, and spacelike order can reverse", () => {
    expect(examples.length).toBeGreaterThan(0);
    for (const pair of examples) {
      const app = createSr03ComparisonSession(`worked-${pair.id}`, pair, hostChannel().factory);
      const state = app.getSnapshot();
      const a = sr03ComparisonReadings(state.baselineSnapshot),
        b = sr03ComparisonReadings(state.variantSnapshot);
      expect(state.baseline.runId).toBe(state.variant.runId);
      expect(state.baseline.outputs.spacetimeIntervalSquared).toEqual(
        state.variant.outputs.spacetimeIntervalSquared,
      );
      if (pair.id === "timelike") {
        expect(a.cdt).toBe(10);
        expect(b.cdt).toBe(8.75);
      }
      if (pair.id === "lightlike") {
        expect(b.cdt).toBe(5);
        expect(b.dx).toBe(5);
        expect(state.variant.outputs.spacetimeIntervalSquared?.value).toBe(0);
      }
      if (pair.id === "spacelike") {
        expect(a.cdt).toBe(2);
        expect(b.cdt).toBe(-5);
      }
      app.disconnect();
    }
  });

  test("a selection that reselects events for each observer is refused even at zero speed", () => {
    for (const v of [0, 0.6]) {
      expect(() =>
        fixedSr03ComparisonParameters({
          ...SR03_DEFAULTS,
          v,
          endpointPairId: "frame-simultaneous",
        }),
      ).toThrow("observer-comparison-evidence");
    }
    expect(() => fixedSr03ComparisonParameters({ ...SR03_DEFAULTS, v: Number.NaN })).toThrow(
      "observer-comparison-evidence",
    );
  });

  test("a changed physical input or source cannot be dressed up as a worked observer change", () => {
    expect(() =>
      createSr03ComparisonSession(
        "changed-source",
        {
          ...example,
          variant: { ...example.variant, sourceDigest: `source:sha256:${"b".repeat(64)}` },
        },
        hostChannel().factory,
      ),
    ).toThrow("observer-comparison-source");
    expect(() =>
      createSr03ComparisonSession(
        "changed-world",
        {
          ...example,
          variant: { ...example.variant, parameters: { ...example.variant.parameters, L0: 11 } },
        },
        hostChannel().factory,
      ),
    ).toThrow("observer-comparison-settings");
  });

  test("a prepared result with invalid simulation time cannot be published (comparisonSession.ts:77)", () => {
    expect(() =>
      createSr03ComparisonSession(
        "invalid-time",
        { ...example, baseline: { ...example.baseline, simulationTime: -1 } },
        hostChannel().factory,
      ),
    ).toThrow("observer-comparison-example");
  });

  test("different accepted event evidence cannot become a worked observer change (comparisonSession.ts:112)", () => {
    const results = example.variant.results.map((text) => {
      const output = JSON.parse(text);
      return output.quantityId === "spatialSeparationK"
        ? JSON.stringify({ ...output, value: 11 })
        : text;
    });
    expect(() =>
      createSr03ComparisonSession(
        "changed-evidence",
        {
          ...example,
          variant: { ...example.variant, results },
        },
        hostChannel().factory,
      ),
    ).toThrow("observer-comparison-example");
  });

  test("worked preparation preserves a real accepted result and rejects the owner's out-of-domain input", async () => {
    expect(await prepareSr03ComparisonExample(sourceDigest, example.baseline.parameters)).toEqual(
      example.baseline,
    );
    await expect(
      prepareSr03ComparisonExample(sourceDigest, { ...example.baseline.parameters, v: 1 }),
    ).rejects.toThrow("observer-comparison-preparation");
  });

  test("missing, duplicate, nonfinite and wrong-owner readouts are never displayed as zero", () => {
    const app = createSr03ComparisonSession("evidence", example, hostChannel().factory);
    const snapshot = app.getSnapshot().baselineSnapshot;
    const first = snapshot.outputs.find((entry) => entry.quantityId === "spatialSeparationK");
    if (!first) throw new Error("The accepted rod result has no spatial separation.");
    for (const outputs of [
      snapshot.outputs.filter((entry) => entry !== first),
      [...snapshot.outputs, first],
      snapshot.outputs.map((entry) => (entry === first ? { ...entry, value: Number.NaN } : entry)),
      snapshot.outputs.map((entry) =>
        entry === first ? { ...entry, ownerId: "another-owner" } : entry,
      ),
      snapshot.outputs.map((entry) =>
        entry.quantityId === "measuredLength"
          ? { ...entry, status: "not-applicable", value: undefined, reason: "" }
          : entry,
      ),
    ])
      expect(() => sr03ComparisonReadings({ ...snapshot, outputs })).toThrow(
        "observer-comparison-evidence",
      );
    expect(() => sr03ComparisonReadings({ ...snapshot, final: false })).toThrow(
      "observer-comparison-evidence",
    );
    app.disconnect();
  });

  test("same-looking values do not excuse a changed run or measurement revision", () => {
    const app = createSr03ComparisonSession("identities", example, hostChannel().factory);
    const { baselineSnapshot: a, variantSnapshot: b, result } = app.getSnapshot();
    for (const variant of [
      { ...b, runId: "new-world" },
      { ...b, revisions: { ...b.revisions, measurement: b.revisions.measurement + 1 } },
      { ...b, revisions: { ...b.revisions, input: b.revisions.input + 1 } },
      { ...b, revisions: { ...b.revisions, observer: a.revisions.observer } },
    ])
      expect(verifySr03Comparison(a, variant, result)).not.toBeNull();
    app.disconnect();
  });
});

describe("the actual SR-03 worker host behind a controlled comparison", () => {
  test("explicit start, observer change, return and re-pin preserve the physical run and pair", async () => {
    const channel = hostChannel(),
      app = createSr03ComparisonSession("live-rod", example, channel.factory);
    app.connect();
    expect(channel.counts().creations).toBe(0);
    expect(app.start()).toBe(true);
    await settled(app);
    const baseline = app.getSnapshot().baseline;
    expect(app.getSnapshot().phase).toBe("live");
    expect(app.apply({ ...baseline.parameters, measuringFrame: "k" })).toBe(true);
    await settled(app);
    const variant = app.getSnapshot().variant;
    expect(variant.runId).toBe(baseline.runId);
    expect(variant.revisions.input).toBe(baseline.revisions.input);
    expect(variant.revisions.measurement).toBe(baseline.revisions.measurement);
    expect(variant.revisions.observer).toBeGreaterThan(baseline.revisions.observer);
    expect(variant.outputs.measuredLength?.status).toBe("not-applicable");
    expect(app.apply(baseline.parameters)).toBe(true);
    await settled(app);
    expect(app.getSnapshot().variant.outputs.measuredLength?.value).toBe(10);
    expect(app.pinCurrent()).toBe(true);
    expect(app.apply({ ...app.getSnapshot().baseline.parameters, measuringFrame: "k" })).toBe(true);
    await settled(app);
    expect(app.getSnapshot().variant.runId).toBe(baseline.runId);
    const before = channel.counts().requests;
    expect(app.apply({ ...baseline.parameters, measuringFrame: "k", v: 0.8 })).toBe(false);
    expect(channel.counts().requests).toBe(before);
    app.disconnect();
    expect(channel.counts().creations).toBe(1);
    expect(channel.counts().disposals).toBe(1);
  });

  test("pending, cancellation and a late result retain the completed comparison", async () => {
    const channel = hostChannel(),
      app = createSr03ComparisonSession("cancel-rod", example, channel.factory);
    app.connect();
    app.start();
    await settled(app);
    const before = app.getSnapshot();
    channel.hold();
    app.apply({ ...before.baseline.parameters, measuringFrame: "k" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(app.getSnapshot().pending).toBe(true);
    expect(app.getSnapshot().variant).toBe(before.variant);
    app.stop();
    channel.release();
    expect(app.getSnapshot().pending).toBe(false);
    expect(app.getSnapshot().variant).toBe(before.variant);
    app.disconnect();
  });

  test("a well-typed worker result that changes the fixed event evidence cannot replace the previous comparison", async () => {
    let accepted = 0;
    const channel = hostChannel((message) => {
      if (message.messageKind !== "result" || message.result.kind !== "accepted" || ++accepted < 2)
        return message;
      return {
        ...message,
        result: {
          kind: "accepted",
          data: {
            ...message.result.data,
            outputs: message.result.data.outputs.map((entry) =>
              entry.quantityId === "spatialSeparationK" && entry.status === "value"
                ? { ...entry, value: 11 }
                : entry,
            ),
          },
        },
      };
    });
    const app = createSr03ComparisonSession("tampered-rod", example, channel.factory);
    app.connect();
    app.start();
    await settled(app);
    const before = app.getSnapshot().variant;
    app.apply({ ...before.parameters, measuringFrame: "k" });
    await settled(app);
    expect(app.getSnapshot().variant).toBe(before);
    expect(app.getSnapshot().error).toContain("not two descriptions of the same fixed pair");
    app.disconnect();
  });

  test("a fixed custom pair can become simultaneous without inventing a numeric ratio", async () => {
    async function prepared(measuringFrame: "K" | "k") {
      const parameters = fixedSr03ComparisonParameters({
        ...SR03_DEFAULTS,
        rodRestFrame: "K",
        endpointPairId: "custom",
        customT2: 6,
        customX2: 10,
        measuringFrame,
      });
      const result = await evaluateSr03(parameters);
      if (result.kind !== "accepted") throw new Error("Real custom case failed.");
      return {
        sourceDigest,
        parameters,
        results: result.data.outputs.map(encodeResult),
        stepIndex: result.data.stepIndex,
        simulationTime: result.data.simulationTime,
      };
    }
    const pair: PreparedSr03Comparison = {
      ...example,
      baseline: await prepared("K"),
      variant: await prepared("k"),
    };
    const app = createSr03ComparisonSession("custom-rod", pair, hostChannel().factory);
    const state = app.getSnapshot();
    expect(state.baseline.outputs.measuredLength?.status).toBe("not-applicable");
    expect(state.variant.outputs.measuredLength?.value).toBe(8);
    if (state.result.kind === "accepted")
      expect(state.result.rows.find((row) => row.id === "measuredLength")?.ratio.status).toBe(
        "not-applicable",
      );
    app.disconnect();
  });
});
