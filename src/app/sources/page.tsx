import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import {
  FIRST_PAGE_PLATE_WIDTHS,
  firstPagePlate,
  loadFirstPages,
} from "../../components/home/firstPages.ts";
import "../../components/home/wideProse.css";
import { loadProvenanceReceipts } from "../../content/provenance/loadReceipts.ts";
import type { PaperDate, RightsStatus } from "../../content/provenance/receiptSchema.ts";
import { receiptToSourceAsset } from "../../content/provenance/receiptToSourceAsset.ts";
import { citationOf } from "./citation.ts";
import { assertServedDigest, requireReceipt, rightsWordsFor } from "./refusals.ts";
import { TRANSCRIPTION_WORDS, transcriptionOf } from "./transcription.ts";
import "./sources.css";

export const metadata: Metadata = {
  title: "Sources",
  description:
    "The scans this edition is made from: where each came from, on what terms, its SHA-256 digest, and how far its transcription has got.",
};

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

/** "1905-05-11" -> "11 May 1905", "1905-05" -> "May 1905", at the precision the receipt records. */
function formatDate(date: PaperDate): string {
  const [year, month, day] = date.iso.split("-");
  const name = month ? MONTHS[Number(month) - 1] : undefined;
  if (date.precision === "day" && day && name) return `${Number(day)} ${name} ${year}`;
  if (date.precision === "month" && name) return `${name} ${year}`;
  return String(year);
}

const DATE_LABELS: Readonly<Record<PaperDate["type"], string>> = {
  "date-line": "Dated",
  received: "Received",
  submitted: "Submitted",
  "issue-publication": "Published",
  "later-edition": "Later edition",
};

/** What each rights status says to a reader; a status with no entry stops the build (refusals.ts). */
const RIGHTS_WORDS: Partial<Record<RightsStatus, string>> = {
  "public-domain-image": "The scan itself is in the public domain.",
  "scan-open-terms": "Offered under its host’s open terms.",
};

/** The two companions have no short name on the home page; these are theirs here. */
const COMPANION_NAMES: Readonly<Record<string, string>> = {
  "ap-19-289": "Molecular dimensions, the dissertation",
  "ap-34-591": "The 1911 correction to the dissertation",
};

/** "2026-09-17" -> "17 September 2026". */
function formatDay(iso: string): string {
  return formatDate({ iso, precision: "day" } as PaperDate);
}

const NUMBER_WORDS = [
  "no",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];

