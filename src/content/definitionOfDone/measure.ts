/**
 * THE MEASUREMENTS, one function per §17.7 item (am-definition-of-done-as-code-8w1c).
 *
 * Six items are read from the records here. Seven are declared UNMEASURED with the reason and the
 * path their data lives at, because this report must not make an item it cannot read look
 * complete. The bead's first criterion requires exactly that, and the division is honest rather
 * than tidy: the six are the ones whose population has a single unambiguous denominator in the
 * frozen records. The seven that are not need a loader, a comparison between two authored texts,
 * or a browser, and each says so.
 *
 * WHERE AN AUDIT ALREADY EXISTS, IT IS CONSUMED. `deriveUnitCoverage` is the manifest compiler's
 * own coverage walk, the same one scripts/source-manifest-report.ts prints, so the first item is
 * not a second opinion about the inventory -- the bead's third criterion asks for that explicitly.
 *
 * A DECLARED STATUS IS COVERAGE, AND MISSING THAT COST THIS FILE THREE WRONG NUMBERS. The first
 * version counted only the positive form of each binding and reported light-quanta's manifest at
 * 237 of 263, its displays at 26 of 52, and relativity's paragraphs at 93 of 94. All three were my
 * filter, not the corpus:
 *
 *   - `deriveUnitCoverage` has TWO covering statuses, `covered` and `covered-declared`, and
 *     237 + 26 = 263. scripts/source-manifest-report.ts says so in as many words -- "263 of 263
 *     in-scope units (26 by a declaration)" -- so consuming an audit's OUTPUT is not the same as
 *     consuming its semantics.
 *   - content/bindings' own header says each display is "bound to an equation record OR GIVEN A
 *     DECLARED STATUS", and the two forms partition exactly: 26+26, 10+33, 42+56, 7+0.
 *   - relativity's paragraphs use the declared form twice, 96 + 2 = 98, and every manifest
 *     paragraph is bound.
 *
 * So each of these items counts both forms and REPORTS THE SPLIT in its note. The split is real
 * information rather than a caveat: coverage by a declaration is weaker than coverage by a record,
 * and a reader deciding whether a paper is done should see how much of it is which. What the item
 * must not do is call a declared binding missing.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { load as loadYaml } from "js-yaml";
import { auditInstruments, loadLiveInstrumentRows } from "../audits/instruments.ts";
import { validateSourceManifest } from "../manifest/schema.ts";
import { deriveUnitCoverage } from "../manifest/unitCoverage.ts";
import { loadTour } from "../tours/tours.ts";
import { type DoneCell, doneCell, unmeasuredCell } from "./cells.ts";
import { labCellsForPaper } from "./labCells.ts";
import { type LoadedReadings, loadLiveReadings, readingsTally } from "./readingsCells.ts";

export const DONE_PAPERS = [
  "light-quanta",
  "brownian-motion",
  "special-relativity",
  "mass-energy",
] as const;

function readYaml(path: string): unknown {
  if (!existsSync(path)) return null;
  try {
    return loadYaml(readFileSync(path, "utf8")) as unknown;
  } catch {
    return null;
  }
}

function listed(value: unknown, key: string): readonly Record<string, unknown>[] {
  if (value === null || typeof value !== "object") return [];
  const inner = (value as Record<string, unknown>)[key];
  return Array.isArray(inner)
    ? (inner.filter((x) => x !== null && typeof x === "object") as Record<string, unknown>[])
    : [];
}

/**
 * ITEM 1: every manifest unit is covered by the tree.
 *
 * Consumes `deriveUnitCoverage`, the manifest compiler's own walk. Not re-derived from the block
 * files, and the difference is not cosmetic: the manifests inventory SENTENCE units, which live as
 * `sentenceSpans` on a paragraph block rather than as files of their own, so counting files would
 * report 26 of 53 for mass-energy and call a complete inventory half done.
 */
