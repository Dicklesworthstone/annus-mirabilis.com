import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadFirstPages } from "../../../components/home/firstPages.ts";
import "../../../components/home/wideProse.css";
import { loadProvenanceReceipts } from "../../../content/provenance/loadReceipts.ts";
import type { ReceiptFrontMatter, WitnessKind } from "../../../content/provenance/receiptSchema.ts";
import "../sources.css";
import { TRANSCRIPTION_WORDS, transcriptionOf } from "../transcription.ts";

/*
 * ONE PAPER'S RECEIPT, AT /sources/<paper>/ (am-design-sources-about-zumd). Addressed by the
 * paper's route slug; the bibliographic key names files and never appears in a URL.
 *
 * It shows what the receipt records as data: which journal page each scan page is and what it
 * holds, what the transcription was compared against, and how far the transcription has got. The
 * printing-error records are shown as a count and the printed pages concerned, not their text: the
 * records are working notes, with the German transliterated ("Ueberlegung"), and quoting one as
 * "as printed" would misstate the page.
 */

export const dynamicParams = false;

function receipts(): ReceiptFrontMatter[] {
  return loadProvenanceReceipts().receipts.flatMap(({ receipt }) =>
    receipt ? [receipt.frontMatter] : [],
  );
}

export function generateStaticParams() {
  return receipts().map((fm) => ({ paper: fm.slug }));
}

const COMPANION_NAMES: Readonly<Record<string, string>> = {
  "molecular-dimensions": "Molecular dimensions, the dissertation",
  "molecular-dimensions-correction": "The 1911 correction to the dissertation",
};

function nameOf(fm: ReceiptFrontMatter): string {
  return (
    loadFirstPages().find((p) => p.key === fm.key)?.title ??
    COMPANION_NAMES[fm.slug] ??
    fm.paper.titleGerman
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ paper: string }>;
}): Promise<Metadata> {
  const { paper } = await params;
  const fm = receipts().find((r) => r.slug === paper);
  return fm
    ? {
        title: `Sources: ${nameOf(fm)}`,
        description: `Where each page of the scan of "${fm.paper.titleGerman}" sits in Annalen der Physik, what its transcription was compared against, and how far it has got.`,
      }
    : {};
}

const WITNESS_LABELS: Readonly<Record<WitnessKind, string>> = {
  "collected-papers": "Collected Papers",
  augsburg: "Augsburg facsimile",
  wikisource: "Wikisource transcription",
  "historical-translation": "Published translation",
  other: "Other",
};

/** "s0" is the unnumbered opening; "s4" is §4. */
function sectionLabel(id: string): string {
  const n = /^s(\d+)$/.exec(id)?.[1];
  if (n === undefined) return id;
  return n === "0" ? "Opening" : `§${n}`;
}

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

const NUMBER_WORDS = [
  "No",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
];

/** "Eight" rather than "8" at the start of a sentence, up to ten. */
function sentenceNumber(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

/** "2026-09-17" -> "17 September 2026". */
function formatDay(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}

export default async function ReceiptPage({ params }: { params: Promise<{ paper: string }> }) {
  const { paper } = await params;
  const fm = receipts().find((r) => r.slug === paper);
  if (!fm) notFound();
  const name = nameOf(fm);
  const hasPaperPage = loadFirstPages().some((p) => p.key === fm.key);
  const errors = fm.typographicalErrors;
  const withdrawn = errors.filter((e) => e.status === "retracted");
  const errorPages = [...new Set(errors.map((e) => e.locator.printedPage))].sort((a, b) => a - b);
  return (
    <div>
      <header className="page-intro page-flush">
        <p className="eyebrow">Sources</p>
        <h1>{name}</h1>
        <p className="lead" lang="de">
          <i>{fm.paper.titleGerman}</i>
        </p>
        <p>
          The receipt for this paper&rsquo;s scan: which page of the journal each scan page is, what
          the transcription was compared against, and how far it has got.{" "}
          <a href="/sources/">All the scans</a>
          {hasPaperPage ? (
            <>
              {" "}
              &middot; <a href={`/papers/${fm.slug}/`}>Read the paper</a>
            </>
          ) : null}
        </p>
      </header>

      <section className="page-flush sources-section" aria-labelledby="receipt-pages">
        <h2 id="receipt-pages">Pages</h2>
        <table className="receipt-pages">
          <thead>
            <tr>
              <th scope="col">Scan page</th>
              <th scope="col">Journal page</th>
              <th scope="col">Sections on it</th>
            </tr>
          </thead>
          <tbody>
            {fm.pageMap.map((page) => (
              <tr key={page.pdfPageIndex}>
                <td>{page.pdfPageIndex}</td>
                <td>{page.printedPage}</td>
                <td>{page.sectionIds.map(sectionLabel).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="reading page-flush sources-section" aria-labelledby="receipt-witnesses">
        <h2 id="receipt-witnesses">What the transcription is compared against</h2>
        <ul className="receipt-witnesses">
          {fm.witnesses.map((w) => (
            <li key={`${w.kind}-${w.identity}`}>
              <strong>{WITNESS_LABELS[w.kind]}.</strong>{" "}
              {w.url ? <a href={w.url}>{w.identity}</a> : w.identity}
              {w.identity.endsWith(".") ? " " : ". "}
              {w.availability === "available"
                ? `Consulted on ${formatDay(w.checkedAt)}.`
                : `Not found when looked for on ${formatDay(w.checkedAt)}.`}
            </li>
          ))}
        </ul>
      </section>

      <section className="reading page-flush sources-section" aria-labelledby="receipt-state">
        <h2 id="receipt-state">How far the transcription has got</h2>
        <p>{TRANSCRIPTION_WORDS[transcriptionOf(fm.key)]}</p>
        <p>
          {errors.length === 0
            ? "No printing error has been recorded against these pages."
            : `${errors.length === 1 ? "One printing error has" : `${sentenceNumber(errors.length)} printing errors have`} been recorded against these pages, on ${errorPages.length === 1 ? "page" : "pages"} ${errorPages.join(", ")}${withdrawn.length > 0 ? `; ${sentenceNumber(withdrawn.length).toLowerCase()} of them ${withdrawn.length === 1 ? "was" : "were"} later withdrawn, and ${withdrawn.length === 1 ? "is" : "are"} kept with the reason` : ""}. The source keeps what was printed; a correction is only ever offered beside it.`}
        </p>
      </section>
    </div>
  );
}
