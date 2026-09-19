import { describe, expect, test } from "bun:test";
import path from "node:path";
import { QUALITY_GATE_STEPS } from "./quality-gates/registry.ts";
import {
  consensusOffsetFrom,
  detectMalformedAnchor,
  evaluateContentIdentity,
  evaluateDeclaredAnchor,
  evaluateFolioCoverage,
  folioCandidatesOfPage,
  folioObservations,
  formatPinReport,
  getDefaultRepoRoot,
  locateExtractInParent,
  pdfPageTexts,
  renderPageHash,
  verifyFacsimilePins,
} from "./verify-facsimile-pins.ts";

const REPO_ROOT = getDefaultRepoRoot();

/**
 * Measured on 2026-09-19 with pdftoppm -gray -r 40 -singlefile -png, the settings the gate uses.
 * These are the bytes of the three defective pins and one correct pin as they stand on disk, so
 * the planted negatives below replay the actual historical defects rather than invented ones.
 */
const MEASURED = {
  ap19ExtractFirst: "01319316f94e60e06c9d9b92847719e2833c3732e8b06fa002961a210d910280",
  ap19Parent83: "38567604b34bbd22fda6aca38e0f39fe2ebed9f92ca81cfaff498287ef372012",
  ap19Parent97: "01319316f94e60e06c9d9b92847719e2833c3732e8b06fa002961a210d910280",
  ap19ExtractLast: "a57d76d62f0513e7a7f1c4cd15d5ff9e460e81f508e3caff0c89465f1c703a3c",
  ap19Parent99: "fd852f8a1b83055e374e11359eb9d350bd9d99eb06e90115cf37937d82c573e7",
  ap34ExtractFirst: "accf7bae7665ad73246318cacdd4c1e0f3117dc3c189b2bbebc6b3f8eff21f04",
  ap34ExtractLast: "aca209a2428836825832f148ff550421403c81a8f358105a6fcc76cdc365b354",
  ap34Parent219: "daa8b5495966c6ad43192452065a8cc017bbe4a31e2f93fbf9dd07f844a1ac97",
  ap34Parent220: "4d78af29b98a98f245106e6ef00dc670c31d3bcfef00310ce5de8d97ab045305",
  ap34Parent195: "accf7bae7665ad73246318cacdd4c1e0f3117dc3c189b2bbebc6b3f8eff21f04",
  ap132ExtractFirst: "5855e61943eb3a4a07655e2c8228d5829eddb447344842a4bdd42f9c7a1275df",
  ap132Parent144: "5855e61943eb3a4a07655e2c8228d5829eddb447344842a4bdd42f9c7a1275df",
} as const;

/** Folio offsets voted by each parent scan's own text layer, measured 2026-09-19. */
const MEASURED_OFFSET = {
  "ap-17-132": 12,
  "ap-17-549": -376,
  "ap-17-891": -776,
  "ap-18-639": -406,
  "ap-19-289": -206,
  "ap-34-591": -372,
} as const;

/** A parent whose text layer votes `offset` on `pages` pages, the shape the six real parents have. */
function parentVoting(offset: number, firstPrinted: number, pages: number) {
  return Array.from({ length: pages }, (_, i) => ({
    pageIndex: firstPrinted + i + offset,
    folio: firstPrinted + i,
  }));
}

