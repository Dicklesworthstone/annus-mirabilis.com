"use client";

import { expressionToSpokenText } from "../equations/derivations/a11yText.ts";
import { DerivationChain } from "../equations/derivations/DerivationChain.tsx";
import { renderExpressionMarkup } from "../equations/derivations/mathRenderer.ts";
import {
  srSynchronizationChain,
  srSynchronizationCriterion,
  srSynchronizationHistoricalReading,
  srSynchronizationMetadata,
  srSynchronizationSourceLinks,
} from "../equations/derivations/srSynchronization.ts";
import { CLOCK_WORKED_EXAMPLES } from "../experiments/sr01/entranceScenario.ts";

export interface SRSynchronizationDerivationProps {
  readonly activeDetail?: "0" | "1" | "2";
  readonly perspective?: "historical" | "modern";
}

/** Native disclosures, source returns and worked examples are present before hydration. */
export function SRSynchronizationDerivation({
  activeDetail = "1",
  perspective = "historical",
}: SRSynchronizationDerivationProps) {
  return (
    <section
      id="sr-synchronization-derivation"
      className="local-steps"
      aria-labelledby="sr-synchronization-derivation-title"
      data-argument-id={srSynchronizationMetadata.argument}
      data-review={srSynchronizationMetadata.review}
      data-historical-status="pedagogical-reconstruction"
      data-model-status={srSynchronizationMetadata.modelStatus}
    >
      <h4 id="sr-synchronization-derivation-title">
        Choose the clock rule, then follow what it fixes
      </h4>
      <p>
        A sends a flash and reads its own clock again when the reflection returns. Those two local
        readings do not yet say what a distant clock at B should show at reflection. The move is to
        define synchronized clocks by assigning equal time to the outward and return journeys. Once
        that choice is made, the midpoint reading follows by algebra.
      </p>
      <p>
        Keep the clocks and reflector at rest in one inertial frame, with clocks running at the same
        rate. The first line below only splits the round trip into two intervals whose sum is
        already known. Its marked replacement adopts the definition; the following three steps work
        out its consequence. No one-way speed measurement or coordinate transformation is hidden in
        that choice.
      </p>
      <details className="step-local-steps">
        <summary>The definition and the three clock readings</summary>
        <p>
          <i>t</i>
          <sub>A</sub> is A’s departure reading, <i>t</i>
          <sub>return</sub> its return reading, and <i>t</i>
          <sub>B</sub> the reading assigned to B at reflection. The source writes the return reading
          as <i>t</i>′<sub>A</sub>. Here “return” avoids confusing that prime with a moving frame.
        </p>
        <section
          className="step-math"
          aria-label={expressionToSpokenText(srSynchronizationCriterion)}
          {...{
            dangerouslySetInnerHTML: {
              __html: renderExpressionMarkup(srSynchronizationCriterion).html,
            },
          }}
        />
        <p>
          This equality states the rule being adopted. The algebra below shows what setting B’s
          clock must receive if it is to satisfy that rule.
        </p>
      </details>
      <DerivationChain
        chains={[srSynchronizationChain]}
        activeDetail={activeDetail}
        perspective={perspective}
        sourceLinkLabel="Read the source definition"
      />
      <h5>The same round trip with a different zero</h5>
      <p>
        With a departure at zero and a return at ten seconds, set B to five at reflection. Start
        instead at twenty and return at thirty: B must read twenty-five. The elapsed round trip is
        unchanged; the assigned clock reading moves with the clock’s zero. These ideal-model
        examples use the clock laboratory’s evaluator.
      </p>
      <div className="encounter-table">
        <table>
          <caption>
            Readings in seconds. Select an assigned reading to open that same example in the clock
            laboratory.
          </caption>
          <thead>
            <tr>
              <th scope="col">Departure at A</th>
              <th scope="col">Return to A</th>
              <th scope="col">Assigned at B</th>
            </tr>
          </thead>
          <tbody>
            {CLOCK_WORKED_EXAMPLES.map((example) => (
              <tr key={example.readings.departure}>
                <td>{example.readings.departure}</td>
                <td>{example.readings.reception}</td>
                <td>
                  <a
                    href={example.labHref}
                    aria-label={`Open the ${example.readings.departure} to ${example.readings.reception} second round trip, assigning B ${example.assigned} seconds, in the clock laboratory`}
                  >
                    {example.assigned}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        <a href="/papers/special-relativity/#entry-special-relativity">
          Try your own departure and return readings
        </a>
        , or <a href="/lab/sr-01/">open the full clock and event ledger</a>. The laboratory chooses
        a stationary separation that reproduces the entered round trip in its ideal light model; the
        two readings alone do not measure that distance.
      </p>
      <details className="step-local-steps">
        <summary>What this has, and has not, established</summary>
        <p>
          The midpoint is forced by the equal-leg definition. The observation at A alone did not
          select that definition or separately time the outward and return legs. A different B
          offset would leave A’s round-trip record unchanged and would fail this synchronization
          rule.
        </p>
        <p>
          The rule sets clock readings; it does not change a clock’s rate. Extending it to a whole
          network also requires the consistency assumptions stated in the next source paragraph. The
          later coordinate argument uses this convention in each inertial frame and has its own
          premises.
        </p>
        <p>
          <a href="/papers/special-relativity/view/german/#s1-p8">
            Read the source’s separate clock-network assumptions
          </a>
          {" · "}
          <a href="/papers/special-relativity/s3/#sr-coordinate-derivation">
            Follow the later coordinate transformation
          </a>
        </p>
      </details>
      <details className="modern-margin" data-reading="3">
        <summary>Historical context and notation</summary>
        <p>{srSynchronizationHistoricalReading.r3}</p>
        <p className="fine">
          <cite>{srSynchronizationHistoricalReading.r3Citations[0]}</cite>
        </p>
      </details>
      <h5>Return to the printed definition</h5>
      <ul>
        {srSynchronizationSourceLinks.map((source) => (
          <li key={source.id} id={source.id}>
            <a href={`/papers/special-relativity/view/german/#${source.anchor}`}>{source.label}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}
