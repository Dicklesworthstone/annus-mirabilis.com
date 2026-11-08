/**
 * EVERY TEACHING TAPE WHOSE LABORATORY CAN BE DRIVEN CARRIES A DIGEST THE REPLAY REPRODUCES.
 *
 * The defect this guards against was live for three weeks and was invisible in every count. Ten of
 * the twenty-two authored tapes carried a DESCRIPTIVE checkpoint digest -- `host:sha256:sr12-
 * evaluateSr12` and the like -- where the permalink schema requires hex, so each was refused by the
 * converter and reached no reader through a link. Nothing was red. `loadWireTeachingTapes` reported
 * the ten as problems, faithfully, and the only assertion over that list required it to be
 * NON-EMPTY, so the debt was the thing being checked rather than the repair.
 *
 * WHY A DIGEST CANNOT BE AUTHORED, which is why this test drives the laboratory rather than reading
 * a field. a1cf2d23a established it: the digest is a 64-bit FNV-1a over the LABORATORY'S whole
 * accepted parameter set, which for ME-01 includes offsetDisplay, premise, step, cancelAngleFactors,
 * cancelInternalEnergies, cancelAdditiveConstant and notation -- none of which any walkthrough
 * mentions. So the only honest check is to replay and compare, and a check that merely asserted the
 * field matches a regex would have passed all five of the fabricated digests below.
 *
 * THE POPULATION FOLLOWS THE LABORATORY'S REPLAY CAPABILITY. A tape is judged when its laboratory
 * exports either a synchronous `_TAPE` binding or a worker `create...TapeBinding` factory. Worker
 * factories need an actual owner and source-hashed prepared example; the adapters below supply
 * those without changing generated artifacts. An exported factory with no adapter fails explicitly
 * instead of silently enlarging the excluded population. Each worker request must reach its own
 * final accepted publication before the digest is read, and every audit instance is disconnected.
 *
 * A draft-only shared link still starts no calculation. That does not exclude a laboratory whose
 * explicit walkthrough player can calculate: SR-03 and LQ-01 support both contracts. The remaining
 * draft-only records are named, and the existing exclusion ceiling is retained.
 */

import { afterAll, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { evaluatorSources as sr03Sources } from "../../../scripts/generate-sr03.mjs";
import { evaluatorSources as lq01Sources } from "../../../scripts/generate-wave-description.mjs";
import { parseYaml } from "../../content/provenance/yaml.ts";
import { LQ01_DEFAULTS } from "../../experiments/lq01/definition.ts";
import { createLq01TapeBinding } from "../../experiments/lq01/tape.ts";
import {
  createSessionReplayRunner,
  type LabTapeBinding,
  settingsFromTape,
  tapeStateDigestV2,
  tapeStateOf,
} from "../../experiments/permalink/sessionTape.ts";
import {
  applyWorkerSettings,
  type WorkerTapeBinding,
} from "../../experiments/permalink/workerSessionTape.ts";
import { encodeResult } from "../../experiments/results/codec.ts";
import { SR03_DEFAULTS } from "../../experiments/sr03/definition.ts";
import { createSr03TapeBinding } from "../../experiments/sr03/tape.ts";
import { createLq01Host } from "../../workers/host/lq01Host.ts";
import { createSr03Host } from "../../workers/host/sr03Host.ts";
import { evaluateLq01 } from "../../workers/operations/lq01.ts";
import { evaluateSr03 } from "../../workers/operations/sr03.ts";
import { TestLogger } from "../log/logger.ts";

const logger = new TestLogger("recorded-checkpoint-digests");
afterAll(() => logger.flush());

const ROOT = resolve(new URL("../../../", import.meta.url).pathname);
const DIR = join(ROOT, "content", "experiments", "tapes");

type TapeRecord = Readonly<{
  tapeId: string;
  experimentId: string;
  modelIdentity?: Readonly<{ artifactDigest: string }>;
  initialConditions?: Readonly<Record<string, number | string>>;
  events?: readonly { actionIndex: number; parameterId?: string; value?: number | string }[];
  checkpoints?: readonly { actionIndex: number; digest: string; label?: string }[];
}>;

const records: readonly TapeRecord[] = readdirSync(DIR)
  .filter((f) => f.endsWith(".yaml"))
  .sort()
  .map((f) => parseYaml(readFileSync(join(DIR, f), "utf8")) as TapeRecord);

/** `sr-12` -> `sr12`, the directory a laboratory's modules live in. */
const dirOf = (experimentId: string) => experimentId.replace("-", "");

type DrivenBinding =
  | Readonly<{ kind: "host"; binding: LabTapeBinding }>
  | Readonly<{ kind: "worker"; binding: WorkerTapeBinding }>;

type Host = Readonly<{
  hello(): void;
  receive(message: unknown): Promise<void>;
  dispose(): void;
}>;

/** Only the transport runs in-process; every request executes the production worker host. */
function hostTransport(
  createHost: (send: (message: unknown) => void, sourceDigest: string) => Host,
  sourceDigest: string,
) {
  return () => {
    let listener: ((message: unknown) => void) | null = null;
    const host = createHost((message) => listener?.(structuredClone(message)), sourceDigest);
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
        listener = null;
        host.dispose();
      },
    };
  };
}

