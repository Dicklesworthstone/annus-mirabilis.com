/**
 * Orchestrator for scripts/verify-content.ts (am-cm-audit-scripts-d34).
 * Rule 0 is not machine-checkable; the help text says so.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { listRegisteredChecks } from "../compiler/checks/registry.ts";
import { compileContent } from "../compiler/compile.ts";
import { loadSourceBlockIndex, sourceBlockCount } from "../compiler/sourceBlockIndex.ts";
import { applyCompilerDebts, DECLARED_COMPILER_DEBTS } from "./compilerDebts.ts";
import {
  compareCheckInventory,
  type InventoriedCheck,
  registerVerifyContentChecks,
} from "./inventory.ts";
import { auditPinnedAssets, type PinnedAsset } from "./pinnedAssets.ts";
import { type AuditFinding, type AuditReport, findingLine, populationLine } from "./types.ts";

export class PopulationFloorError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PopulationFloorError";
    this.code = code;
  }
}

/**
 * The three floors, as functions a test can drive.
 *
 * They were inline in the `loadFiles` config literal, which nothing can call, so the refusals had
 * no way to be exercised and the untested-refusal ratchet counted them as undeclared debt. A floor
 * that cannot be tested is a floor nobody has seen fire.
 */
export function assertJourneyPopulation(dirExists: boolean, recordCount: number): void {
  if (dirExists && recordCount === 0) {
    throw new PopulationFloorError(
      "journey-records-absent",
      "content/journeys exists and no .yaml record was read from it. Every epistemic rule keyed " +
        "on a journey would then run over an empty population and report clean. Restore the " +
        "records, or remove this refusal together with the directory (am-4k0m).",
    );
  }
}

/** The edition layer must be non-empty, and must carry the corpus's 200 printed equation blocks. */
export function assertEditionPopulation(recordCount: number, equationBlocks: number): void {
  if (recordCount === 0) {
    throw new PopulationFloorError(
      "edition-layer-absent",
      "content/source-blocks, content/translation-units and content/alignments yielded no " +
        "record. Seven structural checks, equation-identity and the hero-quote resolver would " +
        "then run over an empty population and report clean (am-rc1001-bridge-plan-pcjk.10).",
    );
  }
  if (equationBlocks < EQUATION_BLOCK_FLOOR) {
    throw new PopulationFloorError(
      "equation-population-below-floor",
      `Only ${equationBlocks} printed equation block(s) were read from content/source-blocks, ` +
        `and the corpus has ${EQUATION_BLOCK_FLOOR}. \`equation-not-identical\` would compare ` +
        "fewer pairs and still report no differences, which reads exactly like a clean result " +
        "(am-rc1001-bridge-plan-pcjk.10 step 2).",
    );
  }
}

/**
 * The printed displays the corpus holds, measured rather than chosen:
 * `content/display-terms/<paper>.yaml` gives 7 + 52 + 43 + 98.
 */
export const EQUATION_BLOCK_FLOOR = 200;

export const RULE_0_HELP =
  "Rule 0 (the user's override prerogative) is not machine-checkable and is not pretended to be.";

/**
 * Every audit `runVerifyContent` runs, in the order it runs them (am-4k0m).
 *
 * `journeys` is appended rather than inserted, so no line of existing output moves. The list is both
 * the loop's iteration order and the source of the options type's key set; see `audits` below.
 */
export const AUDIT_ORDER = [
  "readings",
  "shelf",
  "misconceptions",
  "instruments",
  "journeys",
] as const;

export type AuditName = (typeof AUDIT_ORDER)[number];

export type ContentFile = Readonly<{ path: string; text: string }>;

