/**
 * THE CLAUSE "no card shows a two-figure 60 s value without the modern label", made enforceable.
 *
 * am-bm-results-cards-ft8k's criterion 2 forbids it, and until this check existed there was
 * nothing on a Brownian card for it to bite on. The reason the clause exists is arithmetic rather
 * than style: at 60 s Einstein's own constants give 6.156365 um, which is 6.2 at two significant
 * figures, and the modern thermal constant gives 6.146687 um, which is 6.1. So a bare "6.1 um"
 * hands a modern number to Einstein, and the only honest place for it is a row that says
 * `modern-constant`.
 *
 * src/testing/diffusion.adversarial.test.ts guards the same number at the kernel; this guards it
 * where a reader meets it, on the card's rows, which is the layer that clause is written about.
 */

import { describe, expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { printedCheckFor } from "./printedChecks.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const SCENARIO = "diffusion-einstein-1905-printed";
const twoFigures = (metres: number) => (metres * 1e6).toPrecision(2);

describe("the Brownian printed check carries both of page 559's printed claims", () => {
  const check = printedCheckFor(ROOT, SCENARIO);

  test("both printed claims appear, each with its own labelled rows", () => {
    const printed = check.rows.filter((r) => r.comparisonKind === "rounds-to");
    expect(printed.map((r) => r.printedValue)).toEqual(["0,8 Mikron", "ca. 6 Mikron"]);
    // Three labelled values per claim, which is what criterion 2 asks for.
    expect(check.rows.length).toBe(6);
    console.log(`[census] brownian printed check: ${check.rows.length} rows over 2 printed claims`);
  });

  test("EVERY two-figure 6.1 is on a row labelled modern, and 6.2 is the printed one", () => {
    const sixty = check.rows.filter((r) => twoFigures(r.reproducedValue).startsWith("6."));
    expect(sixty.length).toBeGreaterThan(0);
    for (const row of sixty) {
      const two = twoFigures(row.reproducedValue);
      if (two === "6.1") {
        // The clause itself. A 6.1 may only ever appear under the modern constants.
        expect(row.comparisonKind, `6.1 um on ${row.label}`).toBe("modern-constant");
        expect(row.constantSetId).toBe("modern-si-2019");
        expect(row.label).toContain("modern");
      }
      if (row.comparisonKind === "rounds-to") {
        // Einstein's own row rounds to 6.2, never 6.1. This is the direction that would misattribute.
        expect(two).toBe("6.2");
        expect(row.constantSetId).toBe("einstein-1905-brownian-printed");
      }
    }
  });

  test("the printed rows round to what the plate prints, at the plate's one figure", () => {
    const printed = check.rows.filter((r) => r.comparisonKind === "rounds-to");
    expect(Number((printed[0]?.reproducedValue ?? 0) * 1e6).toPrecision(1)).toBe("0.8");
    expect(Number((printed[1]?.reproducedValue ?? 0) * 1e6).toPrecision(1)).toBe("6");
  });

  test("the check stays flagged while its scenario's transcription is pending", () => {
    // Not a detail: the row must not read as verified until the plate comparison has its second,
    // model-diverse round under D-2026-10-02-agent-review-beyond-english.
    expect(check.transcriptionPending).toBe(true);
  });

  test("an unowned scenario is refused by name, never rendered without an owner", () => {
    expect(() => printedCheckFor(ROOT, "diffusion-modern-viscosity-17c")).toThrow(
      /No owner reproduces/,
    );
  });
});
