/**
 * EVERY FINDING THE CENSUS CAN MAKE HAS BEEN SEEN TO FIRE (am-rc1001-bridge-plan-pcjk.9).
 *
 * A meta-gate whose own detections have never fired is the same shape as the gates it judges: it would
 * report "0 findings" over a population it never examined, and that reads as the cleanest possible
 * result. So every code in FINDING_CODES is driven here, and the last case asserts that the set of
 * codes exercised is the whole set - a new code added without a case fails rather than sitting unseen.
 *
 * In the node lane, like the rest of the census, because `bun run test` is one of the 48 steps the
 * census judges, and a proof living only in the bun lane disappears when that lane fails open.
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { GateStep } from "../quality-gates/registry.ts";
import { FINDING_CODES, judgeGate, judgePlant, meaningfulWithoutRunning } from "./judge.ts";
import { type CensusRecord, CENSUS_RECORDS as REAL_RECORDS } from "./records.ts";

const seen = new Set<string>();
const codes = (findings: readonly { code: string }[]): string[] => {
  for (const f of findings) seen.add(f.code);
  return findings.map((f) => f.code);
};

const step = (over: Partial<GateStep> = {}): GateStep => ({
  id: "demo",
  title: "t",
  command: ["bun", "x.ts"],
  family: "fast",
  cadence: "every-run",
  requiredInCi: true,
  requiredInProfiles: ["preview"],
  availability: {},
  owner: "am-demo",
  ...over,
});

const record = (over: Partial<CensusRecord> = {}): CensusRecord => ({
  gate: "demo",
  noun: "widgets",
  howRead: "by reading the widget directory",
  gateRefusesVacuous: true,
  plants: [],
  ...over,
});

const line = (examined: number, noun = "widgets", minimum = 10): string =>
  `[census] demo examined ${examined} ${noun} (minimum ${minimum})`;

const plantInput = (over: Record<string, unknown> = {}) => ({
  gate: "demo",
  plantId: "demo-plant",
  file: "scripts/demo.ts",
  anchorOccurrences: 1,
  digestBefore: "aaaa",
  digestAfterPlanting: "bbbb",
  digestAfterReverting: "aaaa",
  output: "REFUSED: the widget count is below its minimum",
  exitCode: 1,
  expectFailureNaming: "REFUSED",
  ...over,
});

test("the clean case produces no finding, which is the control for every case below", () => {
  const found = judgeGate(step(), record(), {
    output: `some prose\n${line(42)}\nmore prose`,
    exitCode: 0,
    routes: ["bun run gates"],
  });
  assert.deepEqual(codes(found), []);
});

test("reached-by-nothing fires when no runner reaches the step", () => {
  const found = judgeGate(step(), record(), {
    output: line(42),
    exitCode: 0,
    routes: [],
  });
  assert.deepEqual(codes(found), ["reached-by-nothing"]);
  assert.match(found[0]?.message ?? "", /am-demo/, "the owning bead is named");
});

test("no-census-record fires, and stops further judgment of that step", () => {
  const found = judgeGate(step(), undefined, {
    output: line(42),
    exitCode: 0,
    routes: ["bun run gates"],
  });
  assert.deepEqual(codes(found), ["no-census-record"]);
});

test("both fire together when an unrecorded step is also unreachable", () => {
  const found = judgeGate(step(), undefined, { output: "", exitCode: 0, routes: [] });
  assert.deepEqual(codes(found), ["reached-by-nothing", "no-census-record"]);
});

test("no-population-printed fires when the gate printed no line for itself", () => {
  const found = judgeGate(step(), record(), {
    output: "I did some work and said nothing about how much",
    exitCode: 0,
    routes: ["bun run gates"],
  });
  assert.deepEqual(codes(found), ["no-population-printed"]);
  assert.match(found[0]?.message ?? "", /exited 0/);
});

test("a line for a DIFFERENT gate does not count as this gate's line", () => {
  // The attribution matters: a chain where one gate prints and another does not would otherwise
  // credit the silent one.
  const found = judgeGate(step(), record(), {
    output: "[census] someone-else examined 99 widgets (minimum 10)",
    exitCode: 0,
    routes: ["bun run gates"],
  });
  assert.deepEqual(codes(found), ["no-population-printed"]);
});

test("malformed-population-line fires on a line that announces itself and does not parse", () => {
  const found = judgeGate(step(), record(), {
    output: `[census] demo examined lots of widgets (minimum 10)\n${line(42)}`,
    exitCode: 0,
    routes: ["bun run gates"],
  });
  assert.deepEqual(codes(found), ["malformed-population-line"]);
});

test("population-noun-changed fires when the gate reads a different population than recorded", () => {
  const found = judgeGate(step(), record({ noun: "widgets" }), {
    output: line(42, "gadgets"),
    exitCode: 0,
    routes: ["bun run gates"],
  });
  assert.deepEqual(codes(found), ["population-noun-changed"]);
  assert.match(found[0]?.message ?? "", /gadgets/);
  assert.match(found[0]?.message ?? "", /widgets/);
});

test("population-below-minimum fires on a count under the gate's OWN declared floor (judge.ts:127)", () => {
  // The minimum comes from the printed line, never from the record: a census trusting a number copied
  // into its record would inherit the gate's silence.
  const found = judgeGate(step(), record(), {
    output: line(3, "widgets", 10),
    exitCode: 0,
    routes: ["bun run gates"],
  });
  assert.deepEqual(codes(found), ["population-below-minimum"]);
  assert.match(found[0]?.message ?? "", /3 widgets/);
  assert.match(found[0]?.message ?? "", /minimum of 10/);
});

test("zero examined is below any legal minimum, which is the case the census exists for", () => {
  const found = judgeGate(step(), record(), {
    output: line(0, "widgets", 1),
    exitCode: 0,
    routes: ["bun run gates"],
  });
  assert.deepEqual(codes(found), ["population-below-minimum"]);
});

test("a gate that exits 0 over nothing is caught, so a clean exit is not evidence", () => {
  // AGENTS.md in one assertion: zero files checked reads as clean.
  const found = judgeGate(step(), record(), {
    output: `All checks passed.\n${line(0, "widgets", 100)}`,
    exitCode: 0,
    routes: ["bun run gates"],
  });
  assert.equal(found.length, 1);
  assert.equal(found[0]?.code, "population-below-minimum");
});

test("plant-stayed-green fires when the gate exits 0 with the violation present", () => {
  const found = judgePlant(plantInput({ exitCode: 0 }));
  assert.deepEqual(codes(found), ["plant-stayed-green"]);
});

test("plant-red-for-the-wrong-reason fires when the failure does not name the plant", () => {
  const found = judgePlant(
    plantInput({ exitCode: 1, output: "SyntaxError: unexpected token at line 4" }),
  );
  assert.deepEqual(codes(found), ["plant-red-for-the-wrong-reason"]);
});

test("plant-anchor-missing fires when the anchor is absent or duplicated, and stops there", () => {
  assert.deepEqual(codes(judgePlant(plantInput({ anchorOccurrences: 0 }))), [
    "plant-anchor-missing",
  ]);
  assert.deepEqual(codes(judgePlant(plantInput({ anchorOccurrences: 3 }))), [
    "plant-anchor-missing",
  ]);
});

test("plant-not-applied fires when the digest did not move, even though the gate went red", () => {
  // The case that separates a real proof from a coincidence: the gate failed for some other reason
  // while the plant never landed.
  const found = judgePlant(plantInput({ digestAfterPlanting: "aaaa" }));
  assert.ok(codes(found).includes("plant-not-applied"));
});

test("plant-not-reverted fires when the file is left changed", () => {
  const found = judgePlant(plantInput({ digestAfterReverting: "cccc" }));
  assert.ok(codes(found).includes("plant-not-reverted"));
});

test("a plant that lands, reddens for the right reason and is put back produces no finding", () => {
  assert.deepEqual(judgePlant(plantInput()), []);
});

/**
 * THE DECLARED-EMPTY CATEGORY (am-rc1001-bridge-plan-pcjk.9).
 *
 * Added when `stashes` could not adopt the printed line: it looks for stashes nobody has reviewed, so a
 * repository with none is the state it wants. A floor of 1 would redden a clean repository and a floor
 * of 0 cannot detect anything, so neither is a declaration. The third state is declared with a reason,
 * and the reason is the only thing between this field and an escape hatch.
 */

