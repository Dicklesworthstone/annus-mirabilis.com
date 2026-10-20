/**
 * THE THREE POPULATIONS THE EDITION TOOLING JUDGES, READ FROM DISK (am-edn-alignment-tooling-do1).
 *
 * One implementation, two consumers: `scripts/align-editions.ts` and the edition pipeline, which
 * also feeds them to `assertEditionContract`. Both previously judged whatever their caller supplied,
 * and no production caller supplied anything -- so the aligner and check 8 validated an EMPTY edge
 * set for every paper and reported `empty-alignment` while 821 authored edges sat in
 * content/alignments/. That is the same shape the contract's own note records about check 1 and
 * `options.declaration`: a validator reading an argument nothing passes cannot fail, and cannot pass
 * either.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { load as parseYaml } from "js-yaml";
import type { RouteSlug } from "../ids.ts";
import { validateAlignment } from "../schemas/source.ts";
import { isPermanentGermanId } from "./alignableIds.ts";
import {
  type AlignmentComponent,
  type AlignmentIssue,
  type ExplicitEdge,
  edgesFromAlignment,
  type GlossAlignableUnit,
  type GlossUnit,
  type TermOccurrence,
  type UnitContent,
  type ValidateGlossInput,
} from "./alignment.ts";

/** A half-open character range into a block's `diplomaticText`. */
type Span = Readonly<{ start: number; end: number }>;

/** The inline fields `locateAtoms` reads; `src/content/schemas/source.ts` owns the shape. */
type InlineShape = Readonly<{
  kind?: unknown;
  text?: unknown;
  latex?: unknown;
  mark?: unknown;
  referenceId?: unknown;
  termId?: unknown;
  definition?: unknown;
  lang?: unknown;
  definitionLang?: unknown;
  display?: boolean | undefined;
  math?: Readonly<{ latex?: unknown; display?: boolean | undefined }> | undefined;
  inlines?: readonly InlineShape[] | undefined;
}>;

/** The fields `loadGlossInput` reads off a source block; the schema owns the rest. */
type SourceBlockShape = Readonly<{
  id?: unknown;
  kind?: unknown;
  diplomaticText?: unknown;
  inlines?: readonly InlineShape[] | undefined;
  sentenceSpans?: readonly { id?: unknown; span?: { start?: unknown; end?: unknown } }[];
}>;

