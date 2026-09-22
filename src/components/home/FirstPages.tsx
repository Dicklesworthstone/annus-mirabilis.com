import Image from "next/image";
import type { CSSProperties } from "react";
import { dayAndMonth, loadFirstPages } from "./firstPages.ts";
import "./firstPages.css";

/** Width of one plate as a fraction of the year's width, on screens wide enough to draw the year. */
const PLATE = 0.11;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * The four first pages, as printed, in the order Annalen der Physik received them. On a wide
 * screen each plate's left edge stands on its received date along 1905; under each, one mark per
 * printed page. Everything here is also in the text, so nothing depends on the picture.
 */
export function FirstPages() {
  const papers = loadFirstPages();
  return (
    <figure className="first-pages">
      <ol
        className="first-pages-list"
        aria-label="The four papers in the order the journal received them"
        style={{ "--plate": PLATE } as CSSProperties}
      >
        {papers.map((paper, i) => {
          const previous = papers[i - 1];
          const offset = previous ? paper.at - previous.at - PLATE : paper.at;
          return (
            <li
              key={paper.key}
              className="first-page"
              style={{ "--offset": offset.toFixed(4) } as CSSProperties}
            >
              <p className="first-page-received">
                <time dateTime={paper.received}>{dayAndMonth(paper.received)}</time>
              </p>
              <a href={`/papers/${paper.slug}/`}>
                {/* One 400px file: a plate is at most about 145 CSS px, so this covers 2x on desktop
                    and 3x at 80px on a phone. Images are unoptimized in the static export, so
                    next/image would not emit a srcset anyway. */}
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
      <div className="first-pages-axis" aria-hidden="true">
        {MONTHS.map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
      <figcaption className="fine">
        Each paper&rsquo;s first page as printed, placed on the day the journal received it. The
        German text is set for three of the four; the English translation, made from the German, has
        not been started. Scans: Bell &amp; Howell / UMI microfilm, via the Internet Archive.
      </figcaption>
    </figure>
  );
}
