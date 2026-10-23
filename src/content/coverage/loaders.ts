/**
 * THE COVERAGE LEDGER'S LOADERS: four dimensions read from `content/`, not from a fixture (am-igdv).
 *
 * `src/content/coverage/ledger.ts` has computed all seven dimensions since September and
 * `formatCoverageMarkdown` has rendered them. What it never had was anything to compute them OVER.
 * `scripts/coverage-report.ts` handed `LedgerContext` an empty array for `argumentNodes` and empty
 * maps for `sourceManifests` and `instruments`, so the gate registered in the preview and launch
 * profiles could not pass at all: a bare run opened no file, the census printed VACUOUS, and the
 * script refused. The only values those three fields ever held were a three-node literal in the CLI
 * behind `--demonstration`, whose own comment named this work as its deletion condition.
 *
 * A FOURTH dimension was unwired and, unlike those three, undeclared. `translationUnits` was never
 * passed either, so `translationReview` reported `totalUnits: 0` with no "not measured" note beside
 * it, in a dimension where 821 units carry `reviewState: reviewed`. A declared absence is a work
 * item; an undeclared zero is a wrong measurement, which is why that one is wired here too.
 *
 * EVERY LOADER RETURNS THE FILES IT OPENED, with each file's sha256, and the caller puts them in
 * `report.inputs`. That is not bookkeeping: `report.inputs.length` is what the gate's census counts
 * and what `coverageWasMeasured` reads, so a loader that found nothing has to be able to say so in
 * the same channel a loader that found everything speaks in. A count of records would not do it --
 * zero records and zero files read identically, and only one of them is a repository with no content.
 *
 * NOTHING HERE INVENTS A STATE. Where the tree does not say, the loader reports the honest lower
 * state and names what is missing, and the two states that a static read of the tree cannot
 * establish are deliberately never returned (see `deriveInstrumentProvenance`).
 *
 * Reads `content/` and `src/`, so this is for scripts and tests, never for a page.
 */

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { validateSourceManifest } from "../manifest/schema.ts";
import { deriveUnitCoverage } from "../manifest/unitCoverage.ts";
import { strictParse } from "../schemas/strictParse.ts";
import type {
  ArgumentNodeCoverage,
  CoverageReportInput,
  ExecutionProvenanceState,
} from "./types.ts";

/** One file this loader opened, ready for `report.inputs`. */
export type OpenedFile = CoverageReportInput;

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Read a file and record it as an input in one step.
 *
 * The pairing is the point. A read that does not record leaves the census counting something other
 * than what was measured, and this corpus has already paid for that shape twice: a gate reporting
 * green over zero records, and a report printing "Inputs: None" two lines above "158 reviewed".
 *
 * The RECORDED path is relative to the root, while the read uses the absolute one. A report whose
 * inputs name `/Users/<someone>/projects/...` is not comparable between two machines or two
 * checkouts, and this artifact is written to `artifacts/coverage/` to be compared.
 */
function openFile(
  root: string,
  path: string,
  kind: CoverageReportInput["kind"],
  into: OpenedFile[],
): string {
  const bytes = readFileSync(path);
  into.push({ path: relative(root, path), sha256: sha256(bytes), kind });
  return bytes.toString("utf8");
}

const directoriesIn = (dir: string): readonly string[] =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => !name.startsWith(".") && statSync(join(dir, name)).isDirectory())
        .sort()
    : [];

const filesIn = (dir: string, extension: string): readonly string[] =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => name.endsWith(extension))
        .sort()
    : [];

// ---------------------------------------------------------------------------------------------
// 1. Source status
// ---------------------------------------------------------------------------------------------

export type SourceManifestCoverage = Readonly<{
  paper: string;
  totalUnits: number;
  byStatus: Readonly<Record<string, number>>;
}>;

/**
 * Each paper's manifest, with its units tallied by DERIVED status.
 *
 * The status is not read off the record. No manifest fills a per-unit `status` field by hand, so a
 * loader that read `unit.status` reported `unspecified` for all 544 units on 2026-10-01
 * (am-rc1001-bridge-plan-pcjk.13) and the authority could never say a paper's blocks were covered
 * however complete the paper was. `deriveUnitCoverage` answers the question the manifest actually
 * encodes -- is this unit transcribed, translated, explained -- by reading the source blocks,
 * alignments, translation units and bindings the unit points at.
 *
 * The papers are taken from the directory rather than from `PAPER_SLUGS`, so a fifth paper's
 * manifest is measured the day it lands instead of being silently outside the population.
 */
