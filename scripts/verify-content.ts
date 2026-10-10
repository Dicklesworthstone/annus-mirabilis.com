#!/usr/bin/env bun
/**
 * Content gate (am-cm-audit-scripts-d34): architecture, compiler checks,
 * registered-check inventory, revision check, pinned assets.
 *
 * Rule 0 (the user's override prerogative) is not machine-checkable and is
 * not pretended to be.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { auditEquationIdentity } from "../src/content/audits/equationIdentity.ts";
import { type AuditExemption, applyAuditExemptions } from "../src/content/audits/exemptions.ts";
import { auditInstruments, loadLiveInstrumentRows } from "../src/content/audits/instruments.ts";
import {
  auditMisconceptions,
  loadLiveMisconceptionInput,
} from "../src/content/audits/misconceptions.ts";
import {
  auditReadings,
  type ReadingSet,
  type ReadingsAuditInput,
  type ReadingsOwnerEntry,
  type ReadingTarget,
  type ReadingTargetKind,
} from "../src/content/audits/readings.ts";
import { auditLiveShelves } from "../src/content/audits/shelfLive.ts";
import { type AuditFinding, summarize } from "../src/content/audits/types.ts";
import {
  loadCommittedInventory,
  RULE_0_HELP,
  runVerifyContent,
} from "../src/content/audits/verifyContent.ts";
import { auditKernelBindings } from "../src/content/kernel/audit.ts";
import { SLICE_KERNEL_CATALOG } from "../src/content/kernel/catalog.ts";
import { loadProvenanceReceipts } from "../src/content/provenance/loadReceipts.ts";
import { checkJourney } from "../src/discovery/checks/journeyChecks.ts";
import { REAL_JOURNEYS } from "../src/discovery/journeys/realJourneys.ts";
import { SHELF_CARD_CONTEXT } from "../src/discovery/journeys/shelves.ts";
import { TestLogger } from "../src/testing/log/logger.ts";
import { runArchitectureGateCli } from "./app-router-architecture.ts";
import { mainAuditDimensions } from "./audit-dimensions.ts";
import { loadReadingFiles } from "./build-content.ts";
import { runRevisionCheck } from "./check-revisions.ts";
import { reportPopulation } from "./gate-census/population.ts";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

function printHelp(): void {
  console.log(`Usage: bun scripts/verify-content.ts [--base <ref>] [--require-local] [--all-instruments] [--help]

Runs the architecture gate, the content compiler with every registered check,
audit-dimensions, the four content audits (readings, shelf, misconceptions, instruments),
check-revisions (skipped when no --base and no git base ref exist), and pinned-asset presence.

${RULE_0_HELP}

The standalone voice-lint quality-gate step is folded into this command as
the registered check family "voice".

--all-instruments is accepted and does nothing: every manifest under
content/experiments is compiled on every run since 2026-10-09, which is what the
live-term half of the kernel-binding check runs over. The flag is kept so a command
recorded in am-1nnj's history still runs. The two classes that kept the full
population from landing green are recorded as debts in
src/content/audits/compilerDebts.ts with their owning beads (am-1nnj).
`);
}

function parseArgs(argv: string[]): {
  help: boolean;
  baseRef?: string;
  requireLocal: boolean;
  skipArchitecture: boolean;
  allInstruments: boolean;
} {
  let help = false;
  let baseRef: string | undefined;
  let requireLocal = false;
  let skipArchitecture = false;
  let allInstruments = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") help = true;
    else if (arg === "--require-local") requireLocal = true;
    else if (arg === "--skip-architecture") skipArchitecture = true;
    else if (arg === "--all-instruments") allInstruments = true;
    else if (arg === "--base" && argv[i + 1]) {
      baseRef = argv[i + 1];
      i += 1;
    }
  }
  return {
    help,
    requireLocal,
    skipArchitecture,
    allInstruments,
    ...(baseRef !== undefined ? { baseRef } : {}),
  };
}

function gitBaseRef(): string | undefined {
  try {
    const ref = execFileSync("git", ["rev-parse", "--verify", "origin/main"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return ref.length > 0 ? "origin/main" : undefined;
  } catch {
    return undefined;
  }
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const provenanceDir = resolve(root, "docs/provenance");
const configDir = existsSync(resolve(root, "scripts/sources/facsimile-sources"))
  ? resolve(root, "scripts/sources/facsimile-sources")
  : undefined;
const provenance = loadProvenanceReceipts({
  provenanceDir,
  configDir,
  rootDir: root,
  requireLocal: args.requireLocal,
});

/**
 * am-unwired-audits-uwot. The readings and instruments audits used to run over ONE item each:
 * one owner file of 24, one manifest of 38. Nothing recorded that restriction as intentional and
 * nothing failed when the population grew, so a new unaudited owner or instrument was invisible.
 *
 * They now run over the whole population. Items that cannot pass yet are recorded here with a
 * reason, and an entry EXPIRES: if a listed item stops producing findings, the audit raises a
 * stale-audit-exemption error naming it, so the entry has to be deleted rather than left behind.
 * Same shape as EXPECTED_UNREACHABLE in src/testing/scriptReachability.test.ts.
 */
