/**
 * Compiler validation for WeavePredicate records (am-read-result-weave-jex). Raw (possibly
 * manifest-YAML-sourced) input in, a typed WeavePredicate out, or a WeaveValidationError naming
 * one of the bead's registered rule ids.
 */
import {
  BOUND_FAMILIES,
  WEAVE_MEANINGS,
  type SnapshotOutput,
  type WeaveCondition,
  type WeaveMeaning,
  type WeavePredicate,
} from "./types.ts";

export class WeaveValidationError extends Error {
  readonly rule: string;
  readonly predicateId: string | undefined;
  readonly instrumentId: string | undefined;

  constructor(rule: string, message: string, predicateId?: string, instrumentId?: string) {
    super(`[weave:${rule}] ${message}`);
    this.name = "WeaveValidationError";
    this.rule = rule;
    this.predicateId = predicateId;
    this.instrumentId = instrumentId;
  }
}

export type WeaveValidationContext = Readonly<{
  /** The instrument's declared output ids (an agreement/threshold/owner-band condition's
   * quantity ids must all resolve here). */
  instrumentOutputIds: ReadonlySet<string>;
  /** Content sentence ids this predicate's targets may name. */
  resolvableTargetIds: ReadonlySet<string>;
}>;

function fail(rule: string, message: string, predicateId?: string, instrumentId?: string): never {
  throw new WeaveValidationError(rule, message, predicateId, instrumentId);
}

function validateCondition(
  raw: unknown,
  ctx: WeaveValidationContext,
  predicateId: string,
  instrumentId: string,
): WeaveCondition {
  if (!raw || typeof raw !== "object") fail("weave-condition-invalid", "A condition must be an object.", predicateId, instrumentId);
  const o = raw as Record<string, unknown>;
  const requireOutput = (quantityId: unknown, field: string): string => {
    if (typeof quantityId !== "string" || !quantityId.trim())
      fail("weave-condition-invalid", `${field} is required.`, predicateId, instrumentId);
    if (!ctx.instrumentOutputIds.has(quantityId as string))
      fail(
        "weave-condition-quantity-not-output",
        `Condition ${field} "${quantityId}" is not a declared output of instrument "${instrumentId}".`,
        predicateId,
        instrumentId,
      );
    return quantityId as string;
  };

  switch (o.kind) {
    case "threshold": {
      const quantityId = requireOutput(o.quantityId, "quantityId");
      if (o.direction !== "at-least" && o.direction !== "at-most")
        fail("weave-condition-invalid", "threshold.direction must be at-least or at-most.", predicateId, instrumentId);
      if (typeof o.enter !== "number" || typeof o.exit !== "number")
        fail("weave-condition-invalid", "threshold needs numeric enter and exit.", predicateId, instrumentId);
      return { kind: "threshold", quantityId, direction: o.direction, enter: o.enter, exit: o.exit };
    }
    case "regime": {
      if (typeof o.on !== "string" || !o.on.trim())
        fail("weave-condition-invalid", "regime.on is required.", predicateId, instrumentId);
      if (o.on !== "constantSet" && !ctx.instrumentOutputIds.has(o.on))
        fail(
          "weave-condition-quantity-not-output",
          `Condition on "${o.on}" is not a declared output of instrument "${instrumentId}".`,
          predicateId,
          instrumentId,
        );
      if (typeof o.equals !== "string" || !o.equals.trim())
        fail("weave-condition-invalid", "regime.equals is required.", predicateId, instrumentId);
      return { kind: "regime", on: o.on, equals: o.equals };
    }
    case "status": {
      const quantityId = requireOutput(o.quantityId, "quantityId");
      const statuses = ["value", "outside-domain", "not-applicable", "analytic-limit", "symbolic", "underdetermined", "divergent"];
      if (typeof o.equals !== "string" || !statuses.includes(o.equals))
        fail("weave-condition-invalid", `status.equals must be one of ${statuses.join(", ")}.`, predicateId, instrumentId);
      return { kind: "status", quantityId, equals: o.equals as SnapshotOutput["status"] };
    }
    case "agreement": {
      const statisticQuantityId = requireOutput(o.statisticQuantityId, "statisticQuantityId");
      const sampleCountQuantityId = requireOutput(o.sampleCountQuantityId, "sampleCountQuantityId");
      if (typeof o.minimumSampleSize !== "number" || o.minimumSampleSize <= 0)
        fail("weave-agreement-underspecified", "agreement needs a positive minimumSampleSize.", predicateId, instrumentId);
      if (typeof o.enterAlpha !== "number" || typeof o.exitAlpha !== "number")
        fail("weave-agreement-underspecified", "agreement needs numeric enterAlpha and exitAlpha.", predicateId, instrumentId);
      if (typeof o.boundFamily !== "string" || !(BOUND_FAMILIES as readonly string[]).includes(o.boundFamily))
        fail("weave-unknown-bound-family", `Unknown bound family "${String(o.boundFamily)}".`, predicateId, instrumentId);
      if (o.boundFamily === "owner-band") {
        if (typeof o.lowerBoundQuantityId !== "string" || typeof o.upperBoundQuantityId !== "string")
          fail("weave-agreement-underspecified", "owner-band agreement needs lowerBoundQuantityId and upperBoundQuantityId.", predicateId, instrumentId);
        requireOutput(o.lowerBoundQuantityId, "lowerBoundQuantityId");
        requireOutput(o.upperBoundQuantityId, "upperBoundQuantityId");
      }
      if (o.offsetQuantityId !== undefined) requireOutput(o.offsetQuantityId, "offsetQuantityId");
      return {
        kind: "agreement",
        statisticQuantityId,
        sampleCountQuantityId,
        minimumSampleSize: o.minimumSampleSize,
        boundFamily: o.boundFamily,
        enterAlpha: o.enterAlpha,
        exitAlpha: o.exitAlpha,
        ...(typeof o.offsetQuantityId === "string" ? { offsetQuantityId: o.offsetQuantityId } : {}),
        ...(typeof o.lowerBoundQuantityId === "string" ? { lowerBoundQuantityId: o.lowerBoundQuantityId } : {}),
        ...(typeof o.upperBoundQuantityId === "string" ? { upperBoundQuantityId: o.upperBoundQuantityId } : {}),
      };
    }
    default:
      fail("weave-unknown-condition-kind", `Unknown condition kind "${String(o.kind)}".`, predicateId, instrumentId);
  }
}

