/**
 * Validate explicit many-to-many alignment edges and edition layers (am-edn-alignment-tooling-do1).
 * CLI: bun scripts/align-editions.ts --paper <slug> [--layers german,translation,gloss] [--sections s4,s5] [--require-reviewed] [--report]
 */

import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  type AlignmentComponent,
  type AlignmentIssue,
  type AlignmentIssueCode,
  type ExplicitEdge,
  type ReviewStateUnit,
  type TermOccurrence,
  type ValidateGlossInput,
  validateAlignmentSplits,
  validateDerivedStatus,
  validateGloss,
  validateInlineMathematics,
  validateManyToManyAlignment,
  validateReviewStates,
  validateTerms,
} from "../src/content/editions/alignment.ts";
import {
  coverageReport,
  coverageReportIsHonest,
  coverageReportJson,
  coverageReportMarkdown,
  type EditionCoverageReport,
} from "../src/content/editions/coverageReport.ts";
import { inspectLedgerPresence } from "../src/content/editions/ledgerPresence.ts";
import { getReviewStateCheck } from "../src/content/editions/reviewState.ts";
import { germanAlignableIds, segmentLedger } from "../src/content/editions/segmentLedger.ts";
import { parseRouteSlug, type RouteSlug } from "../src/content/ids.ts";

export type DerivedStatusInput = Readonly<{
  declared: Record<string, string>;
  derived: Record<string, string>;
}>;

export type AlignEditionsOptions = Readonly<{
  slug: RouteSlug;
  layers?: readonly string[] | undefined;
  sections?: readonly string[] | undefined;
  requireReviewed?: boolean | undefined;
  report?: boolean | undefined;
  root?: string | undefined;
  // Test fixture injections
  edges?: readonly ExplicitEdge[] | undefined;
  germanIds?: readonly string[] | undefined;
  englishIds?: readonly string[] | undefined;
  components?: readonly AlignmentComponent[] | undefined;
  terms?: readonly TermOccurrence[] | undefined;
  glossInput?: ValidateGlossInput | undefined;
  reviewUnits?: readonly ReviewStateUnit[] | undefined;
  derivedInput?: DerivedStatusInput | undefined;
}>;

export type AlignEditionsResult = Readonly<{
  ok: boolean;
  exitCode: number;
  slug: RouteSlug;
  layers: readonly string[];
  issues: readonly AlignmentIssue[];
  reportFiles?: Readonly<{ json: string; markdown: string }> | undefined;
  toolRunId?: string | undefined;
}>;

