import type { Metadata } from "next";
import { Formula } from "../../../components/edition/Formula.tsx";
import { ConfigurationComparison } from "../../../components/lab/bm03/ConfigurationLab.tsx";
import { BM03_DEFAULTS } from "../../../experiments/bm03/definition.ts";
import { evaluateBm03 } from "../../../experiments/bm03/session.ts";

export const metadata: Metadata = {
  title: "The configuration integral and free energy",
};

export default function ConfigurationPage() {
  const example = {
    parameters: BM03_DEFAULTS,
    evaluation: evaluateBm03(BM03_DEFAULTS),
    sourceDigest: "src/physics/reference/diffusion/routeA.ts",
  };

  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Brownian motion · The statistical mechanics derivation</p>
        <h1>
          Why counting positions
          <br />
          gives the pressure law.
        </h1>
        <p className="lead">
          How can a vast microscopic problem, with every solvent molecule and every suspended
          particle in motion, yield a law as simple as &Pi; = n k_B T without solving any molecular
          equations of motion?
        </p>
        <p>
          <a href="/papers/brownian-motion/#arg-bm-configuration">
            Read the statistical argument and open its derivation steps
          </a>
        </p>
      </header>

      <ConfigurationComparison example={example} />

      <section className="reading" id="configuration-argument">
        <p className="eyebrow">Open the derivation</p>
        <h2>From available volume to free energy</h2>
        <p>
          Einstein&apos;s &sect;2 writes the free energy using the logarithm of an integral over all
          state variables (the configuration integral B). Under the premises of independent particle
          positions and dilution, the spatial positions of N_p particles contribute a clean volume
          factor V^{"{"}N_p{"}"}.
        </p>
        <Formula
          latex={String.raw`B=\int\cdots\int dx_1\dots dz_n=V^{*n}J,\qquad F=-2\kappa T\lg B=-2\kappa Tn\lg V^*-2\kappa T\lg J+\text{const}`}
        />
        <p>
          In modern notation, 2&kappa;N = R gives 2&kappa; = k_B, the particle count n is written
          N_p, and the volume V* is V:
        </p>
        <Formula latex={String.raw`F=-N_p k_B T\ln V - k_B T\ln J + F_0`} />

        <h2>Why the complicated molecular factor J drops out</h2>
        <p>
          The factor J represents the integral over all solvent positions and interactions for fixed
          tracer coordinates. Under Einstein&apos;s three premises (homogeneous fluid, dilute
          independent particles, no external forces), shifting the particle positions does not
          change the probability of finding solvent molecules in any region. Thus J is independent
          of V, and differentiating with respect to volume leaves zero:
        </p>
        <Formula latex={String.raw`p=-\frac{\partial F}{\partial V}=\frac{N_p k_BT}{V}=n k_BT`} />

        <h2>The locked-cluster counterexample: what is actually counted?</h2>
        <p>
          If the particles are rigidly locked together into a single cluster, the spatial
          arrangements grow only like V (or V/V_0) rather than (V/V_0)^{"{"}N_p{"}"}. The resulting
          osmotic pressure is that of one independent unit:
        </p>
        <Formula latex={String.raw`p_{\text{locked}}=\frac{k_B T}{V}`} />
        <p>
          This demonstrates that osmotic pressure counts independently placed units, not
          constituents.
        </p>

        <div className="actions">
          <a className="button" href="/lab/bm-01/">
            Open the tracer ensemble
          </a>
          <a href="/lab/bm-05/">From random steps to diffusion</a>
        </div>
      </section>
    </>
  );
}