export function loadSourceManifests(root: string): {
  readonly manifests: ReadonlyMap<string, SourceManifestCoverage>;
  readonly opened: readonly OpenedFile[];
} {
  const opened: OpenedFile[] = [];
  const manifests = new Map<string, SourceManifestCoverage>();
  const base = join(root, "content", "source-blocks");

  for (const paper of directoriesIn(base)) {
    const path = join(base, paper, "manifest.yaml");
    if (!existsSync(path)) continue;
    const manifest = validateSourceManifest(
      strictParse(openFile(root, path, "source-manifest", opened), "yaml", path),
      path,
    );
    const byStatus: Record<string, number> = {};
    let totalUnits = 0;
    for (const unit of deriveUnitCoverage(root, manifest)) {
      totalUnits++;
      byStatus[unit.status] = (byStatus[unit.status] ?? 0) + 1;
    }
    manifests.set(manifest.paper, { paper: manifest.paper, totalUnits, byStatus });
  }

  return { manifests, opened };
}

// ---------------------------------------------------------------------------------------------
// 2. Translation review
// ---------------------------------------------------------------------------------------------

/**
 * Every translation unit with its review state.
 *
 * `reviewState` is the unit's own field and the one the source schema gates on: a unit is final only
 * with `reviewState: reviewed` plus an `agentReview` record of at least two rounds by agents other
 * than its translator. This loader reports the state and does not re-adjudicate it; the schema
 * refuses anything less at authoring time, which is where that check belongs.
 *
 * THE KEY IS `<paper>/<id>`, NOT `<id>`, and the difference is 202 units. A sentence id is scoped to
 * its paper by AGENTS.md's own grammar -- `s3-p2-s1` is section 3, paragraph 2, sentence 1 of
 * whichever paper holds it -- so 143 ids occur in more than one paper. Keyed by the bare id this
 * loader reported 619 reviewed units over 821 opened files on its first run, and the number looked
 * entirely plausible beside a dimension that had been reporting 0. A map keyed on a non-unique field
 * does not fail; it silently keeps the last writer, and it reads as a measurement.
 *
 * The file name is not the id either (the files carry an ordering prefix,
 * `0010-masthead-author.yaml`), so neither half of the key comes from the path.
 */
export function loadTranslationUnits(root: string): {
  readonly units: ReadonlyMap<string, { readonly paper: string; readonly status: string }>;
  readonly opened: readonly OpenedFile[];
} {
  const opened: OpenedFile[] = [];
  const units = new Map<string, { paper: string; status: string }>();
  const base = join(root, "content", "translation-units");

  for (const paper of directoriesIn(base)) {
    for (const file of filesIn(join(base, paper), ".yaml")) {
      const path = join(base, paper, file);
      const record = strictParse(
        openFile(root, path, "translation-unit", opened),
        "yaml",
        path,
      ) as {
        id?: unknown;
        reviewState?: unknown;
      };
      const id = typeof record.id === "string" ? record.id : file.replace(/\.yaml$/, "");
      // An absent reviewState is reported as such rather than defaulted to a review state, because
      // "not-recorded" and "not-reviewed" are different facts about the record.
      const status = typeof record.reviewState === "string" ? record.reviewState : "not-recorded";
      units.set(`${paper}/${id}`, { paper, status });
    }
  }

  return { units, opened };
}

// ---------------------------------------------------------------------------------------------
// 3. Instrument availability
// ---------------------------------------------------------------------------------------------

export type InstrumentCoverage = Readonly<{
  id: string;
  provenance: ExecutionProvenanceState;
  paper?: string | undefined;
  /** The rule that fired and the files it read, so a reader can check the state rather than trust it. */
  evidence: string;
}>;

/** `bm-01` names its runtime directory `bm01`; a dot or dash never survives into a module name. */
const compactId = (id: string): string => id.replaceAll(/[-.]/g, "");

/**
 * Does this module have an IMPORT that resolves under `src/workers/wasm/`?
 *
 * Read as code, not as text. `bm01Host.ts` and `bm06Host.ts` each MENTION FrankenSim in prose while
 * importing nothing from that directory, and the densest writing about the WASM boundary is the
 * documentation explaining it -- so a substring sweep over the file would credit the wrong modules,
 * in the direction that inflates the state. Only the specifier of an `import ... from "..."` or a
 * bare `import "..."` counts.
 */
