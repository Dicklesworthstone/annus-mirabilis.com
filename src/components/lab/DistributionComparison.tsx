"use client";

import { useEffect, useId, useState } from "react";
import type { Bm06Parameters } from "../../experiments/bm06/definition.ts";
import {
  COMPARISON_AXES,
  projectDistributionComparison,
} from "../../experiments/bm06/distributionComparison.mjs";
import type { AcceptedSnapshot, ExperimentView } from "../../experiments/store/instanceStore.ts";
import { array, display, identity, result, scalar } from "./presentation.ts";

type RequestState = ExperimentView["status"] | "edited";
type DistributionSamples = Parameters<typeof projectDistributionComparison>[0];
type ProjectedDistribution = Extract<
  ReturnType<typeof projectDistributionComparison>,
  { kind: "comparison" }
>["held"];

const REQUEST_NOTICES: Readonly<Record<RequestState, string>> = {
  idle: "Both curves describe accepted settings.",
  accepted: "Both curves describe accepted settings.",
  edited:
    "The edited settings have not been applied. Both curves still show accepted calculations.",
  pending: "The requested calculation is pending. Both curves retain their last accepted values.",
  refused: "The requested settings were refused. Both curves retain their last accepted values.",
  paused: "The calculation is paused. Both curves retain their last accepted values.",
  unavailable:
    "The requested calculation is unavailable. Both curves retain their last accepted values.",
};

function samples(snapshot: AcceptedSnapshot): DistributionSamples | null {
  const positions = array(snapshot, "positionCoordinate1d").copy();
  const density = result(snapshot, "probabilityDensity");
  if (density.status === "analytic-limit" && density.representation.kind === "point-mass")
    return {
      kind: "point-mass",
      location: density.representation.location,
      extent: Math.max(...Array.from(positions, Math.abs)),
    };
  if (density.status !== "value" || typeof density.value === "number") return null;
  return {
    kind: "density",
    positions: Array.from(positions),
    values: Array.from(density.value.copy()),
  };
}

function Curve({
  curve,
  className,
  held = false,
}: {
  curve: ProjectedDistribution;
  className: string;
  held?: boolean;
}) {
  // All three shapes remain visible and distinguishable even without a matching theme selector.
  const drawing = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeDasharray: held ? "6 4" : undefined,
  };
  return curve.kind === "density" ? (
    <polyline
      className={className}
      points={curve.points.map((point) => point.join(",")).join(" ")}
      {...drawing}
    />
  ) : (
    <g>
      <line className={className} x1={curve.x} x2={curve.x} y1="210" y2="60" {...drawing} />
      <path
        className={className}
        d={`M${curve.x - 8},72 L${curve.x},60 L${curve.x + 8},72`}
        {...drawing}
      />
    </g>
  );
}

function comparisonRows(snapshot: AcceptedSnapshot) {
  const p = snapshot.parameters as Bm06Parameters;
  return [
    { label: "Elapsed time (s)", value: display(p.t) },
    { label: "Temperature (K)", value: display(p.T) },
    { label: "Viscosity (mPa·s)", value: display(p.eta, 1e3) },
    { label: "Sphere radius (μm)", value: display(p.a, 1e6) },
    {
      label: "Active diffusion coefficient (μm²/s)",
      value: display(scalar(snapshot, "activeDiffusionCoefficient"), 1e12),
    },
    { label: "RMS displacement (μm)", value: display(scalar(snapshot, "rmsDisplacement1d"), 1e6) },
    {
      label: "Selected interval (μm)",
      value: `[${display(p.lower, 1e6)}, ${display(p.upper, 1e6)}]`,
    },
    {
      label: "Probability in that interval",
      value: `${display(scalar(snapshot, "intervalProbability"), 100)}%`,
    },
    {
      label: "Diffusivity source",
      value:
        p.copiedDiffusivityValue > 0
          ? "Copied from an accepted tracer calculation"
          : "These physical inputs, with modern SI constants (2019)",
    },
    {
      label: "Distribution",
      value:
        result(snapshot, "probabilityDensity").status === "analytic-limit"
          ? "All probability at the starting point; no finite density"
          : "Unbounded point-start Gaussian density",
    },
  ];
}

/**
 * Holding an immutable accepted snapshot is a presentation action. No draft parameter,
 * worker, evaluator or new scientific owner is involved. The enclosing lab keys this
 * view by instance, so a retained curve can never migrate into another laboratory.
 */
