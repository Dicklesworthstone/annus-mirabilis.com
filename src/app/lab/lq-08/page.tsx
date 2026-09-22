import type { Metadata } from "next";
import { Formula } from "../../../components/edition/Formula.tsx";
import { InlineFormula } from "../../../components/lab/InlineFormula.tsx";
import { PhotoelectricComparison } from "../../../components/lab/lq08/PhotoelectricLab.tsx";
import example from "../../../generated/lq08-example.json";

export const metadata: Metadata = {
  title: "Photoelectric apparatus and stopping potential",
};

export default function PhotoelectricPage() {
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Light quanta · Section 8</p>
        <h1>
          Energy is discrete.
          <br />
          Rates scale with power.
        </h1>
        <p className="lead">
          Why does increasing light intensity release more electrons without increasing their
          individual energy, while increasing frequency increases electron energy without requiring
          higher intensity?
        </p>
        <p>
          <a href="/papers/light-quanta/#s8">Read Section 8 of Einstein’s 1905 paper</a>
        </p>
      </header>

      <PhotoelectricComparison example={example} />

      <section className="reading" id="photoelectric-theory">
        <p className="eyebrow">The physical argument</p>
        <h2>The single-quantum energy conservation law</h2>
        <p>
          In &sect;8 of his 1905 paper, Einstein applies the light-quantum hypothesis to the
          generation of cathode rays by light (the photoelectric effect). If monochromatic light
          consists of energy quanta of magnitude{" "}
          <InlineFormula latex={String.raw`R\beta\nu = h\nu`} />, an absorbed quantum transfers its
          entire energy to a single electron in the cathode.
        </p>
        <Formula latex={String.raw`\Pi E = R\beta\nu - P`} />
        <p>
          In modern notation, writing <InlineFormula latex={String.raw`\Pi`} /> as the stopping
          potential <InlineFormula latex="V_s" />, <InlineFormula latex="E" /> as the elementary
          charge <InlineFormula latex="e" />, and <InlineFormula latex="P" /> as the surface escape
          work <InlineFormula latex={String.raw`\Phi`} />:
        </p>
        <Formula
          latex={String.raw`e V_s = h\nu - \Phi \implies V_s = \frac{h}{e}\nu - \frac{\Phi}{e}`}
        />

        <h2>Two qualitative predictions classical waves cannot explain</h2>
        <ol>
          <li>
            <strong>Intensity Invariance of Electron Energy:</strong> Increasing the radiant power
            of the incident light increases the photon flux (
            <InlineFormula latex={String.raw`\dot{N} = P_{\text{light}}/(h\nu)`} />
            ), yielding proportionally more photoelectrons per second, but leaves the kinetic energy
            of every single ejected electron completely unchanged.
          </li>
          <li>
            <strong>Linear Frequency Dependence and Threshold Cutoff:</strong> The maximum kinetic
            energy and retarding potential depend exclusively and linearly on the light frequency{" "}
            <InlineFormula latex={String.raw`\nu`} />. Below the threshold frequency{" "}
            <InlineFormula latex={String.raw`\nu_0 = \Phi/h`} />, no electrons can escape the
            cathode surface regardless of how intense the illumination is.
          </li>
        </ol>

        <h2>Einstein&apos;s 1905 historical check</h2>
        <p>
          At the time of writing in 1905, quantitative photoelectric data was scarce. Philipp Lenard
          had observed in 1902 that spark potentials reached several volts under ultraviolet arc
          illumination. Einstein calculated that for UV light of wavelength 290 nm (
          <InlineFormula latex={String.raw`\nu \approx 1.03\times 10^{15}\text{ Hz}`} />
          ), neglecting surface escape work, the expected potential is:
        </p>
        <Formula latex={String.raw`V_s \approx \frac{h\nu}{e} \approx 4.3\text{ Volts}`} />
        <p>
          This matched the order of magnitude of Lenard&apos;s sparks, providing the first numerical
          plausibility test of the light-quantum hypothesis.
        </p>

        <h2>Universal slope: Robert Millikan&apos;s 1916 precision validation</h2>
        <p>
          Over a decade later, Robert Millikan undertook exhaustive vacuum experiments on freshly
          cut alkali metals (sodium, potassium, lithium) to test Einstein&apos;s linear equation.
          While initially skeptical of light quanta, Millikan&apos;s 1916 data confirmed with
          remarkable precision that every metal exhibits the exact same slope{" "}
          <InlineFormula latex={String.raw`\frac{dV_s}{d\nu} = \frac{h}{e}`} />, varying only in the
          horizontal threshold cutoff intercept <InlineFormula latex={String.raw`\nu_0`} />.
        </p>

        <h2>Epistemic boundary: deductive consequences vs. empirical proof</h2>
        <p>
          A simulator programmed with an energy threshold does not prove that nature has a
          threshold; it demonstrates the deductive consequences of single-quantum energy exchange
          and surface escape work (<InlineFormula latex={String.raw`E_q = h\nu`} />,{" "}
          <InlineFormula latex={String.raw`W = \Phi`} />
          ). Independent experiments (such as Millikan’s 1916 precision dataset and later
          single-photon anti-bunching measurements) test whether those assumptions describe the
          physical world.
        </p>
        <p>
          When <InlineFormula latex={String.raw`\nu < \nu_0`} />, the stopping potential is strictly
          not applicable (a typed non-value), never zero, because no emitted photoelectrons exist to
          be retarded. Millikan 1916 is later historical evidence on the timeline, never an axiom of
          the 1905 derivation.
        </p>

        <div className="actions">
          <a className="button" href="/papers/light-quanta/#s8">
            Return to the Light Quanta Paper
          </a>
          <a href="/discover/light-quanta/">Open the light-quanta journey</a>
        </div>
      </section>
    </>
  );
}
