/**
 * printFigure.ts
 *
 * Maintains and renders the printable static figure for interactive instruments (am-plat-print-3orn).
 *
 * Requirements:
 * 1. Each mounted instrument keeps a hidden print figure ([data-print-figure]).
 * 2. Updates on snapshot acceptance and beforeprint, without side effects (never restarts
 *    a run, publishes a snapshot, or consumes PRNG draws).
 * 3. The caption carries: instrumentId, question, key parameters with units, constants,
 *    seed and streamVersion (where present), runId, snapshotVersion, executionLabel,
 *    and the explicit phrase "static representation of an interactive state".
 * 4. The 5-field RepresentationScale is rendered in ordinary language beside the caption.
 *    Default cases (factor: 1, represents: "none", kind: "none") are printed explicitly.
 *    Magnification factor never scales or modifies the caption's physical values.
 * 5. Pending, refused, or unavailable states print static worked examples with label and reason.
 *    A pending state is NEVER captioned as accepted.
 *
 * Spec: AGENTS.md §6.2, §15.4, §15.5 and am-plat-print-3orn
 */

import type { AcceptedSnapshot, ExperimentView } from "../../experiments/store/instanceStore.ts";
import {
  formatSpatialMagnification,
  getScaleFactRows,
  type ScaleFactRow,
  validateRepresentationScale,
} from "../../visuals/kit/scale.ts";
import type { RepresentationScale, SpatialMagnification } from "../../visuals/kit/types.ts";

export interface PrintFigureProps {
  readonly instrumentId: string;
  readonly question: string;
  readonly snapshot?: AcceptedSnapshot | null | undefined;
  readonly scale?: RepresentationScale | undefined;
  readonly constants?: Readonly<Record<string, string | number>> | undefined;
  readonly parameters?: Readonly<Record<string, string | number | boolean>> | undefined;
  readonly seed?: number | string | undefined;
  readonly streamVersion?: number | string | undefined;
  readonly executionLabel?: string | undefined;
  readonly status?: ExperimentView["status"] | undefined;
  readonly refusalReason?: string | undefined;
  readonly fallbackWorkedExample?:
    | {
        readonly label: string;
        readonly reason: string;
        readonly svgContent?: string | undefined;
      }
    | undefined;
  readonly displacementValue?: string | number | undefined;
  readonly svgContent?: string | undefined;
}

export interface RenderedPrintFigure {
  readonly html: string;
  readonly isAccepted: boolean;
  readonly scaleFactRows?: readonly ScaleFactRow[] | undefined;
}

/**
 * Formats spatial magnification in ordinary descriptive language for print figures.
 */
export function formatOrdinarySpatialMagnification(mag: SpatialMagnification): string {
  if (mag.factor === 1) {
    return mag.appliesTo === "scene"
      ? "1:1 scene scale (unmagnified)"
      : `${mag.appliesTo} readout at 1:1`;
  }
  if (mag.appliesTo === "displacement") {
    if (mag.factor === 1e17) {
      return "the displacement is drawn one hundred thousand million million times larger than life";
    }
    if (mag.factor === 1e15) {
      return "the displacement is drawn one thousand million million times larger than life";
    }
    if (mag.factor === 1e20) {
      return "the displacement is drawn one hundred million million million times larger than life";
    }
    return `the displacement is drawn ${formatSpatialMagnification(mag)} larger than life`;
  }
  return formatSpatialMagnification(mag);
}

/**
 * Validates that all 5 representation scale facts are present and properly formatted.
 * Throws with the view ID and missing field if incomplete.
 */
