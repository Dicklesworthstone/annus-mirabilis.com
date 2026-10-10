/**
 * EVERY CONCORDANCE ENTRY NAMES WHO CHECKED ITS GLYPH, AND NONE IS STILL PENDING
 * (am-concordance-glyphs-verified-against-plates-13lx).
 *
 * The state this locks in, measured 2026-10-10: 272 entries across five papers (brownian-motion 67,
 * light-quanta 64, mass-energy 32, molecular-dimensions 11, special-relativity 98), 0 credited to
 * "Editorial Staff" and 0 whose check reads "Pending facsimile scan". When the bead was filed the
 * corpus was 194 and 161 of them were both. "Editorial Staff" is the shape that mattered: it is not
 * a person and not an agent, so an entry carrying it recorded a verification nobody had done and
 * nobody could be asked about, while reading in the data exactly like one that had been.
 *
 * TWO NAMING CONVENTIONS ARE ADMITTED, because both exist in the committed corpus and both are
 * honest: 246 entries are credited `agent:<name>` with the disclaimer in `checkedAgainst`, and 26
 * mass-energy entries are credited "pane31 (agent reading; not the human German source review)",
 * which carries its disclaimer in the credit itself. Requiring the `agent:` prefix would have
 * reddened those 26 for a spelling, so the rule asks the question that matters -- is a checker
 * named, and is a human review disclaimed -- of the two fields together.
 *
 * WHY THIS IS A SEPARATE FILE FROM THE PER-PAPER SUITES. `relativity.notation.test.ts` already
 * holds an honesty test, and it is paper-scoped and deliberately PERMITS the pending wording:
 * written in September, when most entries were pending, it asks only that none claims a human
 * review. That remains the right question for it. This asks the one its scope cannot: that the
 * pending population is now empty, on every paper at once. A per-paper test cannot see a paper
 * it does not load, and four of the five had no such test of this kind at all.
 *
 * THE POPULATION IS READ TWICE, ON PURPOSE. The loader validates and could in principle hand back
 * fewer entries than the file holds; a check over what the loader returned would then pass while
 * saying nothing about what is committed. So the raw `  - id:` count of each file is taken from
 * the bytes and must equal the loaded count, and the papers are enumerated from the directory
 * rather than from a list in this file, so adding content/notation/<paper>.yaml puts it under this
 * gate without anyone remembering to.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConcordanceForPaper } from "./loader.ts";

const ROOT = process.cwd();
const NOTATION = join(ROOT, "content", "notation");

const papers = readdirSync(NOTATION)
  .filter((f) => f.endsWith(".yaml"))
  .map((f) => f.replace(/\.yaml$/, ""))
  .sort();

/** The placeholder credits that mean "nobody". Matched whole, after trimming, never as a substring. */
const UNNAMED = new Set([
  "",
  "editorial staff",
  "editorial team",
  "staff",
  "tbd",
  "unknown",
  "pending",
]);

/** The retired check wording. Anchored at the start, which is where the loader's readers look for it. */
const PENDING_SCAN = /^Pending facsimile scan\b/;

/**
 * The forms a record uses to say a person has not reviewed the glyph. Both are in the corpus.
 * This is the one claim the concordance may not make by accident: a human source review is a
 * human gate (AGENTS.md, Review gates) and no agent may record one.
 */
const DISCLAIMS_HUMAN_REVIEW = /not a human review|not the human [^.]*review|agent reading/i;

/** An ISO calendar date, so a free-text date cannot satisfy "has a date". */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type Verification = Readonly<{
  printed: boolean;
  checkedAgainst: string;
  by: string;
  date: string;
}>;

/** Why this verification is not admissible, or null when it is. One reason, so a finding names one repair. */
export function creditFinding(v: Verification): string | null {
  const by = v.by.trim();
  if (UNNAMED.has(by.toLowerCase())) return `credited to "${v.by}", which names nobody`;
  if (PENDING_SCAN.test(v.checkedAgainst)) return 'the check still reads "Pending facsimile scan"';
  if (!ISO_DATE.test(v.date.trim())) return `date "${v.date}" is not an ISO calendar date`;
  // The disclaimer may sit in either field, and the match is case-insensitive because a record
  // writing "Not a human review." at the head of a sentence is saying the same thing. My first
  // version required the exact lowercase substring in `checkedAgainst` alone, and its own boundary
  // fixture caught it.
  if (!DISCLAIMS_HUMAN_REVIEW.test(`${by} ${v.checkedAgainst}`)) {
    return "no record here says a human has not reviewed this glyph, and none has";
  }
  return null;
}