test("a record declaring an empty population legitimate needs no printed line", () => {
  const found = judgeGate(step(), record({ populationMayBeEmpty: { reason: "x".repeat(100) } }), {
    output: "no stashes to review",
    exitCode: 0,
    routes: ["bun run gates"],
  });
  assert.deepEqual(codes(found), []);
});

test("empty-population-reason-too-short fires on a one-line excuse", () => {
  const found = judgeGate(step(), record({ populationMayBeEmpty: { reason: "it can be empty" } }), {
    output: "",
    exitCode: 0,
    routes: ["bun run gates"],
  });
  assert.deepEqual(codes(found), ["empty-population-reason-too-short"]);
  assert.match(found[0]?.message ?? "", /15 characters/);
});

test("the declaration does not excuse being reached by nothing", () => {
  // The two are independent: a gate whose subject may be empty still has to be run by something.
  const found = judgeGate(step(), record({ populationMayBeEmpty: { reason: "x".repeat(100) } }), {
    output: "",
    exitCode: 0,
    routes: [],
  });
  assert.deepEqual(codes(found), ["reached-by-nothing"]);
});

test("the real records' empty-population reasons are all substantial", () => {
  // Over the real map rather than a fixture, because this field is the census's one soft edge.
  for (const r of REAL_RECORDS) {
    if (r.populationMayBeEmpty === undefined) continue;
    assert.ok(
      r.populationMayBeEmpty.reason.trim().length >= 80,
      `${r.gate}'s empty-population reason is too short to review`,
    );
  }
});

