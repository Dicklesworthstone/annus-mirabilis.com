/**
 * A misprint the 1905 compositor made is marked on the German face, where it stands, against its
 * receipt record (dispatch 262).
 *
 * Live on 2026-09-26, relativity's German face printed "II. Eektrodynamischer Teil." with nothing
 * to say the slip is the 1905 compositor's (err-typo-p907-1) and not the edition's. AGENTS.md: "The
 * source view keeps the original; a corrected reading may be offered only with an explicit
 * marker." The marker is a `misprint` inline in the source block, wrapping the printed word and
 * naming its record.
 *
 * This file reads the receipts and the source-block records as files, and imports nothing that
 * renders them, so it checks the content whatever the renderer does. It asserts:
 * - every live source-layer record whose printed reading occurs in one of its paper's blocks is
 *   marked exactly once, inside that reading;
 * - every live source-layer record that names no display is written as its block prints it, so
 *   the check above reaches it (dispatch 270);
 * - a misprint inside inline mathematics is marked by a misprint holding that formula, and the
 *   record's correction lies inside it (dispatch 270);
 * - no marker names a retracted record, a translation-layer record, or an id no receipt holds;
 * - a block carrying a marker prints exactly its diplomatic text, so marking changes no German
 *   character.
 * The population is every record in every receipt in docs/provenance, and nothing here counts
 * them.
 *
 * "As its block prints it" is the block's text with each inline formula written as its LaTeX
 * between dollar signs, the markup the search index reads (src/search/documents.ts): "für
 * $v = -\infty$, $\nu = \infty$ ist." A record written in transliteration ("Ueberlegung",
 * "nu = infinity") or with an ellipsis is found in no block, and until 2026-09-26 eight such records
 * went unmarked while this file passed, because a reading it could not find was a reading it did
 * not check. A record that names a display is marked under that display instead
 * (DisplayMisprintNote.tsx, dispatch 266), and is left to displayMisprintNotes.test.tsx.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type Inline, plainText } from "../schemas/inlines.ts";
import { parseReceipt } from "./parseReceipt.ts";
import { parseYaml } from "./yaml.ts";

type RecordRow = Readonly<{
  id: string;
  slug: string;
  layer: string;
  live: boolean;
  originalReading: string;
  proposedReading: string;
  /** The printed display the record's locator names, when it names one. */
  displayId: string | undefined;
}>;
/** A marker, with its text and offset in the block's markup (inline formulas as $latex$). */
type Marker = Readonly<{ recordId: string; text: string; start: number; math: boolean }>;
type Block = Readonly<{
  id: string;
  slug: string;
  text: string;
  /** The block as it prints: its plain text, with each inline formula as $latex$. */
  markup: string;
  diplomaticText: string | undefined;
  markers: readonly Marker[];
}>;

function receiptRecords(): RecordRow[] {
  const dir = "docs/provenance";
  const rows: RecordRow[] = [];
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()) {
    const parsed = parseReceipt(readFileSync(join(dir, file), "utf8"), file);
    const fm = parsed.frontMatter as
      | { slug?: string; typographicalErrors?: readonly Record<string, unknown>[] }
      | undefined;
    for (const r of fm?.typographicalErrors ?? [])
      rows.push({
        id: String(r.id),
        slug: String(fm?.slug),
        layer: String(r.layer),
        live: r.status !== "retracted",
        originalReading: String(r.originalReading),
        proposedReading: String(r.proposedReading),
        displayId: (r.locator as { displayId?: string } | undefined)?.displayId,
      });
  }
  return rows;
}

type RawInline = {
  kind?: string;
  inlines?: unknown[];
  text?: string;
  recordId?: string;
  latex?: string;
  display?: boolean;
  math?: { latex?: string };
};

/**
 * One inline as its block prints it: an inline formula, or a misprint holding one, as $latex$; a
 * display formula as nothing, since its equation block prints it (plainText agrees); anything
 * else as plainText gives it. Read from the record itself, so a renderer change cannot move it.
 */
