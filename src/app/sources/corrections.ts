import type {
  ReceiptFrontMatter,
  TypographicalError,
} from "../../content/provenance/receiptSchema.ts";

/*
 * THE CORRECTION LOG on /sources/ (am-design-sources-about-zumd): every suspected misprint recorded
 * in a receipt, dated, against its record's permanent id, with the printed reading kept and the
 * proposed one beside it. Records are read from the receipts and never retyped.
 *
 * Source and translation corrections are kept apart because they are corrections to different
 * texts: a misprint in the 1905 German, and a mistake in the edition's own English. A withdrawn
 * record stays in the log, marked, with the first sentence of its recorded reason, because a log
 * that silently loses its withdrawals cannot show a reviewer what was claimed and taken back.
 */

export type Correction = Readonly<{
  id: string;
  /** The receipt this record belongs to, by its slug (never its bibliographic key). */
  receiptSlug: string;
  printedPage: number;
  recordedAt: string;
  printed: string;
  proposed: string;
  withdrawn: Readonly<{ at: string; reason: string }> | null;
}>;

/** The two texts a correction can be made against, and what each is called on the page. */
export const LAYER_NAMES: Readonly<Record<TypographicalError["layer"], string>> = {
  source: "The German text",
  translation: "The English translation",
};

/** The first sentence of a recorded reason: its verdict, before the evidence that follows it. */
export function firstSentence(text: string): string {
  const match = /^.*?[.!?](?=\s|$)/su.exec(text.trim());
  return (match?.[0] ?? text).trim();
}

/** Every record in every receipt, by layer, newest first; within a day, in page order. */
export function correctionLog(
  receipts: readonly Pick<ReceiptFrontMatter, "slug" | "typographicalErrors">[],
): Readonly<Record<TypographicalError["layer"], readonly Correction[]>> {
  const log: Record<TypographicalError["layer"], Correction[]> = { source: [], translation: [] };
  for (const fm of receipts) {
    for (const record of fm.typographicalErrors) {
      log[record.layer].push({
        id: record.id,
        receiptSlug: fm.slug,
        printedPage: record.locator.printedPage,
        recordedAt: record.recordedAt,
        printed: record.originalReading,
        proposed: record.proposedReading,
        withdrawn:
          record.status === "retracted" && record.retraction
            ? {
                at: record.retraction.retractedAt,
                reason: firstSentence(record.retraction.reason),
              }
            : null,
      });
    }
  }
  const order = (a: Correction, b: Correction) =>
    b.recordedAt.localeCompare(a.recordedAt) ||
    a.printedPage - b.printedPage ||
    a.id.localeCompare(b.id);
  return { source: log.source.sort(order), translation: log.translation.sort(order) };
}

/**
 * A reading as the log sets it: words, and each inline formula the record writes between dollar
 * signs as the block prints it ("für $v = -\infty$, $\nu = \infty$ ist.", dispatch 270), so the
 * page shows the formula set, never its TeX. A reading with no dollar sign is one text part.
 */
export function readingParts(
  reading: string,
): readonly Readonly<{ kind: "text" | "math"; value: string }>[] {
  return reading
    .split(/(\$[^$]*\$)/)
    .filter((part) => part.length > 0)
    .map((part) =>
      part.length > 1 && part.startsWith("$") && part.endsWith("$")
        ? { kind: "math", value: part.slice(1, -1) }
        : { kind: "text", value: part },
    );
}
