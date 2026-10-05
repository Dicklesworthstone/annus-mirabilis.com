import { describe, expect, test } from "bun:test";
import { loadWireTeachingTapes } from "../../content/teachingTapes.ts";
import { ME01_TAPE } from "../me01/tape.ts";
import { replayTeachingTapeOn } from "./replayTeachingTape.ts";
import type { TapeV2 } from "./types.ts";

/**
 * Playing an authored walkthrough on a laboratory (am-2rl9).
 *
 * The corpus block below is a MEASUREMENT of what the published records can do today, pinned so it
 * changes when they do. The mechanism block is a DEMONSTRATION on a record built here, and it is
 * labelled as one: it shows that resolve, apply and verify work end to end when a walkthrough's
 * identity and checkpoint are its laboratory's, and it shows nothing about whether any authored
 * record replays. Those are different proof classes and this file never lets one stand for the
 * other.
 */
const TAPE_ID = "the-two-pulses";
/*
 * The records on disk, not src/generated/teaching-tapes.json.
 *
 * The generated catalogue is what a browser resolves through and it is right for the page, but it is
 * a layer between this test and the records, and prepare:lab is what keeps it current. Reading it
 * here meant this file could not see a record change at all: correcting 18 records left every
 * assertion below green against a catalogue built before them, in a tree where regenerating a shared
 * artifact is not mine to do. A check on the records reads the records.
 */
const FROM_RECORDS = loadWireTeachingTapes().tapes as ReadonlyMap<string, TapeV2>;
const fromRecords = (id: string): TapeV2 | null => FROM_RECORDS.get(id) ?? null;
const record = FROM_RECORDS.get(TAPE_ID) as TapeV2;
const session = () => ME01_TAPE.createSession(`test-${Math.random().toString(36).slice(2, 8)}`);

describe("replayTeachingTapeOn: what it refuses", () => {
  test("a name no walkthrough carries", () => {
    const out = replayTeachingTapeOn(ME01_TAPE, session(), "no-such-walkthrough", {
      resolve: fromRecords,
    });
    expect(out.kind).toBe("unknown-walkthrough");
  });

  test("a walkthrough recorded on another laboratory is refused by name, not replayed", () => {
    // A naive join would hand sr-03's settings to me-01's validator and report whatever came back.
    const out = replayTeachingTapeOn(ME01_TAPE, session(), "the-boost-to-0.6c", {
      resolve: fromRecords,
    });
    expect(out.kind).toBe("not-this-laboratory");
    if (out.kind !== "not-this-laboratory") throw new Error("unreachable");
    expect(out.recordedFor).toBe("sr-03");
    expect(out.notice).toContain("sr-03");
  });
});

