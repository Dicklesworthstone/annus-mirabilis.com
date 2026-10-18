import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  allPaperCoverage,
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
    // Every paper of the production export, not one hand-picked specimen.
    //
    // This pinned a single paper whose ledger was absent, and asserted that verdict as a guard on
    // the fixture. The guard drifted twice in one day: light-quanta left the absent state when its
    // ledger landed, the test was re-pointed to special-relativity, and 30ab1df0 put a ledger on
    // disk for that paper too. Nothing between the braces below ever depended on the ledger state -
    // these assertions are about the predicate agreeing with two witnesses it does not compute -
    // so the guard was pinning an incidental fact and buying a subscription to every future ledger.
    // Running the whole corpus covers every ledger state that exists without naming which paper
    // holds which, so the next ledger to land cannot break it.
    const reports = allPaperCoverage();
    // The denominator, keyed by identity rather than counted: a paper added or removed stops here
    // and is revisited, and an empty corpus cannot pass vacuously.
    expect([...reports].map((r) => r.slug).sort()).toEqual([
      "brownian-motion",
      "light-quanta",
      "mass-energy",
      "molecular-dimensions",
      "special-relativity",
    ]);

    for (const report of reports) {
      const md = coverageReportMarkdown(report);
      const json = coverageReportJson(report);

      expect(coverageReportIsHonest(md, json)).toBe(true);
      // Asserted independently of the predicate, so a weakened predicate cannot carry the test.
      expect(md.includes("%")).toBe(false);
      for (const key of Object.keys(JSON.parse(json) as Record<string, unknown>)) {
        expect(/percent|completeness|score/i.test(key)).toBe(false);
      }
    }
  });

  test("prose that denies scoring is honest: the report may say it does not score", () => {
    // These are the real reports' own notes. A vocabulary ban would refuse them.
    //
    // This pinned one exact sentence, "This is not completeness.", from light-quanta. That sentence
    // is emitted by the absent and partial ledger notes only; light-quanta's ledger became covering
    // at 22cd5562 and its note moved to the third arm, which denies completeness in different words.
    // The thesis is the vocabulary, not the sentence - every arm denies completeness, and the gloss
    // note denies scoring unconditionally - so it is asserted over every paper and therefore over
    // every ledger state the corpus is in.
    const reports = allPaperCoverage();
    expect([...reports].map((r) => r.slug).sort()).toEqual([
      "brownian-motion",
      "light-quanta",
      "mass-energy",
      "molecular-dimensions",
      "special-relativity",
    ]);

    for (const report of reports) {
      const md = coverageReportMarkdown(report);
      expect(md).toMatch(/not completeness/);
      expect(md).toContain("not as a score");
      expect(coverageReportIsHonest(md, coverageReportJson(report))).toBe(true);
    }
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

  /**
   * LISTED, not merely present. This asserted `md.includes(abbr)`, and for the short entries
   * that cannot fail: six of the thirty -- `ca.`, `S.`, `p.`, `Ann.`, `d.`, `Phys.` -- occur in
   * ordinary prose, so a document that listed none of them still satisfied a fifth of this
   * test. Measured against docs/DECISIONS.md, which documents no tokenizer rule: 6 of 30 matched
   * bare, 0 of 30 matched inside a code span. The segmentation document writes all thirty in
   * code spans already, so the stronger predicate is 30 of 30 today and the repair costs
   * nothing.
   *
   * The control below is inline rather than another file, so it cannot be weakened by an edit
   * somewhere else: it is a sentence of ordinary citation prose, and it shows the retired
   * predicate accepting entries the new one refuses.
   */
  test("SEGMENTATION.md lists every abbreviation the tokenizer uses, in a code span", () => {
    const listed = (text: string, abbr: string): boolean => text.includes(`\`${abbr}\``);

    /*
     * BOTH documents, because there are two. `docs/editorial/SEGMENTATION.md` is the live one:
     * `src/content/editions/segmentSentences.ts` calls itself an "executable copy" of it, two
     * provenance receipts cite its paragraph-boundary rule at 939d1a51, and this gate read it
     * alone. `docs/SEGMENTATION.md` is read by no code and no test, and neither file is a
     * superset of the other -- the orphan uniquely carries the reconciliation and alias-repair
     * rules, the live one uniquely carries the paragraph-boundary rule and gloss addressing.
     *
     * Measured 2026-10-18: on the abbreviation list the two AGREE, 30 of 30 each, and neither
     * invents an entry the tokenizer does not know, so this is a divergence risk rather than a
     * present contradiction. Which document survives is an editorial decision and is reported
     * on am-edn-alignment-tooling-do1; until it is taken, holding both to the tokenizer is what
     * stops the copy nobody reads from rotting into a rule that contradicts the code.
     */
    const documents = ["docs/editorial/SEGMENTATION.md", "docs/SEGMENTATION.md"] as const;
    for (const relative of documents) {
      const md = readFileSync(relative, "utf8");
      for (const abbr of SENTENCE_ABBREVIATIONS) {
        expect(listed(md, abbr), `${relative} must list \`${abbr}\``).toBe(true);
      }
    }

    const prose = "Compare Ann. d. Phys. 17, p. 891, S. 5, ca. 1905.";
    const bare = SENTENCE_ABBREVIATIONS.filter((abbr) => prose.includes(abbr));
    // Named rather than counted: these are the entries the retired predicate could not refuse.
    expect(bare).toContain("p.");
    expect(bare).toContain("S.");
    expect(bare).toContain("Ann.");
    expect(SENTENCE_ABBREVIATIONS.filter((abbr) => listed(prose, abbr))).toEqual([]);
  });
});
