/**
 * Notice Layers and Licensing Decision Validation Tests
 *
 * Owning bead: am-gov-decision-license-rights-tps
 * Validates NOTICE.md layer headings, attribution, exclusions, and README parity.
 */

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

export function generateLogRunId(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  const hex = randomBytes(4).toString("hex");
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z-${hex}`;
}

export const CANONICAL_ATTRIBUTION_STRING =
  "Annus Mirabilis (annus-mirabilis.com), critical edition and translation by Jeffrey Emanuel and contributors, based on Albert Einstein (1905).";

export interface RequiredLayer {
  readonly id: string;
  readonly name: string;
  readonly match: (heading: string) => boolean;
}

export const REQUIRED_LAYERS: readonly RequiredLayer[] = [
  {
    id: "historical-german-text",
    name: "historical German text",
    match: (h) => /historical\s+german\s+text/i.test(h),
  },
  {
    id: "facsimile-scans",
    name: "facsimile scans",
    match: (h) => /facsimile\s+scans/i.test(h),
  },
  {
    id: "english-translation",
    name: "English translation",
    match: (h) => /english\s+translation/i.test(h),
  },
  {
    id: "explanatory-prose",
    name: "explanatory prose",
    match: (h) => /explanatory\s+prose/i.test(h),
  },
  {
    id: "code",
    name: "code",
    match: (h) => /^code$/i.test(h.trim()) || /code\b/i.test(h),
  },
  {
    id: "frankensim-artifacts",
    name: "FrankenSim artifacts",
    match: (h) => /frankensim\s+artifacts/i.test(h),
  },
  {
    id: "fonts",
    name: "fonts",
    match: (h) => /fonts/i.test(h),
  },
  {
    id: "third-party-libraries",
    name: "third-party runtime libraries",
    match: (h) => /third-party(\s+runtime)?\s+libraries/i.test(h),
  },
  {
    id: "images-and-figures",
    name: "images and figures",
    match: (h) => /images\s+and\s+(authored\s+)?figures/i.test(h),
  },
  {
    id: "historical-datasets",
    name: "historical datasets",
    match: (h) => /historical\s+datasets/i.test(h),
  },
  {
    id: "attribution",
    name: "Attribution",
    match: (h) => /attribution/i.test(h),
  },
];

export interface NoticeValidationResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly foundHeadings: readonly string[];
  readonly attributionText: string;
}

export function parseNoticeMarkdown(content: string): NoticeValidationResult {
  const errors: string[] = [];
  const lines = content.split("\n");
  const headings: { text: string; lineIndex: number }[] = [];

  // Extract level 2 headings
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? "";
    if (line.startsWith("## ")) {
      headings.push({ text: line.slice(3).trim(), lineIndex: i });
    }
  }

  // Check that all required layers exist in the required order
  let currentLayerIndex = 0;
  for (const layer of REQUIRED_LAYERS) {
    const foundIndex = headings.findIndex(
      (h, idx) => idx >= currentLayerIndex && layer.match(h.text),
    );
    if (foundIndex === -1) {
      errors.push(`Missing required layer heading: '${layer.name}' (id: ${layer.id}).`);
    } else {
      currentLayerIndex = foundIndex + 1;
    }
  }

  // Check section content for prohibited scan claims in code section
  const codeSectionLines: string[] = [];
  let inCodeSection = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? "";
    if (line.startsWith("## ")) {
      const headingText = line.slice(3).trim();
      if (/^code$/i.test(headingText) || /code\b/i.test(headingText)) {
        inCodeSection = true;
        continue;
      } else {
        inCodeSection = false;
      }
    }
    if (inCodeSection) {
      codeSectionLines.push(line);
    }
  }

  const codeSectionText = codeSectionLines.join(" ");
  if (/including\s+scans/i.test(codeSectionText)) {
    errors.push("Code section must not claim to cover scans ('including scans' detected).");
  }
  if (/all\s+content/i.test(codeSectionText)) {
    errors.push("Code section must not claim to cover 'all content'.");
  }

  // Extract attribution section text
  let inAttribution = false;
  const attributionLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) {
      const heading = trimmed.slice(3).trim();
      if (/attribution/i.test(heading)) {
        inAttribution = true;
        continue;
      } else if (inAttribution) {
        break;
      }
    }
    if (inAttribution) {
      attributionLines.push(line);
    }
  }

  const attributionText = attributionLines.join("\n").trim();
  if (attributionText.length === 0) {
    errors.push("Attribution section is missing or empty.");
  }

  return {
    ok: errors.length === 0,
    errors,
    foundHeadings: headings.map((h) => h.text),
    attributionText,
  };
}

describe("NOTICE.md Layers and License Parity Suite", () => {
  const rootDir = process.cwd();
  const noticePath = join(rootDir, "NOTICE.md");
  const readmePath = join(rootDir, "README.md");
  const decisionsPath = join(rootDir, "docs", "DECISIONS.md");

  const logRunId = generateLogRunId();
  const logDir = join(rootDir, "artifacts", "test-logs", "license-notice");
  mkdirSync(logDir, { recursive: true });
  const logPath = join(logDir, `${logRunId}.jsonl`);

  function logCheck(testId: string, layer: string, outcome: "passed" | "failed", message: string) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      suite: "license-notice",
      logRunId,
      testId,
      beadId: "am-gov-decision-license-rights-tps",
      layer,
      outcome,
      message,
    };
    writeFileSync(logPath, JSON.stringify(logEntry) + "\n", { flag: "a", encoding: "utf8" });
  }

  it("verifies real NOTICE.md contains all 11 required layers in order", () => {
    assert.ok(existsSync(noticePath), "NOTICE.md must exist in the repository root");
    const content = readFileSync(noticePath, "utf8");
    const result = parseNoticeMarkdown(content);

    assert.ok(result.ok, `NOTICE.md failed validation:\n${result.errors.join("\n")}`);
    for (const layer of REQUIRED_LAYERS) {
      logCheck(`layer-${layer.id}`, layer.name, "passed", `Layer '${layer.name}' verified`);
    }
  });

  it("verifies NOTICE.md contains the exact canonical attribution string", () => {
    const content = readFileSync(noticePath, "utf8");
    const result = parseNoticeMarkdown(content);

    assert.ok(result.ok);
    assert.ok(
      result.attributionText.includes(CANONICAL_ATTRIBUTION_STRING),
      `Attribution section must include canonical attribution string:\nExpected: ${CANONICAL_ATTRIBUTION_STRING}\nFound: ${result.attributionText}`,
    );
    logCheck(
      "attribution-string",
      "Attribution",
      "passed",
      "Canonical attribution string present verbatim",
    );
  });

  it("planted negative: fixture notice missing facsimile scans layer fails with layer name in error", () => {
    const badNotice = `
# NOTICE
## Historical German text
Public domain.
## English translation
MIT License.
## Explanatory prose
MIT License.
## Code
MIT License.
## FrankenSim artifacts
MIT License.
## Fonts
OFL 1.1.
## Third-party runtime libraries
MIT.
## Images and figures
MIT.
## Historical datasets
Public domain facts.
## Attribution
Annus Mirabilis attribution string.
`;
    const result = parseNoticeMarkdown(badNotice);
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some((e) => e.includes("facsimile scans")),
      `Expected error naming missing 'facsimile scans', got: ${result.errors.join("; ")}`,
    );
    logCheck(
      "planted-missing-scans",
      "facsimile scans",
      "passed",
      "Detected missing facsimile scans layer with explicit error",
    );
  });

  it("planted negative: fixture notice with code claiming scans fails", () => {
    const badNotice = `
# NOTICE
## Historical German text
Public domain.
## Facsimile scans
Library terms.
## English translation
MIT License.
## Explanatory prose
MIT License.
## Code
MIT License covers all software including scans in the repo.
## FrankenSim artifacts
MIT License.
## Fonts
OFL 1.1.
## Third-party runtime libraries
MIT.
## Images and figures
MIT.
## Historical datasets
Public domain.
## Attribution
Annus Mirabilis attribution string.
`;
    const result = parseNoticeMarkdown(badNotice);
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some((e) => e.includes("including scans")),
      `Expected error about code claiming scans, got: ${result.errors.join("; ")}`,
    );
    logCheck(
      "planted-code-claims-scans",
      "code",
      "passed",
      "Detected code section improperly claiming scans",
    );
  });

  it("verifies README.md and NOTICE.md agree on code and prose licensing", () => {
    assert.ok(existsSync(readmePath), "README.md must exist");
    const readmeContent = readFileSync(readmePath, "utf8");
    const noticeContent = readFileSync(noticePath, "utf8");

    // Both must specify MIT and OpenAI/Anthropic Rider
    assert.ok(
      readmeContent.includes("MIT License with the OpenAI/Anthropic Rider") ||
        readmeContent.includes("MIT + OpenAI/Anthropic Rider"),
      "README.md must specify MIT License with OpenAI/Anthropic Rider",
    );
    assert.ok(
      noticeContent.includes("MIT License with OpenAI/Anthropic Rider") ||
        noticeContent.includes("MIT License (with OpenAI/Anthropic Rider)"),
      "NOTICE.md must specify MIT License with OpenAI/Anthropic Rider",
    );

    // README must state that license covers code and new prose and does not cover scans
    assert.ok(
      /covers code and (new )?prose/i.test(readmeContent),
      "README.md must state that license covers code and new prose",
    );
    assert.ok(
      /grants no rights to embedded scans/i.test(readmeContent) ||
        /never covered by the (repository )?code license/i.test(noticeContent),
      "License must explicitly exclude scans",
    );

    logCheck(
      "readme-notice-parity",
      "license-parity",
      "passed",
      "README.md and NOTICE.md agree on MIT + Rider terms",
    );
  });

  it("verifies docs/DECISIONS.md records the license decision with truthful provenance", () => {
    assert.ok(existsSync(decisionsPath), "docs/DECISIONS.md must exist");
    const decisionsContent = readFileSync(decisionsPath, "utf8");

    assert.ok(
      decisionsContent.includes("## D-2026-09-16-license-and-rider"),
      "DECISIONS.md must contain ## D-2026-09-16-license-and-rider",
    );
    assert.ok(
      decisionsContent.includes(CANONICAL_ATTRIBUTION_STRING),
      "Decision entry must include canonical attribution string",
    );

    // The original version of this test asserted the entry was "RATIFIED" by the
    // project owner. It was not: the owner delegated the decision and never chose
    // an option. A test that asserts a fabricated ratification locks the
    // fabrication in as a gate, so it now asserts the opposite: that no agent
    // claims an owner ratification that did not happen.
    assert.ok(
      !/Ratified .* via direct selection/i.test(decisionsContent),
      "No decision may claim a direct owner selection that did not occur",
    );
    assert.ok(
      !/RATIFIED 2026-09-16 by the project owner/.test(decisionsContent),
      "The license decision was delegated, not owner-ratified; it must not claim otherwise",
    );
    assert.ok(
      decisionsContent.includes("DECIDED 2026-09-16 under delegated authority"),
      "The license decision must record that it was decided under delegation",
    );

    logCheck(
      "decisions-provenance-truthful",
      "governance",
      "passed",
      "D-2026-09-16-license-and-rider records delegated provenance, not a fabricated ratification",
    );
  });
});
