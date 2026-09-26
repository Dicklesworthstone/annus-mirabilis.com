import type { Metadata } from "next";
import { LabFormula, LabInlineFormula } from "../../../components/lab/LabFormula.tsx";
import { LabInlineTerms } from "../../../components/lab/LabInlineTerms.tsx";
import { WaveDescriptionLab } from "../../../components/lab/WaveDescriptionLab.tsx";
import { validateLq01Parameters } from "../../../experiments/lq01/parameters.ts";
import example from "../../../generated/lq01-example.json";

export const metadata: Metadata = {
  title: "Wave description and energy spreading",
  description:
    "What does a continuous wave description of light explain well, and what exactly does its intensity measure?",
};

export default function WaveDescriptionPage() {
  const checked = validateLq01Parameters(example.parameters);
  if (checked.kind !== "accepted") {
    throw new Error("The prepared wave description parameters are invalid.");
  }

  return (
    <>
      <LabInlineTerms lab="lq-01" />
      <header className="page-intro">
        <p className="eyebrow">Light quanta · Introduction</p>
        <h1>
          <span>Continuous waves explain</span> <span>purely optical phenomena.</span>
        </h1>
        <p className="lead">
          What does a continuous wave description of light explain well, and what exactly does its
          intensity measure?
        </p>
      </header>

      <WaveDescriptionLab example={{ ...example, parameters: checked.data }} />
      <nav className="lab-onward" aria-label="From here">
        <h2>From here</h2>
        <ul>
          <li>
            <a href="/papers/light-quanta/#s0">Read the Introduction of Einstein’s 1905 paper</a>
          </li>
          <li>
            <a href="/discover/light-quanta/">Open the light-quanta journey</a>
          </li>
        </ul>
      </nav>

      <section className="reading" id="wave-theory">
        <p className="eyebrow">The physical context</p>
        <h2>The successes of continuous wave optics</h2>
        <p>
          In the opening paragraph of his 1905 paper, Einstein contrasts the continuous spatial
          functions of Maxwellian electrodynamics with the atomistic discrete description of
          ponderable matter. He emphasizes that the wave theory of light:
        </p>
        <blockquote>
          &ldquo;...has proved to be excellently suited for the description of purely optical
          phenomena and will probably never be replaced by any other theory.&rdquo;
        </blockquote>
        <p>
          Diffraction, reflection, refraction, and interference are macroscopic triumphs of the
          continuous wave picture. When two coherent monochromatic waves superpose at a point, their
          scalar fields add linearly:
        </p>
        <LabFormula
          lab="lq-01"
          latex={String.raw`\begin{aligned}\psi(\mathbf{r}, t) &= \frac{A_1}{r_1}\cos(k r_1 - \omega t + \phi_1) \\ &\quad + \frac{A_2}{r_2}\cos(k r_2 - \omega t + \phi_2)\end{aligned}`}
        />

        <h2>Time averages versus instantaneous values</h2>
        <p>
          Optical detectors (the eye, photographic plates, chemical actinometers) cannot resolve
          oscillations at optical frequencies (
          <LabInlineFormula
            lab="lq-01"
            latex={String.raw`\nu \sim 10^{14}\text{--}10^{15}\text{ Hz}`}
          />
          ). They record exclusively the <em>time-averaged intensity</em> over millions of optical
          periods:
        </p>
        <LabFormula
          lab="lq-01"
          latex={String.raw`\langle I \rangle = \frac{\kappa}{2}\left[ a_1^2 + a_2^2 + 2 a_1 a_2 \cos\delta \right]`}
        />
        <p>
          For two equal-amplitude coherent waves in phase (
          <LabInlineFormula lab="lq-01" latex="\delta = 0" />
          ), the time-averaged intensity at constructive interference is 4 times that of a single
          wave. When shifted by half a wave (<LabInlineFormula lab="lq-01" latex="\delta = \pi" />
          ), the intensity drops to identically zero.
        </p>

        <h2>Geometric energy spreading</h2>
        <p>
          On the wave theory, energy emitted by an isotropic point source of power{" "}
          <LabInlineFormula lab="lq-01" latex="P" /> spreads continuously over expanding spherical
          wavefronts of surface area <LabInlineFormula lab="lq-01" latex="4\pi r^2" />. The radiant
          intensity at distance <LabInlineFormula lab="lq-01" latex="r" /> is:
        </p>
        <LabFormula lab="lq-01" latex={String.raw`I(r) = \frac{P}{4\pi r^2}`} />
        <p>
          The total energy flux integrated over any enclosing spherical surface is strictly
          conserved:
        </p>
        <LabFormula lab="lq-01" latex={String.raw`\oint_{\text{sphere}} I(r)\, dA = P`} />
        <p>
          It is precisely this continuous dilution of energy throughout an expanding volume that
          Einstein challenges when analyzing the <em>generation and transformation of light</em> in
          fluorescence, cathode-ray excitation, and photoionization.
        </p>

        <div className="actions">
          <a className="button" href="/papers/light-quanta/#s0">
            Return to the Light Quanta Paper
          </a>
          <a href="/discover/light-quanta/">Open the light-quanta journey</a>
        </div>
      </section>
    </>
  );
}
