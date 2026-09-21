import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  coverageReport,
  coverageReportIsHonest,
  coverageReportJson,
  coverageReportMarkdown,
} from "../../content/editions/coverageReport.ts";
import { SENTENCE_ABBREVIATIONS } from "../../content/editions/segmentSentences.ts";

/**
 * The honesty rule these tests hold the report to (am-edn-alignment-tooling-do1, and the
 * doctrine behind it: no single flattering completeness percentage that aggregates
 * translation, instruments, review and validation). The Markdown carries no percent sign,
 * and no KEY at any depth of the JSON scores the edition.
 *
 * The rule is about keys and percent signs, not vocabulary. The report's own notes say
 * "This is not completeness" and "not as a score", and a word ban would forbid it from
 * saying so. Prose that denies scoring is honest; a field that scores is not. Both
 * directions are asserted.
 */
describe("coverage report honesty", () => {
  test("a real report is honest, and the predicate is not the only witness", () => {
    const report = coverageReport({ slug: "special-relativity" });
    const md = coverageReportMarkdown(report);
    const json = coverageReportJson(report);

    expect(coverageReportIsHonest(md, json)).toBe(true);
    // Asserted independently of the predicate, so a weakened predicate cannot carry the test.
    expect(md.includes("%")).toBe(false);
    for (const key of Object.keys(JSON.parse(json) as Record<string, unknown>)) {
      expect(/percent|completeness|score/i.test(key)).toBe(false);
    }
    // The specimen must be a paper with NO ledger, which is the verdict being asserted.
    // It was light-quanta until 2026-09-21, when a skeleton put a file on disk and the
    // honest verdict there became not-applicable-partial-ledger. Re-pointed rather than
    // widened: this test is about the absent case specifically.
    expect(report.translation).toBe("not-applicable-no-ledger");
  });

  test("prose that denies scoring is honest: the report may say it does not score", () => {
    // These are the real report's own notes. A vocabulary ban would refuse them.
    const md = coverageReportMarkdown(coverageReport({ slug: "light-quanta" }));
    expect(md).toContain("This is not completeness.");
    expect(md).toContain("not as a score");
    expect(
      coverageReportIsHonest(md, coverageReportJson(coverageReport({ slug: "light-quanta" }))),
    ).toBe(true);
  });

  test("REJECT: a percent sign in the Markdown is not honest", () => {
    const md = "# Edition coverage\n\nTranslation: 82% aligned\n";
    expect(coverageReportIsHonest(md, '{"slug":"light-quanta"}\n')).toBe(false);
  });

  test("REJECT: a top-level scoring key in the JSON is not honest", () => {
    const json = '{"slug":"light-quanta","completenessScore":0.82}\n';
    expect(coverageReportIsHonest("# Edition coverage\n", json)).toBe(false);
  });

  test("REJECT: a scoring key nested inside the JSON is not honest", () => {
    // The shape that matters in practice: a per-kind block quietly carrying an aggregate.
    const json = JSON.stringify(
      {
        slug: "light-quanta",
        glossTokensByKind: {
          paragraph: { totalWords: 120, glossedWords: 98, completenessScore: 0.82 },
        },
      },
      null,
      2,
    );
    expect(coverageReportIsHonest("# Edition coverage\n", json)).toBe(false);
  });

  test("REJECT: a scoring key inside an array element of the JSON is not honest", () => {
    const json = JSON.stringify(
      { slug: "light-quanta", layers: [{ layer: "gloss", percentGlossed: 0.5 }] },
      null,
      2,
    );
    expect(coverageReportIsHonest("# Edition coverage\n", json)).toBe(false);
  });

  test("gloss coverage is reported by unit kind, in words rather than a ratio", () => {
    const report = coverageReport({
      slug: "light-quanta",
      glossTokensByKind: {
        paragraph: { totalWords: 120, glossedWords: 98 },
        footnote: { totalWords: 20, glossedWords: 20 },
      },
    });
    const md = coverageReportMarkdown(report);

    expect(report.glossTokensByKind?.paragraph?.glossedWords).toBe(98);
    expect(md).toContain("## Gloss token coverage by unit kind");
    expect(md).toContain("- paragraph: 98 glossed words out of 120 total words");
    expect(md).toContain("- footnote: 20 glossed words out of 20 total words");
    // Reported per kind, never summed into one figure for the edition.
    expect(md).not.toContain("118");
    expect(coverageReportIsHonest(md, coverageReportJson(report))).toBe(true);
  });

  test("SEGMENTATION.md lists every abbreviation the tokenizer uses", () => {
    const md = readFileSync("docs/editorial/SEGMENTATION.md", "utf8");
    for (const abbr of SENTENCE_ABBREVIATIONS) {
      expect(md.includes(abbr)).toBe(true);
    }
  });
});
