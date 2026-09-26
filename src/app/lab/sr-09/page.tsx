import type { Metadata } from "next";
import { LabFormula } from "../../../components/lab/LabFormula.tsx";
import { LabInlineTerms } from "../../../components/lab/LabInlineTerms.tsx";
import { DopplerAberrationLab } from "../../../components/lab/sr09/DopplerAberrationLab.tsx";
import { validateSr09Parameters } from "../../../experiments/sr09/parameters.ts";
import example from "../../../generated/sr09-example.json";

export const metadata: Metadata = {
  title: "Doppler principle and aberration",
  description: "How do the frequency and propagation direction of light transform between frames?",
};

export default function DopplerAberrationPage() {
  const checked = validateSr09Parameters(example.parameters);
  if (checked.kind !== "accepted") {
    throw new Error("The prepared SR-09 example parameters are invalid.");
  }

  return (
    <>
      <LabInlineTerms lab="sr-09" />
      <header className="page-intro">
        <p className="eyebrow">Special relativity · Electrodynamics §7</p>
        <h1>
          <span>Frequency and direction transform together</span>{" "}
          <span>from the invariance of the phase.</span>
        </h1>
        <p className="lead">
          How do the frequency and propagation direction of light transform between frames?
        </p>
      </header>

      <DopplerAberrationLab example={{ ...example, parameters: checked.data }} />

      <nav className="lab-onward" aria-label="From here">
        <h2>From here</h2>

        <ul>
          <li>
            <a href="/papers/special-relativity/#s7">Read §7 of the 1905 relativity paper</a>
          </li>
        </ul>
      </nav>

      <section className="reading" id="doppler-aberration-worked">
        <h2>Worked case (readable without JavaScript)</h2>
        <p>
          Consider a light wave with frequency ν = 500 THz propagating at angle θ = 0° along the
          x-axis in the stationary system K, viewed by an observer moving along the x-axis at speed
          v = 0.6c (β = 0.6, γ = 1.25).
        </p>
        <LabFormula
          lab="sr-09"
          latex={String.raw`\begin{aligned}\nu' &= \nu\gamma(1 - \beta\cos\theta) \\ &= \nu\sqrt{\frac{1-\beta}{1+\beta}} \\ &= 0.5\nu \\ &= 250\text{ THz}\end{aligned}`}
        />
        <p>For a ray at right angles in the stationary system (θ = 90°):</p>
        <LabFormula
          lab="sr-09"
          latex={String.raw`\begin{gathered}\nu' = \gamma\nu = 1.25\nu = 625\text{ THz}, \\ \cos\theta' = -\beta = -0.6 \\ \implies \theta' \approx 126.87^\circ\end{gathered}`}
        />
        <p>
          The phase φ = k·x − ωt is an invariant scalar that takes the exact same numerical value in
          both reference frames at every spacetime event.
        </p>
        <div className="actions">
          <a className="button" href="/papers/special-relativity/#s7">
            Return to paper section 7
          </a>
        </div>
      </section>
    </>
  );
}
