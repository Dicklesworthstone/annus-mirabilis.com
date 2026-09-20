import { kitchenInputBox } from "./uncertainty.ts";
import { allocateJointInputCoverage, cameraMolecularInputEnvelope } from "../../../physics/reference/inference/physicalUncertainty.ts";
import type { KitchenUncertainty } from "./definition.ts";
import { type ConstantSet, getConstantSet } from "../../../physics/reference/constants.ts";
import {
  disjointPairsKnownNoiseInterval,
  stationaryClickNoiseEstimate,
} from "../../../physics/reference/inference/observation.ts";
import {
  type Assessment,
  estimateIncrements,
  identifiabilityFamily,
  invertToMolecularNumber,
} from "../../../physics/reference/inference.ts";
import type { ScientificResult } from "../../results/types.ts";
import {
  KITCHEN_OUTPUTS,
  type KitchenAnalysis,
  type KitchenOptions,
  type KitchenTrack,
} from "./definition.ts";
import { KITCHEN_LIMITS, type KitchenDocument, type KitchenPoint } from "./schema.ts";

export type { KitchenAnalysis, KitchenOptions, KitchenTrack } from "./definition.ts";
export { KITCHEN_OPTIONS, KITCHEN_OUTPUTS } from "./definition.ts";
export function kitchenTracks(document: KitchenDocument): readonly KitchenTrack[] {
  const tracks = new Map<string, { key: string; label: string; indices: number[] }>(),
    segments = new Map<string, number>();
  document.points.forEach((p, i) => {
    if (p.kind !== "particle") return;
    let segment = segments.get(p.objectId) ?? 0;
    if (p.identityDecision === "new-object") {
      segment++;
      segments.set(p.objectId, segment);
    }
    const key = JSON.stringify([p.objectId, segment]);
    let track = tracks.get(key);
    if (!track) {
      track = {
        key,
        label: segment ? `${p.objectId} · new object ${segment + 1}` : p.objectId,
        indices: [],
      };
      tracks.set(key, track);
    }
    track.indices.push(i);
  });
  return Object.freeze(
    [...tracks.values()].map((t) => Object.freeze({ ...t, indices: Object.freeze(t.indices) })),
  );
}
function reason<T>(r: Assessment<T>): string {
  return r.kind === "no-value"
    ? r.reason
    : r.kind === "refused"
      ? String(r.refusal.details?.requirements ?? r.refusal.message)
      : r.kind === "outcome"
        ? r.outcome.message
        : "";
}
/** One calibrated coordinate at a time. No pooling across particles or unequal axis errors. */
export function analyzeKitchen(
  document: KitchenDocument,
  options: KitchenOptions,
): KitchenAnalysis {
  if (
    !options ||
    !["x", "y"].includes(options.axis) ||
    !Number.isFinite(options.coverage) ||
    options.coverage < 0.5 ||
    options.coverage > 0.999 ||
    !["metadata", "modern-si-2019", "scenario-gas-constant-measured"].includes(options.constantSet)
  )
    throw new TypeError(
      "Choose one coordinate, a registered constant set and coverage from 50% to 99.9%.",
    );
  const tracks = kitchenTracks(document),
    track = options.track ? tracks.find((t) => t.key === options.track) : tracks[0];
  if (!track)
    throw new TypeError(
      "Choose a particle track. Calibration marks and stationary features are not particle tracks.",
    );
  const m = document.metadata,
    points = track.indices
      .map((i) => document.points[i])
      .filter((p): p is KitchenPoint => p !== undefined),
    axis = options.axis;
  const warnings = [
      ...document.notes,
      "Stationary-feature and moving-particle localization errors are assumed to have the same variance; stationary clicks cannot establish that assumption.",
    ],
    intervalReasons: string[] = [];
  let scale: number | null = m[`pixels_per_um_${axis}`]
    ? 1e-6 / Number(m[`pixels_per_um_${axis}`])
    : null;
  let scaleSource: KitchenAnalysis["scaleSource"] = scale ? "measured" : "unknown";
  const other = axis === "x" ? "y" : "x";
  // A populated unmeasured axis is not silently promoted to an independent calibration.
  if (m.calibration_axes !== axis && m.calibration_axes !== "both") {
    scale =
      m.pixel_aspect_ratio && m[`pixels_per_um_${other}`]
        ? (1e-6 / Number(m[`pixels_per_um_${other}`])) *
          (axis === "y" ? Number(m.pixel_aspect_ratio) : 1 / Number(m.pixel_aspect_ratio))
        : null;
    scaleSource = scale ? "derived" : "unknown";
  }
  if (!scale)
    intervalReasons.push(
      "The scale along this axis is not established. Select the measured axis or declare the pixel aspect ratio.",
    );
  if (scaleSource === "derived")
    warnings.push(
      "This axis scale is derived from the measured axis and the declared pixel aspect ratio.",
    );
  if (m.calibration_axes === "both") {
    const ratio = Number(m.pixels_per_um_x) / Number(m.pixels_per_um_y);
    if (Math.abs(ratio - 1) > KITCHEN_LIMITS.anisotropy) {
      warnings.push(
        `The axis scales differ. Using one scale for both axes would multiply a pooled diffusivity by ${(1 + ratio * ratio) / 2}. This instrument analyzes one coordinate, not that pooled statistic.`,
      );
      if (
        !m.pixel_aspect_ratio ||
        Math.abs(Number(m.pixel_aspect_ratio) / ratio - 1) > KITCHEN_LIMITS.anisotropy
      )
        intervalReasons.push(
          "Confirm the pixel aspect ratio against the two axis scales before admitting an interval.",
        );
    }
  }
  const firstPoint = points[0];
  if (!firstPoint) throw new TypeError("Selected track has no points.");
  const dt = Number(m.declared_interval_s),
    tolerance = Math.max(1 / Number(m.frame_rate_hz), 0.02 * dt),
    origin = firstPoint.time;
  const slots = new Map<number, KitchenPoint>();
  let irregular = false,
    rounded = false;
  for (const p of points) {
    const tick = Math.round((p.time - origin) / dt),
      error = Math.abs(p.time - origin - tick * dt);
    if (error > tolerance || slots.has(tick)) irregular = true;
    if (error > 1e-9) rounded = true;
    if (!slots.has(tick)) slots.set(tick, p);
  }
  if (irregular)
    intervalReasons.push(
      "Irregular timing: actual timestamps do not support the declared equal-spacing model.",
    );
  else if (rounded)
    intervalReasons.push(
      "Timestamps are within the frame-rounding allowance but not equally spaced. A validated unequal-time camera interval is not available.",
    );
  if (m.timing_source === "declared-rate")
    warnings.push(
      "Timestamps are inferred from the declared frame rate. Per-frame presentation timing was not verified.",
    );
  const captured = points.filter(p => p.capture);
  if (captured.length) {
    warnings.push("Local video coordinates refer to the browser-oriented intrinsic image. Encoded orientation and pixel aspect were not independently verified; this tool applied no crop or additional rotation.");
    const adjusted = captured.filter(p => p.capture?.timingSource === "frame-callback-adjusted").length;
    if (adjusted) warnings.push(`${adjusted} annotated frames were farther than half a declared frame period from the requested time. Actual presentation times were retained, never replaced with requested times.`);
    let skipped = 0, lastCounter: number | null = null;
    for (const p of captured) {
      const counter = p.capture?.presentedFrames ?? null;
      if (counter !== null && lastCounter !== null) {
        skipped += Math.max(0, counter - lastCounter - 1);
        if (counter <= lastCounter) intervalReasons.push("Frame presentation counters are not increasing along this particle track; timing provenance cannot support an interval.");
      }
      lastCounter = counter;
    }
    if (skipped) {
      warnings.push(`The presentation counter passed ${skipped} additional frames between annotated particle frames. This is a compositor counter, not a count of every internally decoded frame.`);
      intervalReasons.push("Presentation-counter gaps were recorded. This acquisition preview withholds interval coverage; inspect the actual frame times and missing observations.");
    }
  }
  const calibrationIds = new Set(points.map((p) => p.calibrationId));
  if (calibrationIds.size !== 1)
    intervalReasons.push(
      "This track uses multiple calibration IDs, but the CSV supplies only one calibration record. Separate those segments before inference.",
    );
  const counts = {
    measured: 0,
    interpolated: 0,
    excluded: 0,
    lost: 0,
    attemptedPairs: 0,
    retainedPairs: 0,
    stationary: 0,
  };
  for (const p of points) counts[p.status]++;
  const lostPairs: Record<string, number> = Object.create(null),
    paired: number[] = [],
    pairTimes: number[] = [],
    increments: number[] = [];
  const lastPoint = points.at(-1);
  const lastTick = Math.round(((lastPoint?.time ?? origin) - origin) / dt);
  // Anchored slots, not adjacent rows: exclusions and gaps must not shift later pairing.
  for (let tick = 0; tick <= lastTick; tick += 2) {
    counts.attemptedPairs++;
    const a = slots.get(tick),
      b = slots.get(tick + 1);
    const defects = new Set<string>();
    for (const p of [a, b])
      if (!p) defects.add("missing-frame");
      else if (p.status !== "measured") defects.add(p.status === "lost" ? p.lossReason : p.status);
    if (a && b && (a.calibrationId !== b.calibrationId || b.identityDecision))
      defects.add("identity-or-calibration-gap");
    if (a && b && Math.abs(b.time - a.time - dt) > 1e-9) defects.add("irregular-timing");
    if (defects.size) {
      for (const r of defects) lostPairs[r] = (lostPairs[r] ?? 0) + 1;
      continue;
    }
    const aCoord = a?.[axis];
    const bCoord = b?.[axis];
    if (
      scale &&
      a &&
      b &&
      aCoord !== null &&
      aCoord !== undefined &&
      bCoord !== null &&
      bCoord !== undefined
    ) {
      paired.push(aCoord * scale, bCoord * scale);
      pairTimes.push(a.time, b.time);
      increments.push((bCoord - aCoord) * scale);
      counts.retainedPairs++;
    }
  }
  const edgeShare = (lostPairs.edge ?? 0) / counts.attemptedPairs;
  if (edgeShare > KITCHEN_LIMITS.edgeLossShare)
    intervalReasons.push(
      "More than 20% of attempted pairs have an edge loss; no interval is admitted.",
    );
  if (Object.keys(lostPairs).length)
    warnings.push(
      "Incomplete pairs are omitted without shifting later pairs. Selection, exclusions and edge losses can bias inference; intervals conditional on the retained data do not correct censoring.",
    );
  // Conservatively withhold a coverage claim when a reader selects the sample by exclusion.
  if (counts.excluded)
    intervalReasons.push(
      "Excluded observations may select on displacement. The estimate is shown, but this preview does not assign interval coverage after manual exclusions.",
    );
  if (edgeShare > 0 && edgeShare <= KITCHEN_LIMITS.edgeLossShare)
    warnings.push(
      "The retained-sample interval may be biased low by edge losses; nominal coverage is not a guarantee for censored tracks.",
    );
  const stationary = document.points.filter(
    (p) =>
      p.kind === "stationary" && p.status === "measured" && calibrationIds.has(p.calibrationId),
  );
  counts.stationary = stationary.length;
  const stationIds = new Set(stationary.map((p) => p.objectId));
  if (stationary.length < KITCHEN_LIMITS.stationaryClicks || stationIds.size !== 1)
    intervalReasons.push(
      "Localization error unknown: provide at least ten clicks on one stationary feature using this calibration.",
    );
  if (!m.exposure_s)
    intervalReasons.push(
      "Declare the exposure duration; a missing exposure is not an instantaneous camera.",
    );
  const results = new Map<string, ScientificResult>();
  const val = (id: keyof typeof KITCHEN_OUTPUTS, value: number | Float64Array) => {
    const c = KITCHEN_OUTPUTS[id];
    results.set(id, {
      quantityId: id,
      unit: c.unit,
      ownerId: c.ownerId,
      semanticKind: c.semanticKind,
      status: "value",
      value,
    });
  };
  const no = (
    id: keyof typeof KITCHEN_OUTPUTS,
    why: string,
    status: "underdetermined" | "not-applicable" = "not-applicable",
  ) => {
    const c = KITCHEN_OUTPUTS[id];
    results.set(id, {
      quantityId: id,
      unit: c.unit,
      ownerId: c.ownerId,
      semanticKind: c.semanticKind,
      ...(status === "underdetermined"
        ? {
            status,
            compatibleFamily: why,
            neededInformation: ["Supply the missing observations or independent physical inputs."],
          }
        : { status, reason: why }),
    });
  };
  val("pairCount", counts.retainedPairs);
  val("pairDegrees", Math.max(0, counts.retainedPairs - 1));
  val("pairs", Float64Array.from(paired));
  val("pairTimes", Float64Array.from(pairTimes));
  for (const id of Object.keys(KITCHEN_OUTPUTS) as (keyof typeof KITCHEN_OUTPUTS)[])
    if (!results.has(id))
      no(id, "This result needs admitted observations and declared inputs.", "underdetermined");
  const naive = estimateIncrements(
    Float64Array.from(increments),
    dt,
    1,
    "independent-increment-known-zero-drift",
  );
  if (naive.kind === "accepted") val("naiveD", naive.data.dHat);
  const currentScale = scale;
  const noise =
    currentScale && stationary.length >= KITCHEN_LIMITS.stationaryClicks && stationIds.size === 1
      ? stationaryClickNoiseEstimate(
          Float64Array.from(stationary, (p) => (p[axis] ?? 0) * currentScale),
          { d: 1 },
        )
      : null;
  if (noise?.kind === "accepted") val("noiseVariance", noise.data.sigma2);
  const pair =
    noise?.kind === "accepted" && m.exposure_s && counts.retainedPairs >= 2
      ? disjointPairsKnownNoiseInterval({
          positions: Float64Array.from(paired),
          dt,
          exposure: Number(m.exposure_s),
          d: 1,
          alpha: 1 - options.coverage,
          noise: { kind: "stationary-clicks", estimate: noise.data },
        })
      : null;
  if (pair?.kind === "accepted") val("correctedD", pair.data.estimate);
  const centered = estimateIncrements(Float64Array.from(increments), dt, 1, "drift-centered");
  if (centered.kind === "accepted") {
    const drift0 = centered.data.drift[0];
    if (drift0 !== undefined) val("drift", drift0);
  }
  if (counts.retainedPairs < 2)
    intervalReasons.push("At least two complete disjoint pairs are required after fitting drift.");
  if (pair && pair.kind !== "accepted") intervalReasons.push(reason(pair));
  if (pair?.kind === "accepted" && pair.data.empty)
    intervalReasons.push(
      "The physical confidence set is empty. Keep this outcome; do not replace it with a positive interval.",
    );
  const band = pair?.kind === "accepted" ? pair.data.interval : null;
  if (band && !intervalReasons.length)
    val("diffusionInterval", Float64Array.of(band.lower, band.upper));
  else
    no("diffusionInterval", intervalReasons.join(" ") || "A noise-aware interval is unavailable.");
  if (m.radius_um && m.radius_provenance !== "independent")
    warnings.push(
      "No molecular number is calculated without an explicit independent-radius declaration. A radius derived from these displacements would be circular.",
    );
  const constantSetId =
    options.constantSet === "metadata" ? m.constant_set_id : options.constantSet;
  let set: ConstantSet | null = null,
    numberMeaning: KitchenAnalysis["numberMeaning"] = "unavailable";
  try {
    set = getConstantSet(constantSetId);
  } catch {
    warnings.push(
      "The requested constant set is not registered. No historical constant or molecular number has been invented.",
    );
  }
  const dHat = pair?.kind === "accepted" ? pair.data.estimate : null;
  if (set && dHat !== null && dHat > 0 && m.temperature_k && m.viscosity_mpa_s) {
    const family = identifiabilityFamily(
      {
        D: dHat,
        T: Number(m.temperature_k),
        eta: Number(m.viscosity_mpa_s) * 0.001,
        radiusRange: [1e-8, 1e-5],
        synthetic: m.data_origin === "synthetic",
      },
      set,
    );
    if (family.kind === "accepted") {
      numberMeaning = family.data.semanticKind;
      val("radiusNumberProduct", family.data.product);
    }
    if (m.radius_um && m.radius_provenance === "independent" && band && !intervalReasons.length) {
      const inverse = invertToMolecularNumber(
        {
          dHat,
          T: Number(m.temperature_k),
          eta: Number(m.viscosity_mpa_s) * 0.001,
          a: Number(m.radius_um) * 1e-6,
          radiusProvenance: "independently-declared",
          interval: band,
          synthetic: m.data_origin === "synthetic",
        },
        set,
      );
      if (inverse.kind === "accepted") {
        val("molecularNumber", inverse.data.estimate);
        val(
          "molecularInterval",
          Float64Array.of(inverse.data.interval.lower, inverse.data.interval.upper),
        );
        if (inverse.data.consistencyRatio !== null)
          val("consistencyRatio", inverse.data.consistencyRatio);
        if (inverse.data.estimatedBoltzmannConstant !== null)
          val("estimatedBoltzmannConstant", inverse.data.estimatedBoltzmannConstant);
      } else {
        no("molecularNumber", reason(inverse));
        no("molecularInterval", reason(inverse));
      }
    } else {
      no(
        "molecularNumber",
        "Radius and molecular number are not separately identified by displacement. Declare the radius and its independent provenance, then obtain an admitted positive diffusion interval.",
        "underdetermined",
      );
      no(
        "molecularInterval",
        "A declared radius and an admitted, strictly positive diffusion interval are required.",
      );
    }
  }
  const inputCoverage = m.physical_input_coverage ? Number(m.physical_input_coverage) : null;
  let uncertainty: KitchenUncertainty = { state: "unavailable", scaleExponent: null,
    inputCoverage, cameraCoverage: null, combinedCoverage: null };
  let combinedIntervalReason = "No combined interval is reported: declare all physical input ranges, how the radius is calibrated, and a supported joint coverage for those inputs. Standard uncertainty and marginal ranges are not joint coverage.";
  const box = set && scale !== null ? kitchenInputBox(document, axis, scaleSource, scale, set) : null;
  const defects = intervalReasons.length > 0 || Object.keys(lostPairs).length > 0;
  if (box?.kind === "accepted" && set && band && !defects) {
    const envelope = cameraMolecularInputEnvelope(band, box.data, set, m.data_origin === "synthetic");
    if (envelope.kind === "accepted") {
      val("molecularInputRange", Float64Array.of(envelope.data.lower, envelope.data.upper));
      uncertainty = { ...uncertainty, state: "sensitivity", scaleExponent: envelope.data.scaleExponent };
      const budget = allocateJointInputCoverage(options.coverage, inputCoverage);
      if (budget.kind !== "accepted") combinedIntervalReason = reason(budget);
      else if (noise?.kind === "accepted" && m.exposure_s) {
        uncertainty = { ...uncertainty, cameraCoverage: budget.data.cameraCoverage };
        const combinedPairs = disjointPairsKnownNoiseInterval({ positions: Float64Array.from(paired),
          dt, exposure: Number(m.exposure_s), d: 1, alpha: budget.data.alphaCamera,
          noise: { kind: "stationary-clicks", estimate: noise.data } });
        if (combinedPairs.kind !== "accepted") combinedIntervalReason = reason(combinedPairs);
        else if (combinedPairs.data.interval === null) combinedIntervalReason = "The allocated camera confidence set is empty. No positive combined interval is substituted.";
        else {
          const allocated = combinedPairs.data.interval;
          val("combinedSamplingInterval", Float64Array.of(allocated.lower, allocated.upper));
          const combined = cameraMolecularInputEnvelope(allocated, box.data, set, m.data_origin === "synthetic");
          if (combined.kind !== "accepted") combinedIntervalReason = reason(combined);
          else {
            val("combinedMolecularInterval", Float64Array.of(combined.data.lower, combined.data.upper));
            uncertainty = { ...uncertainty, state: "combined", combinedCoverage: budget.data.coverageLowerBound };
            combinedIntervalReason = "Conservative combined coverage is conditional on the declared joint input-box coverage and the Gaussian camera model. No independence between input ranges is assumed, and the declaration is not independently verified.";
          }
        }
      }
    } else combinedIntervalReason = reason(envelope);
  } else if (defects) combinedIntervalReason = "No combined interval is reported for missing, lost, excluded or irregular observations. This procedure does not establish coverage after selection or censoring; inspect the retained-data estimates separately.";
  else if (box && box.kind !== "accepted") combinedIntervalReason = `No combined interval: ${reason(box)}`;
  for (const id of ["molecularInputRange", "combinedMolecularInterval", "combinedSamplingInterval"] as const)
    if (results.get(id)?.status !== "value") no(id, combinedIntervalReason);
  warnings.push(
    "The original diffusion and molecular-number intervals hold physical inputs fixed. The separately labeled input envelope propagates declared ranges; only a declared joint input coverage and a newly allocated camera interval can support combined coverage. Timing, exposure, model error and the applicability of stationary clicks remain conditional assumptions.",
  );
  return {
    uncertainty,
    options,
    tracks,
    selectedTrack: track.key,
    outputs: [...results.values()],
    warnings,
    intervalReasons,
    counts,
    lostPairs,
    scale,
    scaleSource,
    constantSetId,
    gasConstantProvenance: set?.gasConstantProvenance ?? "unavailable",
    numberMeaning,
    combinedIntervalReason,
  };
}
