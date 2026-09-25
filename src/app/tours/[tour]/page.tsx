import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireTour, tourIds } from "../../../content/tours/tours.ts";
import { GUIDED_TOURS, getGuidedTour } from "../../../discovery/tours/catalogue.ts";
import { tourDestination, tourPosition } from "../../../discovery/tours/navigation.ts";
import { TimedTour } from "../../../discovery/tours/TimedTour.tsx";
import "../../../discovery/tours/tours.css";

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
        <div className="guided-tour-actions">
          <a href={`/discover/${tour.paper}/`}>Follow the longer discovery reconstruction</a>
          <a href={`/papers/${tour.paper}/`}>Return to the full paper</a>
          <a href="/tours/">Explore another guided path</a>
        </div>
      </section>
    </article>
  );
}
