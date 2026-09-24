import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { checkEvidenceLinksFile } from "../../scripts/check-evidence-links.ts";
import { newRunIdentity, TestLogger } from "./log/logger.ts";

const SUITE = "dod-brownian";
const suiteLogger = new TestLogger(SUITE, newRunIdentity());

test("Brownian DoD Item 1: complete paper text inventory", async () => {
  const startTime = Date.now();
  const paperJsonPath = path.join(process.cwd(), "content/papers/brownian-motion.json");

  assert.equal(fs.existsSync(paperJsonPath), true, "Paper JSON manifest must exist");
  const paper = JSON.parse(fs.readFileSync(paperJsonPath, "utf8"));

  assert.equal(paper.id, "brownian-motion");
  assert.equal(paper.status, "explanation-preview");
  assert.equal(paper.sourceStatus, "in-preparation");

  const sectionIds = (paper.sections || []).map((s: { id: string }) => s.id);
  assert.deepEqual(sectionIds, ["s0", "s1", "s2", "s4", "s5"]);

  suiteLogger.log({
    testId: "dod-item-1-complete-paper-text",
    beadId: "am-dod-brownian-2k4y",
    paper: "brownian-motion",
    outcome: "passed",
    durationMs: Date.now() - startTime,
    message:
      "Verified Item 1: the introduction, §§1-2, §4 and §5 authored; §3 is explained from §5, and the closing has no passage of its own.",
    extra: {
      item: "1. Complete paper text",
      check: "sections-inventory",
      sectionsPresent: sectionIds,
      status: paper.status,
      sourceStatus: paper.sourceStatus,
    },
  });
  await suiteLogger.flush();
});

test("Brownian DoD Item 2: bilingual edition, facsimile, and gloss status", async () => {
  const startTime = Date.now();

  const facsimileExists = fs.existsSync(path.join(process.cwd(), "public/ap-17-549.pdf"));
  assert.equal(
    facsimileExists,
    false,
    "Facsimile scan ap-17-549.pdf must be absent at this milestone",
  );

  const ownersPath = path.join(process.cwd(), "docs/OWNERS.md");
  assert.equal(fs.existsSync(ownersPath), true, "docs/OWNERS.md must exist");
  const ownersContent = fs.readFileSync(ownersPath, "utf8");

  assert.match(ownersContent, /open-german-source-brownian-motion.*open: recruiting/);
  assert.match(ownersContent, /open-glossator-brownian.*open: recruiting/);

  suiteLogger.log({
    testId: "dod-item-2-bilingual-and-gloss",
    beadId: "am-dod-brownian-2k4y",
    paper: "brownian-motion",
    outcome: "passed",
    durationMs: Date.now() - startTime,
    message: "Verified Item 2: facsimile absent, German reviews recruiting.",
    extra: {
      item: "2. Bilingual edition and gloss",
      check: "provenance-and-reviews",
      facsimilePresent: facsimileExists,
      germanReviewStatus: "open: recruiting",
    },
  });
  await suiteLogger.flush();
});