/** The fields `loadGlossInput` reads off a gloss unit; the schema owns the rest. */
type GlossRecordShape = Readonly<{
  sentenceId?: unknown;
  sourceRevision?: unknown;
  sourceTextDigest?: unknown;
  tokens?: readonly { german?: unknown; english?: unknown }[];
  multiwordUnits?: readonly { tokenIndices?: unknown; english?: unknown }[];
  attribution?: { id: string; kind: string; modelId?: string };
  editor?: { id: string; kind: string };
}>;

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
export function loadAuthoredEdges(
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
export function manifestUnitIds(slug: RouteSlug, root: string): readonly string[] {
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
export function translationUnitIds(slug: RouteSlug, root: string): readonly string[] {
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

/**
 * THE FOURTH POPULATION: gloss units and the alignable units they address (rule C.6).
 *
 * The docblock at the top of this file names three populations and says why they are read from
 * disk: "a validator reading an argument nothing passes cannot fail, and cannot pass either."
 * That repair was made for edges and ids and stopped there. Measured 2026-10-19,
 * `bun scripts/align-editions.ts --paper <slug> --layers german,translation,gloss` reported
 * `"outcome": "passed"` for all four papers and wrote a coverage report whose gloss row read
 * `absent | 0` -- while 542 authored gloss units sat in content/gloss-units/, 36 for mass-energy,
 * 163 for light-quanta, 105 for brownian-motion and 246 for special-relativity. The flag was
 * accepted and did nothing, and the tool said the layer was absent rather than unloaded.
 *
 * WHAT AN ALIGNABLE UNIT IS HERE, which is the part that decides whether this reaches anything.
 * All six kinds are glossed in the corpus -- 477 sentences, 24 headings, 22 footnotes, 9 closings,
 * 8 masthead units and 2 part headings -- so building only paragraph sentences would silently drop
 * 65 of the 542 and the gaps would read as a clean run. A paragraph contributes one alignable per
 * `sentenceSpans` entry, sliced from its own `diplomaticText`; every other text-bearing block
 * contributes itself. Equation blocks contribute nothing, because C.6 refuses a gloss that
 * addresses one and `validateGloss` reports that as `gloss-target-not-alignable`.
 *
 * NO DIGEST IS PASSED, deliberately. `validateGloss` falls back to `spanTextDigest(alignable.text)`
 * when a unit carries none, and that is the value the records store: a gloss unit's
 * `sourceTextDigest` is the digest of its SENTENCE, whereas a span's `textDigest` is the digest of
 * the whole BLOCK. Passing the span's digest would have compared the two and reported all 477
 * sentence glosses stale.
 */

/**
 * Where each math atom and footnote mark SITS inside a block's `diplomaticText`.
 *
 * The inline stream and `diplomaticText` are two renderings of one block and they are not
 * interchangeable: measured over the 453 text-bearing blocks, concatenating the inline stream
 * reproduces `diplomaticText` for 363 of them and differs for 90, because a display equation is
 * an inline of the paragraph and is NOT part of the diplomatic text. So the offsets are found by
 * an ordered cursor walk rather than by accumulating lengths -- every inline advances a cursor to
 * its own occurrence, and an inline that does not occur (a display) is skipped without moving it.
 *
 * `indexOf` from the cursor rather than from zero is what keeps a one-character atom honest: a
 * bare `L` or `V` occurs dozens of times in a paragraph, and searching from the start would
 * anchor the first one and then run backwards through the rest.
 */
function locateAtoms(
  text: string,
  inlines: readonly InlineShape[],
): { mathRegions: readonly Span[]; footnoteMarks: readonly Span[] } {
  const mathRegions: Span[] = [];
  const footnoteMarks: Span[] = [];
  let cursor = 0;

  const consume = (fragment: string, into?: Span[]): void => {
    if (fragment === "") return;
    const at = text.indexOf(fragment, cursor);
    if (at === -1) return;
    cursor = at + fragment.length;
    into?.push({ start: at, end: cursor });
  };

  const walk = (list: readonly InlineShape[]): void => {
    for (const inline of list) {
      switch (inline.kind) {
        case "text":
          consume(typeof inline.text === "string" ? inline.text : "");
          break;
        // A misprint marks a word the compositor set wrongly, and 8 of the corpus's 17 wrap a
        // FORMULA rather than a word: `{kind: "misprint", recordId: "typo-pi-exponent-p146",
        // math: {latex: "\\Pi \\cdot 10^7 = 4{,}3"}}`. Reading only `text` left those eight
        // formulas unmarked, so the tokenizer took `\Pi`, `cdot` and `10` for German words and
        // 48 gloss tokens in seven units read as missing. The nested math is a math atom.
        case "misprint":
          if (inline.math && typeof inline.math.latex === "string") {
            consume(inline.math.latex, mathRegions);
          } else {
            consume(typeof inline.text === "string" ? inline.text : "");
          }
          break;
        case "space":
          consume(" ");
          break;
        case "math":
          consume(typeof inline.latex === "string" ? inline.latex : "", mathRegions);
          break;
        case "footnote-mark":
          consume(typeof inline.mark === "string" ? inline.mark : "", footnoteMarks);
          break;
        default:
          // emphasis, term, reference: containers whose children carry the text.
          if (inline.inlines) walk(inline.inlines);
          else if (typeof inline.text === "string") consume(inline.text);
      }
    }
  };

  walk(inlines);
  return { mathRegions, footnoteMarks };
}

/** The atoms wholly inside [start, end), re-based to that slice. */
function clipToSpan(regions: readonly Span[], start: number, end: number): readonly Span[] {
  return regions
    .filter((r) => r.start >= start && r.end <= end)
    .map((r) => ({ start: r.start - start, end: r.end - start }));
}
export function loadGlossInput(
  slug: RouteSlug,
  root: string,
): {
  glossInput: ValidateGlossInput | undefined;
  alignableUnitCount: number;
  issues: readonly AlignmentIssue[];
} {
  const issues: AlignmentIssue[] = [];
  const alignableUnits: GlossAlignableUnit[] = [];

  const blockDir = join(root, `content/source-blocks/${slug}`);
  if (existsSync(blockDir)) {
    for (const file of readdirSync(blockDir).sort()) {
      if (!file.endsWith(".yaml")) continue;
      let record: SourceBlockShape | null;
      try {
        record = parseYaml(readFileSync(join(blockDir, file), "utf8")) as SourceBlockShape | null;
      } catch (err: unknown) {
        issues.push({
          code: "alignment-record-unreadable",
          message:
            `content/source-blocks/${slug}/${file} is on disk and could not be loaded: ` +
            `${err instanceof Error ? err.message : String(err)}. ` +
            "This is not an absence of alignable units.",
        });
        continue;
      }
      const text = record?.diplomaticText;
      if (typeof text !== "string" || typeof record?.id !== "string") continue;
      if (record.kind === "equation") continue;

      const { mathRegions, footnoteMarks } = locateAtoms(text, record.inlines ?? []);

      if (record.kind === "paragraph") {
        for (const entry of record.sentenceSpans ?? []) {
          const start = entry.span?.start;
          const end = entry.span?.end;
          if (
            typeof entry.id !== "string" ||
            typeof start !== "number" ||
            typeof end !== "number"
          ) {
            continue;
          }
          alignableUnits.push({
            id: entry.id,
            text: text.slice(start, end),
            mathRegions: clipToSpan(mathRegions, start, end),
            footnoteMarks: clipToSpan(footnoteMarks, start, end),
          });
        }
        continue;
      }
      alignableUnits.push({ id: record.id, text, mathRegions, footnoteMarks });
    }
  }

  const glossDir = join(root, `content/gloss-units/${slug}`);
  if (!existsSync(glossDir)) {
    return { glossInput: undefined, alignableUnitCount: alignableUnits.length, issues };
  }

  const glossUnits: GlossUnit[] = [];
  for (const file of readdirSync(glossDir).sort()) {
    if (!file.endsWith(".yaml")) continue;
    let record: GlossRecordShape | null;
    try {
      record = parseYaml(readFileSync(join(glossDir, file), "utf8")) as GlossRecordShape | null;
    } catch (err: unknown) {
      issues.push({
        code: "alignment-record-unreadable",
        message:
          `content/gloss-units/${slug}/${file} is on disk and could not be loaded: ` +
          `${err instanceof Error ? err.message : String(err)}. ` +
          "This is not an absence of gloss units.",
      });
      continue;
    }
    if (typeof record?.sentenceId !== "string") continue;
    const tokens = record.tokens ?? [];
    glossUnits.push({
      sentenceId: record.sentenceId,
      ...(typeof record.sourceRevision === "number"
        ? { sourceRevision: record.sourceRevision }
        : {}),
      ...(typeof record.sourceTextDigest === "string"
        ? { sourceTextDigest: record.sourceTextDigest }
        : {}),
      tokens: tokens.map((t) => (typeof t.german === "string" ? t.german : "")),
      // A token with no `english` is not unglossed: 1432 of the corpus's 12505 belong to a
      // multiword unit, which carries the reading for the whole run. Emitting an empty gloss for
      // them would credit coverage nobody authored, and emitting nothing lets the multiword rule
      // decide, which is what C.6 says.
      glosses: tokens.flatMap((t, index) =>
        typeof t.english === "string" && t.english !== ""
          ? [{ tokenIndex: index, text: t.english }]
          : [],
      ),
      multiwords: (record.multiwordUnits ?? []).flatMap((m) =>
        Array.isArray(m.tokenIndices) &&
        m.tokenIndices.every((i): i is number => typeof i === "number") &&
        typeof m.english === "string"
          ? [{ tokenIndices: m.tokenIndices, text: m.english }]
          : [],
      ),
      ...(record.attribution ? { attribution: record.attribution } : {}),
      ...(record.editor ? { editor: record.editor } : {}),
    });
  }

  if (glossUnits.length === 0) {
    return { glossInput: undefined, alignableUnitCount: alignableUnits.length, issues };
  }
  return {
    glossInput: { glossUnits, alignableUnits },
    alignableUnitCount: alignableUnits.length,
    issues,
  };
}

/**
 * THE FIFTH POPULATION: alignment components, and the inline atoms on both sides (rule C.4).
 *
 * C.4 is the rule that says a translation can never silently drop a formula, a cross-paper
 * reference or a footnote mark. Until 2026-10-19 nothing built its input, so for every paper it
 * compared zero components and the runner reported a pass. Measured once it had one: 742
 * components over the four papers, carrying 914 inline math atoms and 22 footnote marks, with
 * every edge endpoint resolving and nothing differing.
 *
 * DISPLAY MATH IS EXCLUDED, and getting that wrong is how this reads as five false findings.
 * C.4 governs "the multiset of INLINE math atoms"; a display is an `equation` block referenced by
 * a `math` inline carrying `display: true`, and its byte identity across the faces is C.3's
 * question, checked by `validateDisplayByteIdentity`. Counting displays here reported `Z = \sum
 * ...` and `p v = R \frac{n}{N} T.` as missing from the English, when the English correctly
 * refers to the shared equation block instead of repeating its LaTeX. Three of the five were in
 * light-quanta's s1-fn3 and two in s5-fn1.
 *
 * REFERENCES ARE AN EMPTY CLASS TODAY, deliberately reported rather than quietly absent: the
 * corpus holds zero `reference` inlines, because the German edition bead authors them at their
 * occurrence. A count of 0 in the returned census is the only thing that distinguishes "checked
 * and agreed" from "there was nothing of this kind to check".
 */
export function loadAlignmentComponents(
  slug: RouteSlug,
  root: string,
): {
  components: readonly AlignmentComponent[];
  examined: Readonly<{
    components: number;
    mathAtoms: number;
    footnoteMarks: number;
    references: number;
    unresolvedSources: number;
    unresolvedTargets: number;
  }>;
  issues: readonly AlignmentIssue[];
} {
  const issues: AlignmentIssue[] = [];
  const germanByUnit = germanUnitContent(slug, root, issues);
  const englishByUnit = englishUnitContent(slug, root, issues);
  const { edges, issues: edgeIssues } = loadAuthoredEdges(slug, root);
  issues.push(...edgeIssues);

  // Connected components of the bipartite edge graph, by union-find over "de:<id>" / "en:<id>".
  const parent = new Map<string, string>();
  const find = (node: string): string => {
    const seen = parent.get(node);
    if (seen === undefined || seen === node) return node;
    const root_ = find(seen);
    parent.set(node, root_);
    return root_;
  };
  const union = (a: string, b: string): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const edge of edges) {
    const de = `de:${edge.sourceId}`;
    const en = `en:${edge.targetId}`;
    if (!parent.has(de)) parent.set(de, de);
    if (!parent.has(en)) parent.set(en, en);
    union(de, en);
  }

  const grouped = new Map<string, { de: string[]; en: string[] }>();
  for (const node of parent.keys()) {
    const root_ = find(node);
    const group = grouped.get(root_) ?? { de: [], en: [] };
    if (node.startsWith("de:")) group.de.push(node.slice(3));
    else group.en.push(node.slice(3));
    grouped.set(root_, group);
  }

  const components: AlignmentComponent[] = [];
  let mathAtoms = 0;
  let footnoteMarks = 0;
  let references = 0;
  let unresolvedSources = 0;
  let unresolvedTargets = 0;

  for (const group of grouped.values()) {
    const germanUnits: UnitContent[] = [];
    for (const id of group.de) {
      const content = germanByUnit.get(id);
      if (!content) {
        unresolvedSources += 1;
        continue;
      }
      germanUnits.push(content);
      mathAtoms += content.mathAtoms?.length ?? 0;
      footnoteMarks += content.footnoteMarks?.length ?? 0;
      references += content.referenceIds?.length ?? 0;
    }
    const englishUnits: UnitContent[] = [];
    for (const id of group.en) {
      const content = englishByUnit.get(id);
      if (!content) {
        unresolvedTargets += 1;
        continue;
      }
      englishUnits.push(content);
    }
    if (germanUnits.length === 0 && englishUnits.length === 0) continue;
    components.push({ germanUnits, englishUnits });
  }

  return {
    components,
    examined: {
      components: components.length,
      mathAtoms,
      footnoteMarks,
      references,
      unresolvedSources,
      unresolvedTargets,
    },
    issues,
  };
}

/**
 * German alignable units with their inline atoms, attributed to the SENTENCE that prints them.
 *
 * A paragraph's atoms belong to its sentences, not to the paragraph, because alignment edges
 * address sentences. They are placed by the same ordered cursor walk `locateAtoms` uses, for the
 * same reason: the inline stream and `diplomaticText` are two renderings of one block and a
 * display equation appears only in the first.
 */
function germanUnitContent(
  slug: RouteSlug,
  root: string,
  issues: AlignmentIssue[],
): Map<string, UnitContent> {
  const out = new Map<string, UnitContent>();
  const dir = join(root, `content/source-blocks/${slug}`);
  if (!existsSync(dir)) return out;

  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith(".yaml")) continue;
    let record: SourceBlockShape | null;
    try {
      record = parseYaml(readFileSync(join(dir, file), "utf8")) as SourceBlockShape | null;
    } catch (err: unknown) {
      issues.push({
        code: "alignment-record-unreadable",
        message:
          `content/source-blocks/${slug}/${file} is on disk and could not be loaded: ` +
          `${err instanceof Error ? err.message : String(err)}. ` +
          "This is not an absence of inline atoms.",
      });
      continue;
    }
    if (typeof record?.id !== "string" || !record.inlines) continue;
    const text = typeof record.diplomaticText === "string" ? record.diplomaticText : "";
    const placed = placeAtoms(text, record.inlines);

    if (record.kind === "paragraph" && record.sentenceSpans) {
      for (const entry of record.sentenceSpans) {
        const start = entry.span?.start;
        const end = entry.span?.end;
        if (typeof entry.id !== "string" || typeof start !== "number" || typeof end !== "number") {
          continue;
        }
        const mine = placed.filter((p) => p.position >= start && p.position < end);
        out.set(entry.id, {
          id: entry.id,
          mathAtoms: mine.filter((p) => p.category === "math").map((p) => p.value),
          footnoteMarks: mine.filter((p) => p.category === "mark").map((p) => p.value),
          referenceIds: mine.filter((p) => p.category === "reference").map((p) => p.value),
        });
      }
    }
    // A paragraph is ALSO addressable as a block: several alignment edges key on the paragraph id
    // rather than on a sentence id, so both spellings must resolve or the component is dropped.
    out.set(record.id, {
      id: record.id,
      mathAtoms: placed.filter((p) => p.category === "math").map((p) => p.value),
      footnoteMarks: placed.filter((p) => p.category === "mark").map((p) => p.value),
      referenceIds: placed.filter((p) => p.category === "reference").map((p) => p.value),
    });
  }
  return out;
}

