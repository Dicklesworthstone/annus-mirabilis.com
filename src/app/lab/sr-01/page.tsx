import type { Metadata } from "next";
import { LabFormula, LabInlineFormula } from "../../../components/lab/LabFormula.tsx";
import { LabInlineTerms } from "../../../components/lab/LabInlineTerms.tsx";
import { ClockSyncComparison } from "../../../components/lab/sr01/ClockSyncLab.tsx";
import { DEFAULT_PREPARED_EXAMPLE } from "../../../experiments/sr01/session.ts";
import labDigests from "../../../generated/lab-source-digests.json";

export const metadata: Metadata = {
  title: "Clock synchronization with the event ledger",
  description:
    "A signal goes out, bounces off a distant clock, and comes back. Splitting the round-trip time in half is Einstein's stated procedure for timing something far away.",
};

export default function ClockSyncPage() {
  // The example names its host source by digest (scripts/generate-lab-digests.mjs).
  const example = { ...DEFAULT_PREPARED_EXAMPLE, sourceDigest: labDigests["sr-01"] };

  return (
    <>
      <LabInlineTerms lab="sr-01" />
      <header className="page-intro">
        <p className="eyebrow">Special relativity &middot; Clock synchronization</p>
        <h1>
          <span>How do distant clocks</span> <span>agree on a time?</span>
        </h1>
        <p className="lead">
          A signal goes out, bounces off a distant clock, and comes back. Splitting the round-trip
          time in half is Einstein&apos;s stated procedure for giving a time to something far away.
          It is a stated agreement, not an independent measurement of the two one-way travel times.
        </p>
      </header>

      <ClockSyncComparison example={example} restoreFromLocation />
      <nav className="lab-onward" aria-label="From here">
        <h2>From here</h2>
        <ul>
          <li>
            <a href="/papers/special-relativity/s1/#arg-sr-synchronization">
              {" "}
              Read the synchronization argument (explanatory preview){" "}
            </a>
          </li>
        </ul>
      </nav>

      <section className="reading" id="clock-sync-argument">
        <p className="eyebrow">Open the derivation</p>
        <h2>Einstein&apos;s criterion</h2>
        <p>
          A signal leaves clock A at time <LabInlineFormula lab="sr-01" latex="t_A" />, reflects at
          the distant clock B, and returns to A at <LabInlineFormula lab="sr-01" latex="t'_A" />.
          The paper does not measure B&apos;s reading at reflection; it <em>assigns</em> it by
          definition as the midpoint:
        </p>
        <LabFormula lab="sr-01" latex="t_B = \tfrac{1}{2}\left(t_A + t'_A\right)" />
        <p>
          The round-trip speed{" "}
          <LabInlineFormula lab="sr-01" latex="2\cdot\mathrm{AB} / (t'_A - t_A)" /> then equals{" "}
          <var>c</var> in the frame where the procedure is applied. The procedure was built to give
          that result; it does not measure the speed of light.
        </p>

        <h2>Section 2: the moving rod</h2>
        <p>
          Running the same procedure on the two ends of a moving rod gives two different leg times
          in the stationary frame: an outbound leg{" "}
          <LabInlineFormula lab="sr-01" latex="r_{AB} / (c - u)" /> and a return leg{" "}
          <LabInlineFormula lab="sr-01" latex="r_{AB} / (c + u)" />, because the receiving end has
          moved during the light&apos;s travel. For observers moving with the rod, the criterion
          that held for the stationary observer fails.
        </p>

        <h2>Clocks that move disagree, once you compare them</h2>
        <p>
          A pair of clocks synchronized this way in their own rest frame, but moving together at
          speed <var>v</var>, is found out of step by <code>vL/c&sup2;</code> in the platform frame,
          with the trailing clock ahead. Try the moving-pair preset above and predict the answer
          before revealing it.
        </p>

        <h2>Light is not the only way</h2>
        <p>
          The paper chooses light because it makes the assumption it is making visible, not because
          light is the only possible way to compare distant clocks. Slow clock transport is a
          coherent alternative: carry a clock, synchronized side by side with another, out to the
          distant station. It requires its own assumption, about how a clock&apos;s rate depends on
          its motion, and agrees with the light convention only in the limit of vanishingly slow
          transport.
        </p>

        <div className="actions">
          <a href="/lab/me-01/">The two-ledger mass&ndash;energy derivation</a>
          <a href="/lab/bm-01/">The Brownian tracer laboratory</a>
        </div>
      </section>
    </>
  );
}
