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
 * WHAT IS MEASURED AND WHAT IS NOT. ELEVEN items are computed from real inputs; four are declared
 * `unmeasured` with the reason and the bead that owns the missing input. It was eight and seven:
 * `lab-contract-cells` became measurable the same day, when its reason -- that mapping an instrument
 * to its paper "needs a declared binding" -- turned out to be describing a binding that exists, in
 * every manifest's own `sourceRefs[].paper`. And `journey-skeleton-parts` became measurable when the
 * discovery journeys were emitted as records
 * under `content/journeys/`, and its stale `unmeasured` reason still said they were "hand-authored
 * JSX rather than records". A reason that has gone stale is the same silence this file is written
 * against, one layer up: it reads as "nobody could check" when somebody can, so an item's reason is
 * re-read when its owning bead moves. Declaring them is deliberate:
 * the acceptance asks for a report that accounts for every item, and an item quietly left out is the
 * silent class this file is written against. They are NOT counted as met, and they are NOT counted as
 * short either, because neither would be a measurement.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { journeySkeletonElements } from "../../discovery/checks/journeyChecks.ts";
import { type Journey, validateJourney } from "../schemas/journey.ts";
import { strictParse } from "../schemas/strictParse.ts";

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

/**
 * ALL FOUR READINGS, FOR EVERY BOUND PARAGRAPH, THROUGH THE PASSAGES IT BINDS.
 *
 * The reason here said "the readings owners declare their targets in
 * content/editorial/readings-owners/, and no loader resolves a target to the paragraph it covers".
 * That names the wrong mechanism. Measured across all 41 readings-owners files, every one of their
 * 63 targets is `kind: "caption"` -- instrument captions and presets. NOT ONE is a paragraph, so a
 * loader resolving a target to a paragraph would have nothing to resolve.
 *
 * A paragraph's readings arrive another way, and the records say so plainly. `content/bindings/
 * <paper>.yaml` gives each paragraph its own `r0` and a list of `passages`, and each passage is an
 * argument record under `content/arguments/<paper>/` carrying `readings.{overview, full, steps,
 * margin}`. Those four names are AGENTS.md's own table -- R0 Overview, R1 Full explanation, R2 Show
 * every step, R3 Historian's margin -- so the correspondence is declared rather than assumed here.
 *
 * A PARAGRAPH COUNTS WHEN EVERY PASSAGE IT BINDS CARRIES ALL FOUR. Not "some passage", because the
 * reader following any one of a paragraph's passages must land on a full set; and not the paragraph's
 * own `r0` alone, which `paragraph-overviews-r0` already measures and which says nothing about R1 to
 * R3. A paragraph binding a passage whose record is missing is counted as short and the passage is
 * named, because an unresolvable reference is a gap rather than an absence of obligation.
 */
