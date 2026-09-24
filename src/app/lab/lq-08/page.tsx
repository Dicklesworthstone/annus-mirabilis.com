import type { Metadata } from "next";
import { Formula } from "../../../components/edition/Formula.tsx";
import { InlineFormula } from "../../../components/lab/InlineFormula.tsx";
import { PhotoelectricComparison } from "../../../components/lab/lq08/PhotoelectricLab.tsx";
import { loadMillikanOverlay } from "../../../experiments/lq08/millikanRecord.ts";
import example from "../../../generated/lq08-example.json";

export const metadata: Metadata = {
  title: "Photoelectric apparatus and stopping potential",
  description:
    "Why does increasing light intensity release more electrons without increasing their individual energy, while increasing frequency increases electron energy without requiring higher intensity?",
};

export default function PhotoelectricPage() {
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Light quanta · Section 8</p>
        <h1>
          <span>Brighter light, more electrons.</span> <span>Higher frequency, faster ones.</span>
        </h1>
        <p className="lead">
          Why does increasing light intensity release more electrons without increasing their
          individual energy, while increasing frequency increases electron energy without requiring
          higher intensity?
        </p>
      </header>

      <PhotoelectricComparison example={example} millikan={loadMillikanOverlay()} />
      <nav className="lab-onward" aria-label="From here">
        <h2>From here</h2>
        <ul>
          <li>
            <a href="/lab/lq-08/data/">Analyze your own stopping-potential record</a>
          </li>
          <li>
            <a href="/papers/light-quanta/#s8">Read Section 8 of Einstein’s 1905 paper</a>
          </li>
        </ul>
      </nav>

      <section className="reading" id="photoelectric-theory">
        <p className="eyebrow">The physical argument</p>
        <h2>The single-quantum energy conservation law</h2>
        <p>
          In &sect;8 of his 1905 paper, Einstein applies the light-quantum hypothesis to the
          generation of cathode rays by light (the photoelectric effect). If monochromatic light
          consists of energy quanta of magnitude{" "}
          <InlineFormula latex={String.raw`\frac{R}{N}\beta\nu = h\nu`} />, the simplest picture,
          which Einstein says he will assume, is that an absorbed quantum gives its entire energy to
          a single electron in the body. For one electron, of charge{" "}
          <InlineFormula latex={String.raw`\varepsilon`} />, the body&apos;s stopping potential{" "}
          <InlineFormula latex={String.raw`\Pi`} /> satisfies:
        </p>
        <Formula latex={String.raw`\Pi\varepsilon = \frac{R}{N}\beta\nu - P`} />
        <p>
          Einstein also writes the same law for a gram-equivalent of charge,{" "}
          <InlineFormula latex={String.raw`\Pi E = R\beta\nu - P'`} />, which is the one-electron
          law multiplied by <InlineFormula latex="N" />. In modern notation, writing{" "}
          <InlineFormula latex={String.raw`\Pi`} /> as the stopping potential{" "}
          <InlineFormula latex="V_s" />, <InlineFormula latex={String.raw`\varepsilon`} /> as the
          elementary charge <InlineFormula latex="e" />, and <InlineFormula latex="P" /> as the
          surface escape work <InlineFormula latex={String.raw`\Phi`} />:
        </p>
        <Formula
          latex={String.raw`e V_s = h\nu - \Phi \implies V_s = \frac{h}{e}\nu - \frac{\Phi}{e}`}
        />

        <h2>Two consequences Einstein drew</h2>
        <ol>
          <li>
            <strong>The electrons&apos; speed does not depend on the intensity.</strong> If each
            quantum gives up its energy independently of the others, more intense light brings more
            quanta each second (
            <InlineFormula latex={String.raw`\dot{N} = P_{\text{light}}/(h\nu)`} />
            ), so the number of electrons leaving is proportional to the intensity, while the spread
            of their speeds stays the same. Lenard had reported in 1902 that the speed did not
            depend on the intensity.
          </li>
          <li>
            <strong>The potential is a straight line in the frequency.</strong> Plotted against{" "}
            <InlineFormula latex={String.raw`\nu`} />, the potential must be a straight line whose
            slope does not depend on the substance. Below{" "}
            <InlineFormula latex={String.raw`\nu_0 = \Phi/h`} /> no single quantum carries enough
            energy to release an electron. Einstein expected these rules to have limits, as he
            expected for Stokes&apos;s rule in §7: where the light is so intense that energy from
            several quanta can combine, or where it is far from the range of Wien&apos;s law.
          </li>
        </ol>

        <h2>Einstein&apos;s 1905 historical check</h2>
        <p>
          In 1905 there were few measurements to compare with. Philipp Lenard had measured, in 1902,
          the potentials that bodies illuminated by arc and spark light reach. Einstein took the
          ultraviolet end of the solar spectrum,{" "}
          <InlineFormula latex={String.raw`\nu = 1.03\times 10^{15}\ \text{s}^{-1}`} /> (a
          wavelength near 290 nm), neglected the escape work, and found:
        </p>
        <Formula latex={String.raw`V_s \approx \frac{h\nu}{e} \approx 4.3\ \text{V}`} />
        <p>
          He wrote that this agrees in order of magnitude with Lenard&apos;s results. It is a check
          of scale, not a measurement of the law.
        </p>

        <h2>The slope, measured in 1916</h2>
        <p>
          Robert Millikan tested the straight line on alkali metals cut clean in a vacuum (sodium,
          potassium, lithium). His 1916 lines had the slope{" "}
          <InlineFormula latex={String.raw`\frac{dV_s}{d\nu} = \frac{h}{e}`} /> within his errors,
          giving Planck&apos;s <InlineFormula latex="h" /> to about half a percent, and differed
          from metal to metal only in where they crossed zero, at{" "}
          <InlineFormula latex={String.raw`\nu_0`} />. Millikan still called the theory by which
          Einstein had reached the equation untenable.
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
          Below <InlineFormula latex={String.raw`\nu_0`} /> there is no stopping potential to
          report: no electron leaves, so there is nothing to stop, and the instrument says so rather
          than showing zero. Millikan&apos;s 1916 result is later evidence, not a premise of the
          1905 argument.
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
