import type { Metadata } from "next";
import { LabFormula } from "../../../components/lab/LabFormula.tsx";
import { LabInlineTerms } from "../../../components/lab/LabInlineTerms.tsx";
import { TracerComparison } from "../../../components/lab/TracerLab.tsx";
import { LAB_CARDS, labShareImages } from "../../../components/share/shareImages.ts";
import example from "../../../generated/bm01-example.json";
import { NotModeledLine } from "../NotModeledLine.tsx";
export const metadata: Metadata = {
  title: LAB_CARDS["bm-01"].title,
  description:
    "Particles that all follow the same random rule. Their average displacement stays near zero while their typical distance from the start keeps growing, and the instrument shows both.",
  openGraph: { images: labShareImages("bm-01") },
};
export default function TracerPage() {
  return (
    <>
      <LabInlineTerms lab="bm-01" />
      <header className="page-intro">
        <p className="eyebrow">Brownian motion · Synthetic experiment</p>
        <h1>Where does a wandering particle end up?</h1>
        <p className="lead">
          Every particle here follows the same rule and no two paths look alike. Watch where they
          finish and two things are true at once: the leftward and rightward moves cancel, so the
          average displacement stays near zero, while the typical distance from the start keeps
          growing. Telling those two apart is what this instrument is for.
        </p>
      </header>
      <TracerComparison example={example} />
      <NotModeledLine instrumentId="bm-01" />
      <nav className="lab-onward" aria-label="From this trial">
        <h2>From this trial</h2>
        <ul>
          <li>
            <a href="/lab/bm-01/compare/">Change one input and compare</a>: radius, viscosity,
            temperature or observation interval, side by side.
          </li>
          <li>
            <a href="/discover/brownian-motion/investigate/">
              Take this trial to the spreading lab
            </a>
            , with its diffusion coefficient pinned.
          </li>
          <li>
            <a href="/discover/brownian-motion/">Start with the no-algebra encounter</a>, if the
            notation is in the way.
          </li>
          <li>
            <a href="/papers/brownian-motion/#arg-bm-observable">Read the argument</a>, and open any
            step you want filled in.
          </li>
        </ul>
      </nav>
      <section className="reading">
        <h2>A mean near zero does not mean no motion.</h2>
        <LabFormula
          lab="bm-01"
          latex={String.raw`\begin{gathered}\langle x\rangle=0, \\ \langle x^2\rangle=2Dt, \\ \lambda_x=\sqrt{2Dt}\end{gathered}`}
        />
        <p>
          The model’s signed mean is zero; a finite synthetic sample fluctuates around it. The mean
          square remains positive as the cloud spreads. Four times the observation interval gives
          twice the model RMS displacement, not four times the RMS.
        </p>
        <h2>The apparent-speed trap</h2>
        <LabFormula lab="bm-01" latex={String.raw`\frac{\lambda_x}{\tau}=\sqrt{\frac{2D}{\tau}}`} />
        <p>
          Dividing the typical displacement by the observation interval produces a quantity that
          grows as the interval shrinks. It is an interval-dependent apparent speed, not an
          instantaneous velocity of a tracer. At zero elapsed time it is not defined.
        </p>
        <p>
          The accepted sample and the model curves are not experimental evidence. Historical
          constants remain in preparation.
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