export function validateWeavePredicate(raw: unknown, ctx: WeaveValidationContext): WeavePredicate {
  if (!raw || typeof raw !== "object") fail("weave-predicate-invalid", "A predicate must be an object.");
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : undefined;
  const instrumentId = typeof o.instrumentId === "string" ? o.instrumentId : undefined;

  if (typeof o.meaning !== "string" || !(WEAVE_MEANINGS as readonly string[]).includes(o.meaning)) {
    fail(
      "weave-meaning-missing",
      `Predicate "${id ?? "(unknown)"}" on instrument "${instrumentId ?? "(unknown)"}" needs a meaning from ${WEAVE_MEANINGS.join(", ")}.`,
      id,
      instrumentId,
    );
  }
  const meaning = o.meaning as WeaveMeaning;

  if (!id) fail("weave-predicate-invalid", "id is required.", id, instrumentId);
  if (!instrumentId) fail("weave-predicate-invalid", "instrumentId is required.", id, instrumentId);
  if (!Array.isArray(o.conditions) || o.conditions.length === 0)
    fail("weave-predicate-invalid", "At least one condition is required.", id, instrumentId);

  const conditions = o.conditions.map((c) => validateCondition(c, ctx, id, instrumentId));

  if (meaning === "outside-selected-domain" && conditions.some((c) => c.kind === "agreement")) {
    fail(
      "weave-outside-domain-uses-agreement",
      `Predicate "${id}" has meaning outside-selected-domain but carries an agreement condition; agreement inside a domain says nothing about being outside it.`,
      id,
      instrumentId,
    );
  }

  if (!Array.isArray(o.targets) || o.targets.length === 0)
    fail("weave-predicate-invalid", "At least one target sentence id is required.", id, instrumentId);
  for (const target of o.targets) {
    if (typeof target !== "string" || !ctx.resolvableTargetIds.has(target)) {
      fail("weave-target-unresolved", `Target "${String(target)}" does not resolve to a sentence id.`, id, instrumentId);
    }
  }
  if (typeof o.pointerText !== "string" || !o.pointerText.trim())
    fail("weave-predicate-invalid", "pointerText is required.", id, instrumentId);

  return Object.freeze({
    id,
    instrumentId,
    meaning,
    conditions: Object.freeze(conditions),
    targets: Object.freeze([...(o.targets as string[])]),
    pointerText: o.pointerText,
  });
}
