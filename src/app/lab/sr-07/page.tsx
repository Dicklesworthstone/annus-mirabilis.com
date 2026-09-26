import type { Metadata } from "next";
import { FieldEquationsComparison } from "../../../components/lab/sr07/FieldEquationsLab.tsx";
import { validateSr07Parameters } from "../../../experiments/sr07/parameters.ts";
import { DEFAULT_PREPARED_EXAMPLE } from "../../../experiments/sr07/session.ts";
import labDigests from "../../../generated/lab-source-digests.json";
import "./equations.css";
import { LabFormula } from "../../../components/lab/LabFormula.tsx";

export const metadata: Metadata = {
  title: "Transform the field equations",
  description:
    "How do the Maxwell-Hertz equations keep their form under the transformation, and what must the electric and magnetic fields do?",
};

export default function FieldEquationsPage() {
  const checked = validateSr07Parameters(DEFAULT_PREPARED_EXAMPLE.parameters);
  if (checked.kind !== "accepted")
    throw new Error("The prepared field-equation settings are invalid.");
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Special relativity · Electrodynamics §6</p>
        <h1>
          <span>The field equations</span> <span>keep their form.</span>
        </h1>
        <p className="lead">
          How do the Maxwell-Hertz equations keep their form under the transformation, and what must
          the electric and magnetic fields do?
        </p>
      </header>
      <FieldEquationsComparison
        // The example names its host source by digest (scripts/generate-lab-digests.mjs).
        example={{
          ...DEFAULT_PREPARED_EXAMPLE,
          parameters: checked.data,
          sourceDigest: labDigests["sr-07"],
        }}
      />
      <nav className="lab-onward" aria-label="From here">
        <h2>From here</h2>
        <ul>
          <li>
            <a href="/papers/special-relativity/#s6">Read §6 of the 1905 relativity paper</a>
          </li>
        </ul>
      </nav>
      <section className="reading" id="field-equations-worked">
        <h2>Worked case (readable without JavaScript)</h2>
        <p>
          The printed layer is Gaussian, as in Annalen 1905. X, Y, Z are electric-field components.
          L, M, N are magnetic-field components. Einstein&apos;s β is the modern γ. V is the speed
          of light in this paper, not L.
        </p>
        <LabFormula
          lab="sr-07"
          latex={String.raw`\frac{1}{V}\frac{\partial X}{\partial t}=\frac{\partial N}{\partial y}-\frac{\partial M}{\partial z}`}
        />
        <p>
          After the section 3 chain rule and grouping, the same form holds in the moving frame for
          the combinations X, β(Y − (v/V)N), β(Z + (v/V)M) and L, β(M + (v/V)Z), β(N − (v/V)Y). A
          plane wave along +x at v = 0.6c has its amplitude and frequency transformed by the factor
          β(1 − v/V) = 1.25 × 0.4 = 1/2, in the paper&apos;s letters, where β is 1.25.
        </p>
        <div className="actions">
          <a className="button" href="/papers/special-relativity/#s6">
            Return to paper section 6
          </a>
          <a href="/lab/sr-08/">Fields in two frames</a>
        </div>
      </section>
    </>
  );
}
