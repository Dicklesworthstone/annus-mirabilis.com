import { afterEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseYaml } from "../../content/provenance/yaml.ts";
import { loadWalkthroughCatalogue } from "../../content/walkthroughs.ts";
import { HOST_WALK_NORMALS } from "../../physics/reference/diffusion/walks.ts";
import {
  bm05Laboratory,
  bm05ReplayFixture,
  recordBm05Checkpoints,
} from "../../testing/bm05ReplayHarness.ts";
import { parseU64 } from "../identity/u64.ts";
import {
  decodeTapePermalink,
  encodeTapePermalink,
  MAX_PERMALINK_URL_LENGTH,
} from "../permalink/codec.ts";
import { draftTapeForSettings, loadDraftTapeFromUrl } from "../permalink/draftTape.ts";
import { tapeStateDigestV2 } from "../permalink/sessionTape.ts";
import type { TapeScientificCheckpoint, TapeV2 } from "../permalink/types.ts";
import {
  applyWorkerSettings,
  restoreWorkerTape,
  type WorkerTapeSession,
} from "../permalink/workerSessionTape.ts";
import { validateControlTape } from "../tapes/schema.ts";
import { BM05_DEFAULTS, type Bm05Parameters } from "./definition.ts";
import { createBm05WalkthroughTarget } from "./tape.ts";

const fixture = await bm05ReplayFixture();
const record = validateControlTape(
  parseYaml(
    readFileSync(
      new URL("../../../content/experiments/tapes/coin-to-bell.yaml", import.meta.url),
      "utf8",
    ),
  ),
);
const walkthrough = loadWalkthroughCatalogue().walkthroughs.find(
  (entry) => entry.tapeId === record.tapeId,
);
assert.ok(walkthrough);
const sessions: WorkerTapeSession[] = [];
afterEach(() => {
  for (const session of sessions.splice(0)) session.disconnect();
});
function laboratory(options: Parameters<typeof bm05Laboratory>[1] = {}) {
  const lab = bm05Laboratory(fixture, options);
  sessions.push(lab.session);
  return lab;
}
function checkpoint(index: number): TapeV2 {
  const tape = walkthrough?.checkpoints[index]?.tape;
  assert.ok(tape, "The authored walk stop must be replayable.");
  return tape;
}
function changedState(tape: TapeV2, patch: Partial<TapeScientificCheckpoint>): TapeV2 {
  assert.ok(tape.acceptedCheckpoint.scientificState);
  return {
    ...tape,
    acceptedCheckpoint: {
      ...tape.acceptedCheckpoint,
      scientificState: { ...tape.acceptedCheckpoint.scientificState, ...patch },
    },
  };
}

test("authored stops retain their source, exact stream positions and complete settings in compact links", async () => {
  expect(walkthrough?.checkpoints).toHaveLength(6);
  for (const stop of [0, 1, 2, 3, 4, 5]) {
    const tape = checkpoint(stop);
    expect(tape.modelIdentity.artifactDigest).toBe(
      fixture.sourceDigest.replace(/^source:/, "host:"),
    );
    const href = `/lab/bm-05/?tape=${encodeTapePermalink(tape)}`;
    expect(href.length).toBeLessThanOrEqual(MAX_PERMALINK_URL_LENGTH);
    const decoded = decodeTapePermalink(href);
    assert.ok(decoded.kind === "success");
    expect(decoded.tape).toEqual(tape);
    expect(tape.initialConditions.stepRms).toBe(5e-7);
    expect(tape.acceptedCheckpoint.scientificState?.streamPositions).toHaveLength(2000);
    expect(tape.acceptedCheckpoint.scientificState?.streamPositions[1999]).toMatchObject({
      tile: "1999",
      index: stop === 5 ? "800" : "400",
    });
  }
});