const READINGS_OWNERS_NOT_YET_AUDITABLE: ReadonlyMap<string, string> = new Map([]);

/**
 * Journey findings recorded as not yet auditable, keyed by `<paper>/<rule>`.
 *
 * EMPTY, AND THE MECHANISM IS WHY. It held one entry,
 * `brownian-motion/missing-constraint-ref`, whose reason named its own deletion condition: delete
 * when the shelf card exists "or the owner rules on the outcome type (am-4k0m)". The owner-directed
 * session ruled on the outcome type -- the Exner branch became `correct-but-weaker`, because
 * nothing refuted Exner and AGENTS.md requires a failed alternative to fail on a stated constraint
 * or observation -- and the finding stopped being reported. The entry was not deleted with it, so
 * `applyAuditExemptions` raised `stale-audit-exemption` and verify-content was RED from that
 * repair until this commit. That is the mechanism working exactly as its docblock promises: an
 * exemption cannot outlive its repair in silence, and the cost of leaving one behind is a red
 * central lane rather than a quiet over-permission.
 *
 * Kept as an empty map rather than removed, so the code reading it asserts zero instead of
 * disappearing -- the same reason DECLARED_ERRORS is kept empty in the journey tests.
 */
const JOURNEY_FINDINGS_NOT_YET_AUDITABLE: ReadonlyMap<string, string> = new Map([]);

const INSTRUMENTS_NOT_YET_AUDITABLE: ReadonlyMap<string, AuditExemption> = new Map([
  [
    "avogadro-lab",
    {
      reason:
        "Unbuilt or incomplete at 2026-09-19; the full-catalogue audit reported 7 finding(s) against it when re-measured on 2026-10-09. Delete this entry when the instrument lands (am-unwired-audits-uwot).",
      findings: 7,
    },
  ],
  [
    "light-thread",
    {
      reason:
        "Unbuilt or incomplete at 2026-09-19; the full-catalogue audit reported 6 finding(s) against it when re-measured on 2026-10-09. Delete this entry when the instrument lands (am-unwired-audits-uwot).",
      findings: 6,
    },
  ],
  [
    "lq-09",
    {
      reason:
        "Unbuilt or incomplete at 2026-09-19; the full-catalogue audit reported 1 finding(s) against it when re-measured on 2026-10-09. Delete this entry when the instrument lands (am-unwired-audits-uwot).",
      findings: 1,
    },
  ],
  [
    "me-01",
    {
      reason:
        "Unbuilt or incomplete at 2026-09-19; the full-catalogue audit reported 1 finding(s) against it when re-measured on 2026-10-09. Delete this entry when the instrument lands (am-unwired-audits-uwot).",
      findings: 1,
    },
  ],
  [
    "me-03",
    {
      reason:
        "Unbuilt or incomplete at 2026-09-19; the full-catalogue audit reported 1 finding(s) against it when re-measured on 2026-10-09. Delete this entry when the instrument lands (am-unwired-audits-uwot).",
      findings: 1,
    },
  ],
  [
    "shelf-fizeau",
    {
      reason:
        "Unbuilt or incomplete at 2026-09-19; the full-catalogue audit reported 6 finding(s) against it when re-measured on 2026-10-09. Delete this entry when the instrument lands (am-unwired-audits-uwot).",
      findings: 6,
    },
  ],
  [
    "shelf-maxwell-galilean",
    {
      reason:
        "Unbuilt or incomplete at 2026-09-19; the full-catalogue audit reported 6 finding(s) against it when re-measured on 2026-10-09. Delete this entry when the instrument lands (am-unwired-audits-uwot).",
      findings: 6,
    },
  ],
  [
    "shelf-michelson-morley",
    {
      reason:
        "Unbuilt or incomplete at 2026-09-19; the full-catalogue audit reported 6 finding(s) against it when re-measured on 2026-10-09. Delete this entry when the instrument lands (am-unwired-audits-uwot).",
      findings: 6,
    },
  ],
  [
    "sr-01",
    {
      reason:
        "Unbuilt or incomplete at 2026-09-19; the full-catalogue audit reported 1 finding(s) against it when re-measured on 2026-10-09. Delete this entry when the instrument lands (am-unwired-audits-uwot).",
      findings: 1,
    },
  ],
  [
    "sr-04",
    {
      reason:
        "Unbuilt or incomplete at 2026-09-19; the full-catalogue audit reported 1 finding(s) against it when re-measured on 2026-10-09. Delete this entry when the instrument lands (am-unwired-audits-uwot).",
      findings: 1,
    },
  ],
]);

