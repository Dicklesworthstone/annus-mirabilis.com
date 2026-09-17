/**
 * WCAG 2.2 Criteria Map Validator Test.
 *
 * Spec: AGENTS.md §10.1 and am-a11y-baseline-1cg5
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import yaml from "js-yaml";

interface WcagCriterionEntry {
  readonly id: string;
  readonly name: string;
  readonly level: "A" | "AA";
  readonly status: "implemented" | "supported" | "not-applicable";
  readonly owner?: string | undefined;
  readonly rule?: string | undefined;
  readonly check?: string | undefined;
  readonly notApplicableReason?: string | undefined;
  readonly revisitTrigger?: string | undefined;
}

interface WcagMapDocument {
  readonly metadata: {
    readonly standard: string;
    readonly levels: readonly string[];
    readonly totalCriteria: number;
    readonly sourceUrl: string;
    readonly retrievedAt: string;
  };
  readonly criteria: readonly WcagCriterionEntry[];
}

describe("WCAG 2.2 Criteria Map Validation (am-a11y-baseline-1cg5)", () => {
  const mapPath = join(process.cwd(), "docs", "accessibility", "wcag-22-map.yaml");
  const rawContent = readFileSync(mapPath, "utf8");
  const doc = yaml.load(rawContent) as WcagMapDocument;

  it("loads valid YAML with correct standard and metadata", () => {
    assert.ok(doc.metadata);
    assert.equal(doc.metadata.standard, "WCAG 2.2");
    assert.ok(doc.metadata.sourceUrl.includes("WCAG22"));
    assert.ok(doc.metadata.retrievedAt);
    assert.equal(doc.metadata.totalCriteria, 55);
  });

  it("contains exactly 55 criteria for Level A and Level AA", () => {
    assert.equal(doc.criteria.length, 55, `Expected 55 criteria, got ${doc.criteria.length}`);
  });

  it("contains no duplicate criterion IDs", () => {
    const seen = new Set<string>();
    for (const c of doc.criteria) {
      assert.ok(!seen.has(c.id), `Duplicate criterion id '${c.id}' found`);
      seen.add(c.id);
    }
  });

  it("confirms 4.1.1 Parsing is absent (removed in WCAG 2.2)", () => {
    const has411 = doc.criteria.some((c) => c.id === "4.1.1");
    assert.equal(has411, false, "4.1.1 must be absent in WCAG 2.2 map");
  });

  it("validates every criterion has valid level ('A' or 'AA')", () => {
    for (const c of doc.criteria) {
      assert.ok(
        c.level === "A" || c.level === "AA",
        `Criterion ${c.id} has invalid level '${c.level}'`,
      );
      assert.ok(c.name && c.name.trim().length > 0, `Criterion ${c.id} missing name`);
    }
  });

  it("enforces not-applicable entries carry both reason and revisitTrigger", () => {
    const notApp = doc.criteria.filter((c) => c.status === "not-applicable");
    assert.ok(notApp.length > 0, "Expected some not-applicable criteria");

    for (const c of notApp) {
      assert.ok(
        c.notApplicableReason && c.notApplicableReason.trim().length > 0,
        `Criterion ${c.id} is not-applicable but missing notApplicableReason`,
      );
      assert.ok(
        c.revisitTrigger && c.revisitTrigger.trim().length > 0,
        `Criterion ${c.id} is not-applicable but missing revisitTrigger`,
      );
    }
  });

  it("enforces implemented/supported entries name owner bead, rule, and check", () => {
    const implemented = doc.criteria.filter((c) => c.status !== "not-applicable");
    for (const c of implemented) {
      assert.ok(
        c.owner && c.owner.trim().length > 0,
        `Criterion ${c.id} is active but missing owner beadId`,
      );
      assert.ok(
        c.rule && c.rule.trim().length > 0,
        `Criterion ${c.id} is active but missing rule description`,
      );
      assert.ok(
        c.check && c.check.trim().length > 0,
        `Criterion ${c.id} is active but missing check description`,
      );
    }
  });
});
