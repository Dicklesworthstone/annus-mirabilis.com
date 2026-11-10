import type { Metadata } from "next";
import { requireTour, tourIds } from "../../content/tours/tours.ts";
import { GUIDED_TOURS } from "../../discovery/tours/catalogue.ts";
import { loadStudyTours } from "../../discovery/tours/studyTours.ts";
import { tourFacts } from "./tourFacts.ts";
import "../../discovery/tours/tours.css";

export const metadata: Metadata = {
  title: "Guided reading paths",
  description:
    "Guided paths that follow one question from a first encounter, through the instruments, back to the paper it comes from.",
  alternates: { canonical: "/tours/" },
};

export default async function GuidedToursIndex() {
  const studyTours = await loadStudyTours(process.cwd());
  const TOUR_COUNT = tourIds(process.cwd()).length + GUIDED_TOURS.length + studyTours.length;
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
        {studyTours.map((tour) => (
          <section key={tour.id} aria-labelledby={`study-${tour.id}`}>
            <p className="eyebrow">
              {tour.budget === "full-course" ? "A course through the edition" : "A whole paper"}
            </p>
            <h2 id={`study-${tour.id}`}>
              <a href={`/tours/${tour.id}/`}>{tour.title}</a>
            </h2>
            <p>{tour.introduction}</p>
            <p>
              {tour.sessions.length}{" "}
              {tour.budget === "full-course"
                ? "sessions"
                : tour.sessions.length === 1
                  ? "evening"
                  : "evenings"}
              {" · About "}
              {tour.totalMinutes} minutes · Equations included
            </p>
            {tour.budget === "full-course" && (
              <p>
                {tour.preparation.lessonCount} published foundation lessons, placed before the
                readings that call for them. The outline names the companion and essays still in
                preparation.
              </p>
            )}
            <div className="guided-tour-actions">
              <a href={`/tours/${tour.id}/`}>Open this study route</a>
              {tour.budget === "full-course" && (
                <a href="/tours/full-course/syllabus/">Print the syllabus</a>
              )}
            </div>
          </section>
        ))}
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
          The evening routes include complete explanatory readings, all of each paper&rsquo;s core
          instruments and its capstone. The course adds the published foundation library, every
          discovery door, the exercises and the connections among the papers. Its syllabus lists the
          material still being prepared separately from the available sessions.
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
