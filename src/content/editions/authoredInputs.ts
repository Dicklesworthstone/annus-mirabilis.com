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
  type AlignmentIssue,
  type ExplicitEdge,
  edgesFromAlignment,
  type GlossAlignableUnit,
  type GlossUnit,
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
  math?: Readonly<{ latex?: unknown }> | undefined;
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
