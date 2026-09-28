/**
 * The 21 authored teaching tapes, read as a reader would meet them (am-2rl9).
 *
 * These records were checked by nothing before this file. They are schema-shaped YAML under
 * content/experiments/tapes/, AGENTS.md names five of them as a feature, and no component replayed
 * one: ControlTapeRecorder and ControlTapeReplayer have no non-test consumer, the tour code path
 * that would reveal a tape is used by no tour, and the only implementation of the replayer's
 * `resolveTeachingTape` hook is a test fixture. So the first thing to establish is that the records
 * say what a page would need, and that is what this asserts.
 *
 * WHAT IT DOES NOT CLAIM. Nothing here runs a tape. That the recorded expectations are the numbers
 * an instrument actually produces is a different question, owned by the scenario fixtures, and this
 * file would pass on a tape whose every number was wrong.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { loadTeachingTapes, NAMED_IN_AGENTS, TAPES_DIR } from "./teachingTapes.ts";

const { tapes, problems } = loadTeachingTapes();
const manifestIds = new Set(
  readdirSync(join(process.cwd(), "content", "experiments"))
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => f.replace(/\.yaml$/, "")),
);

describe("the authored teaching tapes", () => {
  test("every tape on disk is read, and none has a problem", () => {
    const onDisk = readdirSync(join(process.cwd(), TAPES_DIR)).filter((f) =>
      f.endsWith(".yaml"),
    ).length;
    console.log(
      `[teaching tapes] ${tapes.length} of ${onDisk} files read; ${tapes.reduce((n, t) => n + t.steps.length, 0)} steps, ${tapes.reduce(
        (n, t) => n + t.steps.filter((s) => s.expected.length > 0).length,
        0,
      )} carrying numbers; ${new Set(tapes.map((t) => t.experimentId)).size} instruments`,
    );
    // Not vacuous: a loader that returned nothing would satisfy every property below.
    expect(onDisk).toBeGreaterThan(15);
    expect(tapes).toHaveLength(onDisk);
    expect(problems).toEqual([]);
  });

  test("each tape names an instrument that has a manifest", () => {
    expect(manifestIds.size).toBeGreaterThan(30);
    expect(
      tapes
        .filter((t) => !manifestIds.has(t.experimentId))
        .map((t) => `${t.tapeId} -> ${t.experimentId}`),
    ).toEqual([]);
  });

  test("each tape can be presented: a title, and at least one step to walk", () => {
    expect(tapes.filter((t) => t.title.trim().length === 0).map((t) => t.tapeId)).toEqual([]);
    expect(tapes.filter((t) => t.steps.length === 0).map((t) => t.tapeId)).toEqual([]);
  });

  test("every recorded expectation is a labelled finite number", () => {
    const bad: string[] = [];
    let counted = 0;
    for (const tape of tapes)
      for (const step of tape.steps)
        for (const value of step.expected) {
          counted += 1;
          if (!Number.isFinite(value.value) || value.label.trim().length === 0)
            bad.push(`${tape.tapeId} step ${step.actionIndex}: ${value.label || "(no label)"}`);
        }
    // The loop must have run: 16 steps carried expectations on 2026-09-27.
    expect(counted).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });

  test("the tapes AGENTS.md names by id are reported, present or absent", () => {
    const present = NAMED_IN_AGENTS.filter((id) => tapes.some((t) => t.tapeId === id));
    const absent = NAMED_IN_AGENTS.filter((id) => !tapes.some((t) => t.tapeId === id));
    console.log(
      `[teaching tapes] named in AGENTS.md: ${present.length} of ${NAMED_IN_AGENTS.length} exist${
        absent.length > 0 ? `; absent: ${absent.join(", ")}` : ""
      }`,
    );
    // Reported, not asserted equal: `the-two-pulses` is named in AGENTS.md and no such record
    // exists, which is a real gap. Asserting the absence would go red the day somebody writes it,
    // so the assertion is the direction that stays true: a named tape that DOES exist must be
    // readable, and the count of named tapes must never fall to zero.
    expect(present.length).toBeGreaterThan(0);
    for (const id of present) {
      const tape = tapes.find((t) => t.tapeId === id);
      expect(tape?.named, `${id} should be flagged as named`).toBe(true);
      expect(tape?.steps.length ?? 0, `${id} has no steps`).toBeGreaterThan(0);
    }
  });
});
