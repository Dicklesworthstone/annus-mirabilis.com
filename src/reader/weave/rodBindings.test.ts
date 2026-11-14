import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { encodeResult } from "../../experiments/results/codec.ts";
import {
  SR03_DEFAULTS,
  SR03_MODEL,
  SR03_OUTPUTS,
  type Sr03Parameters,
} from "../../experiments/sr03/definition.ts";
import {
  createSr03Session,
  type PreparedSr03Example,
} from "../../experiments/sr03/session.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { createWeaveEvaluator } from "../../experiments/weave/evaluate.ts";
import { checkPointerVoice } from "../../experiments/weave/pointerVoice.ts";
import {
  createSessionWeave,
  type SessionWeave,
  weaveOutputs,
} from "../../experiments/weave/sessionSource.ts";
import { validateWeavePredicate } from "../../experiments/weave/validate.ts";
import example from "../../generated/sr03-example.json";
import { createSr03Host } from "../../workers/host/sr03Host.ts";
import { evaluateSr03 } from "../../workers/operations/sr03.ts";
import type { WorkerChannel } from "../../workers/scheduler/sr03Scheduler.ts";
import { SR03_READER_WEAVE } from "./rodPassages.ts";

const SIMULTANEITY = "sr03-s2-simultaneity-relativity";
const ROD = "sr03-s4-rod-measurement";
const SPHERE = "sr03-s4-sphere-ellipsoid";

function ready(state: SessionWeave) {
  assert.ok(state.kind === "ready", "Expected an accepted event comparison");
  return state;
}

function flags(snapshot: AcceptedSnapshot) {
  return createWeaveEvaluator(SR03_READER_WEAVE.predicates).evaluate({
    runId: snapshot.runId,
    snapshotVersion: snapshot.snapshotVersion,
    constantSetId: SR03_MODEL.constantSetId,
    outputs: weaveOutputs(snapshot),
    refused: false,
  }).flags;
}

async function accepted(parameters: Sr03Parameters) {
  const evaluated = await evaluateSr03(parameters);
  assert.ok(evaluated.kind === "accepted", "Expected accepted owner outputs");
  const prepared = {
    ...example,
    parameters,
    results: evaluated.data.outputs.map(encodeResult),
    stepIndex: evaluated.data.stepIndex,
    simulationTime: evaluated.data.simulationTime,
  };
  const session = createSr03Session("rod-binding", prepared);
  return ready(createSessionWeave(session, SR03_READER_WEAVE).getSnapshot());
}

