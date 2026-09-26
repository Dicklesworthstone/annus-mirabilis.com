import type { Metadata } from "next";
import { LabFormula, LabInlineFormula } from "../../../components/lab/LabFormula.tsx";
import { LabInlineTerms } from "../../../components/lab/LabInlineTerms.tsx";
import { CoefficientMatchEntry } from "../../../components/lab/lq06/CoefficientMatchEntry.tsx";
import type { PreparedLq06Example } from "../../../experiments/lq06/session.ts";
import example from "../../../generated/lq06-example.json";

export const metadata: Metadata = {
  title: "Matching the entropy coefficients to derive the light quantum",
  description:
    "Why does matching the volume dependence of Wien radiation entropy to Boltzmann's independent-particle law suggest that monochromatic light behaves as independent quanta of energy hν?",
};

export default function CoefficientMatchPage() {
  return (
    <>
      <LabInlineTerms lab="lq-06" />
      <header className="page-intro">
        <p className="eyebrow">Light quanta · Section 6</p>
        <h1>
          <span>The radiation entropy law matches the gas entropy law.</span>{" "}
          <span>The exponent identifies the light quantum.</span>
        </h1>
        <p className="lead">
          Why does equating the volume dependence of Wien radiation entropy to Boltzmann&apos;s
          independent-particle entropy law suggest that monochromatic radiation behaves as
          independent energy quanta of magnitude{" "}
          <LabInlineFormula lab="lq-06" latex={String.raw`R\beta\nu / N = h\nu`} />?
        </p>
      </header>

      <CoefficientMatchEntry example={example as unknown as PreparedLq06Example} />
      <nav className="lab-onward" aria-label="From here">
        <h2>From here</h2>
        <ul>
          <li>
            <a href="/papers/light-quanta/#s6">Read Section 6 of Einstein’s 1905 paper</a>
          </li>
        </ul>
      </nav>

      <section className="reading" id="the-move-theory">
        <p className="eyebrow">The physical argument</p>
        <h2>The entropy volume laws placed side by side</h2>
        <p>
          In &sect;4, Einstein showed that for monochromatic radiation of energy{" "}
          <LabInlineFormula lab="lq-06" latex="E" /> and frequency{" "}
          <LabInlineFormula lab="lq-06" latex="\nu" /> in the Wien regime, changing the enclosing
          volume from <LabInlineFormula lab="lq-06" latex="V_0" /> to{" "}
          <LabInlineFormula lab="lq-06" latex="V" /> changes the entropy by:
        </p>
        <LabFormula lab="lq-06" latex={String.raw`S - S_0 = \frac{E}{\beta\nu}\ln\frac{V}{V_0}`} />
        <p>
          In &sect;5, Einstein evaluated Boltzmann&apos;s principle{" "}
          <LabInlineFormula lab="lq-06" latex={String.raw`S - S_0 = \frac{R}{N}\ln W`} /> for a
          system of <LabInlineFormula lab="lq-06" latex="n" /> independent particles in a container,
          finding that the statistical probability of finding all{" "}
          <LabInlineFormula lab="lq-06" latex="n" /> particles in a subvolume{" "}
          <LabInlineFormula lab="lq-06" latex="V" /> is{" "}
          <LabInlineFormula lab="lq-06" latex="W = (V/V_0)^n" />, leading to:
        </p>
        <LabFormula
          lab="lq-06"
          latex={String.raw`S - S_0 = \frac{R}{N}\,n\ln\frac{V}{V_0} = k_B\,n\ln\frac{V}{V_0}`}
        />

        <h2>The move: equating the functional forms</h2>
        <p>
          To make the two equations directly comparable, Einstein rewrites the radiation entropy
          formula with Boltzmann&apos;s constant factor <LabInlineFormula lab="lq-06" latex="R/N" />{" "}
          outside the logarithm:
        </p>
        <LabFormula
          lab="lq-06"
          latex={String.raw`S - S_0 = \frac{R}{N}\ln\left[\left(\frac{V}{V_0}\right)^{\frac{N}{R}\frac{E}{\beta\nu}}\right]`}
        />
        <p>
          Comparing this with the gas probability law reveals that the statistical probability that
          all the monochromatic radiation energy <LabInlineFormula lab="lq-06" latex="E" /> is found
          in subvolume <LabInlineFormula lab="lq-06" latex="V" /> is:
        </p>
        <LabFormula
          lab="lq-06"
          latex={String.raw`W = \left(\frac{V}{V_0}\right)^{\frac{N}{R}\frac{E}{\beta\nu}}`}
        />
        <p>
          The exponent{" "}
          <LabInlineFormula
            lab="lq-06"
            latex={String.raw`n_{\text{eff}} = \frac{N E}{R\beta\nu} = \frac{E}{h\nu}`}
          />{" "}
          plays precisely the role of the particle count <LabInlineFormula lab="lq-06" latex="n" />.
        </p>

        <h2>Energy per element and historical constants</h2>
        <p>
          If a total energy <LabInlineFormula lab="lq-06" latex="E" /> is composed of{" "}
          <LabInlineFormula lab="lq-06" latex="n_{\text{eff}}" /> independent quanta, each quantum
          carries an energy:
        </p>
        <LabFormula
          lab="lq-06"
          latex={String.raw`\epsilon = \frac{E}{n_{\text{eff}}} = \frac{R\beta\nu}{N} = h\nu`}
        />
        <p>
          Using the 1905 experimental values for the gas constant{" "}
          <LabInlineFormula lab="lq-06" latex={String.raw`R = 8{,}31\cdot 10^7\text{ erg/K}`} />,
          Wien&apos;s constant{" "}
          <LabInlineFormula
            lab="lq-06"
            latex={String.raw`\beta = 4{,}866\cdot 10^{-11}\text{ K}\cdot\text{s}`}
          />
          , and Avogadro&apos;s number{" "}
          <LabInlineFormula lab="lq-06" latex={String.raw`N = 6{,}17\cdot 10^{23}`} />, the product
          is:
        </p>
        <LabFormula
          lab="lq-06"
          latex={String.raw`\frac{R\beta}{N} = 6{,}5537\cdot 10^{-27}\text{ erg}\cdot\text{s}`}
        />
        <p>
          Einstein does not print this product. It is the constant Planck called{" "}
          <LabInlineFormula lab="lq-06" latex="h" />, computed from the values Einstein takes from
          Planck, and it lies about 1.1% below the modern value, 6.626 × 10⁻²⁷ erg·s. So the energy
          of the packets found from the entropy of radiation alone is Planck&apos;s quantum of
          action, to that precision.
        </p>

        <h2>Mean quantum energy over a Wien spectrum</h2>
        <p>
          Einstein further calculated the average energy of light quanta in thermal radiation at
          temperature <LabInlineFormula lab="lq-06" latex="T" /> by integrating over the full Wien
          spectrum:
        </p>
        <LabFormula
          lab="lq-06"
          latex={String.raw`\begin{aligned}\langle \epsilon \rangle &= \frac{\int_0^\infty \alpha\nu^3 e^{-\beta\nu/T} d\nu}{\int_0^\infty \frac{N}{R\beta\nu}\alpha\nu^3 e^{-\beta\nu/T} d\nu} \\ &= 3\frac{R}{N}T \\ &= 3 k_B T\end{aligned}`}
        />
        <p>
          This is exactly twice the average translational kinetic energy of a monoatomic gas
          molecule,{" "}
          <LabInlineFormula
            lab="lq-06"
            latex={String.raw`\langle E_{\text{kin}} \rangle = \frac{3}{2} k_B T`}
          />
          .
        </p>

        <h2>The three logical roles</h2>
        <ol>
          <li>
            <strong>Derivation (Mathematical Identity):</strong> The radiation entropy volume law
            and the ideal gas entropy volume law agree identically for all volume ratios{" "}
            <LabInlineFormula lab="lq-06" latex="V/V_0" /> if and only if{" "}
            <LabInlineFormula lab="lq-06" latex={String.raw`n = N E / (R\beta\nu) = E / (h\nu)`} />.
          </li>
          <li>
            <strong>Heuristic Inference (Thermodynamic Analogy):</strong> In the Wien regime of low
            radiation density, monochromatic radiation behaves thermodynamically <em>as though</em>{" "}
            it consisted of <LabInlineFormula lab="lq-06" latex="n_{\text{eff}}" /> mutually
            independent energy quanta <LabInlineFormula lab="lq-06" latex="h\nu" />.
          </li>
          <li>
            <strong>Further Physical Hypothesis (Emission and Absorption):</strong> This analogy
            suggests investigating whether the processes of emission and absorption of light also
            proceed by discrete quanta of size <LabInlineFormula lab="lq-06" latex="h\nu" />{" "}
            (demonstrated in &sect;7 for Stokes&apos; rule, &sect;8 for photoelectricity, and
            &sect;9 for gas ionization).
          </li>
        </ol>

        <div className="actions">
          <a className="button" href="/papers/light-quanta/#s6">
            Return to the Light Quanta Paper
          </a>
          <a href="/discover/light-quanta/">Open the light-quanta journey</a>
        </div>
      </section>
    </>
  );
}
