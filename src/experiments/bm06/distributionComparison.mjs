/**
 * Two already accepted distributions on one physical position and density scale.
 * This module only projects samples; it never evaluates a Gaussian, rescales a physical
 * distribution, interpolates samples, or changes either accepted calculation.
 *
 * @typedef {Readonly<{kind: "density", positions: readonly number[], values: readonly number[]}> |
 *   Readonly<{kind: "point-mass", location: number, extent: number}>} DistributionSamples
 * @typedef {Readonly<{kind: "density", points: readonly (readonly [number, number])[]}> |
 *   Readonly<{kind: "point-mass", x: number}>} ProjectedDistribution
 * @typedef {Readonly<{kind: "comparison", extent: number, peak: number | null,
 *   held: ProjectedDistribution, current: ProjectedDistribution}> |
 *   Readonly<{kind: "unavailable", reason: string}>} DistributionComparison
 */

export const COMPARISON_AXES = Object.freeze({ left: 38, right: 278, top: 40, bottom: 210 });

/** @param {DistributionSamples} samples */
function valid(samples) {
  if (samples.kind === "point-mass")
    return (
      Number.isFinite(samples.location) &&
      Number.isFinite(samples.extent) &&
      samples.extent > 0
    );
  return (
    samples.positions.length >= 2 &&
    samples.positions.length <= 4097 &&
    samples.values.length === samples.positions.length &&
    samples.positions.every(
      (x, i) => Number.isFinite(x) && (i === 0 || x > samples.positions[i - 1]),
    ) &&
    samples.values.every((value) => Number.isFinite(value) && value >= 0) &&
    samples.values.some((value) => value > 0)
  );
}

/**
 * Point-mass display extents do not widen a finite curve's physical axis. A zero-time
 * distribution is an atom at its published location, never a zero or infinite density.
 * Normalizing position by extent before adding avoids overflow in (x - min)/(max - min).
 *
 * @param {DistributionSamples} held
 * @param {DistributionSamples} current
 * @returns {DistributionComparison}
 */
export function projectDistributionComparison(held, current) {
  /** @type {DistributionComparison} */
  const unavailable = {
    kind: "unavailable",
    reason:
      "These samples cannot be drawn on finite shared axes. Their accepted values remain in the table.",
  };
  if (!valid(held) || !valid(current)) return unavailable;
  const distributions = [held, current];
  const finiteCurves = distributions.filter((samples) => samples.kind === "density");
  const extents = distributions.flatMap((samples) =>
    samples.kind === "density"
      ? samples.positions.map(Math.abs)
      : [Math.abs(samples.location), ...(finiteCurves.length === 0 ? [samples.extent] : [])],
  );
  const extent = Math.max(...extents);
  if (!(extent > 0) || !Number.isFinite(extent)) return unavailable;
  const densityMaximum = finiteCurves.length
    ? Math.max(...finiteCurves.flatMap((samples) => samples.values))
    : 1;
  const peak = finiteCurves.length ? densityMaximum : null;
  const { left, right, top, bottom } = COMPARISON_AXES;
  const px = (x) => left + ((x / extent + 1) / 2) * (right - left);
  /**
   * @param {DistributionSamples} samples
   * @returns {ProjectedDistribution}
   */
  const project = (samples) =>
    samples.kind === "point-mass"
      ? { kind: "point-mass", x: px(samples.location) }
      : {
          kind: "density",
          points: samples.positions.map((x, i) => [
            px(x),
            bottom - (samples.values[i] / densityMaximum) * (bottom - top),
          ]),
        };
  return { kind: "comparison", extent, peak, held: project(held), current: project(current) };
}
