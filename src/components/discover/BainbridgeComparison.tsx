"use client";

import { useId, useState } from "react";
import {
  BAINBRIDGE_1933_DATASET_ID,
  BAINBRIDGE_REACTIONS,
  type BainbridgeReactionId,
  type BainbridgeRecord,
  compareBainbridgeReaction,
} from "../../experiments/me03/bainbridge.ts";
import { fixed } from "../lab/presentation.ts";

/** Inspect fixed historical observations; selecting a reaction never changes a measurement. */
export function BainbridgeComparison({ record }: { record: BainbridgeRecord }) {
  const id = useId();
  const [selected, setSelected] = useState<BainbridgeReactionId>("lithium-7-proton");
  const comparison = compareBainbridgeReaction(record, selected);

  return (
    <section
      data-world-check-measurement={record.kind}
      data-historical-dataset={BAINBRIDGE_1933_DATASET_ID}
      data-comparison-kind={comparison.kind === "available" ? "measured-fact" : undefined}
      aria-labelledby={`${id}-heading`}
    >
      <h3 id={`${id}-heading`}>Compare the released energy with the missing mass</h3>
      {record.kind === "withheld" ? (
        <p>{record.reason}</p>
      ) : (
        <>
          <p className="eyebrow">{record.evidenceLabel}</p>
          <p>
            Bainbridge put two kinds of evidence beside one another: energy estimates from
            nuclear-disintegration observations, and mass differences from separate
            mass-spectrograph measurements. His 1933 letter reports one agreement and one
            unsatisfactory comparison. These fixed observations are separate from the adjustable
            boundary ledger above.
          </p>
          <table>
            <caption>
              Two reactions on p. 123. Every mass uses the source&rsquo;s oxygen-16 scale.
            </caption>
            <thead>
              <tr>
                <th scope="col">Reported reaction</th>
                <th scope="col">Energy gain (MeV)</th>
                <th scope="col">Reported energy-equivalent mass</th>
                <th scope="col">Independent mass difference ± quoted error</th>
              </tr>
            </thead>
            <tbody>
              {record.reactions.map((reaction) => (
                <tr key={reaction.id} data-bainbridge-reaction={reaction.id}>
                  <th scope="row">{reaction.label}</th>
                  <td>{reaction.energyGainMeV}</td>
                  <td data-bainbridge-equivalent>{fixed(reaction.reportedMassEquivalent, 4)}</td>
                  <td data-bainbridge-observed>
                    {fixed(reaction.measuredMassDefect, 4)} ± {fixed(reaction.quotedMassError, 4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="fine">
            The mass equivalent is Bainbridge&rsquo;s conditional calculation using ΔE = c²Δm; it is
            not another measured mass. Oxygen-16 has mass 16 on this historical scale. These figures
            are not modern unified atomic mass units, and no conversion to that scale is made here.
          </p>
          <fieldset>
            <legend>Inspect a reported reaction</legend>
            {BAINBRIDGE_REACTIONS.map((reaction) => (
              <label key={reaction.id}>
                <input
                  type="radio"
                  name={`${id}-reaction`}
                  value={reaction.id}
                  checked={selected === reaction.id}
                  onChange={() => setSelected(reaction.id)}
                />{" "}
                {reaction.label}
              </label>
            ))}
          </fieldset>
          {comparison.kind === "available" ? (
            <div aria-live="polite" aria-atomic="true" data-bainbridge-inspection={selected}>
              <h4>{comparison.reaction.label}</h4>
              <dl>
                <div>
                  <dt>Measured mass difference minus reported mass equivalent</dt>
                  <dd data-bainbridge-discrepancy>
                    {fixed(comparison.measuredMinusEquivalent, 4)} oxygen-16 mass units
                  </dd>
                </div>
                <div>
                  <dt>Measured mass difference with its quoted ± error</dt>
                  <dd>
                    {fixed(comparison.quotedMassRange.lower, 4)} to{" "}
                    {fixed(comparison.quotedMassRange.upper, 4)} oxygen-16 mass units
                  </dd>
                </div>
                <div>
                  <dt>Absolute discrepancy divided by the quoted mass error</dt>
                  <dd data-bainbridge-error-ratio>
                    {fixed(comparison.differenceInQuotedMassErrors, 3)}
                  </dd>
                </div>
              </dl>
              <p
                data-bainbridge-mass-range={comparison.withinQuotedMassRange ? "inside" : "outside"}
              >
                The reported mass equivalent lies{" "}
                {comparison.withinQuotedMassRange ? "inside" : "outside"} the range formed from the
                measured mass difference and its quoted error. This range is not assigned a modern
                confidence level.
              </p>
              <p>{comparison.reaction.sourceDescription}</p>
              <p>
                {selected === "lithium-7-proton"
                  ? "Bainbridge described this agreement as within the probable error of the measurements. It supports the relation for this reaction at the accuracy reported."
                  : "Bainbridge found this comparison unsatisfactory. He said a stricter comparison had to await the probable error in determining the alpha-particle ranges. A discrepancy alone cannot decide which reaction assumption or measurement is responsible."}
              </p>
              <p>{comparison.reaction.energyUncertainty.reason}</p>
              <p data-bainbridge-statistical-status={comparison.statisticalAgreement.status}>
                {comparison.statisticalAgreement.reason}
              </p>
            </div>
          ) : (
            <p>{comparison.reason}</p>
          )}
          <details>
            <summary>What this comparison tests, and what it leaves open</summary>
            <p>
              The test asks whether energy released in a specified nuclear reaction corresponds to a
              mass difference measured independently. It does not repeat Einstein&rsquo;s 1905
              light-emission thought experiment or establish every assumption of his derivation. The
              positive mass defect here means reactant mass minus product mass; the ledger above
              uses a signed change inside a chosen boundary.
            </p>
            <p>{record.uncertainty}</p>
            <p>
              Both rows remain visible because an unresolved comparison is evidence to examine, too.
              They are different reactions and are not pooled into a fit.
            </p>
          </details>
          <p>
            <a href={record.sourcePageImage}>Read both comparisons on the original page</a>
            {" · "}
            <a href="https://doi.org/10.1103/PhysRev.44.123.2">Publication and citation</a>
          </p>
        </>
      )}
      <p className="fine">{record.citation}</p>
    </section>
  );
}
