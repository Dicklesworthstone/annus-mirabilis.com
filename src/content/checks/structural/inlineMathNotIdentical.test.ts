/**
 * THE 714 INLINE EXPRESSIONS WERE COMPARED BY NOTHING (am-rc1001-bridge-plan-pcjk.10 step 5).
 *
 * `checkEquationNotIdentical` compares the 200 printed displays. AGENTS.md's rule -- "Notation is
 * not translated. Keep every symbol as printed on both faces." -- covers the inline mathematics
 * equally, and no check asked.
 *
 * THE THREE DECISIONS THIS FILE PINS, because each was measured over the real corpus before it was
 * taken and the first two readings both produce a number that LOOKS like a finding:
 *
 *   per edge, display math counted      430 of 669 pairs differ   (paragraph vs one sentence)
 *   grouped by block, display counted    86 of 336 differ         (paragraph vs paragraph-minus-display)
 *   grouped by block, display excluded    7 of 329 differ         <- the question the rule asks
 *
 * The seven are real and all seven differ the same way: the ENGLISH face carries inline
 * mathematics the German does not print. `\Pi \cdot 10^7 = 4{,}3`, `P E`, `v = -\infty`,
 * `(X', Y' Z')` -- that last one also missing a comma. Whether each is a translator's
 * clarification to keep or a notation drift to repair is editorial, which is why the check's
 * severity is `flag`.
 */
import { describe, expect, test } from "bun:test";
import type { CheckContext, CheckReportItem } from "../../compiler/checks/registry.ts";
import { recordKeyFor } from "../../compiler/recordKey.ts";
import { checkInlineMathNotIdentical } from "./structural.ts";

/** A math inline node. `display: true` marks a printed display rather than inline notation. */
function math(latex: string, display = false) {
  return display ? { kind: "math", latex, display: true } : { kind: "math", latex };
}

function run(records: Record<string, unknown>): CheckReportItem[] {
  const reports: CheckReportItem[] = [];
  checkInlineMathNotIdentical.run({
    records: new Map<string, unknown>(Object.entries(records)),
    files: [],
    indexes: {},
    report: (item: CheckReportItem) => reports.push(item),
  } as CheckContext);
  return reports;
}

/** One German block, the English units aligned to it, and the alignment that joins them. */
function corpus(
  paper: string,
  blockId: string,
  germanInlines: readonly unknown[],
  units: Readonly<Record<string, readonly unknown[]>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    [recordKeyFor("source-block", paper, blockId)]: {
      kind: "paragraph",
      id: blockId,
      paper,
      inlines: germanInlines,
    },
    [recordKeyFor("alignment", paper, `align-${paper}`)]: {
      kind: "alignment",
      id: `align-${paper}`,
      paper,
      edges: Object.keys(units).map((unitId) => ({
        source: { blockId },
        target: { translationUnitId: unitId },
      })),
    },
  };
  for (const [unitId, inlines] of Object.entries(units)) {
    out[recordKeyFor("translation-unit", paper, unitId)] = {
      kind: "translation-unit",
      id: unitId,
      paper,
      inlines,
    };
  }
  return out;
}

