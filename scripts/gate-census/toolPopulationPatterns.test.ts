/**
 * EVERY `toolPopulation.pattern` STILL READS ITS TOOL'S REAL WORDING.
 *
 * Five census records cannot print their own census line, because the thing that counts the
 * population is a third-party tool: tsc, biome (twice), bun's test runner, node's. For those the
 * census parses the TOOL'S own summary with a recorded regex. That regex is a claim about software
 * this repository does not control, and it goes stale on an upgrade.
 *
 * `judgeGate` handles a stale one correctly -- `tool-population-unreadable`, and it explicitly
 * refuses to read "no match" as zero, which would invent a number the tool never reported. The
 * problem is the price of hearing it: the finding is only reached by RUNNING the gate under the
 * census, and for `unit-tests` that is the whole bun lane at about 650 seconds, for `typecheck` the
 * 48-generator prepare chain plus tsc. So a pattern can rot for as long as nobody pays for a full
 * census run, which is the same economics that left a plant anchor dead for fourteen days
 * (plantAnchors.test.ts, and `receipts-minimum-unreachable`).
 *
 * SO THE PATTERNS ARE CHECKED AGAINST PINNED SPECIMENS OF REAL OUTPUT, in the bun unit lane, with
 * no tool run at all. Every specimen below was CAPTURED from an actual run on 2026-10-21 and is
 * quoted verbatim, including the column padding tsc emits and the `ℹ` node prefixes; none is
 * written from memory of what these tools print, because a specimen invented to match the regex
 * would make this file agree with itself forever.
 *
 * WHICH HALF THIS ANSWERS. It proves the regex reads the wording as it was on 2026-10-21. It does
 * NOT prove today's installed tool still prints that wording -- only running the tool shows that,
 * and `bun scripts/gate-census.ts --gate <id>` does it one record at a time. When an upgrade
 * changes a summary line, this file goes red with the specimen beside the pattern, which is the
 * cheapest place to notice and fix both.
 */

import { describe, expect, test } from "bun:test";
import { CENSUS_RECORDS } from "./records.ts";

/**
 * Verbatim fragments of each tool's summary, captured 2026-10-21 by running the gate's own command
 * and copying what it printed:
 *
 *   typecheck          bunx tsc --noEmit --diagnostics
 *   lint               bun run lint          (biome check ., exit 0)
 *   format-check       bun run format:check  (biome format ., exit 0)
 *   unit-tests         bun run test          (17,890 pass, 1 skip, 0 fail)
 *   node-content-lane  bun run test:node:content  (223 pass, 0 fail, exit 0)
 */
const SPECIMENS: Readonly<Record<string, { readonly output: string; readonly expect: number }>> = {
  typecheck: {
    output: [
      "Files:              5075",
      "Lines:           1153640",
      "Identifiers:     1415238",
    ].join("\n"),
    expect: 5075,
  },
  lint: { output: "Checked 4777 files in 3s. No fixes applied.", expect: 4777 },
  "format-check": { output: "Checked 4700 files in 1093ms. No fixes applied.", expect: 4700 },
  "unit-tests": { output: "Ran 17891 tests across 1907 files. [651.76s]", expect: 17891 },
  "node-content-lane": { output: ["ℹ pass 223", "ℹ fail 0"].join("\n"), expect: 223 },
};

/** The records whose population comes from a tool rather than from a census line they print. */
const TOOL_RECORDS = CENSUS_RECORDS.filter((r) => r.toolPopulation !== undefined);

