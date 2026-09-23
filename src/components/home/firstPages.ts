import {
  type LoadReceiptsOptions,
  loadProvenanceReceipts,
} from "../../content/provenance/loadReceipts.ts";

/**
 * The four papers as the journal received them, read from the provenance receipts at build time.
 *
 * Every date and page number on the home page's row of first pages comes from here, and each of
 * those values is in the receipt with its source ("(Eingegangen 27. September 1905.)", p. 641).
 * A receipt that has lost a date stops the build rather than letting the page draw a guess.
 */
export type FirstPagesErrorCode = "missing-receipt" | "missing-day-date" | "not-a-day";

/** A receipt the row cannot be drawn from. Thrown at build time, so the export stops. */
export class FirstPagesError extends Error {
  readonly code: FirstPagesErrorCode;
  constructor(code: FirstPagesErrorCode, message: string) {
    super(message);
    this.name = "FirstPagesError";
    this.code = code;
  }
}

export interface FirstPage {
  readonly key: string;
  readonly slug: string;
  readonly title: string;
  /** The title as printed, from the receipt: Einstein's words, shown as they are and never edited. */
  readonly germanTitle: string;
  /** The receipt's English working title (titleEnglishWorking), the edition's, recorded there. */
  readonly workingTitle: string;
  /** The Annalen volume the paper was printed in (series 4). */
  readonly volume: number;
  readonly received: string;
  readonly printed: string;
  readonly firstPage: number;
  readonly lastPage: number;
  readonly pages: number;
  /** Day of 1905 on which the paper was received, as a fraction of the year: 0 is 1 January. */
  readonly at: number;
}

/** The names the papers index uses, so a paper is called the same thing on both pages. */
const PAPERS: readonly { key: string; title: string }[] = [
  { key: "ap-17-132", title: "Light quanta" },
  { key: "ap-17-549", title: "Brownian motion" },
  { key: "ap-17-891", title: "Special relativity" },
  { key: "ap-18-639", title: "Mass and energy" },
];

const MONTHS = [
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
] as const;

/** "1905-03-18" -> "18 March". Refuses anything that is not a whole day, since the row places it. */
export function dayAndMonth(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match)
    throw new FirstPagesError("not-a-day", `Expected a day-precision date, got "${iso}".`);
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]}`;
}

/** "1905-03-18" -> { day: "18", month: "March" }, for a label set as a numeral over a month. */
export function dayMonthParts(iso: string): { day: string; month: string } {
  const [day = "", month = ""] = dayAndMonth(iso).split(" ");
  return { day, month };
}

/** Fraction of 1905 elapsed at the start of the given day. 1905 is not a leap year. */
export function fractionOf1905(iso: string): number {
  const day = Date.UTC(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10)),
  );
  return (day - Date.UTC(1905, 0, 1)) / (365 * 86_400_000);
}

/**
 * THE PLATE AT THE SCREEN'S DENSITY. Each first page is published at three widths, one crop of the
 * pinned scan: 400px for a 1x screen, 800 and 1200 for 2x and 3x. A plate is at most 390 CSS px
 * wide (the home row at 2560), which a 2x screen draws with 780 device pixels, so the 400px file
 * alone was soft on every high-density screen. The browser picks from srcSet by the `sizes` each
 * page gives, since images.unoptimized means next/image emits no srcset of its own.
 */
export const FIRST_PAGE_PLATE_WIDTHS = [400, 800, 1200] as const;

export function firstPagePlate(key: string): { src: string; srcSet: string } {
  const at = (width: number) => `/figures/plates/${key}-first-page-${width}.webp`;
  return {
    src: at(400),
    srcSet: FIRST_PAGE_PLATE_WIDTHS.map((width) => `${at(width)} ${width}w`).join(", "),
  };
}

/** `options` reaches the receipt loader unchanged; the site passes none and reads docs/provenance. */
export function loadFirstPages(options: LoadReceiptsOptions = {}): readonly FirstPage[] {
  const loaded = loadProvenanceReceipts(options);
  return PAPERS.map(({ key, title }) => {
    const receipt = loaded.receipts.find((r) => r.key === key)?.receipt;
    if (!receipt) throw new FirstPagesError("missing-receipt", `No provenance receipt for ${key}.`);
    const paper = receipt.frontMatter.paper;
    const date = (type: string): string => {
      const found = paper.dates.find((d) => d.type === type && d.precision === "day");
      if (!found) {
        throw new FirstPagesError(
          "missing-day-date",
          `Receipt ${key} has no day-precision "${type}" date.`,
        );
      }
      return found.iso;
    };
    const received = date("received");
    const { first, last } = paper.journal.pages;
    return {
      key,
      slug: receipt.frontMatter.slug,
      title,
      germanTitle: paper.titleGerman,
      workingTitle: paper.titleEnglishWorking,
      volume: paper.journal.volume,
      received,
      printed: date("issue-publication"),
      firstPage: first,
      lastPage: last,
      pages: last - first + 1,
      at: fractionOf1905(received),
    };
  });
}
