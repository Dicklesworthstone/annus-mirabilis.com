import type { Metadata } from "next";
import { LabFormula } from "../../../components/lab/LabFormula.tsx";
import { LabInlineTerms } from "../../../components/lab/LabInlineTerms.tsx";
import { MovingMirrorLab } from "../../../components/lab/sr11/MovingMirrorLab.tsx";
import { validateSr11Parameters } from "../../../experiments/sr11/parameters.ts";
import example from "../../../generated/sr11-example.json";

export const metadata: Metadata = {
  title: "Moving mirror reflection and radiation pressure",
  description:
    "How do the frequency, angle, amplitude, and radiation pressure of light transform when reflected by a moving mirror, and how does energy balance between the light and the mirror's mechanical work?",
};

export default function MovingMirrorPage() {
  const checked = validateSr11Parameters(example.parameters);
  if (checked.kind !== "accepted") {
    throw new Error("The prepared SR-11 example parameters are invalid.");
  }

  return (
    <>
      <LabInlineTerms lab="sr-11" />
      <header className="page-intro">
        <p className="eyebrow">Special relativity · Electrodynamics §8</p>
        <h1>
          <span>Moving mirror reflection, Doppler shift,</span>{" "}
          <span>and radiation pressure energy balance.</span>
        </h1>
        <p className="lead">
          How do the frequency, angle, amplitude, and radiation pressure of light transform when
          reflected by a moving mirror, and how does energy balance between the light and the
          mirror&apos;s mechanical work?
        </p>
      </header>

      <MovingMirrorLab example={{ ...example, parameters: checked.data }} />
      <nav className="lab-onward" aria-label="From here">
        <h2>From here</h2>
        <ul>
          <li>
            <a href="/papers/special-relativity/#s8">Read §8 of the 1905 relativity paper</a>
          </li>
        </ul>
      </nav>

      <section className="reading" id="moving-mirror-worked">
        <h2>Worked case (readable without JavaScript)</h2>
        <p>
          Consider monochromatic radiation of energy density <em>u</em> encountering a perfectly
          reflecting mirror of area <em>A</em>
          <sub>m</sub> moving at velocity <em>v</em> = 0.6<em>c</em> (β = 0.6, γ = 1.25) along the
          surface normal (φ = 0°).
        </p>
        <p>The reflected wave frequency undergoes a double Doppler transformation:</p>
        <LabFormula
          lab="sr-11"
          latex={String.raw`\begin{aligned}\frac{\nu'''}{\nu} &= \frac{1 - 2\beta\cos\varphi + \beta^2}{1 - \beta^2} \\ &= \frac{1 - 2(0.6)(1) + 0.36}{1 - 0.36} \\ &= \frac{0.16}{0.64} \\ &= 0.25\end{aligned}`}
        />
        <p>The radiation pressure on the mirror is:</p>
        <LabFormula
          lab="sr-11"
          latex={String.raw`\begin{aligned}P &= 2u\,\frac{(\cos\varphi - \beta)^2}{1 - \beta^2} \\ &= 2u\,\frac{(1 - 0.6)^2}{1 - 0.36} \\ &= 2u\,\frac{0.16}{0.64} \\ &= 0.5\,u\end{aligned}`}
        />
        <p>
          Energy balance per unit time in the laboratory system <em>K</em>:
        </p>
        <LabFormula
          lab="sr-11"
          latex={String.raw`\begin{aligned}P_{\text{incident}} &= u\,c\,A_{\text{m}}(1 - \beta) \\ &= 0.4\,u\,c\,A_{\text{m}}\end{aligned}`}
        />
        <LabFormula
          lab="sr-11"
          latex={String.raw`\begin{aligned}P_{\text{reflected}} &= u\left(\frac{\nu'''}{\nu}\right)^2 c\,A_{\text{m}}(1 + \beta) \\ &= u(0.0625)c\,A_{\text{m}}(1.6) \\ &= 0.1\,u\,c\,A_{\text{m}}\end{aligned}`}
        />
        <LabFormula
          lab="sr-11"
          latex={String.raw`\begin{aligned}\dot{W}_{\text{mechanical}} &= P\cdot v\cdot A_{\text{m}} \\ &= (0.5\,u)(0.6\,c)(A_{\text{m}}) \\ &= 0.3\,u\,c\,A_{\text{m}}\end{aligned}`}
        />
        <LabFormula
          lab="sr-11"
          latex={String.raw`\begin{aligned}&P_{\text{incident}} - P_{\text{reflected}} - \dot{W}_{\text{mechanical}} \\ &\quad = 0.4 - 0.1 - 0.3 \\ &\quad = 0\end{aligned}`}
        />
        <p>
          The energy lost by the electromagnetic radiation upon reflection from a receding mirror is
          converted into mechanical work done on the mirror, preserving exact energy conservation.
        </p>
        <div className="actions">
          <a className="button" href="/papers/special-relativity/#s8">
            Return to paper section 8
          </a>
        </div>
      </section>
    </>
  );
}
