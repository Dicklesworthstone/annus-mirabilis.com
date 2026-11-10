import { PrintSyllabus } from "./PrintSyllabus.tsx";
import type { StudyTour } from "./studyTypes.ts";
import "./studyTours.css";

export function StudySyllabus({ tour }: { tour: StudyTour }) {
  return (
    <article className="guided-tour-page study-syllabus" data-study-syllabus>
      <header className="page-intro">
        <p className="eyebrow">Annus Mirabilis · Printable syllabus</p>
        <h1>{tour.title}</h1>
        <p className="lead">{tour.introduction}</p>
        <p>
          {tour.sessions.length} sessions · About {tour.totalMinutes} minutes ·{" "}
          {tour.preparation.lessonCount} published foundation lessons
        </p>
        <p>
          Foundation lessons appear before the reading that calls for them. Their own proof
          prerequisites determine the order; related-reading links do not create prerequisites.
          Previously introduced lessons remain available for review.
        </p>
        <p>
          Each session fits within two hours of the estimate, including its new foundations. Take
          longer whenever you need to work a step through. Use your browser's Print command, or the
          button below, to print on A4 or Letter paper or save a PDF.
        </p>
        <nav className="guided-tour-actions" aria-label="Print or return to the course">
          <PrintSyllabus />
          <a href="/tours/full-course/">Open the course with questions and explanations</a>
          <a href="/tours/">All guided paths</a>
        </nav>
      </header>
      {tour.sessions.map((part, index) => {
        const preparation = tour.preparation.sessions.find((item) => item.sessionId === part.id);
        return (
          <section
            key={part.id}
            className="study-syllabus-session"
            aria-labelledby={`syllabus-${part.id}`}
          >
            <h2 id={`syllabus-${part.id}`}>
              {index + 1}. {part.title}
            </h2>
            <p>
              {part.summary} About {part.minutes} minutes.
            </p>
            {preparation && preparation.revisit.length > 0 && (
              <p className="study-revisit">
                Available from earlier sessions:{" "}
                {preparation.revisit.map((lesson, lessonIndex) => (
                  <span key={lesson.id}>
                    {lessonIndex > 0 ? "; " : ""}
                    <a href={`/foundations/${lesson.id}/`}>{lesson.title}</a>
                  </span>
                ))}
                .
              </p>
            )}
            <ol className="study-syllabus-stops">
              {part.steps.map((stop) => (
                <li key={stop.id}>
                  <a href={stop.href}>{stop.title}</a>
                  {" · "}
                  {stop.kind.replace(/-/g, " ")}
                  {" · "}
                  {stop.minutes} min
                  <span className="study-print-address">{stop.href}</span>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
      <section aria-labelledby="syllabus-scope">
        <h2 id="syllabus-scope">Scope of this syllabus</h2>
        <p>
          The readings are the edition's explanatory texts at detail 1. Their source faces and
          journal pages remain available beside them. Laboratory results are model calculations, and
          every later or modern comparison keeps its stated provenance.
        </p>
        {tour.inPreparation.length > 0 && (
          <>
            <h3>Planned material still in preparation</h3>
            <ul>
              {tour.inPreparation.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        )}
        <p>Course and current outline: annus-mirabilis.com/tours/full-course/</p>
      </section>
    </article>
  );
}
