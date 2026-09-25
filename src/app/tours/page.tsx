import type { Metadata } from "next";
import { requireTour, tourIds } from "../../content/tours/tours.ts";
import { GUIDED_TOURS } from "../../discovery/tours/catalogue.ts";
import "../../discovery/tours/tours.css";

export const metadata: Metadata = {
  title: "Guided reading paths",
  description:
    "Guided paths that follow one question from a first encounter, through the instruments, back to the paper it comes from.",
  alternates: { canonical: "/tours/" },
};

export default function GuidedToursIndex() {
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
            <p>{tour.stops.length} stops · Read, experiment and explain</p>
            <div className="guided-tour-actions">
              <a href={`/tours/${tour.id}/`}>Explore this reading path</a>
              <a href={`/papers/${tour.paper}/`}>Read the paper without a guide</a>
            </div>
          </section>
        ))}
      </div>
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
