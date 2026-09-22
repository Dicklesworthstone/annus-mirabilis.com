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
 * So the page offers the four papers BY NAME with their citations, which is the edition's real
 * structure rather than a generic "try the home page". A reader who mistyped a paper slug sees
 * the right slug; a reader who wanted an instrument or a route sees that those exist.
 *
 * WHAT IT DOES NOT DO. It does not guess what the reader wanted, apologise, or use the 404 to
 * advertise. It also does not claim the page never existed: routes are still being built, and
 * "not in the edition" covers both "no such page" and "not published yet" without pretending to
 * know which.
 */
export default function NotFound() {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">Page not found</p>
        <h1>This page is not in the edition.</h1>
        <p className="lead">
          Either the address is wrong, or it names something the edition has not published yet. Both
          look the same from here, so rather than guess, here is everything this site holds.
        </p>
        <div className="actions">
          <a className="button" href="/papers/">
            Open the paper catalogue
          </a>
          <a href="/">Return to the start</a>
        </div>
      </section>

      <section className="journey-catalogue">
        <article>
          <p className="eyebrow">Ann. Phys. 17, 132</p>
          <h2>
            <a href="/papers/light-quanta/">Light quanta</a>
          </h2>
          <p>
            Whether light gives up its energy in whole pieces, and what the wave description keeps
            when it does.
          </p>
        </article>

        <article>
          <p className="eyebrow">Ann. Phys. 17, 549</p>
          <h2>
            <a href="/papers/brownian-motion/">Brownian motion</a>
          </h2>
          <p>
            Whether a visible speck in still water is being shoved by molecules, and how far it
            should travel if it is.
          </p>
        </article>

        <article>
          <p className="eyebrow">Ann. Phys. 17, 891</p>
          <h2>
            <a href="/papers/special-relativity/">On the electrodynamics of moving bodies</a>
          </h2>
          <p>
            What it takes to set two distant clocks, and what follows once you say precisely what
            that means.
          </p>
        </article>

        <article>
          <p className="eyebrow">Ann. Phys. 18, 639</p>
          <h2>
            <a href="/papers/mass-energy/">Does inertia depend on energy content?</a>
          </h2>
          <p>What survives when one body&rsquo;s energy is written down twice and subtracted.</p>
        </article>
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
          If you know roughly what you are looking for, search reaches every passage, equation and
          instrument. Press <kbd>Ctrl</kbd> <kbd>K</kbd>, or <kbd>Cmd</kbd> <kbd>K</kbd> on a Mac.
        </p>
      </section>
    </>
  );
}
