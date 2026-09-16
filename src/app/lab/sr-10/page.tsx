import type { Metadata } from "next";
import { Formula } from "../../../components/edition/Formula.tsx";
import { LightComplexLab } from "../../../components/lab/sr10/LightComplexLab.tsx";
import { validateSr10Parameters } from "../../../experiments/sr10/parameters.ts";
import example from "../../../generated/sr10-example.json";

export const metadata: Metadata = {
  title: "SR-10: The finite light complex",
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
          A packet of light does not transform
          <br />
          like a rigid material body.
        </h1>
        <p className="lead">
          How do the energy and volume of a bounded light complex transform between frames?
        </p>
        <p>
          <a href="/papers/special-relativity/#s8">Read §8 of the 1905 relativity paper →</a>
        </p>
      </header>

      <LightComplexLab example={{ ...example, parameters: checked.data }} />

      <section className="reading" id="light-complex-worked">
        <h2>Worked case (readable without JavaScript)</h2>
        <p>
          Consider a spherical light complex of initial volume V = 1.0 m&sup3; and total energy{" "}
          E = 1.0 J propagating along the x-axis (&phi; = 0&deg;) in the stationary
          system K. An observer moves along the x-axis at speed v = 0.6c (&beta; = 0.6, &gamma; = 1.25).
        </p>
        <p>
          The Doppler factor is q = &gamma;(1 &minus; &beta; cos &phi;) = 1.25(1 &minus; 0.6) = 0.5.
          Because the moving observer&apos;s simultaneous spatial plane cuts across a moving wave front,
          the volume of the complex in k transforms as:
        </p>
        <Formula
          latex={String.raw`\frac{V'}{V} = \frac{1}{q} = \frac{\sqrt{1 - \beta^2}}{1 - \beta\cos\varphi} = \frac{1}{0.5} = 2.0\implies V' = 2.0\text{ m}^3`}
        />
        <p>
          Meanwhile, the energy density transforms with the square of the amplitude ratio, $u'/u = q^2 = 0.25$.
          The total energy in the moving frame is:
        </p>
        <Formula
          latex={String.raw`E' = u'V' = (u q^2)(V / q) = u V q = E q = 0.5\text{ J}`}
        />
        <p>
          Notice the striking contrast with a rigid material body: a solid rod of volume V would undergo
          ordinary Lorentz length contraction to V&prime;<sub>rod</sub> = V/&gamma; = 0.8 m&sup3;.
          Treating the light complex like a rigid rod would give an incorrect energy E&prime;<sub>wrong</sub> = u&prime;(V/&gamma;) = 0.20 J.
        </p>
        <p>
          Einstein observed: &ldquo;It is remarkable that the energy and the frequency of a light complex
          vary with the state of motion of the observer in accordance with the same law.&rdquo;
        </p>
        <Formula
          latex={String.raw`\frac{E'}{E} = \frac{\nu'}{\nu} = \gamma(1 - \beta\cos\varphi)`}
        />
        <div className="actions">
          <a className="button" href="/papers/special-relativity/#s8">
            Return to paper section 8 →
          </a>
        </div>
      </section>
    </>
  );
}