test("Brownian DoD Item 3: explanations and foundations inventory", async () => {
  const startTime = Date.now();

  const argsDir = path.join(process.cwd(), "content/arguments/brownian-motion");
  assert.equal(fs.existsSync(argsDir), true, "Brownian arguments dir must exist");
  const argFiles = fs.readdirSync(argsDir).filter((f) => f.endsWith(".json"));
  const coreArgs = argFiles.filter((f) => f.startsWith("arg-bm-"));
  assert.deepEqual(coreArgs.sort(), [
    "arg-bm-diffusion-equation.json",
    "arg-bm-diffusivity.json",
    "arg-bm-gaussian.json",
    "arg-bm-independent-steps.json",
    "arg-bm-inference.json",
    "arg-bm-introduction.json",
    "arg-bm-kinetic-justification.json",
    "arg-bm-observable.json",
    "arg-bm-osmotic-suspended.json",
  ]);
  assert.equal(
    argFiles.includes("entrance-brownian-motion.json"),
    true,
    "Expected entrance-brownian-motion.json",
  );

  const foundDir = path.join(process.cwd(), "content/foundations");
  const foundFiles = fs.readdirSync(foundDir).filter((f) => f.endsWith(".json"));
  assert.equal(foundFiles.length >= 18, true, "Expected at least 18 foundation concept files");

  suiteLogger.log({
    testId: "dod-item-3-explanations-foundations",
    beadId: "am-dod-brownian-2k4y",
    paper: "brownian-motion",
    outcome: "passed",
    durationMs: Date.now() - startTime,
    message:
      "Verified Item 3: 9 arguments for the introduction, §§1-2 and §§4-5, and >=18 foundation records present.",
    extra: {
      item: "3. Explanations",
      check: "arguments-and-foundations-count",
      argumentCount: argFiles.length,
      foundationCount: foundFiles.length,
    },
  });
  await suiteLogger.flush();
});

test("Brownian DoD Item 4: results and misconceptions status", async () => {
  const startTime = Date.now();

  const misconceptionsDir = path.join(process.cwd(), "content/misconceptions/brownian-motion");
  const resultsCardsDir = path.join(process.cwd(), "content/results/brownian-motion");

  const misconceptionsExist = fs.existsSync(misconceptionsDir);
  const resultsCardsExist = fs.existsSync(resultsCardsDir);

  assert.equal(misconceptionsExist, false, "Misconceptions ledger unauthored");
  assert.equal(resultsCardsExist, false, "Results face cards unauthored");

  suiteLogger.log({
    testId: "dod-item-4-results-and-misconceptions",
    beadId: "am-dod-brownian-2k4y",
    paper: "brownian-motion",
    outcome: "passed",
    durationMs: Date.now() - startTime,
    message: "Verified Item 4: results cards and misconception ledger unauthored (open beads).",
    extra: {
      item: "4. Results and misconceptions",
      check: "content-records",
      misconceptionsPresent: misconceptionsExist,
      resultsCardsPresent: resultsCardsExist,
    },
  });
  await suiteLogger.flush();
});

test("Brownian DoD Item 5: instruments BM-01 through BM-08 status", async () => {
  const startTime = Date.now();

  const builtInstruments = ["bm01", "bm02", "bm03", "bm04", "bm05", "bm06", "bm07", "bm08"];
  const unbuiltInstruments: string[] = [];

  for (const id of builtInstruments) {
    const expDir = path.join(process.cwd(), "src/experiments", id);
    assert.equal(fs.existsSync(expDir), true, `Expected ${id} experiment dir to exist`);
  }

  for (const id of unbuiltInstruments) {
    const expDir = path.join(process.cwd(), "src/experiments", id);
    assert.equal(fs.existsSync(expDir), false, `Expected ${id} to be unbuilt`);
  }

  const kitchenPage = path.join(process.cwd(), "src/app/kitchen/page.tsx");
  assert.equal(fs.existsSync(kitchenPage), true, "Kitchen page built");

  suiteLogger.log({
    testId: "dod-item-5-instruments",
    beadId: "am-dod-brownian-2k4y",
    paper: "brownian-motion",
    outcome: "passed",
    durationMs: Date.now() - startTime,
    message: "Verified Item 5: all 8 instruments built (BM-01 through BM-08); kitchen built.",
    extra: {
      item: "5. Instruments",
      check: "instruments-directory-audit",
      builtInstruments,
      unbuiltInstruments,
      kitchenBuilt: true,
    },
  });
  await suiteLogger.flush();
});