function sourceIdentity(sources: readonly (readonly string[])[]): string {
  const hash = createHash("sha256");
  for (const [path, source] of sources) {
    assert.ok(typeof path === "string" && typeof source === "string");
    hash.update(`${path}\0${Buffer.byteLength(source)}\0`).update(source);
  }
  return `source:sha256:${hash.digest("hex")}`;
}

const workerAdapters: Readonly<Record<string, () => Promise<WorkerTapeBinding>>> = {
  async createLq01TapeBinding() {
    const sourceDigest = sourceIdentity(await lq01Sources());
    const evaluated = await evaluateLq01(LQ01_DEFAULTS);
    assert.ok(evaluated.kind === "accepted");
    return createLq01TapeBinding(
      {
        sourceDigest,
        parameters: LQ01_DEFAULTS,
        stepIndex: evaluated.data.stepIndex,
        simulationTime: evaluated.data.simulationTime,
        results: evaluated.data.outputs.map(encodeResult),
      },
      hostTransport(createLq01Host, sourceDigest),
    );
  },
  async createSr03TapeBinding() {
    const sourceDigest = sourceIdentity(await sr03Sources());
    const evaluated = await evaluateSr03(SR03_DEFAULTS);
    assert.ok(evaluated.kind === "accepted");
    return createSr03TapeBinding(
      {
        sourceDigest,
        parameters: SR03_DEFAULTS,
        stepIndex: evaluated.data.stepIndex,
        simulationTime: evaluated.data.simulationTime,
        results: evaluated.data.outputs.map(encodeResult),
      },
      hostTransport(createSr03Host, sourceDigest),
    );
  },
};

async function discoverBinding(experimentId: string): Promise<DrivenBinding | undefined> {
  const path = join(ROOT, "src", "experiments", dirOf(experimentId), "tape.ts");
  if (!existsSync(path)) return undefined;
  const module = (await import(path)) as Record<string, unknown>;
  const entry = Object.entries(module).find(
    ([name]) => name.endsWith("_TAPE") && !name.endsWith("_DRAFT_TAPE"),
  );
  if (entry) return { kind: "host", binding: entry[1] as LabTapeBinding };
  const factory = Object.entries(module).find(
    ([name, value]) => /^create.+TapeBinding$/.test(name) && typeof value === "function",
  );
  if (!factory) return undefined;
  const prepare = workerAdapters[factory[0]];
  assert.ok(prepare, `${experimentId} exports ${factory[0]} but has no real worker audit adapter.`);
  const binding = await prepare();
  assert.equal(binding.environment.experimentId, experimentId);
  return { kind: "worker", binding };
}

const bindings = new Map<string, Promise<DrivenBinding | undefined>>();
function labTapeBinding(experimentId: string): Promise<DrivenBinding | undefined> {
  const existing = bindings.get(experimentId);
  if (existing) return existing;
  const discovered = discoverBinding(experimentId);
  bindings.set(experimentId, discovered);
  return discovered;
}

async function replayedWorkerDigest(
  binding: WorkerTapeBinding,
  record: TapeRecord,
  upTo: number,
): Promise<string> {
  assert.match(binding.environment.artifactDigest ?? "", /^host:sha256:[0-9a-f]{64}$/);
  assert.equal(
    record.modelIdentity?.artifactDigest,
    binding.environment.artifactDigest,
    "The recorded worker source must match the actual owner closure.",
  );
  const session = binding.createSession(`${record.experimentId}-digest-check`);
  const apply = async (parameters: object) => {
    const result = await applyWorkerSettings(session, parameters);
    assert.ok(result.kind === "restored", result.kind === "not-restored" ? result.notice : "");
    const view = session.getSnapshot();
    assert.ok(!view.pending && view.accepted?.final);
    assert.equal(view.accepted.actionIndex, view.requested?.actionIndex);
    assert.equal(view.accepted.runId, view.requested?.runId);
  };
  try {
    await apply({
      ...binding.defaults,
      ...settingsFromTape(record.initialConditions ?? {}, binding.defaults),
    });
    let actionIndex = 0;
    for (const event of [...(record.events ?? [])].sort((a, b) => a.actionIndex - b.actionIndex)) {
      if (event.actionIndex > upTo) break;
      if (event.parameterId === undefined || event.value === undefined) continue;
      await apply({
        ...session.acceptedParameters(),
        ...settingsFromTape({ [event.parameterId]: event.value }, binding.defaults),
      });
      actionIndex = event.actionIndex;
    }
    const state = tapeStateOf(session.acceptedParameters());
    assert.ok(state);
    return tapeStateDigestV2(state, actionIndex);
  } finally {
    session.disconnect();
  }
}