test("rod pointers resolve to the declared source sentences and numerical owner's outputs", () => {
  const manifest = load(
    readFileSync(new URL("../../../content/experiments/sr-03.yaml", import.meta.url), "utf8"),
  ) as { weavePredicates: string[] };
  const ids = new Set<string>();
  expect(SR03_READER_WEAVE.predicates).toHaveLength(3);
  for (const passage of Object.values(SR03_READER_WEAVE.passages)) {
    const block = passage.sentenceId.replace(/-s\d+$/, "");
    const source = load(
      readFileSync(
        new URL(
          "../../../content/source-blocks/special-relativity/" + block + ".yaml",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as { sentenceSpans: { id: string }[] };
    expect(source.sentenceSpans.some((span) => span.id === passage.sentenceId)).toBe(true);
    for (const span of source.sentenceSpans) ids.add(span.id);
  }
  for (const predicate of SR03_READER_WEAVE.predicates) {
    expect(manifest.weavePredicates).toContain(predicate.id);
    expect(
      validateWeavePredicate(predicate, {
        instrumentOutputIds: new Set(Object.keys(SR03_OUTPUTS)),
        resolvableTargetIds: ids,
      }),
    ).toEqual(predicate);
    expect(checkPointerVoice(predicate)).toEqual([]);
    expect(SR03_READER_WEAVE.passages[predicate.id]?.sentenceId).toBe(predicate.targets[0]);
  }
});

test("simultaneous platform marks do not become a rod-length pointer merely because their separation is a value", async () => {
  const state = await accepted(SR03_DEFAULTS);
  expect(weaveOutputs(state.accepted).measuredLength).toMatchObject({
    status: "value",
    value: 10,
  });
  expect(weaveOutputs(state.accepted).rodLengthK?.value).toBe(8);
  expect(weaveOutputs(state.accepted).readingsOnRodEnds?.value).toBe(0);
  expect(state.derived.flags[ROD]?.lit).toBe(false);
  expect(state.derived.flags[SIMULTANEITY]?.lit).toBe(true);
  expect(state.derived.flags[SPHERE]?.lit).toBe(true);
});

test("rod readings in either frame and either direction point only when the accepted endpoints are simultaneous", async () => {
  for (const rodRestFrame of ["K", "k"] as const) {
    for (const measuringFrame of ["K", "k"] as const) {
      for (const v of [-0.6, 0, 0.6]) {
        const state = await accepted({
          ...SR03_DEFAULTS,
          rodRestFrame,
          measuringFrame,
          v,
          endpointPairId: "frame-simultaneous",
        });
        expect(weaveOutputs(state.accepted).readingsOnRodEnds?.value).toBe(1);
        expect(state.derived.flags[ROD]?.lit).toBe(true);
        expect(state.derived.flags[SIMULTANEITY]?.lit).toBe(true);
        expect(state.derived.flags[SPHERE]?.lit).toBe(true);
      }
    }
  }
  for (const endpointPairId of [
    "causal-timelike",
    "causal-lightlike",
    "causal-threshold",
  ] as const) {
    const state = await accepted({ ...SR03_DEFAULTS, endpointPairId });
    expect(state.derived.flags[ROD]?.lit).toBe(false);
    expect(state.derived.flags[SIMULTANEITY]?.lit).toBe(true);
  }
  // These are both rod ends, but read at different times of K. Endpoint membership alone
  // cannot authorize the length pointer either.
  const nonsimultaneous = await accepted({
    ...SR03_DEFAULTS,
    rodRestFrame: "K",
    endpointPairId: "custom",
    customT1: 0,
    customX1: 0,
    customT2: 1,
    customX2: 10,
  });
  expect(weaveOutputs(nonsimultaneous.accepted).readingsOnRodEnds?.value).toBe(1);
  expect(weaveOutputs(nonsimultaneous.accepted).measuredLength?.status).toBe("not-applicable");
  expect(nonsimultaneous.derived.flags[ROD]?.lit).toBe(false);
});

test("missing or typed non-value owner outputs cannot borrow a plausible rod or sphere from the settings", async () => {
  const { accepted: snapshot } = await accepted({
    ...SR03_DEFAULTS,
    endpointPairId: "frame-simultaneous",
  });
  for (const [quantityId, predicate] of [
    ["readingsOnRodEnds", ROD],
    ["measuredLength", ROD],
    ["temporalSeparationKPrime", SIMULTANEITY],
    ["ellipsoidAxisLongitudinal", SPHERE],
  ] as const) {
    const missing = snapshot.outputs.filter((output) => output.quantityId !== quantityId);
    expect(flags({ ...snapshot, outputs: missing })[predicate]?.state).toBe("not-evaluable");
    const unavailable = snapshot.outputs.map((output) =>
      output.quantityId === quantityId
        ? {
            quantityId,
            unit: output.unit,
            semanticKind: output.semanticKind,
            ownerId: output.ownerId,
            status: "outside-domain" as const,
            condition: "This output is outside the represented numerical range.",
            domainKind: "numerical" as const,
            reason: "Not available in this accepted result.",
            boundary: { alternativeModel: "Inspect the symbolic relation." },
          }
        : output,
    );
    expect(flags({ ...snapshot, outputs: unavailable })[predicate]?.lit).toBe(false);
  }
});

test("the live rod binding follows actual host publications, hides pending comparisons, and starts no extra worker", async () => {
  let creations = 0;
  let disposals = 0;
  const session = createSr03Session("rod-live", example as PreparedSr03Example, () => {
    creations++;
    let receive: Parameters<WorkerChannel["listen"]>[0] | undefined;
    const host = createSr03Host(
      (message) => receive?.(structuredClone(message)),
      example.sourceDigest,
    );
    return {
      send(message) {
        void host.receive(structuredClone(message));
      },
      listen(listener) {
        receive = listener;
        queueMicrotask(() => host.hello());
        return () => {
          receive = undefined;
        };
      },
      dispose() {
        disposals++;
        host.dispose();
      },
    };
  });
  const source = createSessionWeave(session, SR03_READER_WEAVE);
  const initial = ready(source.getSnapshot());
  expect(initial.accepted).toBe(session.getSnapshot().accepted);
  expect(initial.prepared).toBe(true);
  expect(creations).toBe(0);
  const seen: SessionWeave[] = [];
  const unsubscribe = source.subscribe(() => seen.push(source.getSnapshot()));
  try {
    expect(
      session.apply({ ...SR03_DEFAULTS, endpointPairId: "frame-simultaneous" }).kind,
    ).toBe("accepted");
    expect(source.getSnapshot()).toEqual({ kind: "inactive", reason: "pending" });
    await new Promise<void>((resolve) => {
      if (!session.getSnapshot().pending) return resolve();
      const stop = session.subscribe(() => {
        if (!session.getSnapshot().pending) {
          stop();
          resolve();
        }
      });
    });
    const current = ready(source.getSnapshot());
    expect(current.accepted).toBe(session.getSnapshot().accepted);
    expect(current.prepared).toBe(false);
    expect(current.derived.flags[ROD]?.lit).toBe(true);
    expect(
      seen.some((state) => state.kind === "inactive" && state.reason === "pending"),
    ).toBe(true);
    expect(source.getServerSnapshot()).toBe(initial);
    expect(creations).toBe(1);
  } finally {
    unsubscribe();
    session.disconnect();
  }
  expect(disposals).toBe(1);
});
