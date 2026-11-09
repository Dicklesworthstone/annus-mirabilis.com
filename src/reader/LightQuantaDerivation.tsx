"use client";

import type { Expression } from "../equations/ast.ts";
import { DerivationChain } from "../equations/derivations/DerivationChain.tsx";
import {
  lightQuantaDerivationMetadata,
  lightQuantaDisplayChain,
  lightQuantaDisplayExpression,
  lightQuantaHistoricalReadings,
  lqCoefficientCorrespondence,
  lqIndependentGasLaw,
  lqUnfixedConstantResult,
  lqVolumeEntropyResult,
  lqWienEntropyDerivation,
} from "../equations/derivations/lightQuantaEntropy.ts";
import { renderExpressionMarkup } from "../equations/derivations/mathRenderer.ts";

export interface LightQuantaDerivationProps {
  readonly section: "s4" | "s6";
  readonly activeDetail?: "0" | "1" | "2";
  readonly perspective?: "historical" | "modern";
}

const wienChain = lightQuantaDisplayChain(lqWienEntropyDerivation);
const correspondenceChain = lightQuantaDisplayChain(lqCoefficientCorrespondence);

function Formula({ expression, label }: { expression: Expression; label: string }) {
  const rendered = renderExpressionMarkup(lightQuantaDisplayExpression(expression));
  return (
    <section
      className="step-math"
      aria-label={label}
      {...{ dangerouslySetInnerHTML: { __html: rendered.html } }}
    />
  );
}