export function auditPrintRepresentationScale(
  viewId: string,
  scale: RepresentationScale | undefined,
): readonly ScaleFactRow[] {
  if (!scale) {
    throw new Error(`Audit failure for view "${viewId}": missing required RepresentationScale`);
  }
  try {
    validateRepresentationScale(scale);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Audit failure for view "${viewId}": ${msg}`);
  }

  // Check all 5 facts
  if (!scale.spatialMagnification) {
    throw new Error(`Audit failure for view "${viewId}": missing spatialMagnification`);
  }
  if (!scale.simulatedElapsedTime) {
    throw new Error(`Audit failure for view "${viewId}": missing simulatedElapsedTime`);
  }
  if (typeof scale.playbackMultiplier !== "number") {
    throw new Error(`Audit failure for view "${viewId}": missing playbackMultiplier`);
  }
  if (!scale.glyphSize) {
    throw new Error(`Audit failure for view "${viewId}": missing glyphSize`);
  }
  if (!scale.quantityNormalization) {
    throw new Error(`Audit failure for view "${viewId}": missing quantityNormalization`);
  }

  return getScaleFactRows(scale);
}

/**
 * Renders the static print figure markup with caption, parameters, and scale table.
 */
export function renderPrintFigure(props: PrintFigureProps): RenderedPrintFigure {
  const isAccepted = Boolean(
    props.snapshot && (props.status === "accepted" || (!props.status && props.snapshot)),
  );

  // 1. Fallback for non-accepted states (pending, refused, unavailable, idle)
  if (!isAccepted || !props.snapshot) {
    const fallback = props.fallbackWorkedExample || {
      label: "Static worked example",
      reason:
        props.refusalReason ||
        (props.status === "pending"
          ? "Simulation pending"
          : props.status === "refused"
            ? "Simulation refused"
            : props.status === "unavailable"
              ? "Simulation unavailable in this environment"
              : "No accepted simulation run"),
    };

    const workedSvg =
      fallback.svgContent || props.svgContent || '<div class="print-worked-placeholder"></div>';

    const html = `
<div class="print-figure-container" data-print-figure="true" data-instrument-id="${props.instrumentId}" data-status="${props.status || "unaccepted"}">
  <div class="print-worked-example" data-print-worked-example="true">
    ${workedSvg}
  </div>
  <figcaption class="print-caption" data-print-caption="true">
    <p class="print-caption-title"><strong>${props.instrumentId}</strong>: ${props.question}</p>
    <p class="print-status-note"><strong>${fallback.label}</strong>: ${fallback.reason}</p>
    <p class="print-disclaimer"><em>static representation of an interactive state</em></p>
  </figcaption>
</div>`.trim();

    return { html, isAccepted: false };
  }

  // 2. Accepted state rendering
  const snapshot = props.snapshot;
  let scaleRows: readonly ScaleFactRow[] | undefined;
  if (props.scale) {
    scaleRows = auditPrintRepresentationScale(props.instrumentId, props.scale);
  }

  const figureSvg = props.svgContent || '<div class="print-svg-placeholder"></div>';

  // Build parameters list
  const paramEntries: string[] = [];
  if (props.parameters) {
    for (const [k, v] of Object.entries(props.parameters)) {
      paramEntries.push(`${k}=${v}`);
    }
  }

  // Build constants list
  const constEntries: string[] = [];
  if (props.constants) {
    for (const [k, v] of Object.entries(props.constants)) {
      constEntries.push(`${k}=${v}`);
    }
  }

  // Build scale facts table
  let scaleTableHtml = "";
  if (props.scale && scaleRows) {
    const scaleObj = props.scale;
    const rowsHtml = scaleRows
      .map(
        (r) => `
      <tr>
        <th scope="row">${r.label}</th>
        <td>${r.key === "spatialMagnification" ? formatOrdinarySpatialMagnification(scaleObj.spatialMagnification) : r.value}</td>
      </tr>`,
      )
      .join("");

    scaleTableHtml = `
    <table class="print-scale-facts-table" data-print-scale-facts="true" aria-label="Representation scale facts for ${props.instrumentId}">
      <tbody>${rowsHtml}
      </tbody>
    </table>`;
  }

  // Displacement value line (guaranteed never multiplied by magnification factor)
  let displacementLine = "";
  if (props.displacementValue !== undefined) {
    displacementLine = `<p class="print-displacement-value">Displacement: <code>${props.displacementValue}</code></p>`;
  }

  const html = `
<div class="print-figure-container" data-print-figure="true" data-instrument-id="${props.instrumentId}" data-run-id="${snapshot.runId}" data-snapshot-version="${snapshot.snapshotVersion}">
  <div class="print-figure-visual">
    ${figureSvg}
  </div>
  <figcaption class="print-caption" data-print-caption="true">
    <p class="print-caption-title"><strong>${props.instrumentId}</strong>: ${props.question}</p>
    <div class="print-meta-grid">
      <p class="print-params">Parameters: ${paramEntries.length > 0 ? paramEntries.join(", ") : "default"}</p>
      ${constEntries.length > 0 ? `<p class="print-constants">Constants: ${constEntries.join(", ")}</p>` : ""}
      ${props.seed !== undefined ? `<p class="print-seed">Seed: ${props.seed}${props.streamVersion !== undefined ? ` (stream v${props.streamVersion})` : ""}</p>` : ""}
      <p class="print-run-info">Run ID: <code>${snapshot.runId}</code> · Snapshot v${snapshot.snapshotVersion} · ${props.executionLabel || "accepted"}</p>
    </div>
    ${displacementLine}
    ${scaleTableHtml}
    <p class="print-disclaimer"><em>static representation of an interactive state</em></p>
  </figcaption>
</div>`.trim();

  return { html, isAccepted: true, scaleFactRows: scaleRows };
}
