/**
 * EACH PAPER'S DEFINITION OF DONE, COMPUTED FROM THE BUILT SITE AND THE RECORDS (am-definition-of-done-as-code-8w1c).
 *
 * Plan §17.7 lists per-paper items. Bead status stands in for them today, and bead status measures
 * ACCEPTANCE rather than the product: all 33 instrument beads were open while all 33 laboratories were
 * live, and `coverage-report.ts` refuses with "no loader wired" while the bead that owns it is closed.
 * A number computed from `out/` and `content/` cannot drift from the product that way.
 *
 * THREE RULES THIS FILE EXISTS TO HOLD.
 *
 * 1. EVERY CELL IS A COUNT WITH ITS DENOMINATOR, never an aggregate percentage. AGENTS.md forbids "a
 *    single flattering completeness percentage that aggregates translation, instruments, review, and
 *    validation", and the reason is that such a number cannot be acted on: 86% does not say which
 *    paragraph is unbound.
 *
 * 2. A ZERO DENOMINATOR IS `unmeasured`, NEVER `met`. This is the whole point. A check over an empty
 *    population passes, and a passing check reads as a finished one; the project has been bitten by
 *    that at least six times. So a cell whose population is empty says so in its own state, and an
 *    item this report cannot compute at all is listed with its reason rather than omitted. Fifteen
 *    items are accounted for below and nothing is silent.
 *
 * 3. MET MEANS THE NUMERATOR REACHED THE DENOMINATOR. Not "close", not "no errors found".
 *
 * WHAT IS MEASURED AND WHAT IS NOT. Eight items are computed from real inputs; seven are declared
 * `unmeasured` with the reason and the bead that owns the missing input. Declaring them is deliberate:
 * the acceptance asks for a report that accounts for every item, and an item quietly left out is the
 * silent class this file is written against. They are NOT counted as met, and they are NOT counted as
 * short either, because neither would be a measurement.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const DONENESS_PAPERS = [
  "mass-energy",
  "light-quanta",
  "brownian-motion",
  "special-relativity",
] as const;

export type DonenessPaper = (typeof DONENESS_PAPERS)[number];

export type CellState = "met" | "short" | "unmeasured";

export type DonenessCell = Readonly<{
  /** The §17.7 item, in the plan's own words where they are short enough to be an id. */
  item: string;
  /** How many of the denominator are met. Zero when nothing could be counted. */
  met: number;
  /** The population. Zero means UNMEASURED, never met. */
  of: number;
  state: CellState;
  /** What was counted and from where, or why it could not be. Always populated. */
  detail: string;
}>;

export type PaperDoneness = Readonly<{
  paper: DonenessPaper;
  cells: readonly DonenessCell[];
}>;

/** `of === 0` is unmeasured by construction, so no caller can spell a zero-population pass. */
function cell(item: string, met: number, of: number, detail: string): DonenessCell {
  const state: CellState = of === 0 ? "unmeasured" : met >= of ? "met" : "short";
  return Object.freeze({ item, met: of === 0 ? 0 : met, of, state, detail });
}

/** An item this report cannot compute. Named rather than omitted, and never met. */
function unmeasured(item: string, reason: string): DonenessCell {
  return Object.freeze({ item, met: 0, of: 0, state: "unmeasured" as const, detail: reason });
}

type Lines = readonly string[];

/**
 * The lines under one top-level YAML key, up to the next one.
 *
 * A bindings file's `paragraphs:` and `displays:` sections hold entries of the same shape and
 * different obligations, so a count that spans both measures neither.
 */
function sectionOf(lines: Lines, key: string): Lines {
  const out: string[] = [];
  let inside = false;
  for (const line of lines) {
    const top = /^([A-Za-z][A-Za-z0-9_]*):\s*$/.exec(line);
    if (top !== null) {
      inside = top[1] === key;
      continue;
    }
    if (inside) out.push(line);
  }
  return Object.freeze(out);
}

const linesOf = (path: string): Lines =>
  existsSync(path) ? readFileSync(path, "utf8").split("\n") : [];

/** Manifest unit ids by kind, read from the frozen manifest's own entries. */
function manifestUnits(root: string, paper: string): ReadonlyMap<string, readonly string[]> {
  const byKind = new Map<string, string[]>();
  const text = readFileSync(join(root, `content/source-blocks/${paper}/manifest.yaml`), "utf8");
  // Entries are `  - id: <id>` followed by `    kind: <kind>`; the kind belongs to the nearest id
  // above it, which is why this walks lines rather than matching a pair with one regex.
  let currentId: string | null = null;
  for (const line of text.split("\n")) {
    const id = /^ {2}- id: ([A-Za-z0-9._-]+)\s*$/.exec(line);
    if (id?.[1] !== undefined) {
      currentId = id[1];
      continue;
    }
    const kind = /^ {4}kind: ([a-z-]+)\s*$/.exec(line);
    if (kind?.[1] !== undefined && currentId !== null) {
      const list = byKind.get(kind[1]) ?? [];
      list.push(currentId);
      byKind.set(kind[1], list);
      currentId = null;
    }
  }
  return byKind;
}

