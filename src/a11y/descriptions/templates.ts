/**
 * Template engine for Layer 2 accessible graph descriptions (am-a11y-graph-descriptions-vxe1).
 *
 * Rules:
 * 1. Declarative strings with typed slots: {quantityId}, {statistic}, {status}, and representation-scale facts.
 * 2. Numbers are formatted with declared precision and spoken forms; floating noise is suppressed.
 * 3. Typed statuses (including BM-06 analytic-limit at t = 0) render as ordinary language with NO enum names.
 * 4. Build-time and instantiation-time validation rejects template slots that reference fields missing from the snapshot.
 * 5. RepresentationScale facts are rendered in ordinary language, with default cases stated rather than omitted.
 */

import { explainResult } from "../../experiments/results/explanations.ts";
import type { ScientificResult } from "../../experiments/results/types.ts";
import { formatCleanNumber, formatQuantityValue } from "../../units/format.ts";
import { spokenQuantity } from "../../units/spoken.ts";
import {
  formatPlaybackRate,
  formatSpatialMagnification,
  getScaleFactRows,
} from "../../visuals/kit/scale.ts";
import type { RepresentationScale } from "../../visuals/kit/types.ts";

export interface TemplateData {
  readonly results?: readonly ScientificResult[] | undefined;
  readonly quantities?: Readonly<Record<string, number | ScientificResult>> | undefined;
  readonly statistics?: Readonly<Record<string, number | string>> | undefined;
  readonly scale?: RepresentationScale | undefined;
  readonly constantSetLabel?: string | undefined;
  readonly statusOverride?: string | undefined;
  readonly units?: Readonly<Record<string, string>> | undefined;
}

export class TemplateValidationError extends Error {
  readonly missingSlot: string;
  constructor(missingSlot: string, message: string) {
    super(`Template validation error: ${message}`);
    this.name = "TemplateValidationError";
    this.missingSlot = missingSlot;
  }
}

/** The five contractual representation-scale slot names. */
export const REPRESENTATION_SCALE_SLOTS = [
  "spatialMagnification",
  "simulatedElapsedTime",
  "playbackMultiplier",
  "glyphSize",
  "quantityNormalization",
] as const;

/**
 * Validates that all slots referenced in a template string exist in the declared available fields.
 */
export function validateTemplate(
  template: string,
  availableQuantityIds: readonly string[],
  options: { requireScaleSlots?: boolean; availableScale?: boolean } = {},
): void {
  const slotMatches = template.match(/\{([a-zA-Z0-9_.-]+)\}/g) || [];
  const slotNames = slotMatches.map((m) => m.slice(1, -1));

  const availableSet = new Set<string>([
    ...availableQuantityIds,
    "status",
    "constantSet",
    "scaleSummary",
  ]);

  if (options.availableScale) {
    for (const slot of REPRESENTATION_SCALE_SLOTS) {
      availableSet.add(slot);
    }
  }

  for (const slot of slotNames) {
    if (!availableSet.has(slot)) {
      throw new TemplateValidationError(
        slot,
        `Template references slot "{${slot}}" which is not available in the declared snapshot fields.`,
      );
    }
  }

  if (options.requireScaleSlots) {
    for (const scaleSlot of REPRESENTATION_SCALE_SLOTS) {
      if (!slotNames.includes(scaleSlot)) {
        throw new TemplateValidationError(
          scaleSlot,
          `Template omits required representation-scale slot "{${scaleSlot}}".`,
        );
      }
    }
  }
}

/**
 * Renders RepresentationScale facts as accessible ordinary-language phrases.
 */
