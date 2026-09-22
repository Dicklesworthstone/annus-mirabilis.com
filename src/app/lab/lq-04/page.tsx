import type { Metadata } from "next";
import { Formula } from "../../../components/edition/Formula.tsx";
import { EntropyWorkbenchComparison } from "../../../components/lab/lq04/EntropyWorkbenchLab.tsx";
import example from "../../../generated/lq04-example.json";

export const metadata: Metadata = {
  title: "LQ-04: Radiation Entropy Workbench",
};

export default function EntropyWorkbenchPage() {
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Light Quanta · Sections 3-4</p>
        <h1>
          A spectrum has an entropy.
          <br />
          Compressing it costs the same way a gas does.
        </h1>
        <p className="lead">
          Within the regime where Wien&apos;s law holds, how does the entropy of monochromatic
          radiation depend on the volume it occupies, and what had to be fixed to get a definite
          answer?
        </p>
        <p>
          <a href="/papers/light-quanta/#s3">Read Section 3 of Einstein&apos;s 1905 paper</a>
        </p>
      </header>

      <EntropyWorkbenchComparison example={example} />

      <section className="reading" id="radiation-entropy-theory">
        <p className="eyebrow">The Physical Argument</p>
        <h2>Wien&apos;s Variational Argument (§3)</h2>
        <p>
          Einstein attributes the entropy argument to Wien and uses it to fix the temperature
          dependence of the spectral entropy density <Formula latex={String.raw`\varphi`} />.
          Maximizing <Formula latex={String.raw`S = v\int\varphi(\rho,\nu)\,d\nu`} /> at fixed
          energy, together with <Formula latex="dS = dE/T" />, gives:
        </p>
        <Formula latex={String.raw`\frac{\partial\varphi}{\partial\rho} = \frac{1}{T}`} />
        <p>
          Section 3 closes with the condition that fixes the integration constant: the entropy
          density <Formula latex={String.raw`\varphi`} /> vanishes when the radiation density{" "}
          <Formula latex={String.raw`\rho`} /> is zero.
        </p>

        <h2>The Dilute, Narrow-Band Limit (§4)</h2>
        <p>
          Section 4 restricts to dilute monochromatic radiation obeying Wien&apos;s law, inverts it
          for the temperature, integrates the entropy density using the zero-density condition
          above, and integrates over a narrow band. The result is that the entropy of radiation of
          energy <Formula latex="E" /> in volume <Formula latex="v" /> depends on volume exactly the
          way the entropy of an ideal gas or a dilute solution does:
        </p>
        <Formula
          latex={String.raw`S - S_0 = \frac{E}{\beta\nu}\ln\frac{v}{v_0}\qquad(\text{printed "lg" is the natural logarithm})`}
        />
        <p>
          Only after this volume law is established does identifying{" "}
          <Formula latex={String.raw`\beta = h/k_B`} /> give the modern form{" "}
          <Formula latex={String.raw`\Delta S = k_B\,\frac{E}{h\nu}\ln\frac{V}{V_0}`} />. The
          coefficient <Formula latex={String.raw`E/(h\nu)`} /> emerges from an entropy calculation;
          the workbench above never rounds it to an integer or calls it a count of particles.
        </p>

        <h2>Why the Fixing Condition Matters</h2>
        <p>
          Had the integration constant <Formula latex={String.raw`C(\nu)`} /> been left unfixed
          rather than set to zero by the boundary condition, it would contribute an extra term
          proportional to <Formula latex="(V - V_0)" /> that does not cancel and does not reproduce
          the volume law. The workbench&apos;s teaching panel above makes this concrete with an
          illustrative nonzero <Formula latex={String.raw`C(\nu)`} />.
        </p>

        <h2>Epistemic Boundary: A Regime-Limited Approximation</h2>
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