function loadLiveReadingsAuditInput(
  rootDir: string,
  options?: { ownerBeadIds?: readonly string[] },
): ReadingsAuditInput {
  const ownersDir = resolve(rootDir, "content/editorial/readings-owners");
  const owners: ReadingsOwnerEntry[] = [];
  const targets: ReadingTarget[] = [];
  if (existsSync(ownersDir)) {
    for (const name of readdirSync(ownersDir)) {
      if (!name.endsWith(".yaml")) continue;
      const beadId = name.replace(".yaml", "");
      if (options?.ownerBeadIds && !options.ownerBeadIds.includes(beadId)) continue;
      try {
        const parsed = yaml.load(readFileSync(resolve(ownersDir, name), "utf8")) as Record<
          string,
          unknown
        > | null;
        const ownerBeadId = String(
          parsed?.ownerBeadId ?? parsed?.beadId ?? name.replace(".yaml", ""),
        );
        const targetIds: string[] = [];
        const targetKinds: ReadingTargetKind[] = [];
        if (Array.isArray(parsed?.targets)) {
          for (const rawTarget of parsed.targets) {
            const t = rawTarget as Record<string, unknown>;
            const kind: ReadingTargetKind =
              t.kind === "caption" || t.captions
                ? "instrument-caption"
                : ((t.kind as ReadingTargetKind) ?? "paragraph");
            const id =
              (t.id as string | undefined) ??
              (t.instrument ? `caption-${String(t.instrument)}` : undefined);
            if (id) {
              targetIds.push(id);
              if (!targetKinds.includes(kind)) targetKinds.push(kind);
              if (t.readings) {
                targets.push({
                  targetId: id,
                  targetKind: kind,
                  paper: String(parsed.paper ?? "brownian-motion"),
                  readings: t.readings as ReadingSet,
                  ...(Array.isArray(t.scopeCritical)
                    ? { scopeCritical: t.scopeCritical.map(String) }
                    : {}),
                });
              }
            }
          }
        }
        owners.push({
          ownerBeadId,
          fileName: name,
          paper: String(parsed?.paper ?? "brownian-motion"),
          targetKinds: targetKinds.length > 0 ? targetKinds : ["paragraph"],
          targetIds,
        });
      } catch {
        // Ignore unparseable
      }
    }
  }
  return { targets, owners };
}

/**
 * How many identifier bindings each source carries, and how many both carry (am-1nnj, dispatch 358).
 *
 * This is a REPORT, not a gate. It exists because a binding is written twice, in a manifest's
 * `owner.identifierBindings` and in SLICE_KERNEL_CATALOG, and the second is the one verify.ts turns
 * into src/generated/kernel-listings.json and therefore the one that colours a symbol for a reader.
 * The two drift, in both directions, and a single total would hide that.
 */