export function formatScaleFact(
  slot: (typeof REPRESENTATION_SCALE_SLOTS)[number],
  scale: RepresentationScale,
): string {
  switch (slot) {
    case "spatialMagnification": {
      return formatSpatialMagnification(scale.spatialMagnification);
    }
    case "simulatedElapsedTime": {
      const timeVal = formatCleanNumber(scale.simulatedElapsedTime.value);
      return `this frame shows ${spokenQuantity(timeVal, scale.simulatedElapsedTime.unit)} of model time`;
    }
    case "playbackMultiplier": {
      return formatPlaybackRate(scale.playbackMultiplier);
    }
    case "glyphSize": {
      if (scale.glyphSize.represents === "none") {
        return `${scale.glyphSize.drawnPx} px marker (uncalibrated marker, not a physical particle size)`;
      }
      return `${scale.glyphSize.drawnPx} px calibrated to ${scale.glyphSize.represents}`;
    }
    case "quantityNormalization": {
      if (scale.quantityNormalization.kind === "none") {
        return "unnormalized counts/values";
      }
      if (scale.quantityNormalization.kind === "per-bin-width") {
        return "counts per bin width";
      }
      return scale.quantityNormalization.kind.replace(/-/g, " ");
    }
  }
}

/**
 * Fills a declarative template with accepted snapshot values and scale facts.
 */
export function fillTemplate(template: string, data: TemplateData): string {
  // Build a lookup map of quantity values and units
  const valueMap = new Map<string, string>();

  // Add scale facts if scale is present
  if (data.scale) {
    for (const slot of REPRESENTATION_SCALE_SLOTS) {
      valueMap.set(slot, formatScaleFact(slot, data.scale));
    }
    const scaleRows = getScaleFactRows(data.scale);
    const summaryStr = scaleRows.map((r) => `${r.label}: ${r.value}`).join("; ");
    valueMap.set("scaleSummary", summaryStr);
  }

  // Add constantSet
  if (data.constantSetLabel) {
    valueMap.set("constantSet", data.constantSetLabel);
  }

  // Populate quantities
  if (data.quantities) {
    for (const [key, val] of Object.entries(data.quantities)) {
      if (typeof val === "number") {
        const unit = data.units?.[key] ?? "";
        valueMap.set(key, formatQuantityValue(val, unit));
      } else if (val && typeof val === "object" && "status" in val) {
        if (val.status === "value") {
          const num = typeof val.value === "number" ? val.value : 0;
          valueMap.set(key, formatQuantityValue(num, val.unit));
        } else {
          const expl = explainResult(val);
          valueMap.set(key, expl.message);
        }
      }
    }
  }

  // Populate scientific results
  if (data.results) {
    for (const res of data.results) {
      if (res.status === "value") {
        const num = typeof res.value === "number" ? res.value : 0;
        valueMap.set(res.quantityId, formatQuantityValue(num, res.unit));
      } else {
        const expl = explainResult(res);
        valueMap.set(res.quantityId, expl.message);
        if (!valueMap.has("status")) {
          valueMap.set("status", expl.message);
        }
      }
    }
  }

  // Populate statistics
  if (data.statistics) {
    for (const [key, val] of Object.entries(data.statistics)) {
      valueMap.set(key, typeof val === "number" ? formatCleanNumber(val) : String(val));
    }
  }

  // Set default status if not set
  if (!valueMap.has("status")) {
    valueMap.set("status", data.statusOverride ?? "Value calculated normally.");
  }

  // Replace all {slot} references
  return template.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (match, slot) => {
    return valueMap.get(slot) ?? match;
  });
}

export class ScaleAuditError extends Error {
  readonly viewId: string;
  readonly missingField: string;
  constructor(viewId: string, missingField: string, message: string) {
    super(
      `Accessible scale audit failed for view "${viewId}": missing fact "${missingField}". ${message}`,
    );
    this.name = "ScaleAuditError";
    this.viewId = viewId;
    this.missingField = missingField;
  }
}

/**
 * Audits that all 5 RepresentationScale facts are present in the rendered accessible surface.
 * Throws ScaleAuditError naming the viewId and missing field if any fact is omitted.
 */
export function auditAccessibleScaleFacts(
  renderedSurfaceText: string,
  scale: RepresentationScale,
  viewId: string,
): void {
  const rows = getScaleFactRows(scale);
  for (const row of rows) {
    if (!renderedSurfaceText.includes(row.label) && !renderedSurfaceText.includes(row.value)) {
      throw new ScaleAuditError(
        viewId,
        row.key,
        `Expected rendered surface to contain scale fact "${row.label}" or "${row.value}".`,
      );
    }
  }
}
