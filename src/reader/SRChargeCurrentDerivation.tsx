"use client";

import { DerivationChain } from "../equations/derivations/DerivationChain.tsx";
import {
  srChargeCurrentAssumptions,
  srChargeCurrentSourceLinks,
  srChargeDensityChain,
  srCurrentXChain,
  srCurrentYChain,
  srCurrentZChain,
  srTotalChargeChain,
  srTotalCurrentChain,
} from "../equations/derivations/srChargeCurrent.ts";

export interface SRChargeCurrentDerivationProps {
  readonly activeDetail?: "0" | "1" | "2";
  readonly perspective?: "historical" | "modern";
}

/** The source premises, full algebra and source returns remain available without JavaScript. */
export function SRChargeCurrentDerivation({ activeDetail = "1", perspective = "historical" }: SRChargeCurrentDerivationProps) {
  const detail = { activeDetail, perspective };
  return (
    <section id="sr-charge-current-derivation" className="local-steps"
      aria-labelledby="sr-charge-current-derivation-title" data-argument-id="arg-sr-charge-current"
      data-review="draft" data-historical-status="pedagogical-reconstruction"
      data-model-status="charge-current-subluminal-boost">
      <h4 id="sr-charge-current-derivation-title">A neutral wire can carry current in both frames</h4>
      <p>
        Section 9 transforms the density and velocity of moving electricity. Multiply those two
        quantities together and the current transformation follows. Then add different charge
        carriers separately: a mixture can have zero net charge density and still carry current.
        Dividing its current by its net density would erase exactly that case.
      </p>
      <p>
        The moving frame travels at signed speed <i>v</i> along the stationary x axis. Here γ is
        the paper’s β, <i>c</i> its <i>V</i>, and primes name the moving frame. All comparisons refer
        to the same event. The x component of <i>J</i> is current per unit area, with its sign
        giving the direction of positive-charge flow.
      </p>
      <details className="step-local-steps">
        <summary>What is taken from the source, and what is proved here</summary>
        <dl>{srChargeCurrentAssumptions.map((item) => <div key={item.id}>
          <dt>{item.label}</dt><dd>{item.explanation}</dd>
        </div>)}</dl>
        <p>
          Einstein defines the printed ϱ as <strong>4π times the charge density in Gaussian
          units</strong>. We use ordinary charge density ρ and current density J, consistently in
          SI. Dividing the source density relation by the same 4π on both sides leaves its
          transformation factors unchanged. No SI Maxwell equation is substituted into the
          Gaussian source equations.
        </p>
      </details>
      <h5>1. Recognize current inside the density law</h5>
      <DerivationChain chains={[srChargeDensityChain]} {...detail} />
      <h5>2. Transform the current along the motion</h5>
      <DerivationChain chains={[srCurrentXChain]} {...detail} />
      <h5>3. Check the sideways currents</h5>
      <p>
        The density is multiplied by the same factor that divides a transverse carrier velocity.
        Their product is unchanged, although neither factor is individually unchanged.
      </p>
      <DerivationChain chains={[srCurrentYChain]} {...detail} />
      <details className="step-local-steps">
        <summary>The other transverse direction follows the same steps</summary>
        <DerivationChain chains={[srCurrentZChain]} {...detail} />
      </details>
      <h5>4. Add different carriers without assigning the mixture one velocity</h5>
      <p>
        In these next lines, a and b label two species. Jₐ and Jᵦ mean their longitudinal currents,
        each formed using its own carrier velocity. The same boost applies to both species.
        Adding their charge densities and their currents separately gives the total relations.
      </p>
      <DerivationChain chains={[srTotalChargeChain]} {...detail} />
      <details className="step-local-steps">
        <summary>Add the longitudinal currents as well</summary>
        <DerivationChain chains={[srTotalCurrentChain]} {...detail} />
      </details>
      <details className="step-local-steps">
        <summary>Try a neutral mixture with a nonzero current</summary>
        <p>
          Use a consistent teaching system with c = 1. Let positive carriers have density +1 and
          velocity 0, while negative carriers have density −1 and velocity +0.4. Their total density
          is 0, but their total current is −0.4. For a frame moving at v = +0.6, γ = 1.25.
        </p>
        <p>
          The transformed positive density is +1.25 and the transformed negative density is −0.95:
          their sum is +0.30. The transformed currents are −0.75 and +0.25, summing to −0.50.
          Applying the total formulas gives the same results: ρ′ = −γvJₓ/c² = +0.30 and
          J′ₓ = γJₓ = −0.50. Reversing the boost recovers zero density and current −0.4.
        </p>
        <p>
          The charge has not been created. Density is measured on each frame’s simultaneous slice;
          the carriers included in a length of wire need not form the same set in the other
          description. Total charge of a specified isolated body is a separate statement from
          local neutrality.
        </p>
        <a href="/lab/sr-12/">Compare the charge and current descriptions in the laboratory</a>
      </details>
      <details className="modern-margin" data-reading="3">
        <summary>Where this argument starts and stops</summary>
        <p>
          The density and velocity laws are explicitly admitted from §9. The checked steps prove
          their consequences for current and for sums of species. They do not derive the source
          density law from no premises, prove the Maxwell–Hertz equations experimentally, or infer
          a physical carrier velocity by dividing a neutral mixture’s current by zero density.
        </p>
        <p>
          In later language, cρ and J form a four-current. That is a modern summary of these
          transformation relations, not a premise attributed to the 1905 derivation. The
          continuity equation requires its own derivative argument and is not assumed proved by
          the algebra displayed here.
        </p>
        <p className="fine"><cite>A. Einstein, “Zur Elektrodynamik bewegter Körper” (1905), §9, pp. 916–917.</cite></p>
      </details>
      <h5>Return to the printed argument</h5>
      <ul>{srChargeCurrentSourceLinks.map((source) => <li key={source.id} id={source.id}>
        <a href={"/papers/special-relativity/view/german/#" + source.anchor}>{source.label}</a>
      </li>)}</ul>
    </section>
  );
}
