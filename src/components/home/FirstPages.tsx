import Image from "next/image";
import type { CSSProperties } from "react";
import { dayAndMonth, dayMonthParts, loadFirstPages } from "./firstPages.ts";
import "./firstPages.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * The four first pages, as printed, in the order Annalen der Physik received them, large enough to
 * read as pages of German type with a title block. Each is dated on a calendar label above it and
 * carries one mark per printed page below it. On a wide screen a ruler of 1905 underneath places
 * the four received dates to the day. Everything drawn is also in the text.
 */
export function FirstPages() {
  const papers = loadFirstPages();
  return (
    <figure className="first-pages">
      <ol
        className="first-pages-list"
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
                {/* One 400px file: a plate is at most about 306 CSS px, so this is sharp at 1x and
                    soft only at 2x on the widest screens. Images are unoptimized in the static
                    export, so next/image would not emit a srcset anyway. */}
                <Image
                  className="first-page-plate"
                  src={`/figures/plates/${paper.key}-first-page-400.webp`}
                  width={400}
                  height={662}
                  loading="eager"
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
        German text is set for three of the four; the English translation, made from the German,
        has not been started. Scans: Bell &amp; Howell / UMI microfilm, via the Internet Archive.
      </figcaption>
    </figure>
  );
}