function importsWasmBoundary(modulePath: string): string | null {
  if (!existsSync(modulePath)) return null;
  const source = readFileSync(modulePath, "utf8");
  const specifiers = [...source.matchAll(/^\s*import\s[^"';]*?from\s*["']([^"']+)["']/gm)]
    .concat([...source.matchAll(/^\s*import\s*["']([^"']+)["']/gm)])
    .map((m) => m[1] ?? "");
  return specifiers.find((s) => /(^|\/)wasm\//.test(s)) ?? null;
}

/**
 * Each instrument's execution provenance, derived from its manifest and its runtime.
 *
 * TWO OF THE SIX STATES ARE DELIBERATELY NEVER RETURNED HERE, and saying why is the substance of
 * this function:
 *
 * - `accepted-frankensim-result-demonstrated` claims that an accepted call to the registered owner
 *   produced a snapshot. No static read of the tree can establish that, and AGENTS.md is explicit
 *   that "a loaded WASM file does not earn the FrankenSim label". The artifact that can establish it
 *   is the candidate check `accepted-wasm-result-per-capability`, which runs one value per capability
 *   against the DEPLOYED assets. So a lab whose worker loads the pinned bundle is reported here as
 *   `artifact-loaded`, which is exactly what the code does, and the stronger state stays with the
 *   check that measures it.
 * - `typed-refusal-boundary-present` maps to the donor's `WASM` runtime state
 *   (`mapDetailedProvenanceToDonor`). Most typed refusals in this corpus are raised by audited
 *   TypeScript evaluators, so returning it for them would report a WASM runtime for a host
 *   calculation. The refusal boundaries are already counted by the refusal ratchets, by population,
 *   and this dimension is not the place to restate them under a label that would be false.
 *
 * The three states that remain are each decided by something on disk:
 *
 * 1. `artifact-loaded` -- the lab's dedicated worker imports the pinned bundle from
 *    `src/workers/wasm/`. Measured 2026-10-23: three of the 33 do (BM-01, BM-05, BM-06), which is
 *    the same three AGENTS.md records as the bound capabilities, reached independently here.
 * 2. `host-calculation-available` -- the manifest declares `owner.kind: reference-evaluator` and
 *    every module its `kernelFunctions` name exists. A declared evaluator whose module is absent is
 *    NOT this state, because the honest label requires the audited evaluator to be there.
 * 3. `static-worked-example` -- otherwise, with the reason named.
 */
export function deriveInstrumentProvenance(
  root: string,
  id: string,
  manifest: { owner?: unknown },
): { readonly provenance: ExecutionProvenanceState; readonly evidence: string } {
  const compact = compactId(id);
  const workerPath = join(root, "src", "workers", "host", `${compact}Worker.ts`);
  const wasmImport = importsWasmBoundary(workerPath);
  if (wasmImport !== null) {
    return {
      provenance: "artifact-loaded",
      evidence: `src/workers/host/${compact}Worker.ts imports "${wasmImport}"; an accepted FrankenSim result is the candidate check's claim, not this one`,
    };
  }

  const owner = (manifest.owner ?? {}) as {
    kind?: unknown;
    kernelFunctions?: { module?: unknown }[];
  };
  if (owner.kind === "reference-evaluator") {
    const modules = (Array.isArray(owner.kernelFunctions) ? owner.kernelFunctions : [])
      .map((k) => (typeof k.module === "string" ? k.module : ""))
      .filter(Boolean);
    const missing = modules.filter((m) => !existsSync(join(root, m)));
    const distinct = [...new Set(modules)];
    if (modules.length > 0 && missing.length === 0) {
      return {
        provenance: "host-calculation-available",
        evidence: `owner.kind reference-evaluator over ${distinct.length} present module(s): ${distinct.join(", ")}`,
      };
    }
    return {
      provenance: "static-worked-example",
      evidence:
        modules.length === 0
          ? "owner.kind reference-evaluator declares no kernelFunctions module"
          : `owner.kind reference-evaluator names ${missing.length} absent module(s): ${missing.join(", ")}`,
    };
  }

  return {
    provenance: "static-worked-example",
    evidence: `no wasm-importing worker and owner.kind is ${JSON.stringify(owner.kind ?? null)}`,
  };
}

/** Which paper an instrument id belongs to, from the id prefix the naming convention fixes. */
const PAPER_OF_PREFIX: Readonly<Record<string, string>> = {
  lq: "light-quanta",
  bm: "brownian-motion",
  sr: "special-relativity",
  me: "mass-energy",
};

export function loadInstruments(root: string): {
  readonly instruments: ReadonlyMap<string, InstrumentCoverage>;
  /** Every id the manifests declare, for the ledger's unknown-experiment check. */
  readonly knownExperiments: ReadonlySet<string>;
  /** Scenario ids each instrument declares as an acceptance case. */
  readonly acceptanceCases: ReadonlyMap<string, readonly string[]>;
  /** The nonvisual action contract each instrument declares, if any. */
  readonly actionContracts: ReadonlyMap<string, readonly string[]>;
  readonly opened: readonly OpenedFile[];
} {
  const opened: OpenedFile[] = [];
  const instruments = new Map<string, InstrumentCoverage>();
  const knownExperiments = new Set<string>();
  const acceptanceCases = new Map<string, readonly string[]>();
  const actionContracts = new Map<string, readonly string[]>();
  const base = join(root, "content", "experiments");

  for (const file of filesIn(base, ".yaml")) {
    const path = join(base, file);
    const manifest = strictParse(
      openFile(root, path, "instrument-manifest", opened),
      "yaml",
      path,
    ) as {
      id?: unknown;
      owner?: unknown;
      acceptanceCases?: unknown;
      actions?: { actionId?: unknown; equivalentAffordance?: unknown }[];
    };
    const id = typeof manifest.id === "string" ? manifest.id : file.replace(/\.yaml$/, "");
    knownExperiments.add(id);
    const derived = deriveInstrumentProvenance(root, id, manifest);
    const prefix = id.slice(0, 2);
    instruments.set(id, {
      id,
      provenance: derived.provenance,
      paper: PAPER_OF_PREFIX[prefix],
      evidence: derived.evidence,
    });
    acceptanceCases.set(
      id,
      (Array.isArray(manifest.acceptanceCases) ? manifest.acceptanceCases : []).filter(
        (s): s is string => typeof s === "string",
      ),
    );
    actionContracts.set(
      id,
      (Array.isArray(manifest.actions) ? manifest.actions : [])
        .filter((a) => typeof a.equivalentAffordance === "string" && a.equivalentAffordance.trim())
        .map((a) => String(a.actionId ?? "")),
    );
  }

  return { instruments, knownExperiments, acceptanceCases, actionContracts, opened };
}

// ---------------------------------------------------------------------------------------------
// 4. Argument treatment and accessibility equivalence
// ---------------------------------------------------------------------------------------------

/** AGENTS.md's four readings, under the names the argument records give them. */
const READING_FIELDS = [
  ["overview", "R0"],
  ["full", "R1"],
  ["steps", "R2"],
  ["margin", "R3"],
] as const;

/**
 * The 48 argument records as coverage nodes.
 *
 * Three of this shape's fields are not written on the argument record and are DERIVED from the
 * instruments it names, which is where the corpus actually keeps them:
 *
 * - `treatment` is `instrument` with the record's own `experiments` when it names any. A record
 *   naming none would be `static` here, with the reason, rather than `omitted` -- an omission has to
 *   be written down to be an omission, and `omitted` without a reason is what the ledger's own
 *   `omitted-treatment-missing-reason` diagnostic refuses. Measured 2026-10-23: all 48 name at least
 *   one lab, so the static branch has no members today and exists for the record that lands without.
 * - `accessibilityEquivalent` is `action-contract` when every instrument this node names declares at
 *   least one action with an `equivalentAffordance`. "Every", not "some": a reader following this
 *   node to the lab that has no nonvisual equivalent is not served by the one that does.
 * - `acceptanceScenarioIds` is the union of those instruments' `acceptanceCases`. The node does not
 *   declare scenarios and the instrument does, so reading them off the instrument is reading the
 *   corpus rather than restating it on 48 more records.
 */
export function loadArgumentNodes(
  root: string,
  instruments?: {
    readonly acceptanceCases: ReadonlyMap<string, readonly string[]>;
    readonly actionContracts: ReadonlyMap<string, readonly string[]>;
  },
): {
  readonly nodes: readonly ArgumentNodeCoverage[];
  readonly opened: readonly OpenedFile[];
} {
  const opened: OpenedFile[] = [];
  const nodes: ArgumentNodeCoverage[] = [];
  const base = join(root, "content", "arguments");

  for (const paper of directoriesIn(base)) {
    for (const file of filesIn(join(base, paper), ".json")) {
      if (!file.startsWith("arg-")) continue;
      const path = join(base, paper, file);
      const record = JSON.parse(openFile(root, path, "argument-nodes", opened)) as {
        id?: unknown;
        paper?: unknown;
        section?: unknown;
        readings?: Record<string, unknown>;
        experiments?: unknown;
        meaning?: { logicalRole?: unknown };
      };
      const id = typeof record.id === "string" ? record.id : file.replace(/\.json$/, "");
      const readings = record.readings ?? {};
      const readingsPresent = READING_FIELDS.filter(([field]) => {
        const value = readings[field];
        return Array.isArray(value) ? value.length > 0 : Boolean(value);
      }).map(([, level]) => level);

      const experimentIds = (Array.isArray(record.experiments) ? record.experiments : []).filter(
        (e): e is string => typeof e === "string",
      );

      const scenarios = experimentIds.flatMap((e) => instruments?.acceptanceCases.get(e) ?? []);
      const everyLabHasContract =
        experimentIds.length > 0 &&
        experimentIds.every((e) => (instruments?.actionContracts.get(e) ?? []).length > 0);

      nodes.push({
        id,
        paper: typeof record.paper === "string" ? record.paper : paper,
        section: typeof record.section === "string" ? record.section : "",
        logicalRole:
          typeof record.meaning?.logicalRole === "string" ? record.meaning.logicalRole : undefined,
        readingsPresent,
        treatment:
          experimentIds.length > 0
            ? { kind: "instrument", experimentIds }
            : {
                kind: "static",
                description:
                  "The record names no instrument; its treatment is the authored passage.",
              },
        ...(everyLabHasContract
          ? {
              accessibilityEquivalent: {
                kind: "action-contract" as const,
                details: `Declared by ${experimentIds.join(", ")}`,
              },
            }
          : {}),
        ...(scenarios.length > 0 ? { acceptanceScenarioIds: [...new Set(scenarios)].sort() } : {}),
      });
    }
  }

  return { nodes, opened };
}

// ---------------------------------------------------------------------------------------------
// The whole context, with the floors that make a vacuous run visible
// ---------------------------------------------------------------------------------------------

/**
 * The minimum population each dimension must find before a run may be reported as a measurement.
 *
 * These are floors, not expected values, and they are deliberately well below the measured counts
 * (4 manifests, 821 units, 33 instruments, 48 nodes) so that correct work does not turn them red --
 * a count asserted as an equality breaks the day a record is added, which this repository has paid
 * for twice. What they catch is the failure this bead exists to end: a loader pointed at the wrong
 * root, or a directory rename, returning nothing and reading as clean.
 */
export const COVERAGE_FLOORS = Object.freeze({
  sourceManifests: 4,
  translationUnits: 400,
  instruments: 30,
  argumentNodes: 40,
});

export type LoadedCoverage = Readonly<{
  sourceManifests: ReadonlyMap<string, SourceManifestCoverage>;
  translationUnits: ReadonlyMap<string, { readonly paper: string; readonly status: string }>;
  instruments: ReadonlyMap<string, InstrumentCoverage>;
  knownExperiments: ReadonlySet<string>;
  argumentNodes: readonly ArgumentNodeCoverage[];
  opened: readonly OpenedFile[];
  /** Any dimension whose population fell below its floor, as readable lines. */
  shortfalls: readonly string[];
}>;

/** Every dimension this module can read, from one root, with the files opened and the floors checked. */
export function loadCoverageFromContent(root: string): LoadedCoverage {
  const sources = loadSourceManifests(root);
  const translations = loadTranslationUnits(root);
  const instruments = loadInstruments(root);
  const argumentNodes = loadArgumentNodes(root, instruments);

  const shortfalls: string[] = [];
  const check = (noun: string, examined: number, minimum: number) => {
    if (examined < minimum) shortfalls.push(`${noun}: ${examined} found, minimum ${minimum}`);
  };
  check("source manifests", sources.manifests.size, COVERAGE_FLOORS.sourceManifests);
  check("translation units", translations.units.size, COVERAGE_FLOORS.translationUnits);
  check("instrument manifests", instruments.instruments.size, COVERAGE_FLOORS.instruments);
  check("argument nodes", argumentNodes.nodes.length, COVERAGE_FLOORS.argumentNodes);

  return {
    sourceManifests: sources.manifests,
    translationUnits: translations.units,
    instruments: instruments.instruments,
    knownExperiments: instruments.knownExperiments,
    argumentNodes: argumentNodes.nodes,
    opened: [
      ...sources.opened,
      ...translations.opened,
      ...instruments.opened,
      ...argumentNodes.opened,
    ],
    shortfalls,
  };
}
