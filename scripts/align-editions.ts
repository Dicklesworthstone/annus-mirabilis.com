/**
 * Validate explicit many-to-many alignment edges and edition layers (am-edn-alignment-tooling-do1).
 * CLI: bun scripts/align-editions.ts --paper <slug> [--layers german,translation,gloss] [--sections s4,s5] [--require-reviewed] [--report]
 */

import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { load as parseYaml } from "js-yaml";
import { registerEditionReviewState } from "../src/content/checks/review/editionReviewState.ts";
import {
  type AlignmentComponent,
  type AlignmentIssue,
  type AlignmentIssueCode,
  edgesFromAlignment,
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
import { isPermanentGermanId } from "../src/content/editions/alignableIds.ts";
import { inspectLedgerPresence } from "../src/content/editions/ledgerPresence.ts";
import { getReviewStateCheck } from "../src/content/editions/reviewState.ts";
import { germanAlignableIds, segmentLedger } from "../src/content/editions/segmentLedger.ts";
import { parseRouteSlug, type RouteSlug } from "../src/content/ids.ts";
import { validateAlignment } from "../src/content/schemas/source.ts";

registerEditionReviewState();

/**
 * THE THREE POPULATIONS THE ALIGNMENT VALIDATOR JUDGES, READ FROM DISK.
 *
 * Before this, `edges` and `englishIds` came only from `options.edges` and `options.englishIds`,
 * objects no CLI or pipeline caller passed -- so the aligner validated an EMPTY edge set for every
 * paper and reported `empty-alignment` while 821 authored edges sat in content/alignments/. That is
 * the same shape the edition contract's own note records about check 1 and `options.declaration`:
 * a validator reading an argument nothing supplies cannot fail, and cannot pass either.
 *
 * Each loader states where its authority is and why:
 *
 *  - EDGES come from `content/alignments/<slug>.yaml`, validated by the schema and converted by
 *    `edgesFromAlignment`, which already existed for this purpose. A record that is absent leaves
 *    the edge set empty, so `empty-alignment` fires and says something true. A record that is
 *    present and unreadable is NOT that, and gets its own code.
 *  - GERMAN IDS come from the FROZEN MANIFEST, which is the published addressing, and fall back to
 *    the ledger proposal only where no manifest exists. Measured 2026-10-05: against the manifest,
 *    `unknown-source` and `unaligned-source` are zero for all four papers; against the ledger
 *    proposal they were 11 to 94 and 9 to 91 per paper, because a proposal that has not been
 *    reconciled is not an addressing scheme. The reconcile stage is where that difference belongs,
 *    and reporting it here as well made the alignment verdict unreadable.
 *  - ENGLISH IDS come from the translation units' own `id` field. Measured: 821 unit files, all 821
 *    carry an id, and NONE equals its filename stem -- so a filename-derived id would have matched
 *    nothing and every edge would have reported `unknown-target`.
 */
function loadAuthoredEdges(
  slug: RouteSlug,
  root: string,
): { edges: readonly ExplicitEdge[]; issues: readonly AlignmentIssue[] } {
  const path = join(root, `content/alignments/${slug}.yaml`);
  if (!existsSync(path)) return { edges: [], issues: [] };
  try {
    const alignment = validateAlignment(parseYaml(readFileSync(path, "utf8")), path);
    return { edges: edgesFromAlignment(alignment), issues: [] };
  } catch (err: unknown) {
    return {
      edges: [],
      issues: [
        {
          code: "alignment-record-unreadable",
          message:
            `${path} is on disk and could not be loaded: ` +
            `${err instanceof Error ? err.message : String(err)}. ` +
            "This is not an absence of authored edges.",
        },
      ],
    };
  }
}

/**
 * The frozen manifest's ALIGNABLE unit ids, in manifest order. Empty when the paper has no manifest.
 *
 * Filtered, because C.1 requires every German unit in this set to carry an edge, and a manifest
 * holds units that are not alignment sources: a paragraph aligns through its sentences rather than
 * as itself, so passing every unit id reported each paragraph as `unaligned-source` -- 19 of them in
 * mass-energy alone, on an alignment that is in fact complete.
 */
function manifestUnitIds(slug: RouteSlug, root: string): readonly string[] {
  const path = join(root, `content/source-blocks/${slug}/manifest.yaml`);
  if (!existsSync(path)) return [];
  try {
    const manifest = parseYaml(readFileSync(path, "utf8")) as {
      units?: { id?: unknown }[] | undefined;
    };
    return Object.freeze(
      (manifest.units ?? [])
        .map((unit) => (typeof unit.id === "string" ? unit.id : ""))
        .filter((id): id is string => id !== "" && isPermanentGermanId(id)),
    );
  } catch {
    return [];
  }
}

/** Translation-unit ids, read from each record's own `id`, never from its filename. */
function translationUnitIds(slug: RouteSlug, root: string): readonly string[] {
  const dir = join(root, `content/translation-units/${slug}`);
  if (!existsSync(dir)) return [];
  const ids: string[] = [];
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith(".yaml")) continue;
    try {
      const record = parseYaml(readFileSync(join(dir, file), "utf8")) as {
        kind?: unknown;
        id?: unknown;
      } | null;
      if (record?.kind !== "translation-unit") continue;
      if (typeof record.id === "string" && record.id !== "") ids.push(record.id);
    } catch {
      // A single unreadable unit is reported by the translation validator that owns these records,
      // not re-reported here as an alignment issue about a different population.
    }
  }
  return Object.freeze(ids);
}

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

/**
 * What the run established, which is not the same as whether it found violations.
 *
 * `ok` answers "were there issues". For a paper with NO LEDGER there is nothing to align, so there
 * are no issues and ok was true - the runner reported success about a paper it could not judge,
 * while src/content/editions/editionContract.ts reported `not-available` for the same paper and the
 * report JSON this runner writes said "No ledger present. This is not completeness." Three layers,
 * one fact, and only two of them told the truth.
 *
 * `outcome` is the honest third state. The exit code is unchanged - an absent ledger is a known
 * state of this project, not a failure, and reddening a lane for it would be wrong.
 */
export type AlignEditionsOutcome = "passed" | "failed" | "not-available";

export type AlignEditionsResult = Readonly<{
  ok: boolean;
  outcome: AlignEditionsOutcome;
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

  // Explicitly supplied populations always win, so every existing caller and fixture is unchanged;
  // the loaders below only fill what nothing supplied, which until now was everything.
  if (edges.length === 0) {
    const loaded = loadAuthoredEdges(slug, root);
    edges = [...loaded.edges];
    issues.push(...loaded.issues);
  }
  if (germanIds.length === 0) {
    germanIds = [...manifestUnitIds(slug, root)];
  }
  if (germanIds.length === 0 && presence.presence !== "absent") {
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
  if (englishIds.length === 0) {
    englishIds = [...translationUnitIds(slug, root)];
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
      // A partial ledger is not a German edition that is present: this reports coverage, not
      // the existence of a file.
      germanEditionPresent: presence.presence === "complete",
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
    // An absent ledger means the run had nothing to align, so "no issues" is not a pass.
    outcome: presence.presence === "absent" ? "not-available" : ok ? "passed" : "failed",
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
