import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  coverageReport,
  coverageReportIsHonest,
  coverageReportJson,
  coverageReportMarkdown,
} from "../../content/editions/coverageReport.ts";
import { SENTENCE_ABBREVIATIONS } from "../../content/editions/segmentSentences.ts";

describe("coverage report honesty", () => {
  test("golden JSON and Markdown have no percent sign and no score keys", () => {
    const report = coverageReport({ slug: "light-quanta" });
    const md = coverageReportMarkdown(report);
    const json = coverageReportJson(report);
    expect(coverageReportIsHonest(md, json)).toBe(true);
    expect(md.includes("%")).toBe(false);
    expect(report.translation).toBe("not-applicable-no-ledger");
  });

  test("SEGMENTATION.md lists every abbreviation the tokenizer uses", () => {
    const md = readFileSync("docs/editorial/SEGMENTATION.md", "utf8");
    for (const abbr of SENTENCE_ABBREVIATIONS) {
      expect(md.includes(abbr)).toBe(true);
    }
  });
});
