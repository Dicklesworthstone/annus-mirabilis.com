import type { Metadata } from "next";
import { requireTour, tourIds } from "../../content/tours/tours.ts";
import { GUIDED_TOURS } from "../../discovery/tours/catalogue.ts";
import { tourFacts } from "./tourFacts.ts";
import "../../discovery/tours/tours.css";

export const metadata: Metadata = {
  title: "Guided reading paths",
  description:
    "Guided paths that follow one question from a first encounter, through the instruments, back to the paper it comes from.",
  alternates: { canonical: "/tours/" },
};

export default function GuidedToursIndex() {
  // Counted from both sources rather than written: one content record under content/tours and the
  // four entries of the GUIDED_TOURS catalogue. The two are not merged; they are added up.
  const TOUR_COUNT = tourIds(process.cwd()).length + GUIDED_TOURS.length;
  return (
    <article className="guided-tour-page guided-tour-index">
      <header className="page-intro">
        <p className="eyebrow">A question to carry with you</p>
        <h1>Guided reading paths</h1>
        <p className="lead">
          Move from a first encounter to the instruments and back to the complete paper. Each stop
          tells you what to try, what to question, and where to go next.
        </p>
        <p>
          Choose a route, not a difficulty level. Start with the no-algebra entrance, skip to any
          stop, or spend as long as you need in a laboratory. No score, timer, account or saved
          answer is required.
        </p>
        <p className="notice">Each page a path reaches says what it shows and where it stops.</p>
      </header>
      <div className="guided-tour-catalogue">
        {tourIds(process.cwd()).flatMap((id) => {
          const tour = requireTour(process.cwd(), id, process.env.AM_RELEASE_PROFILE ?? "scaffold");
          return tour
            ? [
                <section key={tour.id} aria-labelledby={`timed-${tour.id}`}>
                  <h2 id={`timed-${tour.id}`}>
                    <a href={`/tours/${tour.id}/`}>{tour.title}</a>
                  </h2>
                  <p>{tour.introduction}</p>
                  <p>
                    {tour.steps.length} steps · About {tour.totalMinutes} minutes · No equations
                  </p>
                  {/* What a reader can say at the end, from the record's own targetClaim. */}
                  <p className="tour-target">You finish able to say: {tour.targetClaim}</p>
                  <div className="guided-tour-actions">
                    <a href={`/tours/${tour.id}/`}>Take this path</a>
                    <a href={`/papers/${tour.paper}/`}>Read the paper without a guide</a>
                  </div>
                </section>,
              ]
            : [];
        })}
        {GUIDED_TOURS.map((tour) => (
          <section key={tour.id} aria-labelledby={`guided-${tour.id}`}>
            <h2 id={`guided-${tour.id}`}>
              <a href={`/tours/${tour.id}/`}>{tour.title}</a>
            </h2>
            <p>{tour.introduction}</p>
            {/* The stop count and what a reader does are the stops' own, not a summary: the
                activities come from each stop's `activity` field, in order and without repeats. */}
            <p>
              {tour.stops.length} stops
              {tourFacts(tour.stops).activities
                ? ` · You ${tourFacts(tour.stops).activities}`
                : null}
            </p>
            <p className="tour-target">
              It begins at {tour.stops[0]?.title} and ends at{" "}
              {tour.stops[tour.stops.length - 1]?.title}.
            </p>
            <div className="guided-tour-actions">
              <a href={`/tours/${tour.id}/`}>Explore this reading path</a>
              {tourFacts(tour.stops).startHref ? (
                <a href={tourFacts(tour.stops).startHref}>Start at the first stop</a>
              ) : null}
              <a href={`/papers/${tour.paper}/`}>Read the paper without a guide</a>
            </div>
          </section>
        ))}
      </div>
      <section>
        <h2>What is here, and what is not</h2>
        <p>
          {TOUR_COUNT} paths, counted from the records that hold them rather than from this
          sentence. They are the ones that exist: the set is not a plan, and nothing here is a
          placeholder for a path that has not been written.
        </p>
        <p>
          Two others are described in this project&rsquo;s own specification and have not been
          written: a one-evening path and a full course, both of which would link the capstones
          rather than the papers. Until they exist the capstone of each paper is reached from that
          paper, and this page does not list them as though they were here.
        </p>
        <p>
          <a href="/capstones/mass-energy/">A capstone, to see what such a path would join</a>
        </p>
      </section>

      <section>
        <h2>Take a detour without losing the question</h2>
        <p>
          On a guided page, the navigation above the content offers the previous stop, next stop and
          full outline. A bookmark link saves only the public reading position. It does not save
          your laboratory settings, notebook or predictions.
        </p>
        <p>
          Without JavaScript, every outline, task, explanation and destination link remains
          readable. Return with your browser's Back command after visiting a stop, or keep the
          outline open beside the paper.
        </p>
        <p>
          <a href="/discover/">Explore the longer discovery reconstructions</a>
          {" · "}
          <a href="/instruments/">Choose an instrument directly</a>
        </p>
      </section>
    </article>
  );
}