const idsIn = (html: string): ReadonlySet<string> =>
  new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1] ?? ""));

const builtFace = (root: string, paper: string, face: string): string | null => {
  const path = join(root, `out/papers/${paper}/view/${face}/index.html`);
  return existsSync(path) ? readFileSync(path, "utf8") : null;
};

/** Translation-unit ids, from each record's own `id`. */
function translationUnitIds(root: string, paper: string): readonly string[] {
  const dir = join(root, `content/translation-units/${paper}`);
  if (!existsSync(dir)) return [];
  const ids: string[] = [];
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith(".yaml")) continue;
    const id = /^id:\s*"?([^"\n]+)"?\s*$/m.exec(readFileSync(join(dir, file), "utf8"))?.[1];
    if (id !== undefined) ids.push(id.trim());
  }
  return ids;
}

export function paperDoneness(root: string, paper: DonenessPaper): PaperDoneness {
  const units = manifestUnits(root, paper);
  const sentences = units.get("sentence") ?? [];
  const displays = units.get("display-equation") ?? [];
  const paragraphs = units.get("paragraph") ?? [];
  const german = builtFace(root, paper, "german");
  const english = builtFace(root, paper, "english");
  const translations = translationUnitIds(root, paper);

  const cells: DonenessCell[] = [];

  // 1. The German face serves every sentence the manifest freezes.
  if (german === null) {
    cells.push(
      unmeasured(
        "german-face-sentences",
        `no built German face at out/papers/${paper}/view/german/index.html; run bun run build`,
      ),
    );
  } else {
    const served = idsIn(german);
    const found = sentences.filter((id) => served.has(id)).length;
    cells.push(
      cell(
        "german-face-sentences",
        found,
        sentences.length,
        `${found} of ${sentences.length} frozen sentence ids are anchored on the built German face`,
      ),
    );
  }

  // 2. The English face serves every translation unit on disk.
  if (english === null) {
    cells.push(
      unmeasured(
        "english-face-units",
        `no built English face at out/papers/${paper}/view/english/index.html; run bun run build`,
      ),
    );
  } else {
    const served = idsIn(english);
    const found = translations.filter((id) => served.has(id)).length;
    cells.push(
      cell(
        "english-face-units",
        found,
        translations.length,
        `${found} of ${translations.length} translation-unit records are anchored on the built English face`,
      ),
    );
  }

  // 3. Every translation unit is the target of an authored alignment edge.
  const alignment = linesOf(join(root, `content/alignments/${paper}.yaml`));
  const targets = new Set(
    alignment
      .map((l) => /^\s*translationUnitId:\s*"?([^"\n]+)"?\s*$/.exec(l)?.[1]?.trim())
      .filter((id): id is string => id !== undefined),
  );
  const aligned = translations.filter((id) => targets.has(id)).length;
  cells.push(
    cell(
      "alignment-edges",
      aligned,
      translations.length,
      `${aligned} of ${translations.length} translation units are named by an authored alignment edge`,
    ),
  );

  // 4. Every printed paragraph is bound to an explanation passage.
  const bindings = linesOf(join(root, `content/bindings/${paper}.yaml`));
  const boundUnits = new Set(
    bindings
      .map((l) => /^\s*-\s*unit:\s*([A-Za-z0-9._-]+)\s*$/.exec(l)?.[1])
      .filter((id): id is string => id !== undefined),
  );
  const boundParagraphs = paragraphs.filter((id) => boundUnits.has(id)).length;
  cells.push(
    cell(
      "paragraphs-bound",
      boundParagraphs,
      paragraphs.length,
      `${boundParagraphs} of ${paragraphs.length} printed paragraphs are bound to an explanation passage`,
    ),
  );

  // 5. Every PARAGRAPH binding carries its own r0 overview.
  //
  //    SCOPED TO THE `paragraphs:` SECTION, and the first version of this was not. A bindings file
  //    holds `paragraphs:` and `displays:`, and only the first takes an r0 -- AGENTS.md asks that
  //    every printed paragraph "has its own r0 overview", and a display is bound to an equation record
  //    instead. Counting both sections put the 7 mass-energy displays into the denominator and
  //    reported 14 of 21, a shortfall of seven that did not exist. Measured per section: every paper
  //    is complete, 14 of 14, 63 of 63, 35 of 35 and 98 of 98, with 0 r0 lines under `displays:` in
  //    all four. A denominator drawn from the wrong population is the failure this whole file is
  //    written against, and it got in here first.
  //
  //    The denominator is the BINDINGS rather than the paragraphs: an unbound paragraph is already
  //    reported by the cell above, and counting it twice would make one gap look like two.
  const paragraphSection = sectionOf(bindings, "paragraphs");
  let entries = 0;
  let withR0 = 0;
  for (const line of paragraphSection) {
    if (/^\s*-\s*unit:\s/.test(line)) entries += 1;
    if (/^\s*r0:\s*"?\S/.test(line)) withR0 += 1;
  }
  cells.push(
    cell(
      "paragraph-overviews-r0",
      withR0,
      entries,
      `${withR0} of ${entries} paragraph bindings carry a non-empty r0 overview (the displays section takes none)`,
    ),
  );

  // 6. Every printed display is bound for colour and interaction.
  const displayTerms = new Set(
    linesOf(join(root, `content/display-terms/${paper}.yaml`))
      .map((l) => /^\s*-\s*display:\s*([A-Za-z0-9._-]+)\s*$/.exec(l)?.[1])
      .filter((id): id is string => id !== undefined),
  );
  const boundDisplays = displays.filter((id) => displayTerms.has(id)).length;
  cells.push(
    cell(
      "printed-displays-bound",
      boundDisplays,
      displays.length,
      `${boundDisplays} of ${displays.length} printed displays have a display-terms record`,
    ),
  );

  // 7. The misconception ledger holds at least five typed entries. The denominator is the plan's
  //    floor of five rather than the number authored, so a paper with twelve is met rather than
  //    over-met, and a paper with four is short by one.
  const misconceptionDir = join(root, `content/misconceptions/${paper}`);
  const misconceptions = existsSync(misconceptionDir)
    ? readdirSync(misconceptionDir).filter((f) => f.endsWith(".yaml") || f.endsWith(".json")).length
    : 0;
  cells.push(
    cell(
      "misconceptions-at-least-five",
      Math.min(misconceptions, 5),
      5,
      `${misconceptions} typed misconception entries on disk; the plan's floor is five`,
    ),
  );

  // 8. The paper has a tour. One record, so the denominator is one.
  const tourDir = join(root, "content/tours");
  const tours = existsSync(tourDir)
    ? readdirSync(tourDir).filter((f) => f.endsWith(".yaml") && f.includes(paper)).length
    : 0;
  cells.push(
    cell("tour-present", Math.min(tours, 1), 1, `${tours} tour record(s) name this paper`),
  );

  // The seven items this report cannot compute yet. Named, with the input that is missing, and never
  // counted as met. An item left out of the table entirely is the silent class this file is against.
  cells.push(
    unmeasured(
      "readings-r1-r3-per-paragraph",
      "the readings owners declare their targets in content/editorial/readings-owners/, and no loader resolves a target to the paragraph it covers (am-cm-audit-scripts-d34)",
    ),
    unmeasured(
      "r2-expands-r1",
      "no record states which R2 passage expands which R1 passage, so containment cannot be checked from the records",
    ),
    unmeasured(
      "results-cards-against-section-3",
      "the plan's §3 results list is prose; no typed record enumerates the results a paper must card, so there is no denominator",
    ),
    unmeasured(
      "historians-margin-entries",
      "margin entries live in readings-owners r3 text rather than as typed records, so they cannot be counted per paper (am-5cza)",
    ),
    unmeasured(
      "lab-contract-cells",
      "the instrument coverage obligations are per instrument rather than per paper; mapping an instrument to the paper whose claim it answers needs a declared binding",
    ),
    unmeasured(
      "journey-skeleton-parts",
      "the discovery journeys are hand-authored JSX rather than records, so their skeleton parts cannot be counted (am-4k0m)",
    ),
    unmeasured(
      "reviews-recorded-with-names",
      "docs/OWNERS.md has one assigned human and 54 recruiting slots, so no paper can record a human review; an agent must not compute this as met",
    ),
  );

  return Object.freeze({ paper, cells: Object.freeze(cells) });
}

