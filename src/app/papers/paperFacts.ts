/**
 * WHAT THE DOOR TO THE EDITION KNOWS ABOUT EACH PAPER, READ RATHER THAN COMPOSED (dispatch 392).
 *
 * /papers/ is where a reader chooses among four 1905 papers, and every figure it shows them is
 * already typed somewhere in this repository. So none of it is written here:
 *
 *   - THE LOCATOR AND THE DATES come from the provenance receipt's own front matter,
 *     docs/provenance/<key>.md, whose journal block carries the series, volume, first and last
 *     page and DOI, and whose `dates` array is typed by kind. The receipt is the record a
 *     reviewer signs; a second copy of it on a page would be the copy that goes stale.
 *   - HOW LONG IT IS is that same page range, last minus first plus one. It is the printed
 *     extent, not a reading time, because a reading time is a guess about the reader.
 *   - THE QUESTION IT OPENS WITH comes from the paper's own first-encounter record,
 *     content/arguments/<slug>/entrance-<slug>.json, which is authored in that paper's language.
 *     The alternative was four blurbs in one voice, which is the thing the dispatch asked me not
 *     to write.
 *   - WHAT IS AND IS NOT FINISHED comes from germanTextState and translationState, the same
 *     loaders the page already used for its "not yet available" line.
 *
 * NOTHING HERE ORDERS THE PAPERS. The order is the journal's receipt order and the page says so;
 * see the note in page.tsx. A `difficulty`, a `startHere`, or a sort by length would be a
 * judgement this site does not make (AGENTS.md: a reader never passes a placement test or is
 * assigned a level, and the five accomplishments are not a ladder of worth).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadProvenanceReceipts } from "../../content/provenance/loadReceipts.ts";

export type PaperFacts = Readonly<{
  slug: string;
  /** "Annalen der Physik (4) 17, 132-148 (1905)", built from the receipt's journal block. */
  locator: string;
  receivedIso: string | undefined;
  publishedIso: string | undefined;
  printedPages: number;
  /** The question the paper's own first-encounter record opens with. */
  question: string | undefined;
}>;

type JournalBlock = Readonly<{
  name?: string;
  series?: number;
  volume?: number;
  pages?: { first?: number; last?: number };
}>;

function isoOf(dates: readonly Record<string, unknown>[], type: string): string | undefined {
  const entry = dates.find((d) => d.type === type);
  return typeof entry?.iso === "string" ? entry.iso : undefined;
}

/** The receipts for the four 1905 papers, keyed by route slug. */
export function paperFacts(root: string = process.cwd()): readonly PaperFacts[] {
  const loaded = loadProvenanceReceipts({
    provenanceDir: join(root, "docs", "provenance"),
    rootDir: root,
    requireLocal: false,
  });
  const facts: PaperFacts[] = [];
  for (const entry of loaded.receipts) {
    // A receipt that failed to parse is skipped rather than shown half-read: the loader reports
    // that separately and this page is not the place a reader learns about it.
    if (entry.receipt === undefined) continue;
    const front = entry.receipt.frontMatter as Record<string, unknown>;
    const slug = typeof front.slug === "string" ? front.slug : undefined;
    if (slug === undefined) continue;
    const paper = (front.paper ?? {}) as Record<string, unknown>;
    const journal = (paper.journal ?? {}) as JournalBlock;
    const dates = Array.isArray(paper.dates) ? (paper.dates as Record<string, unknown>[]) : [];
    const first = journal.pages?.first;
    const last = journal.pages?.last;
    if (journal.name === undefined || first === undefined || last === undefined) continue;
    const published = isoOf(dates, "issue-publication");
    const year = published?.slice(0, 4) ?? "";
    facts.push({
      slug,
      locator: `${journal.name} (${journal.series}) ${journal.volume}, ${first}–${last}${
        year ? ` (${year})` : ""
      }`,
      receivedIso: isoOf(dates, "received"),
      publishedIso: published,
      printedPages: last - first + 1,
      question: entranceQuestion(root, slug),
    });
  }
  return facts;
}

/** The paper's own opening question, or undefined where that record does not exist. */
function entranceQuestion(root: string, slug: string): string | undefined {
  try {
    const file = join(root, "content", "arguments", slug, `entrance-${slug}.json`);
    const record = JSON.parse(readFileSync(file, "utf8")) as { question?: unknown };
    return typeof record.question === "string" ? record.question : undefined;
  } catch {
    // A paper with no first-encounter record shows no question rather than a composed one. The
    // companion dissertation is in that state and is not on this page.
    return undefined;
  }
}

/** "18 March 1905" from an ISO date, or the ISO string where it names no day. */
export function readableDate(iso: string | undefined): string | undefined {
  if (iso === undefined) return undefined;
  const parts = iso.split("-");
  if (parts.length < 3) return iso;
  const [year, month, day] = parts as [string, string, string];
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const name = months[Number(month) - 1];
  return name === undefined ? iso : `${Number(day)} ${name} ${year}`;
}