export function manifestUnitsCovered(root: string, paper: string): DoneCell {
  const path = join(root, "content", "source-blocks", paper, "manifest.yaml");
  if (!existsSync(path)) {
    return unmeasuredCell("manifest-units-covered", paper, `no manifest at ${path}`);
  }
  let coverage: ReturnType<typeof deriveUnitCoverage>;
  try {
    const manifest = validateSourceManifest(readYaml(path));
    coverage = deriveUnitCoverage(root, manifest);
  } catch (error) {
    return unmeasuredCell(
      "manifest-units-covered",
      paper,
      `the manifest did not validate (${error instanceof Error ? error.message.slice(0, 90) : "unknown"})`,
    );
  }
  const byRecord = coverage.filter((u) => u.status === "covered").length;
  const byDeclaration = coverage.filter((u) => u.status === "covered-declared").length;
  return doneCell(
    "manifest-units-covered",
    paper,
    byRecord + byDeclaration,
    coverage.length,
    `units the tree covers against the frozen manifest, via deriveUnitCoverage; ${byDeclaration} of them by a declaration rather than a record`,
  );
}

/**
 * ITEM 2: an English translation unit exists for every sentence the manifest inventories.
 *
 * The denominator is the manifest's SENTENCE units, not all units: a masthead or a date-line is
 * not a sentence anyone translates, and including them would make the item unreachable.
 */
export function englishUnitsPresent(root: string, paper: string): DoneCell {
  const manifestPath = join(root, "content", "source-blocks", paper, "manifest.yaml");
  const manifest = readYaml(manifestPath);
  const units = listed(manifest, "units");
  if (units.length === 0) {
    return unmeasuredCell("english-units-present", paper, `no readable units in ${manifestPath}`);
  }
  const sentenceIds = new Set(
    units
      .filter((u) => typeof u.kind === "string" && String(u.kind).includes("sentence"))
      .map((u) => String(u.id)),
  );
  if (sentenceIds.size === 0) {
    return unmeasuredCell(
      "english-units-present",
      paper,
      "the manifest inventories no sentence-kind unit, so there is no denominator to measure against",
    );
  }
  const dir = join(root, "content", "translation-units", paper);
  if (!existsSync(dir)) {
    return unmeasuredCell("english-units-present", paper, `no translation units at ${dir}`);
  }
  const present = new Set<string>();
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".yaml")) continue;
    const unit = readYaml(join(dir, name));
    if (unit === null || typeof unit !== "object") continue;
    const id = (unit as Record<string, unknown>).id;
    // A split half carries the source id with a letter suffix, and it translates that source
    // sentence, so both halves count toward the same unit rather than neither.
    if (typeof id === "string") present.add(id.replace(/[ab]$/, ""));
  }
  const covered = [...sentenceIds].filter((id) => present.has(id)).length;
  return doneCell(
    "english-units-present",
    paper,
    covered,
    sentenceIds.size,
    "sentence units with an English translation unit, halves counted to their source id",
  );
}

/** ITEM 3: every printed paragraph is bound to at least one explanation passage. */
export function paragraphsBound(root: string, paper: string): DoneCell {
  const manifest = readYaml(join(root, "content", "source-blocks", paper, "manifest.yaml"));
  const paragraphIds = new Set(
    listed(manifest, "units")
      .filter((u) => String(u.kind) === "paragraph")
      .map((u) => String(u.id)),
  );
  const bindingsPath = join(root, "content", "bindings", `${paper}.yaml`);
  if (paragraphIds.size === 0) {
    return unmeasuredCell(
      "paragraphs-bound",
      paper,
      "the manifest inventories no paragraph unit, so there is no denominator",
    );
  }
  if (!existsSync(bindingsPath)) {
    return unmeasuredCell("paragraphs-bound", paper, `no bindings at ${bindingsPath}`);
  }
  const entries = listed(readYaml(bindingsPath), "paragraphs");
  const byPassage = new Set(
    entries
      .filter((p) => Array.isArray(p.passages) && (p.passages as unknown[]).length > 0)
      .map((p) => String(p.unit)),
  );
  const byDeclaration = new Set(
    entries
      .filter((p) => typeof p.status === "string" && p.status !== "")
      .map((p) => String(p.unit)),
  );
  const covered = [...paragraphIds].filter(
    (id) => byPassage.has(id) || byDeclaration.has(id),
  ).length;
  const declaredHere = [...paragraphIds].filter(
    (id) => !byPassage.has(id) && byDeclaration.has(id),
  ).length;
  return doneCell(
    "paragraphs-bound",
    paper,
    covered,
    paragraphIds.size,
    `paragraph units bound in content/bindings, to a passage or by a declared status; ${declaredHere} by a declaration`,
  );
}