export function DistributionComparison({
  snapshot,
  requestState,
}: {
  snapshot: AcceptedSnapshot;
  requestState: RequestState;
}) {
  const id = useId();
  const [held, setHeld] = useState<AcceptedSnapshot | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const currentSamples = samples(snapshot);
  const heldSamples = held ? samples(held) : null;
  const projection =
    heldSamples && currentSamples
      ? projectDistributionComparison(heldSamples, currentSamples)
      : null;
  const heldRows = held ? comparisonRows(held) : [];
  const currentRows = comparisonRows(snapshot);
  const sameCalculation =
    held !== null &&
    held.runId === snapshot.runId &&
    held.snapshotVersion === snapshot.snapshotVersion;
  const { left, right, top, bottom } = COMPARISON_AXES;
  return (
    <details
      className="distribution-comparison"
      data-distribution-comparison=""
      {...identity(snapshot)}
    >
      <summary>Hold a distribution and compare a change</summary>
      <p>
        Hold the accepted distribution, then change one setting and apply it. Both curves use
        the same displacement and density scales, so a wider spread remains visibly wider.
        Holding or clearing a curve does not run another calculation.
      </p>
      {ready && (
        <div className="actions">
          <button type="button" onClick={() => setHeld(snapshot)}>
            {held ? "Replace held distribution" : "Hold this accepted distribution"}
          </button>
          {held && (
            <button type="button" className="secondary" onClick={() => setHeld(null)}>
              Clear held distribution
            </button>
          )}
        </div>
      )}
      <noscript>
        <p className="fine">
          Comparing two calculations requires JavaScript. The complete accepted distribution
          and its values remain available above and below.
        </p>
      </noscript>
      {held && (
        <div
          data-held-run-id={held.runId}
          data-held-snapshot-version={held.snapshotVersion}
          data-comparison-request-state={requestState}
        >
          <p className="fine">{REQUEST_NOTICES[requestState]}</p>
          {sameCalculation && (
            <p className="fine">
              Both entries are the same accepted calculation. Change one setting and apply it
              to compare with the held result.
            </p>
          )}
          {projection?.kind === "comparison" ? (
            <figure className="plot">
              <svg
                viewBox="0 0 300 270"
                role="img"
                aria-labelledby={`${id}-title ${id}-description`}
              >
                <title id={`${id}-title`}>
                  Held and latest accepted distributions on shared axes
                </title>
                <desc id={`${id}-description`}>
                  The dashed line is the held distribution; the solid line is the latest accepted
                  distribution. Both use the same physical position and density scales.
                  {projection.held.kind === "point-mass" || projection.current.kind === "point-mass"
                    ? " An arrow marks a point distribution, not a finite density height."
                    : ""}
                  Their accepted settings and RMS spreads are compared in the table.
                </desc>
                <line className="axis" x1={left} x2={right} y1={bottom} y2={bottom} />
                <line className="axis" x1={left} x2={left} y1={top} y2={bottom} />
                <Curve curve={projection.held} className="comparison-curve" held />
                <Curve curve={projection.current} className="curve" />
                <text x={left} y="20">
                  {projection.peak === null ? "Point distributions" : "Density (per μm)"}
                </text>
                <text x={left} y="234" textAnchor="middle">
                  {display(-projection.extent, 1e6)}
                </text>
                <text x="158" y="234" textAnchor="middle">
                  0
                </text>
                <text x={right} y="234" textAnchor="middle">
                  {display(projection.extent, 1e6)}
                </text>
                <text x="158" y="259" textAnchor="middle">
                  Signed displacement (μm)
                </text>
              </svg>
              <figcaption>
                Held: dashed. Latest accepted: solid. Each finite curve retains its accepted
                samples out to four of its own RMS distances; an undrawn tail is not zero.
                {projection.peak !== null
                  ? ` The top of the shared density scale is ${display(projection.peak, 1e-6)} per μm.`
                  : " Both distributions are point masses, with no finite density height."}
              </figcaption>
            </figure>
          ) : (
            <p className="notice">
              {projection?.kind === "unavailable"
                ? projection.reason
                : "The distributions cannot be drawn together. Compare their accepted values below."}
            </p>
          )}
          <section
            className="table-scroll"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: the comparison region can overflow on a narrow screen and must remain keyboard-reachable.
            tabIndex={0}
            aria-label="Held and latest distribution values"
          >
            <table>
              <caption>Each curve's own accepted settings and readouts</caption>
              <thead>
                <tr>
                  <th scope="col">Quantity</th>
                  <th scope="col">Held (dashed)</th>
                  <th scope="col">Latest accepted (solid)</th>
                </tr>
              </thead>
              <tbody>
                {currentRows.map((row, index) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td>{heldRows[index]?.value}</td>
                    <td>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <p className="fine">
            The interval probability in each column refers to that column's own interval. These
            are two consequences of the stated diffusion model, not two sets of measured tracers.
          </p>
        </div>
      )}
    </details>
  );
}