export function siteDoneness(root: string): readonly PaperDoneness[] {
  return Object.freeze(DONENESS_PAPERS.map((paper) => paperDoneness(root, paper)));
}

/**
 * One line per cell, each count beside its denominator, and no aggregate.
 *
 * The totals line counts CELLS by state, which is not a completeness figure: it says how much of this
 * report reached a verdict, which is the thing AGENTS.md asks a citation to state.
 */
export function formatDoneness(report: readonly PaperDoneness[]): string {
  const lines: string[] = [];
  let met = 0;
  let short = 0;
  let unmeasuredCells = 0;
  for (const paper of report) {
    lines.push(`${paper.paper}:`);
    for (const c of paper.cells) {
      if (c.state === "met") met += 1;
      else if (c.state === "short") short += 1;
      else unmeasuredCells += 1;
      const count = c.state === "unmeasured" ? "unmeasured" : `${c.met}/${c.of}`;
      lines.push(`  ${c.state.padEnd(10)} ${c.item.padEnd(34)} ${count.padEnd(12)} ${c.detail}`);
    }
  }
  lines.push(
    `cells: ${met} met, ${short} short, ${unmeasuredCells} unmeasured, of ${met + short + unmeasuredCells}. ` +
      "No aggregate completeness figure is produced, by design.",
  );
  return lines.join("\n");
}
