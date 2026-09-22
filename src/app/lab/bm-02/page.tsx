import type { Metadata } from "next";
import { Formula } from "../../../components/edition/Formula.tsx";
import { OsmoticPartitionLab } from "../../../components/lab/OsmoticPartitionLab.tsx";
import { DEFAULT_BM02_INPUTS } from "../../../experiments/bm02/session.ts";

export const metadata: Metadata = { title: "The osmotic partition" };

export default function OsmoticPartitionPage() {
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Brownian motion · Section 1</p>
        <h1>
          A particle you can see
          <br />
          pushes like one you cannot.
        </h1>
        <p className="lead">
          Einstein's §1 makes a daring equivalence: a visible suspended particle should exert
          osmotic pressure by the same law as a dissolved molecule, because van 't Hoff's law has no
          term that knows how big the molecule is. Change the particle count, the volume, or the
          radius, and see what the law actually depends on.
        </p>
        <p>
          <a href="/papers/brownian-motion/#arg-bm-observable">
            Read the argument and open its missing steps
          </a>
        </p>
      </header>

      <OsmoticPartitionLab example={DEFAULT_BM02_INPUTS} />

      <section className="reading">
        <h2>The law this instrument calculates</h2>
        <Formula latex={String.raw`\Pi = n k_B T,\qquad n = \frac{N_p}{V}`} />
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
          This instrument uses the modern, exact SI constant set. The 1905 printed historical
          constant set (with Einstein's printed Avogadro number and an editorial value for the gas
          constant) is not yet available; that comparison depends on a separate, unbuilt constant
          set and is not faked here.
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
