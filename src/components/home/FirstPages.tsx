import type { CSSProperties } from "react";
import { dayAndMonth, dayMonthParts, firstPagePlate, loadFirstPages } from "./firstPages.ts";
import "./firstPages.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * The question each paper opens with on the home page, under its first page, with two ways in: an
 * example first, or the paper itself (am-design-home-page-0s7s). Interface copy written for this
 * edition, not a quotation. Keyed by slug; a paper with no question here shows none, and the home
 * page's test requires all four.
 */
export const INVITATIONS: Readonly<Record<string, string>> = {
  "light-quanta": "What could a spectrum tell you about the structure of light?",
  "brownian-motion": "How would you count what you cannot see?",
  "special-relativity": "How would you synchronize distant clocks?",
  "mass-energy": "What does a body lose when it emits light?",
};

/** Where "Show me with an example" goes: the paper's first encounter, rendered at #entry-<slug>. */
export function exampleHref(slug: string): string {
  return `/papers/${slug}/#entry-${slug}`;
}

/**
 * The four first pages, as printed, in the order Annalen der Physik received them, large enough to
 * read as pages of German type with a title block. Each is dated on a calendar label above it and
 * carries one mark per printed page below it. On a wide screen a ruler of 1905 underneath places
 * the four received dates to the day. Everything drawn is also in the text.
 */
export function FirstPages({ invitations = false }: { invitations?: boolean }) {
  const papers = loadFirstPages();
  return (
    <figure className="first-pages">
      <ol
        className={invitations ? "first-pages-list first-pages-invite" : "first-pages-list"}
        aria-label="The four papers in the order the journal received them"
      >
        {papers.map((paper) => {
          const { day, month } = dayMonthParts(paper.received);
          return (
            <li key={paper.key} className="first-page">
              <p className="first-page-received">
                <time dateTime={paper.received}>
                  <span className="first-page-day">{day}</span>{" "}
                  <span className="first-page-month">{month}</span>
                </time>
              </p>
              <a href={`/papers/${paper.slug}/`}>
                {/* A plain img with a srcSet (firstPagePlate says why). The sizes are the plate's
                    measured width: half the row on a phone, a quarter from 700px, and at most
                    22rem once the row stops growing. Biome's noImgElement warns on this; the reason
                    is here rather than silenced. */}
                <img
                  className="first-page-plate"
                  {...firstPagePlate(paper.key)}
                  sizes="(min-width: 1280px) 22rem, (min-width: 700px) calc(25vw - 40px), calc(50vw - 24px)"
                  width={400}
                  height={662}
                  loading="eager"
                  decoding="async"
                  alt=""
                />
                <span className="first-page-title">{paper.title}</span>
              </a>
              <p className="first-page-count">
                <span className="first-page-marks" aria-hidden="true">
                  {Array.from({ length: paper.pages }, (_, n) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: the marks are identical and never reorder
                    <i key={n} />
                  ))}
                </span>
                {paper.pages} pages, printed{" "}
                <time dateTime={paper.printed}>{dayAndMonth(paper.printed)}</time>
              </p>
              {invitations && INVITATIONS[paper.slug] ? (
                <>
                  <p className="first-page-question">{INVITATIONS[paper.slug]}</p>
                  {/* Each link names its paper to a screen reader, since the four pairs read alike. */}
                  <p className="first-page-actions">
                    <a href={exampleHref(paper.slug)}>
                      Show me with an example
                      <span className="visually-hidden">: {paper.title}</span>
                    </a>
                    <a href={`/papers/${paper.slug}/`}>
                      Take me to the paper
                      <span className="visually-hidden">: {paper.title}</span>
                    </a>
                  </p>
                </>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="first-pages-ruler" aria-hidden="true">
        <div className="first-pages-months">
          {MONTHS.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
        {papers.map((paper) => (
          <span
            key={paper.key}
            className="first-pages-tick"
            style={{ "--at": paper.at.toFixed(4) } as CSSProperties}
          >
            {paper.title}
          </span>
        ))}
      </div>
      <figcaption className="fine">
        Each paper&rsquo;s first page as printed, dated by the day the journal received it. The
        German text is set for three of the four; the English translation, made from the German, has
        not been started. Scans: Bell &amp; Howell / UMI microfilm, via the Internet Archive.
      </figcaption>
    </figure>
  );
}
