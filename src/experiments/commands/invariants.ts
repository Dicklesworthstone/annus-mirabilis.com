/**
 * Per-class invariant enforcement (am-rt-command-classes-dzp requirement 8).
 *
 * "The controller computes the relevant digests and draw counters before and after every
 * command. In development and test builds a violated invariant throws with the class, the
 * field, and both values. In production the controller keeps the last accepted snapshot and
 * reports the execution outcome invariant-violation."
 */
import { type ExecutionOutcome, executionOutcomeRegistry } from "../results/outcomes.ts";

import type { JsonValue } from "../results/refusals.ts";
import type { CommandClass, TypedCommand } from "./types.ts";

export type RevisionsMap = Readonly<{
  input: number;
  observer: number;
  measurement: number;
  estimator: number;
}>;

export type ScientificDigestsMap = Readonly<{
  latentPathDigest?: string | undefined;
  eventSetDigest?: string | undefined;
  worldlineDigest?: string | undefined;
  observationDataDigest?: string | undefined;
  estimateDigest?: string | undefined;
}>;

export type ExecutionStateSnapshot = Readonly<{
  instanceId: string;
  runId: string;
  parentRunId: string | null;
  actionIndex: number;
  stepIndex: number;
  simulatedTime: number;
  revisions: RevisionsMap;
  digests: ScientificDigestsMap;
  drawCounters: Readonly<Record<string, number>>;
  modelId?: string | undefined;
  fallbackReason?: string | undefined;
}>;

export type InvariantViolation = Readonly<{
  commandClass: CommandClass;
  field: string;
  expected: JsonValue;
  actual: JsonValue;
  message: string;
}>;

export class InvariantViolationError extends Error {
  readonly commandClass: CommandClass;
  readonly field: string;
  readonly expected: JsonValue;
  readonly actual: JsonValue;

  constructor(options: {
    commandClass: CommandClass;
    field: string;
    expected: JsonValue;
    actual: JsonValue;
    message?: string;
  }) {
    super(
      options.message ??
        `Invariant violation for ${options.commandClass} on field "${options.field}": expected ${JSON.stringify(options.expected)}, got ${JSON.stringify(options.actual)}`,
    );
    this.name = "InvariantViolationError";
    this.commandClass = options.commandClass;
    this.field = options.field;
    this.expected = options.expected;
    this.actual = options.actual;
  }
}

export type InvariantCheckResult =
  | Readonly<{ ok: true }>
  | Readonly<{
      ok: false;
      violation: InvariantViolation;
      outcome: ExecutionOutcome;
    }>;

function equalDrawCounters(
  a: Readonly<Record<string, number>>,
  b: Readonly<Record<string, number>>,
): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

/**
 * Checks invariants for a command transition from preState to postState.
 * Throws InvariantViolationError if violated and options.isProduction is false (default).
 * Returns InvariantCheckResult.
 */