/** English units' inline atoms, read off the translation records' own inline stream. */
function englishUnitContent(
  slug: RouteSlug,
  root: string,
  issues: AlignmentIssue[],
): Map<string, UnitContent> {
  const out = new Map<string, UnitContent>();
  const dir = join(root, `content/translation-units/${slug}`);
  if (!existsSync(dir)) return out;

  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith(".yaml")) continue;
    let record: { id?: unknown; inlines?: readonly InlineShape[] } | null;
    try {
      record = parseYaml(readFileSync(join(dir, file), "utf8")) as {
        id?: unknown;
        inlines?: readonly InlineShape[];
      } | null;
    } catch (err: unknown) {
      issues.push({
        code: "alignment-record-unreadable",
        message:
          `content/translation-units/${slug}/${file} is on disk and could not be loaded: ` +
          `${err instanceof Error ? err.message : String(err)}. ` +
          "This is not an absence of inline atoms.",
      });
      continue;
    }
    if (typeof record?.id !== "string") continue;
    const mathAtoms: string[] = [];
    const footnoteMarks: string[] = [];
    const referenceIds: string[] = [];
    const walk = (list: readonly InlineShape[]): void => {
      for (const inline of list) {
        if (inline.kind === "math" && typeof inline.latex === "string") {
          if (inline.display !== true) mathAtoms.push(inline.latex);
        } else if (inline.kind === "misprint" && inline.math) {
          if (inline.math.display !== true && typeof inline.math.latex === "string") {
            mathAtoms.push(inline.math.latex);
          }
        } else if (inline.kind === "footnote-mark" && typeof inline.mark === "string") {
          footnoteMarks.push(inline.mark);
        } else if (inline.kind === "reference" && typeof inline.referenceId === "string") {
          referenceIds.push(inline.referenceId);
        }
        if (inline.inlines) walk(inline.inlines);
      }
    };
    walk(record.inlines ?? []);
    out.set(record.id, { id: record.id, mathAtoms, footnoteMarks, referenceIds });
  }
  return out;
}

