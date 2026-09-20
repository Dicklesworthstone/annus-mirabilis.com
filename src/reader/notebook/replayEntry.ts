/** Private accepted evidence. This is a bounded scalar checkpoint, not a trajectory archive. */
import { BM01_COMPARISON } from "../../experiments/bm01/comparison.ts";
import { validateBm01Parameters } from "../../experiments/bm01/parameters.ts";
import { type Baseline, pinBaseline } from "../../experiments/compare/Baseline.ts";
import { comparisonStatement } from "../../experiments/compare/comparisonStatement.ts";
import { compareBaselines } from "../../experiments/compare/compatibility.ts";
import type { ControlledComparisonState } from "../../experiments/compare/controlledComparison.ts";
import { scientificDigest } from "../../experiments/digest/scientificDigest.ts";
import { validateTapeV2 } from "../../experiments/permalink/schema.ts";
import type { TapeV2 } from "../../experiments/permalink/types.ts";

/**
 * True when the text carries a C0 control character other than tab, newline or
 * carriage return. Written as an explicit code-point test rather than a regex
 * character class: the class is the point of the check, and a regex holding
 * control characters is indistinguishable to a reader, and to biome, from one
 * that holds them by accident.
 */
function hasDisallowedControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x08 || code === 0x0b || code === 0x0c || (code >= 0x0e && code <= 0x1f)) {
      return true;
    }
  }
  return false;
}

export const REPLAY_LIMITS = Object.freeze({ bytes: 65536, text: 10000, tapeBytes: 1400 });
export const REPLAY_PREDICTIONS = Object.freeze({
  smaller: "The coordinate RMS will be smaller",
  same: "The coordinate RMS will stay the same",
  larger: "The coordinate RMS will be larger",
});
export type ReplayPrediction = keyof typeof REPLAY_PREDICTIONS;
export type ReplayPassage = Readonly<{
  contentRevision: string | null;
  translationRevision: string | null;
}>;
export type ComparisonReplay = Readonly<{
  schemaVersion: 1;
  kind: "bm01-comparison";
  checkpointScope: "saved-scalar-comparison";
  baseline: Baseline;
  variant: Baseline;
  statement: string;
  displaySignificantDigits: number;
  tape: TapeV2;
  passage: ReplayPassage;
  explanationBefore: string;
  explanationAfter: string;
}>;

