/**
 * AN ENGLISH DISPLAY IS BYTE-IDENTICAL TO THE GERMAN ONE IT IS ALIGNED TO
 * (am-rc1001-bridge-plan-pcjk.10).
 *
 * AGENTS.md, "What the content compiler rejects": "an English equation block that is not
 * byte-identical to its aligned German block". The structural check that was meant to enforce it
 * (checkEquationNotIdentical) selects German blocks by `kind === "source-block"`, a kind no block in
 * content/ carries: they are `equation`, `paragraph` and so on. Measured 2026-10-01 over all 1,274
 * records, it produced 0 reports, and still 0 with a translation unit's LaTeX altered.
 *
 * This reads the records as they are on disk: every `kind: "equation"` block in
 * content/source-blocks/<paper>/, the edges in content/alignments/<paper>.yaml that leave it, and
 * the translation units they reach. The math a block prints is the ordered list of its `math`
 * inlines' LaTeX; the unit's must be the same list, byte for byte. Notation is not translated
 * (AGENTS.md), so there is no tolerance here.
 *
 * Reads content/, so it is for scripts and tests, never for a page.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { strictParse } from "../schemas/strictParse.ts";
import { type AuditFinding, type AuditReport, summarize } from "./types.ts";

export const EQUATION_IDENTITY_PAPERS = [
  "light-quanta",
  "brownian-motion",
  "special-relativity",
  "mass-energy",
] as const;

/** Measured 2026-10-02: 200 printed displays. Fewer examined is a failure, not a pass. */
export const EQUATION_IDENTITY_MINIMUM = 200;

type Inline = { kind?: unknown; latex?: unknown };
type Edge = { source?: { blockId?: string }; target?: { translationUnitId?: string } };

function yamlRecords(dir: string): Record<string, unknown>[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".yaml") && name !== "manifest.yaml")
    .map((name) => strictParse(readFileSync(join(dir, name), "utf8"), "yaml"))
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null);
}

/** The LaTeX of a record's math inlines, in order. */
export function mathOf(record: Record<string, unknown>): string[] {
  const inlines = Array.isArray(record.inlines) ? (record.inlines as Inline[]) : [];
  return inlines.flatMap((i) =>
    i.kind === "math" && typeof i.latex === "string" ? [i.latex] : [],
  );
}

export type EquationIdentityAudit = Readonly<{
  report: AuditReport;
  blocks: number;
  units: number;
}>;

export function auditEquationIdentity(
  root: string,
  papers: readonly string[] = EQUATION_IDENTITY_PAPERS,
  minimum: number = EQUATION_IDENTITY_MINIMUM,
): EquationIdentityAudit {
  const findings: AuditFinding[] = [];
  let blocks = 0;
  let units = 0;
  for (const paper of papers) {
    const equations = yamlRecords(join(root, "content", "source-blocks", paper)).filter(
      (r) => r.kind === "equation" && typeof r.id === "string",
    );
    const translations = new Map(
      yamlRecords(join(root, "content", "translation-units", paper)).flatMap((r) =>
        typeof r.id === "string" ? [[r.id, r] as const] : [],
      ),
    );
    const alignmentPath = join(root, "content", "alignments", `${paper}.yaml`);
    const edges = existsSync(alignmentPath)
      ? (((strictParse(readFileSync(alignmentPath, "utf8"), "yaml") as { edges?: Edge[] }).edges ??
          []) as Edge[])
      : [];
    for (const block of equations) {
      blocks++;
      const id = block.id as string;
      const german = mathOf(block);
      const targets = edges
        .filter((e) => e.source?.blockId === id)
        .map((e) => e.target?.translationUnitId)
        .filter((t): t is string => typeof t === "string");
      if (targets.length === 0)
        findings.push({
          check: "equation-unaligned",
          family: "audit",
          severity: "error",
          paper,
          recordId: id,
          message: `Equation block ${paper}/${id} has no alignment edge to an English unit, so its English face prints no display.`,
        });
      for (const target of targets) {
        units++;
        const unit = translations.get(target);
        const english = unit ? mathOf(unit) : undefined;
        if (english === undefined || JSON.stringify(english) !== JSON.stringify(german))
          findings.push({
            check: "equation-not-identical",
            family: "audit",
            severity: "error",
            paper,
            recordId: id,
            expected: JSON.stringify(german),
            actual:
              english === undefined ? `no translation unit ${target}` : JSON.stringify(english),
            message: `The English unit ${target} aligned to ${paper}/${id} does not print the German display byte for byte.`,
          });
      }
    }
  }
  if (blocks < minimum)
    findings.push({
      check: "equation-identity-population",
      family: "audit",
      severity: "error",
      message: `The equation identity audit examined ${blocks} equation blocks, under its minimum of ${minimum}: it cannot have judged the edition's displays.`,
    });
  const report = summarize("audit-equation-identity", findings, {
    total: blocks,
    judged: blocks,
    notYetAuditable: 0,
  });
  return { report, blocks, units };
}