type PlacedAtom = Readonly<{
  position: number;
  category: "math" | "mark" | "reference";
  value: string;
}>;

/** Atoms with their position in `text`, so a paragraph's can be split among its sentences. */
function placeAtoms(text: string, inlines: readonly InlineShape[]): readonly PlacedAtom[] {
  const placed: PlacedAtom[] = [];
  let cursor = 0;
  const consume = (fragment: string): number => {
    if (fragment === "") return -1;
    const at = text.indexOf(fragment, cursor);
    if (at === -1) return -1;
    cursor = at + fragment.length;
    return at;
  };
  const walk = (list: readonly InlineShape[]): void => {
    for (const inline of list) {
      if (inline.kind === "math" && typeof inline.latex === "string") {
        const at = consume(inline.latex);
        // A display is C.3's question, not C.4's: it is a shared equation block that the English
        // refers to rather than repeats, so counting it reports the English as having dropped it.
        if (inline.display !== true) {
          placed.push({ position: at === -1 ? cursor : at, category: "math", value: inline.latex });
        }
      } else if (inline.kind === "misprint" && inline.math) {
        const latex = typeof inline.math.latex === "string" ? inline.math.latex : "";
        const at = consume(latex);
        if (latex !== "" && inline.math.display !== true) {
          placed.push({ position: at === -1 ? cursor : at, category: "math", value: latex });
        }
      } else if (inline.kind === "footnote-mark" && typeof inline.mark === "string") {
        const at = consume(inline.mark);
        placed.push({ position: at === -1 ? cursor : at, category: "mark", value: inline.mark });
      } else if (inline.kind === "reference" && typeof inline.referenceId === "string") {
        placed.push({ position: cursor, category: "reference", value: inline.referenceId });
        if (inline.inlines) walk(inline.inlines);
      } else if (inline.kind === "text" || inline.kind === "misprint") {
        consume(typeof inline.text === "string" ? inline.text : "");
      } else if (inline.kind === "space") {
        consume(" ");
      } else if (inline.inlines) {
        walk(inline.inlines);
      }
    }
  };
  walk(inlines);
  return placed;
}

