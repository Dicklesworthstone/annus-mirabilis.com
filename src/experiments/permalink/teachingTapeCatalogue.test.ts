/**
 * THE GENERATED CATALOGUE REPLAYS WITHOUT A NODE LOADER (am-2rl9, dispatch 382).
 *
 * `teachingTapeReplay.test.ts` proves ME-01 replays `the-two-pulses`, but it reaches the records
 * through `loadWireTeachingTapes`, which uses `node:fs` and cannot run where an instrument runs.
 * This proves the same replay through the artifact a browser would get: an imported JSON module and
 * nothing else.
 *
 * The two are not redundant. If the generator ever writes a map that differs from the records, the
 * other file stays green and this one goes red, which is the only way that drift becomes visible.
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
  resolveTeachingTape,
  TEACHING_TAPE_PROBLEMS,
  TEACHING_TAPES,
} from "./teachingTapeCatalogue.ts";
import { teachingStepIndexForCheckpoint } from "./teachingTapeResolver.ts";
import type { TapeV2 } from "./types.ts";

const ROOT = resolve(new URL("../../../", import.meta.url).pathname);
const TAPE_ID = "the-two-pulses";
const record = validateControlTape(
  strictParse(
    readFileSync(resolve(ROOT, "content/experiments/tapes/the-two-pulses.yaml"), "utf8"),
    "yaml",
  ),
);

describe("the generated teaching-tape catalogue", () => {
  test("carries the walkthroughs, and says which records it could not carry", () => {
    // Non-vacuity on a measured count: 12 of the 22 records convert (2026-09-28). An empty
    // catalogue would satisfy every "resolves to null" assertion below.
    expect(TEACHING_TAPES.size).toBeGreaterThanOrEqual(10);
    expect(TEACHING_TAPES.has(TAPE_ID)).toBe(true);
    expect(resolveTeachingTape(TAPE_ID)).toBe(TEACHING_TAPES.get(TAPE_ID) as TapeV2);
    expect(resolveTeachingTape("no-such-walkthrough")).toBeNull();
    // The silence is visible: a record that cannot be carried names its file and its field.
    expect(TEACHING_TAPE_PROBLEMS.length).toBeGreaterThan(0);
    for (const p of TEACHING_TAPE_PROBLEMS) expect(p).toContain("content/experiments/tapes/");
  });

  test("agrees with the records it was generated from, tape for tape", () => {
    // The drift check. The artifact is a build product and `src/generated/` is gitignored, so it
    // can only go stale by a lane failing to run, and this is what notices when it does.
    const { tapes: fromRecords } = loadWireTeachingTapes(ROOT);
    expect(TEACHING_TAPES.size).toBe(fromRecords.size);
    for (const [id, fromDisk] of fromRecords) {
      expect(TEACHING_TAPES.has(id), `${id} missing from the generated catalogue`).toBe(true);
      expect(JSON.stringify(TEACHING_TAPES.get(id)), `${id} differs`).toBe(
        JSON.stringify(fromDisk),
      );
    }
  });

  test("ME-01 replays the-two-pulses through the catalogue alone", () => {
    const authored = TEACHING_TAPES.get(TAPE_ID);
    if (!authored) throw new Error("the catalogue does not carry the walkthrough");
    const opening = tapeForSettings(ME01_TAPE, {
      ...ME01_TAPE.defaults,
      ...authored.initialConditions,
    });
    if (!opening) throw new Error("ME-01 refused the walkthrough's opening settings");

    let reproduced = 0;
    for (let i = 0; i < record.checkpoints.length; i++) {
      const cp = record.checkpoints[i];
      if (!cp) continue;
      const stepIndex = teachingStepIndexForCheckpoint(i);
      const runner = createSessionReplayRunner(
        ME01_TAPE,
        ME01_TAPE.createSession(`me-01-catalogue-${i}`),
      );
      const tape: TapeV2 = {
        ...opening,
        acceptedCheckpoint: {
          acceptedActionIndex: cp.actionIndex,
          acceptedInputRevision: 0,
          digest: cp.digest,
        },
        ...(stepIndex === null ? {} : { teachingTapeRef: { tapeId: TAPE_ID, stepIndex } }),
      };
      // The resolver here is the generated one: no node:fs on this path.
      if (replayTape(tape, { ...runner, resolveTeachingTape }).kind === "success") reproduced += 1;
    }
    console.log(
      `[teaching-tape catalogue] ${reproduced} of ${record.checkpoints.length} checkpoints reproduced from the generated artifact`,
    );
    // A floor, not a census: checkpoint 3's recorded digest is a content finding on am-2rl9, so
    // repairing that record turns this greener rather than red.
    expect(reproduced).toBeGreaterThanOrEqual(3);
  });
});