export function runAlignEditions(options: AlignEditionsOptions): AlignEditionsResult {
  const root = options.root ?? process.cwd();
  const slug = options.slug;
  const layers = options.layers ?? ["german", "translation", "gloss"];
  const issues: AlignmentIssue[] = [];

  const presence = inspectLedgerPresence(slug, root);

  // 1. Resolve German and English IDs
  let germanIds = options.germanIds ? [...options.germanIds] : [];
  let englishIds = options.englishIds ? [...options.englishIds] : [];
  let edges = options.edges ? [...options.edges] : [];

  if (germanIds.length === 0 && presence.presence === "present") {
    try {
      const text = readFileSync(join(root, presence.path), "utf8");
      const segmented = segmentLedger({ ledgerText: text });
      if (segmented.status === "proposed") {
        germanIds = [...germanAlignableIds(segmented.blocks)];
      }
    } catch {
      // ignore read error
    }
  }

  // Filter by sections if specified
  if (options.sections && options.sections.length > 0) {
    const secPrefixes = options.sections.map((s) => (s.startsWith("s") ? s : `s${s}`));
    germanIds = germanIds.filter((id) =>
      secPrefixes.some((p) => id.startsWith(`${p}-`) || id === p),
    );
    englishIds = englishIds.filter((id) =>
      secPrefixes.some((p) => id.startsWith(`${p}-`) || id === p),
    );
    edges = edges.filter(
      (e) =>
        secPrefixes.some((p) => e.sourceId.startsWith(`${p}-`) || e.sourceId === p) &&
        secPrefixes.some((p) => e.targetId.startsWith(`${p}-`) || e.targetId === p),
    );
  }

  // 2. Alignment validations (rules C.1, C.4)
  if (edges.length > 0 || germanIds.length > 0 || englishIds.length > 0) {
    const alignIssues = validateManyToManyAlignment({ edges, germanIds, englishIds });
    issues.push(...alignIssues);
  }

  if (englishIds.length > 0) {
    const splitIssues = validateAlignmentSplits(englishIds);
    issues.push(...splitIssues);
  }

  // 3. Inline mathematics, references, and footnote marks (rule C.3)
  if (options.components && options.components.length > 0) {
    const mathIssues = validateInlineMathematics(options.components);
    issues.push(...mathIssues);
  }

  // 4. Terminology validation (rule C.5)
  if (options.terms && options.terms.length > 0) {
    const termIssues = validateTerms(options.terms);
    issues.push(...termIssues);
  }

  // 5. Gloss validation (rule C.6)
  if (options.glossInput) {
    const glossIssues = validateGloss(options.glossInput);
    issues.push(...glossIssues);
  }

  // 6. Review states (rule C.7)
  if (options.reviewUnits && options.reviewUnits.length > 0) {
    const reviewIssues = validateReviewStates(options.reviewUnits);
    issues.push(...reviewIssues);
  }

  // 7. Derived status (rule C.8)
  if (options.derivedInput) {
    const derivedIssues = validateDerivedStatus(
      options.derivedInput.declared,
      options.derivedInput.derived,
    );
    issues.push(...derivedIssues);
  }

  // 7. --require-reviewed guard
  if (options.requireReviewed) {
    if (!options.reviewUnits || options.reviewUnits.length === 0) {
      issues.push({
        code: "unit-not-reviewed",
        message: `--require-reviewed specified, but no reviewed units exist for paper "${slug}".`,
      });
    } else {
      const reviewCheck = getReviewStateCheck();
      for (const u of options.reviewUnits) {
        if (u.reviewState !== "reviewed") {
          issues.push({
            code: "unit-not-reviewed",
            sourceId: u.id,
            message: `Unit "${u.id}" is in state "${u.reviewState}", required "reviewed".`,
          });
        } else {
          const checkRes = reviewCheck({ unitId: u.id, paper: slug, layer: "translation" });
          if (!checkRes.ok) {
            issues.push({
              code: (checkRes.code as AlignmentIssueCode) ?? "review-records-not-available",
              sourceId: u.id,
              message: checkRes.message ?? `Review check failed for unit "${u.id}".`,
            });
          }
        }
      }
    }
  }

  // 8. Generate Coverage Report if requested
  let reportFiles: { json: string; markdown: string } | undefined;
  let toolRunId: string | undefined;

  if (options.report) {
    toolRunId = `align-${slug}-${Date.now()}-${randomBytes(3).toString("hex")}`;
    const reportDir = join(root, "artifacts/edition-coverage", slug);
    mkdirSync(reportDir, { recursive: true });

    const rep: EditionCoverageReport = coverageReport({
      slug,
      root,
      germanUnitCount: germanIds.length,
      translationUnitCount: englishIds.length,
      alignmentEdgeCount: edges.length,
      glossUnitCount: options.glossInput?.glossUnits.length ?? 0,
      germanEditionPresent: presence.presence === "present",
    });

    const json = coverageReportJson(rep);
    const md = coverageReportMarkdown(rep);

    if (!coverageReportIsHonest(md, json)) {
      throw new Error(
        "Generated coverage report violates honesty doctrine (contains percent sign or score keys).",
      );
    }

    const jsonPath = join(reportDir, `${toolRunId}.json`);
    const mdPath = join(reportDir, `${toolRunId}.md`);

    writeFileSync(jsonPath, json, "utf8");
    writeFileSync(mdPath, md, "utf8");

    reportFiles = {
      json: `artifacts/edition-coverage/${slug}/${toolRunId}.json`,
      markdown: `artifacts/edition-coverage/${slug}/${toolRunId}.md`,
    };
  }

  const ok = issues.length === 0;
  return Object.freeze({
    ok,
    exitCode: ok ? 0 : 1,
    slug,
    layers: Object.freeze([...layers]),
    issues: Object.freeze(issues),
    reportFiles: reportFiles ? Object.freeze(reportFiles) : undefined,
    toolRunId,
  });
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

const isMain =
  process.argv[1] !== undefined &&
  (import.meta.url === `file://${process.argv[1]}` ||
    process.argv[1].endsWith("align-editions.ts"));

if (isMain) {
  const slugRaw = argValue("--paper") ?? argValue("--slug") ?? "brownian-motion";
  const parsed = parseRouteSlug(slugRaw);
  if (!parsed.ok) {
    console.error(parsed.error);
    process.exit(2);
  }
  const layersRaw = argValue("--layers");
  const layers = layersRaw ? layersRaw.split(",").map((s) => s.trim()) : undefined;
  const sectionsRaw = argValue("--sections");
  const sections = sectionsRaw ? sectionsRaw.split(",").map((s) => s.trim()) : undefined;
  const requireReviewed = hasFlag("--require-reviewed");
  const report = hasFlag("--report");

  const result = runAlignEditions({
    slug: parsed.value,
    layers,
    sections,
    requireReviewed,
    report,
  });

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.exitCode);
}