/** ITEM 4: every printed display is bound to an equation record or given a declared status. */
export function displaysBound(root: string, paper: string): DoneCell {
  const manifest = readYaml(join(root, "content", "source-blocks", paper, "manifest.yaml"));
  const displayIds = new Set(
    listed(manifest, "units")
      .filter((u) => String(u.kind).includes("display"))
      .map((u) => String(u.id)),
  );
  if (displayIds.size === 0) {
    return unmeasuredCell(
      "displays-bound",
      paper,
      "the manifest inventories no display-kind unit, so there is no denominator",
    );
  }
  const bindingsPath = join(root, "content", "bindings", `${paper}.yaml`);
  if (!existsSync(bindingsPath)) {
    return unmeasuredCell("displays-bound", paper, `no bindings at ${bindingsPath}`);
  }
  const entries = listed(readYaml(bindingsPath), "displays");
  const byEquation = new Set(
    entries
      .filter((d) => Array.isArray(d.equations) && (d.equations as unknown[]).length > 0)
      .map((d) => String(d.unit)),
  );
  const byDeclaration = new Set(
    entries
      .filter((d) => typeof d.status === "string" && d.status !== "")
      .map((d) => String(d.unit)),
  );
  const covered = [...displayIds].filter(
    (id) => byEquation.has(id) || byDeclaration.has(id),
  ).length;
  const declaredHere = [...displayIds].filter(
    (id) => !byEquation.has(id) && byDeclaration.has(id),
  ).length;
  return doneCell(
    "displays-bound",
    paper,
    covered,
    displayIds.size,
    `display units bound in content/bindings, to an equation record or by a declared status; ${declaredHere} by a declaration`,
  );
}

/** ITEM 5: every results card carries its as-printed layer. */
export function resultsCardsPrinted(root: string, paper: string): DoneCell {
  const path = join(root, "content", "results", `${paper}.yaml`);
  if (!existsSync(path)) {
    return unmeasuredCell("results-cards-printed", paper, `no results record at ${path}`);
  }
  const cards = listed(readYaml(path), "cards");
  if (cards.length === 0) {
    return unmeasuredCell("results-cards-printed", paper, `no cards in ${path}`);
  }
  const withPrinted = cards.filter(
    (c) => Array.isArray(c.printed) && (c.printed as unknown[]).length > 0,
  ).length;
  return doneCell(
    "results-cards-printed",
    paper,
    withPrinted,
    cards.length,
    "results cards carrying a non-empty as-printed layer",
  );
}

/**
 * ITEM 6: the misconception ledger holds at least five entries.
 *
 * The denominator is FIVE, the floor the content compiler enforces, not the number of entries. A
 * denominator of "however many there are" would make this item met by construction, which is the
 * failure mode the whole report is about: it would read `8 of 8` for a ledger of eight and `2 of 2`
 * for a ledger of two.
 */
export function misconceptionsAtLeastFive(root: string, paper: string): DoneCell {
  const dir = join(root, "content", "misconceptions", paper);
  if (!existsSync(dir)) {
    return unmeasuredCell("misconceptions-at-least-five", paper, `no ledger directory at ${dir}`);
  }
  const entries = readdirSync(dir).filter(
    (n) => n.endsWith(".yaml") || n.endsWith(".json") || n.endsWith(".md"),
  ).length;
  return doneCell(
    "misconceptions-at-least-five",
    paper,
    Math.min(entries, 5),
    5,
    `${entries} entries in the ledger, against the floor of five the compiler enforces`,
  );
}