describe("Pinned Facsimile Verification Gate (am-cf6m)", () => {
  describe("1. Planted real defects: each check refuses the defect it exists for", () => {
    test("ap-17-549's wrong config refuses on anchor arithmetic", () => {
      // The config as authored: printed 549-560 declared at parent 132-143, with a verified
      // anchor recording that parent 173 is printed 549. Implied offsets -417 and -376.
      const { findings, anchorImpliedFirstIndex } = evaluateDeclaredAnchor({
        key: "ap-17-549",
        articlePages: {
          printedFirst: 549,
          printedLast: 560,
          parentPageIndices: [132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143],
        },
        verifiedAnchor: {
          parentPageIndex: 173,
          printedPage: 549,
          verifiedBy: "agent:TanElk",
        },
      });

      expect(anchorImpliedFirstIndex).toBe(173);
      const offsetFinding = findings.find((f) => f.code === "FACSIMILE_PAGE_OFFSET_MISMATCH");
      expect(offsetFinding).toBeDefined();
      expect(offsetFinding?.message).toContain("parentPageIndices[0] (132)");
      expect(offsetFinding?.message).toContain("(173)");
      expect(offsetFinding?.message).toContain("549");
    });

    test("ap-17-549's wrong config also refuses against the parent's own folio numbering", () => {
      // Independent of the hand-recorded anchor: the parent scan's text layer puts printed 549
      // at parent page 173 on its own.
      const result = evaluateFolioCoverage({
        key: "ap-17-549",
        printedFirst: 549,
        printedLast: 560,
        declaredFirstIndex: 132,
        declaredLastIndex: 143,
        parentPageCount: 215,
        observations: parentVoting(MEASURED_OFFSET["ap-17-549"], 380, 200),
      });

      expect(result.consensus?.offset).toBe(-376);
      expect(result.folioImpliedFirstIndex).toBe(173);
      const finding = result.findings.find((f) => f.code === "PARENT_FOLIO_OFFSET_MISMATCH");
      expect(finding).toBeDefined();
      expect(finding?.message).toContain("declared first parent index 132");
      expect(finding?.message).toContain("parent page 173");
      expect(finding?.message).toContain("the config's implied offset is -417");
    });

    test("ap-19-289's stale extract refuses on content identity and names where it was cut from", () => {
      // The config was corrected 97 -> 83 and the pinned PDF was never re-extracted. The
      // arithmetic is self-consistent for a corrected config, so only the bytes expose it.
      const findings = evaluateContentIdentity({
        key: "ap-19-289",
        declaredFirstIndex: 83,
        declaredLastIndex: 99,
        extractFirstHash: MEASURED.ap19ExtractFirst,
        extractLastHash: MEASURED.ap19ExtractLast,
        parentFirstHash: MEASURED.ap19Parent83,
        parentLastHash: MEASURED.ap19Parent99,
        extractImpliedFirstIndex: 97,
      });

      expect(findings.length).toBe(2);
      expect(findings.every((f) => f.code === "STALE_PINNED_EXTRACT")).toBe(true);
      expect(findings[0]?.message).toContain("parent page 83");
      expect(findings[0]?.message).toContain("folio of parent page 97");
    });

    test("ap-34-591's stale extract refuses on content identity", () => {
      // Same class: corrected 195 -> 219, never re-extracted. The pinned bytes are parent 195.
      const findings = evaluateContentIdentity({
        key: "ap-34-591",
        declaredFirstIndex: 219,
        declaredLastIndex: 220,
        extractFirstHash: MEASURED.ap34ExtractFirst,
        extractLastHash: MEASURED.ap34ExtractLast,
        parentFirstHash: MEASURED.ap34Parent219,
        parentLastHash: MEASURED.ap34Parent220,
        extractImpliedFirstIndex: 195,
      });

      expect(findings.length).toBe(2);
      expect(findings[0]?.code).toBe("STALE_PINNED_EXTRACT");
      expect(findings[0]?.message).toContain("parent page 219");
      expect(findings[0]?.message).toContain("folio of parent page 195");
    });

    test("ap-19-289's anchor written at the wrong nesting level is named, not ignored", () => {
      // The file carries `verifiedAnchor:` with an empty value and the anchor's fields as its
      // siblings under articlePages. A reader sees anchor data; the validator sees none.
      const finding = detectMalformedAnchor({
        key: "ap-19-289",
        articlePages: {
          printedFirst: 289,
          printedLast: 306,
          parentPageIndices: [83, 84, 85],
          verifiedAnchor: null,
          parentPageIndex: 83,
          printedPage: 303,
          verifiedBy: "agent:TanElk",
        },
      });

      expect(finding?.code).toBe("MALFORMED_VERIFIED_ANCHOR");
      expect(finding?.message).toContain("articlePages");
      expect(finding?.message).toContain("parentPageIndex");
    });

    test("a pin whose printed pages are not inside its parent refuses with PRINTED_RANGE_OUTSIDE_PARENT", () => {
      // No pin on disk has this defect now, so it is planted with measured numbers: the 1906
      // volume-19 parent runs 239 pages at offset -206, i.e. printed 207-445. A pin claiming
      // the 1911 correction's printed 591-592 against it names a parent without the article.
      const result = evaluateFolioCoverage({
        key: "planted-wrong-parent",
        printedFirst: 591,
        printedLast: 592,
        declaredFirstIndex: 591 + MEASURED_OFFSET["ap-19-289"],
        declaredLastIndex: 592 + MEASURED_OFFSET["ap-19-289"],
        parentPageCount: 239,
        observations: parentVoting(MEASURED_OFFSET["ap-19-289"], 210, 200),
      });

      const finding = result.findings.find((f) => f.code === "PRINTED_RANGE_OUTSIDE_PARENT");
      expect(finding).toBeDefined();
      expect(finding?.message).toContain("591-592");
      expect(finding?.message).toContain("207-445");
    });

    test("a missing anchor refuses instead of passing quietly", () => {
      const { findings } = evaluateDeclaredAnchor({
        key: "ap-34-591",
        articlePages: { printedFirst: 591, printedLast: 592, parentPageIndices: [219, 220] },
      });
      expect(findings.some((f) => f.code === "MISSING_VERIFIED_ANCHOR")).toBe(true);
    });

    test("an inconclusive folio vote refuses instead of passing quietly", () => {
      const result = evaluateFolioCoverage({
        key: "unreadable-parent",
        printedFirst: 100,
        printedLast: 110,
        declaredFirstIndex: 10,
        declaredLastIndex: 20,
        parentPageCount: 200,
        // Four scattered votes: below the vote floor, so no offset is established.
        observations: [
          { pageIndex: 10, folio: 100 },
          { pageIndex: 11, folio: 101 },
          { pageIndex: 60, folio: 7 },
          { pageIndex: 61, folio: 9 },
        ],
      });
      expect(result.consensus).toBeNull();
      expect(result.findings[0]?.code).toBe("FOLIO_CONSENSUS_UNAVAILABLE");
    });

    test("a folio vote without a clear winner refuses rather than picking one", () => {
      const contested = [...parentVoting(-206, 210, 40), ...parentVoting(-200, 210, 40)];
      expect(consensusOffsetFrom(contested)).toBeNull();
    });
  });

  describe("2. Negative controls: a correct pin is not refused", () => {
    test("ap-17-132's recorded anchor, bytes and folios all agree", () => {
      const anchor = evaluateDeclaredAnchor({
        key: "ap-17-132",
        articlePages: {
          printedFirst: 132,
          printedLast: 134,
          parentPageIndices: [144, 145, 146],
        },
        verifiedAnchor: { parentPageIndex: 144, printedPage: 132, verifiedBy: "agent:TanElk" },
      });
      expect(anchor.findings.length).toBe(0);
      expect(anchor.anchorImpliedFirstIndex).toBe(144);

      const identity = evaluateContentIdentity({
        key: "ap-17-132",
        declaredFirstIndex: 144,
        declaredLastIndex: 160,
        extractFirstHash: MEASURED.ap132ExtractFirst,
        extractLastHash: "4c9eb782b0fce8ff0000000000000000000000000000000000000000deadbeef",
        parentFirstHash: MEASURED.ap132Parent144,
        parentLastHash: "4c9eb782b0fce8ff0000000000000000000000000000000000000000deadbeef",
      });
      expect(identity.length).toBe(0);

      const coverage = evaluateFolioCoverage({
        key: "ap-17-132",
        printedFirst: 132,
        printedLast: 148,
        declaredFirstIndex: 144,
        declaredLastIndex: 160,
        parentPageCount: 211,
        observations: parentVoting(MEASURED_OFFSET["ap-17-132"], 1, 199),
      });
      expect(coverage.findings.length).toBe(0);
      expect(coverage.consensus?.offset).toBe(12);
    });

    test("repairing a stale extract clears the content-identity refusal", () => {
      // The same ap-19-289 config, once the extract is re-cut from parent 83.
      const findings = evaluateContentIdentity({
        key: "ap-19-289",
        declaredFirstIndex: 83,
        declaredLastIndex: 99,
        extractFirstHash: MEASURED.ap19Parent83,
        extractLastHash: MEASURED.ap19Parent99,
        parentFirstHash: MEASURED.ap19Parent83,
        parentLastHash: MEASURED.ap19Parent99,
      });
      expect(findings.length).toBe(0);
    });

    test("a well-formed anchor is never reported as malformed", () => {
      expect(
        detectMalformedAnchor({
          key: "ap-17-132",
          verifiedAnchor: { parentPageIndex: 144, printedPage: 132, verifiedBy: "agent:TanElk" },
          articlePages: { printedFirst: 132, printedLast: 148, parentPageIndices: [144] },
        }),
      ).toBeNull();
    });
  });

  describe("3. The locator states only what it has confirmed", () => {
    test("a folio candidate is reported only when that parent page renders identically", () => {
      const rendered: Record<number, string> = {
        97: MEASURED.ap19Parent97,
        83: MEASURED.ap19Parent83,
      };
      const located = locateExtractInParent({
        parentPath: "/parent.pdf",
        parentPageCount: 239,
        extractFirstHash: MEASURED.ap19ExtractFirst,
        extractFirstPageText:
          "Neue Bestimmung der Moleküldimensionen.       303\nr, lumeneinheit u",
        consensusOffset: -206,
        renderHash: (_p, page) => rendered[page] ?? "no-such-page",
      });
      expect(located).toBe(97);
    });

    test("a folio that does not render to the extract's page is not reported as its origin", () => {
      const located = locateExtractInParent({
        parentPath: "/parent.pdf",
        parentPageCount: 239,
        extractFirstHash: MEASURED.ap19ExtractFirst,
        // A stray numeral from a table, not a folio.
        extractFirstPageText: "\\ | 4\n42",
        consensusOffset: -206,
        renderHash: () => "some-other-page",
      });
      expect(located).toBeNull();
    });

    test("folio observations are read from the head and foot of each page", () => {
      const observations = folioObservations(
        ["591\n11. Berichtigung zu meiner Arbeit:", "* \n592      A, Einstein."],
        219,
      );
      expect(observations).toContainEqual({ pageIndex: 219, folio: 591 });
      expect(observations).toContainEqual({ pageIndex: 220, folio: 592 });
      expect(consensusOffsetFrom([...observations, ...parentVoting(-372, 400, 30)])?.offset).toBe(
        -372,
      );
    });
  });

  describe("4. Measurement primitives against real pinned bytes", () => {
    const pinned132 = path.join(REPO_ROOT, "public/papers/pdfs/ap-17-132.pdf");
    const pinned19 = path.join(REPO_ROOT, "public/papers/pdfs/ap-19-289.pdf");

    test("the same page renders to the same hash twice", () => {
      expect(renderPageHash(pinned132, 1)).toBe(renderPageHash(pinned132, 1));
    });

    test("two different pages do not render to the same hash", () => {
      expect(renderPageHash(pinned132, 1)).not.toBe(renderPageHash(pinned132, 2));
    });

    test("the pinned ap-19-289 extract's own text layer carries folio 303, not the declared 289", () => {
      // Read from the text layer the Internet Archive scan already carries. No recognition
      // process is started here; AGENTS.md forbids running OCR on this machine and none runs.
      const candidates = folioCandidatesOfPage(pdfPageTexts(pinned19)[0] ?? "");
      expect(candidates).toContain(303);
      expect(candidates).not.toContain(289);
    });
  });

  describe("5. Quality gate registry", () => {
    test("QUALITY_GATE_STEPS registers facsimile-pins", () => {
      const step = QUALITY_GATE_STEPS.find((s) => s.id === "facsimile-pins");
      expect(step).toBeDefined();
      expect(step?.command).toEqual(["bun", "scripts/verify-facsimile-pins.ts"]);
      expect(step?.family).toBe("fast");
      expect(step?.owner).toBe("am-cf6m");
      // The parent scans are not committed (/sources is git-ignored), so CI cannot run this
      // check; the release profiles run locally where the parents live and must require it.
      expect(step?.requiredInCi).toBe(false);
      expect(step?.requiredInProfiles).toContain("preview");
      expect(step?.requiredInProfiles).toContain("launch");
      expect(step?.availability.scriptPath).toBe("scripts/verify-facsimile-pins.ts");
      expect(step?.availability.tool).toBe("pdftoppm");
    });
  });

  describe("6. The pins on disk", () => {
    test("every pinned facsimile verifies against its parent", () => {
      const report = verifyFacsimilePins();
      if (!report.valid) {
        // This is the deliverable red. Three pins carry wrong page windows (ap-17-549's
        // config, ap-19-289's and ap-34-591's stale extracts) and re-pinning is owner-
        // authorized work. This gate stays red until the owner authorizes the repair; do
        // not silence it by editing configs, adding anchors, or exempting a key. If the
        // report below says a parent scan is not on disk, the pins were not verified here
        // either: /sources is git-ignored, so run this where the parents were downloaded.
        throw new Error(`\n${formatPinReport(report)}`);
      }
      expect(report.valid).toBe(true);
      expect(report.refusedCount).toBe(0);
    }, 180_000);
  });
});
