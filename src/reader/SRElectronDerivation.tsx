"use client";

import { DerivationChain } from "../equations/derivations/DerivationChain.tsx";
import {
  srElectronDisplayChain,
  srElectronHistoricalReading,
  srElectronLaboratory,
  srElectronLongitudinal,
  srElectronTransverse,
  srElectronWork,
} from "../equations/derivations/srElectron.ts";

export interface SRElectronDerivationProps {
  readonly part: "conventions" | "work";
  readonly activeDetail?: "0" | "1" | "2";
  readonly perspective?: "historical" | "modern";
}

/** The original convention and the later comparison remain separately labeled in static HTML. */
export function SRElectronDerivation({
  part,
  activeDetail = "1",
  perspective = "historical",
}: SRElectronDerivationProps) {
  const id = `sr-electron-${part}-derivation`;
  const sections =
    part === "work"
      ? [{ title: "Accumulate work from rest", chain: srElectronWork }]
      : [
          {
            title: "Along the motion: the longitudinal coefficient",
            chain: srElectronLongitudinal,
          },
          { title: "Across the motion: the paper’s force convention", chain: srElectronTransverse },
          {
            title: "Later comparison: force and acceleration both in the laboratory",
            chain: srElectronLaboratory,
          },
        ];
  return (
    <section
      id={id}
      className="local-steps"
      aria-labelledby={`${id}-title`}
      data-argument-id={`arg-sr-electron-${part}`}
      data-review="draft"
      data-historical-status="source-order-reconstruction"
      data-model-status="prescribed-fields-without-self-force"
    >
      <h4 id={`${id}-title`}>
        {part === "work"
          ? "Follow the force through the work integral"
          : "Follow each force and acceleration back to its frame"}
      </h4>
      <p>
        The electron moves along the laboratory <i>x</i> axis at the event being compared. A prime
        marks the inertial frame moving with it at that instant. We write <i>m</i>, γ and <i>c</i>{" "}
        for the paper’s μ, β and <i>V</i>; γ = (1 − <i>v</i>²/<i>c</i>²)<sup>−1/2</sup>.
      </p>
      {part === "conventions" && (
        <table>
          <caption>What each response coefficient compares</caption>
          <thead>
            <tr>
              <th scope="col">Coefficient</th>
              <th scope="col">Force frame</th>
              <th scope="col">Acceleration frame</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Longitudinal: mγ³</th>
              <td>Laboratory, equal to comoving here</td>
              <td>Laboratory</td>
            </tr>
            <tr>
              <th scope="row">Printed transverse: mγ²</th>
              <td>Momentary rest frame</td>
              <td>Laboratory</td>
            </tr>
            <tr>
              <th scope="row">Later transverse comparison: mγ</th>
              <td>Laboratory</td>
              <td>Laboratory</td>
            </tr>
          </tbody>
        </table>
      )}
      {part === "work" && (
        <p>
          Start with the laboratory force acting over the laboratory displacement. The lower limit
          is rest, where accumulated work is zero. The model omits self-fields and radiation
          reaction; it does not determine an additive rest energy.
        </p>
      )}
      {sections.map(({ title, chain }) => (
        <section key={chain.id} aria-labelledby={`${chain.id}-title`}>
          <h5 id={`${chain.id}-title`}>{title}</h5>
          <DerivationChain
            chains={[srElectronDisplayChain(chain)]}
            activeDetail={activeDetail}
            perspective={perspective}
          />
        </section>
      ))}
      <details className="modern-margin" data-reading="3">
        <summary>Historical context and notation</summary>
        <p>{srElectronHistoricalReading.r3}</p>
        <p className="fine">
          <cite>{srElectronHistoricalReading.r3Citations[0]}</cite>
        </p>
      </details>
      <h5>Follow the printed argument</h5>
      {part === "conventions" ? (
        <ul>
          <li id="sr-electron-source-acceleration">
            <a href="/papers/special-relativity/view/german/#eq-s10-d3">
              §10: transformed equations of motion
            </a>
          </li>
          <li id="sr-electron-source-masses">
            <a href="/papers/special-relativity/view/german/#eq-s10-d5">
              §10, p. 919: longitudinal and transverse masses
            </a>
          </li>
          <li id="sr-electron-source-force-warning">
            <a href="/papers/special-relativity/view/german/#s10-p8">
              §10: the warning about alternative force and acceleration definitions
            </a>
          </li>
        </ul>
      ) : (
        <p id="sr-electron-source-work">
          <a href="/papers/special-relativity/view/german/#eq-s10-d8">
            §10, p. 920: work supplied from rest
          </a>
        </p>
      )}
      <p className="fine">
        <a href="/lab/sr-13/">
          Compare the force conventions, work and deflection in the electron laboratory
        </a>
      </p>
    </section>
  );
}
