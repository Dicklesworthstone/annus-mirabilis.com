import type { Metadata } from "next";
import { ClockSyncComparison } from "../../../components/lab/sr01/ClockSyncLab.tsx";
import { DEFAULT_PREPARED_EXAMPLE } from "../../../experiments/sr01/session.ts";

export const metadata: Metadata = {
  title: "Clock synchronization with the event ledger",
};

export default function ClockSyncPage() {
  const example = DEFAULT_PREPARED_EXAMPLE;

  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Special relativity &middot; Clock synchronization</p>
        <h1>
          How do distant clocks
          <br />
          agree on a time?
        </h1>
        <p className="lead">
          A signal goes out, bounces off a distant clock, and comes back. Splitting the round-trip
          time in half is Einstein&apos;s stated procedure for giving a time to something far away
          &mdash; a stated agreement, not an independent measurement of the two one-way travel
          times.
        </p>
        <p>
          <a href="/papers/special-relativity/s1/#arg-sr-synchronization">
            Read the synchronization argument (explanatory preview)
          </a>
        </p>
      </header>

      <ClockSyncComparison example={example} restoreFromLocation />

      <section className="reading" id="clock-sync-argument">
        <p className="eyebrow">Open the derivation</p>
        <h2>Einstein&apos;s criterion</h2>
        <p>
          A signal leaves clock A at time <var>t_A</var>, reflects at the distant clock B, and
          returns to A at <var>t&apos;_A</var>. The paper does not measure B&apos;s reading at
          reflection; it <em>assigns</em> it by definition as the midpoint:
        </p>
        <p>
          <code>t_B = (t_A + t'_A) / 2</code>
        </p>
        <p>
          The round-trip speed <code>2·AB / (t'_A - t_A)</code> then equals <var>c</var> in the
          frame where the procedure is applied &mdash; not because the speed of light was measured
          this way, but because the procedure was built to make it come out that way.
        </p>

        <h2>Section 2: the moving rod</h2>
        <p>
          Running the same procedure on the two ends of a moving rod gives two different leg times
          in the stationary frame: an outbound leg <code>r_AB / (c - u)</code> and a return leg{" "}
          <code>r_AB / (c + u)</code>, because the receiving end has moved during the light&apos;s
          travel. For observers moving with the rod, the criterion that held for the stationary
          observer fails.
        </p>

        <h2>Clocks that move disagree, once you compare them</h2>
        <p>
          A pair of clocks synchronized this way in their own rest frame, but moving together at
          speed <var>v</var>, is found out of step by <code>vL/c&sup2;</code> in the platform frame
          &mdash; with the trailing clock ahead. Try the moving-pair preset above and predict the
          answer before revealing it.
        </p>

        <h2>Light is not the only way</h2>
        <p>
          The paper chooses light because it makes the assumption it is making visible, not because
          light is the only possible way to compare distant clocks. Slow clock transport is a
          coherent alternative: carry a clock, synchronized side by side with another, out to the
          distant station. It requires its own assumption &mdash; how a clock&apos;s rate depends on
          its motion &mdash; and agrees with the light convention only in the limit of vanishingly
          slow transport.
        </p>

        <div className="actions">
          <a href="/lab/me-01/">The two-ledger mass&ndash;energy derivation (ME-01)</a>
          <a href="/lab/bm-01/">The Brownian tracer laboratory</a>
        </div>
      </section>
    </>
  );
}
