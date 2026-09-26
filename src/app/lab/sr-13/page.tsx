import type { Metadata } from "next";
import { LabFormula } from "../../../components/lab/LabFormula.tsx";
import { ElectronDynamicsLab } from "../../../components/lab/sr13/ElectronDynamicsLab.tsx";
import { validateSr13Parameters } from "../../../experiments/sr13/parameters.ts";
import example from "../../../generated/sr13-example.json";

export const metadata: Metadata = {
  title: "Dynamics of the slowly accelerated electron",
  description:
    "What force, work, energy, and deflection relations follow for a slowly accelerated electron, and why do two different “transverse masses” appear?",
};

export default function ElectronDynamicsPage() {
  const checked = validateSr13Parameters(example.parameters);
  if (checked.kind !== "accepted") {
    throw new Error("The prepared SR-13 example parameters are invalid.");
  }

  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Special relativity · Electrodynamics §10</p>
        <h1>
          <span>Force conventions and dynamics</span>{" "}
          <span>of the slowly accelerated electron.</span>
        </h1>
        <p className="lead">
          What force, work, energy, and deflection relations follow for a slowly accelerated
          electron, and why do two different &ldquo;transverse masses&rdquo; appear?
        </p>
      </header>

      <ElectronDynamicsLab example={{ ...example, parameters: checked.data }} />
      <nav className="lab-onward" aria-label="From here">
        <h2>From here</h2>
        <ul>
          <li>
            <a href="/papers/special-relativity/#s10">Read §10 of the 1905 relativity paper</a>
          </li>
        </ul>
      </nav>

      <section className="reading" id="electron-dynamics-worked">
        <h2>Worked case (readable without JavaScript)</h2>
        <p>
          Consider an electron of mass m = 9.109 &times; 10<sup>&minus;31</sup> kg and charge
          &minus;e = &minus;1.602 &times; 10<sup>&minus;19</sup> C moving at initial speed v = 0.6c
          (&beta; = 0.6, &gamma; = 1.25) through a transverse electric field E<sub>y</sub> = 10
          <sup>5</sup> V/m.
        </p>
        <p>
          In §10, Einstein transforms Newton&apos;s second law from the electron&apos;s
          instantaneous rest frame back to the stationary coordinate system. When defining force as
          the field times charge in the comoving frame (the source convention), the equations of
          motion in stationary coordinates become:
        </p>
        <LabFormula
          lab="sr-13"
          latex={String.raw`\begin{gathered}\frac{d^2x}{dt^2} = \frac{\varepsilon}{\mu}\frac{1}{\beta^3}X, \\ \frac{d^2y}{dt^2} = \frac{\varepsilon}{\mu}\frac{1}{\beta}\left(Y - \frac{v}{V}N\right)\end{gathered}`}
        />
        <p>
          Comparing comoving force components to stationary accelerations gives the longitudinal
          mass m&gamma;<sup>3</sup> = 1.953125m and the transverse mass m&gamma;<sup>2</sup> =
          1.5625m. In contrast, Planck&apos;s 1906 laboratory convention (F = dp/dt) yields
          transverse mass m&gamma; = 1.25m.
        </p>
        <p>
          Crucially, both definitions predict the exact same physical trajectory and radius of
          curvature in a transverse electric field:
        </p>
        <LabFormula
          lab="sr-13"
          latex={String.raw`\begin{gathered}R_e = \frac{\gamma m v^2}{|q| E} \approx 2.2995\text{ m} \\ (\text{Newtonian } R_{e,\text{newt}} = \frac{m v^2}{|q| E} \\ \approx 1.8396\text{ m})\end{gathered}`}
        />
        <p>
          The relativistic kinetic energy required to accelerate the electron from rest to 0.6c is:
        </p>
        <LabFormula
          lab="sr-13"
          latex={String.raw`\begin{gathered}\begin{aligned}W &= m c^2 (\gamma - 1) = 0.25 m c^2 \\ &\approx 127.75\text{ keV}\end{aligned} \\ \implies P = \frac{W}{e} \approx 127.75\text{ kV}\end{gathered}`}
        />
        <p>
          Because &gamma; &minus; 1 grows without bound as v &rarr; c, an infinite accelerating
          potential would be required to reach the speed of light: superluminal velocities have no
          physical possibility of existence for material particles.
        </p>
        <div className="actions">
          <a className="button" href="/papers/special-relativity/#s10">
            Return to paper section 10
          </a>
        </div>
      </section>
    </>
  );
}
