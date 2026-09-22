import { FirstPages } from "../components/home/FirstPages.tsx";

/**
 * The 404 (REDIRECT chrome sweep, 2026-09-22).
 *
 * What stood here was four lines: an eyebrow, a heading, one sentence about the catalogue, and a
 * link to it. TanElk measured it at 328 characters of content against a site median of 1188, the
 * thinnest page on the site by a wide margin.
 *
 * WHY IT IS A DESIGN PROBLEM RATHER THAN A COPY ONE. This is the single page where the edition
 * knows the reader is lost and knows nothing about why. A mistyped URL, a stale bookmark, a link
 * into a route that has not been built yet, and a search-engine result for a page that moved all
 * arrive here identically. Sending them to one catalogue asks them to start over; naming the
 * actual doors lets them recognise the one they wanted.
 *
 * So the page offers the four papers BY NAME, which is the edition's real
 * structure rather than a generic "try the home page". A reader who mistyped a paper slug sees
 * the right slug; a reader who wanted an instrument or a route sees that those exist.
 *
 * WHAT IT DOES NOT DO. It does not guess what the reader wanted, apologise, or use the 404 to
 * advertise. It also does not claim the page never existed: routes are still being built, and
 * "not in the edition" covers both "no such page" and "not published yet" without pretending to
 * know which.
 *
 * The four papers are now their printed first pages, the same row as the home page (pane %34,
 * 2026-09-22): the page a lost reader lands on shows them what the edition is, and calls each paper
 * by the name the rest of the site uses. The four titles here had been a second, separately
 * worded list ("On the electrodynamics of moving bodies" where /papers/ says "Special relativity").
 */
export default function NotFound() {
  return (
    <>
      <section className="hero hero-with-plates">
        <p className="eyebrow">Page not found</p>
        <h1>This page is not in the edition.</h1>
        <p className="lead">
          The address may be mistyped, or it may name a page that has not been published yet. From
          here the two look the same, so here are the four papers the edition is built around.
        </p>
        <FirstPages />
        <div className="actions">
          <a className="button" href="/papers/">
            Open the paper catalogue
          </a>
          <a href="/">Return to the start</a>
        </div>
      </section>

      <section className="reading page-flush">
        <h2>Or start somewhere other than a paper</h2>
        <p>
          The <a href="/instruments/">instruments</a> let you operate the arguments yourself. The{" "}
          <a href="/discover/">discovery routes</a> reconstruct the problem before its solution was
          known. The <a href="/foundations/">foundations</a> explain the mathematics a passage
          assumes, and the <a href="/notation/">notation concordance</a> records what each printed
          symbol means in each paper.
        </p>
        <p>
          If you know roughly what you are looking for, <a href="/search/">search</a> reaches every
          passage, equation and instrument. On a keyboard, press <kbd>Ctrl</kbd> <kbd>K</kbd>, or{" "}
          <kbd>Cmd</kbd> <kbd>K</kbd> on a Mac.
        </p>
      </section>
    </>
  );
}
