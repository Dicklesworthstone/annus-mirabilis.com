/**
 * THE CAPSTONE RECORD, RESOLVED AGAINST THE CORPUS (am-disc-capstones-infra-3352).
 *
 * `capstoneSchema.ts` checks a record's shape and its chain and deliberately imports no registry;
 * this is the other half, the one that knows where the papers live. It reads the YAML, validates it,
 * and then resolves every id it names against the files those ids are supposed to be in.
 *
 * THE RESOLVERS READ THE INPUT FILES, not a loader's output. A resolver built on a compiled index
 * can only ever see the ids that index already accepted, so a reference the index quietly dropped
 * would resolve and the check would pass while proving nothing. Existence on disk is the coarsest
 * possible question and it is the one that cannot be answered by something upstream having already
 * filtered the population.
 *
 * WHY AN ANNOTATED EQUATION MUST BE PRINTED. A capstone annotates the paper's own displays, so each
 * equation record it names has to be bound to a printed display in content/bindings/<paper>.yaml. An
 * equation the paper never prints has no anchor to send a reader to, and a capstone that annotated
 * one would be annotating the site rather than the source.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { strictParse } from "../../content/schemas/strictParse.ts";
import {
  type Capstone,
  type CapstoneResolvers,
  CapstoneSchemaError,
  checkCapstoneReferences,
  validateCapstone,
} from "./capstoneSchema.ts";

/** An annotated equation with what the page needs to show it: its words and where it is printed. */
export type AnnotatedEquation = Readonly<{
  equationId: string;
  purpose: string;
  title: string;
  /** The authored spoken form, which is the equation's accessible name wherever it is read aloud. */
  spoken: string;
  /** The printed display this equation is bound to, which is also the anchor in the paper. */
  displayUnit: string;
}>;

export type LoadedCapstone = Readonly<{
  capstone: Capstone;
  equations: readonly AnnotatedEquation[];
}>;

function readYaml(file: string): Record<string, unknown> {
  return strictParse(readFileSync(file, "utf8"), "yaml") as Record<string, unknown>;
}

function equationFile(root: string, paper: string, equationId: string): string {
  return join(root, "content", "equations", paper, `${equationId}.json`);
}

function readEquation(root: string, paper: string, equationId: string): Record<string, unknown> {
  return JSON.parse(readFileSync(equationFile(root, paper, equationId), "utf8")) as Record<
    string,
    unknown
  >;
}

/**
 * Every unit a paper prints: its paragraphs, footnotes and displays, from the bindings record. These
 * are the anchors a claim may cite, and they are the same ids the reading face uses, so a claim's
 * anchor is a link into the edition rather than a name that only this file understands.
 */
function printedUnits(root: string, paper: string): ReadonlySet<string> {
  const bindings = readYaml(join(root, "content", "bindings", `${paper}.yaml`));
  const units = new Set<string>();
  for (const key of ["paragraphs", "displays"] as const) {
    for (const entry of (bindings[key] ?? []) as { unit?: unknown }[]) {
      if (typeof entry?.unit === "string") units.add(entry.unit);
    }
  }
  return units;
}

/** Which printed display each equation record is bound to, from the same bindings record. */
function displayOfEquation(root: string, paper: string): ReadonlyMap<string, string> {
  const bindings = readYaml(join(root, "content", "bindings", `${paper}.yaml`));
  const map = new Map<string, string>();
  for (const entry of (bindings.displays ?? []) as { unit?: unknown; equations?: unknown }[]) {
    if (typeof entry?.unit !== "string" || !Array.isArray(entry.equations)) continue;
    for (const equationId of entry.equations) {
      if (typeof equationId === "string" && !map.has(equationId)) map.set(equationId, entry.unit);
    }
  }
  return map;
}

/**
 * The resolvers for one paper, each reading the file the id names. Exported because the content
 * beads validate their own records with them, and because a test can plant a bad id against the
 * real corpus rather than against a stub that agrees with whatever it is asked.
 */
export function corpusResolvers(root: string = process.cwd()): CapstoneResolvers {
  return {
    anchorExists: (paper, anchor) => printedUnits(root, paper).has(anchor),
    instrumentExists: (instrumentId) =>
      existsSync(join(root, "content", "experiments", `${instrumentId}.yaml`)),
    equationExists: (equationId) =>
      EQUATION_PAPERS.some((paper) => existsSync(equationFile(root, paper, equationId))),
    equationHasSpokenForm: (equationId) => {
      const paper = EQUATION_PAPERS.find((p) => existsSync(equationFile(root, p, equationId)));
      if (paper === undefined) return false;
      const spoken = readEquation(root, paper, equationId).spoken;
      return typeof spoken === "string" && spoken.trim().length > 0;
    },
    tapeExists: (tapeId) =>
      existsSync(join(root, "content", "experiments", "tapes", `${tapeId}.yaml`)),
    presetExists: (instrumentId, presetId) => {
      const file = join(root, "content", "experiments", `${instrumentId}.yaml`);
      if (!existsSync(file)) return false;
      const presets = (readYaml(file).presets ?? []) as { presetId?: unknown }[];
      return presets.some((preset) => preset?.presetId === presetId);
    },
    scenarioExists: (scenarioId) =>
      existsSync(join(root, "content", "scenarios", `${scenarioId}.yaml`)),
  };
}

/** The four papers, for an equation id that does not carry its paper. */
const EQUATION_PAPERS = [
  "mass-energy",
  "light-quanta",
  "brownian-motion",
  "special-relativity",
] as const;

export const CAPSTONES_DIR = join("content", "arguments", "capstones");

/** Whether a paper has a capstone record at all. Four are planned; fewer are written. */
export function capstoneExists(paper: string, root: string = process.cwd()): boolean {
  return existsSync(join(root, CAPSTONES_DIR, `${paper}.yaml`));
}

/**
 * The capstone for one paper, validated, resolved, and carrying the words and printed address of
 * each equation it annotates. Throws rather than returning a partial record: a page rendered from
 * half a capstone would be a page whose missing half nobody is told about.
 */
export function loadCapstone(paper: string, root: string = process.cwd()): LoadedCapstone {
  const file = join(root, CAPSTONES_DIR, `${paper}.yaml`);
  if (!existsSync(file))
    throw new CapstoneSchemaError(
      "capstone-record-missing",
      `no capstone record for ${paper}.`,
      file,
    );
  const capstone = validateCapstone(readYaml(file), `capstone(${paper})`);
  if (capstone.paper !== paper)
    throw new CapstoneSchemaError(
      "capstone-paper-mismatch",
      `the record in ${paper}.yaml says its paper is "${capstone.paper}".`,
      `capstone(${paper}).paper`,
    );
  checkCapstoneReferences(capstone, corpusResolvers(root), `capstone(${paper})`);

  const displays = displayOfEquation(root, paper);
  const equations = capstone.equations.map((annotation) => {
    const displayUnit = displays.get(annotation.equationId);
    if (displayUnit === undefined)
      throw new CapstoneSchemaError(
        "capstone-equation-not-printed",
        `"${annotation.equationId}" is bound to no printed display of ${paper}, so a reader cannot be sent to it in the edition.`,
        `capstone(${paper}).equations`,
      );
    const record = readEquation(root, paper, annotation.equationId);
    return {
      equationId: annotation.equationId,
      purpose: annotation.purpose,
      title: String(record.title ?? annotation.equationId),
      spoken: String(record.spoken ?? ""),
      displayUnit,
    };
  });
  return { capstone, equations };
}