/**
 * THE SIXTH POPULATION: term occurrences (rule C.5).
 *
 * Same shape as the four above: `validateTerms` judged `options.terms`, nothing supplied it, and
 * the runner reported a pass having checked no definition at all. Measured once it had one: 30
 * term inlines over the four papers (7 brownian-motion, 8 light-quanta, 7 mass-energy, 8
 * special-relativity), 30 distinct term ids, every definition longer than 80 characters, every
 * German text carrying `lang: de` and every definition `lang: en`.
 *
 * `isOccurrenceSpecific` IS DERIVED, not read, because no record carries it. C.5 says "a
 * definition shared by id across occurrences without an occurrence record fails", so the
 * question is about the SET of occurrences and cannot be answered by looking at one. An
 * occurrence is marked shared when another occurrence of the same `termId` carries a
 * byte-identical definition. Measured today: zero term id occurs twice, so the rule is live but
 * its positive case is unreached by the corpus -- which is exactly why
 * `validateTerms` keeps its own planted negative rather than relying on this.
 *
 * NOTE FOR AN EDITORIAL PANE, not acted on here: 30 annotations over four papers is 7 or 8 per
 * paper, and AGENTS.md names nine period words for annotation in its own list. Whether that is a
 * deliberate small set or a coverage gap is a content question for the term beads; this loader
 * only reports what is authored.
 */
