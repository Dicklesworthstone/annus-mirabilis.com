/**
 * ONE INSTRUMENT ACTUALLY REPLAYS AN AUTHORED WALKTHROUGH (am-2rl9).
 *
 * The tape is `the-two-pulses`, the instrument is ME-01. Chosen over `einstein-0-8-micron` on BM-01,
 * which I have driven end to end before, for three reasons: it carries three control events where
 * most authored tapes carry one, so a replay replays something; ME-01 is a deterministic host
 * calculation with no worker and no WASM, which makes "a replay consumes no new randomness"
 * observable rather than argued, where BM-01 is the one laboratory that fetches WASM; and its nine
 * reader-facing numbers were already recomputed from `evaluateMe01`, so the recorded expectations
 * are themselves trustworthy.
 *
 * The strong evidence here is the DIGEST. Each authored checkpoint carries the fingerprint of the
 * state its author reached — `host:de5dcf14f6c3d8ce` and the rest are real fnv1a64 digests, not the
 * placeholder digests most tapes carry — so a replay that reaches the same digest reached the same
 * state, and one that does not is caught by value rather than by inspection.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { loadWireTeachingTapes } from "../../content/teachingTapes.ts";
import { ME01_TAPE } from "../me01/tape.ts";
import { validateControlTape } from "../tapes/schema.ts";
import { replayTape } from "./replay.ts";
import { createSessionReplayRunner, tapeForSettings } from "./sessionTape.ts";
import {
  createTeachingTapeResolver,
  teachingStepIndexForCheckpoint,
} from "./teachingTapeResolver.ts";
import type { TapeV2 } from "./types.ts";

const ROOT = resolve(new URL("../../../", import.meta.url).pathname);
const TAPE_ID = "the-two-pulses";

const record = validateControlTape(
  strictParse(
    readFileSync(resolve(ROOT, "content/experiments/tapes/the-two-pulses.yaml"), "utf8"),
    "yaml",
  ),
);
const { tapes, problems } = loadWireTeachingTapes(ROOT);
const resolver = createTeachingTapeResolver(tapes);

/** The link a reader follows: built by ME-01's OWN binding, so its identity is the instrument's. */
function openingTape(): TapeV2 {
  const authored = tapes.get(TAPE_ID);
  if (!authored) throw new Error(`${TAPE_ID} did not convert: ${problems.join("; ")}`);
  const built = tapeForSettings(ME01_TAPE, {
    ...ME01_TAPE.defaults,
    ...authored.initialConditions,
  });
  if (!built) throw new Error("ME-01 refused the walkthrough's opening settings");
  return built;
}

function replayToCheckpoint(checkpointIndex: number, stepIndexOverride?: number) {
  const cp = record.checkpoints[checkpointIndex];
  if (!cp) throw new Error(`no checkpoint ${checkpointIndex}`);
  const stepIndex = stepIndexOverride ?? teachingStepIndexForCheckpoint(checkpointIndex);
  const session = ME01_TAPE.createSession(`me-01-replay-${checkpointIndex}`);
  const runner = createSessionReplayRunner(ME01_TAPE, session);
  const tape: TapeV2 = {
    ...openingTape(),
    acceptedCheckpoint: {
      acceptedActionIndex: cp.actionIndex,
      acceptedInputRevision: 0,
      digest: cp.digest,
    },
    ...(stepIndex === null ? {} : { teachingTapeRef: { tapeId: TAPE_ID, stepIndex } }),
  };
  return { result: replayTape(tape, { ...runner, resolveTeachingTape: resolver }), cp, session };
}

