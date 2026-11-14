import type { Metadata } from "next";
import { LinkedObserverLab } from "../../../components/lab/LinkedObserverLab.tsx";
import { prepareLinkedObserverExamples } from "../../../experiments/groups/linkedObserver.ts";
import { LINKED_OBSERVER_LESSON } from "../../../experiments/groups/linkedObserverLesson.ts";
import { loadRelativityObserverGroup } from "../../../experiments/groups/load.ts";
import dopplerExample from "../../../generated/sr09-example.json";
import lightComplexExample from "../../../generated/sr10-example.json";
import { NotModeledLine } from "../NotModeledLine.tsx";

export const metadata: Metadata = {
  title: LINKED_OBSERVER_LESSON.title,
  description: LINKED_OBSERVER_LESSON.description,
  alternates: { canonical: LINKED_OBSERVER_LESSON.href },
};

export default function LinkedObserverPage() {
  const definition = loadRelativityObserverGroup();
  const examples = prepareLinkedObserverExamples({
    doppler: dopplerExample,
    lightComplex: lightComplexExample,
  });
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Special relativity · One change across two instruments</p>
        <h1>{LINKED_OBSERVER_LESSON.title}</h1>
        <p className="lead">{LINKED_OBSERVER_LESSON.question}</p>
        <p>
          Keep the light fixed and change who describes it. Link the two observer controls to
          compare the wave's frequency with the packet's total energy, then unlink them to see why
          the observer has to match.
        </p>
      </header>
      <LinkedObserverLab definition={definition} examples={examples} />
      <section className="reading">
        <h2>The connection Einstein points out</h2>
        <p>
          In §7 Einstein transforms the frequency and direction of a plane light wave. In §8 he
          follows the energy enclosed by a boundary moving with the light. He finds that frequency
          and total energy change by the same factor when the observer changes.
        </p>
        <p>
          This comparison uses the two instruments' own accepted calculations. The light-complex
          argument does not assume that the energy is a photon count times a frequency. Linking
          their observer descriptions lets you examine the relation without importing the March
          paper's light-quanta hypothesis.
        </p>
        <p>
          The boundary of this packet moves with its light. It is not the boundary of a stationary
          material body; the full light-complex laboratory lets you compare those two models.
        </p>
      </section>
      <NotModeledLine instrumentId="sr-09" />
      <NotModeledLine instrumentId="sr-10" />
      <nav className="lab-onward" aria-label="From the linked observer comparison">
        <h2>From here</h2>
        <ul>
          <li>
            <a href="/papers/special-relativity/#s7">
              Read §7: the Doppler principle and aberration
            </a>
          </li>
          <li>
            <a href="/papers/special-relativity/#s8">Read §8: the energy of a light complex</a>
          </li>
          <li>
            <a href="/lab/me-01/">Follow two light pulses into the mass–energy argument</a>
          </li>
          <li>
            <a href="/lab/sr-03/compare/">Keep two events fixed and change the observer</a>
          </li>
        </ul>
      </nav>
    </>
  );
}