describe("inline mathematics is identical across the two faces", () => {
  test("a block whose units carry the same inline math is silent", () => {
    // The control. Four refusal assertions below mean nothing beside a check that flags everything.
    expect(
      run(
        corpus("brownian-motion", "s1-p1", [math("V^*"), math("z")], {
          "s1-p1-s1": [math("V^*")],
          "s1-p1-s2": [math("z")],
        }),
      ),
    ).toEqual([]);
  });

  test("ONE German paragraph against the UNION of its sentence units, not one of them", () => {
    // Decision 1, and the reason the check groups. Per edge, the paragraph's two symbols would be
    // compared against each sentence's one and BOTH edges would differ; 430 of 669 real pairs do.
    const reports = run(
      corpus("brownian-motion", "s1-p1", [math("V^*"), math("z")], {
        "s1-p1-s1": [math("V^*")],
        "s1-p1-s2": [math("z")],
      }),
    );
    expect(reports).toEqual([]);
    // And the union really is the population: drop one symbol from one unit and it is reported.
    const dropped = run(
      corpus("brownian-motion", "s1-p1", [math("V^*"), math("z")], {
        "s1-p1-s1": [math("V^*")],
        "s1-p1-s2": [],
      }),
    );
    expect(dropped).toHaveLength(1);
    expect(String(dropped[0]?.message)).toContain('1 only in the German (["z"])');
  });

  test("DISPLAY math is excluded, which is the difference between 86 findings and 7", () => {
    // Decision 2. A printed display sits inside the German paragraph's inline flow and is its own
    // translation unit on the English face, so counting it compares a paragraph against a
    // paragraph-minus-its-display. The displays are not unchecked: that is check 6's question.
    expect(
      run(
        corpus("brownian-motion", "s1-p1", [math("V^*"), math("p V^* = R T z.", true)], {
          "s1-p1-s1": [math("V^*")],
        }),
      ),
    ).toEqual([]);
    // The boundary: a non-display inline of the SAME latex is still compared, so the exclusion is
    // about the `display` flag and not about the string.
    const inlineInstead = run(
      corpus("brownian-motion", "s1-p1", [math("V^*"), math("p V^* = R T z.")], {
        "s1-p1-s1": [math("V^*")],
      }),
    );
    expect(inlineInstead).toHaveLength(1);
  });

  test("a difference on either side is reported, and the message says which", () => {
    // The real shape, from light-quanta s8-p5: the English face carries a formula the German does
    // not print. All seven findings in the corpus today are this way round.
    const englishExtra = run(
      corpus("light-quanta", "s8-p5", [math("P' = 0")], {
        "s8-p5-s1": [math("P' = 0"), math("\\Pi \\cdot 10^7 = 4{,}3")],
      }),
    );
    expect(englishExtra).toHaveLength(1);
    expect(englishExtra[0]?.rule).toBe("inline-math-not-identical");
    expect(String(englishExtra[0]?.message)).toContain("0 only in the German");
    expect(String(englishExtra[0]?.message)).toContain("\\\\Pi \\\\cdot 10^7 = 4{,}3");

    // And the other direction, which no real block shows today and which must still be caught.
    const germanExtra = run(
      corpus("light-quanta", "s8-p5", [math("P' = 0"), math("\\beta")], {
        "s8-p5-s1": [math("P' = 0")],
      }),
    );
    expect(germanExtra).toHaveLength(1);
    expect(String(germanExtra[0]?.message)).toContain("1 only in the German");
  });

  test("a MULTISET, so repetition counts and order does not", () => {
    // Decision 3. English word order moves a symbol within the sentence; what must not change is
    // which symbols appear and how often.
    expect(
      run(
        corpus("special-relativity", "s7-p3", [math("\\nu"), math("v")], {
          "s7-p3-s1": [math("v"), math("\\nu")],
        }),
      ),
    ).toEqual([]);
    const repeated = run(
      corpus("special-relativity", "s7-p3", [math("k"), math("k")], {
        "s7-p3-s1": [math("k")],
      }),
    );
    expect(repeated).toHaveLength(1);
  });

  test("a block with a unit missing is SKIPPED, not reported as a difference", () => {
    // Absence is not disagreement. Comparing against the units that happen to be present would
    // report a difference that is really a missing record, which is the failure this repository
    // keeps paying for in the other direction.
    const records = corpus("brownian-motion", "s1-p1", [math("V^*"), math("z")], {
      "s1-p1-s1": [math("V^*")],
      "s1-p1-s2": [math("z")],
    });
    delete records[recordKeyFor("translation-unit", "brownian-motion", "s1-p1-s2")];
    expect(run(records)).toEqual([]);
  });

  test("nested inlines are reached, so wrapping a symbol in emphasis does not hide it", () => {
    const reports = run(
      corpus("brownian-motion", "s1-p1", [{ kind: "emphasis", inlines: [math("V^*")] }], {
        "s1-p1-s1": [],
      }),
    );
    expect(reports).toHaveLength(1);
    expect(String(reports[0]?.message)).toContain('1 only in the German (["V^*"])');
  });
});
