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
    // Re-derived 2026-09-25 from a run after 4bc062f1 minted s2-p4-s6, s4-p6-s8 and s4-p6-s9 (the
    // plate prints more sentences than the frozen cut listed). agreeing 6 -> 5, differing 6 -> 7,
    // and the direction is the manifest improving, not drifting: p. 552 went from agreeing (9 = 9)
    // to differing (manifest 10, proposal 9), because the segmenter does not cut before a sentence
    // that opens with math ("J ist aber auch ..."), and the manifest now counts that sentence.
    // p. 557 still differs (manifest 8 -> 10, the plate's count; the proposal's 12 includes two cuts
    // at "etc."). The heuristic's two weaknesses are now visible here instead of hidden in the ids.
    "brownian-motion": {
      ledgerPages: 12,
      comparable: 12,
      notAvailable: 0,
      agreeing: 5,
      differing: 7,
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
      // 5 -> 6 when p906 landed, 6 -> 7 when p907 landed. Re-derived each time, not nudged.
      // p906: "Wir setzen: ... alpha ist dann als der Winkel zwischen den Geschwindigkeiten v
      // und w anzusehen." opens on 905 and closes on 906. p907: "Führen wir neben den in § 3
      // figurierenden Systemen K und k noch ein drittes ... tritt; man sieht daraus, daß solche
      // Paralleltransformationen - wie dies sein muß - eine Gruppe bilden." opens on 906 and
      // closes on 907. Neither is contained in one page, so the harness counts it rather than
      // guessing, exactly as its own comment says it will.
      //
      // EXPECT THIS TO MOVE AGAIN, ONCE PER PAGE, while the relativity ledger is being written,
      // and know which pages will do it. A page whose text ends mid-sentence in a DISPLAY has
      // nowhere to put [[CONTINUES]] but its own line, and an own-line tag is exactly the case
      // segmentLedger joins across (see below). 905, 906 and 907 all end in a display. A page
      // ending in prose takes the tag inline and moves nothing.
      //
      // 7 -> 8 when p908 landed, and that movement was PREDICTED by the paragraph above rather
      // than discovered by the failure: 907 ends in a display, so its tag is on its own line, so
      // "Wenden wir auf diese Gleichungen die in § 3 entwickelte Transformation an ... wobei
      // beta = ..." joined across 907/908 the moment 908 existed. The rule has now been right
      // once in advance, so treat a movement it does NOT predict as worth investigating.
      //
      // 8 -> 9 when p909 landed, AND THE RULE ABOVE DID NOT PREDICT IT, so it was investigated
      // instead of bumped. There is no new crossing: 908 ends in prose and 909 opens a fresh
      // indented paragraph, so the rule was right that no sentence spans 908/909. The movement
      // came from a SECOND category the comment had not named. Enumerating the nine shows it:
      //
      //     "1."  "2."  "1."  "2."  "1."          five bare enumerators
      //     four long sentences                   the crossings and the p897 light-ray sentence
      //
      // segmentLedger splits a list enumerator off at its period, so "1." from p909's numbered
      // item is emitted as a whole "sentence" whose text occurs on many pages and therefore
      // resolves to more than one. FIVE OF THE NINE ARE NOT SENTENCES. Expect one more per
      // enumerated item as sections 6 and 7 land. That is a property of the segmenter, not of
      // the ledger, and it is the second reason this value is not a count of cross-page
      // sentences.
      //
      // 9 -> 10 when p910 landed, and this time BOTH halves of the rule were used as a
      // prediction in advance and both held. 909 ends with an INLINE tag, so no crossing was
      // predicted; 910 prints the numbered item "2.", so one enumerator was. Enumerating the
      // ten rather than diffing them: six bare enumerators ("1." "2." "1." "2." "1." "2.") and
      // four long sentences, the long count unchanged from 909. Predicted +1, observed +1,
      // from the named cause.
      //
      // 10 -> 11 when p914 landed (dispatch 193). Seen as a failure first, then checked against the
      // rule, which accounts for it: 913 ends in the display
      // eq-s8-d4 with its tag on its own line, so "Nennt man also E ... so erhält man: [d4] welche
      // Formel für phi = 0 in die einfachere übergeht: [d5]" joins across 913/914. 914 prints no
      // enumerator. Enumerated: six bare enumerators and five long sentences, the fifth the new
      // crossing. Next prediction: 914 ends with an INLINE tag, so 915 adds no crossing.
      //
      // 11 -> 12 when p917 landed, PREDICTED IN ADVANCE in a01b65e7's commit message. The line
      // above also held for 915: p914's tag was inline, so 915 moved nothing, and neither did 916,
      // since 915 ended a paragraph and 916 printed no enumerator. 916 ends in
      // the display eq-s9-d4 with its tag on its own line, so "Transformiert man diese
      // Gleichungen ... [d3] wobei [d4] Da - wie aus dem Additionstheorem ... entspricht." joins
      // across 916/917. Enumerated: six bare enumerators and six long sentences. Next: 917 ends
      // with an INLINE tag, mid-word, so 918 should add no crossing.
      //
      // 12 -> 14 when p920 landed, both halves predicted before the run. Crossing half: 919 ends
      // with an INLINE tag, so no crossing (918 had added none either, also as predicted).
      // Enumerator half: 920 prints the numbered items "1." and "2." of section 10's list of
      // experimental consequences, so two more bare enumerators. Enumerated: eight bare
      // enumerators and six long sentences. Next: 920 ends with an INLINE tag, and 921 prints
      // item "3.", so 921 should add exactly one.
      //
      // 14 -> 15 when p921 landed, predicted before the run: 920's tag is inline, so no crossing,
      // and 921 prints item "3.", one more bare enumerator. Enumerated: nine bare enumerators and
      // six long sentences. p921 is the article's last page, so this ledger adds no more pages;
      // the value moves again only if its text or the segmenter changes.
      //
      // WHAT THIS NUMBER CANNOT SEE, so that a later reader does not mistake it for the count of
      // cross-page sentences. A crossing is visible here only when [[CONTINUES]] sits on its own
      // line. When it is written inline, glued to the last word, segmentLedger keeps it attached,
      // the sentence terminates at the page break and the crossing reads as placeable. p904 ends
      // "...der unbewegt[[CONTINUES]]" and its crossing is invisible for exactly that reason;
      // p905 ends with the tag on its own line and its crossing shows. LEDGER_FORMAT permits both
      // placements, so this measure currently depends on a free formatting choice.
      //
      // Measured 2026-09-21 with the harness as its own oracle: 32 tags across the four ledgers,
      // 25 inline and 7 own-line. Rewriting every inline tag onto its own line in a scratch copy,
      // which changes no text, reveals 17 further crossing sentences - 5 in ap-17-132, 4 in
      // ap-17-549, 7 in ap-17-891, 1 in ap-18-639. So the value below is the count of VISIBLE
      // crossings in this paper, not the count of crossings. (Those four per-paper figures were
      // measured on 2026-09-21 against the tree at that moment and will drift as pages land;
      // what does not drift is that the inline form hides a crossing and the own-line form does
      // not.) Left as measured rather than repaired here: the repair
      // is either a ledger-wide rewrite touching four papers or a change to segmentLedger, and
      // both belong to am-span-recording-decision-ero2, not to a transcription pane.
      unplaceableProposedSentences: 15,
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