function bindingSourceSplit(files: readonly { path: string; text: string }[]): {
  manifestOnly: number;
  both: number;
  catalogueOnly: number;
} {
  const key = (instrumentId: string, b: { kernelFunction: string; quantityId: string }) =>
    `${instrumentId}|${b.kernelFunction}|${b.quantityId}`;
  const manifest = new Set<string>();
  for (const file of files) {
    const doc = yaml.load(file.text) as {
      id?: string;
      owner?: { identifierBindings?: readonly { kernelFunction: string; quantityId: string }[] };
    };
    const id = doc?.id ?? file.path.replace(/^experiments\/|\.yaml$/g, "");
    for (const b of doc?.owner?.identifierBindings ?? []) manifest.add(key(id, b));
  }
  // The catalogue side is scoped to the instruments actually compiled. Comparing three manifests
  // against all thirty-three catalogue entries reported "329 catalogue only", which is true of the
  // catalogue and says nothing about the population this run examined.
  const compiled = new Set(files.map((f) => f.path.replace(/^experiments\/|\.yaml$/g, "")));
  const catalogue = new Set<string>();
  for (const entry of SLICE_KERNEL_CATALOG) {
    if (!compiled.has(entry.instrumentId)) continue;
    for (const b of entry.identifierBindings) catalogue.add(key(entry.instrumentId, b));
  }
  let both = 0;
  for (const k of manifest) if (catalogue.has(k)) both += 1;
  return { manifestOnly: manifest.size - both, both, catalogueOnly: catalogue.size - both };
}

