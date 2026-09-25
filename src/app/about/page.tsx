import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { dayAndMonth, loadFirstPages } from "../../components/home/firstPages.ts";
import "../../components/home/wideProse.css";
import { loadProvenanceReceipts } from "../../content/provenance/loadReceipts.ts";
import { translationSentence, translationState } from "../../content/translationState.ts";
import { reuseOf } from "../sources/reuse.ts";
import "./about.css";
import { PORTRAIT } from "./portrait.ts";
import {
  attributionFrom,
  dayDate,
  publicationDate,
  requireExampleAnchor,
  requireFound,
  requireRevision,
} from "./refusals.ts";

export const metadata: Metadata = {
  title: "About",
  description:
    "What this edition is, why it counts four papers and keeps a fifth beside them, who makes it and how, its license, how to cite it, and what it keeps about you.",
};

const REPOSITORY = "https://github.com/Dicklesworthstone/annus-mirabilis.com";
const DISSERTATION_KEY = "ap-19-289";
const CORRECTION_KEY = "ap-34-591";
const MASS_ENERGY_KEY = "ap-18-639";
/** The paper the citation examples use; any paper with sections would do. */
const EXAMPLE_PAPER = "brownian-motion";
/** A revision is cited by its first twelve hex digits, as a short commit id is. */
const SHORT = 12;

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

/** "2026-09-18" -> "18 September 2026". */
function dayMonthYear(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
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
    massEnergyReceived: unbroken(
      dayAndMonth(dayDate(datesOf(MASS_ENERGY_KEY).dates, "received", MASS_ENERGY_KEY)),
    ),
    dissertationTitle: dissertation.titleGerman,
    dissertationDated: unbroken(dayAndMonth(dated("date-line"))),
    dissertationSubmitted: unbroken(dayAndMonth(dated("submitted"))),
    dissertationPrinted: monthAndYear(dated("issue-publication")),
    correctionYear: correctionYear.slice(0, 4),
  };
}

type ContentIndex = Readonly<{
  buildDigest: string;
  payloads: readonly Readonly<{ kind: string; id: string; sha256: string }>[];
}>;

/**
 * The revision identities a citation names, from the compiled content index this build was made
 * from: the whole edition's build digest, and each paper's compiled explanation, which changes
 * whenever its text does. They are the values the offline chapters print as their content
 * revision (scripts/build-offline-chapters.ts), so the two cannot disagree.
 */
function loadRevisions() {
  const index = JSON.parse(
    readFileSync(join(process.cwd(), "generated", "content", "index.json"), "utf8"),
  ) as ContentIndex;
  const papers = loadFirstPages().map((paper) => ({
    slug: paper.slug,
    title: paper.title,
    revision: requireRevision(
      index.payloads.find((entry) => entry.kind === "paper" && entry.id === paper.slug)?.sha256,
      paper.slug,
    ).slice(0, SHORT),
  }));
  return { edition: requireRevision(index.buildDigest, "edition").slice(0, SHORT), papers };
}

/** An anchor the example paper's page renders: its first section and that section's first argument. */
function loadExampleAnchors() {
  const record = JSON.parse(
    readFileSync(join(process.cwd(), "content", "papers", `${EXAMPLE_PAPER}.json`), "utf8"),
  ) as { sections: readonly { id: string; title: string; arguments: readonly string[] }[] };
  const section = record.sections[0];
  return requireExampleAnchor(section?.id, section?.arguments[0], EXAMPLE_PAPER);
}

/**
 * What a reader may take away and on what terms, from the scans' own receipts (reuse.ts, the same
 * records /sources/ shows) and the photograph's archive record. Scans recorded under the same terms
 * are named together.
 */