describe("the published walkthroughs, measured against their own laboratory", () => {
  test("the-two-pulses replays on ME-01 from its own record, and satisfies its own checkpoint", () => {
    const out = replayTeachingTapeOn(ME01_TAPE, session(), TAPE_ID, { resolve: fromRecords });
    /*
     * This asserted tape-stream-version-mismatch, then tape-checkpoint-mismatch, and now asserts a
     * replay. The three reasons measured in ac0bc2c2 are all answered for this record: its
     * allocation says what it is, its four checkpoint digests are ones a replay reaches, and the
     * default step stops where its last checkpoint was taken. Nothing here is forced: asNewRun is
     * not passed, so the identity check and the checkpoint verification both ran.
     */
    expect(out.kind).toBe("replayed");
    if (out.kind !== "replayed") throw new Error("unreachable");
    expect(out.isNewRun).toBe(false);
    expect(out.executedEventCount).toBe(3);
    expect(out.state.emissionAngle).toBe(90);
    expect(out.state.frameSpeed).toBe(0.1);
    expect(out.acceptedCheckpoint.digest).toBe(record.acceptedCheckpoint.digest);
  });

  test("a walkthrough checkpointed before its first event replays to that checkpoint, not past it", async () => {
    // lq-05-journey-stage-e records one event at actionIndex 1 and its only checkpoint at
    // actionIndex 0, the state BEFORE that event. Replaying to the last event reached a state no
    // checkpoint in the record describes and refused, with every digest in the file correct.
    const { LQ05_TAPE } = (await import("../lq05/tape.ts")) as {
      LQ05_TAPE: typeof ME01_TAPE;
    };
    const id = "lq-05-journey-stage-e";
    const tape = fromRecords(id);
    if (!tape) throw new Error(`${id} is not in the records`);
    expect(tape.events.length).toBe(1);
    expect(tape.acceptedCheckpoint.acceptedActionIndex).toBe(0);
    const out = replayTeachingTapeOn(LQ05_TAPE, LQ05_TAPE.createSession("lq05-step"), id, {
      resolve: (x) => (x === id ? tape : null),
    });
    expect(out.kind).toBe("replayed");
    if (out.kind !== "replayed") throw new Error("unreachable");
    expect(out.executedEventCount).toBe(0);
    // And naming the step explicitly still reaches past it, where the checkpoint no longer matches.
    const past = replayTeachingTapeOn(LQ05_TAPE, LQ05_TAPE.createSession("lq05-past"), id, {
      resolve: (x) => (x === id ? tape : null),
      stepIndex: 0,
    });
    expect(past.kind).toBe("refused");
    if (past.kind === "refused") expect(past.refusalCode).toBe("tape-checkpoint-mismatch");
  });

  test("its recorded checkpoint is reached at every step the record names", () => {
    const out = replayTeachingTapeOn(ME01_TAPE, session(), TAPE_ID, { resolve: fromRecords });
    expect(out.kind).toBe("replayed");
    if (out.kind !== "replayed") throw new Error("unreachable");
    /*
     * This asserted tape-stream-version-mismatch until the records declared the allocation they
     * actually have. Measured the same way before and after, over the same 12 convertible
     * walkthroughs: 12 of 12 refused, 8 of them on the stream version; now 8 are compatible and the
     * 4 that refuse are BM-01, BM-05, BM-07 on their constant set and BM-08 on its allocation, all
     * substantive differences on laboratories that really draw.
     *
     * So this walkthrough now reaches its own checkpoint, which is the SECOND of the three reasons
     * measured in ac0bc2c2 and is not this unit: six of the seven live-session records carry a
     * placeholder digest of one repeated digit, and this one carries host:15a92e1cf64617f2, which
     * matches no digest this codebase computes. When that is repaired this line goes red and the
     * assertion that replaces it is that a reader can play the walkthrough.
     */
    expect(out.acceptedCheckpoint.acceptedActionIndex).toBe(
      record.acceptedCheckpoint.acceptedActionIndex,
    );
  });

  test("forced as a new run it reaches the same state, and says it is a new run", () => {
    /*
     * This asserted that the digest DIFFERED, which was true while the record carried a checkpoint
     * no replay reached. The record now carries the digest a replay does reach, so the two agree and
     * what is left to check here is that asNewRun changes the run's identity and nothing else: the
     * same events, the same state, the same digest, reported as a new run rather than a restore.
     */
    const forced = replayTeachingTapeOn(ME01_TAPE, session(), TAPE_ID, {
      asNewRun: true,
      resolve: fromRecords,
    });
    const restored = replayTeachingTapeOn(ME01_TAPE, session(), TAPE_ID, { resolve: fromRecords });
    expect(forced.kind).toBe("replayed");
    expect(restored.kind).toBe("replayed");
    if (forced.kind !== "replayed" || restored.kind !== "replayed") throw new Error("unreachable");
    expect(forced.isNewRun).toBe(true);
    expect(restored.isNewRun).toBe(false);
    expect(forced.executedEventCount).toBe(record.events.length);
    expect(forced.state).toEqual(restored.state);
    expect(forced.acceptedCheckpoint.digest).toBe(record.acceptedCheckpoint.digest);
  });
});

