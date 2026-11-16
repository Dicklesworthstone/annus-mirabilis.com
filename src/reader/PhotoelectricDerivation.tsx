"use client";

import { DerivationChain } from "../equations/derivations/DerivationChain.tsx";
import {
  photoelectricChain,
  photoelectricMetadata,
  presentPhotoelectricChain,
} from "../equations/derivations/lightQuantaPhotoelectric.ts";

const chain = presentPhotoelectricChain(photoelectricChain);

export interface PhotoelectricDerivationProps {
  readonly activeDetail?: "0" | "1" | "2";
  readonly perspective?: "historical" | "modern";
}

/** Native disclosures and mathematical text are available in the exported chapter without script. */
export function PhotoelectricDerivation({
  activeDetail = "1",
  perspective = "historical",
}: PhotoelectricDerivationProps) {
  return (
    <section
      id={photoelectricMetadata.anchor}
      className="local-steps"
      aria-labelledby="lq-photoelectric-derivation-title"
      data-argument-id={photoelectricMetadata.argument}
      data-historical-status="pedagogical-reconstruction"
      data-model-status="exact-within-model"
    >
      <h4 id="lq-photoelectric-derivation-title">
        Follow one quantum from escape work to stopping voltage
      </h4>
      <p>
        Start with an energy account for one electron. One whole quantum supplies energy
        <i> h</i>ν. Escaping costs <i>W</i>; the fastest electron keeps the remainder as energy of
        motion. A retarding electric field then measures that remainder. The three steps below
        separate the transfer hypothesis, the subtraction, and the electrical measurement.
      </p>
      <details className="step-local-steps" open>
        <summary>What this argument assumes</summary>
        <p>
          One electron receives one whole quantum, with no contribution from a second quantum or
          another energy source. The escape work is nonnegative and fixed for this comparison.
          Equality also assumes that the fastest electrons can escape without additional losses, as
          in the paper’s surface-emission case. Nonnegative losses alone give an upper bound.
        </p>
        <p>
          Keep <i>h</i>, the frequency, and the positive charge magnitude <i>e</i> greater than
          zero. The quantum must supply at least the escape work. The stopping-potential magnitude
          <i> V</i>
          <sub>s</sub> is nonnegative; the electron’s signed charge is −<i>e</i>. The measurement
          uses the fastest escaping electrons and ignores contact potentials.
        </p>
      </details>
      <DerivationChain
        chains={[chain]}
        activeDetail={activeDetail}
        perspective={perspective}
        sourceLinkLabel="Read the source of this premise"
      />
      <details className="step-local-steps">
        <summary>Where the equality stops applying</summary>
        <p>
          Below threshold there is not enough energy for escape in this model. Extending the line
          into negative energy does not predict a negative kinetic energy, and replacing it with
          zero would wrongly suggest a measured stopping voltage. Exactly at threshold the available
          energy is zero; a measurable current is not guaranteed.
        </p>
        <p>
          If the transfer is partial or extra losses cannot be avoided, the same budget gives a
          ceiling. It does not determine the fastest emitted energy or a unique stopping potential.
          Increasing intensity is absent from this one-electron account. Predicting how many
          electrons escape requires separate assumptions about absorption and yield.
        </p>
        <p>
          <a href="/lab/lq-08/">
            Test frequency, escape work, and transfer assumptions in the photoelectric laboratory
          </a>
        </p>
      </details>
      <details className="modern-margin" data-reading="3">
        <summary>Historical context and notation</summary>
        <p>
          These are modern SI teaching equations. Section 8 writes the quantum energy as (<i>R</i>/
          <i>N</i>)βν and the escape work as <i>P</i>. Its illuminated body is charged positively
          relative to the surrounding conductors, so a departing negative electron is retarded. A
          later collector apparatus needs its own electrode and sign convention.
        </p>
        <p>
          The footnote allows a separate cost to free an electron from a neutral molecule before it
          escapes the body. Here <i>W</i> includes both costs. Adding a fixed cost changes the
          intercept, while the frequency slope remains the same. The algebra checks this conditional
          account; it does not establish the quantum hypothesis by experiment.
        </p>
      </details>
      <p id="lq-photoelectric-source-transfer">
        <a href="/papers/light-quanta/view/german/#s8-p2">
          Read the transfer and fastest-electron argument in §8
        </a>
      </p>
      <p id="lq-photoelectric-source-stopping">
        <a href="/papers/light-quanta/view/german/#s8-p3">Read the stopping condition in §8</a>
        {" · "}
        <a href="/papers/light-quanta/view/german/#s8-fn2">
          Read the qualification about the escape work
        </a>
      </p>
    </section>
  );
}