export function checkCommandInvariants(
  preState: ExecutionStateSnapshot,
  postState: ExecutionStateSnapshot,
  command: TypedCommand,
  options?: { isProduction?: boolean },
): InvariantCheckResult {
  const isProd = options?.isProduction ?? false;
  const violations: InvariantViolation[] = [];

  const recordViolation = (
    field: string,
    expected: JsonValue,
    actual: JsonValue,
    message: string,
  ) => {
    violations.push({
      commandClass: command.class,
      field,
      expected,
      actual,
      message,
    });
  };

  switch (command.class) {
    case "setup-change": {
      if (postState.runId === preState.runId) {
        recordViolation(
          "runId",
          `distinct from ${preState.runId}`,
          postState.runId,
          "setup-change must fork a new runId (a new identified run)",
        );
      }
      if (postState.parentRunId !== preState.runId) {
        recordViolation(
          "parentRunId",
          preState.runId,
          postState.parentRunId,
          "setup-change must set parentRunId to the previous runId",
        );
      }
      if (postState.stepIndex !== 0) {
        recordViolation(
          "stepIndex",
          0,
          postState.stepIndex,
          "setup-change must reset stepIndex to 0",
        );
      }
      if (postState.revisions.input !== preState.revisions.input + 1) {
        recordViolation(
          "revisions.input",
          preState.revisions.input + 1,
          postState.revisions.input,
          "setup-change must increment inputRevision",
        );
      }
      break;
    }

    case "physical-intervention": {
      const atTime = (command.payload as { atSimulatedTime: number }).atSimulatedTime;
      const isBackdated = atTime < preState.simulatedTime;

      if (isBackdated) {
        if (postState.runId === preState.runId) {
          recordViolation(
            "runId",
            `distinct from ${preState.runId}`,
            postState.runId,
            "backdated physical-intervention must fork a new runId",
          );
        }
        if (postState.parentRunId !== preState.runId) {
          recordViolation(
            "parentRunId",
            preState.runId,
            postState.parentRunId,
            "backdated physical-intervention must set parentRunId to previous runId",
          );
        }
      } else {
        if (postState.runId !== preState.runId) {
          recordViolation(
            "runId",
            preState.runId,
            postState.runId,
            "forward physical-intervention must keep the existing runId",
          );
        }
      }

      if (postState.revisions.input !== preState.revisions.input + 1) {
        recordViolation(
          "revisions.input",
          preState.revisions.input + 1,
          postState.revisions.input,
          "physical-intervention must increment inputRevision",
        );
      }
      break;
    }

    case "observer-change": {
      if (postState.runId !== preState.runId) {
        recordViolation(
          "runId",
          preState.runId,
          postState.runId,
          "observer-change must never fork a new runId (a change of description is not a change of world)",
        );
      }
      if (postState.stepIndex !== preState.stepIndex) {
        recordViolation(
          "stepIndex",
          preState.stepIndex,
          postState.stepIndex,
          "observer-change must keep stepIndex stable",
        );
      }
      if (postState.revisions.observer !== preState.revisions.observer + 1) {
        recordViolation(
          "revisions.observer",
          preState.revisions.observer + 1,
          postState.revisions.observer,
          "observer-change must increment observerRevision",
        );
      }
      if (postState.revisions.input !== preState.revisions.input) {
        recordViolation(
          "revisions.input",
          preState.revisions.input,
          postState.revisions.input,
          "observer-change must not change inputRevision",
        );
      }
      if (postState.revisions.measurement !== preState.revisions.measurement) {
        recordViolation(
          "revisions.measurement",
          preState.revisions.measurement,
          postState.revisions.measurement,
          "observer-change must not change measurementRevision",
        );
      }
      if (postState.revisions.estimator !== preState.revisions.estimator) {
        recordViolation(
          "revisions.estimator",
          preState.revisions.estimator,
          postState.revisions.estimator,
          "observer-change must not change estimatorRevision",
        );
      }
      if (
        preState.digests.eventSetDigest !== undefined &&
        postState.digests.eventSetDigest !== preState.digests.eventSetDigest
      ) {
        recordViolation(
          "digests.eventSetDigest",
          preState.digests.eventSetDigest,
          postState.digests.eventSetDigest ?? null,
          "observer-change must preserve eventSetDigest",
        );
      }
      if (
        preState.digests.worldlineDigest !== undefined &&
        postState.digests.worldlineDigest !== preState.digests.worldlineDigest
      ) {
        recordViolation(
          "digests.worldlineDigest",
          preState.digests.worldlineDigest,
          postState.digests.worldlineDigest ?? null,
          "observer-change must preserve worldlineDigest",
        );
      }

      if (!equalDrawCounters(preState.drawCounters, postState.drawCounters)) {
        recordViolation(
          "drawCounters",
          preState.drawCounters,
          postState.drawCounters,
          "observer-change must consume zero random draws",
        );
      }
      break;
    }

    case "measurement-change": {
      if (postState.runId !== preState.runId) {
        recordViolation(
          "runId",
          preState.runId,
          postState.runId,
          "measurement-change must keep runId stable",
        );
      }
      if (postState.revisions.measurement !== preState.revisions.measurement + 1) {
        recordViolation(
          "revisions.measurement",
          preState.revisions.measurement + 1,
          postState.revisions.measurement,
          "measurement-change must increment measurementRevision",
        );
      }
      if (postState.revisions.input !== preState.revisions.input) {
        recordViolation(
          "revisions.input",
          preState.revisions.input,
          postState.revisions.input,
          "measurement-change must not change inputRevision",
        );
      }
      if (postState.revisions.observer !== preState.revisions.observer) {
        recordViolation(
          "revisions.observer",
          preState.revisions.observer,
          postState.revisions.observer,
          "measurement-change must not change observerRevision",
        );
      }
      if (postState.revisions.estimator !== preState.revisions.estimator) {
        recordViolation(
          "revisions.estimator",
          preState.revisions.estimator,
          postState.revisions.estimator,
          "measurement-change must not change estimatorRevision",
        );
      }
      if (
        preState.digests.latentPathDigest !== undefined &&
        postState.digests.latentPathDigest !== preState.digests.latentPathDigest
      ) {
        recordViolation(
          "digests.latentPathDigest",
          preState.digests.latentPathDigest,
          postState.digests.latentPathDigest ?? null,
          "measurement-change must preserve latentPathDigest",
        );
      }
      if (
        preState.drawCounters.latent !== undefined &&
        postState.drawCounters.latent !== preState.drawCounters.latent
      ) {
        recordViolation(
          "drawCounters.latent",
          preState.drawCounters.latent,
          postState.drawCounters.latent ?? null,
          "measurement-change must leave latent stream draws untouched",
        );
      }
      break;
    }

    case "estimator-change": {
      if (postState.runId !== preState.runId) {
        recordViolation(
          "runId",
          preState.runId,
          postState.runId,
          "estimator-change must keep runId stable",
        );
      }
      if (postState.revisions.estimator !== preState.revisions.estimator + 1) {
        recordViolation(
          "revisions.estimator",
          preState.revisions.estimator + 1,
          postState.revisions.estimator,
          "estimator-change must increment estimatorRevision",
        );
      }
      if (postState.revisions.input !== preState.revisions.input) {
        recordViolation(
          "revisions.input",
          preState.revisions.input,
          postState.revisions.input,
          "estimator-change must not change inputRevision",
        );
      }
      if (postState.revisions.observer !== preState.revisions.observer) {
        recordViolation(
          "revisions.observer",
          preState.revisions.observer,
          postState.revisions.observer,
          "estimator-change must not change observerRevision",
        );
      }
      if (postState.revisions.measurement !== preState.revisions.measurement) {
        recordViolation(
          "revisions.measurement",
          preState.revisions.measurement,
          postState.revisions.measurement,
          "estimator-change must not change measurementRevision",
        );
      }
      if (
        preState.digests.observationDataDigest !== undefined &&
        postState.digests.observationDataDigest !== preState.digests.observationDataDigest
      ) {
        recordViolation(
          "digests.observationDataDigest",
          preState.digests.observationDataDigest,
          postState.digests.observationDataDigest ?? null,
          "estimator-change must preserve observationDataDigest",
        );
      }
      break;
    }

    case "presentation-change": {
      if (postState.runId !== preState.runId) {
        recordViolation(
          "runId",
          preState.runId,
          postState.runId,
          "presentation-change must keep runId stable",
        );
      }
      if (postState.stepIndex !== preState.stepIndex) {
        recordViolation(
          "stepIndex",
          preState.stepIndex,
          postState.stepIndex,
          "presentation-change must keep stepIndex stable",
        );
      }
      if (
        postState.revisions.input !== preState.revisions.input ||
        postState.revisions.observer !== preState.revisions.observer ||
        postState.revisions.measurement !== preState.revisions.measurement ||
        postState.revisions.estimator !== preState.revisions.estimator
      ) {
        recordViolation(
          "revisions",
          preState.revisions,
          postState.revisions,
          "presentation-change must not modify any revision counters",
        );
      }
      for (const [digestKey, digestVal] of Object.entries(preState.digests)) {
        if (
          digestVal !== undefined &&
          (postState.digests as Record<string, string | undefined>)[digestKey] !== digestVal
        ) {
          recordViolation(
            `digests.${digestKey}`,
            digestVal,
            (postState.digests as Record<string, string | undefined>)[digestKey] ?? null,
            `presentation-change must preserve scientific digest ${digestKey}`,
          );
        }
      }
      if (!equalDrawCounters(preState.drawCounters, postState.drawCounters)) {
        recordViolation(
          "drawCounters",
          preState.drawCounters,
          postState.drawCounters,
          "presentation-change must consume zero random draws",
        );
      }
      break;
    }
  }

  if (violations.length > 0) {
    const firstViolation = violations[0];
    if (!firstViolation) return { ok: true };
    if (!isProd) {
      throw new InvariantViolationError(firstViolation);
    }

    return {
      ok: false,
      violation: firstViolation,
      outcome: {
        outcome: "invariant-violation",
        message: executionOutcomeRegistry["invariant-violation"].message,
        retry: executionOutcomeRegistry["invariant-violation"].retry,
        details: {
          commandClass: command.class,
          field: firstViolation.field,
          expected: firstViolation.expected,
          actual: firstViolation.actual,
          message: firstViolation.message,
        },
      },
    };
  }

  return { ok: true };
}