function readingsPerParagraphCell(root: string, paper: DonenessPaper): DonenessCell {
  const bindings = join(root, "content", "bindings", `${paper}.yaml`);
  if (!existsSync(bindings))
    return unmeasured(
      "readings-r1-r3-per-paragraph",
      `no bindings at content/bindings/${paper}.yaml`,
    );
  const parsed = strictParse(readFileSync(bindings, "utf8"), "yaml") as {
    paragraphs?: { unit?: unknown; passages?: unknown }[];
  };
  const paragraphs = Array.isArray(parsed.paragraphs) ? parsed.paragraphs : [];
  if (paragraphs.length === 0)
    return unmeasured(
      "readings-r1-r3-per-paragraph",
      `content/bindings/${paper}.yaml binds no paragraphs, so there is no denominator`,
    );
  // AGENTS.md's four readings, under the names the argument records use for them.
  const READINGS = ["overview", "full", "steps", "margin"] as const;
  const argumentsDir = join(root, "content", "arguments", paper);
  const readingsOf = (passage: string): readonly string[] | null => {
    const file = join(argumentsDir, `${passage}.json`);
    if (!existsSync(file)) return null;
    const record = JSON.parse(readFileSync(file, "utf8")) as { readings?: Record<string, unknown> };
    const readings = record.readings ?? {};
    return READINGS.filter((name) => {
      const value = readings[name];
      return Array.isArray(value) ? value.length > 0 : Boolean(value);
    });
  };
  let met = 0;
  let declared = 0;
  const shortfalls: string[] = [];
  for (const entry of paragraphs) {
    const unit = typeof entry.unit === "string" ? entry.unit : "(unnamed)";
    const passages = Array.isArray(entry.passages)
      ? entry.passages.filter((p): p is string => typeof p === "string")
      : [];
    // A DECLARED EXCEPTION IS OUTSIDE THE OBLIGATION, NOT SHORT OF IT. An entry may carry
    // `status: "unexplained"` with a written reason, which is how this corpus records a unit no
    // passage takes up -- special-relativity's s1-fn1, a footnote about events at nearly the same
    // place, and s5-p8, the sentence closing the kinematic part. am-4k0m names those two as the
    // model for declaring rather than fixing. Counting them short would report a false defect.
    //
    // The REASON is what makes it a declaration. A bare `status: "unexplained"` with nothing
    // written excuses nothing, and falls through to the shortfall below, because an undeclared
    // exception and a declared one must not measure the same.
    const status = (entry as { status?: unknown }).status;
    const reason = String((entry as { reason?: unknown }).reason ?? "").trim();
    if (status === "unexplained" && reason.length > 0) {
      declared += 1;
      continue;
    }
    if (passages.length === 0) {
      shortfalls.push(`${unit}: binds no passage`);
      continue;
    }
    const gaps: string[] = [];
    for (const passage of passages) {
      const have = readingsOf(passage);
      if (have === null) {
        gaps.push(`${passage}: no record`);
        continue;
      }
      const missing = READINGS.filter((name) => !have.includes(name));
      if (missing.length > 0) gaps.push(`${passage}: missing ${missing.join("/")}`);
    }
    if (gaps.length === 0) met += 1;
    else shortfalls.push(`${unit}: ${gaps.join("; ")}`);
  }
  const owing = paragraphs.length - declared;
  const detail =
    `${met} of ${owing} obliged paragraphs reach all four readings ` +
    `(${READINGS.join(", ")}) through every passage they bind` +
    (declared > 0
      ? `; ${declared} declared unexplained with a written reason and outside the obligation`
      : "") +
    (shortfalls.length > 0 ? `; short: ${shortfalls.slice(0, 6).join(" | ")}` : "");
  return cell("readings-r1-r3-per-paragraph", met, owing, detail);
}

/**
 * THE HISTORIAN'S MARGIN: TYPED AND COUNTED, AND STILL WITHOUT A DENOMINATOR.
 *
 * The reason here said "margin entries live in readings-owners r3 text rather than as typed records,
 * so they cannot be counted per paper (am-5cza)". The first clause is no longer true:
 * `content/editorial-notes/<paper>/*.json` holds records with `kind: "historian-margin"`, 16 across
 * the four papers, each with a claim, its source support and a review state. Someone reading that
 * reason would start a migration that has already happened, which is what a stale reason costs.
 *
 * SO THE COUNT IS REPORTED AND THE CELL STAYS UNMEASURED, and the distinction is the honest one.
 * What the plan asks for is a REQUIRED SET -- "the six §3.9 margin entries, including 'E = mc^2 does
 * not appear in the paper'" -- and that set exists only as prose, in the plan and in the bead text.
 * No record enumerates it, so there is nothing to divide by. The same blocker as
 * `results-cards-against-section-3`, and naming it the same way is deliberate: both want one typed
 * list of what a paper owes.
 *
 * A FLOOR WOULD BE WORSE THAN NOTHING HERE. `misconceptions-at-least-five` divides by a floor the
 * plan states as a floor, which is a real requirement. Inventing one for the margin -- "at least
 * one" -- would read as `met` for a paper carrying one of six required entries, and this module's
 * third rule is that met means the numerator reached the denominator.
 */
function marginEntriesCell(root: string, paper: DonenessPaper): DonenessCell {
  const dir = join(root, "content", "editorial-notes", paper);
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
  let margin = 0;
  for (const file of files) {
    const record = JSON.parse(readFileSync(join(dir, file), "utf8")) as { kind?: unknown };
    if (record.kind === "historian-margin") margin += 1;
  }
  return unmeasured(
    "historians-margin-entries",
    `${margin} typed historian-margin record(s) on disk for this paper, in content/editorial-notes/${paper}/; ` +
      "the plan's required SET is prose and no record enumerates it, so there is no denominator to " +
      "divide by (the same gap as results-cards-against-section-3)",
  );
}