export type VerifyContentOptions = Readonly<{
  root: string;
  baseRef?: string;
  requireLocal?: boolean;
  architecture: () => number;
  loadFiles: () => Promise<readonly ContentFile[]>;
  revisionCheck?: (baseRef: string) => Promise<boolean | "skipped">;
  inventory: readonly InventoriedCheck[];
  pinnedAssets?: readonly PinnedAsset[];
  extraReports?: readonly AuditReport[];
  dimensionAudit?: () => Promise<AuditReport>;
  /**
   * The registered audits, keyed by `AUDIT_ORDER`.
   *
   * The key set is DERIVED from the order list rather than written out beside it, so an audit cannot be
   * added to one and forgotten in the other. Before this it was four hand-written optional fields and
   * four hand-written nine-line blocks: a fifth audit added to the type without a matching block would
   * have type-checked, run nothing, and reported a clean gate. One list makes that unrepresentable
   * instead of merely tested for.
   */
  audits?: Partial<Record<AuditName, () => Promise<AuditReport>>>;
}>;

export type VerifyContentResult = Readonly<{
  ok: boolean;
  exitCode: number;
  errors: readonly string[];
  flags: readonly string[];
  skipped: readonly string[];
  findings: readonly AuditFinding[];
  /**
   * One line per audit that declares how much of its subject it judged. An audit reporting "0
   * errors" says nothing about how many records it looked at; these say it out loud, in the same
   * form the licence inventory uses for "72 of 79".
   */
  populations: readonly string[];
  /**
   * How many content records the compiler was handed, which is the denominator every count above
   * rests on (am-rc1001-bridge-plan-pcjk.9). A run over six records would report "0 errors" and read
   * exactly like a clean corpus.
   */
  recordsCompiled: number;
}>;

export function parseInventoryFile(text: string): readonly InventoriedCheck[] {
  const parsed = JSON.parse(text) as { checks?: InventoriedCheck[] };
  if (!Array.isArray(parsed.checks)) {
    throw new Error("verify-content.checks.json must have a checks array.");
  }
  return parsed.checks;
}

