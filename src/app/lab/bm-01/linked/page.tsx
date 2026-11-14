import type { Metadata } from "next";
import { BrownianLinkedGroup } from "../../../../components/lab/BrownianLinkedGroup.tsx";
import { loadBrownianRadiusGroup } from "../../../../experiments/groups/loadBrownianRadius.ts";
import tracerExample from "../../../../generated/bm01-example.json";
import densityExample from "../../../../generated/bm06-example.json";

export const metadata: Metadata = {
  title: "Link a tracer ensemble to its probability curve",
  description:
    "Change one particle radius in two Brownian instruments. Compare a finite synthetic ensemble with the model probability density, and keep complete matching results together.",
};

export default function LinkedBrownianPage() {
  const definition = loadBrownianRadiusGroup();
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Brownian motion · Linked instruments</p>
        <h1>Does the cloud agree with the curve?</h1>
        <p className="lead">
          A wandering particle and a smooth probability curve describe the same model at different
          scales. Change the particle radius in both instruments, and compare the sampled spread
          with the model's prediction.
        </p>
      </header>
      <BrownianLinkedGroup
        definition={definition}
        tracerExample={tracerExample}
        densityExample={densityExample}
      />
      <section className="reading">
        <h2>Try a particle twice as large.</h2>
        <p>
          At the same temperature and viscosity, doubling the radius halves the diffusion
          coefficient. At the same observation time, the model RMS displacement falls to about 71%
          of its former value. Check those two changes in the tables: the sample RMS may differ from
          the model because it describes a finite ensemble.
        </p>
        <p>
          The two plots use different vertical quantities. A histogram bin contains a fraction of
          the sample; a density curve gives probability per unit displacement. The dashed comparison
          on the histogram integrates the model over those same bins.
        </p>
        <p>
          This is the unbounded, overdamped model for dilute spherical particles. It does not
          resolve molecular collisions, inertia or walls. Both calculations use modern SI constants.
        </p>
      </section>
      <nav className="lab-onward" aria-label="From the linked instruments">
        <h2>Continue the investigation</h2>
        <ul>
          <li>
            <a href="/lab/bm-01/">Open the full tracer laboratory</a>
          </li>
          <li>
            <a href="/lab/bm-06/">Open the full spreading laboratory</a>
          </li>
          <li>
            <a href="/lab/bm-01/compare/">Hold one input fixed in a controlled comparison</a>
          </li>
          <li>
            <a href="/papers/brownian-motion/#arg-bm-gaussian">
              Read the argument behind the probability curve
            </a>
          </li>
        </ul>
      </nav>
    </>
  );
}