/**
 * THE FIVE CONTRACT ITEMS THE PLAN NAMES, FOR EVERY INSTRUMENT THIS PAPER'S CLAIMS ANSWER.
 *
 * This cell was `unmeasured` because "mapping an instrument to the paper whose claim it answers
 * needs a declared binding". That binding exists and is declared, not inferred: every one of the 33
 * manifests carries `sourceRefs[].paper`. The id prefix agrees with it in all 33, and the agreement
 * is ASSERTED below rather than relied on, so a manifest whose refs name another paper is reported
 * instead of being quietly filed under its prefix.
 *
 * THE DENOMINATOR IS THE PROJECT'S OWN LIST, not one chosen here. am-mass-energy-first-complete-
 * paper-ej2w names the contract in those words -- "ME-01, ME-02 and ME-03 at full contract
 * (predict, show-the-code, tape, embed)" -- and AGENTS.md adds the fifth, that `notModeled` is shown
 * as a plain line and "an empty list fails the audit". Five items per instrument. A longer list read
 * off AGENTS.md's manifest paragraph would mostly restate what the schema already requires, and a
 * cell that counts what validation guarantees measures nothing.
 *
 * Four are read from the manifest and the fifth from the built page, because show-the-code is a
 * claim about what a reader is served and a manifest cannot make it. So the cell is `unmeasured`
 * without a build, in the same words the faces use, which is what the ratchet's `buildAbsent`
 * recognises.
 *
 * `predict` is met by an enabled prompt set OR by a recorded exemption with a reason, which is
 * AGENTS.md's own disjunction ("the predict-mode flag or a recorded exemption"); five instruments
 * are exempt and all five carry reasons of 205 characters or more.
 */
function labContractCell(root: string, paper: DonenessPaper): DonenessCell {
  const dir = join(root, "content", "experiments");
  if (!existsSync(dir))
    return unmeasured("lab-contract-cells", `no instrument manifests at ${dir}`);
  const items = ["predict", "show-the-code", "tape", "embed", "notModeled"] as const;
  const prefixes: Record<DonenessPaper, string> = {
    "light-quanta": "lq",
    "brownian-motion": "bm",
    "special-relativity": "sr",
    "mass-energy": "me",
  };
  const mine: { id: string; manifest: Record<string, unknown> }[] = [];
  const mismatched: string[] = [];
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith(".yaml")) continue;
    const id = file.slice(0, -".yaml".length);
    // Parsed, not pattern-matched. My first version read `^\s+paper:` and found nothing, because
    // every ref is a LIST ITEM and the line begins `  - paper:`. The cell reported `unmeasured`
    // rather than 0 of 165, which is the design working, and a regex over YAML is the wrong
    // instrument regardless.
    const manifest = strictParse(readFileSync(join(dir, file), "utf8"), "yaml") as Record<
      string,
      unknown
    >;
    const refs = Array.isArray(manifest.sourceRefs) ? manifest.sourceRefs : [];
    const named = new Set(
      refs
        .map((ref) => (ref as { paper?: unknown } | null)?.paper)
        .filter((value): value is string => typeof value === "string"),
    );
    if (!named.has(paper)) continue;
    mine.push({ id, manifest });
    // The id prefix is a cross-check, never the binding. AGENTS.md fixes the four prefixes, and a
    // manifest whose refs name this paper under another prefix is reported rather than absorbed.
    if (!id.startsWith(`${prefixes[paper]}-`)) mismatched.push(id);
  }
  if (mine.length === 0)
    return unmeasured(
      "lab-contract-cells",
      `no instrument manifest names ${paper} in its sourceRefs, so there is no denominator`,
    );
  let met = 0;
  const shortfalls: string[] = [];
  for (const { id, manifest } of mine) {
    const page = join(root, "out", "lab", id, "index.html");
    if (!existsSync(page))
      return unmeasured(
        "lab-contract-cells",
        `no built laboratory page at out/lab/${id}/index.html; run bun run build`,
      );
    const predictMode = (manifest.predictMode ?? {}) as Record<string, unknown>;
    const exemptReason = String(predictMode.exemptReason ?? predictMode.reason ?? "").trim();
    const notModeled = manifest.notModeled;
    const present: Record<(typeof items)[number], boolean> = {
      // AGENTS.md's own disjunction: "the predict-mode flag or a recorded exemption".
      predict: predictMode.enabled === true || exemptReason.length > 0,
      "show-the-code": readFileSync(page, "utf8").includes('class="show-the-code"'),
      tape: manifest.tapeModel !== undefined && manifest.tapeModel !== null,
      embed: manifest.embeddable === true,
      // AGENTS.md: shown as a plain line, and "an empty list fails the audit".
      notModeled: Array.isArray(notModeled) && notModeled.length > 0,
    };
    for (const item of items) {
      if (present[item]) met += 1;
      else shortfalls.push(`${id}:${item}`);
    }
  }
  const of = mine.length * items.length;
  const detail =
    `${met} of ${of} contract cells across ${mine.length} instrument(s) (${items.join(", ")})` +
    (shortfalls.length > 0 ? `; short: ${shortfalls.join(", ")}` : "") +
    (mismatched.length > 0
      ? `; NAMES THIS PAPER WITHOUT ITS ID PREFIX: ${mismatched.join(", ")}`
      : "");
  return cell("lab-contract-cells", met, of, detail);
}