describe("every concordance glyph names a checker, and none is pending", () => {
  test("the four shapes this forbids are each rejected, and a good record is accepted", () => {
    // The negatives come first because the sweep below is only worth its green if the predicate
    // can go red. Each isolates ONE defect, so a predicate that stopped testing three of them
    // would still fail here rather than passing on the strength of the fourth.
    const good: Verification = {
      printed: true,
      checkedAgainst: "Plate of printed page 900: read by eye. An agent check, not a human review.",
      by: "agent:Someone",
      date: "2026-10-10",
    };
    expect(creditFinding(good)).toBeNull();

    expect(creditFinding({ ...good, by: "Editorial Staff" })).toMatch(/names nobody/);
    expect(creditFinding({ ...good, by: "  editorial staff  " })).toMatch(/names nobody/);
    expect(
      creditFinding({ ...good, checkedAgainst: "Pending facsimile scan (ap-17-891)" }),
    ).toMatch(/Pending facsimile scan/);
    expect(creditFinding({ ...good, date: "September 2026" })).toMatch(/ISO calendar date/);
    expect(creditFinding({ ...good, checkedAgainst: "Plate of printed page 900." })).toMatch(
      /has not reviewed/,
    );
    // The disclaimer carried in the credit instead, which is the mass-energy convention.
    expect(
      creditFinding({
        ...good,
        by: "pane31 (agent reading; not the human German source review)",
        checkedAgainst:
          "Pinned facsimile ap-18-639, pages 639-641 at 400 dpi, read as images; no OCR.",
      }),
    ).toBeNull();

    // And the boundaries, so the rule is not wider than it says. A named person is admissible,
    // because the point is that SOMEONE is named, not that an agent is; and a checkedAgainst that
    // merely mentions the retired phrase mid-sentence is not a pending record.
    // A named person who HAS reviewed is the one thing no agent may write, so it is not a
    // boundary that passes: it is the finding above, arriving without the disclaimer.
    expect(
      creditFinding({ ...good, by: "J. Emanuel", checkedAgainst: "Read against the plate." }),
    ).toMatch(/has not reviewed/);
    // A checkedAgainst that merely MENTIONS the retired phrase mid-sentence is not a pending
    // record, because the rule is anchored at the start of the field.
    expect(
      creditFinding({
        ...good,
        checkedAgainst: 'Replaces the old "Pending facsimile scan" text. Not a human review.',
      }),
    ).toBeNull();
  });

  test("0 of the committed entries is unnamed or pending, over a population read from the bytes", () => {
    expect(papers.length).toBeGreaterThanOrEqual(5);

    const findings: string[] = [];
    const perPaper: string[] = [];
    let total = 0;
    let agentChecked = 0;
    let unprinted = 0;

    for (const paper of papers) {
      const file = loadConcordanceForPaper(paper);
      // The bytes, not the loader: `  - id:` at entry indentation is how every entry opens in
      // these files. If the loader ever drops one, these two numbers part company and this fails
      // before any verdict is offered about the entries that survived.
      const raw = readFileSync(join(NOTATION, `${paper}.yaml`), "utf8");
      // SCOPED TO `entries:`, and the scoping is the finding. A whole-file count of `  - id:`
      // reads 69 for brownian-motion against the loader's 67, because the file also carries a
      // `modernOnlySymbols:` list of symbols the paper does NOT print, which have no verification
      // block by design. Counting those would have made this cross-check fail on correct data,
      // which is the usual direction: an unscoped pattern measures the wrong population.
      const entriesBlock = raw.split("\nentries:")[1]?.split(/\n[a-zA-Z_]+:/)[0] ?? "";
      const rawIds = entriesBlock.match(/^ {2}- id: \S+$/gm)?.length ?? 0;
      expect(rawIds).toBeGreaterThan(0);
      expect(file.entries.length).toBe(rawIds);

      for (const entry of file.entries) {
        total += 1;
        if (DISCLAIMS_HUMAN_REVIEW.test(entry.verification.by)) agentChecked += 1;
        if (!entry.verification.printed) unprinted += 1;
        const finding = creditFinding(entry.verification as Verification);
        if (finding !== null) findings.push(`${paper} ${entry.id}: ${finding}`);
      }
      perPaper.push(`${paper} ${file.entries.length}`);
    }

    console.log(
      `[concordance credits] examined ${total} entries across ${papers.length} papers ` +
        `(${perPaper.join(", ")}); ${agentChecked} disclaim in the credit, ` +
        `${unprinted} recorded printed: false`,
    );
    expect(findings).toEqual([]);
    // Non-vacuity on purpose, with the reason: a concordance directory that loaded five empty
    // files would iterate nothing and report a clean sweep. The floor is the committed population
    // at the time this gate was written, so it cannot be satisfied by a smaller corpus.
    expect(total).toBeGreaterThanOrEqual(272);
  });

  test("no entry claims a human has reviewed it, because none has", () => {
    // The property the September relativity test holds, asked of all five papers. Checked on the
    // PAIR of fields rather than on the `by` prefix: the first version of this test asked whether
    // `by` began "agent:" and reddened the 26 honest mass-energy records whose disclaimer is in
    // the credit instead. A spelling is not the property.
    const claimed: string[] = [];
    let examined = 0;
    for (const paper of papers) {
      for (const entry of loadConcordanceForPaper(paper).entries) {
        examined += 1;
        const { by, checkedAgainst } = entry.verification;
        if (!DISCLAIMS_HUMAN_REVIEW.test(`${by} ${checkedAgainst}`)) {
          claimed.push(`${paper} ${entry.id}: credited to "${by}" with no disclaimer`);
        }
      }
    }
    expect(examined).toBeGreaterThanOrEqual(272);
    expect(claimed).toEqual([]);
  });
});
