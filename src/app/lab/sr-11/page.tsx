import type { Metadata } from "next";
import { Formula } from "../../../components/edition/Formula.tsx";
import { MovingMirrorLab } from "../../../components/lab/sr11/MovingMirrorLab.tsx";
import { validateSr11Parameters } from "../../../experiments/sr11/parameters.ts";
import example from "../../../generated/sr11-example.json";

export const metadata: Metadata = {
  title: "SR-11: Moving mirror reflection and radiation pressure",
};

export default function MovingMirrorPage() {
  const checked = validateSr11Parameters(example.parameters);
  if (checked.kind !== "accepted") {
    throw new Error("The prepared SR-11 example parameters are invalid.");
  }

  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Special relativity · Electrodynamics §8</p>
        <h1>
          Moving mirror reflection, Doppler shift,
          <br />
          and radiation pressure energy balance.
        </h1>
        <p className="lead">
          How do the frequency, angle, amplitude, and radiation pressure of light transform when
          reflected by a moving mirror, and how does energy balance between the light and the
          mirror&apos;s mechanical work?
        </p>
        <p>
          <a href="/papers/special-relativity/#s8">Read §8 of the 1905 relativity paper →</a>
        </p>
      </header>

      <MovingMirrorLab example={{ ...example, parameters: checked.data }} />

      <section className="reading" id="moving-mirror-worked">
        <h2>Worked case (readable without JavaScript)</h2>
        <p>
          Consider monochromatic radiation of energy density <em>u</em> encountering a perfectly
          reflecting mirror of area <em>A</em><sub>m</sub> moving at velocity <em>v</em> = 0.6<em>c</em> (β = 0.6, γ = 1.25) along the surface normal (φ = 0°).
        </p>
        <p>
          The reflected wave frequency undergoes a double Doppler transformation:
        </p>
        <Formula
          latex={String.raw`\frac{\nu'''}{\nu} = \frac{1 - 2\beta\cos\varphi + \beta^2}{1 - \beta^2} = \frac{1 - 2(0.6)(1) + 0.36}{1 - 0.36} = \frac{0.16}{0.64} = 0.25`}
        />
        <p>
          The radiation pressure on the mirror is:
        </p>
        <Formula
          latex={String.raw`P = 2u\,\frac{(\cos\varphi - \beta)^2}{1 - \beta^2} = 2u\,\frac{(1 - 0.6)^2}{1 - 0.36} = 2u\,\frac{0.16}{0.64} = 0.5\,u`}
        />
        <p>
          Energy balance per unit time in the laboratory system <em>K</em>:
        </p>
        <Formula
          latex={String.raw`P_{\text{incident}} = u\,c\,A_{\text{m}}(1 - \beta) = 0.4\,u\,c\,A_{\text{m}}`}
        />
        <Formula
          latex={String.raw`P_{\text{reflected}} = u\left(\frac{\nu'''}{\nu}\right)^2 c\,A_{\text{m}}(1 + \beta) = u(0.0625)c\,A_{\text{m}}(1.6) = 0.1\,u\,c\,A_{\text{m}}`}
        />
        <Formula
          latex={String.raw`\dot{W}_{\text{mechanical}} = P\cdot v\cdot A_{\text{m}} = (0.5\,u)(0.6\,c)(A_{\text{m}}) = 0.3\,u\,c\,A_{\text{m}}`}
        />
        <Formula
          latex={String.raw`P_{\text{incident}} - P_{\text{reflected}} - \dot{W}_{\text{mechanical}} = 0.4 - 0.1 - 0.3 = 0`}
        />
        <p>
          The energy lost by the electromagnetic radiation upon reflection from a receding mirror is
          converted into mechanical work done on the mirror, preserving exact energy conservation.
        </p>
        <div className="actions">
          <a className="button" href="/papers/special-relativity/#s8">
            Return to paper section 8 →
          </a>
        </div>
      </section>
    </>
  );
}
