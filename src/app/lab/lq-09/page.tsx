import type { Metadata } from "next";
import { Formula } from "../../../components/edition/Formula.tsx";
import { IonizationComparison } from "../../../components/lab/lq09/IonizationLab.tsx";
import example from "../../../generated/lq09-example.json";

export const metadata: Metadata = {
  title: "LQ-09: Gas Ionization Bounds and Counting Model",
};

export default function IonizationPage() {
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Light Quanta · Section 9</p>
        <h1>
          Threshold frequency sets the bound.
          <br />
          Absorbed energy counts the ions.
        </h1>
        <p className="lead">
          How does single-quantum energy conservation set the threshold frequency for ionizing a
          gas, and why is the number of ionized molecules strictly bounded by the absorbed light
          quanta?
        </p>
        <p>
          <a href="/papers/light-quanta/#s9">Read Section 9 of Einstein’s 1905 paper</a>
        </p>
      </header>

      <IonizationComparison example={example} />

      <section className="reading" id="ionization-theory">
        <p className="eyebrow">The Physical Argument</p>
        <h2>The single-quantum ionization conservation law</h2>
        <p>
          In &sect;9 of his 1905 paper, Einstein extends the light-quantum hypothesis from surface
          photoemission to the ionization of gases by light. If a molecule requires an energy{" "}
          <Formula latex={String.raw`J_{\text{mol}}`} /> to split into ions (or in gram-equivalent
          units, ionization work <Formula latex="J" />
          ), an absorbed light quantum must supply at least this amount of energy in a single
          elementary process:
        </p>
        <Formula latex={String.raw`R\beta\nu \ge J \quad \iff \quad h\nu \ge J_{\text{mol}}`} />
        <p>
          This gives a strict minimum threshold frequency{" "}
          <Formula latex={String.raw`\nu_0 = \frac{J_{\text{mol}}}{h}`} /> and corresponding maximum
          wavelength <Formula latex={String.raw`\lambda_0 = \frac{c}{\nu_0}`} />.
        </p>

        <h2>The counting relation: proportionality to absorbed energy</h2>
        <p>
          Suppose light of frequency <Formula latex={String.raw`\nu > \nu_0`} /> shines into a gas,
          and a total light energy <Formula latex="L" /> is absorbed. Under Einstein&apos;s primary
          hypothesis that every absorbed quantum of energy <Formula latex={String.raw`R\beta\nu`} />{" "}
          ionizes exactly one molecule, the number of ionized gram-molecules <Formula latex="j" />{" "}
          is given by:
        </p>
        <Formula latex={String.raw`j = \frac{L}{R\beta\nu}`} />
        <p>
          In particle counts (where <Formula latex="N_A" /> is Avogadro&apos;s constant and{" "}
          <Formula latex={String.raw`N_{\text{ion}}`} /> is the number of ionized molecules):
        </p>
        <Formula latex={String.raw`N_{\text{ion}} = \frac{L}{h\nu}`} />

        <h2>Three epistemic absorption conditions</h2>
        <ol>
          <li>
            <strong>All absorption ionizes:</strong> When every absorbed quantum produces an
            ionization event, <Formula latex={String.raw`N_{\text{ion}} = L / (h\nu)`} /> holds as
            an exact equality.
          </li>
          <li>
            <strong>Declared fraction:</strong> If only a fraction <Formula latex="a \in [0, 1]" />{" "}
            of absorbed quanta goes to ionization while the rest dissipates as heat or non-ionizing
            excitation, the yield is{" "}
            <Formula latex={String.raw`N_{\text{ion}} = a \frac{L}{h\nu}`} />.
          </li>
          <li>
            <strong>Unknown non-ionizing channels:</strong> If the partition between ionizing and
            non-ionizing absorption is unknown, the count is underdetermined, with{" "}
            <Formula latex={String.raw`N_{\text{ion}} \le \frac{L}{h\nu}`} /> providing a rigorous
            single-quantum upper bound.
          </li>
        </ol>

        <h2>Einstein&apos;s 1905 historical checks</h2>
        <p>
          Einstein verified that the energy scale of light quanta matches gas ionization using two
          contemporary experimental datasets:
        </p>
        <ul>
          <li>
            <strong>Philipp Lenard (1900):</strong> Observed that ultraviolet light from a spark
            source ionizes air when transmitted through quartz, for wavelengths{" "}
            <Formula latex={String.raw`\lambda \le 1.9\times 10^{-5}\text{ cm}`} /> (190 nm).
            Einstein calculated that for{" "}
            <Formula latex={String.raw`\lambda = 1.9\times 10^{-5}\text{ cm}`} />, the quantum
            energy per gram-equivalent is:
            <Formula
              latex={String.raw`R\beta\nu = 8{,}31\cdot 10^7 \times 4{,}866\cdot 10^{-11} \times 1{,}58\cdot 10^{15} \approx 6{,}4\cdot 10^{12}\text{ Erg}`}
            />
            Divided by the gram-equivalent charge{" "}
            <Formula latex={String.raw`E = 9{,}6\cdot 10^3\text{ emu}`} />, this corresponds to a
            potential difference of <Formula latex={String.raw`V \approx 6{,}6\text{ Volts}`} />.
          </li>
          <li>
            <strong>Johannes Stark (1902):</strong> Found that cathode rays in air require a minimum
            potential difference of about <Formula latex="10\text{ Volts}" /> to produce ionization,
            giving <Formula latex={String.raw`J = 9{,}6\cdot 10^{12}\text{ Erg}`} /> per
            gram-equivalent and a threshold wavelength of{" "}
            <Formula latex={String.raw`\lambda_0 \approx 126\text{ nm}`} />.
          </li>
        </ul>

        <h2>Epistemic boundary</h2>
        <p>
          Below the ionization threshold frequency (<Formula latex={String.raw`\nu < \nu_0`} />
          ), the count and rate of single-quantum ionization are strictly not applicable (a typed
          non-value), never 0 presented as a measured rate. In real gases, secondary ionization by
          energetic electrons can produce additional ions, which is why the relations above describe
          direct single-quantum ionization under the paper&apos;s hypothesis.
        </p>

        <div className="actions">
          <a className="button" href="/papers/light-quanta/#s9">
            Return to the Light Quanta Paper
          </a>
          <a href="/discover/light-quanta/">Open the light-quanta journey</a>
        </div>
      </section>
    </>
  );
}
