import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";
import { ComprehensionLogger } from "../../comprehension/logger.ts";
import {
  ACCOMPLISHMENTS,
  RUBRIC_DIMENSIONS,
  STUMBLING_POINT_CODES,
} from "../../comprehension/types.ts";
import { VALID_ROUTES } from "./participantCodes.ts";

const rootDir = process.cwd();
const logger = new ComprehensionLogger(undefined, rootDir);

function logCheck(
  testId: string,
  file: string,
  check: string,
  pass: boolean,
  message: string,
): void {
  logger.logStructural({
    suite: "comprehension-protocol",
    testId,
    file,
    check,
    outcome: pass ? "pass" : "fail",
    message,
  });
  assert.equal(pass, true, message);
}

describe("comprehensionProtocol structural validation", () => {
  const protocolPath = "docs/comprehension/PROTOCOL.md";
  const protocolText = readFileSync(join(rootDir, protocolPath), "utf8");

  it("protocol contains all required section headings", () => {
    const requiredSections = [
      "participants",
      "routes",
      "consent",
      "participant codes and reuse",
      "procedure",
      "rubric",
      "accomplishments and reach-sets",
      "stumbling-point codes",
      "stop-rule observations",
      "question banks",
      "comparative experiments",
      "support-ladder evidence",
      "templates",
    ];

    const lower = protocolText.toLowerCase();
    for (const section of requiredSections) {
      const found = lower.includes(section);
      logCheck(
        `protocol-heading-${section.replace(/\s+/g, "-")}`,
        protocolPath,
        `heading "${section}" exists`,
        found,
        `PROTOCOL.md must contain section heading for "${section}"`,
      );
    }
  });

  it("observation sheet lists all 6 rubric dimensions and 5 stumbling codes verbatim, and the 5 accomplishment rows with both columns", () => {
    const sheetPath = "docs/comprehension/materials/observation-sheet.md";
    const sheetText = readFileSync(join(rootDir, sheetPath), "utf8");

    for (const dim of RUBRIC_DIMENSIONS) {
      const found = sheetText.includes(dim);
      logCheck(
        `obs-sheet-rubric-${dim}`,
        sheetPath,
        `rubric dimension "${dim}" listed verbatim`,
        found,
        `observation-sheet.md must list rubric dimension "${dim}" verbatim`,
      );
    }

    for (const code of STUMBLING_POINT_CODES) {
      const found = sheetText.includes(code);
      logCheck(
        `obs-sheet-code-${code}`,
        sheetPath,
        `stumbling-point code "${code}" listed verbatim`,
        found,
        `observation-sheet.md must list stumbling-point code "${code}" verbatim`,
      );
    }

    // Check accomplishment table rows and columns
    for (const acc of ACCOMPLISHMENTS) {
      const found = sheetText.toLowerCase().includes(acc);
      logCheck(
        `obs-sheet-accomplishment-${acc}`,
        sheetPath,
        `accomplishment row "${acc}" exists`,
        found,
        `observation-sheet.md must contain accomplishment row for "${acc}"`,
      );
    }
    assert.ok(sheetText.includes("Meaningful outcome in a round"));
    assert.ok(sheetText.includes("What must remain within reach"));
  });

  it("each question bank has at least 4 questions per route with an anchor or action ID", () => {
    const qbDir = "docs/comprehension/materials/question-banks";
    const papers = ["light-quanta", "brownian-motion", "special-relativity", "mass-energy"];

    for (const paper of papers) {
      const qbFile = `${qbDir}/${paper}.md`;
      const qbText = readFileSync(join(rootDir, qbFile), "utf8");

      for (const route of VALID_ROUTES) {
        assert.ok(qbText.includes(route), `Question bank ${qbFile} must include route ${route}`);
      }

      // Count questions with anchor / action placeholders
      const questionLines = qbText.split("\n").filter((l) => /^\d+\.\s+\*\*/.test(l.trim()));

      assert.ok(
        questionLines.length >= 16,
        `Question bank ${qbFile} must have at least 16 questions (got ${questionLines.length})`,
      );

      for (const qLine of questionLines) {
        const hasTarget = /#[a-z0-9-]+|[a-z0-9-]+:[a-z0-9-]+/.test(qLine);
        assert.ok(
          hasTarget,
          `Question line "${qLine}" in ${qbFile} must carry an anchor (#s<n>...) or action ID (<instrument>:<action>)`,
        );
      }
    }
  });

  it("round report template contains all required front matter and body sections", () => {
    const templatePath = "docs/comprehension/materials/round-report-template.md";
    const templateText = readFileSync(join(rootDir, templatePath), "utf8");

    // Front matter check
    assert.match(templateText, /^---\npaper:\s+[a-z-]+/m);
    assert.match(templateText, /^route:\s+[a-z-]+/m);
    assert.match(templateText, /^date:\s+["']?\d{4}-\d{2}-\d{2}["']?/m);
    assert.match(templateText, /^buildCommit:\s+["']?[a-f0-9]+["']?/m);
    assert.match(templateText, /^anchors:/m);
    assert.match(templateText, /^facilitator:\s+[a-z0-9-]+/m);

    // Body sections check
    const requiredSections = [
      "participants",
      "facilitator",
      "date",
      "rubric observations",
      "accomplishment",
      "support",
      "stumbling points",
      "stop-rule observations",
      "findings",
    ];

    const lower = templateText.toLowerCase();
    for (const s of requiredSections) {
      assert.ok(lower.includes(s), `Round report template must contain section for "${s}"`);
    }
  });

  it("privacy scan of docs/comprehension/ finds no email addresses, phone numbers, or unapproved codes", () => {
    const docsDir = join(rootDir, "docs/comprehension");
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
    const phoneRegex = /\b(?:\+?1[-.]?)?\(?[0-9]{3}\)?[-.][0-9]{3}[-.][0-9]{4}\b/;

    function scanDir(dir: string): void {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (/\.(md|html)$/.test(entry.name)) {
          const content = readFileSync(fullPath, "utf8");
          const relPath = relative(rootDir, fullPath);

          assert.equal(
            emailRegex.test(content),
            false,
            `File ${relPath} contains an email address in violation of privacy rules`,
          );
          assert.equal(
            phoneRegex.test(content),
            false,
            `File ${relPath} contains a phone number in violation of privacy rules`,
          );
        }
      }
    }

    scanDir(docsDir);
  });

  it("no document in docs/comprehension/ presents the five accomplishments as ordered levels", () => {
    const docsDir = join(rootDir, "docs/comprehension");
    const ladderPhrases = [
      "level 1",
      "level 2",
      "level 3",
      "level 4",
      "level 5",
      "ladder of accomplishments",
      "hierarchy of accomplishments",
      "beginner to advanced",
      "lowest level",
      "highest level",
    ];

    function scanDir(dir: string): void {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (/\.(md|html)$/.test(entry.name)) {
          const content = readFileSync(fullPath, "utf8").toLowerCase();
          const relPath = relative(rootDir, fullPath);

          for (const phrase of ladderPhrases) {
            assert.equal(
              content.includes(phrase),
              false,
              `File ${relPath} presents accomplishments as an ordered ladder/hierarchy with phrase: "${phrase}"`,
            );
          }
        }
      }
    }

    scanDir(docsDir);
  });
});
