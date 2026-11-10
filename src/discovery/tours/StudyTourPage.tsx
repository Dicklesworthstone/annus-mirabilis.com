import type { TourStop } from "./catalogue.ts";
import { tourDestination, tourPosition } from "./navigation.ts";
import { type StudyTour, studyGuide } from "./studyTypes.ts";
import "./studyTours.css";

export function StudyTourPage({ tour }: { tour: StudyTour }) {
  const guide = studyGuide(tour);
  const lookup = (id: string) => (id === guide.id ? guide : null);
  const href = (stop: TourStop) => tourDestination(tourPosition(guide, stop, lookup), lookup);
  const first = guide.stops[0];
  const isCourse = tour.budget === "full-course";
  return (
    <article className="guided-tour-page study-tour-page" data-study-tour={tour.id}>
      <header className="page-intro">
        <p className="eyebrow">
          {isCourse ? "A course through the edition" : "Read a whole paper"} · Equations included
        </p>
        <h1>{tour.title}</h1>
        <p className="lead">{tour.introduction}</p>
        <p>
          {tour.sessions.length}{" "}
          {isCourse ? "sessions" : tour.sessions.length === 1 ? "evening" : "evenings"}
          {" · About "}
          {tour.totalMinutes} minutes in total.
          {isCourse
            ? " Each session is at most two hours."
            : " Each evening is between one and four hours."}
        </p>
        <p>
          These are planning estimates, with time for reading and trying the instruments. A reading
          gets at least its full text at 200 words per minute; you can take longer, pause anywhere
          or skip familiar material. Every explanation is available without submitting an answer.
        </p>
        {isCourse && (
          <p>
            The available course includes {tour.preparation.lessonCount} published foundation
            lessons. The companion reading and the reasoning essays still being prepared are listed
            below.
          </p>
        )}
        <nav className="guided-tour-actions" aria-label="Begin or choose a study route">
          {first && <a href={href(first)}>Begin this route</a>}
          {isCourse && <a href="/tours/full-course/syllabus/">Open the printable syllabus</a>}
          {!isCourse && <a href="/tours/full-course/">Follow the full course with foundations</a>}
          <a href="/tours/">Choose another path</a>
        </nav>
        <p>
          With JavaScript, the guide follows you between stops and provides a bookmark for your
          reading position. Without it, every destination below remains a working link. Keep the
          outline beside the paper or return using your browser's Back command.
        </p>
      </header>

      <nav className="study-session-index" aria-label="Sessions in this route">
        <h2>{isCourse ? "Choose a session" : "Plan your reading"}</h2>
        <ol>
          {tour.sessions.map((part) => (
            <li key={part.id}>
              <a href={`#session-${part.id}`}>{part.title}</a>
              {" · "}
              {part.minutes} minutes
            </li>
          ))}
        </ol>
      </nav>

      <details className="study-source-notices">
        <summary>Compare the explanation, translation and source</summary>
        {tour.sourceNotices.map((notice) => (
          <section key={notice.paper}>
            <h2>
              <a href={`/papers/${notice.paper}/`}>{notice.paper.replace(/-/g, " ")}</a>
            </h2>
            <p>
              <a href={`/papers/${notice.paper}/view/english/`}>English translation</a>
              {" · "}
              <a href={`/papers/${notice.paper}/view/german/`}>German text</a>
              {" · "}
              <a href={`/papers/${notice.paper}/view/facsimile/`}>Journal pages</a>
            </p>
          </section>
        ))}
        <p>
          A laboratory computes consequences of a model. The source, translation, explanatory
          reading and editorial margin each answer a different reading question.
        </p>
      </details>

      {tour.sessions.map((part, index) => (
        <section
          key={part.id}
          id={`session-${part.id}`}
          className="study-session"
          aria-labelledby={`session-title-${part.id}`}
        >
          <p className="eyebrow">
            {isCourse ? "Session" : "Evening"} {index + 1} · About {part.minutes} minutes
          </p>
          <h2 id={`session-title-${part.id}`}>{part.title}</h2>
          <p>{part.summary}</p>
          <ol className="guided-tour-stops">
            {part.steps.map((stop) => (
              <li key={stop.id} id={`tour-stop-${stop.id}`} data-study-kind={stop.kind}>
                <p className="eyebrow">
                  {stop.kind.replace(/-/g, " ")} · About {stop.minutes} minutes
                </p>
                <h3>
                  <a href={href(stop)}>{stop.title}</a>
                </h3>
                <p>{stop.task}</p>
                <p>
                  <strong>Consider:</strong> {stop.question}
                </p>
                <details>
                  <summary>Read the explanation at any time</summary>
                  <p>{stop.explanation}</p>
                </details>
                <div className="guided-tour-actions">
                  <a href={href(stop)}>Open this stop</a>
                  <a href={stop.href}>Open without the guide</a>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}

      {tour.inPreparation.length > 0 && (
        <section className="study-preparation" aria-labelledby="study-preparation-title">
          <h2 id="study-preparation-title">Still in preparation</h2>
          <p>
            These parts of the planned curriculum are not included in the time estimate or linked as
            finished readings.
          </p>
          <ul>
            {tour.inPreparation.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}
      <section id="tour-finish" aria-labelledby="tour-finish-title">
        <h2 id="tour-finish-title">Carry a question into the next reading</h2>
        <p>
          Choose one claim and explain which premises support it, which measurement would
          distinguish it from an alternative, and where its model stops applying. The route's final
          stop makes no claim about what you have mastered.
        </p>
        <nav className="guided-tour-actions" aria-label="Continue after the study route">
          <a href="/connections/">Return to the connections among the papers</a>
          <a href="/tours/">Choose another route</a>
          {isCourse && <a href="/tours/full-course/syllabus/">Keep a copy of the syllabus</a>}
        </nav>
      </section>
    </article>
  );
}
