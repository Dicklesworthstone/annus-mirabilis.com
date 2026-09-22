/**
 * One rule set for every extracted donor file, and the membership predicate that decides who is
 * one. The LANE-INDEPENDENT half of am-75t2.
 *
 * am-75t2 had two defects and the coverage number hid the second one.
 *
 *   OWNERSHIP  three gates held three hand-drawn populations, and five carriers - two ambient
 *              `.d.ts` shims and three co-located test files - were in none of them, because
 *              the lists are drawn by KIND (runtime, scripts, UI) and the population is defined
 *              by the HEADER. Repaired by hand in e4fa09b1. Guarded, now, in the derived half
 *              beside this file, which needs `git ls-files` and therefore the node lane.
 *   STANDARD   the three gates do not enforce the same rules. Measured as token sets on
 *              2026-09-22: B (read from docs/DONOR_AUDIT.md section 10.1) 20, C
 *              (FORBIDDEN_DONOR_IDENTITIES) the identical 20, A (FORBIDDEN_STRINGS +
 *              FORBIDDEN_DONOR_CONSTANTS) those 20 plus 15 donor constants and kernels, plus
 *              the DONOR_VOCABULARY word rule that only A runs. A is a strict superset and B
 *              and C are the same set written twice. So which standard an extracted file was
 *              held to was decided by which list it landed in - a decision nobody made.
 *
 * This file closes STANDARD, and it needs no subprocess to do it: it runs A's shipped scanner
 * and A's shipped validator over the UNION of all three lists, so the 23 files that A's list
 * does not hold are now held to A's rules anyway.
 *
 * WHICH HALF WATCHES WHICH. Ownership is checked against the derived population and can only
 * run where a subprocess can (extractionCarriersDerived.test.ts, node lane). The standard is
 * checked here against the union of the lists, in the bun lane, so if the node lane refuses to
 * start - which it did for 49 commits - the rule set is still enforced over 40 files and only
 * the drift guard goes quiet. The two are not the same check and neither substitutes for the
 * other: this one cannot notice a carrier that is in no list, and that one does not scan.
 *
 * The shipped scanner is imported rather than restated, so this gate cannot drift from the gate
 * it generalises. The cost is that A's own suite runs again as an import, which is deliberate:
 * this file cannot be green while A is broken.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scanCodeForHygiene, validateAttributionHeader } from "../extractionHygiene.test.ts";
import {
  contentIsExtractionCarrier,
  EXTRACTION_HEADER_OPENING,
  GATE_LISTS,
  readGateList,
} from "./extractionCarriers.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("every extracted donor file meets the strongest of the three rule sets", () => {
  const lists = GATE_LISTS.map((gate) => ({
    ...gate,
    paths: readGateList(ROOT, gate.path, gate.name),
  }));
  const listed = [...new Set(lists.flatMap((gate) => gate.paths))].sort();

  test("each gate's list parses to a plausible size", () => {
    // Floors, not a census: they catch a parse that returned nothing, which reads exactly like
    // a clean result and would make every check below pass over an empty set. The measured
    // sizes on 2026-09-22 were 17, 11 and 12, union 40.
    for (const gate of lists) {
      expect({ gate: gate.name, atLeast6: gate.paths.length > 5 }).toEqual({
        gate: gate.name,
        atLeast6: true,
      });
    }
    expect(listed.length).toBeGreaterThan(30);
  });

  test("the three lists are disjoint in location, which is why one rule set has to reach all of them", () => {
    // Stated as a property rather than a count. If a path ever appears in two gates' lists,
    // the "which list holds it" question has two answers and this file's premise is wrong.
    const total = lists.reduce((sum, gate) => sum + gate.paths.length, 0);
    expect({ total, distinct: listed.length }).toEqual({ total, distinct: total });
  });

  test("A's rule set passes over the union of all three lists, not only over A's own", () => {
    const failures: string[] = [];
    for (const relativePath of listed) {
      const content = readFileSync(join(ROOT, relativePath), "utf8");
      if (!validateAttributionHeader(content).valid) {
        failures.push(`${relativePath}: attribution header invalid`);
      }
      for (const violation of scanCodeForHygiene(relativePath, content)) {
        failures.push(`${relativePath}:${violation.line}: ${violation.token}`);
      }
    }
    expect({ failures, scanned: listed.length }).toEqual({
      failures: [],
      scanned: listed.length,
    });
  });

  describe("the membership predicate", () => {
    const header = `${EXTRACTION_HEADER_OPENING} * Pinned commit: whatever\n */\n`;

    test("accepts a carrier whose notice gained leading blank lines", () => {
      // The am-ftgq case, arriving by a new door. An exact prefix check would drop this file
      // out of the derived population while the shipped validator still accepted it: scanned by
      // nothing, reported by nothing. Membership and validity share one predicate for this
      // reason.
      expect(contentIsExtractionCarrier(`\n\n${header}export const x = 1;\n`)).toBe(true);
    });

    test("refuses a file whose first block is some other comment", () => {
      expect(contentIsExtractionCarrier(`/** unrelated */\n${header}`)).toBe(false);
    });

    test("refuses a file with no leading block at all", () => {
      expect(contentIsExtractionCarrier("export const x = 1;\n")).toBe(false);
    });
  });
});