/** Six rather than 6 in running prose, up to ten. */
function inWords(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * One entry per provenance receipt, read at build time. The digest is recomputed from the file this
 * site serves, and a file that no longer matches its receipt stops the build: the page states the
 * match, so it has to be true.
 */
function loadScans() {
  const shortNames = new Map(loadFirstPages().map((paper) => [paper.key, paper.title]));
  return loadProvenanceReceipts()
    .receipts.map(({ key, receipt }) => {
      const parsed = requireReceipt(receipt, key);
      const fm = parsed.frontMatter;
      const asset = receiptToSourceAsset(parsed);
      const rights = rightsWordsFor(RIGHTS_WORDS, asset.rights.status, key);
      const served =
        asset.publicationDecision === "publish" && fm.scan.path
          ? join(process.cwd(), fm.scan.path)
          : undefined;
      let download: { href: string; bytes: number } | undefined;
      if (served && existsSync(served)) {
        assertServedDigest(readFileSync(served), asset.sha256, fm.scan.path, key);
        download = {
          href: `/${fm.scan.path.replace(/^public\//, "")}`,
          bytes: statSync(served).size,
        };
      }
      const published = fm.paper.dates.find((d) => d.type === "issue-publication")?.iso ?? "";
      // The scan's first page, cut from this same PDF (scripts/figures/first_page_plates.py), when
      // a plate has been cut for it at every width the srcSet names.
      const plated = FIRST_PAGE_PLATE_WIDTHS.every((width) =>
        existsSync(join(process.cwd(), "public/figures/plates", `${key}-first-page-${width}.webp`)),
      );
      return {
        key,
        slug: fm.slug,
        name: shortNames.get(key) ?? COMPANION_NAMES[key] ?? fm.paper.titleGerman,
        titleGerman: fm.paper.titleGerman,
        journal: fm.paper.journal,
        dates: fm.paper.dates.filter((d) => d.type !== "later-edition"),
        collectedPapers: fm.paper.collectedPapers,
        institution: fm.scan.institution,
        hostItemId: fm.scan.hostItemId,
        parentPageCount: fm.scan.parent?.pageCount,
        asset,
        rights,
        terms: fm.scan.termsStatements ?? [],
        download,
        transcription: transcriptionOf(key),
        citation: citationOf(fm),
        published,
        plate: plated ? firstPagePlate(key) : undefined,
      };
    })
    .sort((a, b) => a.published.localeCompare(b.published));
}

export default function SourcesPage() {
  const scans = loadScans();
  const reviewed = scans.filter((scan) => scan.transcription === "reviewed").length;
  return (
    <div>
      <header className="page-intro page-flush">
        <p className="eyebrow">Sources</p>
        <h1>What this edition is made from</h1>
        <p className="lead">
          The page images on this site are cut from the {inWords(scans.length)} scans below. Each
          entry says where the scan came from, on what terms, which pages of the journal it holds,
          and the digest that identifies the exact file.
        </p>
      </header>

      <section className="page-flush sources-section" aria-labelledby="sources-scans">
        <h2 id="sources-scans">The scans</h2>
        <ol className="sources-list">
          {scans.map((scan) => (
            <li key={scan.key} className="sources-entry">
              <div className="sources-entry-head">
                {scan.plate ? (
                  // The printed first page, beside the entry that describes its scan. The words
                  // beside it name it, so it carries no alt text of its own. A plain img with a
                  // srcSet, as on the home page (firstPagePlate says why).
                  <img
                    className="sources-entry-plate"
                    {...scan.plate}
                    sizes="6rem"
                    width={400}
                    height={662}
                    loading="lazy"
                    decoding="async"
                    alt=""
                  />
                ) : null}
                <div>
                  <h3 className="sources-entry-name">{scan.name}</h3>
                  <p className="sources-entry-title" lang="de">
                    {scan.titleGerman}
                  </p>
                  {scan.plate ? (
                    <p className="sources-entry-page fine">
                      First page, p. {scan.journal.pages.first}
                    </p>
                  ) : null}
                </div>
              </div>
              <dl className="sources-facts">
                <div>
                  <dt>Printed in</dt>
                  <dd>
                    Annalen der Physik, series {scan.journal.series}, volume {scan.journal.volume},
                    pages {scan.journal.pages.first}&ndash;{scan.journal.pages.last} (
                    <a href={`https://doi.org/${scan.journal.doi}`}>doi:{scan.journal.doi}</a>)
                  </dd>
                </div>
                {scan.dates.map((date) => (
                  <div key={`${date.type}-${date.iso}`}>
                    <dt>{DATE_LABELS[date.type]}</dt>
                    <dd>{formatDate(date)}</dd>
                  </div>
                ))}
                {scan.collectedPapers ? (
                  <div>
                    <dt>Collected Papers</dt>
                    <dd>
                      Volume {scan.collectedPapers.volume}, document {scan.collectedPapers.document}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt>Scan</dt>
                  <dd>
                    {scan.institution}, item {scan.hostItemId}: {scan.asset.pageCount} pages
                    {scan.parentPageCount
                      ? ` of its ${scan.parentPageCount}-page scan of the volume`
                      : ""}
                    , retrieved {formatDay(scan.asset.acquisitionDate)}.
                  </dd>
                </div>
                <div>
                  <dt>Terms</dt>
                  <dd>
                    {scan.rights}
                    {scan.terms.map((term) => (
                      <span key={term.url}>
                        {" "}
                        Recorded as: {term.text} <a href={term.url}>Read the terms</a> as they stood
                        on {formatDay(term.retrievedAt)}.
                      </span>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt>SHA-256</dt>
                  <dd>
                    <code className="sources-digest">{scan.asset.sha256}</code>
                    {scan.download ? (
                      <span className="sources-digest-note">
                        The file this site serves has this digest; it was checked when the site was
                        built.
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt>Transcription</dt>
                  <dd>{TRANSCRIPTION_WORDS[scan.transcription]}</dd>
                </div>
                <div>
                  <dt>Cite as</dt>
                  <dd className="sources-cite">{scan.citation}</dd>
                </div>
              </dl>
              <p className="sources-download">
                <a href={`/sources/${scan.slug}/`}>The full receipt</a>
                {scan.download ? (
                  <>
                    {" "}
                    &middot; <a href={scan.download.href}>Download the scan</a>{" "}
                    <span className="fine">PDF, {formatBytes(scan.download.bytes)}</span>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ol>
        <p className="sources-note fine">
          Each paper&rsquo;s page carries the same record in a machine-readable form, with this
          site&rsquo;s own commentary kept as a separate entry. It helps reference managers and
          search engines read the record correctly; it does not decide where, or how, any of them
          lists the paper.
        </p>
      </section>

      <section className="reading page-flush sources-section" aria-labelledby="sources-rights">
        <h2 id="sources-rights">Whose text this is</h2>
        <p>
          The papers were printed in the Annalen der Physik in 1905 and 1906, and the correction in
          1911. Einstein died in 1955, so the German text is in the public domain and may be copied,
          transcribed and translated freely.
        </p>
        <p>
          A scan is a separate thing from the text: the library or archive that made it can set
          terms of its own. Each scan&rsquo;s terms are recorded in its entry above, with the date
          they were read.
        </p>
        <p>
          The English translation on this site will be its own, made from the German. The published
          translations (Perrett and Jeffery, 1923; Cowper, 1926; Arons and Peppard, 1965; Beck,
          1989) are not reused. They serve only as witnesses to compare readings against, and a
          reading taken from one will name it. The two older ones are in the public domain in the
          United States by date of publication but not necessarily elsewhere, and the two newer ones
          are in copyright. This is an editorial choice, not a legal opinion.
        </p>
      </section>

      <section className="reading page-flush sources-section" aria-labelledby="sources-state">
        <h2 id="sources-state">How far the text has got</h2>
        <p>
          {reviewed === 0
            ? "No transcription has yet been reviewed by a second reader."
            : `${inWords(reviewed)} of the ${inWords(scans.length)} transcriptions have been reviewed by a second reader.`}{" "}
          A draft is shown as a draft wherever it appears, and the explanations on this site are new
          writing in modern notation, marked as awaiting review. The English translation has not
          been started.
        </p>
      </section>
    </div>
  );
}
