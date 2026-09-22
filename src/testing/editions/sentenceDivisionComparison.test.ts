import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { load as loadYaml } from "js-yaml";
import { segmentLedger } from "../../content/editions/segmentLedger.ts";
import {
  compareSentenceDivision,
  formatDivisionComparison,
  ledgerPages,
  type ManifestSentenceUnit,
} from "../../content/editions/sentenceDivisionComparison.ts";
import { getLogger } from "../log/logger.ts";

const logger = getLogger("editions");
const BEAD = "am-span-recording-decision-ero2";

/**
 * The Option 3 harness the owner selected on 2026-09-21, verbatim: "Option 3 now, Option 1 later".
 *
 * The binding condition of that decision is the per-page determination, and the first three cases
 * below are planted against it: a per-PAPER zero-check passes the first and fails the third, which
 * is the shape that would have shipped without the correction.
 */

const page = (n: number, body: string) =>
  `--- MACHINE DRAFT TRANSCRIPTION PAGE ${n} OF 2 ---\n[[ANNALEN-PAGE ${540 + n}]]\n${body}\n`;
const unit = (id: string, p: number): ManifestSentenceUnit => ({
  id,
  kind: "sentence",
  locators: [{ page: p }],
});

describe("sentence division comparison keys on the printed page (am-span-recording-decision-ero2)", () => {
  const ledger = page(1, "Erster Satz hier. Zweiter Satz hier.") + page(2, "Dritter Satz hier.");

  test("the ledger's own ANNALEN-PAGE line supplies the key, not an offset from the sheet number", () => {
    // The sheet numbers are 1 and 2; the printed pages are 541 and 542. A harness that inferred
    // the printed page by adding a constant to the sheet number would agree here by accident and
    // break on the next paper, so the page is read from the ledger's own line.
    expect(ledgerPages(ledger).map((p) => p.page)).toEqual([541, 542]);
  });

  test("a page both sides cover agrees, and a differing count is reported as a delta", () => {
    const r = compareSentenceDivision({
      ledgerText: ledger,
      manifestUnits: [unit("s1-p1-s1", 541), unit("s1-p1-s2", 541), unit("s2-p1-s1", 542)],
      proposedSentences: [
        { id: "a", text: "Erster Satz hier." },
        { id: "b", text: "Zweiter Satz hier." },
        { id: "c", text: "Dritter Satz hier." },
      ],
    });
    expect(r.totals).toMatchObject({
      ledgerPages: 2,
      comparable: 2,
      notAvailable: 0,
      agreeing: 2,
      differing: 0,
    });

    const fewer = compareSentenceDivision({
      ledgerText: ledger,
      manifestUnits: [unit("s1-p1-s1", 541), unit("s1-p1-s2", 541), unit("s2-p1-s1", 542)],
      proposedSentences: [
        { id: "a", text: "Erster Satz hier. Zweiter Satz hier." },
        { id: "c", text: "Dritter Satz hier." },
      ],
    });
    expect(fewer.totals).toMatchObject({ comparable: 2, agreeing: 1, differing: 1 });
    expect(fewer.pages.find((p) => p.page === 541)).toMatchObject({
      outcome: "comparable",
      manifestSentences: 2,
      proposedSentences: 1,
      agrees: false,
    });
  });

  test("PLANTED, the binding condition: an UNCOVERED PAGE on a paper that HAS coverage is not-available", () => {
    // This is the case a per-paper zero-check gets wrong, and it is the whole reason the owner's
    // decision names the determination as per-page. The manifest covers page 541 and not 542.
    // A zero-check asks "does this PAPER have zero sentence units?", answers no, and then reports
    // page 542 as a disagreement it is not: the manifest makes no claim about that page at all.
    const r = compareSentenceDivision({
      ledgerText: ledger,
      manifestUnits: [unit("s1-p1-s1", 541), unit("s1-p1-s2", 541)],
      proposedSentences: [
        { id: "a", text: "Erster Satz hier." },
        { id: "b", text: "Zweiter Satz hier." },
        { id: "c", text: "Dritter Satz hier." },
      ],
    });
    expect(r.totals).toMatchObject({
      ledgerPages: 2,
      comparable: 1,
      notAvailable: 1,
      agreeing: 1,
      differing: 0,
    });
    const uncovered = r.pages.find((p) => p.page === 542);
    expect(uncovered?.outcome).toBe("not-available");
    expect(uncovered?.agrees).toBe(false);
    // The negative that names the defect: the uncovered page must NOT be counted as differing.
    expect(r.totals.differing).toBe(0);
    expect(uncovered?.reason).toContain("nothing for a proposed division to disagree with");
  });

  test("a manifest with NO sentence units anywhere yields no comparison, not one phantom per page", () => {
    const r = compareSentenceDivision({
      ledgerText: ledger,
      manifestUnits: [{ id: "s1-p1", kind: "paragraph", locators: [{ page: 541 }] }],
      proposedSentences: [
        { id: "a", text: "Erster Satz hier." },
        { id: "c", text: "Dritter Satz hier." },
      ],
    });
    expect(r.totals).toMatchObject({ comparable: 0, notAvailable: 2, agreeing: 0, differing: 0 });
  });

  test("unplaceable units are counted on both sides, never dropped from the denominator", () => {
    const r = compareSentenceDivision({
      ledgerText: ledger,
      manifestUnits: [
        unit("s1-p1-s1", 541),
        { id: "s1-p1-s2", kind: "sentence" },
        { id: "s1-p1-s3", kind: "sentence", locators: [{}] },
      ],
      proposedSentences: [
        { id: "a", text: "Erster Satz hier." },
        { id: "z", text: "Ein Satz der nirgends steht." },
        { id: "y", text: "" },
      ],
    });
    // One manifest unit names a page; two name none. One proposed sentence is found; one is on no
    // page; one is empty. Silently dropping any of them would make 541 look like agreement.
    expect(r.totals.unplaceableManifestUnits).toBe(2);
    expect(r.totals.unplaceableProposedSentences).toBe(2);
    expect(r.pages.find((p) => p.page === 541)).toMatchObject({
      manifestSentences: 1,
      proposedSentences: 1,
      agrees: true,
    });
  });

  test("the formatted line always states its denominator", () => {
    const r = compareSentenceDivision({
      ledgerText: ledger,
      manifestUnits: [unit("s1-p1-s1", 541)],
      proposedSentences: [{ id: "a", text: "Erster Satz hier." }],
    });
    const line = formatDivisionComparison("fixture", r);
    // "1 agree" alone is not a claim anyone can check. The comparable count and the
    // not-available count both appear, so 1-of-1 cannot be read as 1-of-2.
    expect(line).toContain("2 ledger pages");
    expect(line).toContain("1 comparable");
    expect(line).toContain("1 not-available");
  });
});

