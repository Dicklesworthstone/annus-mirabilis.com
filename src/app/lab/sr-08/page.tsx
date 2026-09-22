import type { Metadata } from "next";
import { Formula } from "../../../components/edition/Formula.tsx";
import { FieldFrameChangeLab } from "../../../components/lab/sr08/FieldFrameChangeLab.tsx";
import { validateSr08Parameters } from "../../../experiments/sr08/parameters.ts";
import example from "../../../generated/sr08-example.json";

export const metadata: Metadata = {
  title: "Electric and magnetic frame change",
};

export default function FieldFrameChangePage() {
  const checked = validateSr08Parameters(example.parameters);
  if (checked.kind !== "accepted") {
    throw new Error("The prepared SR-08 example parameters are invalid.");
  }

  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Special relativity · Electrodynamics §6</p>
        <h1>
          Fields transform together,
          <br />
          not as separate realities.
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
          Consider a pure electric field in the stationary system K with Ey = 1 V/m and B = 0,
          viewed from a coordinate system k boosted along the x-axis at speed v = 0.6c (gamma =
          1.25).
        </p>
        <Formula
          latex={String.raw`E'_y = \gamma(E_y - v B_z) = 1.25\text{ V/m},\qquad B'_z = -\gamma\frac{v}{c^2}E_y = -\frac{0.75}{c} \approx -2.5017\times 10^{-9}\text{ T}`}
        />
        <p>Both frames agree exactly on the Lorentz field invariants:</p>
        <Formula
          latex={String.raw`E^2 - c^2 B^2 = 1.0\text{ (V/m)}^2,\qquad \mathbf{E}\cdot\mathbf{B} = 0`}
        />
        <p>
          A test charge with charge q at rest in K experiences force Fy = q Ey = 1.602×10⁻¹⁹ N in
          the laboratory frame. In the moving frame k, the charge has velocity u'x = -0.6c, and
          experiences the transformed Lorentz force F'y = q(E'y + u'x B'z) = q(1.25 - 0.6×0.75) =
          1.0×1.602×10⁻¹⁹ N. The relativistic force transformation law F'y = Fy / gamma gives F'y =
          0.8 Fy, matching the kinematics of §6.
        </p>
        <div className="actions">
          <a className="button" href="/papers/special-relativity/#s6">
            Return to paper section 6
          </a>
          <a href="/lab/sr-02/">SR-02: Magnet and conductor</a>
        </div>
      </section>
    </>
  );
}