/** The digest a fresh laboratory reaches after this record's conditions and events up to `upTo`. */
async function replayedDigest(
  selected: DrivenBinding,
  record: TapeRecord,
  upTo: number,
): Promise<string> {
  if (selected.kind === "worker") return replayedWorkerDigest(selected.binding, record, upTo);
  const binding = selected.binding;
  const runner = createSessionReplayRunner(
    binding,
    binding.createSession(`${record.experimentId}-digest-check`),
  );
  runner.applyInitialConditions((record.initialConditions ?? {}) as never);
  for (const event of [...(record.events ?? [])].sort((a, b) => a.actionIndex - b.actionIndex)) {
    if (event.actionIndex > upTo) break;
    if (event.parameterId === undefined || event.value === undefined) continue;
    runner.applyEvent({
      actionIndex: event.actionIndex,
      paramId: event.parameterId,
      value: event.value,
    } as never);
  }
  return runner.getAcceptedCheckpoint().digest;
}

const drivable: TapeRecord[] = [];
const notDrivable: TapeRecord[] = [];
for (const record of records) {
  const binding = await labTapeBinding(record.experimentId);
  (binding ? drivable : notDrivable).push(record);
}

/**
 * The audit itself, over whatever records it is given, so the plant below reaches the same
 * predicate the corpus does rather than a second copy of it.
 */
async function auditDigests(
  subjects: readonly TapeRecord[],
): Promise<{ checked: number; mismatches: string[] }> {
  const mismatches: string[] = [];
  let checked = 0;
  for (const record of subjects) {
    const binding = await labTapeBinding(record.experimentId);
    if (!binding) continue;
    for (const checkpoint of record.checkpoints ?? []) {
      let replayed: string;
      try {
        replayed = await replayedDigest(binding, record, checkpoint.actionIndex);
      } catch (error) {
        mismatches.push(
          `${record.tapeId} @${checkpoint.actionIndex}: replay refused: ${String(error).slice(0, 120)}`,
        );
        continue;
      }
      checked++;
      logger.info("A recorded checkpoint was evaluated through its laboratory owner.", {
        testId: `${record.tapeId}@${checkpoint.actionIndex}`,
        tapeId: record.tapeId,
        actionIndex: checkpoint.actionIndex,
        bindingKind: binding.kind,
        recordedDigest: checkpoint.digest,
        replayedDigest: replayed,
      });
      if (replayed !== checkpoint.digest) {
        mismatches.push(
          `${record.tapeId} @${checkpoint.actionIndex} (${record.experimentId}): record ${checkpoint.digest}, replay ${replayed}`,
        );
      }
    }
  }
  return { checked, mismatches };
}