describe("each recorded tool pattern reads its tool's real summary", () => {
  test("the population is not vacuous, and every tool record has a specimen", () => {
    console.log(
      `[census] tool patterns: ${TOOL_RECORDS.length} record(s) read a third-party tool's count`,
    );
    // Measured 2026-10-21: five. A records file that exported none would make every case below
    // iterate zero times and pass.
    expect(TOOL_RECORDS.length).toBeGreaterThanOrEqual(5);
    // A new tool record with no specimen is unproved, so it fails here rather than silently.
    const unspecimened = TOOL_RECORDS.map((r) => r.gate).filter((g) => SPECIMENS[g] === undefined);
    expect(
      unspecimened,
      `these records read a tool's count with no pinned specimen: ${unspecimened.join(", ")}`,
    ).toEqual([]);
  });

  test("each pattern captures the count its specimen reports", () => {
    const wrong: string[] = [];
    for (const record of TOOL_RECORDS) {
      const tool = record.toolPopulation;
      const specimen = SPECIMENS[record.gate];
      if (tool === undefined || specimen === undefined) continue;
      const captured = new RegExp(tool.pattern).exec(specimen.output)?.[1];
      if (captured === undefined) {
        wrong.push(`${record.gate}: /${tool.pattern}/ matched nothing in its specimen`);
        continue;
      }
      if (Number(captured) !== specimen.expect) {
        wrong.push(
          `${record.gate}: /${tool.pattern}/ captured ${JSON.stringify(captured)}, expected ${specimen.expect}`,
        );
      }
    }
    // Named rather than counted: a stale pattern is repaired by reading the tool's new wording, so
    // the failure prints the pattern and the specimen it could not read.
    expect(wrong, wrong.join("\n")).toEqual([]);
  });

  test("each specimen's count clears the floor the record declares", () => {
    // Not a property of the regex but of the pair: a floor above the real population would make the
    // gate permanently vacuous, which is how `coverage-report` came to be a required release step
    // that certifies nothing.
    const under: string[] = [];
    for (const record of TOOL_RECORDS) {
      const tool = record.toolPopulation;
      const specimen = SPECIMENS[record.gate];
      if (tool === undefined || specimen === undefined) continue;
      if (specimen.expect < tool.minimum) {
        under.push(
          `${record.gate}: specimen ${specimen.expect} is below its floor ${tool.minimum}`,
        );
      }
    }
    expect(under, under.join("\n")).toEqual([]);
  });

  test("PLANTED: a tool that changes its wording is not read as a count", () => {
    /*
     * The real failure mode, which is an upgrade rather than a bug: biome printing "Checked 4777
     * file(s)" or bun printing "17891 tests ran". A pattern loose enough to keep matching those
     * would be reading the wrong number out of a sentence it does not understand.
     */
    const changed: Readonly<Record<string, string>> = {
      lint: "Analyzed 4777 files in 3s. No fixes applied.",
      "format-check": "Analyzed 4700 files in 1093ms. No fixes applied.",
      "unit-tests": "17891 tests ran across 1907 files. [651.76s]",
      "node-content-lane": "ℹ passed 223",
      typecheck: "Total files:        5075\nTotal lines:     1153640",
    };
    for (const record of TOOL_RECORDS) {
      const tool = record.toolPopulation;
      const altered = changed[record.gate];
      if (tool === undefined || altered === undefined) continue;
      expect(
        new RegExp(tool.pattern).exec(altered)?.[1],
        `${record.gate}: /${tool.pattern}/ still matched the ALTERED wording ${JSON.stringify(altered)}, so it is too loose to notice an upgrade`,
      ).toBeUndefined();
    }
    // The control: the real specimens still match, so the undefineds above are the plant and not a
    // broken loop that evaluated nothing.
    for (const record of TOOL_RECORDS) {
      const tool = record.toolPopulation;
      const specimen = SPECIMENS[record.gate];
      if (tool === undefined || specimen === undefined) continue;
      expect(new RegExp(tool.pattern).exec(specimen.output)?.[1]).toBeDefined();
    }
  });

  test("PLANTED: an empty tool output yields no count, never a zero", () => {
    // `judgeGate` depends on this: it reports `tool-population-unreadable` for a non-match and says
    // in its own message not to read one as zero. A pattern that matched an empty string would turn
    // a tool that printed nothing into a gate that examined nothing and passed its own floor check
    // by arithmetic.
    for (const record of TOOL_RECORDS) {
      const tool = record.toolPopulation;
      if (tool === undefined) continue;
      expect(
        new RegExp(tool.pattern).exec("")?.[1],
        `${record.gate} matched empty output`,
      ).toBeUndefined();
      expect(
        new RegExp(tool.pattern).exec("error: the tool crashed before counting anything")?.[1],
        `${record.gate} read a count out of a crash message`,
      ).toBeUndefined();
    }
  });

  test("every pattern captures exactly one group, since the judge reads match[1]", () => {
    const bad: string[] = [];
    for (const record of TOOL_RECORDS) {
      const tool = record.toolPopulation;
      const specimen = SPECIMENS[record.gate];
      if (tool === undefined || specimen === undefined) continue;
      const match = new RegExp(tool.pattern).exec(specimen.output);
      // match[0] is the whole match, so a well-formed pattern has length 2.
      if (match === null || match.length !== 2) {
        bad.push(`${record.gate}: ${match === null ? "no match" : `${match.length - 1} group(s)`}`);
      }
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });
});