function loadReuse() {
  const names = new Map(loadFirstPages().map((paper) => [paper.key, paper.title]));
  const groups = new Map<
    string,
    { words: string; statements: ReturnType<typeof reuseOf>["statements"]; names: string[] }
  >();
  const receipts = loadProvenanceReceipts().receipts;
  for (const { key, receipt } of receipts) {
    const fm = requireFound(receipt, key).frontMatter;
    const reuse = reuseOf(fm);
    const id = `${reuse.words}\u0000${reuse.statements.map((s) => `${s.url} ${s.text}`).join(" ")}`;
    const group = groups.get(id) ?? { words: reuse.words, statements: reuse.statements, names: [] };
    group.names.push(
      names.get(key)?.toLowerCase() ??
        (key === CORRECTION_KEY ? "the 1911 correction" : "the dissertation"),
    );
    groups.set(id, group);
  }
  // One group holding every scan is named by its count, not by six titles in a row.
  return [...groups.values()].map((group) => ({
    ...group,
    label:
      group.names.length === receipts.length
        ? `All ${NUMBER_WORDS[receipts.length] ?? receipts.length} scans.`
        : `The scans of ${listed(group.names)}.`,
  }));
}

const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/** "18 March" never breaks between the day and the month. */
function unbroken(date: string): string {
  return date.replace(" ", " ");
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
  const revisions = loadRevisions();
  const example = loadExampleAnchors();
  const examplePaper = revisions.papers.find((p) => p.slug === EXAMPLE_PAPER);
  const reuse = loadReuse();
  // Counted from content/translation-units, so this line changes when the units do (dispatch 150).
  const translationNow = translationSentence(
    translationState(process.cwd()),
    new Map(loadFirstPages().map((paper) => [paper.slug, paper.title])),
  );
  const [small, large] = PORTRAIT.served;
  return (
    <div className="about-page">
      <header className="page-intro page-flush">
        <p className="eyebrow">About</p>
        <h1>About this edition</h1>
        <p className="lead">
          Annus Mirabilis is an edition, in preparation, of the four papers Albert Einstein sent to
          the Annalen der Physik in 1905, with his doctoral dissertation beside them. Each paper is
          explained at the depth you choose, and its instruments work out what follows when you
          change an assumption.
        </p>
        <p>
          It is not a biography of Einstein. It has no accounts and no advertising, and no language
          model runs while you read.
        </p>
      </header>

      {/* The credit is the holding library's own record (portrait.ts), and the usual attribution
          is labelled as one, never stated as fact (TanElk's ruling, dispatch 123, 2026-09-24). A plain img with a srcSet, as the plates are: images.unoptimized
          means next/image would emit no srcset of its own. */}
      <figure className="about-portrait">
        <img
          src={small.path}
          srcSet={`${small.path} ${small.width}w, ${large.path} ${large.width}w`}
          sizes="(min-width: 1100px) 20rem, 7rem"
          width={small.width}
          height={small.height}
          decoding="async"
          alt={PORTRAIT.alt}
        />
        <figcaption>
          Einstein at the Bern patent office, about 1905. {PORTRAIT.archive},{" "}
          <a href={`https://doi.org/${PORTRAIT.doi}`}>{PORTRAIT.identifier}</a>. The library records
          the photographer as unknown; the portrait is often attributed to {PORTRAIT.attributedTo}.
        </figcaption>
      </figure>

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
        {/* Paraphrased, never quoted: the letter's transcription and translation are the Collected
            Papers' editorial work (docs/RIGHTS.md section 6). The four follow the plan's summary
            of the letter (section 22.4). */}
        <p>
          Einstein counted differently. In May 1905 he wrote to his friend Conrad Habicht and
          promised him four papers. By his description, the first was about radiation and the energy
          of light. The second worked out the true size of atoms from how dilute solutions diffuse
          and how viscous they are; it became his dissertation. The third showed that on the
          molecular theory of heat, particles about a thousandth of a millimetre across, suspended
          in a liquid, must move about in a way you can see. The fourth, still a rough draft, was an
          electrodynamics of moving bodies that changed the theory of space and time. The paper on
          mass and energy was not among them: it was written later, and the Annalen received it on{" "}
          {count.massEnergyReceived}.
        </p>
        <p>
          So Einstein&rsquo;s four include the dissertation, and the four usually counted now put
          the mass and energy paper in its place. This edition reads those four in full and keeps
          the dissertation and its correction beside them as a companion.
        </p>
        <p className="fine">
          The letter is paraphrased here, not quoted: Einstein to Conrad Habicht, May 1905, in The
          Collected Papers of Albert Einstein, volume 5.
        </p>
      </section>

      <section className="reading page-flush about-section" aria-labelledby="authorship">
        <h2 id="authorship">Who makes it</h2>
        <p>
          The edition is made by Jeffrey Emanuel, who directs the work and decides what it
          publishes. Since the work began on 14 September 2026, its explanations and code have been
          drafted by AI models working under his direction. Where the repository&rsquo;s record of a
          change names the model that drafted it, that model is Anthropic&rsquo;s Claude (Opus 5.5,
          Opus 5 or Sonnet 5) or xAI&rsquo;s Grok.
        </p>
      </section>

      <section className="reading page-flush about-section" aria-labelledby="about-method">
        <h2 id="about-method">How it is made</h2>
        <p>
          Every page image is cut from a scan whose source, terms and digest are listed on{" "}
          <a href="/sources/">Sources</a>, with how far each transcription has got.
        </p>
        <p>
          The German text is read by machine from each scan and corrected by hand against its page
          images. The source is kept as printed: a suspected misprint is recorded beside it, never
          corrected in it.
        </p>
        <p>
          The explanations are new writing in modern notation, drafted with AI assistance. You
          choose how much of each you read: an overview, the full explanation, or every step, and
          you can add a modern lens on what came later. The discovery journeys reconstruct a way to
          a result from what was known before 1905, and say so: each is a route you could take, not
          a record of what Einstein thought.
        </p>
        <p>
          Every number an instrument shows is worked out by that instrument and labelled as a
          calculation. None of them is a measurement of nature.
        </p>
        <p>
          The English translation is the edition&rsquo;s own, made from the German. {translationNow}{" "}
          Published translations are used only to compare readings against, as{" "}
          <a href="/sources/#edition-policy">Sources</a> explains.
        </p>
      </section>

      <section className="reading page-flush about-section" aria-labelledby="license">
        <h2 id="license">License</h2>
        <p>
          Einstein&rsquo;s German text is in the public domain. Each scan carries its host&rsquo;s
          terms, listed on <a href="/sources/">Sources</a>. Everything written for this edition, the
          explanations, the code and in time the translation, is under the{" "}
          <a href={`${REPOSITORY}/blob/main/LICENSE`}>
            MIT License with the OpenAI/Anthropic Rider
          </a>
          , as decided on 16 September 2026. The fonts are under the SIL Open Font License. The{" "}
          <a href={`${REPOSITORY}/blob/main/NOTICE.md`}>notice</a> gives the terms for each layer.
        </p>
      </section>

      <section className="reading page-flush about-section" aria-labelledby="cite">
        <h2 id="cite">How to cite it</h2>
        <p>When you quote or reuse something from this edition, the license asks for this line:</p>
        <p className="about-attribution">{attribution}</p>
        <p>
          A citation should also say which version you read, because the explanations change as they
          are revised. Each paper&rsquo;s explanation has a content revision, a digest of its
          compiled text, and the edition as a whole has one too. These are the revisions of the
          pages you are reading now:
        </p>
        <dl className="about-revisions">
          <div>
            <dt>The edition</dt>
            <dd>
              <code>{revisions.edition}</code>
            </dd>
          </div>
          {revisions.papers.map((paper) => (
            <div key={paper.slug}>
              <dt>{paper.title}</dt>
              <dd>
                <code>{paper.revision}</code>
              </dd>
            </div>
          ))}
          <div>
            <dt>The translation</dt>
            {/* Counted from content/translation-units (dispatch 153). This read "None yet: no
                English translation has been made." after 43 drafted passages were live. */}
            <dd>{translationNow}</dd>
          </div>
        </dl>
        <p>So a citation takes one of these forms, with the date you read it:</p>
        <ul className="about-formats">
          <li>
            <strong>The edition:</strong> Annus Mirabilis, annus-mirabilis.com, edition revision{" "}
            {revisions.edition}.
          </li>
          <li>
            <strong>A paper:</strong> Annus Mirabilis, &ldquo;{examplePaper?.title}&rdquo;,
            annus-mirabilis.com/papers/{EXAMPLE_PAPER}/, content revision {examplePaper?.revision}.
          </li>
          <li>
            <strong>A section or an argument:</strong> the paper&rsquo;s citation, with the address
            of the part you mean, such as /papers/{EXAMPLE_PAPER}/#{example.section} for a section
            or /papers/{EXAMPLE_PAPER}/#{example.argument} for one argument in it.
          </li>
          <li>
            <strong>An instrument:</strong> its address, such as annus-mirabilis.com/lab/bm-01/,
            with the edition revision and the settings you used. A link cannot yet carry the
            settings, and an equation cannot yet be linked on its own.
          </li>
        </ul>
        <p>
          To cite Einstein&rsquo;s papers themselves, use their Annalen der Physik references, which{" "}
          <a href="/sources/">Sources</a> gives for each.
        </p>

        <h3 id="reuse">What you may take away</h3>
        <p>
          The attribution above is how to credit the edition. It does not grant anything, and it
          does not cover what the edition did not make. What you may reuse is recorded with each
          thing you can download:
        </p>
        <ul className="about-formats">
          {reuse.map((group) => (
            <li key={group.names.join()}>
              <strong>{group.label}</strong> {group.words}
              {group.statements.map((statement) => (
                <span key={statement.url}>
                  {" "}
                  Recorded as: {statement.text} <a href={statement.url}>Read the terms</a> as they
                  stood on {dayMonthYear(statement.retrievedAt)}.
                </span>
              ))}
            </li>
          ))}
          <li>
            <strong>The photograph above.</strong> {PORTRAIT.archive} marks it with the{" "}
            {PORTRAIT.rights}; see <a href={`https://doi.org/${PORTRAIT.doi}`}>its record</a>.
          </li>
        </ul>
      </section>

      <section className="reading page-flush about-section" aria-labelledby="contribute">
        <h2 id="contribute">Reporting a mistake</h2>
        <p>
          If you find a mistake in the German, an explanation or a number, or something on a page
          you cannot reach or use, please{" "}
          <a href={`${REPOSITORY}/issues`}>open an issue in the repository</a>. Say which page and
          which passage, and what you expected to find.
        </p>
        <p>
          A suspected misprint in the German is checked against the page image before it is
          recorded, and the printed reading is kept beside it. A correction that turns out to be
          wrong is withdrawn, not deleted, and keeps its reason; each paper&rsquo;s receipt on{" "}
          <a href="/sources/">Sources</a> counts both kinds.
        </p>
      </section>

      <section className="reading page-flush about-section" aria-labelledby="accessibility">
        <h2 id="accessibility">Accessibility</h2>
        <p>
          The site aims to meet the Web Content Accessibility Guidelines 2.2 at level AA, and does
          not yet claim to. <a href="/accessibility/">Accessibility</a> says what has been checked,
          how, and what has not.
        </p>
      </section>

      <section className="reading page-flush about-section" aria-labelledby="tested-routes">
        <h2 id="tested-routes">Testing with readers</h2>
        <p>
          No round of testing with readers has been held yet. When one has, this section will list
          the routes tested, when, and the barriers found. It will not report scores: a small round
          finds problems, and it cannot measure how well the site teaches.
        </p>
      </section>

      <section className="reading page-flush about-section" aria-labelledby="privacy">
        <h2 id="privacy">What it keeps about you</h2>
        <p>
          The site sets no cookies, loads nothing from any other site, and runs no analytics. What
          you save stays on your device: reading preferences, notes and predictions are kept in your
          browser, and <a href="/your-data/">What this site stores</a> shows them, lets you download
          them, and lets you clear them.
        </p>
        <p>
          The pages are served by Vercel. As with any web host, its servers receive the address and
          request of each visitor, and what Vercel keeps is set by{" "}
          <a href="https://vercel.com/legal/privacy-policy">its own privacy policy</a>.
        </p>
      </section>
    </div>
  );
}
