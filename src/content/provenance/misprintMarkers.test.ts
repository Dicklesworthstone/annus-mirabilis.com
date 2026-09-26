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
 * - no marker names a retracted record, a translation-layer record, or an id no receipt holds;
 * - a block carrying a marker prints exactly its diplomatic text, so marking changes no German
 *   character.
 * The population is every record in every receipt in docs/provenance, and nothing here counts
 * them. A record whose printed reading is written in transliteration ("Ueberlegung", "beta^3") or
 * with an ellipsis does not occur verbatim in a block, and this check does not reach it.
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
}>;
type Marker = Readonly<{ recordId: string; text: string; start: number }>;
type Block = Readonly<{
  id: string;
  slug: string;
  text: string;
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
      });
  }
  return rows;
}

/** Every misprint inline in a block's inlines, with its offset in the block's plain text. */
function markersOf(inlines: readonly unknown[]): Marker[] {
  const out: Marker[] = [];
  let offset = 0;
  const walk = (nodes: readonly unknown[]) => {
    for (const node of nodes) {
      const n = node as { kind?: string; inlines?: unknown[]; text?: string; recordId?: string };
      if (n.kind === "emphasis" && Array.isArray(n.inlines)) {
        walk(n.inlines);
        continue;
      }
      if (n.kind === "misprint")
        out.push({ recordId: String(n.recordId), text: String(n.text), start: offset });
      offset += plainText([node as Inline]).length;
    }
  };
  walk(inlines);
  return out;
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
        blocks.some((b) => b.slug === r.slug && b.text.includes(r.originalReading)),
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
      const at = b.text.indexOf(r.originalReading);
      const inside =
        at >= 0 && m.start >= at && m.start + m.text.length <= at + r.originalReading.length;
      if (b.slug !== r.slug || !inside)
        problems.push(
          `${r.id}: the marker "${m.text}" in ${b.id} is not inside "${r.originalReading}"`,
        );
    }
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
