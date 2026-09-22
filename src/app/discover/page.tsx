import type { Metadata } from "next";
import {
  isWrittenDiscoveryRoute,
  UNWRITTEN_DISCOVERY_ROUTES,
  WRITTEN_DISCOVERY_ROUTES,
} from "../../discovery/journeyRegistry.ts";

const SPELLED = ["no", "One", "Two", "Three", "Four"] as const;

/** Total by construction: a fifth paper would read "5" rather than crash or read "undefined". */
function spelled(n: number): string {
  return SPELLED[n] ?? String(n);
}

/** The plant that removed a route from the declaration produced "One routes are written". */
function plural(n: number): string {
  return n === 1 ? "route is" : "routes are";
}

/** For a clause whose noun is elided: "the other one IS", "the other two ARE". */
function isAre(n: number): string {
  return n === 1 ? "is" : "are";
}
const WRITTEN_COUNT = WRITTEN_DISCOVERY_ROUTES.length;
const UNWRITTEN_COUNT = UNWRITTEN_DISCOVERY_ROUTES.length;

export const metadata: Metadata = {
  title: "Discovery routes",
  description: `Reconstructions of the problems the 1905 papers answer, worked from what was on the shelf at the end of 1904. ${spelled(WRITTEN_COUNT)} ${plural(WRITTEN_COUNT)} written; the other ${spelled(UNWRITTEN_COUNT).toLowerCase()} ${isAre(UNWRITTEN_COUNT)} not yet.`,
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
 * UPDATED 2026-09-22: mass-energy is now written. Measured on the rendered component,
 * 14,268 characters of visible text with 5 numbered steps, 11 disclosures, a validated
 * 1904 shelf of 6 cards and one declared 1905 import. So the split is now two written and
 * two stubs, and the heading below says two rather than three.
 *
 * An index presenting four equal doors would be the claim-without-capability defect this
 * edition exists to avoid, so the stubs are still named individually with what IS behind
 * them rather than folded into a footnote.
 */

/** "Written" / "Not written", from the one declaration rather than typed per entry. */
function statusWord(slug: string): string {
  return isWrittenDiscoveryRoute(slug) ? "Written" : "Not written";
}

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
          from what was known at the time, and it says so at every step rather than claiming this is
          how Einstein thought.
        </p>
      </section>

      <section className="journey-catalogue">
        <article>
          <p className="eyebrow">{statusWord("brownian-motion")} · Ann. Phys. 17, 549</p>
          <h2>
            <a href="/discover/brownian-motion/">Brownian motion</a>
          </h2>
          <p className="german-title">
            Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in
            ruhenden Flüssigkeiten suspendierten Teilchen
          </p>
          <p>
            A speck of pollen in still water never settles. The route starts from that, and asks
            what you would measure if you wanted to decide whether molecules are shoving it: not how
            fast it moves, which turns out to be the wrong question, but how far it gets. Five
            steps, four instruments you operate, and the 1904 shelf laid out so you can see what you
            are allowed to use.
          </p>
          <div className="actions">
            <a className="button" href="/discover/brownian-motion/">
              Take this route
            </a>
            <a href="/papers/brownian-motion/">Read the paper instead</a>
          </div>
        </article>

        <article>
          <p className="eyebrow">{statusWord("mass-energy")} · Ann. Phys. 18, 639</p>
          <h2>
            <a href="/discover/mass-energy/">Mass and energy</a>
          </h2>
          <p className="german-title">
            Ist die Trägheit eines Körpers von seinem Energieinhalt abhängig?
          </p>
          <p>
            A body at rest gives off two equal flashes and does not recoil. Energy has left it and
            nothing you can see about it has changed, so the route asks what did. Five steps, one
            imported result that is declared rather than smuggled, and a prediction to commit to
            before the answer arrives.
          </p>
          <div className="actions">
            <a className="button" href="/discover/mass-energy/">
              Take this route
            </a>
            <a href="/papers/mass-energy/">Read the paper instead</a>
          </div>
        </article>

        <article>
          <p className="eyebrow">{statusWord("light-quanta")} · Ann. Phys. 17, 132</p>
          <h2>
            <a href="/discover/light-quanta/">Light quanta</a>
          </h2>
          <p className="german-title">
            Über einen die Erzeugung und Verwandlung des Lichtes betreffenden heuristischen
            Gesichtspunkt
          </p>
          <p>
            The wave theory was not in trouble in 1904, and this route keeps every one of its
            successes before going anywhere near them. It looks instead at the region the optical
            evidence never reached: not light travelling, but light being made and taken up. Seven
            steps, nine instruments, and a shelf with nothing imported on it.
          </p>
          <div className="actions">
            <a className="button" href="/discover/light-quanta/">
              Take this route
            </a>
            <a href="/papers/light-quanta/">Read the paper instead</a>
          </div>
        </article>

        <article>
          <p className="eyebrow">{statusWord("special-relativity")} · Ann. Phys. 17, 891</p>
          <h2>
            <a href="/discover/special-relativity/">On the electrodynamics of moving bodies</a>
          </h2>
          <p className="german-title">Zur Elektrodynamik bewegter Körper</p>
          <p>
            A magnet, a coil and a needle that moves. Every measurement says the two arrangements
            are the same and the textbook of 1904 tells two different stories about them. Following
            that honestly costs you something you have never had to defend. Eight steps, eight
            instruments, and Lorentz on the shelf as a live alternative rather than a foil.
          </p>
          <div className="actions">
            <a className="button" href="/discover/special-relativity/">
              Take this route
            </a>
            <a href="/papers/special-relativity/">Read the paper instead</a>
          </div>
        </article>
      </section>

      {/*
        THE TERMINAL STATE HAD NO COPY WRITTEN FOR IT, and the page reached it today.
        When special-relativity landed, UNWRITTEN_COUNT went to 0 and this section still rendered
        unconditionally: spelled(0) is "no", so the heading read "no routes not written yet" above
        a paragraph describing a set with nothing in it, followed by an empty
        <section className="journey-catalogue"> where the last card had been.

        A data-driven page still needs copy for every value its data can take. The count became
        correct and the sentence around it did not.
      */}
      {UNWRITTEN_COUNT > 0 ? (
        <section className="reading page-flush">
          <h2>
            {spelled(UNWRITTEN_COUNT)} {plural(UNWRITTEN_COUNT)} not written yet
          </h2>
          <p>
            Each of these papers has its reading edition and its instruments. What is missing is the
            reconstruction: the shelf, the difficulty, and the fork where a reasonable person could
            have gone the other way. Until that is written, the paper itself is the better door.
          </p>
        </section>
      ) : (
        <section className="reading page-flush">
          <h2>All {spelled(WRITTEN_COUNT).toLowerCase()} routes are written</h2>
          <p>
            Every paper of 1905 now has a reconstruction as well as an edition. Each starts from
            what was on the shelf at the end of 1904, meets the difficulty that did not fit, and
            offers the forks where a careful reader could have gone another way. None of them claims
            to be what Einstein thought.
          </p>
        </section>
      )}
    </>
  );
}