/**
 * READING A THIRD-PARTY TOOL'S OWN POPULATION (am-rc1001-bridge-plan-pcjk.9).
 *
 * `lint` is biome and `unit-tests` is bun's runner; neither can be made to print the census line, and
 * wrapping them would mean changing the registry command for steps every pane runs. Each does print its
 * own count, and those exact lines are the subject of AGENTS.md's first two recorded instances:
 * "Checked 0 files in 1629µs" and a `bun test $SUITES` that ran nothing while fifteen plants read as
 * passing. The specimens below are those lines verbatim.
 */

const toolRecord = (over: Partial<CensusRecord> = {}): CensusRecord =>
  record({
    toolPopulation: {
      pattern: String.raw`Checked (\d+) files? in`,
      noun: "files checked by biome",
      minimum: 500,
      why: "x".repeat(90),
    },
    ...over,
  });

test("a tool's real summary line supplies the count", () => {
  const found = judgeGate(step(), toolRecord(), {
    output: "Checked 4344 files in 812ms. No fixes applied.",
    exitCode: 0,
    routes: ["bun run gates"],
  });
  assert.deepEqual(codes(found), []);
});

test("THE RECORDED INCIDENT: 'Checked 0 files in 1629µs' is below the floor and is reported (judge.ts:111)", () => {
  const found = judgeGate(step(), toolRecord(), {
    output: "Checked 0 files in 1629µs. No fixes applied.",
    exitCode: 0,
    routes: ["bun run gates"],
  });
  assert.deepEqual(codes(found), ["population-below-minimum"]);
  assert.match(found[0]?.message ?? "", /0 files checked by biome/);
  assert.match(found[0]?.message ?? "", /minimum of 500/);
});

test("the singular 'Checked 1 file' also parses, since biome inflects", () => {
  const found = judgeGate(step(), toolRecord(), {
    output: "Checked 1 file in 3ms. No fixes applied.",
    exitCode: 0,
    routes: ["bun run gates"],
  });
  assert.deepEqual(codes(found), ["population-below-minimum"]);
});

test("tool-population-unreadable fires when the wording does not match, and never reads zero (judge.ts:94)", () => {
  // The direction that matters: a tool that changed its summary must be a finding, not a silent zero,
  // because a zero would be a number the tool never reported.
  const found = judgeGate(step(), toolRecord(), {
    output: "biome 2.0: inspected 4344 source files, no diagnostics",
    exitCode: 0,
    routes: ["bun run gates"],
  });
  assert.deepEqual(codes(found), ["tool-population-unreadable"]);
  assert.match(found[0]?.message ?? "", /do not read a non-match as zero/);
});

/*
 * THE FOURTH REFUSAL SITE, WHICH NOTHING DROVE (am-ksl3 / am-muyh).
 *
 * `tool-population-unreadable` is raised at two places: once when the pattern matches nothing, and
 * once when it matches and the capture is not an integer. The first had a test; the second did not,
 * and under this bead's rule a code with several sites is credited only by a CITATION, so the gap was
 * real rather than bookkeeping. It cannot be reached with a `(\\d+)` pattern, because digits always
 * parse - which is exactly why it needs a record whose pattern captures something else, and why no
 * existing test happened to cover it.
 */
test("a capture that is not an integer count is unreadable, not a number (judge.ts:103)", () => {
  const fractional = record({
    toolPopulation: {
      pattern: String.raw`examined ([\d.]+) things`,
      noun: "things",
      minimum: 1,
      why: "x".repeat(90),
    },
  });
  const found = judgeGate(step(), fractional, {
    output: "examined 3.5 things",
    exitCode: 0,
    routes: ["bun run gates"],
  });
  assert.deepEqual(codes(found), ["tool-population-unreadable"]);
  // The message must quote what it captured, so an author can see WHY their pattern is wrong rather
  // than only that it is.
  assert.match(found[0]?.message ?? "", /"3\.5"/);
  assert.match(found[0]?.message ?? "", /not an integer count/);
});