describe("the mechanism, on a walkthrough whose identity is its laboratory's", () => {
  /**
   * The published record with ONLY its identity fields and its checkpoint replaced by the
   * laboratory's own. Its initial conditions and its three events are the authored ones. This is a
   * constructed record and proves the path, not the corpus.
   */
  function asRunnable(): TapeV2 {
    const env = ME01_TAPE.environment;
    const probe = replayTeachingTapeOn(ME01_TAPE, session(), TAPE_ID, {
      asNewRun: true,
      resolve: fromRecords,
    });
    if (probe.kind !== "replayed") throw new Error("the events do not apply at all");
    return {
      ...record,
      streamVersion: env.streamVersion,
      allocationId: env.allocationId,
      constantSetId: env.constantSetId,
      modelIdentity: { modelId: env.modelId, modelVersion: env.modelVersion },
      acceptedCheckpoint: probe.acceptedCheckpoint,
    };
  }

  const runnable = asRunnable();
  const play = (options = {}) =>
    replayTeachingTapeOn(ME01_TAPE, session(), TAPE_ID, {
      resolve: (id) => (id === TAPE_ID ? runnable : null),
      ...options,
    });

  test("resolves, applies every authored event, and satisfies the checkpoint", () => {
    const out = play();
    expect(out.kind).toBe("replayed");
    if (out.kind !== "replayed") throw new Error("unreachable");
    expect(out.isNewRun).toBe(false);
    expect(out.executedEventCount).toBe(3);
    expect(out.acceptedCheckpoint.digest).toBe(runnable.acceptedCheckpoint.digest);
    // The end state the walkthrough describes: the pair turned to 90 degrees, seen from 0.1c.
    expect(out.state.emissionAngle).toBe(90);
    expect(out.state.frameSpeed).toBe(0.1);
  });

  test("plays to a named step, so a page can walk a reader through one event at a time", () => {
    // The defect this covers was live: every record refers to itself with stepIndex 0, the replayer
    // honours that ref, and a join that passed the record through unchanged played 1 of 3 events
    // and called it success. Three tests in this file were red on it before the step was named.
    const angles = [0, 1, 2].map((stepIndex) => {
      const out = play({ stepIndex, asNewRun: true });
      if (out.kind !== "replayed") throw new Error("unreachable");
      return {
        events: out.executedEventCount,
        angle: out.state.emissionAngle,
        v: out.state.frameSpeed,
      };
    });
    expect(angles.map((a) => a.events)).toEqual([1, 2, 3]);
    // The authored walkthrough turns the pair 0 -> 45 -> 90, then changes the observer to 0.1c.
    expect(angles.map((a) => a.angle)).toEqual([45, 90, 90]);
    expect(angles.map((a) => a.v)).toEqual([0.6, 0.6, 0.1]);
    // A step past the end is the end, not a failure.
    const far = play({ stepIndex: 99, asNewRun: true });
    if (far.kind !== "replayed") throw new Error("unreachable");
    expect(far.executedEventCount).toBe(3);
  });

  test("two replays reach the same state and the same checkpoint, on separate sessions", () => {
    const first = play();
    const second = play();
    if (first.kind !== "replayed" || second.kind !== "replayed") throw new Error("unreachable");
    expect(second.state).toEqual(first.state);
    expect(second.acceptedCheckpoint.digest).toBe(first.acceptedCheckpoint.digest);
    expect(second.acceptedCheckpoint.acceptedActionIndex).toBe(
      first.acceptedCheckpoint.acceptedActionIndex,
    );
  });

  test("the observer change re-describes: the run id survives it, and only its revision moves", () => {
    const live = session();
    const seen: { runId: string; input: number; observer: number }[] = [];
    // Applied one at a time so the run id can be read on either side of the observer change.
    const runner = replayTeachingTapeOn(ME01_TAPE, live, TAPE_ID, {
      resolve: (id) => (id === TAPE_ID ? runnable : null),
    });
    expect(runner.kind).toBe("replayed");
    /*
     * TapeSession declares the MINIMUM a tape needs of a snapshot, `revisions.input`, so the run id
     * and the observer revision are read through the laboratory's own shape here rather than by
     * widening a shared interface on behalf of every laboratory. Both fields are ME-01's, and the
     * assertions below are what make the cast honest: if either were absent the test fails.
     */
    const accepted = live.getSnapshot().accepted as unknown as
      | Readonly<{ runId: string; revisions: Readonly<{ input: number; observer: number }> }>
      | null
      | undefined;
    expect(accepted).not.toBeNull();
    if (!accepted) throw new Error("unreachable");
    seen.push({
      runId: accepted.runId,
      input: accepted.revisions.input,
      observer: accepted.revisions.observer,
    });
    // The walkthrough's last event is the only observer-change, and the session counts it as one.
    expect(record.events.filter((e) => e.commandClass === "observer-change").length).toBe(1);
    expect(accepted.revisions.observer).toBe(1);
    // Two setup-changes and the initial conditions moved the input revision; the observer change
    // did not, and it started no new run: the run id is the one the last setup-change produced.
    expect(accepted.revisions.input).toBe(3);
    expect(accepted.runId.endsWith("/run/3")).toBe(true);
  });
});