/**
 * ITEM: the historian's-margin entries of plan section 3.9, against the per-paper requirement.
 *
 * THIS CELL WAS DECLARED UNMEASURED ON A REASON THAT HAS EXPIRED. `NOT_YET_READ` said "the
 * required-per-paper list that would be the denominator is in the plan rather than in a record this
 * can read". That was true when written and stopped being true on 2026-10-08, when
 * `content/editorial/required-margin-entries/<paper>.yaml` landed -- four records whose own opening
 * comment reads "This file is a DENOMINATOR, not editorial copy", one per paper, with the plan's
 * lettered entries transcribed.
 *
 * COUNTING RECORDS WOULD BE THE WRONG POPULATION, and the denominator files say so in their own
 * words: `kind: historian-margin` gives 16 across the four papers, of which only six are section
 * 3.9 entries for mass-energy and ten are notation-concordance notes carrying the same kind. So the
 * numerator is the REQUIREMENT satisfied, read from the requirement's side.
 *
 * `partial` counts as NOT satisfied. The denominator files are explicit -- "Do not promote a partial
 * by widening this file" -- and a cell that credited a partial would report an item met while the
 * plan's clause is half covered.
 *
 * `additionalRequired` is part of the denominator because a bead outranks the plan as the executable
 * queue; the mass-energy record explains why its two entries carry names rather than letters.
 */
export function marginEntries(root: string, paper: string): DoneCell {
  const file = join(root, "content", "editorial", "required-margin-entries", `${paper}.yaml`);
  if (!existsSync(file)) {
    return unmeasuredCell(
      "margin-entries",
      paper,
      `no requirement record at ${file}, so there is no denominator to measure against`,
    );
  }
  type Entry = Readonly<{ satisfiedBy?: unknown; partial?: unknown }>;
  const record = loadYaml(readFileSync(file, "utf8")) as Readonly<{
    entries?: readonly Entry[];
    additionalRequired?: readonly Entry[];
  }>;
  const required = [...(record.entries ?? []), ...(record.additionalRequired ?? [])];
  if (required.length === 0) {
    return unmeasuredCell(
      "margin-entries",
      paper,
      `${file} declares no entries, so a 0 of 0 here would be arithmetic rather than a verdict`,
    );
  }
  const satisfied = required.filter((e) => Boolean(e.satisfiedBy) && !e.partial);
  const partial = required.filter((e) => Boolean(e.partial)).length;
  return doneCell(
    "margin-entries",
    paper,
    satisfied.length,
    required.length,
    `${required.length} required by plan section 3.9 and the owning bead; ` +
      `${satisfied.length} satisfied by a named record` +
      (partial > 0 ? `, ${partial} partial and therefore not counted` : ""),
  );
}

/**
 * ITEM: the fifteen-minute tour each paper owes, present and resolving.
 *
 * DECLARED UNMEASURED ON A DENOMINATOR THAT DOES EXIST. `NOT_YET_READ` said "which tour each paper
 * must have is in the plan, so there is no per-paper denominator to read". The beads are the
 * executable work queue -- AGENTS.md, "the beads are the executable work queue, and each is written
 * to stand on its own" -- and there are exactly four, one per paper:
 * am-tour-15min-mass-energy-nqz1, am-tour-15min-light-quanta-yj70, am-tour-15min-brownian-z034 and
 * am-tour-15min-relativity-qcxc, each titled "Author the fifteen-minute <paper> tour that needs no
 * equations". So the denominator is one, per paper, and it comes from a record rather than prose.
 *
 * MATCHED ON THE RECORD'S OWN `paper` FIELD, not on a filename. The one tour that exists is
 * `fifteen-minutes-mass-energy.yaml`, and the bead ids use `brownian` where the paper slug is
 * `brownian-motion`, so a filename convention guessed from either would be wrong for at least one
 * paper. Reading the declared field cannot be wrong about which paper a tour serves.
 *
 * PRESENT AND RESOLVING, with the note saying which failed. A record whose steps do not resolve is
 * not a tour a reader can take, so it does not count; but conflating "absent" with "present and
 * broken" would hide a real difference, and the note distinguishes them.
 */