const baseRef = args.baseRef ?? gitBaseRef();
const equationIdentity = auditEquationIdentity(root);
console.log(
  `[audit-equation-identity] examined ${equationIdentity.blocks} equation blocks, ${equationIdentity.units} aligned English units: ${equationIdentity.report.errorCount} errors`,
);
const result = await runVerifyContent({
  root,
  ...(baseRef !== undefined ? { baseRef } : {}),
  requireLocal: args.requireLocal,
  architecture: () => (args.skipArchitecture ? 0 : runArchitectureGateCli(root)),
  loadFiles: async () => {
    const readingFiles = await loadReadingFiles(root);
    const experimentFiles: { path: string; text: string }[] = [];
    // WHICH MANIFESTS THE COMPILER'S CHECKS SEE: ALL OF THEM, SINCE 2026-10-09 (am-1nnj).
    //
    // loadReadingFiles skips every .yaml, so it contributes NO experiment manifests and this loop
    // is the whole population of instruments the compiler's checks ever see. It was bm-01, bm-05
    // and bm-06 for eleven days, which meant runKernelIdentifierCheck's live-term assertion was
    // silent on the other thirty, and a 0 from a check that opened three records reads exactly
    // like a 0 from one that opened thirty-three.
    //
    // WHY IT COULD NOT FLIP BEFORE, AND WHAT CHANGED. Widening turned the gate red for every pane
    // on findings belonging to other beads, and the standing instruction is that the widening
    // lands only when the count is zero. The count could never reach zero here: measured over all
    // 33 on 2026-10-09, the 71 errors are exactly two classes, 49 live-term-unbound and 22
    // dangling-independent-reference, and BOTH are owned elsewhere (am-inst-show-the-code-4brv and
    // am-ver-quantity-records-fby2, the latter blocked on a content/verification/ layer that does
    // not exist). The three classes that are this bead's own are all at zero on the full
    // population. So the two are recorded as debts with ceilings and named record sets in
    // src/content/audits/compilerDebts.ts, the unaccounted count IS zero, and the widening lands
    // green while every other class is now live on all 33. A finding in a record the debt does not
    // name is red even under the ceiling, which is what stops this being a per-rule quota.
    //
    // --all-instruments is still accepted and is now a no-op, so a human repeating the command
    // from this bead's history gets the same answer rather than an unknown-flag refusal.
    //
    // THE CENSUS BELOW IS REPORTED, NOT ASSERTED. A binding is written in two places, the manifest
    // and SLICE_KERNEL_CATALOG, and the second is what colours a symbol for a reader. The live-term
    // check reads the union of both (src/content/kernel/check.ts), so the split is printed here to
    // keep the drift visible rather than resolved into one total nobody can decompose.
    const onDisk = readdirSync(resolve(root, "content/experiments"))
      .filter((f) => f.endsWith(".yaml"))
      .sort();
    const chosen = onDisk;
    for (const file of chosen) {
      const full = resolve(root, "content/experiments", file);
      if (!existsSync(full)) continue;
      experimentFiles.push({ path: `experiments/${file}`, text: readFileSync(full, "utf8") });
    }
    const split = bindingSourceSplit(experimentFiles);
    console.log(
      `[verify-content] ${experimentFiles.length} of ${onDisk.length} experiment manifests ` +
        `compiled, so the live-term check is silent on ${onDisk.length - experimentFiles.length} ` +
        `instruments (am-1nnj; two classes are recorded debts, see the compiler-debt census)`,
    );
    console.log(
      `[verify-content] identifier bindings by source over those ${experimentFiles.length}: ` +
        `${split.manifestOnly} manifest only, ${split.both} in both, ${split.catalogueOnly} ` +
        `catalogue only; the live-term check reads the union`,
    );
    // THE FOUR JOURNEY RECORDS, which nothing loaded until now (am-4k0m). content/journeys/ has
    // held them since 2026-10-09 and `loadReadingFiles` skips every .yaml, so the compiler never
    // saw them and every epistemic rule keyed on a journey ran over an empty population. The
    // world check said so in its own census rather than printing a quiet 0, which is the only
    // reason this was findable. The count is printed for the same reason every other population
    // here is.
    const journeyDir = resolve(root, "content/journeys");
    const journeyFiles: { path: string; text: string }[] = [];
    if (existsSync(journeyDir)) {
      for (const file of readdirSync(journeyDir)
        .filter((f) => f.endsWith(".yaml"))
        .sort()) {
        journeyFiles.push({
          path: `journeys/${file}`,
          text: readFileSync(resolve(journeyDir, file), "utf8"),
        });
      }
    }
    console.log(
      `[verify-content] ${journeyFiles.length} journey record(s) compiled from content/journeys ` +
        `(${journeyFiles.map((f) => f.path.replace(/^journeys\/|\.yaml$/g, "")).join(", ") || "none"})`,
    );
    // THE FLOOR BELONGS HERE, where the population is known. The epistemic world check runs over
    // whatever corpus its caller supplies, so a fixture run with no journeys is a legitimate zero
    // and that check can only log. In THIS run the directory exists and holds four records, so a
    // zero means the directory was emptied or the read broke, and a silent zero would make every
    // journey rule read as clean over nothing -- which is the state this wiring repaired (am-4k0m).
    if (existsSync(journeyDir) && journeyFiles.length === 0) {
      throw new Error(
        "content/journeys exists and no .yaml record was read from it. Every epistemic rule keyed " +
          "on a journey would then run over an empty population and report clean. Restore the " +
          "records, or remove this refusal together with the directory (am-4k0m).",
      );
    }
    // THE EDITION LAYER: 453 source blocks, 821 translation units, 4 alignments
    // (am-rc1001-bridge-plan-pcjk.10).
    //
    // None of it had ever reached the compiler, because `loadReadingFiles` skips every `.yaml`.
    // Seven structural branches, the equation-identity check and the hero-quote resolver all ran
    // over an empty population in consequence, and each reported clean.
    //
    // THE THREE FAMILIES GO IN TOGETHER, and that is not tidiness. Measured 2026-10-10, feeding
    // the blocks ALONE is RED: 542 `broken-alignment` errors, one per declared sentence span,
    // every one of them false -- all 542 spans are referenced by an alignment edge, and the check
    // simply could not see the alignment records. Feeding one half of a relation makes the
    // relation look broken.
    //
    // WHAT IS DELIBERATELY LEFT OUT, with the reason:
    //   manifest.yaml         route 12 owns it, and the manifests have their own validation
    //                         (validateSourceManifest, unitCoverage.test.ts,
    //                         source-manifest-report.ts). Feeding them adds 31 `sequence-gap`
    //                         errors from an empty alias context, and adding the four
    //                         content/aliases files changes that count by ZERO, so the validator
    //                         is not reading the aliases it is handed. That is its own bead.
    //   ledger-allowlist.yaml no route owns it; src/content/ledger/validateLedger.ts reads it
    //                         directly, and route 14 excludes it by name.
    const editionFiles: { path: string; text: string }[] = [];
    const editionCounts: string[] = [];
    for (const [dir, label, skip] of [
      ["content/source-blocks", "source-blocks", ["ledger-allowlist.yaml"]],
      ["content/translation-units", "translation-units", []],
    ] as const) {
      const base = resolve(root, dir);
      if (!existsSync(base)) continue;
      let n = 0;
      for (const paper of readdirSync(base).sort()) {
        const paperDir = resolve(base, paper);
        if (!existsSync(paperDir) || !statSync(paperDir).isDirectory()) continue;
        for (const file of readdirSync(paperDir).sort()) {
          if (!file.endsWith(".yaml") || (skip as readonly string[]).includes(file)) continue;
          editionFiles.push({
            path: `${label}/${paper}/${file}`,
            text: readFileSync(resolve(paperDir, file), "utf8"),
          });
          n += 1;
        }
      }
      editionCounts.push(`${label} ${n}`);
    }
    for (const [dir, label] of [
      ["content/alignments", "alignments"],
      ["content/aliases", "aliases"],
    ] as const) {
      const base = resolve(root, dir);
      if (!existsSync(base)) continue;
      let n = 0;
      for (const file of readdirSync(base).sort()) {
        if (!file.endsWith(".yaml")) continue;
        editionFiles.push({
          path: `${label}/${file}`,
          text: readFileSync(resolve(base, file), "utf8"),
        });
        n += 1;
      }
      editionCounts.push(`${label} ${n}`);
    }
    console.log(`[verify-content] edition layer compiled: ${editionCounts.join(", ")}`);
    // THE FLOORS, HERE RATHER THAN IN THE CHECKS, because this is where the population is known.
    // A check runs over whatever corpus its caller supplies, so a fixture corpus with two blocks
    // is a legitimate two and the check can only report its count. This caller knows the corpus is
    // the whole edition, so a shortfall here is a wiring fault.
    //
    // The equation floor is the one am-rc1001-bridge-plan-pcjk.10 step 2 asks for ("fail under a
    // minimum of 200"). 200 is the measured population of printed displays -- `content/
    // display-terms/<paper>.yaml` gives 7 + 52 + 43 + 98 -- and the count below is the German side
    // of what `equation-not-identical` compares. Half a glob would otherwise leave that check
    // comparing fewer pairs and still reporting no differences.
    const equationBlocks = editionFiles.filter(
      (f) => f.path.startsWith("source-blocks/") && /\/eq-[^/]+\.yaml$/.test(f.path),
    ).length;
    console.log(
      `[census] edition-layer floor examined ${editionFiles.length} edition record(s) ` +
        `(minimum 1), of which ${equationBlocks} printed equation block(s) (minimum 200)`,
    );
    if (editionFiles.length === 0) {
      throw new Error(
        "content/source-blocks, content/translation-units and content/alignments yielded no " +
          "record. Seven structural checks, equation-identity and the hero-quote resolver would " +
          "then run over an empty population and report clean (am-rc1001-bridge-plan-pcjk.10).",
      );
    }
    if (equationBlocks < 200) {
      throw new Error(
        `Only ${equationBlocks} printed equation block(s) were read from content/source-blocks, ` +
          "and the corpus has 200. `equation-not-identical` would compare fewer pairs and still " +
          "report no differences, which reads exactly like a clean result " +
          "(am-rc1001-bridge-plan-pcjk.10 step 2).",
      );
    }
    return [...readingFiles, ...experimentFiles, ...journeyFiles, ...editionFiles];
  },
  dimensionAudit: async () => {
    const { summary } = await mainAuditDimensions([]);
    return summarize(
      "audit-dimensions",
      summary.ok
        ? []
        : [
            {
              check: "dimension-consistency",
              family: "audit",
              severity: "error",
              recordId: "dimension-audit",
              message: `Dimension audit failed: ${summary.inconsistent} inconsistent equations.`,
            },
          ],
    );
  },
  audits: {
    readings: async () => {
      const input = loadLiveReadingsAuditInput(root);
      // THE DENOMINATOR BESIDE THE VERDICT (am-8gbg). The misconception and shelf audits beside this
      // one print theirs, each after a run that judged nothing and reported green; this one did not,
      // so "0 errors" over 55 owner files and "0 errors" over an empty directory read identically.
      // A count of 0 is a failed citation rather than a pass, so it refuses here rather than
      // reporting a clean audit of nothing.
      console.log(
        `[audit-readings] ${input.owners.length} owner file(s) declaring ${input.targets.length} ` +
          `reading target(s) in content/editorial/readings-owners`,
      );
      if (input.owners.length === 0 || input.targets.length === 0) {
        return summarize("audit-readings", [
          {
            check: "readings-population-empty",
            family: "audit",
            severity: "error",
            recordId: "audit-readings",
            message:
              `The readings audit examined ${input.owners.length} owner file(s) and ` +
              `${input.targets.length} target(s). Auditing nothing is not a clean audit.`,
          },
        ]);
      }
      return applyAuditExemptions(
        "readings",
        auditReadings(input),
        READINGS_OWNERS_NOT_YET_AUDITABLE,
        (finding) => finding.ownerBeadId,
        input.owners.length,
      );
    },
    shelf: async () => {
      // The cards the four journeys render (am-rc1001-bridge-plan-pcjk.12). This passed
      // `{ cards: [] }` until 2026-10-02, so the shelf audit judged nothing and reported green.
      const live = auditLiveShelves();
      console.log(
        `[audit-shelf] examined ${live.cards} cards on ${live.shelves} shelves: ` +
          `${live.report.errorCount} errors, ${live.report.flagCount} flags`,
      );
      return live.report;
    },
    journeys: async () => {
      // THE EPISTEMIC GATES, IN THE CONTENT GATE (am-4k0m). `checkJourney` had no non-test caller at
      // all: it ran in the bun lane over four composed journeys and nowhere else, so the post-1904
      // shelf refusal, the fork contract and the move-summary guard that AGENTS.md calls BUILD gates
      // were not in any build. This is that caller.
      //
      // The card catalogue is passed, which is not optional dressing: the shelf rule only judges a card
      // it can look up, and `checkJourney(journey)` with no options judged zero cards. The count of
      // shelf references examined is printed beside the verdict for the same reason every audit beside
      // this one prints one.
      const journeys = REAL_JOURNEYS;
      const shelfRefs = journeys.reduce((n, j) => n + j.shelf.length, 0);
      console.log(
        `[audit-journeys] ${journeys.length} journey(s) examined with ` +
          `${Object.keys(SHELF_CARD_CONTEXT).length} card(s) in the catalogue; ` +
          `${shelfRefs} shelf reference(s) judged against the 1904 cutoff`,
      );
      const findings: AuditFinding[] = journeys.flatMap((journey) =>
        checkJourney(journey, { cards: SHELF_CARD_CONTEXT }).map((finding) => ({
          check: finding.rule,
          family: "audit" as const,
          // checkJourney says error or warning; this report says error or flag. A warning is
          // informational and must not fail a build, so it lands as a flag.
          severity: finding.severity === "error" ? ("error" as const) : ("flag" as const),
          paper: journey.paper,
          recordId: `${journey.paper}/${finding.rule}`,
          message: `${finding.message} (${finding.path})`,
          ...(finding.repair === undefined ? {} : { requirement: finding.repair }),
        })),
      );
      return applyAuditExemptions(
        "audit-journeys",
        summarize("audit-journeys", findings),
        JOURNEY_FINDINGS_NOT_YET_AUDITABLE,
        (finding) => finding.recordId,
        journeys.length,
      );
    },
    misconceptions: async () => {
      // The ledgers as they are on disk (am-8gbg). This passed `papers: []` and four empty sets
      // until 2026-09-27 while content/misconceptions held 26 records, so every check ran over
      // nothing and reported green. The count is printed beside the verdict because "0 errors" over
      // an empty input and "0 errors" over 26 records read identically.
      const live = loadLiveMisconceptionInput(root);
      console.log(
        `[audit-misconceptions] ${live.entries} ledger records in ${live.input.papers.length} papers; ` +
          `${live.input.knownAnchors.size} anchors, ${live.input.knownResults.size} results and ` +
          `${live.input.knownInstruments.size} instruments to resolve against; ` +
          `${live.unjudgedSources} prose citations not judged (the check resolves ids, the records carry prose).`,
      );
      return auditMisconceptions(live.input);
    },
    instruments: async () => {
      const rows = loadLiveInstrumentRows(root);
      return applyAuditExemptions(
        "instruments",
        auditInstruments(rows),
        INSTRUMENTS_NOT_YET_AUDITABLE,
        (finding) => finding.recordId,
        rows.length,
      );
    },
  },
  revisionCheck: async (ref) => {
    if (!existsSync(resolve(root, ".git"))) return "skipped";
    const ok = await runRevisionCheck(ref, resolve(root, "content"));
    return ok;
  },
  inventory: loadCommittedInventory(root),
  pinnedAssets: provenance.pinnedAssets,
  extraReports: [
    ...(provenance.findings.length > 0 ? [provenance.report] : []),
    auditKernelBindings(root),
    // English displays byte-identical to their German blocks (am-rc1001-bridge-plan-pcjk.10): the
    // structural check meant to enforce it selects a block kind no record carries.
    equationIdentity.report,
  ],
});

