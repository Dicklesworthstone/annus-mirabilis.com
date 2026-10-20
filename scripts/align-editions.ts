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
  type ExplicitEdge,
  edgesFromAlignment,
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
  loadAuthoredEdges,
  loadGlossInput,
  manifestUnitIds,
  translationUnitIds,
} from "../src/content/editions/authoredInputs.ts";
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
import { validateAlignment } from "../src/content/schemas/source.ts";

registerEditionReviewState();

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

/**
 * What each of rules C.1 to C.8 actually looked at on this run.
 *
 * AGENTS.md: "A Tool's Exit Code Is Not Evidence Until You Know What It Examined", and this
 * runner was the case in point. Until 2026-10-19 it printed `"outcome": "passed"` with
 * `"issues": []` while five of the eight rules had examined nothing at all, because
 * `components`, `terms`, `glossInput` and `reviewUnits` are supplied by the caller and the CLI
 * entry point passes only slug, layers, sections, requireReviewed and report. The gloss half is
 * now loaded from disk; the other three are not, and a `0` here is how a reader can tell. A pass
 * on a rule whose population is 0 establishes nothing, and nothing in `ok: true` says so.
 */
export type AlignEditionsExamined = Readonly<{
  /** C.1, C.2: alignment edges, German alignable ids, English unit ids. */
  edges: number;
  germanIds: number;
  englishIds: number;
  /** C.4: alignment components whose inline atoms were compared. */
  components: number;
  /** C.5: term occurrences whose definitions were checked. */
  terms: number;
  /** C.6: gloss units validated against their alignable unit. */
  glossUnits: number;
  /** C.7, C.8: units whose review state and derived status were judged. */
  reviewUnits: number;
}>;

export type AlignEditionsResult = Readonly<{
  ok: boolean;
  outcome: AlignEditionsOutcome;
  exitCode: number;
  slug: RouteSlug;
  layers: readonly string[];
  examined: AlignEditionsExamined;
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

  // ABSENT AND EMPTY ARE DIFFERENT, and keying on length confused them. A caller that passes
  // `edges: []` is stating a population -- that is how the runner's own guard test drives
  // `empty-alignment` with alignables present -- so filling it from disk would answer a question
  // nobody asked and silently delete that test's subject. The loaders fill only what was never
  // supplied, which until now was every one of the three.
  if (options.edges === undefined) {
    const loaded = loadAuthoredEdges(slug, root);
    edges = [...loaded.edges];
    issues.push(...loaded.issues);
  }
  if (options.germanIds === undefined && germanIds.length === 0) {
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
  if (options.englishIds === undefined) {
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

  /*
   * 2. Alignment validations (rules C.1 and C.2)
   *
   * THESE ATTRIBUTIONS WERE WRONG AND THE ERROR COST A P0 CRITERION ITS VERDICT. This read
   * "(rules C.1, C.4)" and the section below read "(rule C.3)", which is how a careful audit on
   * 2026-10-10 concluded that "C.2 is defined in no file" and that the criterion
   * "align-editions.ts enforces rules C.1-C.8" was unfalsifiable. C.2 has been defined since
   * 2026-09-18, with its own docblock, at the function this section calls:
   *
   *   C.1  alignment.ts:86   Coverage & Edges          validateManyToManyAlignment  (below)
   *   C.2  alignment.ts:198  Edges and splits          validateAlignmentSplits      (below)
   *   C.3  alignment.ts:252  Display equation byte identity  -- NOT called here; it is the
   *                          edition contract's `display-math-byte-identity` check, owned by
   *                          am-cm-checks-structural-lq0
   *   C.4  alignment.ts:292  Inline mathematics, references, and footnote marks  (section 3)
   *   C.5  alignment.ts:395  Terms                     validateTerms                (section 4)
   *   C.6  alignment.ts:452  Glosses                   validateGloss                (section 5)
   *   C.7  alignment.ts:560  Review states             validateReviewStates         (section 6)
   *   C.8  alignment.ts:629  Derived statuses          validateDerivedStatus        (section 7)
   *
   * So every rule IS implemented and `alignment.ts:4` says so ("Implements rules C.1 through
   * C.8"); two comments here named the wrong numbers, and a mislabelled comment is
   * indistinguishable from a missing implementation to anyone auditing by grep.
   */
  if (edges.length > 0 || germanIds.length > 0 || englishIds.length > 0) {
    const alignIssues = validateManyToManyAlignment({ edges, germanIds, englishIds });
    issues.push(...alignIssues);
  }

  if (englishIds.length > 0) {
    const splitIssues = validateAlignmentSplits(englishIds);
    issues.push(...splitIssues);
  }

  // 3. Inline mathematics, references, and footnote marks (rule C.4, whose docblock at
  //    alignment.ts:292 carries exactly this title). Previously miscredited to C.3.
  if (options.components && options.components.length > 0) {
    const mathIssues = validateInlineMathematics(options.components);
    issues.push(...mathIssues);
  }

  // 4. Terminology validation (rule C.5)
  if (options.terms && options.terms.length > 0) {
    const termIssues = validateTerms(options.terms);
    issues.push(...termIssues);
  }

  /*
   * 5. Gloss validation (rule C.6)
   *
   * LOADED FROM DISK WHEN THE CALLER SUPPLIED NOTHING, for the reason authoredInputs.ts already
   * gives about edges and ids: a validator reading an argument nothing passes cannot fail, and
   * cannot pass either. Measured 2026-10-19 before this line existed, `--layers
   * german,translation,gloss` reported `"outcome": "passed"` for all four papers and wrote a
   * coverage report whose gloss row read `absent | 0`, while 542 authored gloss units sat in
   * content/gloss-units/. The flag was accepted and nothing ran.
   *
   * `undefined` and an explicitly empty input stay different, exactly as they do for edges: a
   * caller that passes `{glossUnits: [], alignableUnits: []}` is naming a population, and filling
   * it from disk would answer a question nobody asked.
   */
  let glossUnitsExamined = 0;
  let glossInput = options.glossInput;
  if (glossInput === undefined && layers.includes("gloss")) {
    const loaded = loadGlossInput(slug, root);
    glossInput = loaded.glossInput;
    issues.push(...loaded.issues);
  }
  if (glossInput) {
    glossUnitsExamined = glossInput.glossUnits.length;
    const glossIssues = validateGloss(glossInput);
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
      glossUnitCount: glossUnitsExamined,
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
    examined: Object.freeze({
      edges: edges.length,
      germanIds: germanIds.length,
      englishIds: englishIds.length,
      components: options.components?.length ?? 0,
      terms: options.terms?.length ?? 0,
      glossUnits: glossUnitsExamined,
      reviewUnits: options.reviewUnits?.length ?? 0,
    }),
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