describe("recorded checkpoint digests", () => {
  test("the corpus is non-vacuous, and the two populations are named", () => {
    // Denominators, reported. A pass over zero drivable tapes is what this test exists to refuse.
    console.log(
      `[census] teaching tapes: ${records.length} record(s); ${drivable.length} with a laboratory replay binding, ` +
        `${notDrivable.length} with only a draft binding (${notDrivable.map((r) => r.tapeId).join(", ")})`,
    );
    expect(records.length).toBeGreaterThanOrEqual(22);
    expect(drivable.length).toBeGreaterThanOrEqual(17);
    // Preserve the existing exclusion ceiling as laboratories gain explicit replay owners.
    expect(notDrivable.length).toBeLessThanOrEqual(5);
  });

  test("every checkpoint of a drivable tape reproduces under replay", async () => {
    const { checked, mismatches } = await auditDigests(drivable);
    console.log(
      `[census] checkpoint digests replayed: ${checked}, mismatched: ${mismatches.length}`,
    );
    // Non-vacuity before the verdict: 26 checkpoints across 17 tapes, measured 2026-10-20. A
    // binding that stopped importing would otherwise take this to zero checked and still pass.
    expect(checked).toBeGreaterThanOrEqual(26);
    expect(mismatches, mismatches.join("\n")).toEqual([]);
  });

  test("worker factory records remain audited and detect a corrupted accepted-state digest", async () => {
    for (const experimentId of ["lq-01", "sr-03"]) {
      const binding = await labTapeBinding(experimentId);
      expect(binding?.kind).toBe("worker");
      const subject = drivable.find((record) => record.experimentId === experimentId);
      assert.ok(subject, `${experimentId}'s factory must put its tapes in the audited population.`);
      expect(notDrivable.some((record) => record.experimentId === experimentId)).toBe(false);
      const first = subject.checkpoints?.[0];
      assert.ok(first);
      const flipped = `${first.digest.slice(0, -1)}${first.digest.endsWith("0") ? "1" : "0"}`;
      const planted: TapeRecord = {
        ...subject,
        checkpoints: (subject.checkpoints ?? []).map((entry, index) =>
          index === 0 ? { ...entry, digest: flipped } : entry,
        ),
      };
      expect(planted.checkpoints?.[0]?.digest).toBe(flipped);
      const corrupted = await auditDigests([planted]);
      expect(corrupted.checked).toBeGreaterThan(0);
      expect(corrupted.mismatches.some((finding) => finding.includes(flipped))).toBe(true);
      expect(corrupted.mismatches.some((finding) => finding.includes(first.digest))).toBe(true);
      const clean = await auditDigests([subject]);
      expect(clean.checked).toBeGreaterThan(0);
      expect(clean.mismatches).toEqual([]);
    }
  });

  test("PLANTED: a corrupted digest on a real record is caught, and the finding names it", async () => {
    /*
     * WHICH HALF OF THE QUESTION THIS ANSWERS. The predicate is driven with a real laboratory, a
     * real record and a real replay; what it does NOT exercise is reading the YAML off disk, because
     * planting a bad digest into `content/` would put a defect in a checkout several agents share.
     * So the record is mutated in memory and the same `auditDigests` runs over it.
     *
     * The plant is a single hex digit flipped in an otherwise correct digest, which is the shape a
     * real regression takes: a laboratory's defaults change, the recorded digest no longer matches,
     * and nothing else about the record looks wrong.
     */
    const subject = drivable.find((r) => (r.checkpoints ?? []).length > 0);
    expect(subject, "no drivable record carries a checkpoint to corrupt").toBeDefined();
    if (!subject) return;
    const authentic = subject.checkpoints?.[0]?.digest ?? "";
    expect(authentic).toMatch(/^host:[0-9a-f]{16}$/);

    const flipped = `${authentic.slice(0, -1)}${authentic.endsWith("0") ? "1" : "0"}`;
    expect(flipped).not.toBe(authentic);
    const planted: TapeRecord = {
      ...subject,
      checkpoints: (subject.checkpoints ?? []).map((c, i) =>
        i === 0 ? { ...c, digest: flipped } : c,
      ),
    };
    // WHAT LANDED, before the verdict is read.
    expect(planted.checkpoints?.[0]?.digest).toBe(flipped);

    const { checked, mismatches } = await auditDigests([planted]);
    expect(checked).toBeGreaterThan(0);
    expect(mismatches.length, "the planted corruption was not caught").toBeGreaterThan(0);
    // The finding is actionable: it names the tape, the action index and both digests.
    expect(mismatches[0]).toContain(subject.tapeId);
    expect(mismatches[0]).toContain(flipped);
    expect(mismatches[0]).toContain(authentic);

    // AND THE CONTROL: the same record unmutated must produce no mismatch, or the red above is
    // about the fixture rather than about the flipped digit.
    const clean = await auditDigests([subject]);
    expect(clean.mismatches).toEqual([]);
    expect(clean.checked).toBeGreaterThan(0);
  });

  test("a tape with only a draft binding is excluded for the architecture, and says what it carries", () => {
    /*
     * Reported, not asserted. Each of these carries a run of one repeated hex digit, which the
     * permalink schema's digest pattern admits, so the record converts into a link whose checkpoint
     * can never verify. Whether that should convert is the owner's call; what this test refuses is
     * for the set to change silently.
     */
    const CONSTANT_RUN = /^host:sha256:([0-9a-f])\1{63}$/;
    for (const record of notDrivable) {
      const digests = (record.checkpoints ?? []).map((c) => c.digest);
      console.log(
        `[census] ${record.tapeId} (${record.experimentId}): ${digests.length} checkpoint(s), ` +
          `${digests.filter((d) => CONSTANT_RUN.test(d)).length} a run of one repeated digit`,
      );
      // The one thing asserted: such a record still declares checkpoints, so the day its lab gains
      // a replay binding the test above picks it up rather than finding nothing to judge.
      expect(digests.length, `${record.tapeId} declares no checkpoint`).toBeGreaterThan(0);
    }
  });
});
