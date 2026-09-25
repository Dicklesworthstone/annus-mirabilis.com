import type { Metadata } from "next";
import { LightQuantaInvestigation } from "../../../../components/discover/LightQuantaInvestigation.tsx";
import { Formula } from "../../../../components/edition/Formula.tsx";
import type { PreparedLightInvestigation } from "../../../../discovery/lightQuanta/investigation.ts";
import example from "../../../../generated/light-quanta-investigation.json";
import "../../../../discovery/investigationPage.css";
import "./investigation.css";
import { StepDoor, StepDoors } from "../../../../discovery/StepDoor.tsx";

export const metadata: Metadata = {
  title: "Investigate light quanta: entropy, counting and emission",
  description:
    "A worked investigation of the Wien entropy correspondence and its conditional photoelectric consequences.",
  robots: { index: false },
};

/** Deliberately separate from publication of the reviewed historical Journey I record. */
export default function LightQuantaInvestigationPage() {
  const equations = {
    entropy: <Formula latex={String.raw`S-S_0=\frac{E}{\beta\nu}\ln\frac{V}{V_0}`} />,
    counting: (
      <Formula
        latex={String.raw`W_{\mathrm{independent}}=f^n,\quad W_{\mathrm{locked}}=f,\quad f=\frac{V}{V_0}`}
      />
    ),
    match: (
      <Formula
        latex={String.raw`\begin{gathered}\frac{E}{\beta\nu}=n_{\mathrm{eff}}\frac{R}{N},\\ n_{\mathrm{eff}}=\frac{NE}{R\beta\nu},\qquad \epsilon=\frac{R\beta\nu}{N}\end{gathered}`}
      />
    ),
    emission: (
      <Formula
        latex={String.raw`\begin{gathered}K_{\max}=\frac{R\beta\nu}{N}-P,\\ \Pi=\frac{K_{\max}}{e}\quad(K_{\max}\geq 0)\end{gathered}`}
      />
    ),
  };
  return (
    <article
      className="light-investigation-page investigation-page"
      data-discovery-workbench="light-quanta"
      data-edition-status="explanatory-preview"
    >
      <header className="page-intro">
        <p className="eyebrow">Discover · Light quanta · An explanatory investigation</p>
        <h1>Can a volume law suggest what light is made of?</h1>
        <p className="lead">
          Work out how the entropy of light changes with the volume it fills, compare that with
          points that move independently or all together, then test what follows if light hands over
          its energy in pieces.
        </p>
        <p className="notice">
          A route you could take, not a transcript of Einstein’s private thoughts. Its numbers are
          worked examples from stated assumptions.
        </p>
        <nav className="actions" aria-label="Investigation stages">
          <a href="#light-entropy">Entropy</a>
          <a href="#light-counting">Counting</a>
          <a href="#light-move">The heuristic move</a>
          <a href="#light-prediction">Predict and compare</a>
        </nav>
      </header>
      <section className="reading" aria-labelledby="light-before-the-move">
        <h2 id="light-before-the-move">Begin with what the wave description preserves</h2>
        <p>
          The wave description of how light travels stays as it is. What follows is a hypothesis
          about how light&rsquo;s energy is exchanged with matter, which is a different question.
          The calculations below do not model interference, and nothing in them says it disappears.
        </p>
        <StepDoors>
          <StepDoor href="/lab/lq-01/">Investigate prescribed waves and interference</StepDoor>
          <StepDoor href="/lab/lq-02/">Inspect classical energy allocation and its cutoff</StepDoor>
          <StepDoor href="/lab/lq-03/">Compare spectral laws and their admitted regimes</StepDoor>
        </StepDoors>
        <details>
          <summary>Notation and what is held fixed</summary>
          <p>
            In these source-style formulas β is Wien’s spectral constant, not a speed or a Lorentz
            factor. R is the molar gas constant, N the molecular number per mole, ν the cyclic
            frequency, E the stored radiation energy, and P the electron’s exit cost. In the
            explicitly modern numerical model, R/N corresponds to k_B and Rβ/N to h. The source uses
            ε for elementary charge; the emission formula here uses the editorial symbol e to
            distinguish it from energy per quantum.
          </p>
          <p className="ways-on">
            <a href="/notation/">Open the notation concordance</a>
            {" · "}
            <a href="/papers/light-quanta/#entry-light-quanta">
              Take the no-algebra counting entrance
            </a>
          </p>
        </details>
      </section>
      <LightQuantaInvestigation
        anchorPrefix="light"
        example={example as PreparedLightInvestigation}
        equations={equations}
      />
      <section className="reading" aria-labelledby="light-after-the-move">
        <h2 id="light-after-the-move">What survives, and what still needs observations?</h2>
        <p>
          The entropy correspondence suggests an interpretation in a restricted regime. Extending it
          to emission, fluorescence and ionization adds hypotheses. A programmed consequence is not
          an empirical confirmation, and a curve generated from the assumed law is not a historical
          dataset.
        </p>
        <details>
          <summary>Two further consequences, with their limits</summary>
          <p>
            Fluorescence: how the energy one absorption brings in limits the light given out, with
            the paper&rsquo;s thermal qualifications. Ionization: which thresholds, and which bounds
            on counts, follow without an invented absorption cross-section or an exact yield. Each
            gives a bound, and a bound is not a measurement.
          </p>
          <StepDoors>
            <StepDoor href="/lab/lq-07/">
              Inspect fluorescence budgets and thermal qualifications
            </StepDoor>
            <StepDoor href="/lab/lq-09/">Inspect ionization thresholds and count bounds</StepDoor>
          </StepDoors>
        </details>
        <p>
          Before leaving, explain why locked positions change the counting law, which inference
          fails outside the Wien regime, and why doubling power is not the same experiment as
          raising frequency.
        </p>
        <nav className="actions" aria-label="Return to the light-quanta paper">
          <a href="/papers/light-quanta/#arg-lq-wien-integration">Read the entropy derivation</a>
          <a href="/papers/light-quanta/#arg-lq-entropy-correspondence">
            Read the correspondence and its scope
          </a>
          <a href="/papers/light-quanta/#arg-lq-stopping-and-losses">
            Read the stopping-potential qualifications
          </a>
          <a href="/papers/light-quanta/view/facsimile/">Inspect the original scan</a>
          <a href="/discover/light-quanta/">Back to the light-quanta route</a>
        </nav>
      </section>
    </article>
  );
}
