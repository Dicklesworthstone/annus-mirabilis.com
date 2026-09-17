/**
 * Page-map lookups and indexing for the PDF facsimile reading face (am-read-facsimile-face-er0).
 * Connects validated locators, receipt page mappings, and edition sections/equations.
 */

import type {
  ContentsType,
  DisplayEquations,
  PageMapEntry,
} from "../../content/provenance/receiptSchema.ts";

export type FormattedPageEntry = Readonly<{
  pdfPageIndex: number;
  printedPage: number | null;
  printedPageLabel: string;
  contents: readonly ContentsType[];
  sectionIds: readonly string[];
  displayEquations: DisplayEquations;
  footnoteMarks: readonly string[];
  refinedBy?: string | undefined;
  isOtherArticle: boolean;
}>;

export interface PageMapIndex {
  readonly totalPages: number;
  readonly entries: readonly FormattedPageEntry[];
  getPage(pdfPageIndex: number): FormattedPageEntry | undefined;
  getSectionPages(sectionId: string): readonly number[];
  getEquationPage(equationId: string): number | null;
  clampPage(page: number): number;
  isOtherArticle(pdfPageIndex: number): boolean;
  getAllPages(): readonly FormattedPageEntry[];
}

export function formatPrintedPageLabel(
  printedPage: number | null,
  contents?: readonly ContentsType[],
): string {
  if (printedPage !== null && printedPage !== undefined) {
    return String(printedPage);
  }
  if (contents?.includes("front-matter")) return "Front matter";
  if (contents?.includes("back-matter")) return "Back matter";
  if (contents?.includes("plate")) return "Plate";
  if (contents?.includes("usage-notice")) return "Notice";
  return "Cover";
}

export function buildPageMapIndex(pageMap: readonly PageMapEntry[]): PageMapIndex {
  const entries: FormattedPageEntry[] = pageMap.map((entry) => {
    const isOther = entry.contents.includes("other-article");
    return {
      pdfPageIndex: entry.pdfPageIndex,
      printedPage: entry.printedPage,
      printedPageLabel: formatPrintedPageLabel(entry.printedPage, entry.contents),
      contents: entry.contents,
      sectionIds: entry.sectionIds ?? [],
      displayEquations: entry.displayEquations ?? { numbered: [] },
      footnoteMarks: entry.footnoteMarks ?? [],
      refinedBy: entry.refinedBy,
      isOtherArticle: isOther,
    };
  });

  const byIndex = new Map<number, FormattedPageEntry>();
  const sectionToPages = new Map<string, number[]>();
  const equationToPage = new Map<string, number>();

  for (const entry of entries) {
    byIndex.set(entry.pdfPageIndex, entry);
    for (const secId of entry.sectionIds) {
      const existing = sectionToPages.get(secId) ?? [];
      existing.push(entry.pdfPageIndex);
      sectionToPages.set(secId, existing);
    }
    for (const eqNum of entry.displayEquations.numbered) {
      equationToPage.set(eqNum, entry.pdfPageIndex);
    }
    for (const eqId of entry.displayEquations.unnumberedIds ?? []) {
      equationToPage.set(eqId, entry.pdfPageIndex);
    }
  }

  const totalPages = entries.length;

  return {
    totalPages,
    entries,
    getPage(pdfPageIndex: number) {
      return byIndex.get(pdfPageIndex);
    },
    getSectionPages(sectionId: string) {
      return sectionToPages.get(sectionId) ?? [];
    },
    getEquationPage(equationId: string) {
      return equationToPage.get(equationId) ?? null;
    },
    clampPage(page: number) {
      if (typeof page !== "number" || isNaN(page) || page < 1) return 1;
      if (page > totalPages && totalPages > 0) return totalPages;
      return Math.floor(page);
    },
    isOtherArticle(pdfPageIndex: number) {
      return byIndex.get(pdfPageIndex)?.isOtherArticle ?? false;
    },
    getAllPages() {
      return entries;
    },
  };
}
