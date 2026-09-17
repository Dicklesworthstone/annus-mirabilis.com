import type { Metadata } from "next";
import { Formula } from "../../../components/edition/Formula.tsx";
import { PhotoelectricComparison } from "../../../components/lab/lq08/PhotoelectricLab.tsx";
import example from "../../../generated/lq08-example.json";

export const metadata: Metadata = {
  title: "LQ-08: Photoelectric Apparatus and Stopping Potential",
};

export default function PhotoelectricPage() {
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Light Quanta · Section 8</p>
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
          <a href="/papers/light-quanta/#s8">Read Section 8 of Einstein’s 1905 paper &rarr;</a>
        </p>
      </header>

      <PhotoelectricComparison example={example} />

      <section className="reading" id="photoelectric-theory">
        <p className="eyebrow">The Physical Argument</p>
        <h2>The Single-Quantum Energy Conservation Law</h2>
        <p>
          In &sect;8 of his 1905 paper, Einstein applies the light-quantum hypothesis to the
          generation of cathode rays by light (the photoelectric effect). If monochromatic light
          consists of energy quanta of magnitude <Formula latex={String.raw`R\beta\nu = h\nu`} />,
          an absorbed quantum transfers its entire energy to a single electron in the cathode.
        </p>
        <Formula latex={String.raw`\Pi E = R\beta\nu - P`} />
        <p>
          In modern notation, writing <Formula latex={String.raw`\Pi`} /> as the stopping potential{" "}
          <Formula latex="V_s" />, <Formula latex="E" /> as the elementary charge{" "}
          <Formula latex="e" />, and <Formula latex="P" /> as the surface escape work{" "}
          <Formula latex={String.raw`\Phi`} />:
        </p>
        <Formula
          latex={String.raw`e V_s = h\nu - \Phi \implies V_s = \frac{h}{e}\nu - \frac{\Phi}{e}`}
        />

        <h2>Two Qualitative Predictions Classical Waves Cannot Explain</h2>
        <ol>
          <li>
            <strong>Intensity Invariance of Electron Energy:</strong> Increasing the radiant power
            of the incident light increases the photon flux (
            <Formula latex={String.raw`\dot{N} = P_{\text{light}}/(h\nu)`} />
            ), yielding proportionally more photoelectrons per second, but leaves the kinetic energy
            of every single ejected electron completely unchanged.
          </li>
          <li>
            <strong>Linear Frequency Dependence and Threshold Cutoff:</strong> The maximum kinetic
            energy and retarding potential depend exclusively and linearly on the light frequency{" "}
            <Formula latex={String.raw`\nu`} />. Below the threshold frequency{" "}
            <Formula latex={String.raw`\nu_0 = \Phi/h`} />, no electrons can escape the cathode
            surface regardless of how intense the illumination is.
          </li>
        </ol>

        <h2>Einstein&apos;s 1905 Historical Check</h2>
        <p>
          At the time of writing in 1905, quantitative photoelectric data was scarce. Philipp Lenard
          had observed in 1902 that spark potentials reached several volts under ultraviolet arc
          illumination. Einstein calculated that for UV light of wavelength 290 nm (
          <Formula latex={String.raw`\nu \approx 1.03\times 10^{15}\text{ Hz}`} />
          ), neglecting surface escape work, the expected potential is:
        </p>
        <Formula latex={String.raw`V_s \approx \frac{h\nu}{e} \approx 4.3\text{ Volts}`} />
        <p>
          This matched the order of magnitude of Lenard&apos;s sparks, providing the first numerical
          plausibility test of the light-quantum hypothesis.
        </p>

        <h2>Universal Slope: Robert Millikan&apos;s 1916 Precision Validation</h2>
        <p>
          Over a decade later, Robert Millikan undertook exhaustive vacuum experiments on freshly
          cut alkali metals (sodium, potassium, lithium) to test Einstein&apos;s linear equation.
          While initially skeptical of light quanta, Millikan&apos;s 1916 data confirmed with
          remarkable precision that every metal exhibits the exact same slope{" "}
          <Formula latex={String.raw`\frac{dV_s}{d\nu} = \frac{h}{e}`} />, varying only in the
          horizontal threshold cutoff intercept <Formula latex={String.raw`\nu_0`} />.
        </p>

        <h2>Epistemic Boundary: Deductive Consequences vs. Empirical Proof</h2>
        <p>
          A simulator programmed with an energy threshold does not prove that nature has a
          threshold; it demonstrates the deductive consequences of single-quantum energy exchange
          and surface escape work (<Formula latex={String.raw`E_q = h\nu`} />,{" "}
          <Formula latex={String.raw`W = \Phi`} />
          ). Independent experiments (such as Millikan’s 1916 precision dataset and later
          single-photon anti-bunching measurements) test whether those assumptions describe the
          physical world.
        </p>
        <p>
          When <Formula latex={String.raw`\nu < \nu_0`} />, the stopping potential is strictly{" "}
          not applicable (a typed non-value), never zero, because no emitted photoelectrons exist to
          be retarded. Millikan 1916 is later historical evidence on the timeline, never an axiom of
          the 1905 derivation.
        </p>

        <div className="actions">
          <a className="button" href="/papers/light-quanta/#s8">
            Return to the Light Quanta Paper &rarr;
          </a>
          <a href="/discover/light-quanta/">Explore the Discovery Journey</a>
        </div>
      </section>
    </>
  );
}