export async function runVerifyContent(
  options: VerifyContentOptions,
): Promise<VerifyContentResult> {
  const errors: string[] = [];
  const flags: string[] = [];
  const skipped: string[] = [];
  const findings: AuditFinding[] = [];
  const populations: string[] = [];

  // 1. Architecture gate
  if (options.architecture() !== 0) {
    errors.push("architecture-gate: App Router / root-file allowlist failed.");
  }

  // 2. Content compiler with registered checks + check inventory
  registerVerifyContentChecks();
  const files = await options.loadFiles();
  // THE SOURCE BLOCKS THE STRUCTURAL PASS RESOLVES AGAINST (am-as1w). They travel as an option
  // rather than as records: compiling the 456 block files as ordinary records adds 70 duplicate-id
  // errors, because an equation-id rule treats ids as global while these are per-paper by design,
  // and 115 of the basenames are shared between papers. See compiler/sourceBlockIndex.ts.
  const sourceBlockIndex = loadSourceBlockIndex(options.root);
  console.log(
    `[verify-content] ${sourceBlockCount(sourceBlockIndex)} source blocks in ` +
      `${sourceBlockIndex.size} papers supplied to the structural pass, so an editorial note's ` +
      `affectedIds can be resolved rather than declined.`,
  );
  const compiled = await compileContent(files, { sourceBlockIndex });
  // THE TWO CLASSES RECORDED AS DEBTS, SO THE EXPERIMENT POPULATION CAN BE ALL 33 (am-1nnj).
  // compilerDebts.ts has the reasoning and the measurement. The census lines go into
  // `populations` rather than being printed here, because that is where every other "how much did
  // you examine" line in this result already lives, and a ceiling nobody prints is a ceiling
  // nobody lowers.
  const experimentsCompiled = files.filter((file) => file.path.startsWith("experiments/")).length;
  const debts = applyCompilerDebts(
    compiled.diagnostics,
    DECLARED_COMPILER_DEBTS,
    experimentsCompiled,
  );
  populations.push(...debts.census);
  errors.push(...debts.errors);
  for (const diagnostic of debts.diagnostics) {
    // The RECORD, then where in it, then what is wrong (am-9755). This line read
    // `code: path: message` until 2026-09-27, which for a voice violation printed
    // "overclaim: whatIsTrue.r0: Voice violation [overclaim]: ..." and named no record at all.
    // Four such failures had been standing on HEAD, over a corpus of 26 misconception ledgers, and
    // nobody could act on them because nobody could tell which ledger. The Diagnostic already
    // carried recordId and file; only this line dropped them.
    const where = [diagnostic.recordId, diagnostic.file].filter(
      (part): part is string => typeof part === "string" && part.length > 0,
    );
    const at = where.length > 0 ? `${where.join(" (")}${where.length > 1 ? ")" : ""}: ` : "";
    const owner = diagnostic.beadId ? ` (${diagnostic.beadId})` : "";
    const line = `${diagnostic.code}: ${at}${diagnostic.path}: ${diagnostic.message}${owner}`;
    if (diagnostic.severity === "error") errors.push(line);
    else flags.push(line);
  }

  const inventoryFindings = compareCheckInventory(options.inventory, listRegisteredChecks());
  findings.push(...inventoryFindings);
  for (const finding of inventoryFindings) {
    if (finding.severity === "error") errors.push(findingLine(finding));
    else flags.push(findingLine(finding));
  }

  // 3. audit-dimensions.ts
  if (options.dimensionAudit) {
    const dimReport = await options.dimensionAudit();
    findings.push(...dimReport.findings);
    for (const finding of dimReport.findings) {
      if (finding.severity === "error") errors.push(findingLine(finding));
      else flags.push(findingLine(finding));
    }
  }

  // 4. The registered audits, in a fixed order.
  //
  // This was four copies of the same nine lines, one per audit, and adding a fifth meant writing a
  // fifth copy -- which is exactly the shape AGENTS.md warns about where two statements of one rule
  // drift apart. The order below is the order those blocks ran in, with `journeys` appended, so no
  // existing line of output moves. An audit absent from `options.audits` is skipped as before.
  for (const name of AUDIT_ORDER) {
    const run = options.audits?.[name];
    if (!run) continue;
    const report = await run();
    findings.push(...report.findings);
    const line = populationLine(report);
    if (line !== null) populations.push(line);
    for (const finding of report.findings) {
      if (finding.severity === "error") errors.push(findingLine(finding));
      else flags.push(findingLine(finding));
    }
  }

  // 5. check-revisions.ts
  if (options.baseRef) {
    const revision = options.revisionCheck
      ? await options.revisionCheck(options.baseRef)
      : "skipped";
    if (revision === "skipped") skipped.push("revision-check-skipped");
    else if (revision === false) errors.push("revision-check: content revision identities failed.");
  } else {
    skipped.push("revision-check-skipped");
  }

  // 6. Pinned-asset check
  if (options.pinnedAssets) {
    const pinned = auditPinnedAssets(
      options.pinnedAssets,
      options.requireLocal === undefined ? {} : { requireLocal: options.requireLocal },
    );
    findings.push(...pinned.findings);
    for (const finding of pinned.findings) {
      if (finding.severity === "error") errors.push(findingLine(finding));
      else flags.push(findingLine(finding));
    }
  }

  for (const report of options.extraReports ?? []) {
    findings.push(...report.findings);
    {
      const line = populationLine(report);
      if (line !== null) populations.push(line);
    }
    for (const finding of report.findings) {
      if (finding.severity === "error") errors.push(findingLine(finding));
      else flags.push(findingLine(finding));
    }
    // A report that judged nothing has not passed (am-1hst), even with no finding to say so.
    if (!report.ok && !report.findings.some((finding) => finding.severity === "error"))
      errors.push(`${report.audit}: not ok, with no error finding; it judged no records.`);
  }

  return Object.freeze({
    ok: errors.length === 0,
    exitCode: errors.length === 0 ? 0 : 1,
    errors,
    flags,
    skipped,
    findings,
    populations,
    recordsCompiled: files.length,
  });
}

export function loadCommittedInventory(root: string): readonly InventoriedCheck[] {
  const path = resolve(root, "scripts/verify-content.checks.json");
  return parseInventoryFile(readFileSync(path, "utf8"));
}