// Denominators first. An audit reporting "0 errors" says nothing about how many records it looked
// at, and both the readings and instrument audits carry a not-yet-auditable list whose entries have
// their failures downgraded to flags. These lines say how much of each subject was judged against
// the full rule, in the same form the licence inventory uses for "72 of 79".
for (const line of result.populations) console.log(line);
for (const line of result.flags) console.log(`FLAG ${line}`);
for (const line of result.skipped) console.log(line);
for (const line of result.errors) console.error(line);

// Structured log (am-uxh9). This gate decides whether content may publish and
// used to leave no artifact at all: its refusals existed only as stdout, so a
// run could not be audited after the fact and yesterday's failures were
// unrecoverable. One row per error, flag and skip, plus a summary row, so the
// record names WHICH check refused rather than only how many did.
const logger = new TestLogger("verify-content");
for (const line of result.errors) {
  logger.log({ testId: "verify-content-error", outcome: "failed", message: line });
}
for (const line of result.flags) {
  logger.log({ testId: "verify-content-flag", outcome: "passed", message: `FLAG ${line}` });
}
for (const line of result.skipped) {
  logger.log({ testId: "verify-content-skipped", outcome: "skipped", message: line });
}
for (const line of result.populations) {
  logger.log({ testId: "verify-content-population", outcome: "passed", message: line });
}
logger.log({
  testId: "verify-content-summary",
  outcome: result.ok ? "passed" : "failed",
  message:
    `verify-content ${result.ok ? "passed" : "failed"}: ` +
    `${result.errors.length} error(s), ${result.flags.length} flag(s), ${result.skipped.length} skipped.`,
});
await logger.flush();
console.log(`Structured log: ${logger.filePath}`);

// The census line (am-rc1001-bridge-plan-pcjk.9). This gate prints more denominators than any other -
// `result.populations` is one line per audit saying how much of its subject it judged - and had no
// single number a reader across gates could compare. The population is the RECORDS the compiler was
// handed: a run over six would report "0 errors" and read exactly like a clean corpus. Measured
// 2026-10-06: 323 records, 648 flags, 0 errors. The floor is 200.
const censusVacuous = reportPopulation({
  gate: "verify-content",
  examined: result.recordsCompiled,
  noun: "content records compiled",
  minimum: 200,
});

if (result.ok) {
  console.log(
    JSON.stringify({
      ok: true,
      flags: result.flags.length,
      skipped: result.skipped,
    }),
  );
}
process.exit(censusVacuous ? 1 : result.exitCode);