/** Server-rendered equations and native disclosures keep the chain readable without script. */
export function LightQuantaDerivation({
  section,
  activeDetail = "1",
  perspective = "historical",
}: LightQuantaDerivationProps) {
  const wien = section === "s4";
  const id = wien ? "lq-wien-entropy-derivation" : "lq-entropy-correspondence-derivation";
  const metadata = lightQuantaDerivationMetadata;
  return (
    <section
      id={id}
      className="local-steps"
      aria-labelledby={`${id}-title`}
      data-argument-id={metadata[section].argument}
      data-review={metadata.review}
      data-historical-status={metadata.historicalStatus}
      data-model-status={metadata.modelStatus}
    >
      <h4 id={`${id}-title`}>
        {wien ? "Follow Wien’s law all the way to entropy" : "Read the shared coefficient"}
      </h4>
      {wien ? (
        <>
          <p>
            This reconstruction writes <i>A</i> and <i>B</i> for Einstein’s α and β, <i>s</i>
            <sub>ν</sub> for his entropy density φ, and <i>V</i> for his volume <i>v</i>. Start with
            dilute radiation described by Wien’s law. The frequency ν stays fixed during the
            integration; the final comparison also fixes the energy <i>E</i> and narrow bandwidth
            Δν.
          </p>
          <p>
            Follow the integration constant <i>C</i>(ν). Its value is fixed by the paper’s
            zero-density boundary condition before the two volumes are compared.
          </p>
        </>
      ) : (
        <>
          <p>
            Section 4 has found the entropy change of dilute radiation. Section 5 supplies a gas
            comparison: independent points have a configuration probability proportional to the
            volume fraction raised to their count. Read their two entropy laws side by side.
          </p>
          <Formula
            expression={lqVolumeEntropyResult}
            label="Radiation entropy change equals E over B nu times the logarithm of V over V zero"
          />
          <Formula
            expression={lqIndependentGasLaw}
            label="Independent gas entropy change equals R over N times n times the logarithm of V over V zero"
          />
          <p>
            Here <i>R</i> is the molar gas constant and <i>N</i> is Avogadro’s constant. The chain
            asks what effective count <i>n</i> would reproduce radiation’s coefficient. This is the
            paper’s heuristic correspondence: agreement in this entropy law suggests a model and
            does not establish the full nature of light.
          </p>
        </>
      )}
      <DerivationChain
        chains={[wien ? wienChain : correspondenceChain]}
        activeDetail={activeDetail}
        perspective={perspective}
      />
      {wien ? (
        <details className="step-local-steps">
          <summary>Why the integration constant cannot just cancel</summary>
          <p>
            <i>C</i>(ν) is an entropy density. Multiplying it by the volume and bandwidth gives a
            total entropy <i>V</i>Δν<i>C</i>(ν). If the constant were left unfixed, the entropy
            difference would contain this extra term:
          </p>
          <Formula
            expression={lqUnfixedConstantResult}
            label="Extra entropy from an unfixed constant equals bandwidth times C of nu times V minus V zero"
          />
          <p>
            That term survives when the volumes differ. The boundary condition in §3 supplies
            <i> C</i>(ν) = 0. Expansion gives a positive entropy change, compression a negative one,
            and equal volumes give zero, provided both compared states remain dilute.
          </p>
          <p>
            These are states with the same energy and the same frequency band. Moving reflecting
            walls change the energy and frequency of the light, so that compression process does not
            follow this fixed-band comparison.
          </p>
        </details>
      ) : (
        <details className="step-local-steps">
          <summary>What would make the comparison fail?</summary>
          <p>
            If <i>V</i> = <i>V</i>
            <sub>0</sub>, both logarithms are zero. This single comparison cannot identify a
            coefficient, and dividing by that logarithm is forbidden. The argument compares the
            family of volume dependences, using nontrivial positive ratios.
          </p>
          <p>
            Independence also matters. For four independent points in half the volume, the chance
            that all four are inside is (1/2)⁴ = 1/16. For four points locked to one shared
            position, it is 1/2. Counting four labels alone does not produce the exponent four.
          </p>
          <p>
            The inferred <i>n</i> is an effective thermodynamic count; the calculation does not
            round it or claim to observe individual particles. Modern notation identifies
            <i> RB/N</i> with <i>h</i> afterward, so the inferred energy becomes <i>h</i>ν.
          </p>
          <a href="/lab/lq-05/">Test independent and locked configurations</a>
        </details>
      )}
      <details className="step-local-steps">
        <summary>Historical context and notation</summary>
        <p>{lightQuantaHistoricalReadings[section]}</p>
      </details>
      <h5>Follow the printed argument</h5>
      <ul>
        {wien ? (
          <>
            <li id="lq-wien-source-spectrum">
              <a href="/papers/light-quanta/view/german/#eq-s4-d1">§4, p. 139: Wien’s law</a>
            </li>
            <li id="lq-wien-source-inversion">
              <a href="/papers/light-quanta/view/german/#eq-s4-d2">
                §4: solve for inverse temperature
              </a>
            </li>
            <li id="lq-wien-source-boundary">
              <a href="/papers/light-quanta/view/german/#s3-p4">
                §3, p. 139: entropy slope and the zero-density boundary
              </a>
            </li>
            <li id="lq-wien-source-integral">
              <a href="/papers/light-quanta/view/german/#eq-s4-d3">
                §4: integrate the entropy density
              </a>
            </li>
            <li id="lq-wien-source-total">
              <a href="/papers/light-quanta/view/german/#eq-s4-d4">
                §4: total entropy in a narrow frequency interval
              </a>
            </li>
            <li id="lq-wien-source-volume">
              <a href="/papers/light-quanta/view/german/#eq-s4-d5">§4: compare the two volumes</a>
            </li>
          </>
        ) : (
          <>
            <li id="lq-correspondence-source-comparison">
              <a href="/papers/light-quanta/view/german/#eq-s6-d2">
                §6, p. 142: rewrite the entropy as a configuration law
              </a>
            </li>
            <li id="lq-correspondence-source-probability">
              <a href="/papers/light-quanta/view/german/#eq-s6-d4">
                §6: the exponent that acts like an independent count
              </a>
            </li>
            <li id="lq-correspondence-source-elements">
              <a href="/papers/light-quanta/view/german/#s6-p6">
                §6, p. 143: the heuristic conclusion about energy elements
              </a>
            </li>
          </>
        )}
      </ul>
    </section>
  );
}
