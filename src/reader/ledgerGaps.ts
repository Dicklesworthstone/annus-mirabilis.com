/**
 * WHICH PRINTED PAGES A PAPER'S GERMAN TEXT DOES NOT HAVE (am-paper-pages-hide-missing-sections-vl4k).
 *
 * The relativity German face said "not yet available" for the whole paper and never said which
 * pages were missing: its ledger has text for printed pages 891 to 912 and bare page markers for
 * 913 to 921. The pages are read from the ledger itself (ledgerPageCoverage), so the sentence
 * shortens as pages are transcribed. Server-only: it reads the ledger from disk.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ledgerPageCoverage, ledgerRelativePath } from "../content/editions/ledgerPresence.ts";
import type { RouteSlug } from "../content/ids.ts";

export type LedgerGaps = Readonly<{ untranscribed: readonly number[]; drafted: readonly number[] }>;

/** The ledger's bare and written printed pages, or null when the paper has no ledger file. */
export function ledgerGaps(slug: RouteSlug, root: string = process.cwd()): LedgerGaps | null {
  const path = join(root, ledgerRelativePath(slug, root));
  if (!existsSync(path)) return null;
  const pages = ledgerPageCoverage(readFileSync(path, "utf8"));
  const numbered = (covered: boolean) =>
    pages.flatMap((p) =>
      p.covered === covered && p.printedPage !== undefined ? [p.printedPage] : [],
    );
  return { untranscribed: numbered(false), drafted: numbered(true) };
}

/** 913-921 as "913–921"; runs joined as "891, 894 and 913–921". */
export function pageRanges(pages: readonly number[]): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const runs: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === (sorted[j] as number) + 1) j++;
    runs.push(j === i ? String(sorted[i]) : `${sorted[i]}–${sorted[j]}`);
    i = j + 1;
  }
  return runs.length <= 1 ? (runs[0] ?? "") : `${runs.slice(0, -1).join(", ")} and ${runs.at(-1)}`;
}