test("a different calculation engine never substitutes its own digest for an authored checkpoint", async () => {
  const tape = checkpoint(0);
  const [local] = await recordBm05Checkpoints(
    fixture,
    tape.initialConditions as Bm05Parameters,
    tape.events,
  );
  assert.ok(local);
  const lab = laboratory();
  const accepted = lab.session.getSnapshot().accepted;
  const outcome = await restoreWorkerTape(lab.binding, lab.session, tape);
  if (local.tape.acceptedCheckpoint.digest === tape.acceptedCheckpoint.digest) {
    expect(outcome).toEqual({ kind: "restored" });
  } else {
    expect(outcome.kind).toBe("not-restored");
    if (outcome.kind === "not-restored") expect(outcome.notice).toContain("calculation engine");
    expect(lab.session.getSnapshot().accepted).toBe(accepted);
    expect(lab.channels).toHaveLength(1);
  }
}, 60_000);

test("ordinary links retain the exact full seed and recording grid without starting a worker", async () => {
  const lab = laboratory();
  const p = { ...BM05_DEFAULTS, seed: "18446744073709551615" };
  const tape = draftTapeForSettings(lab.binding, p);
  assert.ok(tape);
  expect(tape.seed).toBe(p.seed);
  expect(tape.initialConditions.seed).toBe(p.seed);
  expect(tape.constantSetId).toBe("not-applicable");
  expect(tape.replayGrid).toEqual({ baseSpacing: 0.1, horizon: 40 });
  const restored = await loadDraftTapeFromUrl(
    lab.binding,
    `https://annus-mirabilis.com/lab/bm-05/?tape=${encodeTapePermalink(tape)}`,
  );
  expect(restored.kind).toBe("loaded");
  if (restored.kind === "loaded") expect(restored.settings.seed).toBe(p.seed);
  expect(lab.channels).toHaveLength(0);
});

test("source, complete setup, command classes, seed and exact stream positions are checked before work", async () => {
  const original = checkpoint(0);
  const { seed: _seed, ...incomplete } = original.initialConditions;
  const event = original.events[0];
  assert.ok(event);
  const state = original.acceptedCheckpoint.scientificState;
  assert.ok(state);
  const first = state.streamPositions[0];
  assert.ok(first);
  const invalid: TapeV2[] = [
    {
      ...original,
      modelIdentity: { ...original.modelIdentity, artifactDigest: `host:sha256:${"0".repeat(64)}` },
    },
    { ...original, initialConditions: incomplete },
    { ...original, seed: parseU64("9007199254740993") },
    { ...original, events: [{ ...event, commandClass: "setup-change" }] },
    { ...original, replayGrid: { baseSpacing: 0.1, horizon: 39 } },
    changedState(original, { stepIndex: 4 }),
    changedState(original, { streamPositions: state.streamPositions.slice(1) }),
    changedState(original, {
      streamPositions: [{ ...first, index: parseU64("401") }, ...state.streamPositions.slice(1)],
    }),
  ];
  for (const tape of invalid) {
    const lab = laboratory();
    const accepted = lab.session.getSnapshot().accepted;
    expect((await restoreWorkerTape(lab.binding, lab.session, tape)).kind).toBe("not-restored");
    expect(lab.session.getSnapshot().accepted).toBe(accepted);
    expect(lab.channels).toHaveLength(0);
  }
});

test("a settings-only digest cannot masquerade as an observed scientific checkpoint", async () => {
  const lab = laboratory();
  const tape = checkpoint(0);
  const accepted = lab.session.getSnapshot().accepted;
  const digest = tapeStateDigestV2({ ...tape.initialConditions, n: 4 }, 1);
  const outcome = await restoreWorkerTape(lab.binding, lab.session, {
    ...tape,
    acceptedCheckpoint: { ...tape.acceptedCheckpoint, digest },
  });
  expect(outcome.kind).toBe("not-restored");
  expect(lab.session.getSnapshot().accepted).toBe(accepted);
  expect(lab.channels.every((channel) => channel.disposed)).toBe(true);
});

