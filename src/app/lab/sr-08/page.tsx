import type { Metadata } from "next";
import { LabFormula } from "../../../components/lab/LabFormula.tsx";
import { LabInlineTerms } from "../../../components/lab/LabInlineTerms.tsx";
import { FieldFrameChangeLab } from "../../../components/lab/sr08/FieldFrameChangeLab.tsx";
import { validateSr08Parameters } from "../../../experiments/sr08/parameters.ts";
import example from "../../../generated/sr08-example.json";

export const metadata: Metadata = {
  title: "Electric and magnetic frame change",
  description:
    "How do electric and magnetic descriptions change together under a boost, and what does a test charge experience in each frame?",
};

export default function FieldFrameChangePage() {
  const checked = validateSr08Parameters(example.parameters);
  if (checked.kind !== "accepted") {
    throw new Error("The prepared SR-08 example parameters are invalid.");
  }

  return (
    <>
      <LabInlineTerms lab="sr-08" />
      <header className="page-intro">
        <p className="eyebrow">Special relativity · Electrodynamics §6</p>
        <h1>
          <span>Fields transform together,</span> <span>not as separate realities.</span>
        </h1>
        <p className="lead">
          How do electric and magnetic descriptions change together under a boost, and what does a
          test charge experience in each frame?
        </p>
      </header>

      <FieldFrameChangeLab example={{ ...example, parameters: checked.data }} />
      <nav className="lab-onward" aria-label="From here">
        <h2>From here</h2>
        <ul>
          <li>
            <a href="/papers/special-relativity/#s6">Read §6 of the 1905 relativity paper</a>
          </li>
        </ul>
      </nav>

      <section className="reading" id="field-frame-change-worked">
        <h2>Worked case (readable without JavaScript)</h2>
        <p>
          Consider a pure electric field in the stationary system K with E<sub>y</sub> = 1 V/m and B
          = 0, viewed from a coordinate system k boosted along the x-axis at speed v = 0.6c (γ =
          1.25).
        </p>
        <LabFormula
          lab="sr-08"
          latex={String.raw`\begin{aligned}E'_y &= \gamma(E_y - v B_z) \\ &= 1.25\text{ V/m}, \\ B'_z &= -\gamma\frac{v}{c^2}E_y = -\frac{0.75}{c} \\ &\approx -2.5017\times 10^{-9}\text{ T}\end{aligned}`}
        />
        <p>Both frames agree exactly on the Lorentz field invariants:</p>
        <LabFormula
          lab="sr-08"
          latex={String.raw`\begin{gathered}E^2 - c^2 B^2 = 1.0\text{ (V/m)}^2, \\ \mathbf{E}\cdot\mathbf{B} = 0\end{gathered}`}
        />
        <p>
          A test charge q at rest in K feels the force F<sub>y</sub> = qE<sub>y</sub>, which is
          1.602×10⁻¹⁹ N for an elementary charge, in the laboratory frame. In the moving frame k the
          charge has velocity u′<sub>x</sub> = −0.6c and feels the transformed Lorentz force F′
          <sub>y</sub> = q(E′<sub>y</sub> − u′<sub>x</sub>B′<sub>z</sub>) = q(1.25 − 0.45) V/m = 0.8
          × 1.602×10⁻¹⁹ N, since u′<sub>x</sub>B′<sub>z</sub> = (−0.6c)(−0.75/c) = 0.45 V/m. The
          force transformation F′<sub>y</sub> = F<sub>y</sub>/γ gives the same 0.8 F<sub>y</sub>,
          matching the kinematics of §6.
        </p>
        <div className="actions">
          <a className="button" href="/papers/special-relativity/#s6">
            Return to paper section 6
          </a>
          <a href="/lab/sr-02/">Magnet and conductor</a>
        </div>
      </section>
    </>
  );
}
