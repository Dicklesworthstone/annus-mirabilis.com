import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { dayAndMonth, loadFirstPages } from "../../components/home/firstPages.ts";
import "../../components/home/wideProse.css";
import { loadProvenanceReceipts } from "../../content/provenance/loadReceipts.ts";
import "./about.css";
import { attributionFrom, dayDate, publicationDate, requireFound } from "./refusals.ts";

export const metadata: Metadata = {
  title: "About",
  description:
    "What this edition is, why it counts four papers and keeps a fifth beside them, how it is made, its license, and how to cite it.",
};

const REPOSITORY = "https://github.com/Dicklesworthstone/annus-mirabilis.com";
const DISSERTATION_KEY = "ap-19-289";
const CORRECTION_KEY = "ap-34-591";

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

/** "1906-01-18" -> "January 1906". */
function monthAndYear(iso: string): string {
  const [year, month] = iso.split("-");
  return `${MONTHS[Number(month) - 1]} ${year}`;
}

/**
 * The attribution the license asks for, read from NOTICE.md at build time: the one text block under
 * "## Attribution". It is never retyped here, so the page cannot drift from the notice; a notice
 * without the block stops the build (refusals.ts).
 */
function loadAttribution(): string {
  return attributionFrom(readFileSync(join(process.cwd(), "NOTICE.md"), "utf8"));
}

/** The dates of the count note, from the receipts; a missing one stops the build. */
function loadCount() {
  const papers = loadFirstPages();
  const receipts = loadProvenanceReceipts().receipts;
  const datesOf = (key: string) =>
    requireFound(receipts.find((r) => r.key === key)?.receipt, key).frontMatter.paper;
  const dissertation = datesOf(DISSERTATION_KEY);
  const dated = (type: "date-line" | "submitted" | "issue-publication") =>
    dayDate(dissertation.dates, type, DISSERTATION_KEY);
  const correctionYear = publicationDate(datesOf(CORRECTION_KEY).dates, CORRECTION_KEY);
  return {
    received: papers.map((paper) => unbroken(dayAndMonth(paper.received))),
    dissertationTitle: dissertation.titleGerman,
    dissertationDated: unbroken(dayAndMonth(dated("date-line"))),
    dissertationSubmitted: unbroken(dayAndMonth(dated("submitted"))),
    dissertationPrinted: monthAndYear(dated("issue-publication")),
    correctionYear: correctionYear.slice(0, 4),
  };
}

/** "18 March" never breaks between the day and the month. */
function unbroken(date: string): string {
  return date.replace(" ", "\u00a0");
}

/** "18 March, 11 May, 30 June and 27 September". */
function listed(items: readonly string[]): string {
  return items.length < 2
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export default function AboutPage() {
  const count = loadCount();
  const attribution = loadAttribution();
  return (
    <div>
      <header className="page-intro page-flush">
        <p className="eyebrow">About</p>
        <h1>About this edition</h1>
        <p className="lead">
          Annus Mirabilis is an edition, in preparation, of the four papers Albert Einstein sent to
          the Annalen der Physik in 1905, with his doctoral dissertation beside them. Each paper is
          explained at the depth you choose, and its instruments work out what follows when you
          change an assumption.
        </p>
      </header>

      <section className="reading page-flush about-section" aria-labelledby="count-note">
        <h2 id="count-note">Four papers, or five</h2>
        <p>
          Four papers reached the Annalen der Physik in 1905, received on {listed(count.received)},
          and all four were printed that year. A fifth piece of work comes from the same months.
          Einstein dated his doctoral dissertation, <i lang="de">{count.dissertationTitle}</i>, in
          Bern on {count.dissertationDated} 1905 and submitted it at Zürich on{" "}
          {count.dissertationSubmitted}. The Annalen printed it in {count.dissertationPrinted}, and
          he published a correction to it in {count.correctionYear}.
        </p>
        <p>
          Counting the dissertation makes five. This edition reads the four papers in full and keeps
          the dissertation and its correction beside them as a companion.
        </p>
      </section>

      <section className="reading page-flush about-section" aria-labelledby="about-method">
        <h2 id="about-method">How it is made</h2>
        <p>
          Every page image is cut from a scan whose source, terms and digest are listed on{" "}
          <a href="/sources/">Sources</a>, with how far each transcription has got.
        </p>
        <p>
          The German text is transcribed from those page images, and a transcription stays a draft
          until a second reader has checked it against the page. The explanations and lessons are
          new writing in modern notation, drafted with AI assistance, and each is marked as awaiting
          review until it has been checked. The English translation, which will be made from the
          German, has not been started.
        </p>
        <p>
          Every number an instrument shows is worked out by that instrument and labelled as a
          calculation. None of them is a measurement of nature.
        </p>
      </section>

      <section className="reading page-flush about-section" aria-labelledby="about-license">
        <h2 id="about-license">License</h2>
        <p>
          Einstein&rsquo;s German text is in the public domain. Each scan carries its host&rsquo;s
          terms, listed on <a href="/sources/">Sources</a>. Everything written for this edition, the
          explanations, the code and in time the translation, is under the{" "}
          <a href={`${REPOSITORY}/blob/main/LICENSE`}>
            MIT License with the OpenAI/Anthropic Rider
          </a>
          . The fonts are under the SIL Open Font License. The{" "}
          <a href={`${REPOSITORY}/blob/main/NOTICE.md`}>notice</a> gives the terms for each layer.
        </p>
      </section>

      <section className="reading page-flush about-section" aria-labelledby="cite">
        <h2 id="cite">How to cite it</h2>
        <p>When you quote or reuse something from this edition, the license asks for this line:</p>
        <p className="about-attribution">{attribution}</p>
        <p>
          To cite a particular page, add its address and the date you read it. To cite
          Einstein&rsquo;s papers themselves, use their Annalen der Physik references, which{" "}
          <a href="/sources/">Sources</a> gives for each.
        </p>
      </section>

      <section className="reading page-flush about-section" aria-labelledby="about-data">
        <h2 id="about-data">What it keeps about you</h2>
        <p>
          What you save stays on your device: reading preferences, notes and predictions are kept in
          your browser, and <a href="/your-data/">What this site stores</a> shows them and lets you
          clear them.
        </p>
      </section>
    </div>
  );
}
