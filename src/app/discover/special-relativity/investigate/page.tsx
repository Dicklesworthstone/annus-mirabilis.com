import type { Metadata } from "next";
import { Formula } from "../../../../components/edition/Formula.tsx";
import { RelativityEventTable } from "../../../../discovery/RelativityEventTable.tsx";
import { SpecialRelativityInvestigation } from "../../../../discovery/SpecialRelativityInvestigation.tsx";
import {
  RELATIVITY_CARDS,
  RELATIVITY_MEASUREMENTS,
} from "../../../../discovery/specialRelativityInvestigation.ts";
import "../../../../discovery/investigationPage.css";
import "./investigation.css";
import { StepDoor, StepDoors } from "../../../../discovery/StepDoor.tsx";

export const metadata: Metadata = {
  title: "Investigate relativity: construct a map and choose a measurement",
  description:
    "Build a conditional coordinate transformation, expose its missing scale, and distinguish event separations from length measurements.",
  robots: { index: false },
};

/** An explanatory workbench, not publication of the reviewed Journey III record. */
export default function SpecialRelativityInvestigationPage() {
  const equations = Object.fromEntries(
    RELATIVITY_CARDS.map((card) => [card.id, <Formula key={card.id} latex={card.formula} />]),
  ) as Parameters<typeof SpecialRelativityInvestigation>[0]["equations"];
  return (
    <article
      className="sr-investigation-page investigation-page"
      data-discovery-workbench="special-relativity"
      data-edition-status="explanatory-preview"
    >
      <header className="page-intro">
        <p className="eyebrow">Discover · Special relativity · An explanatory investigation</p>
        <h1>What must change when both observers measure the same light speed?</h1>
        <p className="lead">
          Build, from assumptions you choose, the rule that turns one observer&rsquo;s times and
          places into another&rsquo;s. Then choose different events to measure, and see that the
          rule itself never changes.
        </p>
        <p className="notice">
          A route you could take, not a transcript of Einstein’s private thoughts.
        </p>
        <nav className="actions" aria-label="Relativity investigation stages">
          <a href="#sr-start">Clocks before coordinates</a>
          <a href="#sr-investigation">Construct the map</a>
          <a href="#sr-measurement">Choose events</a>
          <a href="#sr-electrodynamics">Continue to electrodynamics</a>
        </nav>
      </header>
      <section id="sr-start" className="reading" aria-labelledby="sr-start-title">
        <h2 id="sr-start-title">A remote event is not the arrival of its image</h2>
        <p>
          Begin with clocks at named stations and an explicit light-signal synchronization
          procedure. Reading a remote clock when light reaches your eye adds a travel delay; that
          reception is a different event from the one being timed.
        </p>
        <StepDoors>
          <StepDoor href="/papers/special-relativity/#entry-special-relativity">
            Start with one flash and two clocks, without algebra
          </StepDoor>
          <StepDoor href="/lab/sr-01/">Inspect the synchronization event ledger</StepDoor>
        </StepDoors>
        <details>
          <summary>What the ordinary map preserves, and what it does not</summary>
          <Formula
            latex={String.raw`\begin{gathered}x'=x-vt,\quad t'=t;\\ x=\pm ct\ \Longrightarrow\ x'=(\pm c-v)t'\end{gathered}`}
          />
          <p>
            The Galilean map retains absolute time and describes familiar low-speed motions. It does
            not jointly retain absolute time and the same coordinate light speed in both directions.
            This conditional inconsistency is not an experimental refutation of every classical
            model.
          </p>
        </details>
        <details>
          <summary>Notation and the scope of this reconstruction</summary>
          <p>
            Here c is the vacuum light speed and γ the Lorentz factor. Einstein’s paper uses V for
            light speed and β for the factor. The editorial transverse scale k is distinct from a
            frame label. This linear-map reconstruction is not a replacement for the paper’s
            synchronization-based derivation. Aligned axes and coincident origins are assumed;
            accelerated and arbitrarily rotated coordinates are not derived.
          </p>
          <p className="ways-on">
            <a href="/notation/">Consult the section-scoped notation concordance</a>
            {" · "}
            <a href="/papers/special-relativity/">Read the paper</a>
          </p>
        </details>
      </section>
      <SpecialRelativityInvestigation equations={equations} />
      <section className="reading" aria-labelledby="sr-worked-examples">
        <h2 id="sr-worked-examples">Compare all three worked event selections</h2>
        <p>
          These examples remain available without JavaScript or answering a question. In each, the
          moving frame travels at +0.6c and γ = 1.25. A light-second is a distance, not a time
          coordinate.
        </p>
        {RELATIVITY_MEASUREMENTS.map((example) => (
          <details key={example.id}>
            <summary>{example.title}</summary>
            <RelativityEventTable example={example} />
            <p>{example.reason}</p>
            <p>{example.unchanged}</p>
          </details>
        ))}
      </section>
      <section
        id="sr-electrodynamics"
        className="reading"
        aria-labelledby="sr-electrodynamics-title"
      >
        <h2 id="sr-electrodynamics-title">The paper does not stop at clocks and rulers</h2>
        <p>
          The same distinction between a physical change and a change of description matters for
          fields, forces and light. Transformed components need not have equal numerical values.
          Describe the same event with the stated transformation law before making a comparison.
        </p>
        <StepDoors>
          <StepDoor href="/lab/sr-08/">Compare fields and forces in two frames</StepDoor>
          <StepDoor href="/lab/sr-09/">Follow wave phase, frequency and direction</StepDoor>
          <StepDoor href="/lab/sr-10/">Follow the energy of a light complex</StepDoor>
        </StepDoors>
        <p>
          The light-energy transformation supplies an explicit premise for the next paper. It is not
          inferred by assuming mass–energy equivalence.
        </p>
        <nav className="actions" aria-label="Continue the investigation">
          <a href="/discover/mass-energy/investigate/">
            Continue to the two-ledger mass–energy argument
          </a>
          <a href="/papers/special-relativity/">Read the special-relativity paper</a>
          <a href="/discover/special-relativity/">Back to the relativity route</a>
        </nav>
      </section>
    </article>
  );
}
