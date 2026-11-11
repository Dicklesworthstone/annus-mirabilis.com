import "./connections.css";
import { ExercisePart } from "../../components/discover/ExercisePart.tsx";
import { ExplanationPart } from "../../components/discover/ExplanationPart.tsx";
import { NumericPart } from "../../components/discover/NumericPart.tsx";
import { AVOGADRO_RADIUS_COMPARISON, type AvogadroRadiusComparison } from "./avogadro.ts";
import type { ConnectionExercise, ConnectionExercisePart, ConnectionLink } from "./types.ts";

function ExerciseLinks({ links }: { links: readonly ConnectionLink[] }) {
  if (!links.length) return null;
  return (
    <ul>
      {links.map((link) => (
        <li key={link.href}>
          <a href={link.href}>{link.label}</a>
        </li>
      ))}
    </ul>
  );
}

function Part({ entry }: { entry: ConnectionExercisePart }) {
  return (
    <fieldset className="connection-exercise" aria-label={entry.part.prompt}>
      {entry.kind === "numeric" && (
        <>
          <NumericPart part={entry.part} />
          <p>{entry.part.reference.executionLabel}</p>
        </>
      )}
      {entry.kind === "expression" && <ExercisePart part={entry.part} />}
      {entry.kind === "explanation" && <ExplanationPart part={entry.part} />}
    </fieldset>
  );
}

function RadiusComparison({ comparison }: { comparison: AvogadroRadiusComparison }) {
  const { known, unknown } = comparison;
  const display = (value: number) => value.toExponential(5);
  return (
    <section aria-labelledby="avogadro-radius-heading">
      <h5 id="avogadro-radius-heading">What changes when the radius is unknown?</h5>
      <p>
        With the independent radius a = {display(known.radius)} m, this sample gives N̂ ={" "}
        {display(known.result.value)} mol⁻¹ and a conditional 95% interval [
        {display(known.interval.lower)}, {display(known.interval.upper)}] mol⁻¹.
      </p>
      <details data-radius-comparison="same-synthetic-sample">
        <summary>Remove the independently supplied radius</summary>
        <p data-result-status={unknown.status}>{unknown.reason}</p>
        <p>
          Keep the same displacements, temperature, viscosity and gas constant. The same estimated
          spread gives aN ≈ {display(unknown.product)} m/mol. These pairs lie on that estimated
          constraint; sampling uncertainty would broaden it.
        </p>
        <table>
          <caption>Compatible radii and molecular numbers for this synthetic sample</caption>
          <thead>
            <tr>
              <th scope="col">Radius a (m)</th>
              <th scope="col">Molecular number N (mol⁻¹)</th>
            </tr>
          </thead>
          <tbody>
            {unknown.family.map((point) => (
              <tr key={point.radius}>
                <td>{display(point.radius)}</td>
                <td>{display(point.molecularNumber)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          There is no single estimate or interval for N until independent radius information is
          restored.
        </p>
      </details>
    </section>
  );
}

/** Server-rendered tasks; the existing answer checker is the only hydrated numerical surface. */
export function ConnectionExercises({ exercises }: { exercises: readonly ConnectionExercise[] }) {
  return (
    <section className="page-flush" aria-labelledby="cross-journey-heading">
      <div className="reading">
        <p className="eyebrow">Try a connection yourself</p>
        <h2 id="cross-journey-heading">Carry a reasoning move into another paper</h2>
        <p>
          Choose a comparison. Worked explanations and criteria are available before you answer.
          Number and expression checks run in this page; explanations are yours to judge, and no
          answer is sent anywhere.
        </p>
        <nav aria-label="Cross-paper exercises">
          <ExerciseLinks
            links={exercises.map(({ id, title }) => ({ href: `#${id}`, label: title }))}
          />
        </nav>
      </div>
      {exercises.map((exercise) => (
        <section
          key={exercise.id}
          id={exercise.id}
          className="reading page-flush"
          aria-labelledby={`${exercise.id}-title`}
          data-connection-exercise={exercise.id}
          data-historical-status={exercise.historicalStatus}
        >
          {exercise.historicalStatus === "later-development" && (
            <p className="eyebrow">Modern lens</p>
          )}
          <h3 id={`${exercise.id}-title`}>{exercise.title}</h3>
          {exercise.introduction.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {exercise.sections.map((section) => (
            <section key={section.id} aria-labelledby={`${section.id}-title`}>
              <h4 id={`${section.id}-title`}>{section.title}</h4>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.parts.map((entry) => (
                <Part key={entry.part.id} entry={entry} />
              ))}
              {section.id === "avogadro-brownian" && (
                <RadiusComparison comparison={AVOGADRO_RADIUS_COMPARISON} />
              )}
              {section.links && <ExerciseLinks links={section.links} />}
            </section>
          ))}
          <h4>Return to the arguments</h4>
          <ExerciseLinks links={exercise.links} />
        </section>
      ))}
    </section>
  );
}
