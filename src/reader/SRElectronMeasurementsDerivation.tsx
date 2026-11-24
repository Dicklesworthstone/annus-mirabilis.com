"use client";

import { DerivationChain } from "../equations/derivations/DerivationChain.tsx";
import {
  presentElectronMeasurementChain,
  srElectronDeflectability,
  srElectronMagneticRadius,
  srElectronMeasurementHistory,
  srElectronMeasurementPremises,
  srElectronVoltage,
} from "../equations/derivations/srElectronMeasurements.ts";

export type SRElectronMeasurementsDerivationProps = Readonly<{
  activeDetail?: "0" | "1" | "2";
  perspective?: "historical" | "modern";
}>;

const sections = [
  { title: "1. Compare electric and magnetic deflectability", chain: srElectronDeflectability },
  { title: "2. Connect an accelerating voltage to speed", chain: srElectronVoltage },
  { title: "3. Predict the magnetic circle's radius", chain: srElectronMagneticRadius },
] as const;

/** The entire argument and its limits survive without hydration and in print. */
export function SRElectronMeasurementsDerivation({
  activeDetail = "1",
  perspective = "historical",
}: SRElectronMeasurementsDerivationProps) {
  return (
    <section
      id="sr-electron-measurements-derivation"
      className="local-steps"
      aria-labelledby="sr-electron-measurements-title"
      data-historical-status="pedagogical-reconstruction"
      data-review="draft"
    >
      <h4 id="sr-electron-measurements-title">
        From equations of motion to three measurable relations
      </h4>
      <p>
        Section 10 ends by asking what an experiment could compare: electric and magnetic
        deflection, the voltage needed to reach a speed, and the radius of a magnetic orbit. These
        reconstructions connect the preceding force and work results to those quantities. Checking
        the algebra does not show that an experiment agrees with it.
      </p>
      <p>
        The deflectability calculation retains the paper’s Gaussian field normalization. The voltage
        and radius calculations use SI magnitudes, with <i>m</i>, γ and <i>c</i> for the paper’s μ,
        β and <i>V</i>. Here <i>v</i> is a nonnegative speed; the charge’s sign sets the bend’s
        direction. The SI equations write <i>Q</i> = |<i>q</i>| for the positive charge magnitude; F
        <sub>y</sub> and a<sub>y</sub> are laboratory transverse components.
      </p>
      <details className="local-steps" open>
        <summary>The physical premises and finite domains</summary>
        <ul>
          {srElectronMeasurementPremises.map((premise) => (
            <li key={premise.id}>
              <strong>{premise.label}.</strong> {premise.explanation}
            </li>
          ))}
        </ul>
      </details>
      {sections.map(({ title, chain }) => (
        <section key={chain.id} aria-labelledby={`${chain.id}-title`}>
          <h5 id={`${chain.id}-title`}>{title}</h5>
          <DerivationChain
            chains={[presentElectronMeasurementChain(chain)]}
            activeDetail={activeDetail}
            perspective={perspective}
            sourceLinkLabel="Read the corresponding printed relation"
          />
        </section>
      ))}
      <details className="local-steps" open>
        <summary>Keep Gaussian and SI comparisons separate</summary>
        <p>
          In the printed Gaussian convention, equally strong local deflection occurs when
          <i> E</i>
          <sub>G</sub> = <i>vB</i>
          <sub>G</sub>/<i>c</i>, and the field-normalized deflectability ratio is <i>v</i>/<i>c</i>.
          In SI, equal local deflection instead requires <i>E</i> = <i>vB</i>. Electric field in
          volts per metre and magnetic field in teslas are different quantities: equal numerical
          inputs are not an equal-field experiment.
        </p>
        <p>
          The Gaussian first relation and the SI magnetic radius therefore agree through an explicit
          unit-system bridge. They are not obtained by replacing the source’s letters while keeping
          the same numerical field values.
        </p>
      </details>
      <section aria-labelledby="sr-electron-measurements-worked-title">
        <h5 id="sr-electron-measurements-worked-title">One exact worked case: speed 3c/5</h5>
        <p>
          Since 1 − (3/5)² = 16/25, γ = 5/4. Use this value in all three relations without choosing
          an electron mass or charge from a table.
        </p>
        <table>
          <caption>A model comparison at the same speed, using the indicated normalization</caption>
          <thead>
            <tr>
              <th scope="col">Quantity</th>
              <th scope="col">Relativistic prediction</th>
              <th scope="col">What the comparison tells you</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">
                Gaussian A<sub>m</sub>/A<sub>e</sub>
              </th>
              <td>3/5</td>
              <td>The common charge, mass and response coefficient cancel.</td>
            </tr>
            <tr>
              <th scope="row">Voltage in units of mc²/|q|</th>
              <td>γ − 1 = 1/4</td>
              <td>The Newtonian expression gives 9/50; the starting condition is rest.</td>
            </tr>
            <tr>
              <th scope="row">Magnetic radius in units of mc/(|q|B)</th>
              <td>γv/c = 3/4</td>
              <td>The Newtonian expression gives 3/5, so the predicted circle is 25% larger.</td>
            </tr>
          </tbody>
        </table>
        <p>
          The deflectability ratio alone does not distinguish this relativistic response from a
          Newtonian model with the same Lorentz force: the response coefficient cancels in both. The
          voltage–speed and radius–speed comparisons retain the difference. Testing them requires
          independent measurements and their uncertainties.
        </p>
        <details className="local-steps">
          <summary>Try a new case: double B while keeping the speed fixed</summary>
          <p>
            The magnetic radius halves. The voltage that was needed to reach that speed from rest
            stays the same, because its expression contains no magnetic field. The field-normalized
            Gaussian deflectability ratio also stays v/c. An unnormalized magnetic deflection would
            change, which is why the first comparison divides by its field strength.
          </p>
        </details>
      </section>
      <details className="local-steps" open>
        <summary>What happens at zero speed or zero magnetic field?</summary>
        <p>
          At rest the work and accelerating voltage are zero, and the normalized deflectability
          ratio is zero. The circular-radius derivation has the stricter domain 0 &lt; v &lt; c and
          B &gt; 0. At v = 0 no orbit is traced; at B = 0 no magnetic circle is produced. The limit
          of a formula does not supply the missing geometry at either boundary.
        </p>
      </details>
      <h5>Follow the source and the earlier premises</h5>
      <ul>
        <li id="sr-electron-measurements-source-deflection">
          <a href="/papers/special-relativity/view/german/#eq-s10-d9">
            First relation: magnetic and electric deflectability, p. 920
          </a>
        </li>
        <li id="sr-electron-measurements-source-voltage">
          <a href="/papers/special-relativity/view/german/#eq-s10-d10">
            Second relation: potential difference and final speed, p. 921
          </a>
        </li>
        <li id="sr-electron-measurements-source-circle">
          <a href="/papers/special-relativity/view/german/#eq-s10-d11">
            Third relation’s circular-acceleration step, p. 921
          </a>
        </li>
        <li id="sr-electron-measurements-source-radius">
          <a href="/papers/special-relativity/view/german/#eq-s10-d12">
            Third relation: the magnetic radius, p. 921
          </a>
        </li>
      </ul>
      <p>
        <a href="/papers/special-relativity/s10/#sr-electron-conventions-derivation">
          Follow the force-frame convention
        </a>
        {" · "}
        <a href="/papers/special-relativity/s10/#sr-electron-work-derivation">
          Follow the work integral from rest
        </a>
        {" · "}
        <a href="/lab/sr-13/">Compare the model quantities in the electron laboratory</a>
      </p>
      <details className="local-steps" data-reading="3" data-detail="3">
        <summary>Historian’s margin</summary>
        <p>{srElectronMeasurementHistory.r3}</p>
        <p>
          <cite>{srElectronMeasurementHistory.r3Citations[0]}</cite>
        </p>
      </details>
    </section>
  );
}
