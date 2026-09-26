import type { Metadata } from "next";
import { LabFormula } from "../../../components/lab/LabFormula.tsx";
import { MagnetConductorComparison } from "../../../components/lab/MagnetConductorLab.tsx";
import { validateSr02Parameters } from "../../../experiments/sr02/parameters.ts";
import example from "../../../generated/sr02-example.json";

export const metadata: Metadata = {
  title: "Magnet and conductor",
  description:
    "Why does moving the magnet instead of the conductor create an explanatory asymmetry, and how does the transformation remove it? Both descriptions are internally coherent.",
};

export default function MagnetConductorPage() {
  const checked = validateSr02Parameters(example.parameters);
  if (checked.kind !== "accepted") {
    throw new Error("The prepared magnet-conductor parameters are invalid.");
  }
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Special relativity · The opening asymmetry</p>
        <h1>
          <span>The same relative motion,</span> <span>two accounts of one current.</span>
        </h1>
        <p className="lead">
          Why does moving the magnet instead of the conductor create an explanatory asymmetry, and
          how does the transformation remove it? Both descriptions are internally coherent. They
          agree on what is measured to first order in v/c.
        </p>
      </header>
      <MagnetConductorComparison example={{ ...example, parameters: checked.data }} />
      <nav className="lab-onward" aria-label="From here">
        <h2>From here</h2>
        <ul>
          <li>
            <a href="/papers/">The four-paper catalogue (source edition in preparation)</a>
          </li>
        </ul>
      </nav>
      <section className="reading" id="magnet-conductor-argument">
        <p className="eyebrow">Open the two descriptions</p>
        <h2>A path across the motion is comparable</h2>
        <p>
          An electromotive force is work per unit charge along a stated path, not a field component.
          The default segment lies along ŷ, across a boost along x̂, so the endpoint events have Δx =
          0. They are simultaneous in both frames, the length is unchanged, and the ratio of the two
          electromotive forces is exactly γ.
        </p>
        <LabFormula
          lab="sr-02"
          latex={String.raw`\begin{gathered}\mathcal{E}=vB\ell, \\ \mathcal{E}'=\gamma vB\ell, \\ \mathbf{E}'_\perp=\gamma(\mathbf{v}\times\mathbf{B})_\perp\end{gathered}`}
        />
        <p>
          At 10 m/s with B = 1 T and ℓ = 0.1 m the magnet-frame value is 1 V. The excess γ − 1 is
          5.563×10⁻¹⁶ from the cancellation-free form; a float64 evaluation of γ − 1 is not that
          number. At 0.6c the ratio is 1.25. Those two electromotive forces are not the same number,
          and they are not supposed to be: the correct comparison is the transformation law.
          Lorentz's ether plus local time produces the same first-order formulae and is not declared
          refuted here.
        </p>
        <div className="actions">
          <a className="button" href="/papers/">
            Return to the four papers
          </a>
          <a href="/lab/me-02/">A mass-energy laboratory that is already open</a>
        </div>
      </section>
    </>
  );
}
