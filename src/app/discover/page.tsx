import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Discovery routes",
  description:
    "Reconstructions of the problems the 1905 papers answer, worked from what was on the shelf at the end of 1904. One route is written; the other three are not yet.",
};

/**
 * The /discover index (TanElk's nav call, 2026-09-22).
 *
 * Until now the nav item "Discovery routes" deep-linked into /discover/brownian-motion/, one
 * child of four, so a reader had no way to learn that the other three journeys exist or what
 * state they are in.
 *
 * WHY THIS PAGE IS NOT DRIVEN FROM journeyRegistry.ts, which would be the obvious move. The
 * registry holds exactly one Journey and it is FIXTURE_JOURNEY_BROWNIAN, imported from
 * src/discovery/testing/. Measured on build h2Dwz8akGXU682TfDJXOY: that record declares 1 stage,
 * 2 forks and 3 exercises, while the route it supposedly describes renders 8 sections and about
 * 13,900 characters. The two are different artefacts. Surfacing the record's counts here would
 * advertise a shape the reader does not meet, and quoting its `firstHonestQuestion` would
 * advertise a sentence that is not on the page - the route opens "A particle wanders. What should
 * you measure?" and the fixture says something else entirely.
 *
 * So the copy below describes the PAGES, measured, and the registry is left to the routes that
 * own it. That a production route imports a fixture is a real finding and belongs on a bead, not
 * in a workaround here.
 *
 * WHAT WAS MEASURED, on the same build, as visible text inside <main>:
 *
 *   brownian-motion      13,947 chars   8 sections   4 instruments
 *   light-quanta            849 chars   1 section    0
 *   mass-energy             810 chars   1 section    0
 *   special-relativity      418 chars   1 section    0
 *
 * One route is written and three are stubs that say so. An index presenting four equal doors
 * would be the claim-without-capability defect this edition exists to avoid, so the three are
 * named individually with what IS behind them rather than folded into a footnote.
 */
export default function DiscoverIndex() {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">A route you could take</p>
        <h1>Discovery routes</h1>
        <p className="lead">
          A discovery route puts you where a careful reader stood at the end of 1904: holding the
          results that were already on the shelf, facing an observation that does not fit, and not
          yet knowing which way the answer lies. You make the moves. The paper comes last.
        </p>
        <p>
          A route is a reconstruction, not a biography. It shows a way the argument can be reached
          from what was known at the time, and it says so at every step rather than claiming this
          is how Einstein thought.
        </p>
      </section>

      <section className="journey-catalogue">
        <article>
          <p className="eyebrow">Written · Ann. Phys. 17, 549</p>
          <h2>
            <a href="/discover/brownian-motion/">Brownian motion</a>
          </h2>
          <p className="german-title">
            Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in
            ruhenden Flüssigkeiten suspendierten Teilchen
          </p>
          <p>
            A speck of pollen in still water never settles. The route starts from that, and asks
            what you would measure if you wanted to decide whether molecules are shoving it: not
            how fast it moves, which turns out to be the wrong question, but how far it gets. Eight
            sections, four instruments you operate, and the 1904 shelf laid out so you can see what
            you are allowed to use.
          </p>
          <div className="actions">
            <a className="button" href="/discover/brownian-motion/">
              Take this route
            </a>
            <a href="/papers/brownian-motion/">Read the paper instead</a>
          </div>
        </article>
      </section>

      <section className="reading">
        <h2>Three routes are not written yet</h2>
        <p>
          Each of these papers has its reading edition and its instruments. What is missing is the
          reconstruction: the shelf, the difficulty, and the fork where a reasonable person could
          have gone the other way. Until that is written, the paper itself is the better door.
        </p>
      </section>

      <section className="journey-catalogue">
        <article>
          <p className="eyebrow">Not written · Ann. Phys. 17, 132</p>
          <h2>
            <a href="/papers/light-quanta/">Light quanta</a>
          </h2>
          <p className="german-title">
            Über einen die Erzeugung und Verwandlung des Lichtes betreffenden heuristischen
            Gesichtspunkt
          </p>
          <p>
            The route through radiation entropy and the counting argument is not written. The
            reading edition is, and so are nine instruments, including the one that matches
            radiation entropy against a gas.
          </p>
          <div className="actions">
            <a href="/papers/light-quanta/">Read the paper and its instruments</a>
          </div>
        </article>

        <article>
          <p className="eyebrow">Not written · Ann. Phys. 17, 891</p>
          <h2>
            <a href="/papers/special-relativity/">On the electrodynamics of moving bodies</a>
          </h2>
          <p className="german-title">Zur Elektrodynamik bewegter Körper</p>
          <p>
            The route from the magnet and the coil to the measurement of time is not written. The
            reading edition is, and so are thirteen instruments, including the one that tells both
            stories about the magnet.
          </p>
          <div className="actions">
            <a href="/papers/special-relativity/">Read the paper and its instruments</a>
          </div>
        </article>

        <article>
          <p className="eyebrow">Not written · Ann. Phys. 18, 639</p>
          <h2>
            <a href="/papers/mass-energy/">Does inertia depend on energy content?</a>
          </h2>
          <p className="german-title">
            Ist die Trägheit eines Körpers von seinem Energieinhalt abhängig?
          </p>
          <p>
            The route through the two accounts of one body giving off light is not written. The
            reading edition is, and so is the instrument that follows the subtraction.
          </p>
          <div className="actions">
            <a href="/papers/mass-energy/">Read the paper and its instrument</a>
          </div>
        </article>
      </section>
    </>
  );
}