export function loadTermOccurrences(
  slug: RouteSlug,
  root: string,
): { terms: readonly TermOccurrence[]; issues: readonly AlignmentIssue[] } {
  const issues: AlignmentIssue[] = [];
  const dir = join(root, `content/source-blocks/${slug}`);
  if (!existsSync(dir)) return { terms: [], issues };

  type Raw = { blockId: string; index: number; inline: InlineShape };
  const raw: Raw[] = [];

  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith(".yaml")) continue;
    let record: SourceBlockShape | null;
    try {
      record = parseYaml(readFileSync(join(dir, file), "utf8")) as SourceBlockShape | null;
    } catch (err: unknown) {
      issues.push({
        code: "alignment-record-unreadable",
        message:
          `content/source-blocks/${slug}/${file} is on disk and could not be loaded: ` +
          `${err instanceof Error ? err.message : String(err)}. ` +
          "This is not an absence of term occurrences.",
      });
      continue;
    }
    if (typeof record?.id !== "string" || !record.inlines) continue;
    const blockId = record.id;
    let index = 0;
    const walk = (list: readonly InlineShape[]): void => {
      for (const inline of list) {
        if (inline.kind === "term") {
          raw.push({ blockId, index, inline });
          index += 1;
        }
        if (inline.inlines) walk(inline.inlines);
      }
    };
    walk(record.inlines);
  }

  // A definition is "shared" when another occurrence of the same term id repeats it verbatim.
  const byTermId = new Map<string, string[]>();
  for (const item of raw) {
    const termId = typeof item.inline.termId === "string" ? item.inline.termId : "";
    const definition = typeof item.inline.definition === "string" ? item.inline.definition : "";
    const list = byTermId.get(termId) ?? [];
    list.push(definition);
    byTermId.set(termId, list);
  }

  const terms: TermOccurrence[] = raw.map((item) => {
    const termId = typeof item.inline.termId === "string" ? item.inline.termId : "";
    const definition = typeof item.inline.definition === "string" ? item.inline.definition : "";
    const siblings = byTermId.get(termId) ?? [];
    const repeated = siblings.filter((d) => d === definition).length > 1;
    return {
      id: `${item.blockId}#${termId}#${item.index}`,
      termId,
      termText: typeof item.inline.text === "string" ? item.inline.text : "",
      definition,
      ...(typeof item.inline.lang === "string" ? { termLang: item.inline.lang } : {}),
      ...(typeof item.inline.definitionLang === "string"
        ? { definitionLang: item.inline.definitionLang }
        : {}),
      isOccurrenceSpecific: !repeated,
    };
  });

  return { terms, issues };
}
