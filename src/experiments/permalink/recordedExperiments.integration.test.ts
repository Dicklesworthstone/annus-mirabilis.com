import { describe, expect, test } from "bun:test";
import { ME01_TAPE } from "../me01/tape.ts";
import {
  captureRecordedStop,
  type RecordedExperiment,
  type RecordingResult,
  readRecordedExperiment,
  recordedExperimentWalkthrough,
  writeRecordedExperiment,
} from "./recordedExperiments.ts";
import { validateTapeV2 } from "./schema.ts";
import { restoreTape, tapeForSettings } from "./sessionTape.ts";
import type { TapeV2 } from "./types.ts";
import { applyWalkthroughCheckpoint, type WalkthroughTarget } from "./walkthroughActions.ts";

/** The accepted value, or a failure naming the notice. Was `valueOf`, which shadows the global. */
function acceptedValue<T>(outcome: RecordingResult<T>): T {
  expect(outcome.kind).toBe("accepted");
  if (outcome.kind !== "accepted") throw new Error(outcome.notice);
  return outcome.value;
}
function snapshot(frameSpeed: number): TapeV2 {
  const tape = tapeForSettings(ME01_TAPE, { ...ME01_TAPE.defaults, frameSpeed });
  expect(tape).not.toBeNull();
  if (!tape) throw new Error("ME-01 did not accept the test settings.");
  return tape;
}
function saved(tape: TapeV2, previous: RecordedExperiment | null = null) {
  return acceptedValue(
    captureRecordedStop(
      previous,
      tape,
      "Two observers",
      "Observer",
      "Compare the same emission.",
      validateTapeV2,
    ),
  );
}
function reader() {
  const session = ME01_TAPE.createSession("recording-reader");
  const target: WalkthroughTarget = {
    kind: "session",
    experimentId: "me-01",
    restore(tape) {
      const outcome = restoreTape(ME01_TAPE, session, tape);
      return outcome.kind === "restored"
        ? outcome
        : {
            kind: "not-restored",
            notice: outcome.kind === "not-restored" ? outcome.notice : "No tape was restored.",
          };
    },
  };
  return { session, target };
}

describe("reader recordings through ME-01's real tape validator and session", () => {
  test("export and import retain two real checkpoints; seeking backwards restores the first", () => {
    const first = snapshot(0.6);
    const second = snapshot(-0.2);
    const recording = saved(second, saved(first));
    const file = acceptedValue(writeRecordedExperiment(recording, validateTapeV2));
    const imported = acceptedValue(readRecordedExperiment(file, "me-01", validateTapeV2));
    const { session, target } = reader();
    const before = session.getSnapshot();
    const walkthrough = recordedExperimentWalkthrough(imported);
    // Parsing and building a selection are pure; only the explicit action runs the session.
    expect(session.getSnapshot()).toBe(before);
    expect(applyWalkthroughCheckpoint(target, walkthrough, 1).kind).toBe("replayed");
    expect(session.acceptedParameters()).toMatchObject({ frameSpeed: -0.2 });
    expect(applyWalkthroughCheckpoint(target, walkthrough, 0).kind).toBe("replayed");
    expect(session.acceptedParameters()).toMatchObject({ frameSpeed: 0.6 });
    expect(imported.stops.map((stop) => stop.tape.acceptedCheckpoint.digest)).toEqual([
      first.acceptedCheckpoint.digest,
      second.acceptedCheckpoint.digest,
    ]);
  });

  test("a tampered but schema-valid digest is retained at import and refused without touching the reader", () => {
    const original = snapshot(0.6);
    const tampered: TapeV2 = {
      ...original,
      acceptedCheckpoint: { ...original.acceptedCheckpoint, digest: "host:0000000000000000" },
    };
    expect(original.acceptedCheckpoint.digest).not.toBe(tampered.acceptedCheckpoint.digest);
    const recording = saved(tampered);
    const { session, target } = reader();
    const before = session.getSnapshot();
    const parameters = { ...session.acceptedParameters() };
    expect(
      applyWalkthroughCheckpoint(target, recordedExperimentWalkthrough(recording), 0).kind,
    ).toBe("refused");
    expect(session.getSnapshot()).toBe(before);
    expect(session.acceptedParameters()).toEqual(parameters);
  });

  test("import never rewrites an incompatible constant set to make restoration succeed", () => {
    const recording = saved({ ...snapshot(0.6), constantSetId: "historical-not-current" });
    const { session, target } = reader();
    const before = session.getSnapshot();
    expect(recording.stops[0]?.tape.constantSetId).toBe("historical-not-current");
    expect(
      applyWalkthroughCheckpoint(target, recordedExperimentWalkthrough(recording), 0).kind,
    ).toBe("refused");
    expect(session.getSnapshot()).toBe(before);
  });

  test("the real wire validator rejects an invalid later tape and returns no imported prefix", () => {
    const first = snapshot(0.6);
    const recording = saved(snapshot(0.2), saved(first));
    const invalid = {
      ...recording,
      stops: recording.stops.map((stop, index) =>
        index === 1 ? { ...stop, tape: { ...stop.tape, seed: "-1" } } : stop,
      ),
    };
    const outcome = readRecordedExperiment(JSON.stringify(invalid), "me-01", validateTapeV2);
    expect(outcome.kind).toBe("refused");
    expect(Object.hasOwn(outcome, "value")).toBe(false);
    expect(recording.stops[1]?.tape.seed).toBe("0");
  });

  test("a form-only adapter receives settings but never receives a claim of reproduced results", () => {
    const recording = saved(snapshot(0.6));
    const loaded: object[] = [];
    const target: WalkthroughTarget = {
      kind: "form",
      experimentId: "me-01",
      load(settings) {
        loaded.push(settings);
        return { kind: "loaded" };
      },
    };
    const outcome = applyWalkthroughCheckpoint(target, recordedExperimentWalkthrough(recording), 0);
    expect(loaded).toEqual([recording.stops[0]?.tape.initialConditions]);
    expect(outcome.kind).toBe("loaded");
    expect(outcome.notice).toContain("has not been verified");
  });
});
