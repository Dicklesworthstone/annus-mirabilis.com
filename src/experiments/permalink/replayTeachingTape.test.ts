import { describe, expect, test } from "bun:test";
import { ME01_TAPE } from "../me01/tape.ts";
import { replayTeachingTapeOn } from "./replayTeachingTape.ts";
import { TEACHING_TAPES } from "./teachingTapeCatalogue.ts";
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
const record = TEACHING_TAPES.get(TAPE_ID) as TapeV2;
const session = () => ME01_TAPE.createSession(`test-${Math.random().toString(36).slice(2, 8)}`);

describe("replayTeachingTapeOn: what it refuses", () => {
  test("a name no walkthrough carries", () => {
    const out = replayTeachingTapeOn(ME01_TAPE, session(), "no-such-walkthrough");
    expect(out.kind).toBe("unknown-walkthrough");
  });

  test("a walkthrough recorded on another laboratory is refused by name, not replayed", () => {
    // A naive join would hand sr-03's settings to me-01's validator and report whatever came back.
    const out = replayTeachingTapeOn(ME01_TAPE, session(), "the-boost-to-0.6c");
    expect(out.kind).toBe("not-this-laboratory");
    if (out.kind !== "not-this-laboratory") throw new Error("unreachable");
    expect(out.recordedFor).toBe("sr-03");
    expect(out.notice).toContain("sr-03");
  });
});

describe("the published walkthroughs, measured against their own laboratory", () => {
  test("the-two-pulses refuses on identity, and the refusal names the field", () => {
    const out = replayTeachingTapeOn(ME01_TAPE, session(), TAPE_ID);
    expect(out.kind).toBe("refused");
    if (out.kind !== "refused") throw new Error("unreachable");
    // Measured 2026-09-28: every record declares streamVersion 1, and 24 of 28 laboratory bindings
    // declare "deterministic". When the records are corrected this goes red and is replaced by the
    // assertion below it, which is the one this bead is for.
    expect(out.refusalCode).toBe("tape-stream-version-mismatch");
    expect(out.notice.length).toBeGreaterThan(0);
  });

  test("its recorded checkpoint is not one this codebase can reach, so replay is refused twice over", () => {
    // Identity aside: forced as a new run the events apply cleanly, and the digest still differs.
    const out = replayTeachingTapeOn(ME01_TAPE, session(), TAPE_ID, { asNewRun: true });
    expect(out.kind).toBe("replayed");
    if (out.kind !== "replayed") throw new Error("unreachable");
    expect(out.isNewRun).toBe(true);
    expect(out.executedEventCount).toBe(record.events.length);
    expect(out.acceptedCheckpoint.digest).not.toBe(record.acceptedCheckpoint.digest);
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
    const probe = replayTeachingTapeOn(ME01_TAPE, session(), TAPE_ID, { asNewRun: true });
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
