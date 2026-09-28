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
import {
  loadTeachingTapes,
  NAMED_IN_AGENTS,
  PLANNED_TAPES,
  TAPES_DIR,
  tapeIdentityReport,
} from "./teachingTapes.ts";

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

describe("a teaching tape's identity matches the instrument it belongs to", () => {
  const report = tapeIdentityReport();

  test("the comparison is live, proved by the difference it DOES find", () => {
    console.log(
      `[tape identity] ${report.checked} tapes; ${report.modelMismatches.length} model mismatches; ` +
        `${report.undeclared.length} named by no manifest; ${report.declaredWithNoRecord.length} declared with no record`,
    );
    expect(report.checked).toBeGreaterThan(15);
    // The positive control, and it is built in rather than planted: the declared-versus-authored
    // comparison finds three ids a manifest names with nothing behind them. A comparison that found
    // nothing in EITHER direction would be consistent with reading nothing at all, and on
    // 2026-09-27 the first version of this function did exactly that, silently, because a regex
    // lost its backslashes and matched no manifest block.
    expect(report.declaredWithNoRecord.length).toBeGreaterThan(0);
  });

  test("no tape records a model identity its instrument contradicts", () => {
    // 12 of 21 did before 2026-09-27: mostly the version as "1.0.0" against the manifest's 1, and
    // five naming a different model altogether. checkTapeCompatibility compares these with !==, so
    // a mismatch refuses the replay before a reader sees anything.
    expect(report.modelMismatches).toEqual([]);
  });

  test("every authored tape is named by its instrument's manifest", () => {
    // Six were named by none, among them the-boost-to-0.6c, which AGENTS.md names by id.
    expect(report.undeclared).toEqual([]);
  });

  test("a manifest declares no tape beyond the ones known to be planned", () => {
    // Subset, not equality: these three are plans, and writing one must not turn this red. A NEW
    // declaration with no record does.
    const unexpected = report.declaredWithNoRecord.filter((id) => !PLANNED_TAPES.includes(id));
    expect(unexpected).toEqual([]);
  });
});
