"use client";

import { DerivationChain } from "../equations/derivations/DerivationChain.tsx";
import {
  presentSRSimultaneityChain,
  srSimultaneityAssumptions,
  srSimultaneityChain,
  srSimultaneityHistoricalReading,
  srSimultaneitySourceLinks,
} from "../equations/derivations/srSimultaneity.ts";
import type { ChainVerificationReport } from "../equations/derivations/verifyChain.ts";

const chain = presentSRSimultaneityChain(srSimultaneityChain);
const signatureHref =
  "/lab/sr-03/?sr=3&rodRestFrame=k&v=0.6&L0=10&measuringFrame=K&endpointPairId=platform-simultaneous&R=1";

export interface SRSimultaneityDerivationProps {
  readonly activeDetail?: "0" | "1" | "2";
  readonly perspective?: "historical" | "modern";
  /** Computed by the exact proof owner on the server, never by the reader component. */
  readonly report?: ChainVerificationReport;
}

/** The event choices, native step disclosures and source returns need no JavaScript. */
export function SRSimultaneityDerivation({
  activeDetail = "1",
  perspective = "historical",
  report,
}: SRSimultaneityDerivationProps) {
  const checked =
    report?.chainId === chain.id &&
    report.proofRouteId === chain.proofRouteId &&
    report.routeKind === chain.routeKind &&
    report.target === chain.target &&
    report.passed &&
    report.isPublicationReady &&
    report.errors.length === 0 &&
    report.graphIssues.length === 0 &&
    report.stepReports.length === chain.steps.length &&
    chain.steps.every((step, index) => {
      const result = report.stepReports[index];
      return (
        result?.stepId === step.id &&
        result.passed &&
        result.ruleOutcome === "pass" &&
        result.verificationStatus === "verified"
      );
    });
  return (
    <section
      id="sr-simultaneity-derivation"
      className="local-steps"
      aria-labelledby="sr-simultaneity-derivation-title"
      data-argument-id="arg-sr-rod-events"
      data-review="draft"
      data-historical-status="pedagogical-reconstruction"
      data-model-status="exact-within-stated-assumptions"
      data-simultaneity-proof={checked ? "checked" : "not-checked"}
    >
      <h4 id="sr-simultaneity-derivation-title">Keep the events, change the frame</h4>
      <p>
        Choose two events that K assigns the same time. To find what k assigns to that same pair,
        transform each event and subtract. The position-dependent part of the time map leaves a
        difference, even though the original times were equal. Keep the clock readings and positions
        arbitrary until the equal-time condition is actually used.
      </p>
      <p>
        This is a route you could take after admitting the coordinate transformation from §3. The
        paper’s earlier §2 argument uses the unequal outward and return light journeys along a
        moving rod. That argument remains in the reading above; the calculation here puts a number
        on the disagreement using the later map. It does not derive that map from its own
        consequence.
      </p>
      <p>
        Here k moves along K’s x axis at signed speed <i>v</i>. Primes name k’s coordinates,
        subscripts 1 and 2 name the same ordered events, and every Δ means event 2 minus event 1.
        Modern γ and <i>c</i> are the paper’s β and <i>V</i>. A time coordinate in k is not
        generally the proper time of a single clock.
      </p>
      <details className="local-steps">
        <summary>What this calculation takes as given</summary>
        <dl>
          {srSimultaneityAssumptions.map((assumption) => (
            <div key={assumption.id}>
              <dt>{assumption.label}</dt>
              <dd>{assumption.explanation}</dd>
            </div>
          ))}
        </dl>
        <a href="/papers/special-relativity/s3/#sr-coordinate-derivation">
          Follow the coordinate map and its own assumptions
        </a>
      </details>
      {checked && (
        <p className="fine">
          Each displayed subtraction, replacement and collection passes an exact algebra check. The
          checks are conditional on the stated premises; they do not establish the physical
          postulates or certify the historical explanation.
        </p>
      )}
      <DerivationChain
        chains={[chain]}
        activeDetail={activeDetail}
        perspective={perspective}
        sourceLinkLabel="Return to the admitted map or source claim"
      />
      <h5>Read the sign before interpreting a distance</h5>
      <p>
        With two events 10 light-seconds apart along positive x, simultaneous in K, a boost at 0.6
        <i>c</i> has γ = 1.25 and gives Δt′ = −7.5 seconds. Event 2 is earlier in k. Reversing the
        motion gives +7.5 seconds; reversing the event order also reverses the difference.
      </p>
      <div className="encounter-table">
        <table>
          <caption>For the same 10 light-second separation and equal K times</caption>
          <thead>
            <tr>
              <th scope="col">Relative speed</th>
              <th scope="col">Time of event 2 minus event 1 in k</th>
              <th scope="col">Which event is earlier in k?</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">+0.6c</th>
              <td>−7.5 seconds</td>
              <td>Event 2</td>
            </tr>
            <tr>
              <th scope="row">0</th>
              <td>0 seconds</td>
              <td>Equal times</td>
            </tr>
            <tr>
              <th scope="row">−0.6c</th>
              <td>+7.5 seconds</td>
              <td>Event 1</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        <a href={signatureHref}>Open the 0.6c, 10 light-second event pair in the laboratory</a>. The
        same pair has a spatial separation of 12.5 light-seconds in k, but its unequal k times mean
        that number is not a simultaneous rod length in k. A camera’s received light is a separate
        question again.
      </p>
      <details className="local-steps">
        <summary>When does the time difference vanish?</summary>
        <p>
          At zero relative speed, or zero separation along the motion, the offset is zero. The
          derivation never divides by either quantity, so these cases are included. For a nonzero
          speed and nonzero longitudinal separation, the offset is nonzero. Events separated only
          sideways can retain equal times under this particular boost.
        </p>
        <p>
          The calculation reassigns coordinates to events. It does not alter a clock’s mechanism,
          make a signal outrun light, or compare different endpoint events while calling them the
          same pair. If the original events have different K times, retain Δt in the general
          difference relation before the marked step.
        </p>
      </details>
      <h5>Return to the printed argument</h5>
      <ul>
        {srSimultaneitySourceLinks.map((source) => (
          <li key={source.id} id={source.id}>
            <a href={"/papers/special-relativity/view/german/#" + source.anchor}>{source.label}</a>
          </li>
        ))}
      </ul>
      <details className="modern-margin" data-reading="3">
        <summary>How this teaching route differs from the printed argument</summary>
        <p>{srSimultaneityHistoricalReading.r3}</p>
        <p className="fine">
          <cite>{srSimultaneityHistoricalReading.r3Citations[0]}</cite>
        </p>
      </details>
    </section>
  );
}