test("corrupt live walker coordinates are refused after a successful isolated replay", async () => {
  const lab = laboratory({
    transform(message, channel) {
      if (channel === 1 && message.result.kind === "accepted") {
        const positions = message.result.data.outputs.find(
          (output) => output.quantityId === "walkPositions",
        );
        assert.ok(positions?.status === "value" && positions.value instanceof Float64Array);
        positions.value[0] = (positions.value[0] ?? 0) + 1e-8;
      }
      return message;
    },
  });
  const accepted = lab.session.getSnapshot().accepted;
  const [local] = await recordBm05Checkpoints(fixture, { ...fixture.example.parameters, n: 0 }, [
    {
      actionIndex: 1,
      commandClass: "measurement-change",
      paramId: "n",
      value: 4,
      previousValue: 0,
    },
  ]);
  assert.ok(local);
  const outcome = await restoreWorkerTape(lab.binding, lab.session, local.tape);
  expect(outcome.kind).toBe("not-restored");
  expect(lab.channels).toHaveLength(2);
  expect(lab.session.getSnapshot().accepted).toBe(accepted);
});

test("Gaussian engine fallback cannot restore a pinned trial but can explicitly calculate a new one", async () => {
  const initial = { ...BM05_DEFAULTS, walkers: 8, runSteps: 4, n: 0, kernel: "gaussian" as const };
  const [stop] = await recordBm05Checkpoints(fixture, initial, [
    {
      actionIndex: 1,
      commandClass: "measurement-change",
      paramId: "n",
      value: 4,
      previousValue: 0,
    },
  ]);
  assert.ok(stop);
  const lab = laboratory({ normals: () => HOST_WALK_NORMALS });
  const accepted = lab.session.getSnapshot().accepted;
  const restored = await restoreWorkerTape(lab.binding, lab.session, stop.tape);
  expect(restored.kind).toBe("not-restored");
  if (restored.kind === "not-restored") expect(restored.notice).toContain("pinned FrankenSim");
  expect(lab.session.getSnapshot().accepted).toBe(accepted);
  const target = createBm05WalkthroughTarget(lab.binding, lab.session, () => {});
  assert.ok(target.calculate);
  expect(await target.calculate({ ...initial, n: 4 })).toEqual({ kind: "calculated" });
  expect(lab.session.getSnapshot().accepted?.runId).not.toBe(accepted?.runId);
  expect(
    lab.session
      .getSnapshot()
      .accepted?.outputs.find((output) => output.quantityId === "walkPositions")?.ownerId,
  ).toBe("diffusion.recordWalks");
});

test("cancelling paused replay discards its isolated owner without publishing a late result", async () => {
  const lab = laboratory({ hold: () => true });
  const accepted = lab.session.getSnapshot().accepted;
  lab.session.setSchedulingPaused(true);
  const controller = new AbortController();
  const pending = restoreWorkerTape(lab.binding, lab.session, checkpoint(0), {
    signal: controller.signal,
  });
  await new Promise<void>((resolve) => setTimeout(resolve, 10));
  expect(lab.channels).toHaveLength(0);
  lab.session.setSchedulingPaused(false);
  const trial = await lab.channel(0);
  await trial.result;
  controller.abort();
  const outcome = await pending;
  expect(outcome.kind).toBe("not-restored");
  expect(trial.disposed).toBe(true);
  trial.release();
  await Promise.resolve();
  expect(lab.channels).toHaveLength(1);
  expect(lab.session.getSnapshot().accepted).toBe(accepted);
});

test("a reentrant newer setup wins without inheriting the outer measurement and estimator changes", async () => {
  const lab = laboratory();
  let switched = false;
  const newer = { ...fixture.example.parameters, seed: "9007199254740993", n: 2, bias: 0.2 };
  const unsubscribe = lab.session.subscribe(() => {
    if (switched) return;
    switched = true;
    lab.session.apply(newer);
  });
  const outcome = lab.session.apply({ ...newer, seed: "9007199254740995", n: 3, bias: 0.8 });
  unsubscribe();
  expect(outcome.kind).toBe("outcome");
  expect(lab.session.getSnapshot().requested?.parameters).toEqual(newer);
  expect(await applyWorkerSettings(lab.session, newer)).toEqual({ kind: "restored" });
  expect(lab.session.acceptedParameters()).toEqual(newer);
});
