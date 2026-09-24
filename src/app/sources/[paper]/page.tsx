import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadFirstPages } from "../../../components/home/firstPages.ts";
import "../../../components/home/wideProse.css";
import type { RouteSlug } from "../../../content/ids.ts";
import type { ReceiptFrontMatter, WitnessKind } from "../../../content/provenance/receiptSchema.ts";
import { receiptsByPage } from "../receiptPages.ts";
import "../sources.css";
import { TRANSCRIPTION_WORDS, transcriptionOf } from "../transcription.ts";

/*
 * ONE PAPER'S RECEIPT, AT /sources/<paper>/ (am-design-sources-about-zumd). Addressed by the
 * paper's route slug; the bibliographic key names files and never appears in a URL. The
 * dissertation's page also carries the 1911 correction's receipt, as a section of its own
 * (receiptPages.ts says why), so there is one page per paper and none for the correction.
 *
 * It shows what the receipt records as data: which journal page each scan page is and what it
 * holds, what the transcription was compared against, and how far the transcription has got. The
 * printing-error records are counted here, with the printed pages concerned; their readings are in
 * the correction log on /sources/, labelled as the records' own spelling, because the records
 * transliterate the German ("Ueberlegung") and quoting one as "as printed" would misstate the page.
 */

export const dynamicParams = false;

/** The receipts on this paper's page, the paper's own first; undefined for a slug with none. */
function receiptsFor(paper: string): readonly ReceiptFrontMatter[] | undefined {
  return receiptsByPage().get(paper as RouteSlug);
}

export function generateStaticParams() {
  return [...receiptsByPage().keys()].map((paper) => ({ paper }));
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
  const fm = receiptsFor(paper)?.[0];
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
  const list = receiptsFor(paper);
  const fm = list?.[0];
  if (!list || !fm) notFound();
  const name = nameOf(fm);
  const hasPaperPage = loadFirstPages().some((p) => p.key === fm.key);
  const companions = list.length > 1;
  return (
    <div>
      <header className="page-intro page-flush">
        <p className="eyebrow">Sources</p>
        <h1>{name}</h1>
        <p className="lead" lang="de">
          <i>{fm.paper.titleGerman}</i>
        </p>
        <p>
          {companions
            ? `The receipts for its ${sentenceNumber(list.length).toLowerCase()} scans, one after the other: which page of the journal each scan page is, what each transcription was compared against, and how far it has got.`
            : "The receipt for this paper’s scan: which page of the journal each scan page is, what the transcription was compared against, and how far it has got."}{" "}
          <a href="/sources/">All the scans</a>
          {hasPaperPage ? (
            <>
              {" "}
              &middot; <a href={`/papers/${fm.slug}/`}>Read the paper</a>
            </>
          ) : null}
        </p>
      </header>

      {companions ? (
        list.map((receipt) => (
          <section
            key={receipt.slug}
            id={receipt.slug}
            className="page-flush sources-section"
            aria-labelledby={`${receipt.slug}-name`}
          >
            <h2 id={`${receipt.slug}-name`}>{nameOf(receipt)}</h2>
            <p className="sources-entry-title" lang="de">
              {receipt.paper.titleGerman}
            </p>
            <ReceiptSections fm={receipt} ids={`${receipt.slug}-`} heading="h3" />
          </section>
        ))
      ) : (
        <ReceiptSections fm={fm} ids="receipt-" heading="h2" />
      )}
    </div>
  );
}

/** One receipt's pages, witnesses and state, under headings of the given rank. */
function ReceiptSections({
  fm,
  ids,
  heading: Heading,
}: {
  fm: ReceiptFrontMatter;
  ids: string;
  heading: "h2" | "h3";
}) {
  const errors = fm.typographicalErrors;
  const withdrawn = errors.filter((e) => e.status === "retracted");
  const errorPages = [...new Set(errors.map((e) => e.locator.printedPage))].sort((a, b) => a - b);
  return (
    <>
      <section className="reading page-flush sources-section" aria-labelledby={`${ids}pages`}>
        <Heading id={`${ids}pages`}>Pages</Heading>
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

      <section className="reading page-flush sources-section" aria-labelledby={`${ids}witnesses`}>
        <Heading id={`${ids}witnesses`}>What the transcription is compared against</Heading>
        <p>
          The scan is the primary source. Each record below is a comparison witness: another
          edition, transcription or translation that a reading is checked against, and never the
          source itself.
        </p>
        <ul className="receipt-witnesses">
          {fm.witnesses.map((w) => (
            <li key={`${w.kind}-${w.identity}`}>
              <strong>{WITNESS_LABELS[w.kind]}</strong>, a comparison witness.{" "}
              {w.url ? <a href={w.url}>{w.identity}</a> : w.identity}
              {w.identity.endsWith(".") ? " " : ". "}
              {w.availability === "available"
                ? `Consulted on ${formatDay(w.checkedAt)}.`
                : `Not found when looked for on ${formatDay(w.checkedAt)}.`}
            </li>
          ))}
        </ul>
      </section>

      <section className="reading page-flush sources-section" aria-labelledby={`${ids}state`}>
        <Heading id={`${ids}state`}>How far the transcription has got</Heading>
        <p>{TRANSCRIPTION_WORDS[transcriptionOf(fm.key)]}</p>
        <p>
          {errors.length === 0
            ? "No printing error has been recorded against these pages."
            : `${errors.length === 1 ? "One printing error has" : `${sentenceNumber(errors.length)} printing errors have`} been recorded against these pages, on ${errorPages.length === 1 ? "page" : "pages"} ${errorPages.join(", ")}${withdrawn.length > 0 ? `; ${sentenceNumber(withdrawn.length).toLowerCase()} of them ${withdrawn.length === 1 ? "was" : "were"} later withdrawn, and ${withdrawn.length === 1 ? "is" : "are"} kept with the reason` : ""}. The source keeps what was printed; a correction is only ever offered beside it.`}
          {errors.length > 0 ? (
            <>
              {" "}
              <a href="/sources/#corrections">The correction log</a> lists each one.
            </>
          ) : null}
        </p>
      </section>
    </>
  );
}
