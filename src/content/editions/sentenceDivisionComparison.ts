/**
 * Compare a manifest's sentence division with the one a segmentation run proposes, keyed on the
 * PRINTED PAGE (am-span-recording-decision-ero2, owner decision 2026-09-21: "Option 3 now,
 * Option 1 later").
 *
 * WHY THE PAGE AND NOT THE SENTENCE ID. The obvious key is the id, and it is wrong. A manifest's
 * paragraph labels are an allocation history, not a function of the text: Brownian's s3 labels
 * run 1, 2, 5, 6, 7, 8 and its s4 runs 1..6 then 9..12, with withdrawn labels and no retirement
 * record. A computed division emits contiguous labels, so past the first gap a shared label names
 * different paragraphs on the two sides and every later comparison reports collision as
 * disagreement. That error was made by hand before this module existed, on exactly this data.
 *
 * The printed page is carried independently by both records and allocated by neither:
 *   - manifest: `locators[].page`, read from the plate;
 *   - ledger:   its own `[[ANNALEN-PAGE n]]` line.
 * Nothing in this repository writes ANNALEN-PAGE from a manifest; it is only parsed and
 * validated, and validateLedger already checks it is strictly increasing, non-duplicated and
 * inside the journal's page range. So the key has an integrity check on one side.
 *
 * WHAT THIS CAN AND CANNOT SEE. It compares how many sentences each side places on a page. It is
 * blind to a boundary that moves WITHIN a page: two divisions with the same per-page count and
 * different cuts are identical to it. It is a screen, not a proof, and it is strictly weaker than
 * comparing recorded spans, which is Option 1 and the destination.
 */

export type PageOutcome = "comparable" | "not-available" | "not-placeable";

export type PageComparison = Readonly<{
  page: number;
  outcome: PageOutcome;
  manifestSentences: number;
  proposedSentences: number;
  /** Only meaningful when outcome is "comparable". */
  agrees: boolean;
  reason?: string | undefined;
}>;

export type DivisionComparison = Readonly<{
  /** Every page the ledger declares, in printed order. */
  pages: readonly PageComparison[];
  /** The denominator, stated rather than implied. */
  totals: Readonly<{
    ledgerPages: number;
    comparable: number;
    notAvailable: number;
    agreeing: number;
    differing: number;
    /** Manifest sentence units carrying no page locator: counted, never silently dropped. */
    unplaceableManifestUnits: number;
    /** Proposed sentences whose text was found on no page, or on more than one. */
    unplaceableProposedSentences: number;
  }>;
}>;

export type ManifestSentenceUnit = Readonly<{
  id: string;
  kind: string;
  locators?: readonly Readonly<{ page?: number | undefined }>[] | undefined;
}>;

export type ProposedSentenceText = Readonly<{ id: string; text: string }>;

const ANNALEN_PAGE = /\[\[ANNALEN-PAGE\s+(\d+)\]\]/g;
const normalize = (value: string): string => value.replace(/\s+/g, " ").trim();

/** The printed pages a ledger declares, each with its own text, in declaration order. */
export function ledgerPages(
  ledgerText: string,
): readonly Readonly<{ page: number; text: string }>[] {
  const out: { page: number; text: string }[] = [];
  let open: { page: number; start: number } | null = null;
  for (const match of ledgerText.matchAll(ANNALEN_PAGE)) {
    const index = match.index ?? 0;
    if (open) out.push({ page: open.page, text: normalize(ledgerText.slice(open.start, index)) });
    open = { page: Number(match[1]), start: index + match[0].length };
  }
  if (open) out.push({ page: open.page, text: normalize(ledgerText.slice(open.start)) });
  return Object.freeze(out);
}

