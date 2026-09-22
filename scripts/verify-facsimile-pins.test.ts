import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import { QUALITY_GATE_STEPS } from "./quality-gates/registry.ts";
import {
  consensusOffsetFrom,
  detectMalformedAnchor,
  evaluateContentIdentity,
  evaluateDeclaredAnchor,
  evaluateExtractFolios,
  evaluateFolioCoverage,
  extractVoteFloor,
  folioObservations,
  formatPinReport,
  getDefaultRepoRoot,
  isUnmeasurable,
  locateExtractInParent,
  PinMeasurementError,
  pdfPageCount,
  pdfPageTexts,
  renderPageHash,
  requireTool,
  UNMEASURABLE_CODES,
  verifyFacsimilePins,
  verifyPin,
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

      assert.equal(anchorImpliedFirstIndex, 173);
      const offsetFinding = findings.find((f) => f.code === "facsimile-page-offset-mismatch");
      assert.notEqual(offsetFinding, undefined);
      assert.ok(
        offsetFinding?.message.includes("parentPageIndices[0] (132)"),
        `must contain ${String("parentPageIndices[0] (132)")}`,
      );
      assert.ok(offsetFinding?.message.includes("(173)"), `must contain ${String("(173)")}`);
      assert.ok(offsetFinding?.message.includes("549"), `must contain ${String("549")}`);
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

      assert.equal(result.consensus?.offset, -376);
      assert.equal(result.folioImpliedFirstIndex, 173);
      const finding = result.findings.find((f) => f.code === "parent-folio-offset-mismatch");
      assert.notEqual(finding, undefined);
      assert.ok(
        finding?.message.includes("declared first parent index 132"),
        `must contain ${String("declared first parent index 132")}`,
      );
      assert.ok(
        finding?.message.includes("parent page 173"),
        `must contain ${String("parent page 173")}`,
      );
      assert.ok(
        finding?.message.includes("the config's implied offset is -417"),
        `must contain ${String("the config's implied offset is -417")}`,
      );
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

      assert.equal(findings.length, 2);
      assert.equal(
        findings.every((f) => f.code === "stale-pinned-extract"),
        true,
      );
      assert.ok(
        findings[0]?.message.includes("parent page 83"),
        `must contain ${String("parent page 83")}`,
      );
      assert.ok(
        findings[0]?.message.includes("folio of parent page 97"),
        `must contain ${String("folio of parent page 97")}`,
      );
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

      assert.equal(findings.length, 2);
      assert.equal(findings[0]?.code, "stale-pinned-extract");
      assert.ok(
        findings[0]?.message.includes("parent page 219"),
        `must contain ${String("parent page 219")}`,
      );
      assert.ok(
        findings[0]?.message.includes("folio of parent page 195"),
        `must contain ${String("folio of parent page 195")}`,
      );
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

      assert.equal(finding?.code, "malformed-verified-anchor");
      assert.ok(
        finding?.message.includes("articlePages"),
        `must contain ${String("articlePages")}`,
      );
      assert.ok(
        finding?.message.includes("parentPageIndex"),
        `must contain ${String("parentPageIndex")}`,
      );
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

      const finding = result.findings.find((f) => f.code === "printed-range-outside-parent");
      assert.notEqual(finding, undefined);
      assert.ok(finding?.message.includes("591-592"), `must contain ${String("591-592")}`);
      assert.ok(finding?.message.includes("207-445"), `must contain ${String("207-445")}`);
    });

    test("a declared LAST index that disagrees while the first agrees (verify-facsimile-pins.ts:400)", () => {
      // The two parent-folio-offset-mismatch sites are separate arms and only one had a
      // test. They differ in what a reader has to do about them: a wrong FIRST index means
      // the window starts in the wrong place, and a wrong LAST index with a right first
      // means the declared window is the wrong LENGTH - the config claims more or fewer
      // printed pages than the article has. A config can have the second without the first,
      // and until now that config passed this check.
      //
      // Measured numbers: ap-17-549's parent sits at offset MEASURED_OFFSET["ap-17-549"],
      // and the article is printed 549-560. This declares the correct first index and a
      // last index one page long, as a config that mis-transcribed 560 as 561 would.
      const offset = MEASURED_OFFSET["ap-17-549"];
      const result = evaluateFolioCoverage({
        key: "planted-long-window",
        printedFirst: 549,
        printedLast: 560,
        declaredFirstIndex: 549 + offset,
        declaredLastIndex: 561 + offset,
        parentPageCount: 700,
        observations: parentVoting(offset, 540, 200),
      });

      const mismatches = result.findings.filter((f) => f.code === "parent-folio-offset-mismatch");
      assert.equal(
        mismatches.length,
        1,
        `only the last-index arm should fire; got ${mismatches.map((f) => f.message).join(" | ")}`,
      );
      // Named, so this cannot pass on the first-index arm's message if the arms are merged.
      assert.match(mismatches[0]?.message ?? "", /declared last parent index/);
      assert.ok((mismatches[0]?.message ?? "").includes(String(561 + offset)));
      assert.ok((mismatches[0]?.message ?? "").includes(String(560 + offset)));
    });

    test("a missing anchor refuses instead of passing quietly", () => {
      const { findings } = evaluateDeclaredAnchor({
        key: "ap-34-591",
        articlePages: { printedFirst: 591, printedLast: 592, parentPageIndices: [219, 220] },
      });
      assert.equal(
        findings.some((f) => f.code === "missing-verified-anchor"),
        true,
      );
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
      assert.equal(result.consensus, null);
      assert.equal(result.findings[0]?.code, "folio-consensus-unavailable");
    });

    test("a folio vote without a clear winner refuses rather than picking one", () => {
      const contested = [...parentVoting(-206, 210, 40), ...parentVoting(-200, 210, 40)];
      assert.equal(consensusOffsetFrom(contested), null);
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
      assert.equal(anchor.findings.length, 0);
      assert.equal(anchor.anchorImpliedFirstIndex, 144);

      const identity = evaluateContentIdentity({
        key: "ap-17-132",
        declaredFirstIndex: 144,
        declaredLastIndex: 160,
        extractFirstHash: MEASURED.ap132ExtractFirst,
        extractLastHash: "4c9eb782b0fce8ff0000000000000000000000000000000000000000deadbeef",
        parentFirstHash: MEASURED.ap132Parent144,
        parentLastHash: "4c9eb782b0fce8ff0000000000000000000000000000000000000000deadbeef",
      });
      assert.equal(identity.length, 0);

      const coverage = evaluateFolioCoverage({
        key: "ap-17-132",
        printedFirst: 132,
        printedLast: 148,
        declaredFirstIndex: 144,
        declaredLastIndex: 160,
        parentPageCount: 211,
        observations: parentVoting(MEASURED_OFFSET["ap-17-132"], 1, 199),
      });
      assert.equal(coverage.findings.length, 0);
      assert.equal(coverage.consensus?.offset, 12);
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
      assert.equal(findings.length, 0);
    });

    test("a well-formed anchor is never reported as malformed", () => {
      assert.equal(
        detectMalformedAnchor({
          key: "ap-17-132",
          verifiedAnchor: { parentPageIndex: 144, printedPage: 132, verifiedBy: "agent:TanElk" },
          articlePages: { printedFirst: 132, printedLast: 148, parentPageIndices: [144] },
        }),
        null,
      );
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
      assert.equal(located, 97);
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
      assert.equal(located, null);
    });

    test("folio observations are read from the head and foot of each page", () => {
      const observations = folioObservations(
        ["591\n11. Berichtigung zu meiner Arbeit:", "* \n592      A, Einstein."],
        219,
      );
      assert.ok(
        observations.some(
          (o) => JSON.stringify(o) === JSON.stringify({ pageIndex: 219, folio: 591 }),
        ),
        `must contain ${JSON.stringify({ pageIndex: 219, folio: 591 })}`,
      );
      assert.ok(
        observations.some(
          (o) => JSON.stringify(o) === JSON.stringify({ pageIndex: 220, folio: 592 }),
        ),
        `must contain ${JSON.stringify({ pageIndex: 220, folio: 592 })}`,
      );
      assert.equal(
        consensusOffsetFrom([...observations, ...parentVoting(-372, 400, 30)])?.offset,
        -372,
      );
    });
  });

  describe("4. Measurement primitives against real pinned bytes", () => {
    const pinned132 = path.join(REPO_ROOT, "public/papers/pdfs/ap-17-132.pdf");
    const pinned19 = path.join(REPO_ROOT, "public/papers/pdfs/ap-19-289.pdf");

    test("the same page renders to the same hash twice", () => {
      assert.equal(renderPageHash(pinned132, 1), renderPageHash(pinned132, 1));
    });

    test("two different pages do not render to the same hash", () => {
      assert.notEqual(renderPageHash(pinned132, 1), renderPageHash(pinned132, 2));
    });

    test("the pinned ap-19-289 extract starts on the article's OPENING page, not a later one", () => {
      // Read from the text layer the Internet Archive scan already carries. No recognition
      // process is started here; AGENTS.md forbids running OCR on this machine and none runs.
      //
      // am-cf6m, twice corrected. This first asserted that the extract's first page carries
      // folio 303 and not 289 - a witness to the stale pin, falsified when the pin was
      // repaired. Inverting it to "carries 289" then failed too, and measuring showed why:
      // folioCandidatesOfPage returns [] for pages 1 and 2 of the corrected extract, whose
      // text layer renders the header as "2 3 Eine neue Bestimmung der Molekül-". A single
      // page's folio is not a sound measurement, which is the reason this gate votes an offset
      // across the whole parent instead of trusting any one page.
      //
      // What one page CAN support is whether it is the article's opening. The byline appears
      // only there: the corrected extract's first page carries "von A. Einstein." and the
      // retired one, cut from parent 97, carries the running head "Neue Bestimmung der
      // Moleküldimensionen. 303" and no byline. Measured on both files.
      const firstPageText = (pdfPageTexts(pinned19)[0] ?? "").replace(/\s+/g, " ");
      assert.ok(/von A/.test(firstPageText), "the first page must carry the article's byline");
      assert.ok(
        firstPageText.includes("Bestimmung") && firstPageText.includes("Molekül"),
        "the first page must be the Moleküldimensionen article",
      );
      assert.ok(
        !firstPageText.includes("303"),
        "a first page carrying folio 303 is the retired extract, cut from parent 97",
      );
    });
  });

  describe("4b. A tool refusal names the failure it saw (am-yf6h)", () => {
    // The whole point of this block: requireTool used to answer every spawnSync
    // error with "'pdftoppm' is not available on PATH". On this host the real
    // error was EBADF from posix_spawn '/opt/homebrew/bin/pdftoppm' - an
    // ABSOLUTE PATH, so resolution had already succeeded and the sentence was
    // false in a way anybody could check. It cost several ticks of investigation
    // and, worse, it let "0 of 6 pins verified" be reported as a verdict about
    // the pins. Both states below are produced for real, not simulated.

    function refusalOf(tool: string): PinMeasurementError {
      try {
        requireTool(tool);
      } catch (err) {
        assert.ok(
          err instanceof PinMeasurementError,
          `expected a typed refusal, got ${String(err)}`,
        );
        return err;
      }
      throw new Error(`requireTool('${tool}') did not refuse, so this fixture proves nothing`);
    }

    test("a genuinely absent tool is ENOENT and says so", () => {
      const refusal = refusalOf("am-yf6h-no-such-tool-anywhere");
      assert.equal(refusal.code, "render-tool-unavailable");
      assert.ok(refusal.message.includes("ENOENT"), refusal.message);
      assert.ok(refusal.message.includes("not available on PATH"), refusal.message);
    });

    test("a tool that is present but cannot start is NOT reported as missing", () => {
      // A real non-ENOENT spawn failure: a file that exists and is not executable.
      // EACCES stands in for the EBADF this host produces under `bun test`, which
      // cannot be summoned on demand; what both share is the only thing under test,
      // that the error is not ENOENT.
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "am-yf6h-"));
      const notExecutable = path.join(dir, "pdftoppm");
      fs.writeFileSync(notExecutable, "#!/bin/sh\necho hi\n", { mode: 0o644 });
      try {
        const refusal = refusalOf(notExecutable);
        // Reachability, asserted before the claim: this must be the OTHER state.
        assert.ok(
          !refusal.message.includes("ENOENT"),
          `the fixture produced an ENOENT after all, so it does not exercise the second branch: ${refusal.message}`,
        );
        assert.equal(refusal.code, "render-tool-spawn-failed");
        assert.ok(refusal.message.includes("EACCES"), refusal.message);
        // The sentence that caused am-yf6h must not appear.
        assert.ok(
          !refusal.message.includes("not available on PATH"),
          `a spawn failure that is not ENOENT must not assert the tool is missing: ${refusal.message}`,
        );
        assert.ok(
          refusal.message.toLowerCase().includes("not a finding about the pins"),
          "a runner failure must say it is not a verdict about the pins",
        );
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe("4c. A missing parent scan is not a verdict about a pin (am-yf6h)", () => {
    // CI is this case on every run: /sources is git-ignored, so no parent scan is
    // ever on disk there, and before this the summary read "0 verified, 6 refused"
    // as though the pins had been examined and found wanting.
    const emptyRoot = path.join(REPO_ROOT, "artifacts", "test-tmp", "pins-no-sources");

    /**
     * The config-defect half of this test used to be carried by the real ap-17-549, ap-19-289
     * and ap-34-591, which all failed config arithmetic. am-cf6m repaired all three, and this
     * test failed - not because the split broke, but because its fixture was the defect and the
     * defect was fixed. A test that depends on the corpus staying broken cannot survive the
     * corpus being mended, so the defect is now planted here instead: a copy of a real config
     * with its first declared index moved away from its verified anchor. Both halves now hold
     * whatever the real configs say.
     */
    function configDirWithOnePlantedDefect(): string {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pins-split-"));
      const realDir = path.join(REPO_ROOT, "scripts", "sources", "facsimile-sources");
      for (const name of fs.readdirSync(realDir).filter((f) => f.endsWith(".yaml"))) {
        fs.copyFileSync(path.join(realDir, name), path.join(dir, name));
      }
      const planted = path.join(dir, "ap-17-549.yaml");
      const text = fs.readFileSync(planted, "utf8");
      const moved = text.replace("    - 173\n", "    - 132\n");
      assert.notEqual(moved, text, "the planted defect did not apply; the fixture proves nothing");
      fs.writeFileSync(planted, moved);
      return dir;
    }

    test("pins that cannot be compared are classed as unmeasurable, not as refused on evidence", () => {
      fs.mkdirSync(emptyRoot, { recursive: true });
      const configDir = configDirWithOnePlantedDefect();
      const report = verifyFacsimilePins({ repoRoot: emptyRoot, configDir });

      // Reachability first: the state under test has to actually occur.
      assert.ok(report.results.length > 0, "no configs were read, so this proves nothing");
      const artifactCodes = new Set(
        report.results
          .flatMap((r) => r.findings.map((f) => f.code))
          .filter((c) => UNMEASURABLE_CODES.has(c)),
      );
      assert.ok(
        artifactCodes.size > 0,
        "expected missing-file refusals with no repository around; got none",
      );

      // The split, asserted against NAMED configs rather than by restating the
      // predicate. Comparing isUnmeasurable() to a filter over the same set would
      // be true whatever either contained.
      //
      // Every config that is sound has nothing left but environment when no files are
      // present: unmeasurable. The one carrying the planted arithmetic defect fails on
      // the config alone, which needs no files and is just as true in CI as here, so it
      // is NOT unmeasurable and must still be reported.
      const byKey = new Map(report.results.map((r) => [r.key, r]));
      for (const key of ["ap-17-891", "ap-18-639", "ap-17-132", "ap-19-289", "ap-34-591"]) {
        const result = byKey.get(key);
        assert.notEqual(result, undefined, `${key} was not read`);
        assert.equal(
          isUnmeasurable(result?.findings ?? []),
          true,
          `${key} has no config defect, so with no files present it is unmeasurable, not refused: ` +
            `${(result?.findings ?? []).map((f) => f.code).join(", ")}`,
        );
      }
      for (const key of ["ap-17-549"]) {
        const result = byKey.get(key);
        assert.notEqual(result, undefined, `${key} was not read`);
        assert.equal(
          isUnmeasurable(result?.findings ?? []),
          false,
          `${key} fails config arithmetic, which needs no files; classing it unmeasurable would ` +
            "hide a real finding in CI",
        );
      }

      // And the report says so in words, so a reader of a CI log is not told that
      // six pins were examined and refused when none of them was examined at all.
      const text = formatPinReport(report);
      assert.ok(
        text.includes("could not be MEASURED here at all"),
        "the report must name how many pins were not measurable",
      );
    });
  });

  describe("5. Quality gate registry", () => {
    test("QUALITY_GATE_STEPS registers facsimile-pins", () => {
      const step = QUALITY_GATE_STEPS.find((s) => s.id === "facsimile-pins");
      assert.notEqual(step, undefined);
      assert.deepEqual(step?.command, ["bun", "scripts/verify-facsimile-pins.ts"]);
      assert.equal(step?.family, "fast");
      assert.equal(step?.owner, "am-cf6m");
      // The parent scans are not committed (/sources is git-ignored), so CI cannot run this
      // check; the release profiles run locally where the parents live and must require it.
      assert.equal(step?.requiredInCi, false);
      assert.ok(step?.requiredInProfiles.includes("preview"), `must contain ${String("preview")}`);
      assert.ok(step?.requiredInProfiles.includes("launch"), `must contain ${String("launch")}`);
      assert.equal(step?.availability.scriptPath, "scripts/verify-facsimile-pins.ts");
      assert.equal(step?.availability.tool, "pdftoppm");
    });
  });

  describe("5b. Every artifact refusal, driven by the condition that raises it (am-muyh)", () => {
    // Eight coded refusals in verifyPin had no test. Each is reached here by building
    // the state it exists for, against a temp root with no PDFs, so none of them needs
    // a tool, a parent scan, or the network. The point is not coverage arithmetic: an
    // untested refusal is a sentence nobody has ever seen the code produce, and three
    // of these fire on exactly the conditions that made this gate red all evening.
    const tempRoot = (name: string): string => {
      const dir = path.join(REPO_ROOT, "artifacts", "test-tmp", "pin-refusals", name);
      fs.mkdirSync(dir, { recursive: true });
      return dir;
    };

    const baseConfig = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
      key: "ap-99-001",
      articlePages: { printedFirst: 1, printedLast: 2, parentPageIndices: [10, 11] },
      verifiedAnchor: { parentPageIndex: 10, printedPage: 1, verifiedBy: "test-fixture" },
      pinned: {
        path: "public/papers/pdfs/ap-99-001.pdf",
        sha256: "a".repeat(64),
        pageCount: 2,
        parent: { path: "sources/parents/ap-99-001-parent.pdf", sha256: "b".repeat(64) },
      },
      ...overrides,
    });

    // CITATIONS GO STALE SILENTLY, and these seven did. They were written against lines
    // 700-772; inserting the extract-folio evaluator above them moved every one by about
    // 159 lines, and nothing said so - under the old mention-credit rule the sites were
    // credited anyway, so this file read as fully covered while seven of its citations
    // pointed at nothing. The am-ksl3 tightening is what exposed it. Repointed to the
    // lines the scanner reports today; see am-ksl3 for the follow-on, that a citation
    // matching no site should be REPORTED rather than ignored.
    //
    // Each arm cites its site as (verify-facsimile-pins.ts:LINE). The refusal scanner
    // otherwise credits sites by COUNTING test blocks that mention a code and handing
    // that many sites the credit in line order, so seven tests would have covered
    // whichever seven sites came first rather than the seven they actually drive. A
    // citation makes the attribution identity-based, which is what the plants proved.
    //
    // Qualified by check, not by code alone. My first version of this block matched on
    // the code only, and the invalid-config arm passed against the ANCHOR check's
    // invalid-config while the artifact one had been renamed away - a green that proved
    // nothing. Two checks legitimately share that code, so the pair is the identity.
    const codesFrom = (config: unknown, root: string): string[] =>
      verifyPin(config, root)
        .findings.filter((finding) => finding.check === "artifact")
        .map((finding) => finding.code);

    // The two digest refusals sit BELOW requireTool inside verifyPin, so on a host with
    // no poppler they are unreachable and an assertion about them would go red for the
    // wrong reason. They are skipped by name there rather than quietly passing: a
    // refusal nobody could reach is not-measured, and saying so is the honest answer.
    const toolGated =
      ["pdftoppm", "pdftotext", "pdfinfo"].every(
        (tool) => spawnSync(tool, ["-v"], { encoding: "utf8" }).error === undefined,
      ) === true
        ? false
        : "poppler is not on PATH here, so the refusals below requireTool were not measured";

    function writePdf(root: string, relative: string, bytes: Buffer): void {
      const full = path.join(root, relative);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, bytes);
    }

    test("a config with no pinned artifact at all (verify-facsimile-pins.ts:859)", () => {
      const config = baseConfig();
      delete (config as { pinned?: unknown }).pinned;
      const root = tempRoot("no-pinned");
      assert.ok(codesFrom(config, root).includes("pinned-pdf-unavailable"));
      // The code alone does not identify the site: :894 emits it too. Asserting THIS site's
      // message is what makes the citation above a claim about one line rather than two.
      const mine = verifyPin(config, root).findings.filter(
        (f) => f.code === "pinned-pdf-unavailable",
      );
      assert.equal(mine.length, 1);
      assert.match(String(mine[0]?.message), /records no pinned artifact/);
    });

    test("a pinned artifact with no parent record (verify-facsimile-pins.ts:867)", () => {
      const config = baseConfig();
      delete ((config as { pinned: Record<string, unknown> }).pinned as { parent?: unknown })
        .parent;
      assert.ok(codesFrom(config, tempRoot("no-parent-record")).includes("parent-record-missing"));
    });

    test("a config declaring no printed range or parent page indices (verify-facsimile-pins.ts:882)", () => {
      const config = baseConfig({ articlePages: {} });
      assert.ok(codesFrom(config, tempRoot("no-range")).includes("invalid-config"));
    });

    test("a pinned PDF that is not on disk (verify-facsimile-pins.ts:896)", () => {
      // The temp root is empty, so the recorded path resolves to nothing.
      const root = tempRoot("absent-extract");
      assert.ok(codesFrom(baseConfig(), root).includes("pinned-pdf-unavailable"));
      // Same code as :859, so the message is the identity. Without this the test passes when the
      // no-record site fires instead, which is the state it is meant to distinguish from.
      const mine = verifyPin(baseConfig(), root).findings.filter(
        (f) => f.code === "pinned-pdf-unavailable",
      );
      assert.equal(mine.length, 1);
      assert.match(String(mine[0]?.message), /is not on disk/);
    });

    test("a parent scan that is not on disk (verify-facsimile-pins.ts:903)", () => {
      // The extract exists and the parent does not: this is the CI condition, and it
      // must name the parent rather than the extract.
      const root = tempRoot("absent-parent");
      writePdf(root, "public/papers/pdfs/ap-99-001.pdf", Buffer.from("%PDF-1.4\n"));
      const codes = codesFrom(baseConfig(), root);
      assert.ok(codes.includes("parent-pdf-unavailable"), codes.join(", "));
      assert.ok(
        !codes.includes("pinned-pdf-unavailable"),
        "the extract is present and must not be blamed",
      );
    });

    test("a pinned PDF whose bytes are not the recorded digest (verify-facsimile-pins.ts:929)", {
      skip: toolGated,
    }, () => {
      const root = tempRoot("extract-digest");
      writePdf(root, "public/papers/pdfs/ap-99-001.pdf", Buffer.from("not the pinned bytes"));
      writePdf(root, "sources/parents/ap-99-001-parent.pdf", Buffer.from("not the parent bytes"));
      assert.ok(codesFrom(baseConfig(), root).includes("pinned-digest-conflict"));
    });

    test("a parent scan whose bytes are not the recorded digest (verify-facsimile-pins.ts:977)", {
      skip: toolGated,
    }, () => {
      // The extract's digest is made to match so the parent is the only conflict left,
      // otherwise this arm would pass on the extract's failure.
      const root = tempRoot("parent-digest");
      const extractBytes = Buffer.from("the pinned bytes");
      writePdf(root, "public/papers/pdfs/ap-99-001.pdf", extractBytes);
      writePdf(root, "sources/parents/ap-99-001-parent.pdf", Buffer.from("not the parent bytes"));
      const config = baseConfig();
      (config as { pinned: Record<string, unknown> }).pinned.sha256 = createHash("sha256")
        .update(extractBytes)
        .digest("hex");
      const codes = codesFrom(config, root);
      assert.ok(codes.includes("parent-digest-conflict"), codes.join(", "));
      assert.ok(!codes.includes("pinned-digest-conflict"), "the extract digest was made to match");
    });
  });

  describe("5c. What the pinned bytes say about themselves (am-jz7p)", () => {
    // The one check in this file that needs no parent scan, and therefore the only one
    // that could ever run in CI. Driven entirely through fixtures so the decision is
    // testable without a PDF: the measurement half (reading a real text layer) is a
    // separate, blocked piece, and mixing them would make this untestable until it lands.
    //
    // The numbers below are ap-17-549's: printed 549-560, twelve pages. The failure it
    // exists for is the real one - the pin that served L. Hermann on Leyden jars.

    /** Text-layer votes for an extract that really does hold printedFirst..printedLast. */
    function honestObservations(printedFirst: number, pages: number, votesPerPage = 12) {
      const observations: { pageIndex: number; folio: number }[] = [];
      for (let page = 1; page <= pages; page++) {
        for (let vote = 0; vote < votesPerPage; vote++) {
          observations.push({ pageIndex: page, folio: printedFirst + page - 1 });
        }
      }
      return observations;
    }

    const codesOf = (result: { findings: readonly { code: string }[] }): string[] =>
      result.findings.map((finding) => finding.code);

    test("an extract that holds the pages it claims raises nothing", () => {
      // Reachability before the claim: without this, every arm below is satisfied by an
      // evaluator that refuses everything, and the three failures would prove nothing.
      const result = evaluateExtractFolios({
        key: "ap-17-549",
        printedFirst: 549,
        printedLast: 560,
        extractPageCount: 12,
        observations: honestObservations(549, 12),
      });
      assert.deepEqual(codesOf(result), []);
      assert.deepEqual(result.observedPrintedRange, { first: 549, last: 560 });
    });

    test("the wrong part of the volume, which is the defect this exists for (verify-facsimile-pins.ts:extract-folio-mismatch)", () => {
      // Twelve pages, right count, right digest, wrong article: the extract's own text
      // layer reads 137-148 while the record says 549-560. No parent scan involved.
      const result = evaluateExtractFolios({
        key: "ap-17-549",
        printedFirst: 549,
        printedLast: 560,
        extractPageCount: 12,
        observations: honestObservations(137, 12),
      });
      assert.ok(codesOf(result).includes("extract-folio-mismatch"), codesOf(result).join(", "));
      assert.deepEqual(result.observedPrintedRange, { first: 137, last: 148 });
      const message = result.findings[0]?.message ?? "";
      // The report must name both ranges, or a reader cannot tell which one to trust.
      assert.ok(message.includes("549-560"), message);
      assert.ok(message.includes("137-148"), message);
    });

    test("a page count that cannot be the declared range", () => {
      const result = evaluateExtractFolios({
        key: "ap-17-549",
        printedFirst: 549,
        printedLast: 560,
        extractPageCount: 3,
        observations: honestObservations(549, 3),
      });
      assert.ok(codesOf(result).includes("extract-page-count-mismatch"));
    });

    test("the page count is checked even when there is no text layer to read", () => {
      // The ordering matters. A photograph with no text layer is the common case here, and
      // if the count check sat below the consensus return, the commonest extract in the
      // corpus would get no check at all while reporting only "not measured".
      const result = evaluateExtractFolios({
        key: "ap-17-549",
        printedFirst: 549,
        printedLast: 560,
        extractPageCount: 3,
        observations: [],
      });
      const codes = codesOf(result);
      assert.ok(codes.includes("extract-page-count-mismatch"), codes.join(", "));
      assert.ok(codes.includes("extract-folio-consensus-unavailable"), codes.join(", "));
    });

    test("no text layer is NOT-MEASURED, and the message has to say so", () => {
      const result = evaluateExtractFolios({
        key: "ap-17-549",
        printedFirst: 549,
        printedLast: 560,
        extractPageCount: 12,
        observations: [],
      });
      assert.deepEqual(codesOf(result), ["extract-folio-consensus-unavailable"]);
      assert.equal(result.observedPrintedRange, null);
      // A caller that reads an empty findings list as a pass would be wrong here, so the
      // text has to refuse that reading in words, not only in a code.
      assert.match(result.findings[0]?.message ?? "", /NOT-MEASURED, not a pass/);
    });

    test("a mangled text layer that cannot outvote its own noise stays unmeasured", () => {
      // Microfilm mangles numerals. Scattered disagreeing reads must not be promoted to a
      // verdict: the consensus rule needs votes AND dominance, and this has neither.
      const noisy = [
        { pageIndex: 1, folio: 549 },
        { pageIndex: 2, folio: 55 },
        { pageIndex: 3, folio: 5 },
        { pageIndex: 4, folio: 902 },
      ];
      const result = evaluateExtractFolios({
        key: "ap-17-549",
        printedFirst: 549,
        printedLast: 560,
        extractPageCount: 12,
        observations: noisy,
      });
      assert.ok(codesOf(result).includes("extract-folio-consensus-unavailable"));
    });

    test("the real ap-18-639 text layer, whose most popular offset is WRONG", () => {
      // NOT a synthetic fixture. These are the numbers pdftotext actually produced for the
      // pinned ap-18-639 extract on 2026-09-21: four folio reads over three pages, the
      // winner offset -1902 on two votes against a runner-up of one, where the true offset
      // is -638. The pin is CORRECT; its text layer is three pages of microfilm and cannot
      // support a verdict.
      //
      // CORRECTED AFTER PLANTING, because my first rationale for this arm was wrong. I
      // wrote that the vote floor is what saves this pin. It is not: the floor and the
      // dominance rule reject it INDEPENDENTLY, and dropping either to its weakest value
      // leaves this arm green. Planting both is how that came out, not reading.
      //
      // The arm is still worth its place - a correct pin must never be accused on a text
      // layer this thin, and this is the only real corpus member where that could happen -
      // but the guard it evidences is the pair, not the floor. The floor's own job is the
      // one-sided case in the arm below, where dominance is blind.
      const real = [
        { pageIndex: 1, folio: 1903 },
        { pageIndex: 2, folio: 1904 },
        { pageIndex: 2, folio: 43 },
        { pageIndex: 3, folio: 27 },
      ];
      const result = evaluateExtractFolios({
        key: "ap-18-639",
        printedFirst: 639,
        printedLast: 641,
        extractPageCount: 3,
        observations: real,
      });
      assert.deepEqual(codesOf(result), ["extract-folio-consensus-unavailable"]);
      assert.ok(
        !codesOf(result).includes("extract-folio-mismatch"),
        "a correct pin must never be accused on a text layer this thin",
      );
    });

    test("one-sided noise, which dominance cannot see and only the floor refuses", () => {
      // The floor's non-redundant job, and the reason it is not deleted as duplicated by
      // dominance. Two reads of one WRONG offset and no competing read at all: runner-up is
      // zero, so `winner < runnerUp * dominance` is `2 < 0` and dominance admits it. A
      // two-page extract is exactly this shape, and ap-34-591 is a two-page extract.
      //
      // Planted to confirm: with extractVoteFloor returning 1, this arm goes RED and the
      // gate reports extract-folio-mismatch against a pin nothing is wrong with.
      const oneSided = [
        { pageIndex: 1, folio: 1903 },
        { pageIndex: 2, folio: 1904 },
      ];
      const result = evaluateExtractFolios({
        key: "ap-18-639",
        printedFirst: 639,
        printedLast: 641,
        extractPageCount: 3,
        observations: oneSided,
      });
      assert.ok(
        codesOf(result).includes("extract-folio-consensus-unavailable"),
        `two unanimous wrong reads must not become a verdict; got ${codesOf(result).join(", ")}`,
      );
      assert.ok(
        !codesOf(result).includes("extract-folio-mismatch"),
        "and they must certainly not become an accusation",
      );
    });

    test("the floor scales with the extract, because the parent's floor is arithmetic here", () => {
      // MIN_CONSENSUS_VOTES = 20 is calibrated for parents of several hundred pages. A
      // twelve-page extract cannot produce twenty folio reads at all, so the parent's floor
      // rejects every extract in this corpus by arithmetic rather than by evidence - all
      // six measured unmeasurable before this existed. The parent's own thresholds are
      // unchanged; this asserts the extract floor stays BELOW what the real extracts
      // supply and ABOVE what the thin ones do.
      assert.equal(extractVoteFloor(12), 3); // ap-17-549 supplied 6
      assert.equal(extractVoteFloor(31), 8); // ap-17-891 supplied 16
      assert.equal(extractVoteFloor(3), 3); // ap-18-639 supplied 2, correctly short
      assert.equal(extractVoteFloor(2), 3); // ap-34-591 supplied 2, correctly short
      // And it never collapses to "any single read wins", which is the failure above.
      assert.ok(extractVoteFloor(1) >= 3);
      assert.ok(extractVoteFloor(400) >= 20, "a large extract is held to at least the parent bar");
    });

    test("this check cannot tell one volume from another, and the code says so", () => {
      // Annalen 17 and 18 both have a page 549. An extract of the WRONG VOLUME'S 549-560
      // passes here, and must, because nothing in the bytes distinguishes them. The claim
      // is asserted rather than left in a comment so that a later author who thinks this
      // check subsumes the parent comparison finds out here.
      const wrongVolume = evaluateExtractFolios({
        key: "ap-18-549-hypothetical",
        printedFirst: 549,
        printedLast: 560,
        extractPageCount: 12,
        observations: honestObservations(549, 12),
      });
      assert.deepEqual(codesOf(wrongVolume), []);
      const source = fs.readFileSync(
        path.join(REPO_ROOT, "scripts", "verify-facsimile-pins.ts"),
        "utf8",
      );
      assert.match(
        source,
        /cannot tell a correct extract of the right pages from the WRONG VOLUME/,
      );
    });
  });

  describe("5d. The measurement layer's own refusals (am-muyh)", () => {
    // Seven refusals that only fire when poppler misbehaves or is handed something that is
    // not a PDF. None had a test, so the gate's entire failure vocabulary for a broken
    // runner was unexercised - which is how am-yf6h shipped a message asserting a cause it
    // had never established. Each is reached here by producing the condition, not by
    // mocking the function that reports it.
    //
    // The two spawn-failure arms manipulate PATH for the duration of one call, because
    // renderPageHash and pdfPageTexts name their tools as bare words and resolve them
    // through PATH. That is the only way to make a present-but-unrunnable tool, and it is
    // the state am-yf6h was actually in.

    const scratch = (name: string): string => {
      const dir = path.join(REPO_ROOT, "artifacts", "test-tmp", "measurement-refusals", name);
      fs.mkdirSync(dir, { recursive: true });
      return dir;
    };

    /** A file that is unmistakably not a PDF, which is what poppler has to refuse. */
    function notAPdf(name: string): string {
      const file = path.join(scratch(name), "not-a-pdf.pdf");
      fs.writeFileSync(file, "This is plain text with a .pdf extension.\n");
      return file;
    }

    /**
     * Runs `body` with PATH set to `dir` ALONE, and restores PATH however it ends.
     *
     * Prefixing is not enough and the first version of these arms did prefix. execvp
     * treats a non-executable match as EACCES and KEEPS SEARCHING the rest of PATH, so
     * the real /opt/homebrew/bin/pdftoppm ran anyway and the arms measured a render
     * failure while claiming to measure a spawn failure. Replacing PATH is what makes the
     * unrunnable file the only candidate.
     */
    function withOnlyPath<T>(dir: string, body: () => T): T {
      const original = process.env.PATH;
      process.env.PATH = dir;
      try {
        return body();
      } finally {
        process.env.PATH = original;
      }
    }

    /** Asserts the call refuses with a typed code, and says what came back if it does not. */
    function refusalFrom(run: () => unknown): PinMeasurementError {
      try {
        run();
      } catch (error) {
        assert.ok(
          error instanceof PinMeasurementError,
          `expected a typed PinMeasurementError, got ${String(error)}`,
        );
        return error;
      }
      throw new Error("the measurement succeeded where it was required to refuse");
    }

    test("pdfinfo refusing a file that is not a PDF (verify-facsimile-pins.ts:654)", () => {
      const refusal = refusalFrom(() => pdfPageCount(notAPdf("pdfinfo-nonpdf")));
      assert.equal(refusal.code, "page-render-failed");
      assert.match(refusal.message, /pdfinfo failed/);
    });

    test("pdfinfo succeeding without reporting a page count (verify-facsimile-pins.ts:661)", () => {
      // A separate arm from the one above and unreachable through a real pdfinfo, which
      // always prints Pages: on success. A stub that exits 0 silently is the only way to
      // produce it, and the arm exists because "exit 0" is not the same as "answered".
      const dir = scratch("pdfinfo-silent");
      const stub = path.join(dir, "pdfinfo");
      fs.writeFileSync(stub, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
      const refusal = withOnlyPath(dir, () =>
        refusalFrom(() => pdfPageCount(path.join(dir, "anything.pdf"))),
      );
      assert.equal(refusal.code, "page-render-failed");
      assert.match(refusal.message, /did not report a page count/);
    });

    test("pdftoppm present but not runnable (verify-facsimile-pins.ts:693)", () => {
      // Present and not executable: a spawn error that is NOT ENOENT. This is the state
      // am-yf6h was in, and the refusal must not claim the tool is missing.
      const dir = scratch("pdftoppm-unrunnable");
      fs.writeFileSync(path.join(dir, "pdftoppm"), "#!/bin/sh\nexit 0\n", { mode: 0o644 });
      const refusal = withOnlyPath(dir, () =>
        refusalFrom(() => renderPageHash(path.join(dir, "anything.pdf"), 1)),
      );
      assert.equal(refusal.code, "render-tool-spawn-failed");
      assert.ok(
        !refusal.message.includes("not available on PATH"),
        `an unrunnable tool is not a missing tool: ${refusal.message}`,
      );
    });

    test("pdftoppm running and producing no page (verify-facsimile-pins.ts:699)", () => {
      const refusal = refusalFrom(() => renderPageHash(notAPdf("pdftoppm-nonpdf"), 1));
      assert.equal(refusal.code, "page-render-failed");
      assert.match(refusal.message, /could not render page 1/);
    });

    test("pdftotext present but not runnable (verify-facsimile-pins.ts:722)", () => {
      const dir = scratch("pdftotext-unrunnable");
      fs.writeFileSync(path.join(dir, "pdftotext"), "#!/bin/sh\nexit 0\n", { mode: 0o644 });
      const refusal = withOnlyPath(dir, () =>
        refusalFrom(() => pdfPageTexts(path.join(dir, "anything.pdf"))),
      );
      assert.equal(refusal.code, "render-tool-spawn-failed");
      assert.ok(!refusal.message.includes("not available on PATH"), refusal.message);
    });

    test("pdftotext refusing a file that is not a PDF (verify-facsimile-pins.ts:728)", () => {
      const refusal = refusalFrom(() => pdfPageTexts(notAPdf("pdftotext-nonpdf")));
      assert.equal(refusal.code, "page-render-failed");
      assert.match(refusal.message, /pdftotext failed/);
    });

    test("a pinned PDF holding a different number of pages than the record says (verify-facsimile-pins.ts:939)", () => {
      // A real PDF with correct digests and a wrong page count: the one artifact check
      // that needs the tools AND a genuine file, so it could not be reached from the
      // synthetic configs in 5b. ap-34-591 is used because it is the smallest pin.
      const root = scratch("page-count");
      const source = path.join(REPO_ROOT, "public", "papers", "pdfs", "ap-34-591.pdf");
      const extract = path.join(root, "public", "papers", "pdfs", "ap-99-943.pdf");
      const parent = path.join(root, "sources", "parents", "ap-99-943-parent.pdf");
      fs.mkdirSync(path.dirname(extract), { recursive: true });
      fs.mkdirSync(path.dirname(parent), { recursive: true });
      fs.copyFileSync(source, extract);
      fs.copyFileSync(source, parent);
      const digest = createHash("sha256").update(fs.readFileSync(source)).digest("hex");
      const truePages = pdfPageCount(extract);

      const codes = verifyPin(
        {
          key: "ap-99-943",
          articlePages: {
            printedFirst: 1,
            printedLast: truePages,
            parentPageIndices: [1, truePages],
          },
          verifiedAnchor: { parentPageIndex: 1, printedPage: 1, verifiedBy: "test-fixture" },
          pinned: {
            path: "public/papers/pdfs/ap-99-943.pdf",
            sha256: digest,
            // The defect: the record claims more pages than the bytes hold.
            pageCount: truePages + 5,
            parent: { path: "sources/parents/ap-99-943-parent.pdf", sha256: digest },
          },
        },
        root,
      ).findings.map((finding) => finding.code);

      assert.ok(codes.includes("pinned-page-count-mismatch"), codes.join(", "));
      // Reachability, asserted: the digests must have PASSED, or this arm would be
      // measuring a digest conflict and never reach the page-count check at all.
      assert.ok(!codes.includes("pinned-digest-conflict"), codes.join(", "));
      assert.ok(!codes.includes("parent-digest-conflict"), codes.join(", "));
    });

    test("a measurement that fails for a reason the gate has no code for (verify-facsimile-pins.ts:954)", () => {
      // The catch-all. Everything above produces a typed PinMeasurementError; this arm is
      // what happens when something else throws inside the measurement block, and without
      // it an unreadable file would surface as an untyped crash rather than a finding.
      // An unreadable extract does it: the file exists, so the availability check passes,
      // and reading it for a digest raises EACCES, which is a plain Error.
      const root = scratch("unreadable");
      const extract = path.join(root, "public", "papers", "pdfs", "ap-99-1009.pdf");
      const parent = path.join(root, "sources", "parents", "ap-99-1009-parent.pdf");
      fs.mkdirSync(path.dirname(extract), { recursive: true });
      fs.mkdirSync(path.dirname(parent), { recursive: true });
      // Restore before writing, not only after. The first version restored the mode on
      // the last line, so any run that failed earlier - a plant, a timeout - left an
      // unwritable file behind and every later run died in setup with EACCES from
      // writeFileSync instead of measuring anything. A fixture that can block its own
      // next run is a fixture that reports a false red. This one heals itself.
      if (fs.existsSync(extract)) fs.chmodSync(extract, 0o644);
      fs.writeFileSync(extract, "%PDF-1.4\n");
      fs.writeFileSync(parent, "%PDF-1.4\n");
      fs.chmodSync(extract, 0o000);

      const findings = verifyPin(
        {
          key: "ap-99-1009",
          articlePages: { printedFirst: 1, printedLast: 2, parentPageIndices: [1, 2] },
          verifiedAnchor: { parentPageIndex: 1, printedPage: 1, verifiedBy: "test-fixture" },
          pinned: {
            path: "public/papers/pdfs/ap-99-1009.pdf",
            sha256: "d".repeat(64),
            pageCount: 2,
            parent: { path: "sources/parents/ap-99-1009-parent.pdf", sha256: "e".repeat(64) },
          },
        },
        root,
      ).findings;

      try {
        const caught = findings.find((finding) => finding.code === "page-render-failed");
        assert.ok(caught, findings.map((f) => f.code).join(", "));
        assert.match(caught.message, /measurement failed/);
        assert.match(caught.message, /EACCES|permission denied/i);
      } finally {
        fs.chmodSync(extract, 0o644);
      }
    });

    test("the PARENT measurement failing for a reason the gate has no code for (verify-facsimile-pins.ts:1049)", () => {
      // The OTHER catch-all, and the one site in this file that no test drove. 954 and 1049 are
      // structurally identical blocks emitting the same code AND the same message shape, so a
      // citation alone cannot tell them apart and a single arm pointed at either would read as
      // covering the pair while leaving one undriven. They differ in what they wrap: 954 closes
      // the block measuring the pinned extract, 1049 closes the block measuring the PARENT and
      // the folio coverage built from it, which opens by digesting the parent at :973.
      //
      // THE EXTRACT HAS TO BE A REAL PDF. The first version of this arm wrote the same
      // "%PDF-1.4\n" stub both siblings use, and never reached 1049 at all: pdfinfo refused the
      // stub and site 654 pushed its own page-render-failed, which
      // `findings.find(code === "page-render-failed")` then matched. The arm was asserting a
      // finding from a different site under this site's name - the exact wrong-pointer failure
      // this whole repair is about - and it only surfaced because the message read "pdfinfo
      // failed" instead of "measurement failed".
      //
      // So the extract is a pinned facsimile that genuinely measures, the parent is the
      // unreadable one, and the assertion below is keyed on the PARENT path rather than on the
      // code, because the code cannot distinguish 1049 from 954 and the message can.
      const root = scratch("unreadable-parent");
      const extract = path.join(root, "public", "papers", "pdfs", "ap-99-1049.pdf");
      const parent = path.join(root, "sources", "parents", "ap-99-1049-parent.pdf");
      fs.mkdirSync(path.dirname(extract), { recursive: true });
      fs.mkdirSync(path.dirname(parent), { recursive: true });
      // Restore before writing, for the reason the arm above records: a fixture that leaves an
      // unwritable file behind blocks its own next run and reports a false red.
      if (fs.existsSync(parent)) fs.chmodSync(parent, 0o644);
      fs.copyFileSync(path.join(REPO_ROOT, "public", "papers", "pdfs", "ap-17-549.pdf"), extract);
      fs.writeFileSync(parent, "%PDF-1.4\n");
      fs.chmodSync(parent, 0o000);

      const findings = verifyPin(
        {
          key: "ap-99-1049",
          articlePages: { printedFirst: 1, printedLast: 2, parentPageIndices: [1, 2] },
          verifiedAnchor: { parentPageIndex: 1, printedPage: 1, verifiedBy: "test-fixture" },
          pinned: {
            path: "public/papers/pdfs/ap-99-1049.pdf",
            sha256: "d".repeat(64),
            pageCount: 12,
            parent: { path: "sources/parents/ap-99-1049-parent.pdf", sha256: "e".repeat(64) },
          },
        },
        root,
      ).findings;

      try {
        const caught = findings.find(
          (finding) =>
            finding.code === "page-render-failed" && /measurement failed/.test(finding.message),
        );
        assert.ok(
          caught,
          `no catch-all finding; got: ${findings.map((f) => `${f.code}:${f.message.slice(0, 60)}`).join(" | ")}`,
        );
        assert.match(caught.message, /EACCES|permission denied/i);
        // The discriminator. 954 would name the extract here; only 1049 names the parent.
        assert.match(caught.message, /ap-99-1049-parent\.pdf/);
      } finally {
        fs.chmodSync(parent, 0o644);
      }
    });

    test("the two arms are told apart, not merged into one message", () => {
      // Reachability for the pair above: if a later edit collapsed spawn failure and
      // render failure into one code, every arm above would still pass on the survivor.
      // This asserts the two conditions really do produce different codes.
      const dir = scratch("arms-differ");
      fs.writeFileSync(path.join(dir, "pdftotext"), "#!/bin/sh\nexit 0\n", { mode: 0o644 });
      const spawnFailure = withOnlyPath(dir, () =>
        refusalFrom(() => pdfPageTexts(path.join(dir, "anything.pdf"))),
      );
      const renderFailure = refusalFrom(() => pdfPageTexts(notAPdf("arms-differ-nonpdf")));
      assert.notEqual(spawnFailure.code, renderFailure.code);
    });
  });

  describe("6. The pins on disk", () => {
    test("every pinned facsimile verifies against its parent", { timeout: 180_000 }, () => {
      const report = verifyFacsimilePins();

      // A finding that required a measurement is evidence about a pin. A missing
      // parent scan is not (am-yf6h). /sources is git-ignored, so in CI every pin
      // refuses for the second reason and the summary reads "0 verified, 6 refused"
      // - which is exactly the sentence this file's own bead was filed about, and
      // CI now runs this test. Asserting on the measured findings keeps the real
      // red red in both places and stops the environment being reported as a
      // verdict. It hides nothing: an unmeasurable pin is still listed below.
      const measured = report.results.flatMap((r) =>
        r.findings.filter((f) => !UNMEASURABLE_CODES.has(f.code)),
      );
      const unmeasurable = report.results.filter((r) => isUnmeasurable(r.findings));

      if (measured.length > 0) {
        // This is the deliverable red. Three pins carry wrong page windows (ap-17-549's
        // config, ap-19-289's and ap-34-591's stale extracts) and re-pinning is owner-
        // authorized work. This gate stays red until the owner authorizes the repair; do
        // not silence it by editing configs, adding anchors, or exempting a key. If the
        // report below says a parent scan is not on disk, the pins were not verified here
        // either: /sources is git-ignored, so run this where the parents were downloaded.
        throw new Error(
          `\n${formatPinReport(report)}\n` +
            `${measured.length} finding(s) came from an actual measurement or from config ` +
            `arithmetic, and those are the deliverable red. ` +
            `${unmeasurable.length} pin(s) could not be measured here at all.`,
        );
      }

      if (unmeasurable.length > 0) {
        // Nothing was refused on evidence and nothing could be checked either.
        // Reporting that as a pass would be the same lie in the other direction,
        // so it is stated and the registry keeps this step requiredInCi false.
        throw new Error(
          `\n${formatPinReport(report)}\n` +
            `No pin was refused on evidence, but ${unmeasurable.length} could not be measured ` +
            `here, so this run verified nothing. Run it where the parent scans live.`,
        );
      }

      assert.equal(report.valid, true);
      assert.equal(report.refusedCount, 0);
    });
  });
});

