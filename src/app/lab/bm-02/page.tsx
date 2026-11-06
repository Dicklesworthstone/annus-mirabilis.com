import type { Metadata } from "next";
import { LabFormula } from "../../../components/lab/LabFormula.tsx";
import { LabInlineTerms } from "../../../components/lab/LabInlineTerms.tsx";
import { OsmoticPartitionLab } from "../../../components/lab/OsmoticPartitionLab.tsx";
import { DEFAULT_BM02_INPUTS } from "../../../experiments/bm02/session.ts";

export const metadata: Metadata = {
  title: "The osmotic partition",
  description:
    "Einstein's §1 makes a daring equivalence: a visible suspended particle should exert osmotic pressure by the same law as a dissolved molecule, because van 't Hoff's law has no term that knows how big the molecule is.",
};

export default function OsmoticPartitionPage() {
  return (
    <>
      <LabInlineTerms lab="bm-02" />
      <header className="page-intro">
        <p className="eyebrow">Brownian motion · Section 1</p>
        <h1>
          <span>A particle you can see</span> <span>pushes like one you cannot.</span>
        </h1>
        <p className="lead">
          Do suspended particles press on a partition the way dissolved molecules do, and does their
          size change the pressure at the same number per volume? Change the particle count, the
          volume, or the radius, and see what the law actually depends on.
        </p>
      </header>

      <OsmoticPartitionLab example={DEFAULT_BM02_INPUTS} />
      <nav className="lab-onward" aria-label="From here">
        <h2>From here</h2>
        <ul>
          <li>
            <a href="/papers/brownian-motion/#arg-bm-osmotic-suspended">
              Read the argument and open its missing steps
            </a>
          </li>
        </ul>
      </nav>

      <section className="reading">
        {/* Moved from the lead (dispatch 268), where it made the hero 433px tall at 1440. */}
        <p>
          Einstein's §1 makes a daring equivalence: a visible suspended particle should exert
          osmotic pressure by the same law as a dissolved molecule, because van 't Hoff's law has no
          term that knows how big the molecule is.
        </p>
        <h2>The law this instrument calculates</h2>
        <LabFormula lab="bm-02" latex={String.raw`\Pi = n k_B T,\qquad n = \frac{N_p}{V}`} />
        <p>
          The osmotic pressure depends on the number of particles per unit volume and the
          temperature. It does not depend on the particle radius, as long as the suspension stays
          dilute enough that particles do not interact; the same law, whether the particles are
          sugar molecules or visible spheres a thousand times larger.
        </p>
        <h2>What classical thermodynamics expected instead</h2>
        <p>
          Einstein's §1 states the rival fairly: in classical thermodynamics, the free energy of a
          system with suspended bodies appears to depend only on total masses and qualities,
          pressure, and temperature, not on where a partition and the bodies sit. No force on the
          partition would be expected on that view. This instrument shows that expectation as a
          labeled alternative, not as something already refuted: what decided between the two models
          was Einstein's predicted displacements in §5, and later Jean Perrin's
          sedimentation-equilibrium measurements of 1908–1909.
        </p>
        <p className="fine">
          Choose modern SI constants or Einstein's 1905 printed estimate N = 6 × 10<sup>23</sup>{" "}
          mol⁻¹ with the editorial gas constant R = 8.31 J/(mol K). The historical comparison uses
          R/N in place of the modern k<sub>B</sub>, while keeping your particle count, volume and
          temperature fixed. R is an editorial input, not a value printed in this paper; the
          equivalent water column still uses modern water density and gravity. See{" "}
          <a href="/papers/brownian-motion/#s5">Einstein's numerical example in §5</a>.
        </p>
        <div className="actions">
          <a className="button" href="/lab/bm-01/">
            Return to the tracer ensemble
          </a>
          <a href="/papers/brownian-motion/">Return to the argument</a>
        </div>
      </section>
    </>
  );
}