export function compareSentenceDivision(input: {
  ledgerText: string;
  manifestUnits: readonly ManifestSentenceUnit[];
  proposedSentences: readonly ProposedSentenceText[];
}): DivisionComparison {
  const pages = ledgerPages(input.ledgerText);

  // Manifest side: sentences per page, and units that name no page at all.
  const manifestPerPage = new Map<number, number>();
  let unplaceableManifestUnits = 0;
  for (const unit of input.manifestUnits) {
    if (unit.kind !== "sentence") continue;
    const page = unit.locators?.find((l) => typeof l.page === "number")?.page;
    if (typeof page !== "number") {
      // Counted rather than dropped. The case is empty today on every paper, and an empty case
      // that is invisible looks exactly like agreement the first time it stops being empty.
      unplaceableManifestUnits += 1;
      continue;
    }
    manifestPerPage.set(page, (manifestPerPage.get(page) ?? 0) + 1);
  }

  // Proposed side: place each sentence on the page whose text contains it. This is the harness's
  // own derivation and it is an approximation, stated as one: segmentLedger strips the page
  // markers and never populates its blocks' locators, so the page has to be recovered here. A
  // sentence found on no page, or on more than one, is counted separately and never guessed.
  const proposedPerPage = new Map<number, number>();
  let unplaceableProposedSentences = 0;
  for (const sentence of input.proposedSentences) {
    const needle = normalize(sentence.text);
    const hits = needle.length === 0 ? [] : pages.filter((p) => p.text.includes(needle));
    if (hits.length !== 1) {
      unplaceableProposedSentences += 1;
      continue;
    }
    const page = hits[0]?.page as number;
    proposedPerPage.set(page, (proposedPerPage.get(page) ?? 0) + 1);
  }

  const rows: PageComparison[] = [];
  let comparable = 0;
  let notAvailable = 0;
  let agreeing = 0;
  let differing = 0;
  for (const { page } of pages) {
    const manifestSentences = manifestPerPage.get(page) ?? 0;
    const proposedSentences = proposedPerPage.get(page) ?? 0;
    // THE DETERMINATION IS PER PAGE, on whether THIS page has sentence coverage to compare, not
    // per paper on a zero total. A paper with one sentence unit across thirty-one pages clears a
    // per-paper zero-check and then reports thirty phantom disagreements; so does a single empty
    // page on a paper that mostly has coverage.
    if (manifestSentences === 0) {
      notAvailable += 1;
      rows.push({
        page,
        outcome: "not-available",
        manifestSentences,
        proposedSentences,
        agrees: false,
        reason:
          "the manifest places no sentence unit on this page, so there is nothing for a proposed division to disagree with",
      });
      continue;
    }
    comparable += 1;
    const agrees = manifestSentences === proposedSentences;
    if (agrees) agreeing += 1;
    else differing += 1;
    rows.push({ page, outcome: "comparable", manifestSentences, proposedSentences, agrees });
  }

  return Object.freeze({
    pages: Object.freeze(rows),
    totals: Object.freeze({
      ledgerPages: pages.length,
      comparable,
      notAvailable,
      agreeing,
      differing,
      unplaceableManifestUnits,
      unplaceableProposedSentences,
    }),
  });
}

/** One line a reader can act on. Never a bare "6 agree, 6 differ", which hides its denominator. */
export function formatDivisionComparison(slug: string, result: DivisionComparison): string {
  const t = result.totals;
  const head =
    `${slug}: ${t.ledgerPages} ledger pages = ${t.comparable} comparable + ${t.notAvailable} not-available; ` +
    `of the comparable, ${t.agreeing} agree and ${t.differing} differ`;
  const unplaceable =
    t.unplaceableManifestUnits > 0 || t.unplaceableProposedSentences > 0
      ? ` (unplaceable: ${t.unplaceableManifestUnits} manifest unit(s) with no page locator, ${t.unplaceableProposedSentences} proposed sentence(s) not resolvable to one page)`
      : "";
  const deltas = result.pages
    .filter((p) => p.outcome === "comparable" && !p.agrees)
    .map(
      (p) =>
        `p${p.page} ${p.proposedSentences - p.manifestSentences > 0 ? "+" : ""}${p.proposedSentences - p.manifestSentences}`,
    );
  return deltas.length === 0
    ? `${head}${unplaceable}`
    : `${head}${unplaceable}\n  deltas: ${deltas.join(", ")}`;
}
