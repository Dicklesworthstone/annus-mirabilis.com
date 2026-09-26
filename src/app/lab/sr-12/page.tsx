import type { Metadata } from "next";
import { LabFormula } from "../../../components/lab/LabFormula.tsx";
import { LabInlineTerms } from "../../../components/lab/LabInlineTerms.tsx";
import { ChargeCurrentLab } from "../../../components/lab/sr12/ChargeCurrentLab.tsx";
import { validateSr12Parameters } from "../../../experiments/sr12/parameters.ts";
import example from "../../../generated/sr12-example.json";

export const metadata: Metadata = {
  title: "Charge and current density",
  description:
    "How do charge density and current density transform between inertial frames, and why is a neutral current-carrying wire charged in a moving frame?",
};

export default function ChargeCurrentPage() {
  const checked = validateSr12Parameters(example.parameters);
  if (checked.kind !== "accepted") {
    throw new Error("The prepared SR-12 example parameters are invalid.");
  }

  return (
    <>
      <LabInlineTerms lab="sr-12" />
      <header className="page-intro">
        <p className="eyebrow">Special relativity · Electrodynamics §9</p>
        <h1>
          <span>Charge density is frame-dependent,</span>{" "}
          <span>while total charge is invariant.</span>
        </h1>
        <p className="lead">
          How do charge density and current density transform between inertial frames, and why is a
          neutral current-carrying wire charged in a moving frame?
        </p>
      </header>

      <ChargeCurrentLab example={{ ...example, parameters: checked.data }} />
      <nav className="lab-onward" aria-label="From here">
        <h2>From here</h2>
        <ul>
          <li>
            <a href="/papers/special-relativity/#s9">Read §9 of the 1905 relativity paper</a>
          </li>
        </ul>
      </nav>

      <section className="reading" id="charge-current-worked">
        <h2>Worked case (readable without JavaScript)</h2>
        <p>
          Consider a neutral conductor in the stationary frame K with volumetric charge density
          &rho; = 0 and current density J<sub>x</sub> = 1 A/m&sup2;, viewed from a frame k boosted
          along x at speed v = 0.6c (&gamma; = 1.25).
        </p>
        <LabFormula
          lab="sr-12"
          latex={String.raw`\begin{aligned}\rho' &= \gamma\left(\rho - \frac{v J_x}{c^2}\right) \\ &= 1.25\left(0 - \frac{0.6}{c}\right) \\ &= -\frac{0.75}{c} \\ &\approx -2.5017\times 10^{-9}\text{ C/m}^3\end{aligned}`}
        />
        <LabFormula
          lab="sr-12"
          latex={String.raw`\begin{aligned}J'_x &= \gamma\left(J_x - v\rho\right) \\ &= 1.25(1 - 0) \\ &= 1.25\text{ A/m}^2\end{aligned}`}
        />
        <p>
          Both coordinate frames agree exactly on the relativistic four-current invariant
          (c&rho;)&sup2; &minus; |J|&sup2;:
        </p>
        <LabFormula
          lab="sr-12"
          latex={String.raw`\begin{gathered}(c\rho)^2 - J_x^2 = 0 - 1 = -1\text{ (A/m}^2)^2, \\ \begin{aligned}(c\rho')^2 - (J'_x)^2 &= (-0.75)^2 - (1.25)^2 \\ &= 0.5625 - 1.5625 \\ &= -1\text{ (A/m}^2)^2\end{aligned}\end{gathered}`}
        />
        <p>
          For a rectangular current loop of length l<sub>x</sub> = 1 m carrying current I = 1 A at
          0.6c, Lorentz contraction shortens the x-legs to l&prime;<sub>x</sub> = l<sub>x</sub>
          /&gamma; = 0.8 m. The top leg carries charge q&prime;<sub>+</sub> = &minus;(v I l
          <sub>x</sub>)/c&sup2; ≈ &minus;2.0014&times;10⁻⁹ C while the bottom leg carries q&prime;
          <sub>&minus;</sub> = +(v I l<sub>x</sub>)/c&sup2; ≈ +2.0014&times;10⁻⁹ C. The total charge
          remains identically zero, verifying that total charge is an exact Lorentz scalar.
        </p>
        <div className="actions">
          <a className="button" href="/papers/special-relativity/#s9">
            Return to paper section 9
          </a>
          <a href="/lab/sr-08/">Field frame change</a>
        </div>
      </section>
    </>
  );
}
