import type { Metadata } from "next";
import { SpectrumComparison } from "../../../components/lab/lq03/SpectrumLab.tsx";
import { LQ03_DEFAULTS } from "../../../experiments/lq03/definition.ts";
import { evaluateLq03 } from "../../../experiments/lq03/session.ts";

export const metadata: Metadata = {
  title: "The radiation spectrum and regime comparison (LQ-03)",
};

export default function SpectrumPage() {
  const example = {
    parameters: LQ03_DEFAULTS,
    evaluation: evaluateLq03(LQ03_DEFAULTS),
    sourceDigest: "src/physics/reference/radiation.ts",
  };

  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Light quanta &middot; Radiation spectrum and regime comparison</p>
        <h1>
          Where Wien's law holds,
          <br />
          and where it stops.
        </h1>
        <p className="lead">
          What does a measured radiation spectrum look like at a given temperature, in which regime
          is Wien's law or the classical law an accurate description, and what does a density plot
          actually measure?
        </p>
        <p>
          <a href="/papers/light-quanta/#s2">Read &sect;2's classical-regime conclusion &rarr;</a>
        </p>
      </header>

      <SpectrumComparison example={example} />

      <section className="reading" id="spectrum-argument">
        <p className="eyebrow">Open the derivation</p>
        <h2>Two printed limitations, made visible</h2>
        <p>
          The light paper states two regime limitations rather than one universal law. &sect;2
          concludes that the classical basis is suitable for large energy densities and wavelengths
          and fails completely for small wavelengths and low densities. &sect;4 notes that Wien's
          law is not exactly valid, but that experiment fully confirms it for large &nu;/T, so
          results based on it hold only within those limits. This instrument shows the criteria for
          both limitations explicitly, at the temperature and frequency you choose, rather than
          asserting one law everywhere.
        </p>
        <h2>Two coordinate traps</h2>
        <p>
          A frequency-domain density u<sub>&nu;</sub> and a wavelength-domain density u
          <sub>&lambda;</sub> are related by a Jacobian, u<sub>&lambda;</sub>(&lambda;) = u
          <sub>&nu;</sub>(c/&lambda;)&middot;c/&lambda;&#178;, not by simple substitution. Their
          peaks do not correspond under &lambda; = c/&nu;, and relabeling an axis without the
          Jacobian breaks the one invariant that does hold: the energy in a matching physical band,
          which agrees exactly between representations.
        </p>

        <div className="actions">
          <a className="button" href="/lab/bm-01/">
            Compare with the tracer ensemble &rarr;
          </a>
        </div>
      </section>
    </>
  );
}