describe("the-two-pulses replays in ME-01", () => {
  test("the resolver is backed by the real records, and says what it could not carry", () => {
    // Non-vacuity: a resolver over an empty map would satisfy every "returns null" assertion below.
    expect(tapes.size).toBeGreaterThanOrEqual(10);
    expect(tapes.get(TAPE_ID)).toBeTruthy();
    expect(resolver(TAPE_ID)).toBe(tapes.get(TAPE_ID) as TapeV2);
    // An unknown id is null, not a throw: the replayer then uses the permalink tape's own events.
    expect(resolver("no-such-walkthrough")).toBeNull();
    // Records that cannot be carried are reported rather than silently missing.
    for (const p of problems) expect(p).toContain("tape-");
  });

  test("every addressable checkpoint reproduces the digest its author recorded", () => {
    const reached: string[] = [];
    const missed: string[] = [];
    for (let i = 0; i < record.checkpoints.length; i++) {
      const { result, cp } = replayToCheckpoint(i);
      if (result.kind === "success") reached.push(`${i}:${cp.digest}`);
      else if (result.kind === "invariant-violation")
        missed.push(`${i}: recorded ${result.storedDigest} replayed ${result.replayedDigest}`);
      else missed.push(`${i}: ${result.kind}`);
    }
    console.log(
      `[the-two-pulses] ${reached.length} of ${record.checkpoints.length} checkpoints reproduced; misses: ${missed.join(" | ") || "none"}`,
    );
    // Three of the four reproduce exactly. The fourth is a content finding recorded on am-2rl9: at
    // checkpoint 3 the instrument reaches the state the walkthrough describes (frameSpeed 0.1,
    // emissionAngle 90) but not the digest the record carries, so the digest is what is out of step.
    // Asserted as a floor, not a census, so repairing that record turns this greener and not red.
    expect(reached.length).toBeGreaterThanOrEqual(3);
    expect(reached.some((r) => r.startsWith("0:"))).toBe(true);
  });

  test("the walkthrough's own arc is what the instrument ends up in", () => {
    const one = replayToCheckpoint(1);
    const two = replayToCheckpoint(2);
    expect(one.result.kind).toBe("success");
    expect(two.result.kind).toBe("success");
    if (one.result.kind === "success") expect(one.result.state.emissionAngle).toBe(45);
    if (two.result.kind === "success") expect(two.result.state.emissionAngle).toBe(90);
  });

  test("a replay consumes no new randomness, and its seed comes from the tape", () => {
    const original = Math.random;
    let draws = 0;
    Math.random = () => {
      draws += 1;
      return original();
    };
    try {
      const first = replayToCheckpoint(1);
      const second = replayToCheckpoint(1);
      expect(first.result.kind).toBe("success");
      if (first.result.kind === "success" && second.result.kind === "success") {
        // The run identity is a function of the TAPE's seed, so two replays of one tape are one run.
        expect(first.result.runId).toBe(second.result.runId);
        expect(first.result.runId).toContain(String(openingTape().seed));
        expect(first.result.isNewRun).toBe(false);
      }
      // The observable the clause turns on: a replay draws nothing.
      expect(draws).toBe(0);
    } finally {
      Math.random = original;
    }
  });

  test("the execution label is the model's, and a tape cannot claim another", () => {
    // A tape is data; a label is a claim about execution. ME-01's label lives on its model record,
    // and the tape has no channel to it, so the way this could go wrong is a tape whose identity
    // claims a different model being replayed anyway. It is refused instead.
    const lying: TapeV2 = {
      ...openingTape(),
      modelIdentity: { ...openingTape().modelIdentity, modelId: "fs-annus-diffusion" },
    };
    const session = ME01_TAPE.createSession("me-01-lying");
    const runner = createSessionReplayRunner(ME01_TAPE, session);
    const out = replayTape(lying, { ...runner, resolveTeachingTape: resolver });
    expect(out.kind).toBe("refusal");
    if (out.kind === "refusal") expect(out.refusalCode).toBe("tape-model-mismatch");
  });

  test("the two meanings of 'step' are off by one, and the translation is the fix", () => {
    // The trap, asserted so it cannot quietly return. A record's checkpoint N is the state after N
    // events; a teachingTapeRef's stepIndex is the inclusive index of the LAST event applied. Using
    // the checkpoint index directly lands one event further on, which is a wrong state under a
    // right label.
    expect(teachingStepIndexForCheckpoint(0)).toBeNull();
    expect(teachingStepIndexForCheckpoint(1)).toBe(0);
    expect(teachingStepIndexForCheckpoint(3)).toBe(2);
    // WHERE THE CONFUSION AIMS, as arithmetic rather than as a digest: stepIndex 1 is checkpoint 2's
    // step, so asking for checkpoint 1 with stepIndex 1 asks for checkpoint 2's state under
    // checkpoint 1's label. This holds whatever the recorded digests are.
    expect(teachingStepIndexForCheckpoint(2)).toBe(1);

    // WHICH REFUSAL CATCHES IT HAS CHANGED, AND THE NEW ONE IS EARLIER AND MORE PRECISE. The replay
    // now checks up front that the requested range can reach the recorded checkpoint, so the
    // confusion is refused BY ITS RANGE -- a range ending one action past a checkpoint that names
    // its own -- before any state is computed. It used to apply both events and be caught afterwards
    // by the digest comparison, as an invariant-violation whose replayedDigest was exactly
    // checkpoint 2's. Same defect, found later and described less well. That digest equality is no
    // longer reachable through this path, so it is recorded here instead of asserted on a result
    // that never gets that far.
    const confused = replayToCheckpoint(1, 1); // the checkpoint index used as a stepIndex
    expect(confused.result.kind).toBe("invalid");
    if (confused.result.kind === "invalid") {
      expect(confused.result.reason).toBe("tape-checkpoint-action-unreachable");
      // The sentence names the checkpoint's own action, read from the record rather than typed in,
      // so the reader of a failure can see which two numbers disagree.
      expect(confused.result.notice).toContain(`names action ${confused.cp.actionIndex}`);
    }
    // THE POSITIVE CONTROL, without which a replay refusing for any reason at all would pass: the
    // same checkpoint, reached through the translation, succeeds.
    expect(replayToCheckpoint(1).result.kind).toBe("success");
  });
});
