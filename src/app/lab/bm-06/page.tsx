import type { Metadata } from "next";
import { BrownianComparison } from "../../../components/lab/BrownianLab.tsx";
import { LabFormula } from "../../../components/lab/LabFormula.tsx";
import { LabInlineTerms } from "../../../components/lab/LabInlineTerms.tsx";
import example from "../../../generated/bm06-example.json";
export const metadata: Metadata = {
  title: "The spreading laboratory",
  description:
    "How far from its starting point might a suspended particle be? Change the time, viscosity or radius, then ask about a whole interval, not just a single position.",
};
export default function BrownianLabPage() {
  return (
    <>
      <LabInlineTerms lab="bm-06" />
      <header className="page-intro">
        <p className="eyebrow">Brownian motion · Laboratory preview</p>
        <h1>
          <span>From wandering</span> <span>to a measurable spread.</span>
        </h1>
        <p className="lead">
          How far from its starting point might a suspended particle be? Change the time, viscosity
          or radius, then ask about a whole interval, not just a single position.
        </p>
      </header>
      <BrownianComparison example={example} />
      <nav className="lab-onward" aria-label="From here">
        <h2>From here</h2>
        <ul>
          <li>
            <a href="/discover/brownian-motion/">Start with the no-algebra encounter</a>
          </li>
          <li>
            <a href="/papers/brownian-motion/#arg-bm-gaussian">
              Read the argument and open its missing steps
            </a>
          </li>
          <li>
            <a href="/discover/brownian-motion/investigate/">
              Start from a pinned tracer trial and bring its D into this question
            </a>
          </li>
        </ul>
      </nav>
      <section className="reading" id="model">
        <h2>The relationship behind the instrument</h2>
        <LabFormula
          lab="bm-06"
          latex={String.raw`\begin{gathered}D = \frac{k_B T}{6\pi\eta a}, \\ \langle x^2\rangle = 2Dt, \\ \lambda_x = \sqrt{2Dt}\end{gathered}`}
        />
        <p>
          Temperature is <var>T</var>, viscosity is <var>η</var>, particle radius is <var>a</var>,
          and the diffusion coefficient is <var>D</var>. The constant <var>k</var>
          <sub>B</sub> is supplied by the explicitly named modern SI set. The RMS displacement{" "}
          <var>λ</var>
          <sub>x</sub> is the square root of the mean squared displacement along one coordinate.
        </p>
        <p>
          These are not a particle’s total travelled distance or instantaneous speed. For the
          unbounded model, the curve gives a probability density; an interval gets its probability
          from the area under that curve.
        </p>
        <LabFormula
          lab="bm-06"
          latex={String.raw`\begin{gathered}p(x,t)=\frac{1}{\sqrt{4\pi Dt}}\exp\!\left(-\frac{x^2}{4Dt}\right) \\ (D>0,\ t>0)\end{gathered}`}
        />
        <p>
          At the starting time there is a point distribution, not a finite density curve. The
          laboratory keeps that limiting state distinct.
        </p>
        <h3>What the numerical comparison asks</h3>
        <p>
          The finite grid approximates diffusion with an explicit stepping scheme. Its diffusion
          number must not exceed one half. A refused timestep is a limitation of this algorithm, not
          a prohibition on diffusion.
        </p>
        <LabFormula lab="bm-06" latex={String.raw`r=\frac{D\,\Delta t}{(\Delta x)^2}\leq\frac12`} />
        <p>
          The numerical box reflects probability at its walls. Once the spread reaches them,
          comparing it with an unbounded Gaussian is also comparing two boundary models.
        </p>
      </section>
    </>
  );
}