describe("the real corpus: every printed number is pinned", () => {
  // The harness does not ENFORCE agreement: the ledgers are MACHINE DRAFTS whose paragraph
  // structure nobody has reviewed, and the Brownian manifest was cut from plate reads, so on
  // today's evidence a disagreement is more likely the ledger's fault, and an error would
  // pressure somebody into changing a plate-read division to match a machine one. The owner's
  // decision does not reopen the freeze.
  //
  // IT DOES PIN, WHICH IS A DIFFERENT THING, and this block failed to at first. The totals were
  // only printed, and the completeness assertions below are true whatever those totals are, so
  // a number in the log contradicted a sentence in the commit message that shipped with it - I
  // wrote that the not-placeable case "is empty on every paper today" while this same run
  // printed 1 for light-quanta and 5 for special-relativity. Nothing was watching, because a
  // printed number with no pawl behind it is a claim nobody is holding.
  //
  // So every total is recorded below and compared exactly. A move in EITHER direction is a
  // finding and fails: upward means new text the harness cannot place or a division that
  // drifted, downward means the ledger, the manifest or the placement improved. Re-derive the
  // number from a run and say which of those it was; never nudge it to green. Updating a
  // recorded total is not "changing the division to match the machine" - the hazard above is
  // about editing content, and this is about noticing that content moved.
  const RECORDED: Readonly<
    Record<
      string,
      Readonly<{
        ledgerPages: number;
        comparable: number;
        notAvailable: number;
        agreeing: number;
        differing: number;
        unplaceableManifestUnits: number;
        unplaceableProposedSentences: number;
      }>
    >
  > = {
    "brownian-motion": {
      ledgerPages: 12,
      comparable: 12,
      notAvailable: 0,
      agreeing: 6,
      differing: 6,
      unplaceableManifestUnits: 0,
      unplaceableProposedSentences: 0,
    },
    "light-quanta": {
      ledgerPages: 17,
      comparable: 0,
      notAvailable: 17,
      agreeing: 0,
      differing: 0,
      unplaceableManifestUnits: 0,
      unplaceableProposedSentences: 1,
    },
    "mass-energy": {
      ledgerPages: 3,
      comparable: 0,
      notAvailable: 3,
      agreeing: 0,
      differing: 0,
      unplaceableManifestUnits: 0,
      unplaceableProposedSentences: 0,
    },
    "special-relativity": {
      ledgerPages: 31,
      comparable: 0,
      notAvailable: 31,
      agreeing: 0,
      differing: 0,
      unplaceableManifestUnits: 0,
      unplaceableProposedSentences: 5,
    },
  };

  const PAPERS: Readonly<Record<string, string>> = {
    "brownian-motion": "public/papers/transcripts/ap-17-549-machine-draft.txt",
    "light-quanta": "public/papers/transcripts/ap-17-132-machine-draft.txt",
    "mass-energy": "public/papers/transcripts/ap-18-639-machine-draft.txt",
    "special-relativity": "public/papers/transcripts/ap-17-891-machine-draft.txt",
  };

  test("every paper reports a denominator, and no paper reports a phantom disagreement", () => {
    for (const [slug, ledgerPath] of Object.entries(PAPERS)) {
      const ledgerText = readFileSync(ledgerPath, "utf8");
      const manifest = loadYaml(
        readFileSync(`content/source-blocks/${slug}/manifest.yaml`, "utf8"),
      ) as { units: ManifestSentenceUnit[] };
      // The real result type, not a cast. A cast through `unknown` here would compile and would
      // also hide the day segmentLedger stops returning what this reads.
      const segmented = segmentLedger({ ledgerText });
      const proposed = segmented.blocks
        .filter((b) => b.kind === "paragraph")
        .flatMap((b) => b.sentences);

      const result = compareSentenceDivision({
        ledgerText,
        manifestUnits: manifest.units,
        proposedSentences: proposed,
      });
      const t = result.totals;

      // The denominator is always complete: every ledger page is accounted for.
      expect(t.comparable + t.notAvailable, `${slug}: pages unaccounted for`).toBe(t.ledgerPages);
      expect(t.agreeing + t.differing, `${slug}: comparable pages unaccounted for`).toBe(
        t.comparable,
      );
      // A paper with no sentence coverage contributes no disagreement. This is the assertion the
      // per-paper zero-check would also pass; the planted case above is what separates them.
      if (t.comparable === 0) expect(t.differing).toBe(0);

      // The pawl. Every number this test prints is compared with the recorded one, including the
      // two the log carried unwatched.
      expect(
        { ...t },
        `${slug}: a recorded total moved. Re-derive it from a run and say which way and why - upward is new unplaceable text or a drifted division, downward is an improvement in the ledger, the manifest or the placement. Do not nudge it to green.`,
      ).toEqual({ ...RECORDED[slug] });

      logger.log({
        testId: `sentence-division-${slug}`,
        beadId: BEAD,
        outcome: "passed",
        comparisonKind: "formatted",
        extra: { ...t },
        message: formatDivisionComparison(slug, result),
      });
      console.log(formatDivisionComparison(slug, result));
    }
  });
});