export function tourPresent(root: string, paper: string): DoneCell {
  const dir = join(root, "content", "tours");
  if (!existsSync(dir)) {
    return unmeasuredCell("tour-present", paper, `no tour directory at ${dir}`);
  }
  const ids = readdirSync(dir)
    .filter((n) => n.endsWith(".yaml"))
    .map((n) => n.replace(/\.yaml$/, ""));
  for (const id of ids) {
    const loaded = loadTour(root, id);
    if (!loaded) continue;
    if (loaded.tour.paper !== paper) continue;
    if (loaded.tour.budget !== "fifteen-minutes") continue;
    return loaded.problems.length === 0
      ? doneCell("tour-present", paper, 1, 1, `${id} present and resolving`)
      : doneCell(
          "tour-present",
          paper,
          0,
          1,
          `${id} is present but does not resolve: ${loaded.problems.length} problem(s), first "${loaded.problems[0]}"`,
        );
  }
  return doneCell(
    "tour-present",
    paper,
    0,
    1,
    `no record in content/tours declares paper ${paper} with budget fifteen-minutes; ` +
      `${ids.length} tour record(s) on disk`,
  );
}

/**
 * ITEM 7: the lab contract cells of a paper's core instruments.
 *
 * Fourteen contract columns per instrument, so the population is instruments times columns. The
 * audit is loaded and judged once per process by the caller and passed in, because
 * `loadLiveInstrumentRows` reads every manifest and every owner test, and doing that four times --
 * once per paper -- would make the report several times slower for the same answer.
 */
export function labContractCells(
  paper: string,
  loaded: {
    report: ReturnType<typeof auditInstruments>;
    rows: ReturnType<typeof loadLiveInstrumentRows>;
  },
): DoneCell {
  const tally = labCellsForPaper(loaded.report, loaded.rows, paper);
  if (tally.total === 0) {
    return unmeasuredCell(
      "lab-contract-cells",
      paper,
      `no core instrument rows loaded for this paper (expected ids beginning with its prefix)`,
    );
  }
  return doneCell(
    "lab-contract-cells",
    paper,
    tally.satisfied,
    tally.total,
    `${tally.instruments} core instruments x ${tally.columns} contract columns, judged by auditInstruments`,
  );
}

/**
 * ITEM 8: every reading target carries a complete R0-R3 set.
 *
 * `readings-missing` is the audit's own check, so a target with a gap at any level is not clean.
 * The denominator is the paper's reading targets as the readings-owners records declare them --
 * which is the population the §17.7 item is about, since a target nobody owns is a different
 * finding (`owner-unassigned`) and is counted by the audit rather than hidden here.
 */
export function readingsComplete(paper: string, loaded: LoadedReadings): DoneCell {
  const tally = readingsTally(loaded, paper, ["readings-missing"]);
  if (tally.reachable === 0) {
    return unmeasuredCell(
      "readings-r0-to-r3",
      paper,
      `auditReadings reached no reading target for this paper: ${tally.shortCircuited} were short-circuited at owner-unassigned, so no later check ran. This branch is a guard, not the current state -- every one of the 63 targets resolves to an owner today (READINGS_RECORD_VOCABULARY). It last fired because the loader in THIS directory mistranslated the kind field, so if it fires again, suspect the loader before the corpus`,
    );
  }
  return doneCell(
    "readings-r0-to-r3",
    paper,
    tally.clean,
    tally.reachable,
    "declared reading targets with a complete R0-R3 set, by auditReadings' readings-missing check",
  );
}