function markupOf(node: unknown): string {
  const n = node as RawInline;
  if (n.kind === "emphasis" && Array.isArray(n.inlines)) return n.inlines.map(markupOf).join("");
  if (n.kind === "math") return n.display === true ? "" : `$${n.latex ?? ""}$`;
  if (n.kind === "misprint" && n.math) return `$${n.math.latex ?? ""}$`;
  return plainText([node as Inline]);
}

/** Every misprint inline in a block's inlines, with its offset in the block's markup. */
function markersOf(inlines: readonly unknown[]): Marker[] {
  const out: Marker[] = [];
  let offset = 0;
  const walk = (nodes: readonly unknown[]) => {
    for (const node of nodes) {
      const n = node as RawInline;
      if (n.kind === "emphasis" && Array.isArray(n.inlines)) {
        walk(n.inlines);
        continue;
      }
      const printed = markupOf(node);
      if (n.kind === "misprint")
        out.push({ recordId: String(n.recordId), text: printed, start: offset, math: !!n.math });
      offset += printed.length;
    }
  };
  walk(inlines);
  return out;
}

/**
 * Where a record's two readings differ, as [start, end) in its originalReading: the text left
 * once the shared beginning and the shared end are cut away. An insertion gives an empty span.
 */
function correctionSpan(r: RecordRow): [number, number] {
  const a = r.originalReading;
  const b = r.proposedReading;
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a.at(-1 - tail) === b.at(-1 - tail))
    tail++;
  return [head, a.length - tail];
}

/** The $...$ formulas of a reading, as [start, end) spans that include both dollar signs. */
function formulasOf(reading: string): [number, number][] {
  return [...reading.matchAll(/\$[^$]*\$/g)].map((m) => [m.index, m.index + m[0].length]);
}

function blocksOf(slug: string): Block[] {
  const dir = join("content/source-blocks", slug);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .sort()
    .map((f) => {
      const y = parseYaml(readFileSync(join(dir, f), "utf8")) as {
        id: string;
        inlines?: unknown[];
        diplomaticText?: string;
      };
      const inlines = Array.isArray(y.inlines) ? y.inlines : [];
      return {
        id: y.id,
        slug,
        text: plainText(inlines as readonly Inline[]),
        markup: inlines.map(markupOf).join(""),
        diplomaticText: y.diplomaticText,
        markers: markersOf(inlines),
      };
    });
}

const records = receiptRecords();
const slugs = [...new Set(records.map((r) => r.slug))];
const blocks = slugs.flatMap(blocksOf);
const byId = new Map(records.map((r) => [r.id, r]));

