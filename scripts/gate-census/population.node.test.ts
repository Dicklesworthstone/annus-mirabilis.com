/**
 * THE PARSER IS DRIVEN BY HAND-WRITTEN SPECIMENS, not by the printer beside it
 * (am-rc1001-bridge-plan-pcjk.9).
 *
 * A parser proven only against its own printer's output is a closed loop: both halves can be wrong
 * about the format and they will agree for ever. So the specimens below are typed out by hand, and
 * the round trip through the printer is a SEPARATE case rather than the only one.
 *
 * This file runs in the node lane, not the bun lane, because `bun run test` is itself one of the 48
 * registry steps the census judges. AGENTS.md: "when you write or repair a gate, keep a version of
 * its proof in a DIFFERENT lane from the one it controls."
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  isVacuous,
  type PopulationReport,
  parsePopulationLines,
  populationLine,
} from "./population.ts";

test("a hand-written line parses into its four fields", () => {
  const { reports, malformed } = parsePopulationLines(
    "[census] verify-content examined 323 content records (minimum 100)",
  );
  assert.equal(malformed.length, 0);
  assert.deepEqual(reports, [
    { gate: "verify-content", examined: 323, noun: "content records", minimum: 100 },
  ]);
});

test("census lines are found among a gate's ordinary output, and nothing else is", () => {
  // The realistic case: a gate prints pages of its own prose and one census line.
  const output = [
    "Checking content records...",
    "  ok  papers       4 of 4",
    "[census] verify-content examined 323 content records (minimum 100)",
    "Everything the census line examined is listed above.",
    "A sentence that says the word examined and a number 42 but is not a census line.",
    "[census] audit-dimensions examined 7 equation records (minimum 1)",
  ].join("\n");
  const { reports, malformed } = parsePopulationLines(output);
  assert.equal(malformed.length, 0);
  assert.deepEqual(
    reports.map((r) => `${r.gate}/${r.examined}/${r.noun}`),
    ["verify-content/323/content records", "audit-dimensions/7/equation records"],
  );
});

test("a zero count parses and is vacuous, which is the whole point", () => {
  const { reports } = parsePopulationLines(
    "[census] facsimile-config examined 0 facsimile configs (minimum 1) VACUOUS",
  );
  assert.equal(reports.length, 1);
  const first = reports[0];
  assert.ok(first);
  assert.equal(first.examined, 0);
  assert.equal(isVacuous(first), true);
});

test("a count at the minimum is not vacuous, and one below it is", () => {
  const at: PopulationReport = { gate: "g", examined: 5, noun: "files", minimum: 5 };
  const below: PopulationReport = { gate: "g", examined: 4, noun: "files", minimum: 5 };
  assert.equal(isVacuous(at), false);
  assert.equal(isVacuous(below), true);
});

test("the VACUOUS marker is advisory: the verdict comes from the numbers, not the word", () => {
  // A gate could print the marker wrongly, or omit it. The census must not believe the word over the
  // arithmetic, or a gate could hide a vacuous run by leaving the marker off.
  const unmarked = parsePopulationLines("[census] g examined 0 files (minimum 1)").reports[0];
  const marked = parsePopulationLines("[census] g examined 9 files (minimum 1) VACUOUS").reports[0];
  assert.ok(unmarked && marked);
  assert.equal(isVacuous(unmarked), true, "0 of 1 is vacuous whether or not the word is present");
  assert.equal(isVacuous(marked), false, "9 of 1 is not vacuous whatever the line claims");
});

test("MALFORMED, not dropped: a line announcing itself as census and failing to parse is reported", () => {
  // This is the case that makes the difference between "printed nothing" and "printed nonsense". A
  // parser that skipped these would let a gate with a broken line read as a gate with no line.
  const specimens: readonly string[] = [
    "[census] g examined many files (minimum 1)",
    "[census] g examined 5 files",
    "[census] examined 5 files (minimum 1)",
    "[census] g looked at 5 files (minimum 1)",
    "[census]",
  ];
  const { reports, malformed } = parsePopulationLines(specimens.join("\n"));
  assert.equal(reports.length, 0, "none of these is a readable declaration");
  assert.equal(malformed.length, specimens.length);
  for (const entry of malformed) assert.match(entry.reason, /does not match/);
});

test("a minimum of 0 is refused, because it cannot detect a vacuous run", () => {
  const { reports, malformed } = parsePopulationLines("[census] g examined 0 files (minimum 0)");
  assert.equal(reports.length, 0);
  assert.equal(malformed.length, 1);
  assert.match(malformed[0]?.reason ?? "", /below 1/);
});

test("a census line must start the line, so prose quoting one is not a declaration", () => {
  // The same rule as AGENTS.md's "a gate that forbids a construct must read code, not text": the
  // densest prose about a format is the documentation of that format, and a docblock here quotes
  // three example lines. Indented or embedded, they must not count.
  const output = [
    " [census] g examined 5 files (minimum 1)",
    'The format is "[census] g examined 5 files (minimum 1)".',
    "# [census] g examined 5 files (minimum 1)",
  ].join("\n");
  const { reports, malformed } = parsePopulationLines(output);
  assert.equal(reports.length, 0);
  assert.equal(malformed.length, 0, "these are not census lines at all, not broken ones");
});

test("the printer round-trips through the parser, as a separate case from the specimens", () => {
  const written: readonly PopulationReport[] = [
    { gate: "ocr-guard", examined: 4017, noun: "files", minimum: 1000 },
    { gate: "verify-constant-sets", examined: 0, noun: "constant set records", minimum: 2 },
    { gate: "scenarios", examined: 47, noun: "scenario files", minimum: 20 },
  ];
  const text = written.map(populationLine).join("\n");
  const { reports, malformed } = parsePopulationLines(text);
  assert.equal(malformed.length, 0);
  assert.deepEqual(reports, written);
  assert.match(text, /VACUOUS/, "the vacuous one carries the marker");
  assert.equal(text.split("VACUOUS").length - 1, 1, "and only the vacuous one does");
});

test("a noun with several words survives, since real populations are phrases", () => {
  const { reports } = parsePopulationLines(
    "[census] audit-reachability examined 12 instrument action contracts (minimum 10)",
  );
  assert.equal(reports[0]?.noun, "instrument action contracts");
});