test("Brownian DoD Item 6: Journey II status", async () => {
  const startTime = Date.now();

  const discoverRoute = path.join(process.cwd(), "src/app/discover/brownian-motion/page.tsx");
  assert.equal(fs.existsSync(discoverRoute), true, "Discover prototype route must exist");

  const shelfCardsDir = path.join(process.cwd(), "content/shelf/brownian-motion");
  assert.equal(fs.existsSync(shelfCardsDir), false, "Shelf cards unauthored");

  suiteLogger.log({
    testId: "dod-item-6-journey-ii",
    beadId: "am-dod-brownian-2k4y",
    paper: "brownian-motion",
    outcome: "passed",
    durationMs: Date.now() - startTime,
    message: "Verified Item 6: /discover/brownian-motion prototype exists; shelf cards unauthored.",
    extra: {
      item: "6. Journey II",
      check: "discovery-chain",
      discoverRouteExists: true,
      shelfCardsExist: false,
    },
  });
  await suiteLogger.flush();
});

test("Brownian DoD Item 7: Historian's margin status", async () => {
  const startTime = Date.now();

  const marginDir = path.join(process.cwd(), "content/margin/brownian-motion");
  assert.equal(fs.existsSync(marginDir), false, "Margin entries unauthored");

  suiteLogger.log({
    testId: "dod-item-7-historians-margin",
    beadId: "am-dod-brownian-2k4y",
    paper: "brownian-motion",
    outcome: "passed",
    durationMs: Date.now() - startTime,
    message: "Verified Item 7: margin records unauthored (open bead am-bm-margin-entries-7fa4).",
    extra: {
      item: "7. Margin",
      check: "margin-records",
      marginDirExists: false,
    },
  });
  await suiteLogger.flush();
});

test("Brownian DoD Item 8: tour and scenario human review status", async () => {
  const startTime = Date.now();

  const ownersPath = path.join(process.cwd(), "docs/OWNERS.md");
  const ownersContent = fs.readFileSync(ownersPath, "utf8");

  assert.match(ownersContent, /open-r2-readability-brownian-motion.*open: recruiting/);
  assert.match(ownersContent, /open-tour-tester-brownian-motion.*open: recruiting/);

  suiteLogger.log({
    testId: "dod-item-8-tour-and-scenarios",
    beadId: "am-dod-brownian-2k4y",
    paper: "brownian-motion",
    outcome: "passed",
    durationMs: Date.now() - startTime,
    message: "Verified Item 8: R2 readability and tour human reviews recruiting (NOT PERFORMED).",
    extra: {
      item: "8. Tour and scenario",
      check: "human-reviews",
      r2ReviewStatus: "open: recruiting",
      tourReviewStatus: "open: recruiting",
    },
  });
  await suiteLogger.flush();
});

test("Brownian DoD Item 9 & Evidence Record: docs/evidence/dod-brownian.md link validity", async () => {
  const startTime = Date.now();

  const evidenceDoc = path.join(process.cwd(), "docs/evidence/dod-brownian.md");
  assert.equal(fs.existsSync(evidenceDoc), true, "docs/evidence/dod-brownian.md must exist");

  const checkResult = checkEvidenceLinksFile(evidenceDoc);
  assert.equal(checkResult.totalLinks > 0, true, "Expected links in DoD evidence document");
  assert.equal(
    checkResult.unresolvedLinks,
    0,
    `Unresolved links found in dod-brownian.md: ${JSON.stringify(checkResult.links.filter((l) => !l.resolved))}`,
  );

  suiteLogger.log({
    testId: "dod-item-9-evidence-record",
    beadId: "am-dod-brownian-2k4y",
    paper: "brownian-motion",
    outcome: "passed",
    durationMs: Date.now() - startTime,
    message: `Verified Item 9: docs/evidence/dod-brownian.md exists with ${checkResult.totalLinks} valid resolved evidence links.`,
    extra: {
      item: "9. Gates and acceptance",
      check: "evidence-record-links",
      totalLinks: checkResult.totalLinks,
      resolvedLinks: checkResult.resolvedLinks,
      unresolvedLinks: checkResult.unresolvedLinks,
    },
  });
  await suiteLogger.flush();
});