describe("printed misprints are marked on the German face, against their receipt records", () => {
  test("every live source-layer record found verbatim in its paper is marked exactly once, inside its reading", () => {
    const due = records.filter(
      (r) =>
        r.live &&
        r.layer === "source" &&
        blocks.some((b) => b.slug === r.slug && b.markup.includes(r.originalReading)),
    );
    // Non-vacuity: err-typo-p907-1 ("II. Eektrodynamischer Teil.") is one of them.
    expect(due.map((r) => r.id)).toContain("err-typo-p907-1");
    const problems: string[] = [];
    for (const r of due) {
      const hits = blocks.flatMap((b) =>
        b.markers.filter((m) => m.recordId === r.id).map((m) => ({ b, m })),
      );
      if (hits.length !== 1) {
        problems.push(`${r.id} ("${r.originalReading}") is marked ${hits.length} times, not once`);
        continue;
      }
      const hit = hits[0];
      if (!hit) continue;
      const { b, m } = hit;
      const at = b.markup.indexOf(r.originalReading);
      const inside =
        at >= 0 && m.start >= at && m.start + m.text.length <= at + r.originalReading.length;
      if (b.slug !== r.slug || !inside)
        problems.push(
          `${r.id}: the marker "${m.text}" in ${b.id} is not inside "${r.originalReading}"`,
        );
    }
    expect(problems).toEqual([]);
  });

  test("every live source-layer record that names no display is written as its block prints it", () => {
    // A record the test above cannot find is a record it does not check. The population is every
    // live source-layer record with no display in its locator; a display's record is marked under
    // the display (DisplayMisprintNote.tsx).
    const population = records.filter((r) => r.live && r.layer === "source" && !r.displayId);
    // Non-vacuity: a record in running text and a record inside an inline formula are both here.
    expect(population.map((r) => r.id)).toContain("err-typo-p907-1");
    expect(population.map((r) => r.id)).toContain("err-typo-p908-1");
    const lost = population
      .filter((r) => !blocks.some((b) => b.slug === r.slug && b.markup.includes(r.originalReading)))
      .map(
        (r) => `${r.id}: "${r.originalReading}" is in no ${r.slug} block as the block prints it`,
      );
    expect(lost).toEqual([]);
  });

  test("a misprint inside an inline formula is marked by a misprint holding that formula, with the correction inside it", () => {
    const inFormula: string[] = [];
    const problems: string[] = [];
    for (const r of records.filter((x) => x.live && x.layer === "source" && !x.displayId)) {
      const [start, end] = correctionSpan(r);
      const formula = formulasOf(r.originalReading).find(([s, e]) => start < e && end > s);
      const hit = blocks
        .filter((b) => b.slug === r.slug && b.markup.includes(r.originalReading))
        .flatMap((b) =>
          b.markers
            .filter((m) => m.recordId === r.id)
            .map((m) => ({ m, at: m.start - b.markup.indexOf(r.originalReading) })),
        )[0];
      if (!formula) {
        if (hit?.m.math)
          problems.push(
            `${r.id}: its correction is in running text, yet its marker holds a formula`,
          );
        continue;
      }
      inFormula.push(r.id);
      // The note sets the whole printed formula and the whole formula meant (misprints.ts), so the
      // correction may not run past the formula's own dollar signs into the words around it.
      if (start < formula[0] || end > formula[1])
        problems.push(
          `${r.id}: the correction runs outside ${r.originalReading.slice(...formula)}`,
        );
      if (!hit) continue; // unmarked: the first test in this file reports it
      if (
        !hit.m.math ||
        hit.at !== formula[0] ||
        hit.m.text !== r.originalReading.slice(...formula)
      )
        problems.push(
          `${r.id}: marked by "${hit.m.text}", not by a misprint holding ${r.originalReading.slice(...formula)}`,
        );
    }
    // Non-vacuity: p. 908's dropped comma stands inside the inline formula (X', Y' Z').
    expect(inFormula).toContain("err-typo-p908-1");
    expect(problems).toEqual([]);
  });

  test("no marker names a retracted record, a translation-layer record, or an unknown id", () => {
    const marked = blocks.flatMap((b) => b.markers.map((m) => ({ b, m })));
    const problems = marked
      .map(({ b, m }) => {
        const r = byId.get(m.recordId);
        if (!r) return `${b.id}: marker "${m.text}" names no receipt record (${m.recordId})`;
        if (!r.live) return `${b.id}: marker "${m.text}" names the retracted record ${r.id}`;
        if (r.layer !== "source") return `${b.id}: ${r.id} is a ${r.layer}-layer record`;
        if (r.slug !== b.slug) return `${b.id}: ${r.id} belongs to ${r.slug}, not ${b.slug}`;
        return null;
      })
      .filter((p): p is string => p !== null);
    expect(problems).toEqual([]);
    // Non-vacuity for the retraction half: a retracted record's printed reading is on the face, so
    // leaving it unmarked is a decision this test sees. err-typo-p899-1's "auf die H- und
    // Z-Achse angewandt" stands in relativity s3-p10.
    const retracted = byId.get("err-typo-p899-1");
    expect(retracted?.live).toBe(false);
    expect(blocks.some((b) => b.text.includes(retracted?.originalReading ?? "\u0000"))).toBe(true);
  });

  test("a block carrying a marker prints exactly its diplomatic text", () => {
    const marked = blocks.filter((b) => b.markers.length > 0);
    expect(marked.length).toBeGreaterThan(0);
    for (const b of marked) expect(b.text, b.id).toBe(b.diplomaticText ?? "");
  });
});
