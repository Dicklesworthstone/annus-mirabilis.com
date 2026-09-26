import type { Metadata } from "next";
import { LabFormula, LabInlineFormula } from "../../../components/lab/LabFormula.tsx";
import { EntropyWorkbenchComparison } from "../../../components/lab/lq04/EntropyWorkbenchLab.tsx";
import example from "../../../generated/lq04-example.json";

export const metadata: Metadata = {
  title: "Radiation entropy workbench",
  description:
    "Within the regime where Wien's law holds, how does the entropy of monochromatic radiation depend on the volume it occupies, and what had to be fixed to get a definite answer?",
};

export default function EntropyWorkbenchPage() {
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Light quanta · Sections 3-4</p>
        <h1>
          <span>A spectrum has an entropy.</span>{" "}
          <span>Compressing it costs the same way a gas does.</span>
        </h1>
        <p className="lead">
          Within the regime where Wien&apos;s law holds, how does the entropy of monochromatic
          radiation depend on the volume it occupies, and what had to be fixed to get a definite
          answer?
        </p>
      </header>

      <EntropyWorkbenchComparison example={example} />
      <nav className="lab-onward" aria-label="From here">
        <h2>From here</h2>
        <ul>
          <li>
            <a href="/papers/light-quanta/#s3">Read Section 3 of Einstein&apos;s 1905 paper</a>
          </li>
        </ul>
      </nav>

      <section className="reading" id="radiation-entropy-theory">
        <p className="eyebrow">The physical argument</p>
        <h2>Wien&apos;s variational argument (§3)</h2>
        <p>
          Einstein attributes the entropy argument to Wien and uses it to fix the temperature
          dependence of the spectral entropy density{" "}
          <LabInlineFormula lab="lq-04" latex={String.raw`\varphi`} />. Maximizing{" "}
          <LabInlineFormula lab="lq-04" latex={String.raw`S = v\int\varphi(\rho,\nu)\,d\nu`} /> at
          fixed energy, together with <LabInlineFormula lab="lq-04" latex="dS = dE/T" />, gives:
        </p>
        <LabFormula
          lab="lq-04"
          latex={String.raw`\frac{\partial\varphi}{\partial\rho} = \frac{1}{T}`}
        />
        <p>
          Section 3 closes with the condition that fixes the integration constant: the entropy
          density <LabInlineFormula lab="lq-04" latex={String.raw`\varphi`} /> vanishes when the
          radiation density <LabInlineFormula lab="lq-04" latex={String.raw`\rho`} /> is zero.
        </p>

        <h2>The dilute, narrow-band limit (§4)</h2>
        <p>
          Section 4 restricts to dilute monochromatic radiation obeying Wien&apos;s law, inverts it
          for the temperature, integrates the entropy density using the zero-density condition
          above, and integrates over a narrow band. The result is that the entropy of radiation of
          energy <LabInlineFormula lab="lq-04" latex="E" /> in volume{" "}
          <LabInlineFormula lab="lq-04" latex="v" /> depends on volume exactly the way the entropy
          of an ideal gas or a dilute solution does:
        </p>
        <LabFormula
          lab="lq-04"
          latex={String.raw`\begin{gathered}S - S_0 = \frac{E}{\beta\nu}\ln\frac{v}{v_0} \\ (\text{printed "lg" is the} \\ \text{natural logarithm})\end{gathered}`}
        />
        <p>
          Only after this volume law is established does identifying{" "}
          <LabInlineFormula lab="lq-04" latex={String.raw`\beta = h/k_B`} /> give the modern form{" "}
          <LabInlineFormula
            lab="lq-04"
            latex={String.raw`\Delta S = k_B\,\frac{E}{h\nu}\ln\frac{V}{V_0}`}
          />
          . The coefficient <LabInlineFormula lab="lq-04" latex={String.raw`E/(h\nu)`} /> emerges
          from an entropy calculation; the workbench above never rounds it to an integer or calls it
          a count of particles.
        </p>

        <h2>Why the fixing condition matters</h2>
        <p>
          Had the integration constant <LabInlineFormula lab="lq-04" latex={String.raw`C(\nu)`} />{" "}
          been left unfixed rather than set to zero by the boundary condition, it would contribute
          an extra term proportional to <LabInlineFormula lab="lq-04" latex="(V - V_0)" /> that does
          not cancel and does not reproduce the volume law. The workbench&apos;s teaching panel
          above makes this concrete with an illustrative nonzero{" "}
          <LabInlineFormula lab="lq-04" latex={String.raw`C(\nu)`} />.
        </p>

        <h2>Epistemic boundary: a regime-limited approximation</h2>
        <p>
          Wien&apos;s law is an admitted approximation to the true (Planck) spectrum, accurate only
          where the radiation is dilute relative to the frequency and temperature in question. A
          state dense enough that Wien&apos;s law fails is not silently computed with a wrong
          answer; the workbench refuses it and states why, rather than presenting a number outside
          the regime the argument actually covers.
        </p>

        <div className="actions">
          <a className="button" href="/papers/light-quanta/#s3">
            Return to the Light Quanta Paper
          </a>
          <a href="/discover/light-quanta/">Open the light-quanta journey</a>
        </div>
      </section>
    </>
  );
}
