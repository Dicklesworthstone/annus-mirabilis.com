"use client";

import { useId, useMemo, useState } from "react";
import {
  type PinnedMolecularObservations,
  pinMolecularObservations,
} from "../../../experiments/avogadro/identification.ts";
import { explainResult } from "../../../experiments/results/explanations.ts";
import { ResultStatusNote } from "../../../experiments/results/ResultStatusNote.tsx";
import type { ScientificResult } from "../../../experiments/results/types.ts";
import type { AcceptedSnapshot } from "../../../experiments/store/instanceStore.ts";
import { identifyMolecularDimensions } from "../../../physics/reference/molecularDimensions.ts";
import { display, unitText } from "../presentation.ts";
import styles from "./AvogadroLab.module.css";

function Reading({ result }: { result: ScientificResult }) {
  const explanation = result.status === "value" ? null : explainResult(result);
  return (
    <span data-identification-quantity={result.quantityId} data-result-status={result.status}>
      {result.status === "value" && typeof result.value === "number" ? (
        <>
          {display(result.value)} {unitText(result.unit)}
        </>
      ) : (
        <>
          {explanation?.message} {explanation?.nextAction}
        </>
      )}
    </span>
  );
}

/** Admitting information changes this local inference; it never changes the pinned observation. */
export function AvogadroIdentification({
  snapshot,
  sourceDigest,
  ready,
}: {
  snapshot: AcceptedSnapshot;
  sourceDigest: string;
  ready: boolean;
}) {
  const id = useId();
  const available = useMemo(
    () => pinMolecularObservations(snapshot, sourceDigest),
    [snapshot, sourceDigest],
  );
  const [pinned, setPinned] = useState<PinnedMolecularObservations | null>(null);
  const [viscosityAdmitted, setViscosityAdmitted] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const observations = pinned ?? (available.kind === "accepted" ? available.observations : null);
  const calculation = useMemo(
    () =>
      observations ? identifyMolecularDimensions(observations.inputs, viscosityAdmitted) : null,
    [observations, viscosityAdmitted],
  );
  const sourceChanged =
    pinned &&
    (pinned.source.instanceId !== snapshot.instanceId ||
      pinned.source.runId !== snapshot.runId ||
      pinned.source.snapshotVersion !== snapshot.snapshotVersion ||
      pinned.source.sourceDigest !== sourceDigest);

  function pin() {
    if (available.kind !== "accepted") return;
    setPinned(available.observations);
    setViscosityAdmitted(false);
    setAnnouncement(
      "Accepted solute observations pinned. Diffusion alone leaves a family; the viscosity observation is recorded but not yet admitted.",
    );
  }
  function changeAdmission() {
    if (!pinned) return;
    const next = !viscosityAdmitted;
    const result = identifyMolecularDimensions(pinned.inputs, next);
    setViscosityAdmitted(next);
    setAnnouncement(
      !next
        ? "Viscosity withheld again. The molecular number and radius are underdetermined; the pinned observations are unchanged."
        : result.molecularNumber.status === "value"
          ? "The same pinned viscosity observation is now admitted. One candidate satisfies both relations; the pinned observations are unchanged."
          : "The same pinned viscosity observation is now admitted, but it does not provide an admitted unique intersection. Read the model's explanation below.",
    );
  }

  return (
    <section
      id="identify-two-observations"
      aria-labelledby={`${id}-title`}
      data-avogadro-identification
      data-identification-pinned={Boolean(pinned)}
      data-viscosity-admitted={viscosityAdmitted}
    >
      <h3 id={`${id}-title`}>Which second observation identifies both unknowns?</h3>
      <p>
        Diffusion fixes a product of solute radius and molecular number. Many pairs fit it equally
        well. Pin the accepted solute observations, then decide whether to admit the separate
        viscosity observation. Both observations will stay fixed while you change what information
        the inference may use.
      </p>
      <div className="actions">
        <button
          type="button"
          className="secondary"
          onClick={pin}
          disabled={!ready || available.kind !== "accepted"}
        >
          {pinned
            ? "Replace with current accepted solute observations"
            : "Pin accepted solute observations"}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={changeAdmission}
          disabled={!ready || !pinned}
          aria-pressed={viscosityAdmitted}
        >
          {viscosityAdmitted
            ? "Withhold viscosity again"
            : "Admit the pinned viscosity observation"}
        </button>
      </div>
      <p role="status" aria-live="polite">
        {announcement}
      </p>
      {sourceChanged && (
        <p className="notice" data-identification-source-changed>
          The main laboratory has a newer accepted result. This inference still uses its pinned
          observations and admission choice. Replace them explicitly to begin with the new settings.
        </p>
      )}
      {available.kind !== "accepted" && <ResultStatusNote refusal={available.refusal} />}
      <noscript>
        <p>
          The worked diffusion family below is readable without JavaScript. Pinning and admitting
          the second observation require JavaScript.
        </p>
      </noscript>
      {observations && calculation && (
        <div
          data-identification-observation-version={observations.source.snapshotVersion}
          data-identification-run-id={observations.source.runId}
          data-identification-basis={observations.basis.setId}
        >
          <p className="eyebrow">
            {pinned
              ? "Pinned inference · host calculation"
              : "Worked family from the accepted settings"}
          </p>
          <p>
            <strong>{observations.basis.label}.</strong> {observations.basis.interpretation}
          </p>
          <p className="fine">
            {observations.basis.provenance} The solute observations are illustrative, not historical
            measurements. No confidence interval or experimentally established value is asserted
            here.
          </p>
          <details>
            <summary>
              Inspect the {pinned ? "pinned" : "accepted"} observations and assumptions
            </summary>
            <dl className={styles.observations}>
              <dt>Solute diffusivity</dt>
              <dd>{display(observations.inputs.diffusion)} m²/s</dd>
              <dt>Temperature</dt>
              <dd>{display(observations.inputs.temperature)} K</dd>
              <dt>Solvent viscosity</dt>
              <dd>{display(observations.inputs.viscosity)} Pa·s</dd>
              <dt>Gas constant</dt>
              <dd>{display(observations.inputs.gasConstant)} J/(mol·K)</dd>
              <dt>Recorded solute concentration</dt>
              <dd>{display(observations.inputs.molarConcentration)} mol/m³</dd>
              <dt>Recorded relative viscosity excess</dt>
              <dd>{display(observations.inputs.specificViscosity)}</dd>
              <dt>Coefficient of volume fraction</dt>
              <dd>{observations.inputs.viscosityCoefficient} (model assumption)</dd>
            </dl>
            <p>
              The solute radius is distinct from the tracer radius in the Brownian route. Neither
              radius nor a target molecular number is supplied to this inference. The dilute-sphere
              model admits at most 5% inferred volume fraction; that ceiling is not an accuracy
              guarantee.
            </p>
            <p className="fine">
              Accepted source revision {observations.source.snapshotVersion}; run{" "}
              <code>{observations.source.runId}</code>.{" "}
              {observations.source.sourceDigest && (
                <>
                  Source identity:{" "}
                  <code className={styles.sourceDigest}>{observations.source.sourceDigest}</code>.
                </>
              )}
            </p>
          </details>
          <div className={styles.panels} data-identification-conclusions>
            <section>
              <h4>Radius</h4>
              <Reading result={calculation.radius} />
            </section>
            <section>
              <h4>Molecular number</h4>
              <Reading result={calculation.molecularNumber} />
            </section>
          </div>
          <p>
            Diffusion constrains <var>N a</var>: <Reading result={calculation.diffusionProduct} />.
            {viscosityAdmitted && (
              <>
                {" "}
                The admitted viscosity relation constrains <var>N a³</var>:{" "}
                <Reading result={calculation.viscosityProduct} />.
              </>
            )}
          </p>
          <p>
            Doubling a candidate radius halves its diffusion-compatible molecular number. With
            viscosity admitted, the second relation instead divides the compatible number by eight.
            These different powers can select one intersection, rather than another copy of the same
            information.
          </p>
          <section
            className={styles.tableWrap}
            aria-label="Candidate molecular radii and independent constraints"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard access to the scrollable scientific comparison
            tabIndex={0}
          >
            <table>
              <caption>
                Candidate pairs under the same {pinned ? "pinned" : "accepted"} observations
              </caption>
              <thead>
                <tr>
                  <th scope="col">Candidate radius (nm)</th>
                  <th scope="col">Number fitting diffusion (mol⁻¹)</th>
                  {viscosityAdmitted && <th scope="col">Number fitting viscosity (mol⁻¹)</th>}
                  {viscosityAdmitted && (
                    <th scope="col">Viscosity residual for the diffusion pair</th>
                  )}
                  <th scope="col">Constraints met</th>
                </tr>
              </thead>
              <tbody>
                {calculation.candidates.map((candidate) => (
                  <tr
                    key={candidate.radius}
                    data-identification-candidate={candidate.radius}
                    data-satisfies-both={candidate.satisfiesBoth}
                  >
                    <th scope="row">
                      {display(candidate.radius * 1e9)}
                      {candidate.intersection && (
                        <small className={styles.route}>Intersection</small>
                      )}
                    </th>
                    <td>
                      <Reading result={candidate.diffusionNumber} />
                    </td>
                    {viscosityAdmitted && (
                      <td>
                        <Reading result={candidate.viscosityNumber} />
                      </td>
                    )}
                    {viscosityAdmitted && (
                      <td>
                        <Reading result={candidate.viscosityResidual} />
                      </td>
                    )}
                    <td>
                      {candidate.diffusionNumber.status !== "value"
                        ? "Outside the numerical range"
                        : candidate.satisfiesBoth
                          ? "Both relations"
                          : viscosityAdmitted
                            ? candidate.viscosityResidual.status === "value"
                              ? "Diffusion only"
                              : "Diffusion; viscosity test unavailable"
                            : "Diffusion; viscosity not admitted"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <p className="fine">
            The initial candidate radii are illustrative choices made independently of viscosity.
            Admitting viscosity adds the calculated intersection when the model supports one. The
            residual is (predicted viscosity excess − recorded excess) / recorded excess; zero means
            agreement. “Both relations” uses a relative numerical tolerance of 10⁻¹⁰, which does not
            represent experimental uncertainty. A candidate outside the dilute model retains its
            diffusion value, but the viscosity law cannot test it.
          </p>
        </div>
      )}
      <p>
        To compare a different coefficient at fixed observations, use the one-input study on this
        page. The historical dissertation datasets remain in preparation; this preview teaches the
        inverse question using explicitly illustrative observations.{" "}
        <a href="/lab/what-can-you-infer/">Return to the other inference cases</a>.
      </p>
    </section>
  );
}