test("bun's own line parses with its own pattern", () => {
  const bunRecord = record({
    toolPopulation: {
      pattern: String.raw`Ran (\d+) tests? across`,
      noun: "tests run by bun",
      minimum: 5000,
      why: "x".repeat(90),
    },
  });
  const clean = judgeGate(step(), bunRecord, {
    output: "Ran 15770 tests across 1120 files. [92.00s]",
    exitCode: 0,
    routes: ["bun run gates"],
  });
  assert.deepEqual(codes(clean), []);
  // And the vacuous shape AGENTS.md records: an unquoted variable made the filter match nothing.
  const vacuous = judgeGate(step(), bunRecord, {
    output: "Ran 0 tests across 0 files. [2.00ms]",
    exitCode: 0,
    routes: ["bun run gates"],
  });
  assert.deepEqual(codes(vacuous), ["population-below-minimum"]);
});

test("a gate that prints its OWN census line is judged by that, not by its tool pattern", () => {
  // Precedence matters: the authored line is authoritative where it exists, so a gate adopting the line
  // later does not keep being read through a tool regex that happens to match something.
  const found = judgeGate(step(), toolRecord(), {
    output: "Checked 0 files in 1629µs.\n[census] demo examined 42 widgets (minimum 10)",
    exitCode: 0,
    routes: ["bun run gates"],
  });
  assert.deepEqual(codes(found), []);
});

/**
 * LAST ON PURPOSE. node runs top-level tests in declaration order and this one reads what the cases
 * above put into `seen`, so a case added BELOW it is invisible to it. That is not hypothetical: the
 * declared-empty cases were appended after it and it went red reporting
 * empty-population-reason-too-short as never driven, when the case driving it sat four lines later.
 * Keep this block at the bottom of the file.
 */
test("EVERY code in FINDING_CODES has been exercised above", () => {
  // Without this, a code added later would sit unseen and the census could carry a detection nobody has
  // ever watched fire. plant-file-missing is raised by the CLI rather than by judge.ts, since it is a
  // fact about the worktree, so it is not in this set.
  const missing = FINDING_CODES.filter((code) => !seen.has(code));
  assert.deepEqual(missing, [], `these codes were never driven: ${missing.join(", ")}`);
  assert.ok(seen.size >= FINDING_CODES.length, `${seen.size} codes seen`);
});

/*
 * THE --list FILTER (am-rc1001-bridge-plan-pcjk.9).
 *
 * `--list` judges every gate against `output: ""`, so any finding derived from reading a gate's
 * output is an artifact of the mode. Until 2026-10-06 only `no-population-printed` was dropped,
 * and every gate deferring to a third-party tool reported on every listing that its tool
 * "printed nothing matching" its pattern - which was true and meant nothing, because no tool had
 * run. The rule now has a name so it can be tested; the filter it replaced lived inline in the
 * census's main, which no test reaches, and that is why it was wrong for as long as it was.
 */
test("the two output-derived codes are dropped in --list, and no others are (judge.ts)", () => {
  assert.equal(meaningfulWithoutRunning("no-population-printed"), false);
  assert.equal(meaningfulWithoutRunning("tool-population-unreadable"), false);
  // Every other code this module can emit survives, asserted over the real list rather than a
  // sample, so a new code is included the day it is added instead of being silently dropped.
  const dropped = FINDING_CODES.filter((c) => !meaningfulWithoutRunning(c));
  assert.deepEqual([...dropped].sort(), ["no-population-printed", "tool-population-unreadable"]);
  assert.ok(FINDING_CODES.length > dropped.length, "the filter must not drop everything");
});

test("both dropped codes still FIRE in a real run, so the filter silences a mode and not a check", () => {
  // THE HALF THAT MATTERS. Dropping an artifact is only safe while the code it drops still
  // reports a real defect when a gate actually runs. Each arm below supplies real output.
  const unreadable = judgeGate(step(), toolRecord(), {
    output: "biome 2.0: inspected 4344 source files, no diagnostics",
    exitCode: 0,
    routes: ["bun run gates"],
  });
  assert.deepEqual(codes(unreadable), ["tool-population-unreadable"]);
  // The MESSAGE, not just the code, because this code is raised at TWO sites in judge.ts: the
  // pattern matching nothing, and a capture that is not an integer. Planting the first site
  // showed that execution falls through to the second, where Number(undefined) is NaN and the
  // same code is pushed with different wording - so a test asserting only the code stays green
  // against a defect in the site it names.
  assert.match(unreadable[0]?.message ?? "", /printed nothing matching/);
  assert.doesNotMatch(unreadable[0]?.message ?? "", /which is not an integer count/);

  const silent = judgeGate(step(), record(), {
    output: "everything is fine\n",
    exitCode: 0,
    routes: ["bun run gates"],
  });
  assert.deepEqual(codes(silent), ["no-population-printed"]);
});
