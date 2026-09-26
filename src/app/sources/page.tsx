import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "katex";
import type { Metadata } from "next";
import {
  FIRST_PAGE_PLATE_WIDTHS,
  firstPagePlate,
  loadFirstPages,
} from "../../components/home/firstPages.ts";
import "../../components/home/wideProse.css";
import type { PaperDate, RightsStatus } from "../../content/provenance/receiptSchema.ts";
import { receiptToSourceAsset } from "../../content/provenance/receiptToSourceAsset.ts";
import { translationState } from "../../content/translationState.ts";
import { citationOf } from "./citation.ts";
import { correctionLog, LAYER_NAMES, readingParts } from "./corrections.ts";
import { checkedReceipts, receiptHref } from "./receiptPages.ts";
import { requireReceipt, rightsWordsFor, servedScan } from "./refusals.ts";
import { reuseOf, textLayerWords } from "./reuse.ts";
import { licenseDecision, REPOSITORY, rightsLayers, runtimeLibraries } from "./rightsLayers.ts";
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
  return checkedReceipts()
    .map(({ key, receipt }) => {
      const parsed = requireReceipt(receipt, key);
      const fm = parsed.frontMatter;
      const asset = receiptToSourceAsset(parsed);
      const rights = rightsWordsFor(RIGHTS_WORDS, asset.rights.status, key);
      const download = servedScan(fm, asset, key, process.cwd());
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
        reuse: reuseOf(fm),
        textLayer: textLayerWords(fm),
        receipt: receiptHref(fm.slug),
        typographicalErrors: fm.typographicalErrors,
        published,
        plate: plated ? firstPagePlate(key) : undefined,
      };
    })
    .sort((a, b) => a.published.localeCompare(b.published));
}

/** "Copyright: Copyright (c) 2026 ..." reads as "Copyright (c) 2026 ...": the key is already the text's first word. */
function layerStatement(statement: string): string {
  const keyed = /^([^:]+): (.*)$/.exec(statement);
  return keyed?.[1] && keyed[2]?.startsWith(keyed[1]) ? keyed[2] : statement;
}

