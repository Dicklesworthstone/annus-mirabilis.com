import type { Metadata } from "next";
import { LabFormula } from "../../../components/lab/LabFormula.tsx";
import { ModeAllocationLab } from "../../../components/lab/ModeAllocationLab.tsx";
import { DEFAULT_LQ02_INPUTS } from "../../../experiments/lq02/session.ts";

export const metadata: Metadata = {
  title: "Classical mode-energy allocation",
  description:
    "§1 gives every linear resonator oscillation the same mean energy, whatever its frequency.",
};

export default function ModeAllocationPage() {
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Light quanta · Sections 1–2</p>
        <h1>
          <span>Give every resonator its share,</span>{" "}
          <span>and the total never stops growing.</span>
        </h1>
        <p className="lead">
          If every resonator gets the same mean energy whatever its frequency, how much energy does
          the radiation hold, and does the total ever stop growing? §1 gives every linear resonator
          oscillation the same mean energy, whatever its frequency. Widen the range of resonator
          frequencies you allow, and see what that classical allocation actually predicts, and why
          the paper says it rules out any equilibrium between matter and radiation.
        </p>
      </header>

      <ModeAllocationLab example={DEFAULT_LQ02_INPUTS} />
      <nav className="lab-onward" aria-label="From here">
        <h2>From here</h2>
        <ul>
          <li>
            <a href="/papers/light-quanta/#s1">Read §1's resonator model and its verdict</a>
          </li>
        </ul>
      </nav>

      <section className="reading">
        <h2>The law this instrument calculates</h2>
        <LabFormula
          lab="lq-02"
          latex={String.raw`\begin{aligned}U(\nu_c) &= \int_0^{\nu_c} \frac{8\pi\nu^2}{c^3}k_BT\,d\nu \\ &= \frac{8\pi k_BT}{3c^3}\nu_c^3\end{aligned}`}
        />
        <p>
          Every resonator oscillation, at every frequency, carries the same mean energy Ē = k
          <sub>B</sub>T (source notation (R/N)T), two-thirds of a free molecule's mean kinetic
          energy, as §1 notes. Because that mean energy never falls off with frequency, the energy
          held by resonators up to a cutoff grows as the cube of the cutoff, without limit as the
          cutoff is removed.
        </p>
        <h2>Why the paper calls this a difficulty, not just an approximation</h2>
        <p>
          §1 draws two conclusions from this, not one: the classical allocation disagrees with the
          measured spectrum, and, independently, it rules out any equilibrium between matter and the
          radiation field at all, because the total grows without bound as the resonator range
          widens. This instrument's "remove the upper limit" action shows that second conclusion
          directly, as a typed refusal rather than a number that quietly becomes huge.
        </p>
        <h2>What §2 does with Planck's constants</h2>
        <p>
          §2 does not use Planck's radiation law as a hypothesis about light; it uses the two
          constants of Planck's fitted formula, in the classical limit, to solve for Avogadro's
          number. The historical readout below reproduces that calculation from Einstein's printed
          constants, labeled apart from the modern, defined value.
        </p>
        <div className="actions">
          <a className="button" href="/lab/lq-01/">
            Return to the wave description
          </a>
          <a href="/papers/light-quanta/">Return to the argument</a>
        </div>
      </section>
    </>
  );
}
