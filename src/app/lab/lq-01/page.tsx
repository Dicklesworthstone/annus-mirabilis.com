import type { Metadata } from "next";
import { Formula } from "../../../components/edition/Formula.tsx";
import { WaveDescriptionLab } from "../../../components/lab/WaveDescriptionLab.tsx";
import { validateLq01Parameters } from "../../../experiments/lq01/parameters.ts";
import example from "../../../generated/lq01-example.json";

export const metadata: Metadata = {
  title: "LQ-01: Wave description and energy spreading",
};

export default function WaveDescriptionPage() {
  const checked = validateLq01Parameters(example.parameters);
  if (checked.kind !== "accepted") {
    throw new Error("The prepared wave description parameters are invalid.");
  }

  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Light Quanta · Introduction</p>
        <h1>
          Continuous waves explain
          <br />
          purely optical phenomena.
        </h1>
        <p className="lead">
          What does a continuous wave description of light explain well, and what exactly does its
          intensity measure?
        </p>
        <p>
          <a href="/papers/light-quanta/#s0">Read the Introduction of Einstein’s 1905 paper</a>
        </p>
      </header>

      <WaveDescriptionLab example={{ ...example, parameters: checked.data }} />

      <section className="reading" id="wave-theory">
        <p className="eyebrow">The Physical Context</p>
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
        <Formula
          latex={String.raw`\psi(\mathbf{r}, t) = \frac{A_1}{r_1}\cos(k r_1 - \omega t + \phi_1) + \frac{A_2}{r_2}\cos(k r_2 - \omega t + \phi_2)`}
        />

        <h2>Time averages versus instantaneous values</h2>
        <p>
          Optical detectors (the eye, photographic plates, chemical actinometers) cannot resolve
          oscillations at optical frequencies (
          <Formula latex={String.raw`\nu \sim 10^{14}\text{--}10^{15}\text{ Hz}`} />
          ). They record exclusively the <em>time-averaged intensity</em> over millions of optical
          periods:
        </p>
        <Formula
          latex={String.raw`\langle I \rangle = \frac{\kappa}{2}\left[ a_1^2 + a_2^2 + 2 a_1 a_2 \cos\delta \right]`}
        />
        <p>
          For two equal-amplitude coherent waves in phase (<Formula latex="\delta = 0" />
          ), the time-averaged intensity at constructive interference is 4 times that of a single
          wave. When shifted by half a wave (<Formula latex="\delta = \pi" />
          ), the intensity drops to identically zero.
        </p>

        <h2>Geometric energy spreading</h2>
        <p>
          On the wave theory, energy emitted by an isotropic point source of power{" "}
          <Formula latex="P" /> spreads continuously over expanding spherical wavefronts of surface
          area <Formula latex="4\pi r^2" />. The radiant intensity at distance <Formula latex="r" />{" "}
          is:
        </p>
        <Formula latex={String.raw`I(r) = \frac{P}{4\pi r^2}`} />
        <p>
          The total energy flux integrated over any enclosing spherical surface is strictly
          conserved:
        </p>
        <Formula latex={String.raw`\oint_{\text{sphere}} I(r)\, dA = P`} />
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