/**
 * ITEM 9: R2 expands R1.
 *
 * By the audit's own proxy: `R2_LENGTH_FACTOR = 1.2`, with a declared per-target override for the
 * cases where expansion is not length. A proxy rather than a reading of the prose, and it is this
 * repository's proxy, already written down and already enforced -- which is what separates a
 * measurement from an invention. My earlier note called this unmeasurable and was wrong.
 */
export function r2CoversR1(paper: string, loaded: LoadedReadings): DoneCell {
  const tally = readingsTally(loaded, paper, ["r2-length", "r2-override-incomplete"]);
  if (tally.reachable === 0) {
    return unmeasuredCell(
      "r2-covers-r1",
      paper,
      `the r2-length check never ran for this paper: all ${tally.shortCircuited} of its reading targets are short-circuited at owner-unassigned. A guard rather than the current state: the audit judges this relation by R2_LENGTH_FACTOR 1.2 with declared overrides, and reaches every target today (READINGS_RECORD_VOCABULARY)`,
    );
  }
  return doneCell(
    "r2-covers-r1",
    paper,
    tally.clean,
    tally.reachable,
    "targets whose R2 is longer than R1 by the declared factor, or carry a complete override",
  );
}

/**
 * The remaining items this report does not yet read, each with the reason and where its data is.
 *
 * Declared rather than omitted: an item missing from the table is invisible, and an item present
 * as `unmeasured` with a path is a work item. The bead's first criterion asks for exactly this
 * distinction.
 */
const NOT_YET_READ: Readonly<Record<string, string>> = {
  "journey-skeleton-parts":
    "content/journeys holds the records; the skeleton's parts (shelf, nagging fact, forks, the move, " +
    "check-against-the-world) are a structural requirement with no field asserting presence yet.",
  "reviews-with-names":
    "docs/provenance/<key>.md records acceptance with reviewer names; parsing a receipt's " +
    "acceptance table is its own unit, and AGENTS.md is explicit that nothing is marked reviewed " +
    "by an agent, so the honest value today would be 0 of N for every paper.",
};

export function declaredUnmeasured(paper: string): readonly DoneCell[] {
  return Object.entries(NOT_YET_READ).map(([item, reason]) =>
    unmeasuredCell(item as Parameters<typeof unmeasuredCell>[0], paper, reason),
  );
}

/**
 * The instrument audit, loaded and judged ONCE.
 *
 * `loadLiveInstrumentRows` reads every experiment manifest and indexes every owner test, so it is
 * the expensive part of this report. Loading it per paper would do that work four times for the
 * same answer, and the four papers' rows come out of one pass anyway.
 */
export function loadInstrumentAudit(root: string): {
  report: ReturnType<typeof auditInstruments>;
  rows: ReturnType<typeof loadLiveInstrumentRows>;
} {
  const rows = loadLiveInstrumentRows(root);
  return { report: auditInstruments(rows), rows };
}

/** Every cell for one paper, measured and declared. */
export function cellsForPaper(
  root: string,
  paper: string,
  instruments = loadInstrumentAudit(root),
  readings = loadLiveReadings(root),
): readonly DoneCell[] {
  return [
    manifestUnitsCovered(root, paper),
    englishUnitsPresent(root, paper),
    paragraphsBound(root, paper),
    displaysBound(root, paper),
    resultsCardsPrinted(root, paper),
    misconceptionsAtLeastFive(root, paper),
    marginEntries(root, paper),
    tourPresent(root, paper),
    labContractCells(paper, instruments),
    readingsComplete(paper, readings),
    r2CoversR1(paper, readings),
    ...declaredUnmeasured(paper),
  ];
}

/** Every cell for every paper, with the instrument audit loaded once for all four. */
export function allCells(root: string): readonly DoneCell[] {
  const instruments = loadInstrumentAudit(root);
  // Loaded once for all four papers, like the instrument audit: it reads 41 records and judges
  // every target, and doing that per paper would be four passes for the same answer.
  const readings = loadLiveReadings(root);
  return DONE_PAPERS.flatMap((paper) => cellsForPaper(root, paper, instruments, readings));
}
