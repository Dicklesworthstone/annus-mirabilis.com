/**
 * The printed misprints a German face may mark, read from the receipts (dispatch 262).
 *
 * A `misprint` inline in a source block names a record in a receipt's typographicalErrors list.
 * This module gives the renderer what that record says: the word meant and why, both read from
 * the receipt and never retyped. Only a live record of the source layer is returned. A retracted
 * record, or one about the edition's English, is not, so a marker naming one renders as the
 * plain printed word.
 *
 * Server-only (it reads docs/provenance), and read once per process.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseReceipt } from "./parseReceipt.ts";

export type MisprintNote = Readonly<{
  recordId: string;
  /** The receipt's slug, which names its paper. */
  slug: string;
  /** The printed word or words the record corrects, cut from its originalReading. */
  printed: string;
  /** The same place in its proposedReading: the word meant. */
  reading: string;
  /** The first sentence of the record's reasoning. */
  reason: string;
}>;

/**
 * The span where two readings differ, widened to whole words, as [start, printedEnd, readingEnd].
 * The shared prefix and suffix are cut off, then the cut is moved out to the nearest word edges.
 * The widening happens inside the shared text, so both readings move by the same amount.
 */
export function differingWords(printed: string, reading: string): [number, number, number] {
  let head = 0;
  while (head < printed.length && head < reading.length && printed[head] === reading[head]) head++;
  let tail = 0;
  while (
    tail < printed.length - head &&
    tail < reading.length - head &&
    printed[printed.length - 1 - tail] === reading[reading.length - 1 - tail]
  )
    tail++;
  const word = /[\p{L}\p{N}'’]/u;
  let start = head;
  while (start > 0 && word.test(printed[start - 1] ?? "")) start--;
  let grow = 0;
  while (grow < tail && word.test(printed[printed.length - tail + grow] ?? "")) grow++;
  return [start, printed.length - tail + grow, reading.length - tail + grow];
}

function firstSentence(text: string): string {
  const match = /^.*?[.!?](?=\s|$)/su.exec(text.trim());
  return (match?.[0] ?? text).trim();
}

let notes: ReadonlyMap<string, MisprintNote> | null = null;

/** Every live source-layer record in docs/provenance, by id. */
export function misprintNotes(dir = "docs/provenance"): ReadonlyMap<string, MisprintNote> {
  if (notes && dir === "docs/provenance") return notes;
  const out = new Map<string, MisprintNote>();
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()) {
    const parsed = parseReceipt(readFileSync(join(dir, file), "utf8"), file);
    if (!parsed.ok || !parsed.frontMatter) continue;
    const { slug, typographicalErrors } = parsed.frontMatter;
    for (const r of typographicalErrors ?? []) {
      if (r.layer !== "source" || r.status === "retracted") continue;
      const [start, printedEnd, readingEnd] = differingWords(r.originalReading, r.proposedReading);
      out.set(r.id, {
        recordId: r.id,
        slug,
        printed: r.originalReading.slice(start, printedEnd),
        reading: r.proposedReading.slice(start, readingEnd),
        reason: firstSentence(r.reasoning),
      });
    }
  }
  if (dir === "docs/provenance") notes = out;
  return out;
}
