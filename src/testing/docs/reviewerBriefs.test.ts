/**
 * Reviewer and Contributor Briefs & OWNERS.md Structural Validation Tests
 *
 * Owning bead: am-gov-owners-and-reviewers-hte
 * Validates docs/OWNERS.md and all 9 review briefs under docs/review/.
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

export interface OwnersRow {
  readonly id: string;
  readonly displayName: string;
  readonly roles: readonly string[];
  readonly scope: readonly string[];
  readonly status: "assigned" | "open: recruiting";
  readonly consentToBeNamed: "yes" | "not-applicable";
  readonly assignedBy: string;
  readonly assignedOn: string;
}

export const VALID_ROLE_IDS = new Set([
  "editorial-owner",
  "implementation-owner",
  "german-source-reviewer",
  "physics-math-reviewer",
  "r2-readability-reviewer",
  "tour-tester",
  "history-reviewer",
  "transfer-task-reviewer",
  "cross-projection-reviewer",
  "accessibility-codesign-facilitator",
  "comprehension-facilitator",
  "real-device-tester",
  "translator",
  "checking-editor",
  "glossator",
  "edition-editor",
]);

export const REVIEW_ROLES = new Set([
  "german-source-reviewer",
  "physics-math-reviewer",
  "r2-readability-reviewer",
  "tour-tester",
  "history-reviewer",
  "transfer-task-reviewer",
  "cross-projection-reviewer",
  "accessibility-codesign-facilitator",
  "comprehension-facilitator",
  "real-device-tester",
]);

export interface OwnersValidationResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly rows: readonly OwnersRow[];
  readonly qualifications: readonly string[];
}

export function parseOwnersMarkdown(content: string): OwnersValidationResult {
  const errors: string[] = [];
  const rows: OwnersRow[] = [];
  const qualifications: string[] = [];

  const lines = content.split("\n");
  let inTable = false;
  let inQualifications = false;
  let tableHeaderFound = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? "";

    if (line.startsWith("## Qualifications")) {
      inQualifications = true;
      inTable = false;
      continue;
    }

    if (inQualifications) {
      if (line.startsWith("### ")) {
        const qualId = line.slice(4).trim();
        if (qualId) qualifications.push(qualId);
      }
      continue;
    }

    if (
      line.startsWith(
        "| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |",
      )
    ) {
      tableHeaderFound = true;
      inTable = true;
      i++; // Skip separator line
      continue;
    }

    if (inTable) {
      if (!line.startsWith("|") || line.length === 0) {
        inTable = false;
        continue;
      }

      const rawCols = line.split("|").map((c) => c.trim());
      // A valid table row split by '|' has empty string at index 0 and index 9 (before first and after last |)
      if (rawCols.length < 10) {
        errors.push(
          `Line ${i + 1}: Table row has ${rawCols.length - 2} columns, expected 8 columns.`,
        );
        continue;
      }

      const id = rawCols[1] ?? "";
      const displayName = rawCols[2] ?? "";
      const rolesRaw = rawCols[3] ?? "";
      const scopeRaw = rawCols[4] ?? "";
      const statusRaw = rawCols[5] ?? "";
      const consentRaw = rawCols[6] ?? "";
      const assignedBy = rawCols[7] ?? "";
      const assignedOn = rawCols[8] ?? "";

      // Validate ID
      if (!id || !/^[a-z0-9][a-z0-9-]{1,40}$/.test(id)) {
        errors.push(
          `Line ${i + 1}: Invalid id '${id}'. Must be lowercase handle [a-z0-9][a-z0-9-]{1,40}.`,
        );
      }

      if (id.startsWith("model:")) {
        errors.push(`Line ${i + 1}: Model ID '${id}' is not permitted in owners table.`);
      }

      // Check agent in reviewer role
      const roles = rolesRaw
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean);
      for (const role of roles) {
        if (!VALID_ROLE_IDS.has(role)) {
          errors.push(`Line ${i + 1}: Unknown role id '${role}'.`);
        }
        if (
          REVIEW_ROLES.has(role) &&
          (id.startsWith("agent:") || assignedBy.startsWith("model:"))
        ) {
          errors.push(`Line ${i + 1}: Agent ID '${id}' may not hold reviewer role '${role}'.`);
        }
      }

      const scope = scopeRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      // Validate Status and Name
      if (statusRaw === "open: recruiting") {
        if (displayName.length > 0) {
          errors.push(
            `Line ${i + 1}: Open recruiting row '${id}' must have an empty displayName, found '${displayName}'.`,
          );
        }
        if (consentRaw !== "not-applicable") {
          errors.push(
            `Line ${i + 1}: Open recruiting row '${id}' must have consentToBeNamed 'not-applicable', found '${consentRaw}'.`,
          );
        }
      } else if (statusRaw === "assigned") {
        if (displayName.length === 0) {
          errors.push(`Line ${i + 1}: Assigned row '${id}' must have a non-empty displayName.`);
        }
        if (consentRaw !== "yes") {
          errors.push(
            `Line ${i + 1}: Assigned row '${id}' must have consentToBeNamed 'yes', found '${consentRaw}'.`,
          );
        }
      } else {
        errors.push(
          `Line ${i + 1}: Unknown status '${statusRaw}'. Expected 'assigned' or 'open: recruiting'.`,
        );
      }

      rows.push({
        id,
        displayName,
        roles,
        scope,
        status: statusRaw as "assigned" | "open: recruiting",
        consentToBeNamed: consentRaw as "yes" | "not-applicable",
        assignedBy,
        assignedOn,
      });
    }
  }

  if (!tableHeaderFound) {
    errors.push(
      "Missing required table header: | id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |",
    );
  }

  // Verify qualifications for assigned reviewers
  const qualSet = new Set(qualifications);
  for (const row of rows) {
    if (row.status === "assigned") {
      const hasReviewRole = row.roles.some(
        (r) => REVIEW_ROLES.has(r) || r === "editorial-owner" || r === "implementation-owner",
      );
      if (hasReviewRole && !qualSet.has(row.id)) {
        errors.push(
          `Assigned owner/reviewer '${row.id}' must have a qualification statement under '## Qualifications'.`,
        );
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    rows,
    qualifications,
  };
}

export function validateAuthorshipId(humanId: string, rows: readonly OwnersRow[]): boolean {
  return rows.some((r) => r.id === humanId);
}

export interface SupersededPhraseRule {
  readonly name: string;
  readonly test: (line: string) => boolean;
  readonly reason: string;
}

export const SUPERSEDED_PHYSICS_RULES: readonly SupersededPhraseRule[] = [
  {
    name: "printed elementary charge",
    test: (line: string) => /printed\s+elementary\s+charge/i.test(line),
    reason: "Elementary charge was not printed in Paper 1.",
  },
  {
    name: "R and L called 'printed constants'",
    test: (line: string) =>
      /\$?R\$?\s+and\s+\$?L\$?\s+called\s+['"]?printed constants['"]?/i.test(line) ||
      /called\s+['"]printed constants['"]/i.test(line),
    reason: "R and L are editorial inputs, not printed constants.",
  },
  {
    name: "$k$ from 1 to",
    test: (line: string) => /\$?k\$?\s+from\s+1\s+to/i.test(line),
    reason: "Obsolete notation index form.",
  },
  {
    name: "gasConstant (unrejected)",
    test: (line: string) => {
      const lower = line.toLowerCase();
      return (
        line.includes("gasConstant") &&
        !lower.includes("the spelling `gasconstant` is rejected") &&
        !lower.includes("the spelling gasconstant is rejected")
      );
    },
    reason: "Rejected spelling; canonical quantity is molarGasConstant.",
  },
  {
    name: "60 s displacement without constant set",
    test: (line: string) => {
      const lower = line.toLowerCase();
      if (/60\s*s\s*displacement/i.test(line)) {
        return (
          !lower.includes("constant set") &&
          !lower.includes("printed") &&
          !lower.includes("about 6") &&
          !lower.includes("einstein-1905")
        );
      }
      return false;
    },
    reason:
      "60 s displacement must always be stated with its explicit constant set or as printed 'about 6'.",
  },
];

export function checkSupersededPhrases(content: string): { phrase: string; line: number }[] {
  const violations: { phrase: string; line: number }[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    for (const rule of SUPERSEDED_PHYSICS_RULES) {
      if (rule.test(line)) {
        violations.push({ phrase: rule.name, line: i + 1 });
      }
    }
  }

  return violations;
}

describe("Reviewer Briefs and Owners Table Suite", () => {
  const rootDir = process.cwd();
  const docsDir = join(rootDir, "docs");
  const reviewDir = join(docsDir, "review");
  const ownersPath = join(docsDir, "OWNERS.md");

  const logRunId = generateLogRunId();
  const logDir = join(rootDir, "artifacts", "test-logs", "reviewer-briefs");
  mkdirSync(logDir, { recursive: true });
  const logPath = join(logDir, `${logRunId}.jsonl`);

  function logCheck(check: string, file: string, outcome: "passed" | "failed", message: string) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      suite: "reviewer-briefs",
      logRunId,
      testId: `check-${check.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      beadId: "am-gov-owners-and-reviewers-hte",
      file,
      check,
      outcome,
      message,
    };
    writeFileSync(logPath, JSON.stringify(logEntry) + "\n", { flag: "a", encoding: "utf8" });
  }

  describe("Brief Existence and Evidence Format", () => {
    const requiredBriefs = [
      "german-source.md",
      "physics.md",
      "r2-readability.md",
      "tour-completion.md",
      "history.md",
      "transfer-task.md",
      "cross-projection.md",
      "contributors.md",
      "facilitators.md",
    ];

    for (const briefName of requiredBriefs) {
      it(`verifies ${briefName} exists and has Evidence Format section`, () => {
        const filePath = join(reviewDir, briefName);
        assert.ok(existsSync(filePath), `Brief ${briefName} must exist under docs/review/`);

        const content = readFileSync(filePath, "utf8");
        assert.ok(
          content.includes("## Evidence Format"),
          `${briefName} must have an '## Evidence Format' section`,
        );
        logCheck(
          "brief-existence",
          briefName,
          "passed",
          `${briefName} exists with evidence format`,
        );
      });
    }
  });

  describe("German Source Brief (german-source.md)", () => {
    it("verifies required sections, artifacts, and multi-reviewer rules", () => {
      const content = readFileSync(join(reviewDir, "german-source.md"), "utf8");
      assert.ok(content.includes("## Materials"), "Missing ## Materials");
      assert.ok(content.includes("## German Fidelity"), "Missing ## German Fidelity");
      assert.ok(content.includes("## Translation Accuracy"), "Missing ## Translation Accuracy");
      assert.ok(content.includes("## Disagreements"), "Missing ## Disagreements");
      assert.ok(content.includes("## Focus Items"), "Missing ## Focus Items");
      assert.ok(content.includes("## Sign-off"), "Missing ## Sign-off");
      assert.ok(content.includes("## Two Reviewers"), "Missing ## Two Reviewers");

      assert.ok(content.includes("page-comparison.yaml"), "Must reference page-comparison.yaml");
      assert.ok(content.includes("disagreements.yaml"), "Must reference disagreements.yaml");
      assert.ok(
        content.includes("german-source-focus.yaml"),
        "Must reference german-source-focus.yaml",
      );
      assert.ok(
        content.includes("scripts/import-review-record.ts"),
        "Must reference import command",
      );

      logCheck(
        "german-source-sections",
        "german-source.md",
        "passed",
        "german-source.md contains all required sections and artifacts",
      );
    });
  });

  describe("Physics Brief (physics.md)", () => {
    it("contains all required physical and numerical constants", () => {
      const content = readFileSync(join(reviewDir, "physics.md"), "utf8");
      const requiredValues = [
        "6.10\\times10^{-57}",
        "6.1858\\times10^{23}",
        "9.6\\cdot10^{3}",
        "4.3385",
        "4.3057",
        "0.7947833",
        "6.156365",
        "0.27–0.39",
        "\\sqrt{2.5}",
        "ftcs-unstable",
        "molarGasConstant",
        "avogadroConstant",
        "\\gamma\\,\\mathbf{v}\\times\\mathbf{B}",
      ];

      for (const val of requiredValues) {
        assert.ok(content.includes(val), `physics.md must contain required fixture value '${val}'`);
      }

      logCheck(
        "physics-constants",
        "physics.md",
        "passed",
        "physics.md contains all audited fixture constants",
      );
    });

    it("contains zero superseded statements", () => {
      const content = readFileSync(join(reviewDir, "physics.md"), "utf8");
      const violations = checkSupersededPhrases(content);
      assert.deepEqual(
        violations,
        [],
        `physics.md contains superseded statements: ${JSON.stringify(violations)}`,
      );
      logCheck(
        "physics-superseded-check",
        "physics.md",
        "passed",
        "physics.md free of superseded statements",
      );
    });

    it("planted negative: catches superseded statement in bad fixture", () => {
      const badFixture = `
# Physics Brief with Defect
Printed elementary charge is used.
$R$ and $L$ called 'printed constants' in paper 1.
The spelling gasConstant is used directly.
`;
      const violations = checkSupersededPhrases(badFixture);
      assert.ok(
        violations.length >= 3,
        "Planted negative fixture must detect all superseded phrases",
      );
      assert.ok(violations.some((v) => v.phrase === "printed elementary charge" && v.line === 3));
      logCheck(
        "physics-planted-negative",
        "badFixture",
        "passed",
        "Planted negative fixture detected superseded phrases with line numbers",
      );
    });
  });

  describe("Cross-Projection Brief (cross-projection.md)", () => {
    it("names the eleven projections in reading order, four verdicts, and seven finding kinds", () => {
      const content = readFileSync(join(reviewDir, "cross-projection.md"), "utf8");

      // 11 projections in reading order
      const projections = [
        "German source block",
        "Aligned translation unit",
        "R0 reading",
        "R2 reading",
        "R3 reading",
        "Equation record",
        "Instrument whose weave predicate lights the claim",
        "Results card",
        "Printed chapter",
        "Accessible equivalent",
        "Fifteen-minute tour",
      ];

      let lastIndex = -1;
      for (const proj of projections) {
        const idx = content.indexOf(proj);
        assert.ok(idx !== -1, `cross-projection.md must contain projection '${proj}'`);
        assert.ok(idx > lastIndex, `Projection '${proj}' must appear in reading order`);
        lastIndex = idx;
      }

      // 4 verdicts
      const verdicts = ["supported", "qualified", "discrepant", "absent"];
      for (const verd of verdicts) {
        assert.ok(content.includes(verd), `cross-projection.md must define verdict '${verd}'`);
      }

      // 7 finding kinds
      const findingKinds = [
        "unsupported-claim",
        "dropped-qualification",
        "notation-drift",
        "missing-accessible-bridge",
        "broken-weave-link",
        "misaligned-step",
        "unexplained-jump",
      ];
      for (const fk of findingKinds) {
        assert.ok(content.includes(fk), `cross-projection.md must define finding kind '${fk}'`);
      }

      assert.ok(
        content.includes("authored none of the eleven projections"),
        "Must enforce self-review prohibition",
      );
      logCheck(
        "cross-projection-matrix",
        "cross-projection.md",
        "passed",
        "cross-projection.md verified with 11 projections, 4 verdicts, and 7 finding kinds",
      );
    });
  });

  describe("History, Transfer-Task, Contributors, and Facilitators Briefs", () => {
    it("verifies transfer-task.md four checks", () => {
      const content = readFileSync(join(reviewDir, "transfer-task.md"), "utf8");
      assert.ok(content.includes("Cross-Journey Exercises"));
      assert.ok(content.includes("Predict-Perturb-Explain Tasks"));
      assert.ok(content.includes("Teach-Back Prompts"));
      assert.ok(content.includes("Revisit Cards, Paired-Learning Sheets, and Capstone Templates"));
    });

    it("verifies history.md queues and narrowed sign-off", () => {
      const content = readFileSync(join(reviewDir, "history.md"), "utf8");
      assert.ok(content.includes("available-1904"));
      assert.ok(content.includes("parallel-work"));
      assert.ok(content.includes("later-confirmation"));
      assert.ok(content.includes("pedagogical-reconstruction"));
      assert.ok(content.includes("narrowed"));
      assert.ok(content.includes("unmet quality gate exit condition"));
    });

    it("verifies contributors.md roles and authorship fields", () => {
      const content = readFileSync(join(reviewDir, "contributors.md"), "utf8");
      assert.ok(content.includes("`translator`"));
      assert.ok(content.includes("`checking-editor`"));
      assert.ok(content.includes("`glossator`"));
      assert.ok(content.includes("`edition-editor`"));
      assert.ok(content.includes("`draftedBy`"));
      assert.ok(content.includes("`translatedBy`"));
      assert.ok(content.includes("`editedBy`"));
      assert.ok(content.includes("authorship-unknown-contributor"));
      assert.ok(content.includes("edition.yaml"));
      assert.ok(content.includes("consentToBeNamed: yes"));
    });

    it("verifies facilitators.md participant codes and anonymity", () => {
      const content = readFileSync(join(reviewDir, "facilitators.md"), "utf8");
      assert.ok(content.includes("<paper>-<route>-<YYYYMMDD>-<nn>"));
      assert.ok(content.includes("Participants are NEVER named"));
      assert.ok(content.includes("docs/accessibility/manual-protocol.md"));
      assert.ok(content.includes("docs/testing/real-device/README.md"));
    });
  });

  describe("OWNERS.md Structural Validation and Planted Negatives", () => {
    it("validates the real docs/OWNERS.md file", () => {
      assert.ok(existsSync(ownersPath), "docs/OWNERS.md must exist");
      const content = readFileSync(ownersPath, "utf8");
      const result = parseOwnersMarkdown(content);

      assert.ok(result.ok, `docs/OWNERS.md failed validation: ${result.errors.join("; ")}`);
      assert.ok(
        result.rows.length >= 20,
        "OWNERS.md must have at least 20 owner/reviewer/contributor rows",
      );

      // Verify jemanuel is editorial-owner and implementation-owner
      const jemanuel = result.rows.find((r) => r.id === "jemanuel");
      assert.ok(jemanuel, "jemanuel must be present in OWNERS.md");
      assert.equal(jemanuel.status, "assigned");
      assert.equal(jemanuel.consentToBeNamed, "yes");
      assert.ok(jemanuel.roles.includes("editorial-owner"));
      assert.ok(jemanuel.roles.includes("implementation-owner"));

      // Verify open recruiting rows
      const openRows = result.rows.filter((r) => r.status === "open: recruiting");
      assert.ok(openRows.length >= 10, "Open recruiting rows must be present");
      assert.ok(openRows.every((r) => r.displayName === ""));
      assert.ok(openRows.every((r) => r.consentToBeNamed === "not-applicable"));

      logCheck(
        "owners-real-validation",
        "OWNERS.md",
        "passed",
        "docs/OWNERS.md valid with jemanuel and open-recruiting rows",
      );
    });

    it("planted negative: row with missing column fails", () => {
      const malformed = `
| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |
|---|---|---|---|---|---|---|---|
| bad-row | Bad | editorial-owner | light-quanta | assigned | yes |
`;
      const result = parseOwnersMarkdown(malformed);
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => e.includes("expected 8 columns")));
      logCheck(
        "owners-planted-missing-col",
        "fixture",
        "passed",
        "Planted negative: missing column detected",
      );
    });

    it("planted negative: agent id in reviewer role fails with distinct agent error", () => {
      const agentReviewer = `
| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |
|---|---|---|---|---|---|---|---|
| agent:BoldHarbor | BoldHarbor Agent | german-source-reviewer | light-quanta | assigned | yes | jemanuel | 2026-09-16 |

## Qualifications
### agent:BoldHarbor
LLM orchestrator.
`;
      const result = parseOwnersMarkdown(agentReviewer);
      assert.equal(result.ok, false);
      assert.ok(
        result.errors.some((e) =>
          e.includes("Agent ID 'agent:BoldHarbor' may not hold reviewer role"),
        ),
      );
      logCheck(
        "owners-planted-agent-reviewer",
        "fixture",
        "passed",
        "Planted negative: agent in reviewer role rejected",
      );
    });

    it("planted negative: open recruiting row with a displayName fails", () => {
      const namedOpen = `
| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |
|---|---|---|---|---|---|---|---|
| open-german-source-brownian | John Doe | german-source-reviewer | brownian-motion | open: recruiting | not-applicable | jemanuel | 2026-09-16 |
`;
      const result = parseOwnersMarkdown(namedOpen);
      assert.equal(result.ok, false);
      assert.ok(
        result.errors.some((e) =>
          e.includes(
            "Open recruiting row 'open-german-source-brownian' must have an empty displayName",
          ),
        ),
      );
      logCheck(
        "owners-planted-open-named",
        "fixture",
        "passed",
        "Planted negative: named open recruiting row rejected",
      );
    });

    it("planted negative: assigned row without consentToBeNamed: yes fails", () => {
      const noConsent = `
| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |
|---|---|---|---|---|---|---|---|
| reviewer-1 | Jane Doe | german-source-reviewer | light-quanta | assigned | no | jemanuel | 2026-09-16 |

## Qualifications
### reviewer-1
PhD in Germanics.
`;
      const result = parseOwnersMarkdown(noConsent);
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => e.includes("must have consentToBeNamed 'yes'")));
      logCheck(
        "owners-planted-no-consent",
        "fixture",
        "passed",
        "Planted negative: assigned row without consent rejected",
      );
    });

    it("planted negative: assigned row without qualification statement fails", () => {
      const noQual = `
| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |
|---|---|---|---|---|---|---|---|
| reviewer-1 | Jane Doe | german-source-reviewer | light-quanta | assigned | yes | jemanuel | 2026-09-16 |

## Qualifications
`;
      const result = parseOwnersMarkdown(noQual);
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => e.includes("must have a qualification statement")));
      logCheck(
        "owners-planted-no-qual",
        "fixture",
        "passed",
        "Planted negative: assigned row without qualification statement rejected",
      );
    });

    it("planted negative: unknown human authorship ID fails resolution", () => {
      const content = readFileSync(ownersPath, "utf8");
      const result = parseOwnersMarkdown(content);
      assert.ok(result.ok);

      const isValidKnown = validateAuthorshipId("jemanuel", result.rows);
      assert.equal(isValidKnown, true);

      const isValidUnknown = validateAuthorshipId("unknown-person-42", result.rows);
      assert.equal(isValidUnknown, false);

      logCheck(
        "owners-authorship-unknown",
        "OWNERS.md",
        "passed",
        "Authorship ID validation correctly resolves known vs unknown contributors",
      );
    });
  });
});
