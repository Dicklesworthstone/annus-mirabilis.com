"use client";

import { DerivationChain } from "../equations/derivations/DerivationChain.tsx";
import {
  srMirrorAssumptions,
  srMirrorDirectionChain,
  srMirrorEnergyChain,
  srMirrorFluxChain,
  srMirrorFrequencyChain,
  srMirrorPressureChain,
  srMirrorSourceLinks,
  srMirrorStationaryChain,
} from "../equations/derivations/srMirror.ts";

export interface SRMirrorDerivationProps {
  readonly activeDetail?: "0" | "1" | "2";
  readonly perspective?: "historical" | "modern";
}

/** The reflection, moving-boundary account and source returns also render without script. */
export function SRMirrorDerivation({
  activeDetail = "1",
  perspective = "historical",
}: SRMirrorDerivationProps) {
  return (
    <section
      id="sr-mirror-derivation"
      className="local-steps"
      aria-labelledby="sr-mirror-derivation-title"
      data-argument-id="arg-sr-moving-mirror"
      data-review="draft"
      data-historical-status="pedagogical-reconstruction"
      data-model-status="perfect-reflector-prescribed-subluminal-motion"
    >
      <h4 id="sr-mirror-derivation-title">
        Reflect the wave, then count what reaches the mirror
      </h4>
      <p>
        Reflection is simplest in the mirror’s rest frame. Transform the incoming wave into
        that frame, reflect it there, and transform the outgoing wave back. Its changed
        frequency and direction then determine the energy arriving at and leaving the moving
        surface. That energy difference supplies the mirror’s mechanical work.
      </p>
      <p>
        The mirror’s normal points along the x axis of <i>K</i>, and its signed speed is{" "}
        <i>v</i>. Write <i>b</i> = <i>v</i>/<i>c</i> and <i>a</i> = cos φ, with φ the incoming{" "}
        <strong>propagation direction in K</strong>. In the mirror frame <i>k</i>, <i>a</i>′
        is the incoming cosine and <i>a</i>″ the reflected cosine. Back in <i>K</i>, the
        reflected cosine is <i>a</i><sub>r</sub>. Finally, <i>r</i> = ν<sub>r</sub>/ν compares
        reflected and incident frequencies, both in <i>K</i>. The abbreviation <i>b</i> is
        distinct from the printed paper’s β, which denotes the Lorentz factor γ.
      </p>
      <details className="step-local-steps">
        <summary>What the calculation takes as given</summary>
        <dl>
          {srMirrorAssumptions.map((assumption) => (
            <div key={assumption.id}>
              <dt>{assumption.label}</dt>
              <dd>{assumption.explanation}</dd>
            </div>
          ))}
        </dl>
        <p>
          The interception condition is <i>a</i> &gt; <i>b</i>. Equality is the grazing
          boundary; below it the incoming wave does not reach this face of the mirror.
          Evaluating an algebraic formula outside that condition does not create a reflected
          wave.
        </p>
        <a href="/papers/special-relativity/s7/#sr-doppler-derivation">
          Return to the frequency and direction transformations and their premises
        </a>
      </details>

      <h5>1. Transform in, reflect, and transform out</h5>
      <p>
        The return boost reverses the signed speed and uses the outgoing angle in{" "}
        <i>k</i>. Reflection there reverses the normal direction without changing frequency.
        These two facts keep the return transformation from simply undoing the incoming one.
      </p>
      <DerivationChain
        chains={[srMirrorFrequencyChain]}
        activeDetail={activeDetail}
        perspective={perspective}
      />

      <h5>2. Find where the outgoing wave goes</h5>
      <DerivationChain
        chains={[srMirrorDirectionChain]}
        activeDetail={activeDetail}
        perspective={perspective}
      />
      <p>
        The reflected ray separates from the mirror because <i>a</i><sub>r</sub> &lt;{" "}
        <i>b</i>. Its laboratory x component need not be negative: at <i>v</i> = 0.6<i>c</i>{" "}
        and φ = 30°, it is about 0.069<i>c</i>. Both ray and mirror move toward increasing x
        in that example, but the mirror moves faster.
      </p>

      <h5>3. Count energy crossing the moving surface</h5>
      <p>
        Let <i>u</i> be the incoming light’s energy density in <i>K</i>. Every{" "}
        <i>J</i> below is an energy rate <strong>per unit mirror area and per unit K time</strong>.
        The incident rate is <i>J</i><sub>in</sub> = <i>uc</i>(<i>a</i> − <i>b</i>).
        The outgoing rate starts as <i>J</i><sub>out</sub> = <i>ur</i><sup>2</sup><i>c</i>
        (<i>b</i> − <i>a</i><sub>r</sub>). The squared amplitude factor changes the reflected
        energy density; the moving boundary changes how much of that energy leaves the
        surface each second.
      </p>
      <DerivationChain
        chains={[srMirrorFluxChain]}
        activeDetail={activeDetail}
        perspective={perspective}
      />
      <p>
        Multiplying each <i>J</i> by the mirror’s area gives the corresponding laboratory
        power. A fixed detector samples a different crossing rate. Substituting its{" "}
        <i>uc a</i> for the mirror’s <i>uc</i>(<i>a</i> − <i>b</i>) would spoil this
        energy account.
      </p>

      <h5>4. Separate energy transfer from pressure</h5>
      <DerivationChain
        chains={[srMirrorEnergyChain]}
        activeDetail={activeDetail}
        perspective={perspective}
      />
      <p>
        Energy conservation identifies this difference with <i>Pv</i>, the pressure times
        the mirror speed. A receding mirror receives work; an approaching mirror gives
        energy to the light. The pressure remains directed along the chosen positive normal.
      </p>
      <details className="step-local-steps" open>
        <summary>Nonzero speed: extract the pressure from the work</summary>
        <DerivationChain
          chains={[srMirrorPressureChain]}
          activeDetail={activeDetail}
          perspective={perspective}
        />
      </details>
      <details className="step-local-steps">
        <summary>At rest: zero work does not mean zero pressure</summary>
        <p>
          At <i>b</i> = 0 the work equation reads 0 = 0 for any pressure. Dividing by{" "}
          <i>b</i> at zero is invalid. To obtain the stationary value here, separately
          assume that the ideal-reflector pressure is continuous as <i>b</i> tends to zero,
          keeping <i>u</i> and an intercepted direction <i>a</i> &gt; 0 fixed.
        </p>
        <DerivationChain
          chains={[srMirrorStationaryChain]}
          activeDetail={activeDetail}
          perspective={perspective}
        />
        <p>
          This gives <i>P</i> = 2<i>ua</i><sup>2</sup>, or 2<i>u</i> at normal incidence.
          The algebra checks the value of the continuous extension. The physical continuity
          premise is additional; it does not follow from zero mechanical work. The exactly
          grazing case <i>a</i> = <i>b</i> = 0 remains outside the intercepted-wave domain.
        </p>
      </details>

      <details className="step-local-steps">
        <summary>Two normal-incidence energy accounts</summary>
        <p>
          Set <i>a</i> = 1 and write <i>I</i> = <i>uc</i>. These are ideal-model examples,
          with energy rates per unit mirror area, for the same incoming density in{" "}
          <i>K</i>.
        </p>
        <dl>
          <dt>Receding at 0.6c</dt>
          <dd>
            The frequency ratio is <i>r</i> = 0.25. The incident rate is 0.4<i>I</i>,
            the reflected rate 0.1<i>I</i>, and the mechanical work rate 0.3<i>I</i>.
            The pressure is 0.5<i>u</i>.
          </dd>
          <dt>Approaching at −0.6c</dt>
          <dd>
            The frequency ratio is <i>r</i> = 4. The incident rate is 1.6<i>I</i>,
            the reflected rate 6.4<i>I</i>, and the mechanical work rate −4.8<i>I</i>.
            The pressure is 8<i>u</i>: the approaching mirror supplies the extra reflected
            energy.
          </dd>
        </dl>
        <a href="/lab/sr-11/">Change the mirror speed and incidence angle in the laboratory</a>
      </details>

      <details className="modern-margin" data-reading="3">
        <summary>What has been established, and what the source prints</summary>
        <p>
          This teaching reconstruction is conditional on the physical premises listed above.
          The exact algebra establishes the frequency, direction and moving-surface energy
          consequences of those premises. It does not establish perfect reflection, energy
          conservation or continuity from observation. No photon energy law, finite-body
          recoil law or rest-energy claim is used.
        </p>
        <p>
          The printed frequency expression in §8 has the denominator (1 − <i>v</i>/<i>V</i>)
          <sup>2</sup>. The two frame transformations give 1 − (<i>v</i>/<i>V</i>)<sup>2</sup>,
          which is the corrected canonical equation used here. The printed source remains
          available below with its own expression.
        </p>
        <p>
          In the mirror frame the incident and reflected frequencies agree and the mirror
          does no mechanical work. In <i>K</i> they generally differ and the mirror moves.
          Those accounts describe the same reflection with different frame-dependent
          energies and times.
        </p>
        <p className="fine">
          <cite>A. Einstein, “Zur Elektrodynamik bewegter Körper” (1905), §8, pp. 913–915.</cite>
        </p>
      </details>
      <h5>Return to the printed argument</h5>
      <ul>
        {srMirrorSourceLinks.map((source) => (
          <li key={source.id} id={source.id}>
            <a href={"/papers/special-relativity/view/german/#" + source.anchor}>
              {source.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