/**
 * The six sites in this file that survived deletion (am-r3qt / the owed queue).
 *
 * Four of them were already DRIVEN and simply not distinguishable. evaluateContentIdentity emits
 * stale-pinned-extract from two sites and the existing fixtures trip both at once, asserting
 * `findings.length === 2`; verifyPin emits pinned-pdf-unavailable from two sites. Under am-ksl3 an
 * uncited site sharing a code with another is never credited, and rightly: a test that fires both
 * cannot tell you which one it proves. Each arm below isolates ONE site by making the other
 * condition hold.
 */
describe("the six undriven refusal sites", () => {
  const hashes = {
    a: "a".repeat(64),
    b: "b".repeat(64),
    c: "c".repeat(64),
  };

  test("(verify-facsimile-pins.ts:277) only the FIRST page differs, so only the first site speaks", () => {
    const findings = evaluateContentIdentity({
      key: "ap-99-001",
      declaredFirstIndex: 83,
      declaredLastIndex: 99,
      extractFirstHash: hashes.a,
      parentFirstHash: hashes.b, // differs -> site 277
      extractLastHash: hashes.c,
      parentLastHash: hashes.c, // identical -> site 289 stays silent
      extractImpliedFirstIndex: null,
    });

    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.code, "stale-pinned-extract");
    assert.match(String(findings[0]?.message), /first page does not render identically/);
    assert.match(String(findings[0]?.message), /parent page 83/);
  });

  test("(verify-facsimile-pins.ts:289) only the LAST page differs, so only the second site speaks", () => {
    const findings = evaluateContentIdentity({
      key: "ap-99-001",
      declaredFirstIndex: 83,
      declaredLastIndex: 99,
      extractFirstHash: hashes.a,
      parentFirstHash: hashes.a, // identical -> site 277 stays silent
      extractLastHash: hashes.b,
      parentLastHash: hashes.c, // differs -> site 289
      extractImpliedFirstIndex: null,
    });

    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.code, "stale-pinned-extract");
    assert.match(String(findings[0]?.message), /last page does not render identically/);
    assert.match(String(findings[0]?.message), /parent page 99/);

    // And both identical is silent, so the pair above is about the hashes and not the shape.
    assert.equal(
      evaluateContentIdentity({
        key: "ap-99-001",
        declaredFirstIndex: 83,
        declaredLastIndex: 99,
        extractFirstHash: hashes.a,
        parentFirstHash: hashes.a,
        extractLastHash: hashes.c,
        parentLastHash: hashes.c,
        extractImpliedFirstIndex: null,
      }).length,
      0,
    );
  });

  test("(verify-facsimile-pins.ts:387) the parent's own text layer contradicts the declared first index", () => {
    // 200 folio observations at a uniform offset of 9 put printed page 1 at parent page 10. The
    // config declares 11, so the parent's own text layer and the config disagree about where the
    // same printed page is. The vote count has to clear extractVoteFloor or the consensus is
    // unavailable and this site never runs - which is what my first version of this test hit.
    const result = evaluateFolioCoverage({
      key: "ap-99-001",
      printedFirst: 1,
      printedLast: 4,
      declaredFirstIndex: 11,
      // The LAST index is deliberately correct (printed 4 at offset 9 is parent 13). There is a
      // sibling site for the last index sharing this code; leaving it wrong fires both and the
      // pair proves neither.
      declaredLastIndex: 13,
      parentPageCount: 400,
      observations: parentVoting(9, 1, 200),
    });

    assert.equal(result.consensus?.offset, 9);
    assert.equal(result.folioImpliedFirstIndex, 10);
    const mine = result.findings.filter((f) => f.code === "parent-folio-offset-mismatch");
    assert.equal(mine.length, 1, `got ${result.findings.map((f) => f.code).join(", ")}`);
    assert.match(String(mine[0]?.message), /declared first parent index 11/);
    assert.match(String(mine[0]?.message), /parent page 10/);

    // Declaring the index the folios imply is silent, so this site compares the two rather than
    // objecting to the presence of observations at all.
    const agreeing = evaluateFolioCoverage({
      key: "ap-99-001",
      printedFirst: 1,
      printedLast: 4,
      declaredFirstIndex: 10,
      declaredLastIndex: 13,
      parentPageCount: 400,
      observations: parentVoting(9, 1, 200),
    });
    assert.equal(
      agreeing.findings.some((f) => f.code === "parent-folio-offset-mismatch"),
      false,
    );
  });

  test("(verify-facsimile-pins.ts:637) a tool that exists but cannot be started is NOT reported as missing", () => {
    // A real EACCES, not a mock: a file that exists and is not executable. The distinction this
    // site exists for is that "the tool is absent" and "this process could not launch it" are
    // different facts, and only the first is evidence about the host's toolchain.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "am-r3qt-notexec-"));
    const tool = path.join(dir, "pretend-pdftoppm");
    fs.writeFileSync(tool, "#!/bin/sh\necho hi\n", { mode: 0o644 });
    // Narrowed rather than cast: spawnSync types error as Error, and the errno code is what the
    // site under test branches on, so the test has to establish it is really there.
    const probeError = spawnSync(tool, ["-v"], { encoding: "utf8" }).error as
      | NodeJS.ErrnoException
      | undefined;
    assert.equal(probeError?.code, "EACCES");

    assert.throws(
      () => requireTool(tool),
      (err: unknown) =>
        err instanceof PinMeasurementError &&
        err.code === "render-tool-spawn-failed" &&
        /could not be started/.test(err.message) &&
        /NOT evidence that the tool is missing/.test(err.message),
    );

    // The sibling site: a path that does not exist at all IS the missing-tool refusal.
    assert.throws(
      () => requireTool(path.join(dir, "no-such-tool-at-all")),
      (err: unknown) =>
        err instanceof PinMeasurementError && err.code === "render-tool-unavailable",
    );
  });

  test("(verify-facsimile-pins.ts:859) a config with no pinned record has nothing to verify", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "am-r3qt-nopin-"));
    const result = verifyPin(
      {
        key: "ap-99-001",
        articlePages: { printedFirst: 1, printedLast: 2, parentPageIndices: [10, 11] },
      },
      root,
    );
    const mine = result.findings.filter((f) => f.code === "pinned-pdf-unavailable");
    assert.equal(mine.length, 1, `got ${result.findings.map((f) => f.code).join(", ")}`);
    assert.match(String(mine[0]?.message), /records no pinned artifact/);
  });

  test("(verify-facsimile-pins.ts:896) a pinned record whose PDF is not on disk names the path", () => {
    // Distinguished from :859 by the message, because the two sites share a code: this one has a
    // pinned record and the file is missing, that one has no record at all.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "am-r3qt-nofile-"));
    const result = verifyPin(
      {
        key: "ap-99-001",
        articlePages: { printedFirst: 1, printedLast: 2, parentPageIndices: [10, 11] },
        verifiedAnchor: { parentPageIndex: 10, printedPage: 1, verifiedBy: "test-fixture" },
        pinned: {
          path: "public/papers/pdfs/ap-99-001.pdf",
          sha256: "a".repeat(64),
          pageCount: 2,
          parent: { path: "sources/parents/ap-99-001-parent.pdf", sha256: "b".repeat(64) },
        },
      },
      root,
    );
    const mine = result.findings.filter((f) => f.code === "pinned-pdf-unavailable");
    assert.equal(mine.length, 1, `got ${result.findings.map((f) => f.code).join(", ")}`);
    assert.match(String(mine[0]?.message), /is not on disk/);
    assert.match(String(mine[0]?.message), /ap-99-001\.pdf/);
    assert.equal(
      /records no pinned artifact/.test(String(mine[0]?.message)),
      false,
      "this is the on-disk site, not the no-record one",
    );
  });
});
