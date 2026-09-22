import type { Metadata } from "next";
import { Formula } from "../../../components/edition/Formula.tsx";
import { TracerComparison } from "../../../components/lab/TracerLab.tsx";
import example from "../../../generated/bm01-example.json";
export const metadata: Metadata = { title: "The Brownian tracer ensemble" };
export default function TracerPage() {
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Brownian motion · Synthetic experiment</p>
        <h1>Where does a wandering particle end up?</h1>
        <p className="lead">
          Every particle here follows the same rule and no two paths look alike. Watch where they
          finish and two things are true at once: the leftward and rightward moves cancel, so the
          average displacement stays near zero, while the typical distance from the start keeps
          growing. Telling those two apart is what this instrument is for.
        </p>
        <p>
          It also shows why you cannot get a particle&rsquo;s speed by looking more often. Halve the
          interval between observations and the apparent speed climbs instead of settling on a
          value.
        </p>
        <a href="/discover/brownian-motion/">Start with the no-algebra encounter</a>
        <p>
          <a href="/papers/brownian-motion/#arg-bm-observable">
            Read the argument, and open any step you want filled in
          </a>
        </p>
        <p>
          <a className="button" href="/discover/brownian-motion/investigate/">
            Pin a trial and take its diffusion coefficient to the spreading lab
          </a>
        </p>
        <p>
          <a className="button" href="/lab/bm-01/compare/">
            Change one input and compare: radius, viscosity, temperature, interval
          </a>
        </p>
      </header>
      <TracerComparison example={example} />
      <section className="reading">
        <h2>A mean near zero does not mean no motion.</h2>
        <Formula
          latex={String.raw`\langle x\rangle=0,\qquad\langle x^2\rangle=2Dt,\qquad\lambda_x=\sqrt{2Dt}`}
        />
        <p>
          The model’s signed mean is zero; a finite synthetic sample fluctuates around it. The mean
          square remains positive as the cloud spreads. Four times the observation interval gives
          twice the model RMS displacement, not four times the RMS.
        </p>
        <h2>The apparent-speed trap</h2>
        <Formula latex={String.raw`\frac{\lambda_x}{\tau}=\sqrt{\frac{2D}{\tau}}`} />
        <p>
          Dividing the typical displacement by the observation interval produces a quantity that
          grows as the interval shrinks. It is an interval-dependent apparent speed, not an
          instantaneous velocity of a tracer. At zero elapsed time it is not defined.
        </p>
        <p>
          The accepted sample and the model curves are not experimental evidence. The source-aligned
          critical edition and reviewed historical constants remain in preparation.
        </p>
        <div className="actions">
          <a className="button" href="/lab/bm-06/">
            Ask an interval-probability question
          </a>
          <a href="/discover/brownian-motion/">Return to the argument</a>
        </div>
      </section>
    </>
  );
}
