import type { Metadata } from "next";
import { LabFormula, LabInlineFormula } from "../../../components/lab/LabFormula.tsx";
import { LightComplexLab } from "../../../components/lab/sr10/LightComplexLab.tsx";
import { validateSr10Parameters } from "../../../experiments/sr10/parameters.ts";
import example from "../../../generated/sr10-example.json";

export const metadata: Metadata = {
  title: "The finite light complex",
  description: "How do the energy and volume of a bounded light complex transform between frames?",
};

export default function LightComplexPage() {
  const checked = validateSr10Parameters(example.parameters);
  if (checked.kind !== "accepted") {
    throw new Error("The prepared SR-10 example parameters are invalid.");
  }

  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Special relativity · Electrodynamics §8</p>
        <h1>
          <span>A packet of light does not transform</span> <span>like a rigid material body.</span>
        </h1>
        <p className="lead">
          How do the energy and volume of a bounded light complex transform between frames?
        </p>
      </header>

      <LightComplexLab example={{ ...example, parameters: checked.data }} />

      <nav className="lab-onward" aria-label="From here">
        <h2>From here</h2>

        <ul>
          <li>
            <a href="/papers/special-relativity/#s8">Read §8 of the 1905 relativity paper</a>
          </li>
        </ul>
      </nav>

      <section className="reading" id="light-complex-worked">
        <h2>Worked case (readable without JavaScript)</h2>
        <p>
          Consider a spherical light complex of initial volume V = 1.0 m&sup3; and total energy E =
          1.0 J propagating along the x-axis (&phi; = 0&deg;) in the stationary system K. An
          observer moves along the x-axis at speed v = 0.6c (&beta; = 0.6, &gamma; = 1.25).
        </p>
        <p>
          The Doppler factor is q = &gamma;(1 &minus; &beta; cos &phi;) = 1.25(1 &minus; 0.6) = 0.5.
          Because the moving observer&apos;s simultaneous spatial plane cuts across a moving wave
          front, the volume of the complex in k transforms as:
        </p>
        <LabFormula
          lab="sr-10"
          latex={String.raw`\begin{gathered}\frac{V'}{V} = \frac{1}{q} = \frac{\sqrt{1 - \beta^2}}{1 - \beta\cos\varphi} = \frac{1}{0.5} = 2.0 \\ \implies V' = 2.0\text{ m}^3\end{gathered}`}
        />
        <p>
          Meanwhile, the energy density transforms with the square of the amplitude ratio,{" "}
          <LabInlineFormula lab="sr-10" latex={String.raw`u'/u = q^2 = 0.25`} />. The total energy
          in the moving frame is:
        </p>
        <LabFormula
          lab="sr-10"
          latex={String.raw`\begin{aligned}E' &= u'V' \\ &= (u q^2)(V / q) \\ &= u V q \\ &= E q \\ &= 0.5\text{ J}\end{aligned}`}
        />
        <p>
          Notice the contrast with a rigid material body: a solid rod of volume V would undergo
          ordinary Lorentz contraction to V&prime;<sub>rod</sub> = V/&gamma; = 0.8 m&sup3;. Treating
          the light complex like that rod would give E&prime;<sub>wrong</sub> = E/&gamma; = 0.80 J,
          not 0.50 J. The case that isolates this mistake is a ray transverse in K (φ = 90°): q = γ
          = 1.25 while 1/γ = 0.80, so they differ by γ². A ray transverse in k (cos φ = β) gives q =
          1/γ and cannot catch the mistake.
        </p>
        <p>
          Einstein observed: &ldquo;It is remarkable that the energy and the frequency of a light
          complex vary with the state of motion of the observer in accordance with the same
          law.&rdquo;
        </p>
        <LabFormula
          lab="sr-10"
          latex={String.raw`\frac{E'}{E} = \frac{\nu'}{\nu} = \gamma(1 - \beta\cos\varphi)`}
        />
        <div className="actions">
          <a className="button" href="/papers/special-relativity/#s8">
            Return to paper section 8
          </a>
        </div>
      </section>
    </>
  );
}
