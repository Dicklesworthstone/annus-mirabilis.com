/**
 * Receipt page-map reconciliation.
 *
 * The receipt page map is evidence, not decoration: `resolveEquationPage` reads
 * `displayEquations.numbered` and `displayEquations.unnumberedIds` to answer which facsimile
 * page an equation sits on, and it answers `null` for every equation the map omits. Nothing in
 * the tree compared a page map with the manifest it describes until 2026-09-19, so a receipt
 * could disagree with its own manifest indefinitely without any lane going red. The Brownian
 * receipt did: twelve stub entries, thirty-three disagreements.
 *
 * Bead: am-edn-inventory-brownian-slg, extended to the other three papers on request.
 */

/**
 * A single disagreement between the receipt's `pageMap` and the manifest.
 *
 * The receipt page map is evidence, not decoration: `resolveEquationPage` reads
 * `displayEquations.numbered` and `displayEquations.unnumberedIds` to answer which
 * facsimile page an equation sits on, and it answers `null` for every equation the
 * map omits. Until 2026-09-19 this paper's twelve entries were the pre-refinement
 * stub, so that lookup was silently empty for all 43 displays, `footnoteMarks` was
 * empty on the three marked pages, and four pages named the wrong sections.
 */
export type PageMapMismatch = Readonly<{
  printedPage: number;
  field: "sectionIds" | "numbered" | "unnumberedIds" | "footnoteMarks" | "refinedBy";
  receipt: readonly string[];
  manifest: readonly string[];
}>;

export type PageMapEntryLike = Readonly<{
  printedPage: number | null;
  sectionIds?: readonly string[] | undefined;
  displayEquations?:
    | Readonly<{
        numbered?: readonly string[] | undefined;
        unnumberedIds?: readonly string[] | undefined;
      }>
    | undefined;
  footnoteMarks?: readonly string[] | undefined;
  refinedBy?: string | undefined;
}>;

export type ManifestUnitLike = Readonly<{
  id: string;
  kind: string;
  section?: string | undefined;
  locators: readonly Readonly<{ page: number }>[];
  originalLabel?: string | undefined;
  footnoteMark?: string | undefined;
  markPage?: number | undefined;
}>;

const BROWNIAN_SECTION_IDS = ["s0", "s1", "s2", "s3", "s4", "s5"] as const;

const sorted = (values: Iterable<string>): string[] => [...values].sort();

/**
 * Reconciles a receipt page map against the manifest it describes, page by page.
 *
 * Pure so a test can plant a negative by perturbing a copy of either side.
 */
export function reconcilePageMapAgainstManifest(
  units: readonly ManifestUnitLike[],
  pageMap: readonly PageMapEntryLike[],
  refinedBy: string,
  sectionIds: readonly string[] = BROWNIAN_SECTION_IDS,
): PageMapMismatch[] {
  const sections = new Map<number, Set<string>>();
  const numbered = new Map<number, string[]>();
  const unnumbered = new Map<number, string[]>();
  const footnotes = new Map<number, string[]>();
  const push = (index: Map<number, string[]>, page: number, value: string): void => {
    const bucket = index.get(page);
    if (bucket) bucket.push(value);
    else index.set(page, [value]);
  };

  for (const unit of units) {
    const pages = unit.locators.map((locator) => locator.page);
    const first = pages[0];
    if (first === undefined) continue;
    // Paper 4 has no printed sections and its manifest omits the field entirely, so the id
    // prefix stands in: the id scheme puts every unit of an unsectioned paper under `s0`.
    const section = unit.section ?? (/^s\d+-/.test(unit.id) ? unit.id.split("-")[0] : undefined);
    if (section !== undefined && sectionIds.includes(section)) {
      for (const page of pages) {
        const bucket = sections.get(page);
        if (bucket) bucket.add(section);
        else sections.set(page, new Set([section]));
      }
    }
    if (unit.kind === "display-equation") {
      // A display broken across a page break belongs to both pages, and the receipt lists it on
      // both. Only `eq-s6-d2` of the relativity paper does this today, but attributing a display
      // to its first locator alone would report that correct entry as a defect.
      for (const page of pages) {
        if (unit.originalLabel !== undefined) push(numbered, page, unit.originalLabel);
        else push(unnumbered, page, unit.id);
      }
    }
    if (unit.kind === "footnote" && unit.footnoteMark !== undefined) {
      push(footnotes, unit.markPage ?? first, unit.footnoteMark);
    }
  }

  const mismatches: PageMapMismatch[] = [];
  const compare = (
    printedPage: number,
    field: PageMapMismatch["field"],
    receipt: readonly string[],
    manifest: readonly string[],
  ): void => {
    const left = sorted(receipt);
    const right = sorted(manifest);
    if (left.length !== right.length || left.some((value, index) => value !== right[index])) {
      mismatches.push({ printedPage, field, receipt: left, manifest: right });
    }
  };

  for (const entry of pageMap) {
    const page = entry.printedPage;
    // A receipt may carry an entry for a scan page outside the article's printed range; it has
    // no printed page number and no manifest units, so there is nothing to reconcile it against.
    if (page === null) continue;
    compare(page, "sectionIds", entry.sectionIds ?? [], [...(sections.get(page) ?? [])]);
    compare(page, "numbered", entry.displayEquations?.numbered ?? [], numbered.get(page) ?? []);
    compare(
      page,
      "unnumberedIds",
      entry.displayEquations?.unnumberedIds ?? [],
      unnumbered.get(page) ?? [],
    );
    compare(page, "footnoteMarks", entry.footnoteMarks ?? [], footnotes.get(page) ?? []);
    // `receipt-pagemap-refined-no-unnumbered-ids` in checkReceipt.ts refuses a `refinedBy`
    // stamp on an entry whose `unnumberedIds` is empty, so a page that prints no display
    // equation cannot carry the stamp however carefully it was read. The stamp is therefore
    // required exactly on the pages that have one. This is also why three of relativity's
    // thirty-one entries and three of light-quanta's seventeen are unstamped: those six are
    // the zero-display pages, not pages nobody checked.
    const stampable = (unnumbered.get(page) ?? []).length > 0;
    const expectedStamp = stampable ? [refinedBy] : [];
    const actualStamp = entry.refinedBy === undefined ? [] : [entry.refinedBy];
    compare(page, "refinedBy", actualStamp, expectedStamp);
  }
  return mismatches;
}
