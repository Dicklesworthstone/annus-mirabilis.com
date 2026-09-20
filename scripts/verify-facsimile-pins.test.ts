import assert from "node:assert/strict";
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
  evaluateFolioCoverage,
  folioObservations,
  formatPinReport,
  getDefaultRepoRoot,
  isUnmeasurable,
  locateExtractInParent,
  PinMeasurementError,
  pdfPageTexts,
  renderPageHash,
  requireTool,
  UNMEASURABLE_CODES,
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

      assert.equal(anchorImpliedFirstIndex, 173);
      const offsetFinding = findings.find((f) => f.code === "FACSIMILE_PAGE_OFFSET_MISMATCH");
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
      const finding = result.findings.find((f) => f.code === "PARENT_FOLIO_OFFSET_MISMATCH");
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
        findings.every((f) => f.code === "STALE_PINNED_EXTRACT"),
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
      assert.equal(findings[0]?.code, "STALE_PINNED_EXTRACT");
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

      assert.equal(finding?.code, "MALFORMED_VERIFIED_ANCHOR");
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

      const finding = result.findings.find((f) => f.code === "PRINTED_RANGE_OUTSIDE_PARENT");
      assert.notEqual(finding, undefined);
      assert.ok(finding?.message.includes("591-592"), `must contain ${String("591-592")}`);
      assert.ok(finding?.message.includes("207-445"), `must contain ${String("207-445")}`);
    });

    test("a missing anchor refuses instead of passing quietly", () => {
      const { findings } = evaluateDeclaredAnchor({
        key: "ap-34-591",
        articlePages: { printedFirst: 591, printedLast: 592, parentPageIndices: [219, 220] },
      });
      assert.equal(
        findings.some((f) => f.code === "MISSING_VERIFIED_ANCHOR"),
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
      assert.equal(result.findings[0]?.code, "FOLIO_CONSENSUS_UNAVAILABLE");
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
      assert.equal(refusal.code, "RENDER_TOOL_UNAVAILABLE");
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
        assert.equal(refusal.code, "RENDER_TOOL_SPAWN_FAILED");
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
