import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireTour, tourIds } from "../../../content/tours/tours.ts";
import { GUIDED_TOURS, getGuidedTour } from "../../../discovery/tours/catalogue.ts";
import { tourDestination, tourPosition } from "../../../discovery/tours/navigation.ts";
import { TimedTour } from "../../../discovery/tours/TimedTour.tsx";
import "../../../discovery/tours/tours.css";

/**
 * THE CAPSTONE A PAPER'S PATH CAN END AT (am-disc-capstones-infra-3352, dispatch 373).
 *
 * That bead's Location section says the tours link the capstone by the same route, and until this
 * they did not: measured across the built site, 0 of 718 pages carried an href into /capstones/.
 *
 * THE LINK TEXT IS THE RECORD'S OWN TITLE rather than the word "Capstone", so a reader is told what
 * they are being offered. It is a lookup rather than a template for two reasons: a paper with no
 * capstone record gets no link instead of a link to a page that is not there, and
 * `src/app/capstones/reachability.test.tsx` asserts each title here equals `capstone.title` in
 * content/arguments/capstones/<paper>.yaml, so the copy cannot drift from the record.
 *
 * THE BEAD NAMES THE ONE-EVENING AND FULL-COURSE TOURS, WHICH DO NOT EXIST. `TOUR_BUDGETS` in
 * src/content/schemas/experiment.ts declares `fifteen-minutes`, `one-evening` and `full-course`,
 * and content/tours holds ONE record, at `fifteen-minutes`. The four guided tours in the catalogue
 * here are the tours a reader can walk today, one per paper, so they carry the link. The timed
 * fifteen-minute tour returns early below and deliberately does not: it is the shortest path and
 * the equations-free one, the bead's clause names the two longer budgets rather than that one, and
 * an optional reconstruction is not what a reader who chose fifteen minutes asked for.
 */
const CAPSTONE_TITLE: Readonly<Record<string, string | undefined>> = {
  "brownian-motion": "Rebuild the argument for the spread",
  "light-quanta": "Rebuild the heuristic viewpoint",
  "mass-energy": "Rebuild the September argument",
  "special-relativity": "Rebuild the electrodynamics of moving bodies",
};

type Props = { params: Promise<{ tour: string }> };
export const dynamicParams = false;
/** The release profile decides whether a draft move summary may be shown (tours.ts). */
const PROFILE = process.env.AM_RELEASE_PROFILE ?? "scaffold";
export function generateStaticParams() {
  return [
    ...GUIDED_TOURS.map((tour) => ({ tour: tour.id })),
    // Timed tours without equations, from content/tours (am-tour-15min-mass-energy-nqz1).
    ...tourIds(process.cwd()).map((tour) => ({ tour })),
  ];
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = (await params).tour;
  const timed = requireTour(process.cwd(), id, PROFILE);
  if (timed)
    return {
      title: timed.title,
      description: timed.introduction,
      alternates: { canonical: `/tours/${timed.id}/` },
    };
  const tour = getGuidedTour(id);
  return tour
    ? {
        title: tour.title,
        description: tour.introduction,
        alternates: { canonical: `/tours/${tour.id}/` },
      }
    : { title: "Guided reading path not found", robots: { index: false } };
}

/** The whole path is server rendered. Opening a stop never gates the explanations here. */
export default async function GuidedTourPage({ params }: Props) {
  const id = (await params).tour;
  // A timed tour renders every step in place; a tour with a problem fails the page (tours.ts).
  const timed = requireTour(process.cwd(), id, PROFILE);
  if (timed) return <TimedTour tour={timed} />;
  const tour = getGuidedTour(id);
  if (!tour) notFound();
  const first = tour.stops[0];
  return (
    <article className="guided-tour-page" data-guided-tour-outline={tour.id}>
      <header className="page-intro">
        <p className="eyebrow">Guided reading · At your own pace</p>
        <h1>{tour.title}</h1>
        <p className="lead">{tour.introduction}</p>
        <p>
          {tour.stops.length} stops. Start at the beginning or choose any stop. Every question and
          explanation is available below without submitting an answer.
        </p>
        <p className="notice">
          This path strings together pages of the edition; it is not an account of how the paper
          came about. A laboratory works out what a claim implies, and what it shows is a
          calculation, not an observation.
        </p>
        <nav className="guided-tour-actions" aria-label="Begin or leave this reading path">
          {first && (
            <a href={tourDestination(tourPosition(tour, first))}>Begin at the first encounter</a>
          )}
          <a href={`/papers/${tour.paper}/`}>Read the paper without a guide</a>
          <a href="/tours/">Choose another guided path</a>
        </nav>
        <p>
          With JavaScript, the guide travels with you above the paper or experiment. Without it,
          return to this outline using your browser's Back command; the full route remains readable
          here.
        </p>
      </header>
      <ol className="guided-tour-stops">
        {tour.stops.map((stop, index) => (
          <li key={stop.id} id={`tour-stop-${stop.id}`}>
            <section aria-labelledby={`title-${stop.id}`}>
              <p className="eyebrow">
                Stop {index + 1} · {stop.activity}
              </p>
              <h2 id={`title-${stop.id}`}>{stop.title}</h2>
              <p>{stop.task}</p>
              <p>
                <strong>Consider:</strong> {stop.question}
              </p>
              <details>
                <summary>Read the explanation without answering</summary>
                <p>{stop.explanation}</p>
              </details>
              <div className="guided-tour-actions">
                <a href={tourDestination(tourPosition(tour, stop))}>Open this stop: {stop.title}</a>
                <a href={stop.href}>Open the destination without a guide</a>
              </div>
            </section>
          </li>
        ))}
      </ol>
      <section id="tour-finish" aria-labelledby="tour-finish-title">
        <h2 id="tour-finish-title">Carry the argument beyond this route</h2>
        <p>
          You have reached the outline's final stop, not a certification of understanding. Return to
          any question, try a changed assumption, or explain which step would fail if that
          assumption changed.
        </p>
        {CAPSTONE_TITLE[tour.paper] === undefined ? null : (
          <p>
            One way to carry it is to rebuild it. The capstone lays out this paper&rsquo;s claims in
            an order that does not work and asks you to find one that does:{" "}
            <a href={`/capstones/${tour.paper}/`}>{CAPSTONE_TITLE[tour.paper]}</a>. It is optional,
            and this path is complete without it.
          </p>
        )}
        <div className="guided-tour-actions">
          <a href={`/discover/${tour.paper}/`}>Follow the longer discovery reconstruction</a>
          <a href={`/papers/${tour.paper}/`}>Return to the full paper</a>
          <a href="/tours/">Explore another guided path</a>
        </div>
      </section>
    </article>
  );
}
