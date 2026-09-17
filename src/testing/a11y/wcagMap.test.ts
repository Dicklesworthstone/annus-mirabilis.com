/**
 * WCAG 2.2 Criteria Map Bun Test Suite.
 *
 * Spec: AGENTS.md §10.1 and am-a11y-baseline-1cg5
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

describe("WCAG 2.2 Criteria Map Bun Validation (am-a11y-baseline-1cg5)", () => {
  const mapPath = join(process.cwd(), "docs", "accessibility", "wcag-22-map.yaml");
  const rawContent = readFileSync(mapPath, "utf8");
  const doc = yaml.load(rawContent) as WcagMapDocument;

  it("loads valid YAML with correct standard and metadata", () => {
    expect(doc.metadata).toBeDefined();
    expect(doc.metadata.standard).toBe("WCAG 2.2");
    expect(doc.metadata.sourceUrl.includes("WCAG22")).toBe(true);
    expect(doc.metadata.retrievedAt).toBeDefined();
    expect(doc.metadata.totalCriteria).toBe(55);
  });

  it("contains exactly 55 criteria for Level A and Level AA", () => {
    expect(doc.criteria.length).toBe(55);
  });

  it("contains no duplicate criterion IDs", () => {
    const seen = new Set<string>();
    for (const c of doc.criteria) {
      expect(seen.has(c.id)).toBe(false);
      seen.add(c.id);
    }
  });

  it("confirms 4.1.1 Parsing is absent (removed in WCAG 2.2)", () => {
    const has411 = doc.criteria.some((c) => c.id === "4.1.1");
    expect(has411).toBe(false);
  });

  it("validates every criterion has valid level ('A' or 'AA')", () => {
    for (const c of doc.criteria) {
      expect(["A", "AA"].includes(c.level)).toBe(true);
      expect(c.name && c.name.trim().length > 0).toBe(true);
    }
  });

  it("enforces not-applicable entries carry both reason and revisitTrigger", () => {
    const notApp = doc.criteria.filter((c) => c.status === "not-applicable");
    expect(notApp.length).toBeGreaterThan(0);

    for (const c of notApp) {
      expect(c.notApplicableReason && c.notApplicableReason.trim().length > 0).toBe(true);
      expect(c.revisitTrigger && c.revisitTrigger.trim().length > 0).toBe(true);
    }
  });

  it("enforces implemented/supported entries name owner bead, rule, and check", () => {
    const implemented = doc.criteria.filter((c) => c.status !== "not-applicable");
    for (const c of implemented) {
      expect(c.owner && c.owner.trim().length > 0).toBe(true);
      expect(c.rule && c.rule.trim().length > 0).toBe(true);
      expect(c.check && c.check.trim().length > 0).toBe(true);
    }
  });
});
