"use client";

import type { Expression } from "../equations/ast.ts";
import {
  brownianDerivationMetadata,
  brownianDisplayChain,
  brownianDisplayExpression,
  brownianEquilibriumDerivation,
  brownianHistoricalReadings,
  brownianKernelDerivation,
  brownianSourceEquations,
} from "../equations/derivations/brownianSource.ts";
import { DerivationChain } from "../equations/derivations/DerivationChain.tsx";
import { renderExpressionMarkup } from "../equations/derivations/mathRenderer.ts";

export interface BrownianDerivationProps {
  readonly section: "s3" | "s4";
  readonly activeDetail?: "0" | "1" | "2";
  readonly perspective?: "historical" | "modern";
}

const equilibriumChain = brownianDisplayChain(brownianEquilibriumDerivation);
const kernelChain = brownianDisplayChain(brownianKernelDerivation);

function Formula({ expression, label }: { expression: Expression; label: string }) {
  const rendered = renderExpressionMarkup(brownianDisplayExpression(expression));
  return (
    <section
      className="step-math"
      aria-label={label}
      {...{ dangerouslySetInnerHTML: { __html: rendered.html } }}
    />
  );
}

/** The source comparison, equations and native disclosures remain readable without script. */
export function BrownianDerivation({
  section,
  activeDetail = "1",
  perspective = "historical",
}: BrownianDerivationProps) {
  const equilibrium = section === "s3";
  const metadata = brownianDerivationMetadata;
  const id = metadata[section].anchor;
  return (
    <section
      id={id}
      className="local-steps"
      aria-labelledby={`${id}-title`}
      data-argument-id={metadata[section].argument}
      data-review={metadata.review}
      data-historical-status={metadata.historicalStatus}
      data-model-status={
        equilibrium ? "dilute-stokes-isothermal-equilibrium" : "diffusive-continuum-limit"
      }
    >
      <h4 id={`${id}-title`}>
        {equilibrium
          ? "Find diffusivity from one equilibrium described two ways"
          : "Follow the source from random jumps to diffusion"}
      </h4>
      {equilibrium ? (
        <>
          <p>
            The suspended particles push osmotically like a dilute gas. A weak external force
            creates a density gradient; at equilibrium its drift is exactly opposed by diffusion.
            Compare the two descriptions of that same state to find <i>D</i>.
          </p>
          <p>
            Here <i>n</i> is number density, <i>K</i> the force per particle, η the liquid’s
            viscosity and <i>a</i> the particle radius. The introduced symbol <i>b</i> means
            mobility: steady drift per unit force. Einstein’s printed symbols are ν, <i>k</i> and{" "}
            <i>P</i>
            for our <i>n</i>, η and <i>a</i>.
          </p>
          <details className="step-local-steps">
            <summary>Where the thermodynamic starting equation comes from</summary>
            <p>
              In a column of unit cross-section at fixed temperature, equilibrium makes the first
              variation of free energy zero: δ<i>F</i> = δ<i>E</i> − <i>T</i>δ<i>S</i> = 0.
              Displacing particles by δ<i>x</i> changes their potential energy through the force
              density −<i>nK</i>. The dilute osmotic law supplies the entropy variation.
            </p>
            <p>
              Einstein integrates the entropy variation by parts. The displacement vanishes at the
              two ends of the column, so the boundary term is zero. For the remaining integral to
              vanish for every allowed interior displacement, its coefficient must vanish point by
              point. This gives the first equation below. These variational and thermodynamic
              premises are supplied before the displayed algebra.
            </p>
            <a href="/papers/brownian-motion/view/german/#eq-s3-d1">
              Read the free-energy variation in §3
            </a>
            {" · "}
            <a href="/papers/brownian-motion/view/german/#eq-s3-d3">
              Read the integration by parts
            </a>
          </details>
        </>
      ) : (
        <>
          <p>
            The step-sum route shows why variance grows with the number of independent steps.
            Einstein’s printed route follows the entire density instead. A normalized symmetric jump
            law φ(Δ) averages nearby values of the density, and its second moment sets the rate at
            which that density spreads.
          </p>
          <p>
            Write <i>p</i>(<i>x</i>, <i>t</i>) for a normalized one-dimensional particle density and
            τ for the coarse observation interval. Values and derivatives without arguments are
            evaluated at the same fixed (<i>x</i>, <i>t</i>). The integrals run over every possible
            displacement. Approximation signs remain visible while Taylor terms are dropped.
          </p>
          <details className="step-local-steps">
            <summary>Why the source writes a plus sign in the transition integral</summary>
            <Formula
              expression={brownianSourceEquations.printedSignTransition}
              label="Source convention for the transition average"
            />
            <Formula
              expression={brownianSourceEquations.modernTransition}
              label="Modern convention for the transition average"
            />
            <p>
              The source prints <i>f</i>(<i>x</i> + Δ), while the modern arrival-from-origin
              convention uses <i>p</i>(<i>x</i> − Δ, <i>t</i>). Change the integration variable from
              Δ to −Δ over the whole line and use φ(Δ) = φ(−Δ): the two averages agree. With a
              biased kernel, changing the sign without also reflecting the kernel would change the
              transport term.
            </p>
            <a href="/papers/brownian-motion/view/german/#eq-s4-d4">
              Read the printed transition integral
            </a>
          </details>
        </>
      )}
      <DerivationChain
        chains={[equilibrium ? equilibriumChain : kernelChain]}
        activeDetail={activeDetail}
        perspective={perspective}
      />
      {equilibrium ? (
        <details className="step-local-steps">
          <summary>Why zero force does not determine D by itself</summary>
          <Formula
            expression={brownianSourceEquations.particleFluxBalance}
            label="Zero net particle flux"
          />
          <p>
            If force and density gradient both vanish, this equation reads 0 = 0 for every
            diffusivity. Dividing by that gradient would be 0/0. The coefficient is determined from
            a nontrivial weak-force equilibrium, where the common gradient can be cancelled, and
            then used in the zero-force limit.
          </p>
          <p>
            Stokes mobility assumes slow steady drift of dilute, approximately spherical particles
            in a Newtonian liquid. Walls, interactions, slip and inertial time scales need their own
            corrections. This chain does not identify a Brownian particle’s instantaneous velocity.
          </p>
          <a href="/lab/bm-04/">Compare drift, diffusion and equilibrium in the laboratory</a>
        </details>
      ) : (
        <details className="step-local-steps">
          <summary>What turns the retained approximation into a continuum law?</summary>
          <Formula
            expression={brownianSourceEquations.jumpMoment}
            label="Diffusivity from the jump second moment"
          />
          <p>
            In a mathematical family of smaller jumps and shorter intervals, keep the second moment
            divided by 2τ approaching a finite <i>D</i>. Require the fourth moment divided by τ to
            approach zero and the relevant density derivatives to stay bounded. Then the omitted
            contributions vanish after division by τ.
          </p>
          <p>
            These remainder conditions explain the continuum step. They do not assert independence
            down to arbitrarily short physical times: a liquid’s molecular motion has correlations.
            The Brownian diffusion model applies on coarse time and distance scales.
          </p>
          <a href="#arg-bm-independent-steps">
            Compare the independent-step variance route in this section
          </a>
          {" · "}
          <a href="/lab/bm-03/">Explore the density evolution</a>
        </details>
      )}
      <details className="step-local-steps">
        <summary>Historical context and notation</summary>
        <p>{brownianHistoricalReadings[section]}</p>
      </details>
      <h5>Follow the printed argument</h5>
      <ul>
        {equilibrium ? (
          <>
            <li id="bm-equilibrium-source-pressure">
              <a href="/papers/brownian-motion/view/german/#eq-s3-1">
                §3, p. 554: the equilibrium condition
              </a>
            </li>
            <li id="bm-equilibrium-source-drift">
              <a href="/papers/brownian-motion/view/german/#eq-s3-d5">§3: Stokes drift speed</a>
              {" · "}
              <a href="/papers/brownian-motion/view/german/#eq-s3-d6">the carried particle flux</a>
            </li>
            <li id="bm-equilibrium-source-flux">
              <a href="/papers/brownian-motion/view/german/#eq-s3-d8">
                §3: diffusive particle flux
              </a>
            </li>
            <li id="bm-equilibrium-source-result">
              <a href="/papers/brownian-motion/view/german/#eq-s3-d9">
                §3, p. 555: the diffusivity
              </a>
            </li>
          </>
        ) : (
          <>
            <li id="bm-kernel-source-time">
              <a href="/papers/brownian-motion/view/german/#eq-s4-d5">§4: the time expansion</a>
            </li>
            <li id="bm-kernel-source-space">
              <a href="/papers/brownian-motion/view/german/#eq-s4-d6">
                §4: the spatial Taylor series
              </a>
            </li>
            <li id="bm-kernel-source-normalization">
              <a href="/papers/brownian-motion/view/german/#eq-s4-d8">§4: normalize the kernel</a>
            </li>
            <li id="bm-kernel-source-symmetry">
              <a href="/papers/brownian-motion/view/german/#eq-s4-d3">§4: left-right symmetry</a>
            </li>
            <li id="bm-kernel-source-moments">
              <a href="/papers/brownian-motion/view/german/#eq-s4-d7">§4: the moment expansion</a>
            </li>
            <li id="bm-kernel-source-diffusivity">
              <a href="/papers/brownian-motion/view/german/#eq-s4-d9">
                §4, p. 558: name the second-moment coefficient
              </a>
            </li>
            <li id="bm-kernel-source-equation">
              <a href="/papers/brownian-motion/view/german/#eq-s4-1">
                §4, p. 558: the diffusion equation
              </a>
            </li>
          </>
        )}
      </ul>
    </section>
  );
}