describe("the refusal a reader is shown, and the two codes that reach it", () => {
  /*
   * replayTeachingTape.ts maps the replayer's two NON-refusal failures onto one refused shape with
   * two different codes: an `invariant-violation` becomes `tape-checkpoint-mismatch`, and an
   * `invalid` replay carries the replayer's own `reason`. Both branches are driven here on purpose.
   * A naive implementation that always returned `result.reason` passes a test that drives only the
   * first; one that always returned "tape-checkpoint-mismatch" passes a test that drives only the
   * second. Neither passes both, which is what makes this pair worth more than either half.
   *
   * These are constructed records, as the block above is. When this was written every published
   * record refused on identity before either branch could be reached; since the records declare the
   * allocation they have, 8 of the 12 pass identity and the-two-pulses reaches the checkpoint branch
   * with the corpus alone. The construction is still what drives the OTHER branch, and replacing a
   * digest here is still the only way to reach the checkpoint refusal deliberately rather than by
   * relying on a placeholder that is going to be repaired. It remains a DEMONSTRATION of this path.
   */
  function withLabIdentity(): TapeV2 {
    const env = ME01_TAPE.environment;
    const probe = replayTeachingTapeOn(ME01_TAPE, session(), TAPE_ID, {
      asNewRun: true,
      resolve: fromRecords,
    });
    if (probe.kind !== "replayed") throw new Error("the events do not apply at all");
    return {
      ...record,
      streamVersion: env.streamVersion,
      allocationId: env.allocationId,
      constantSetId: env.constantSetId,
      modelIdentity: { modelId: env.modelId, modelVersion: env.modelVersion },
      acceptedCheckpoint: probe.acceptedCheckpoint,
    };
  }

  test("a checkpoint the replay cannot reproduce is refused as tape-checkpoint-mismatch", () => {
    const reachable = withLabIdentity();
    // Identity is the laboratory's, so the compatibility check passes and the replay runs; only the
    // recorded digest is wrong. `asNewRun` is deliberately NOT passed, because forceNewRun skips
    // checkpoint verification and this is the verification's own refusal.
    const wrongCheckpoint: TapeV2 = {
      ...reachable,
      acceptedCheckpoint: { ...reachable.acceptedCheckpoint, digest: "host:0000000000000000" },
    };
    const out = replayTeachingTapeOn(ME01_TAPE, session(), TAPE_ID, {
      resolve: (id) => (id === TAPE_ID ? wrongCheckpoint : null),
    });
    // The defect this guards is a replay that applied every event and reported success while the
    // state it reached was not the one the walkthrough recorded.
    expect(out.kind).toBe("refused");
    if (out.kind !== "refused") throw new Error("unreachable");
    expect(out.refusalCode).toBe("tape-checkpoint-mismatch");
    expect(out.notice.length).toBeGreaterThan(0);
    // The same record with the digest left alone replays, so the refusal is the digest and not the
    // construction: without this line a record that refused for any reason would pass.
    const control = replayTeachingTapeOn(ME01_TAPE, session(), TAPE_ID, {
      resolve: (id) => (id === TAPE_ID ? reachable : null),
    });
    expect(control.kind).toBe("replayed");
  });

  test("an event the laboratory refuses carries the replayer's own reason, not the checkpoint code", () => {
    const reachable = withLabIdentity();
    const [first, ...rest] = reachable.events;
    // The compiled event carries `paramId`, not `parameterId`, and no `kind` discriminant. Asserted
    // rather than assumed, because a rename upstream would otherwise leave this test building an
    // event the laboratory ignores, which would refuse for the wrong reason and still be green.
    if (!first) throw new Error("the walkthrough has no events");
    expect(first.paramId).toBe("emissionAngle");
    // A frame speed of 5 is 5c. ME-01's session refuses it, `applyEvent` throws, and the replayer
    // returns kind "invalid" with reason "event-replay-failed" rather than an invariant violation.
    const refusedByTheLab: TapeV2 = {
      ...reachable,
      events: [{ ...first, paramId: "frameSpeed", value: 5, previousValue: 0.6 }, ...rest],
    };
    // THE WHOLE RECORD IS REPLAYED, AND `stepIndex: 0` WOULD HIDE WHAT THIS TEST ASKS. A replay is
    // refused up front when its requested range cannot reach the recorded checkpoint, and this
    // record's checkpoint is taken after its LAST event; stopping at the first one therefore ends
    // short of it, and the refusal that comes back is tape-checkpoint-mismatch, decided before the
    // laboratory is ever handed the event. The poisoned event is the first of the full range, so it
    // is reached either way, and the assertions below are about the laboratory's reason rather than
    // the range's. The sibling test above covers the mismatch code on its own.
    const out = replayTeachingTapeOn(ME01_TAPE, session(), TAPE_ID, {
      resolve: (id) => (id === TAPE_ID ? refusedByTheLab : null),
    });
    expect(out.kind).toBe("refused");
    if (out.kind !== "refused") throw new Error("unreachable");
    expect(out.refusalCode).toBe("event-replay-failed");
    expect(out.refusalCode).not.toBe("tape-checkpoint-mismatch");
    expect(out.notice.length).toBeGreaterThan(0);
  });
});
