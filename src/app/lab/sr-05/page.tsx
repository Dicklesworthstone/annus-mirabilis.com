import type { Metadata } from "next";
import { Formula } from "../../../components/edition/Formula.tsx";
import { MovingClocksLab } from "../../../components/lab/sr05/MovingClocksLab.tsx";
import type { PreparedSr05Example } from "../../../experiments/sr05/session.ts";
import generatedExample from "../../../generated/sr05-example.json";

// JSON module resolution widens the literal-typed `worldlinePreset` field to `string`; the
// generator (scripts/generate-sr05.mjs) writes it from a real Sr05Parameters value, so the
// runtime shape genuinely matches -- this assertion recovers the type JSON import cannot carry.
const example = generatedExample as PreparedSr05Example;

export const metadata: Metadata = { title: "The light clock and moving clocks" };

export default function MovingClocksPage() {
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">SR-05 · Special relativity · Section 4</p>
        <h1>
          A moving clock loses time.
          <br />
          Not what a camera sees: what the clock reads.
        </h1>
        <p className="lead">
          Choose a worldline. Compare the traveling clock's own proper time with the platform clocks
          it moves past, and read both clocks' faces at the reunion event.
        </p>
        <p>
          <a href="/papers/relativity/#s4">Read Section 4 of Einstein&rsquo;s 1905 paper</a>
        </p>
      </header>

      <MovingClocksLab example={example} />

      <section className="reading" id="moving-clocks-theory">
        <p className="eyebrow">The physical argument</p>
        <h2>Two different questions, kept apart</h2>
        <p>
          &ldquo;What does the clock read at a shared event?&rdquo; and &ldquo;What does a camera
          watching the clock across a growing distance see, including the travel time of the light
          itself?&rdquo; are different physical questions. This instrument answers only the first:
          simultaneous-coordinate readings and reunion comparisons, never the optical appearance of
          a receding or approaching clock.
        </p>
        <Formula latex={String.raw`1-\sqrt{1-v^2/V^2}\approx\tfrac12\,v^2/V^2`} />
        <p>
          Section 4 states the loss per second of coordinate time to magnitudes of fourth and higher
          order as <Formula latex={String.raw`\tfrac12\,v^2/V^2`} />. The lab above shows this
          printed approximation beside the exact, numerically stable form{" "}
          <Formula latex={String.raw`\beta^2/(1+\sqrt{1-\beta^2})`} />; the two agree to many digits
          at everyday speeds and separate visibly as speed grows.
        </p>
        <h2>The reunion is the honest comparison</h2>
        <p>
          Two separated clocks can only be compared by adopting a simultaneity convention; two
          clocks brought back together read whatever they read, with no convention involved. This
          instrument computes the frame-independent reunion comparison for closed worldlines
          (out-and-back, or a constant-speed circle) rather than a comparison of distant,
          unsynchronized readings.
        </p>
        <h2>An ideal clock, not a mechanism</h2>
        <p>
          The model is an ideal clock whose rate depends only on its instantaneous speed; not a
          model of any particular mechanism, and not a claim about how real atomic clocks behave
          under acceleration. Two worldlines with the same speed profile but different turning
          accelerations report exactly the same proper time.
        </p>
        <p className="fine">
          Ideal model, host calculation. The full event-geometry evaluator (worldline proper time as
          a general integral, reunion comparisons, and reciprocal-rate redescription across boosted
          frames) is being built separately; until it lands, this instrument computes
          piecewise-constant-speed proper time directly from the Lorentz factor, which is exact for
          every scenario above.
        </p>
      </section>
    </>
  );
}
