"use client";

import { DerivationChain } from "../equations/derivations/DerivationChain.tsx";
import { renderExpressionMarkup } from "../equations/derivations/mathRenderer.ts";
import {
  srLightComplexDerivation,
  srLightComplexDerivationMetadata,
  srLightComplexDoppler,
  srLightComplexHistoricalReading,
  srLightComplexResult,
} from "../equations/derivations/srLightComplex.ts";

export interface SRLightComplexDerivationProps {
  readonly activeDetail?: "0" | "1" | "2";
  readonly perspective?: "historical" | "modern";
}

/** A visible, server-rendered chain; its disclosures and source links also work without script. */
export function SRLightComplexDerivation({
  activeDetail = "1",
  perspective = "historical",
}: SRLightComplexDerivationProps) {
  const doppler = renderExpressionMarkup(srLightComplexDoppler);
  const result = renderExpressionMarkup(srLightComplexResult);

  return (
    <section
      id="sr-light-complex-derivation"
      className="local-steps"
      aria-labelledby="sr-light-complex-derivation-title"
      data-argument-id={srLightComplexDerivationMetadata.argument}
      data-review={srLightComplexDerivationMetadata.review}
      data-historical-status={srLightComplexDerivationMetadata.historicalStatus}
      data-model-status={srLightComplexDerivationMetadata.modelStatus}
    >
      <h4 id="sr-light-complex-derivation-title">Follow the energy of the whole light packet</h4>
      <p>
        This reconstruction unpacks §8 using modern notation. Let <i>u</i> be energy density,
        <i> S</i> the volume of the bounded piece of light, and <i>E</i> its total energy. A prime
        means measured in the moving frame <i>k</i>. The angle φ is measured in the original frame{" "}
        <i>K</i>.
      </p>
      <section
        className="step-math"
        aria-label="The Doppler factor q equals gamma times one minus v over c times cosine phi"
        {...{ dangerouslySetInnerHTML: { __html: doppler.html } }}
      />
      <p>
        Here γ is the paper’s β, and <i>c</i> is its <i>V</i>. Start from the field and frequency
        transformations in §7; then account for the volume of the same moving light complex.
      </p>
      <DerivationChain
        chains={[srLightComplexDerivation]}
        activeDetail={activeDetail}
        perspective={perspective}
      />
      <section
        className="step-math"
        aria-label="The packet energy ratio E prime over E equals the frequency ratio nu prime over nu"
        {...{ dangerouslySetInnerHTML: { __html: result.html } }}
      />
      <details className="step-local-steps">
        <summary>Test the volume choice at 0.6 times the speed of light</summary>
        <p>
          For light travelling along the motion in <i>K</i>, q = 0.5. The density factor is 0.25 and
          the packet-volume factor is 2, giving an energy factor of 0.5. Using the material-volume
          factor 1/γ = 0.8 would give 0.2, which disagrees with the frequency shift.
        </p>
        <p>
          A ray perpendicular to the motion in <i>K</i> gives q = 1.25, so both volume choices
          happen to give 0.8. That direction cannot distinguish them. For a ray perpendicular in{" "}
          <i>k</i>, the original angle instead satisfies cos φ = 0.6: q = 0.8, the packet volume
          factor is 1.25, and the total energy factor is 0.8.
        </p>
      </details>
      <details className="modern-margin" data-reading="3">
        <summary>Historical context and notation</summary>
        <p>{srLightComplexHistoricalReading.r3}</p>
        <p className="fine">
          <cite>{srLightComplexHistoricalReading.r3Citations[0]}</cite>
        </p>
      </details>
      <h5>Follow the printed argument</h5>
      <ul>
        <li id="sr-light-complex-source-amplitude">
          <a href="/papers/special-relativity/view/german/#eq-s7-d11">
            §7: the squared field-amplitude ratio
          </a>
        </li>
        <li id="sr-light-complex-source-frequency">
          <a href="/papers/special-relativity/view/german/#eq-s7-d7">
            §7: the frequency transformation
          </a>
        </li>
        <li id="sr-light-complex-source-volume">
          <a href="/papers/special-relativity/view/german/#eq-s8-d3">
            §8, p. 913: the moving light complex’s volume ratio
          </a>
        </li>
        <li id="sr-light-complex-source-energy">
          <a href="/papers/special-relativity/view/german/#eq-s8-d4">
            §8, p. 913: density times volume gives total energy
          </a>
        </li>
      </ul>
    </section>
  );
}
