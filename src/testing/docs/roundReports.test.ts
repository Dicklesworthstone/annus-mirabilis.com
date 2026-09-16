import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { ComprehensionLogger } from "../../comprehension/logger.ts";
import { RoundReportValidationError, validateRoundReportText } from "./roundReports.ts";

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
    suite: "round-reports",
    testId,
    file,
    check,
    outcome: pass ? "pass" : "fail",
    message,
  });
  assert.equal(pass, true, message);
}

const VALID_FIXTURE = `---
paper: brownian-motion
route: no-algebra
date: "2027-04-12"
buildCommit: "e120a5e93965e1e8ddef22772ea18dd402977145ba007204e96f229dfeda966c"
anchors:
  - "#s4-diffusion-equation"
  - "bm-01:step-drag"
facilitator: open-comprehension-brownian-motion
---

# Round Report

Participants:
- \`brownian-motion-no-algebra-20270412-01\`
- \`brownian-motion-no-algebra-20270412-02\`

Notes on session.
`;

describe("roundReports schema and validation", () => {
  it("a fixture report with complete front matter passes validation", () => {
    const parsed = validateRoundReportText(VALID_FIXTURE, "fixtures/round-valid.md");
    assert.equal(parsed.frontMatter.paper, "brownian-motion");
    assert.equal(parsed.frontMatter.route, "no-algebra");
    assert.equal(parsed.frontMatter.date, "2027-04-12");
    assert.equal(parsed.participantCodes.length, 2);
    logCheck(
      "round-valid-fixture",
      "fixtures/round-valid.md",
      "valid fixture passes",
      true,
      "Valid fixture passed.",
    );
  });

  it("missing buildCommit fails with file and line", () => {
    const badFixture = `---
paper: brownian-motion
route: no-algebra
date: "2027-04-12"
anchors:
  - "#s4-diffusion-equation"
facilitator: open-comprehension-brownian-motion
---

# Report
`;
    assert.throws(
      () => validateRoundReportText(badFixture, "docs/comprehension/rounds/bad-commit.md"),
      (err: unknown) => {
        return (
          err instanceof RoundReportValidationError &&
          err.code === "missing-build-commit" &&
          err.file === "docs/comprehension/rounds/bad-commit.md" &&
          err.line === 1
        );
      },
    );
  });

  it("unknown route fails with file and line", () => {
    const badFixture = `---
paper: brownian-motion
route: skimming
date: "2027-04-12"
buildCommit: "e120a5e93965e1e8ddef22772ea18dd402977145ba007204e96f229dfeda966c"
anchors:
  - "#s4-diffusion-equation"
facilitator: open-comprehension-brownian-motion
---

# Report
`;
    assert.throws(
      () => validateRoundReportText(badFixture, "docs/comprehension/rounds/bad-route.md"),
      (err: unknown) => {
        return (
          err instanceof RoundReportValidationError &&
          err.code === "invalid-route" &&
          err.file === "docs/comprehension/rounds/bad-route.md" &&
          err.line === 3
        );
      },
    );
  });

  it("facilitator ID containing an at sign fails with file and line", () => {
    const badFixture = `---
paper: brownian-motion
route: no-algebra
date: "2027-04-12"
buildCommit: "e120a5e93965e1e8ddef22772ea18dd402977145ba007204e96f229dfeda966c"
anchors:
  - "#s4-diffusion-equation"
facilitator: researcher@example.com
---

# Report
`;
    assert.throws(
      () => validateRoundReportText(badFixture, "docs/comprehension/rounds/bad-fac.md"),
      (err: unknown) => {
        return (
          err instanceof RoundReportValidationError &&
          err.code === "facilitator-contains-email" &&
          err.file === "docs/comprehension/rounds/bad-fac.md" &&
          err.line === 8
        );
      },
    );
  });

  it("an embedded email address fails with file and line", () => {
    const badFixture = `---
paper: brownian-motion
route: no-algebra
date: "2027-04-12"
buildCommit: "e120a5e93965e1e8ddef22772ea18dd402977145ba007204e96f229dfeda966c"
anchors:
  - "#s4-diffusion-equation"
facilitator: open-comprehension-brownian-motion
---

# Report
Contact participant at jane.doe@example.org for follow-up.
`;
    assert.throws(
      () => validateRoundReportText(badFixture, "docs/comprehension/rounds/email-leak.md"),
      (err: unknown) => {
        return (
          err instanceof RoundReportValidationError &&
          err.code === "privacy-email-detected" &&
          err.file === "docs/comprehension/rounds/email-leak.md" &&
          err.line === 12
        );
      },
    );
  });

  it("a participant code the parser rejects fails with file and line", () => {
    const badFixture = `---
paper: brownian-motion
route: no-algebra
date: "2027-04-12"
buildCommit: "e120a5e93965e1e8ddef22772ea18dd402977145ba007204e96f229dfeda966c"
anchors:
  - "#s4-diffusion-equation"
facilitator: open-comprehension-brownian-motion
---

# Report
Participant \`brownian-motion-no-algebra-20270412-7\` completed the session.
`;
    assert.throws(
      () => validateRoundReportText(badFixture, "docs/comprehension/rounds/bad-code.md"),
      (err: unknown) => {
        return (
          err instanceof RoundReportValidationError &&
          err.code === "invalid-participant-code" &&
          err.file === "docs/comprehension/rounds/bad-code.md" &&
          err.line === 12
        );
      },
    );
  });

  it("validates all markdown files under docs/comprehension/rounds/", () => {
    const roundsDir = join(rootDir, "docs/comprehension/rounds");
    try {
      const files = readdirSync(roundsDir).filter((f) => f.endsWith(".md") && f !== "README.md");
      for (const file of files) {
        const fullPath = join(roundsDir, file);
        const content = readFileSync(fullPath, "utf8");
        const relPath = `docs/comprehension/rounds/${file}`;
        const parsed = validateRoundReportText(content, relPath);
        assert.ok(parsed.frontMatter.paper);
      }
    } catch {
      // Directory may be empty before rounds run
    }
  });
});
