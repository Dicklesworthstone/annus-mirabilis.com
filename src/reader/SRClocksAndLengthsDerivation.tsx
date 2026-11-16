"use client";

import { DerivationChain } from "../equations/derivations/DerivationChain.tsx";
import {
  presentSRClockLengthChain,
  srClockLengthAssumptions,
  srClockLengthHistoricalReading,
  srClockLengthSourceLinks,
  srClocksAndLengths,
} from "../equations/derivations/srClocksAndLengths.ts";

const clock = presentSRClockLengthChain(srClocksAndLengths.clock);
const length = presentSRClockLengthChain(srClocksAndLengths.length);

export interface SRClocksAndLengthsDerivationProps {
  readonly activeDetail?: "0" | "1" | "2";
  readonly perspective?: "historical" | "modern";
}

/** The event choices, full steps and source returns remain readable without JavaScript. */
export function SRClocksAndLengthsDerivation({
  activeDetail = "1",
  perspective = "historical",
}: SRClocksAndLengthsDerivationProps) {
  return (
    <section
      id="sr-clock-length-derivation"
      className="local-steps"
      aria-labelledby="sr-clock-length-derivation-title"
      data-argument-id="arg-sr-clock-and-length"
      data-historical-status="pedagogical-reconstruction"
      data-model-status="inertial-subluminal-measurement"
    >
      <h4 id="sr-clock-length-derivation-title">
        Choose the events before comparing clocks and lengths
      </h4>
      <p>
        The coordinate transformation alone does not tell us what a clock or a ruler measures. First
        choose the right two events. Two ticks of one clock share a place in the clock’s rest frame.
        Two marks locating a moving rod’s ends share a time in the measuring frame. Those different
        choices give the two familiar formulas.
      </p>
      <p>
        Here <i>k</i> moves along <i>K</i>’s x axis at signed speed <i>v</i>. Primes label
        coordinates in <i>k</i>, and subscripts 1 and 2 label the two events. γ is the paper’s β;
        <i>c</i> is its <i>V</i>. Modern Δτ names the time one clock records, whereas the paper’s τ
        names the moving frame’s time coordinate. No starting reading or endpoint position is
        silently set to zero.
      </p>
      <div className="encounter-table">
        <table>
          <caption>Two different choices of events</caption>
          <thead>
            <tr>
              <th scope="col">Question</th>
              <th scope="col">What is held equal?</th>
              <th scope="col">What is compared?</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">One moving clock</th>
              <td>The two positions in k</td>
              <td>K’s coordinate interval and the clock’s own elapsed time</td>
            </tr>
            <tr>
              <th scope="row">One moving rod</th>
              <td>The two times in K</td>
              <td>The simultaneous endpoint separation and the rod’s rest length</td>
            </tr>
          </tbody>
        </table>
      </div>
      <details className="step-local-steps">
        <summary>What these calculations take as given</summary>
        <dl>
          {srClockLengthAssumptions.map((assumption) => (
            <div key={assumption.id}>
              <dt>{assumption.label}</dt>
              <dd>{assumption.explanation}</dd>
            </div>
          ))}
        </dl>
        <a href="/papers/special-relativity/s3/#sr-coordinate-derivation">
          Return to the coordinate transformation and its own premises
        </a>
      </details>
      <h5 id="sr-clock-length-clock">Two ticks of one clock</h5>
      <p>
        Use the inverse time transformation so the two ticks can be specified directly in the
        clock’s rest frame. Subtract the two transformed readings, then use their common moving
        position. The position correction cancels; the elapsed times differ by γ.
      </p>
      <DerivationChain chains={[clock]} activeDetail={activeDetail} perspective={perspective} />
      <p>
        At 0.6<i>c</i>, γ = 1.25. If that clock records 0.8 seconds between its ticks, K’s
        synchronized clocks assign 1 second to the same events. Reversing the direction of motion
        leaves this factor unchanged. The moving clock’s own mechanism runs normally in its rest
        frame.
      </p>
      <p>
        <a href="/lab/sr-05/">Compare the clocks and their identified events in the laboratory</a>
      </p>
      <h5 id="sr-clock-length-rod">Two simultaneous endpoint marks</h5>
      <p>
        Use the position transformation for each endpoint. Before imposing equal times, the
        difference includes the rod’s motion between the two marks. Set the times equal in K, then
        read the rest length and the measured length from the two separations.
      </p>
      <DerivationChain chains={[length]} activeDetail={activeDetail} perspective={perspective} />
      <p>
        At 0.6<i>c</i> a rod with rest length 1 metre measures 0.8 metres in K. Marking its ends
        simultaneously in k instead selects another pair of events; their separation in K is not
        this simultaneous length. A photograph also asks a different question because the light from
        the two ends can leave at different times.
      </p>
      <p>
        <a href="/lab/sr-03/">Choose the measuring frame and compare the rod’s endpoint events</a>
      </p>
      <details className="step-local-steps">
        <summary>What follows, and where the argument stops</summary>
        <p>
          Both results are consequences of the admitted coordinate maps and the stated measurement
          protocols. They do not rederive the maps, test their physical premises, or establish how
          an accelerating clock or deforming body behaves. The rod calculation concerns its
          longitudinal length; the unchanged transverse axes of Einstein’s sphere use the separate
          transverse map from §3.
        </p>
        <p>
          The source goes on to discuss transported clocks, a low-speed approximation and a
          continuously curved path. Those are additional claims with additional assumptions.
          Comparing the same pair of inertial clock ticks does not by itself establish them.
        </p>
      </details>
      <details className="modern-margin" data-reading="3">
        <summary>How this compares with the printed argument</summary>
        <p>{srClockLengthHistoricalReading.r3}</p>
        <p className="fine">
          <cite>{srClockLengthHistoricalReading.r3Citations[0]}</cite>
        </p>
      </details>
      <h5>Return to the printed argument</h5>
      <ul>
        {srClockLengthSourceLinks.map((source) => (
          <li key={source.id} id={source.id}>
            <a href={"/papers/special-relativity/view/german/#" + source.anchor}>{source.label}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}