export default function SourcesPage() {
  const scans = loadScans();
  const layers = rightsLayers(readFileSync(join(process.cwd(), "NOTICE.md"), "utf8"));
  const decision = licenseDecision(
    readFileSync(join(process.cwd(), "docs", "DECISIONS.md"), "utf8"),
  );
  const libraries = runtimeLibraries(process.cwd());
  const translation = translationState(process.cwd());
  // The scans' terms, from their receipts: how many scans each reader-facing wording covers.
  const termsCounts = [...new Set(scans.map((scan) => scan.rights))].map((words) => ({
    words,
    count: scans.filter((scan) => scan.rights === words).length,
  }));
  const nameOf = new Map(scans.map((scan) => [scan.slug, scan.name]));
  const hrefOf = new Map(scans.map((scan) => [scan.slug, scan.receipt]));
  const corrections = correctionLog(
    scans.map((scan) => ({ slug: scan.slug, typographicalErrors: scan.typographicalErrors })),
  );
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
                  {/* The role of this record among the edition's sources: the scan is the
                      printed paper itself, where a receipt's witnesses are only compared with it. */}
                  <dt>Role</dt>
                  <dd>Primary source: the paper as printed, in this scan of the journal.</dd>
                </div>
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
                  <dt>Reuse</dt>
                  <dd>{scan.reuse.words}</dd>
                </div>
                {scan.textLayer ? (
                  <div>
                    <dt>Text layer</dt>
                    <dd>{scan.textLayer}</dd>
                  </div>
                ) : null}
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
                <a href={scan.receipt}>The full receipt</a>
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

      <section className="reading page-flush sources-section" aria-labelledby="edition-policy">
        <h2 id="edition-policy">How the edition treats its sources</h2>
        <ul>
          <li>
            The English translation is the edition&rsquo;s own, made from the German, sentence by
            sentence.
          </li>
          <li>
            Published translations are cited only as comparison witnesses. None is reused, and a
            reading taken from one names it.
          </li>
          {/* One plain line on who made the translation, and no review tally
              (D-2026-09-25-no-review-status-banners). */}
          <li>
            AI agents made the English translation from the German, and agents other than its
            translator checked each passage against the German in two rounds.
          </li>
        </ul>
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
          The English translation on this site is its own, made from the German. The published
          translations (Perrett and Jeffery, 1923; Cowper, 1926; Arons and Peppard, 1965; Beck,
          1989) are not reused. They serve only as witnesses to compare readings against, and a
          reading taken from one will name it. The two older ones are in the public domain in the
          United States by date of publication but not necessarily elsewhere, and the two newer ones
          are in copyright. This is an editorial choice, not a legal opinion.
        </p>
      </section>

      <section className="reading page-flush sources-section" aria-labelledby="sources-layers">
        <h2 id="sources-layers">Rights, layer by layer</h2>
        <p>
          Each part of the edition carries its own terms, as the edition&rsquo;s{" "}
          <a href={`${REPOSITORY}/blob/main/NOTICE.md`}>notice</a> records them. The license for
          what is written here was decided on {formatDay(decision.date)}
          {decision.ownerRatified
            ? ", and the owner has ratified it."
            : ", under authority the owner delegated; the owner has not yet ratified it, and may reopen it."}
        </p>
        <dl className="sources-facts">
          {layers.map((layer) => (
            <div key={layer.id} id={`layer-${layer.id}`}>
              <dt>{layer.name}</dt>
              <dd>
                {layer.statements.map((statement) => layerStatement(statement)).join(" ")}
                {layer.id === "scans"
                  ? ` From their receipts: ${termsCounts
                      .map(
                        ({ words, count }) =>
                          `${words.replace(/\.$/, "")} (${inWords(count)} of the ${inWords(scans.length)} scans).`,
                      )
                      .join(" ")} Each scan’s terms are in its entry above.`
                  : null}
                {layer.id === "libraries" ? (
                  <>
                    The site&rsquo;s dependencies in its package.json, each under the license its
                    own package declares:{" "}
                    {libraries
                      .map((lib) => `${lib.name} (${lib.license ?? "no license declared"})`)
                      .join(", ")}
                    . Every package, the tools that build the site included, is listed with its
                    license in{" "}
                    <a href={`${REPOSITORY}/blob/main/THIRD_PARTY_NOTICES.md`}>
                      the third-party notices
                    </a>
                    .
                  </>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="reading page-flush sources-section" aria-labelledby="corrections">
        <h2 id="corrections">Corrections</h2>
        <p>
          Each suspected misprint in the German is recorded against the page it is on, with what was
          printed and what was probably meant. The German text keeps what was printed: a correction
          is offered beside it, never made in it. A correction that turns out to be wrong is
          withdrawn, and kept with its reason.
        </p>
        <p className="fine">
          Readings are given as each record writes them, which is not always the printed spelling:
          some records write ä as ae and Greek letters by name. The page image is the authority.
        </p>
        <h3 id="corrections-source">{LAYER_NAMES.source}</h3>
        {corrections.source.length === 0 ? (
          <p>No correction has been recorded against it.</p>
        ) : (
          <ol className="sources-corrections">
            {corrections.source.map((c) => (
              <li key={c.id} id={c.id}>
                <p className="fine">
                  Recorded {formatDay(c.recordedAt)} &middot;{" "}
                  <a href={hrefOf.get(c.receiptSlug)}>{nameOf.get(c.receiptSlug)}</a>, page{" "}
                  {c.printedPage}
                  {c.withdrawn ? " \u00b7 withdrawn" : ""}
                </p>
                <p>
                  Printed: <Reading text={c.printed} />
                </p>
                <p>
                  Proposed: <Reading text={c.proposed} />
                </p>
                {c.withdrawn ? (
                  <p>
                    Withdrawn on {formatDay(c.withdrawn.at)}: {c.withdrawn.reason}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
        <h3 id="corrections-translation">{LAYER_NAMES.translation}</h3>
        {corrections.translation.length === 0 ? (
          <p>
            {translation.length === 0
              ? "None: no English translation has been made yet."
              : "No correction has been recorded against it yet."}
          </p>
        ) : (
          <ol className="sources-corrections">
            {corrections.translation.map((c) => (
              <li key={c.id} id={c.id}>
                <p className="fine">
                  Recorded {formatDay(c.recordedAt)} &middot;{" "}
                  <a href={hrefOf.get(c.receiptSlug)}>{nameOf.get(c.receiptSlug)}</a>, page{" "}
                  {c.printedPage}
                </p>
                <p>
                  Was: {c.printed}; now: {c.proposed}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

/** A record's reading in German, its inline formulas set by KaTeX (readingParts, dispatch 270). */
function Reading({ text }: Readonly<{ text: string }>) {
  return (
    <span lang="de">
      {readingParts(text).map((part, i) =>
        part.kind === "text" ? (
          part.value
        ) : (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one reading never reorder
            key={i}
            className="inline-math"
            {...{
              dangerouslySetInnerHTML: {
                __html: renderToString(part.value, {
                  displayMode: false,
                  output: "htmlAndMathml",
                  throwOnError: false,
                  strict: "warn",
                  trust: false,
                }),
              },
            }}
          />
        ),
      )}
    </span>
  );
}