/**
 * THE DISCOVERY SKELETON, COUNTED PER PAPER. Thirteen elements, from the journey record on disk.
 *
 * This cell was `unmeasured` with the reason "the discovery journeys are hand-authored JSX rather
 * than records, so their skeleton parts cannot be counted (am-4k0m)". That was true when it was
 * written and is not now: `content/journeys/<paper>.yaml` holds four emitted records, each parsed
 * back and asserted deeply equal to the journey the pages render, and each validated against the
 * journey schema. So the input the reason named as missing exists, and a stale `unmeasured` is the
 * same silence this file is written against -- it reads as "nobody could check" when somebody can.
 *
 * THE PREDICATE IS NOT RE-DERIVED HERE. It comes from `journeySkeletonElements`, which `checkJourney`
 * consumes for the same thirteen elements, so this report and the gate cannot disagree about what
 * "has a fork" means. A second copy of those predicates in this file would be free to drift, which
 * is exactly what the doneness report exists to stop happening to bead status.
 *
 * A PENDING ELEMENT COUNTS AS ABSENT, deliberately. Two of the four records declare `stages` and
 * `exercises.instrumented` pending through the schema's own `pendingElements`, which is an honest
 * declaration and not a measurement: the reader does not get a staged journey because the record
 * says the stages are coming. `checkJourney` uses the same declarations to suppress its own
 * findings; this cell does not, because its question is "how much of the skeleton is there".
 */
function journeySkeletonCell(root: string, paper: DonenessPaper): DonenessCell {
  const path = join(root, "content", "journeys", `${paper}.yaml`);
  if (!existsSync(path))
    return unmeasured(
      "journey-skeleton-parts",
      `no journey record at content/journeys/${paper}.yaml, so its skeleton cannot be counted`,
    );
  let journey: Journey;
  try {
    journey = validateJourney(strictParse(readFileSync(path, "utf8"), "yaml"));
  } catch (error) {
    // A record the schema refuses is not a count of zero: it is a record nobody can read, and
    // reporting 0 of 13 would invite someone to "fix" thirteen elements that may all be present.
    return unmeasured(
      "journey-skeleton-parts",
      `content/journeys/${paper}.yaml does not validate, so its skeleton cannot be counted: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  const elements = journeySkeletonElements(journey);
  const names = Object.keys(elements).sort();
  const present = names.filter((name) => elements[name] === true);
  const pending = (journey.pendingElements ?? []).map((entry) => entry.element).sort();
  const absent = names.filter((name) => elements[name] !== true);
  const detail =
    `${present.length} of ${names.length} skeleton elements present in ` +
    `content/journeys/${paper}.yaml` +
    (absent.length > 0 ? `; absent: ${absent.join(", ")}` : "") +
    (pending.length > 0 ? `; declared pending: ${pending.join(", ")}` : "");
  return cell("journey-skeleton-parts", present.length, names.length, detail);
}

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
    readingsPerParagraphCell(root, paper),
    unmeasured(
      "r2-expands-r1",
      "no record states which R2 passage expands which R1 passage, so containment cannot be checked from the records",
    ),
    unmeasured(
      "results-cards-against-section-3",
      "the plan's §3 results list is prose; no typed record enumerates the results a paper must card, so there is no denominator",
    ),
    marginEntriesCell(root, paper),
    labContractCell(root, paper),
    journeySkeletonCell(root, paper),
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