function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
    Reflect.ownKeys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key) ?? {}, "value"))
  )
    throw new TypeError("Unsupported replay fields. Keep the original export.");
  return value as Record<string, unknown>;
}
export function replayText(value: unknown, max: number = REPLAY_LIMITS.text): string {
  if (typeof value !== "string" || value.length > max || hasDisallowedControlCharacter(value))
    throw new TypeError(
      `Replay text must contain at most ${max} characters. Nothing was truncated.`,
    );
  return value;
}
function baseline(value: unknown): Baseline {
  const b = record(value, [
    "experimentId",
    "instanceId",
    "runId",
    "snapshotVersion",
    "actionIndex",
    "acceptedInputRevision",
    "revisions",
    "parameters",
    "identity",
    "outputs",
  ]);
  record(b.revisions, ["input", "observer", "measurement", "estimator"]);
  const identity = record(b.identity, [
    "modelVersion",
    "streamVersion",
    "allocationId",
    "constantSetId",
    "sourceDigest",
    "artifactDigest",
    "executionLabel",
  ]);
  const checked = validateBm01Parameters(b.parameters);
  if (checked.kind !== "accepted" || b.experimentId !== "bm-01")
    throw new TypeError("Unsupported replay parameters.");
  const outputs = record(
    b.outputs,
    BM01_COMPARISON.outputs.map((output) => output.id),
  );
  const integer = (v: unknown): number => {
    if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0)
      throw new TypeError("Invalid replay revision.");
    return v;
  };
  const rev = b.revisions as Record<string, unknown>;
  const parsed = pinBaseline(
    {
      experimentId: replayText(b.experimentId, 80),
      instanceId: replayText(b.instanceId, 4096),
      runId: replayText(b.runId, 4096),
      snapshotVersion: integer(b.snapshotVersion),
      actionIndex: integer(b.actionIndex),
      revisions: {
        input: integer(rev.input),
        observer: integer(rev.observer),
        measurement: integer(rev.measurement),
        estimator: integer(rev.estimator),
      },
      parameters: checked.data,
      final: true,
      outputs: Object.entries(outputs).map(([quantityId, raw]) => {
        const output = record(raw, ["status", "unit", "semanticKind", "value", "reason"]);
        if (
          ![
            "value",
            "symbolic",
            "analytic-limit",
            "underdetermined",
            "not-applicable",
            "outside-domain",
          ].includes(String(output.status)) ||
          (output.status !== "value" && output.value !== null)
        )
          throw new TypeError("Invalid saved output status.");
        replayText(output.reason, 4096);
        return {
          quantityId,
          status: replayText(output.status, 40),
          unit: replayText(output.unit, 80),
          semanticKind: replayText(output.semanticKind, 256),
          value: output.value,
          reason: output.reason,
        };
      }),
    },
    identity as Baseline["identity"],
    BM01_COMPARISON.outputs.map((o) => o.id),
  );
  if (b.acceptedInputRevision !== parsed.acceptedInputRevision)
    throw new TypeError("Mixed accepted input revisions.");
  if (!/^source:sha256:[a-f0-9]{64}$/u.test(parsed.identity.sourceDigest))
    throw new TypeError("Missing evaluator digest.");
  return parsed;
}
function revision(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value))
    throw new TypeError("Invalid passage revision.");
  return value;
}
function cloneTape(raw: unknown): TapeV2 {
  const t = record(raw, [
    "tapeVersion",
    "experimentId",
    "mode",
    "modelIdentity",
    "constantSetId",
    "seed",
    "streamVersion",
    "allocationId",
    "replayGrid",
    "initialConditions",
    "events",
    "predictions",
    "acceptedCheckpoint",
  ]);
  record(t.modelIdentity, ["modelId", "modelVersion", "evaluatorSourceHash"]);
  record(t.replayGrid, ["baseSpacing", "horizon"]);
  record(t.acceptedCheckpoint, ["acceptedActionIndex", "acceptedInputRevision", "digest"]);
  if (
    !Array.isArray(t.events) ||
    t.events.length > 1 ||
    !Array.isArray(t.predictions) ||
    t.predictions.length > 1
  )
    throw new TypeError("This replay supports one controlled variation, not arbitrary tapes.");
  for (const e of t.events)
    record(e, ["actionIndex", "commandClass", "paramId", "value", "previousValue"]);
  for (const p of t.predictions) {
    const prediction = record(p, ["promptId", "form", "payload"]);
    const payload = record(prediction.payload, ["candidateId"]);
    if (
      prediction.promptId !== "bm-01-predict-comparison-rms" ||
      prediction.form !== "candidate" ||
      !Object.hasOwn(REPLAY_PREDICTIONS, String(payload.candidateId))
    )
      throw new TypeError("Unsupported replay prediction.");
  }
  const tape = validateTapeV2(raw);
  if (
    tape.experimentId !== "bm-01" ||
    tape.mode !== "bm-01:default" ||
    tape.modelIdentity.modelVersion !== 1
  )
    throw new TypeError("This replay recipe version is not supported.");
  // This one-change tape fits even the raw (uncompressed) 2048-character permalink form.
  // It stays private; the notebook never actually creates a tape URL.
  if (new TextEncoder().encode(JSON.stringify(raw)).length > REPLAY_LIMITS.tapeBytes)
    throw new RangeError("Replay tape exceeds the bounded recipe size.");
  return freeze(JSON.parse(JSON.stringify(tape))) as TapeV2;
}
function freeze(value: unknown): unknown {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Decode without executing anything. Reading an old entry must never start an owner. */
export function parseComparisonReplay(value: unknown): ComparisonReplay {
  const r = record(value, [
    "schemaVersion",
    "kind",
    "checkpointScope",
    "baseline",
    "variant",
    "statement",
    "displaySignificantDigits",
    "tape",
    "passage",
    "explanationBefore",
    "explanationAfter",
  ]);
  if (
    r.schemaVersion !== 1 ||
    r.kind !== "bm01-comparison" ||
    r.checkpointScope !== "saved-scalar-comparison" ||
    !Number.isInteger(r.displaySignificantDigits) ||
    Number(r.displaySignificantDigits) < 1 ||
    Number(r.displaySignificantDigits) > 17
  )
    throw new TypeError(
      "Unsupported replay version or display precision. The original is preserved.",
    );
  const a = baseline(r.baseline),
    b = baseline(r.variant),
    result = compareBaselines(a, b, BM01_COMPARISON);
  if (result.kind !== "accepted") throw new TypeError(result.message);
  const statement = replayText(r.statement, 10000);
  const tape = cloneTape(r.tape);
  const mid = tape.modelIdentity;
  if (
    mid.modelId !== a.identity.modelVersion ||
    mid.evaluatorSourceHash !== a.identity.sourceDigest ||
    tape.streamVersion !== a.identity.streamVersion ||
    tape.constantSetId !== a.identity.constantSetId ||
    tape.allocationId !== a.identity.allocationId ||
    tape.seed !== a.parameters.seed ||
    tape.replayGrid?.baseSpacing !== a.parameters.h ||
    tape.replayGrid?.horizon !== a.parameters.H
  )
    throw new TypeError("Replay tape identity differs from its saved evidence.");
  const params = validateBm01Parameters(tape.initialConditions);
  if (
    params.kind !== "accepted" ||
    Object.keys(a.parameters).some(
      (key) => !Object.is(a.parameters[key], params.data[key as keyof typeof params.data]),
    )
  )
    throw new TypeError("Replay tape does not start at the saved baseline.");
  const changed = result.variation.changedInput,
    event = tape.events[0];
  if (
    changed === null
      ? tape.events.length !== 0
      : !event ||
        event.paramId !== changed ||
        event.commandClass !== result.variation.command ||
        event.actionIndex !== 1 ||
        !Object.is(event.value, b.parameters[changed]) ||
        !Object.is(event.previousValue, a.parameters[changed])
  )
    throw new TypeError("Replay tape must reproduce exactly the saved single variation.");
  if (
    tape.acceptedCheckpoint.acceptedActionIndex !== tape.events.length ||
    tape.acceptedCheckpoint.acceptedInputRevision !== b.acceptedInputRevision
  )
    throw new TypeError("Replay checkpoint does not name its accepted result.");
  const passage = record(r.passage, ["contentRevision", "translationRevision"]);
  const output: ComparisonReplay = Object.freeze({
    schemaVersion: 1,
    kind: "bm01-comparison",
    checkpointScope: "saved-scalar-comparison",
    baseline: a,
    variant: b,
    statement,
    displaySignificantDigits: Number(r.displaySignificantDigits),
    tape,
    passage: Object.freeze({
      contentRevision: revision(passage.contentRevision),
      translationRevision: revision(passage.translationRevision),
    }),
    explanationBefore: replayText(r.explanationBefore),
    explanationAfter: replayText(r.explanationAfter),
  });
  if (new TextEncoder().encode(JSON.stringify(output)).length > REPLAY_LIMITS.bytes)
    throw new RangeError(
      "A replay can hold at most 64 KiB. Export your text separately; nothing was truncated.",
    );
  return output;
}

/** The digest covers parameters and saved scalar outputs, NOT unseen latent paths or reader text. */
export async function replayEvidenceDigest(a: Baseline, b: Baseline): Promise<string> {
  return (
    await scientificDigest({
      baselineParameters: JSON.stringify(a.parameters),
      baselineOutputs: JSON.stringify(a.outputs),
      variantParameters: JSON.stringify(b.parameters),
      variantOutputs: JSON.stringify(b.outputs),
    })
  ).digest;
}
export async function verifyReplayEvidence(replay: ComparisonReplay): Promise<boolean> {
  return (
    (await replayEvidenceDigest(replay.baseline, replay.variant)) ===
    replay.tape.acceptedCheckpoint.digest
  );
}

export async function captureComparisonReplay(
  state: ControlledComparisonState,
  passage: ReplayPassage,
  words: Readonly<{ before: string; after: string }>,
  prediction: ReplayPrediction | null = null,
): Promise<ComparisonReplay> {
  if (
    state.pending ||
    state.result.kind !== "accepted" ||
    !state.baselineSnapshot.final ||
    !state.variantSnapshot.final
  )
    throw new TypeError("Wait for a completed accepted comparison before saving its evidence.");
  const ids = BM01_COMPARISON.outputs.map((o) => o.id);
  const a = pinBaseline(state.baselineSnapshot, state.baseline.identity, ids);
  const b = pinBaseline(state.variantSnapshot, state.variant.identity, ids);
  const comparison = compareBaselines(a, b, BM01_COMPARISON);
  if (comparison.kind !== "accepted") throw new TypeError(comparison.message);
  if (prediction !== null && !Object.hasOwn(REPLAY_PREDICTIONS, prediction))
    throw new TypeError("Unknown prediction.");
  const key = comparison.variation.changedInput;
  const tape = {
    tapeVersion: 2,
    experimentId: "bm-01",
    mode: "bm-01:default",
    modelIdentity: {
      modelId: a.identity.modelVersion,
      modelVersion: 1,
      evaluatorSourceHash: a.identity.sourceDigest,
    },
    constantSetId: a.identity.constantSetId,
    seed: a.parameters.seed,
    streamVersion: a.identity.streamVersion,
    allocationId: a.identity.allocationId,
    replayGrid: { baseSpacing: a.parameters.h, horizon: a.parameters.H },
    initialConditions: a.parameters,
    events:
      key === null
        ? []
        : [
            {
              actionIndex: 1,
              commandClass: comparison.variation.command,
              paramId: key,
              previousValue: a.parameters[key],
              value: b.parameters[key],
            },
          ],
    predictions:
      prediction === null
        ? []
        : [
            {
              promptId: "bm-01-predict-comparison-rms",
              form: "candidate",
              payload: { candidateId: prediction },
            },
          ],
    acceptedCheckpoint: {
      acceptedActionIndex: key === null ? 0 : 1,
      acceptedInputRevision: b.acceptedInputRevision,
      digest: await replayEvidenceDigest(a, b),
    },
  };
  return parseComparisonReplay({
    schemaVersion: 1,
    kind: "bm01-comparison",
    checkpointScope: "saved-scalar-comparison",
    baseline: a,
    variant: b,
    statement: comparisonStatement(a, b, BM01_COMPARISON, comparison),
    displaySignificantDigits: 5,
    tape,
    passage,
    explanationBefore: replayText(words.before),
    explanationAfter: replayText(words.after),
  });
}
