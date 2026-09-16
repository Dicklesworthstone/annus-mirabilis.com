/**
 * Validation functions for comprehension session records and support ladder tracking.
 * Specification: am-edit-comprehension-protocol-ouih
 */

import { VALID_PAPERS, VALID_ROUTES } from "../testing/docs/participantCodes.ts";
import {
  ACCOMPLISHMENTS,
  type Accomplishment,
  type AccomplishmentChange,
  type SessionRecord,
  STUMBLING_POINT_CODES,
  type StumblingPointCode,
  type StumblingPointRecord,
  SUPPORT_RUNGS,
  type SupportDefaultChangeRecord,
  type SupportLadderUsage,
  type SupportRung,
} from "./types.ts";

export class SessionValidationError extends Error {
  readonly path: string;
  readonly code: string;

  constructor(code: string, message: string, path: string) {
    super(`[session-validation] ${path}: ${message} (${code})`);
    this.name = "SessionValidationError";
    this.code = code;
    this.path = path;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Validates a SessionRecord.
 * Crucially enforces:
 * 1. Accomplishments are stored against a session, NEVER against a participant / person identifier.
 * 2. Facilitator ID must not contain an '@' sign (no email addresses).
 * 3. Accomplishment history is tracked chronologically.
 */
export function validateSessionRecord(raw: unknown, path = "SessionRecord"): SessionRecord {
  if (!isRecord(raw)) {
    throw new SessionValidationError("invalid-record", "SessionRecord must be an object", path);
  }

  // Enforce anti-profiling rule: NO person-level or participant-level identifiers storing accomplishments
  const forbiddenPersonKeys = [
    "participantId",
    "userId",
    "personId",
    "participantName",
    "learnerId",
    "userLevel",
    "placementScore",
  ];
  for (const key of forbiddenPersonKeys) {
    if (key in raw && raw[key] !== undefined) {
      throw new SessionValidationError(
        "forbidden-person-identifier",
        `Session record must store accomplishments per-session, NEVER against person/participant identifier "${key}".`,
        `${path}.${key}`,
      );
    }
  }

  if (typeof raw.sessionId !== "string" || !raw.sessionId.trim()) {
    throw new SessionValidationError(
      "missing-session-id",
      "sessionId is required",
      `${path}.sessionId`,
    );
  }

  if (typeof raw.paper !== "string" || !(VALID_PAPERS as readonly string[]).includes(raw.paper)) {
    throw new SessionValidationError(
      "invalid-paper",
      `Invalid paper "${raw.paper}". Valid papers: ${VALID_PAPERS.join(", ")}`,
      `${path}.paper`,
    );
  }

  if (typeof raw.route !== "string" || !(VALID_ROUTES as readonly string[]).includes(raw.route)) {
    throw new SessionValidationError(
      "invalid-route",
      `Invalid route "${raw.route}". Valid routes: ${VALID_ROUTES.join(", ")}`,
      `${path}.route`,
    );
  }

  if (typeof raw.argumentId !== "string" || !raw.argumentId.trim()) {
    throw new SessionValidationError(
      "missing-argument-id",
      "argumentId is required",
      `${path}.argumentId`,
    );
  }

  if (typeof raw.facilitator !== "string" || !raw.facilitator.trim()) {
    throw new SessionValidationError(
      "missing-facilitator",
      "facilitator is required",
      `${path}.facilitator`,
    );
  }

  if (raw.facilitator.includes("@")) {
    throw new SessionValidationError(
      "facilitator-contains-email",
      `Facilitator "${raw.facilitator}" must be an owners-table ID, not an email address.`,
      `${path}.facilitator`,
    );
  }

  if (typeof raw.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) {
    throw new SessionValidationError("invalid-date", "date must be YYYY-MM-DD", `${path}.date`);
  }

  if (typeof raw.buildCommit !== "string" || !raw.buildCommit.trim()) {
    throw new SessionValidationError(
      "missing-build-commit",
      "buildCommit is required",
      `${path}.buildCommit`,
    );
  }

  if (!ACCOMPLISHMENTS.includes(raw.initialAccomplishment as Accomplishment)) {
    throw new SessionValidationError(
      "invalid-accomplishment",
      `initialAccomplishment "${raw.initialAccomplishment}" must be one of: ${ACCOMPLISHMENTS.join(", ")}`,
      `${path}.initialAccomplishment`,
    );
  }

  if (!Array.isArray(raw.accomplishmentChanges)) {
    throw new SessionValidationError(
      "missing-accomplishment-changes",
      "accomplishmentChanges array is required",
      `${path}.accomplishmentChanges`,
    );
  }

  const changes: AccomplishmentChange[] = raw.accomplishmentChanges.map((c, i) => {
    if (!isRecord(c)) {
      throw new SessionValidationError(
        "invalid-change-record",
        "Change entry must be an object",
        `${path}.accomplishmentChanges[${i}]`,
      );
    }
    if (typeof c.timestamp !== "string" || !c.timestamp.trim()) {
      throw new SessionValidationError(
        "missing-timestamp",
        "timestamp is required",
        `${path}.accomplishmentChanges[${i}].timestamp`,
      );
    }
    if (!ACCOMPLISHMENTS.includes(c.from as Accomplishment)) {
      throw new SessionValidationError(
        "invalid-from-accomplishment",
        `Invalid from accomplishment "${c.from}"`,
        `${path}.accomplishmentChanges[${i}].from`,
      );
    }
    if (!ACCOMPLISHMENTS.includes(c.to as Accomplishment)) {
      throw new SessionValidationError(
        "invalid-to-accomplishment",
        `Invalid to accomplishment "${c.to}"`,
        `${path}.accomplishmentChanges[${i}].to`,
      );
    }
    return {
      timestamp: c.timestamp,
      from: c.from as Accomplishment,
      to: c.to as Accomplishment,
      ...(typeof c.reason === "string" ? { reason: c.reason } : {}),
    };
  });

  if (!ACCOMPLISHMENTS.includes(raw.currentAccomplishment as Accomplishment)) {
    throw new SessionValidationError(
      "invalid-current-accomplishment",
      `currentAccomplishment "${raw.currentAccomplishment}" must be one of: ${ACCOMPLISHMENTS.join(", ")}`,
      `${path}.currentAccomplishment`,
    );
  }

  if (typeof raw.outcomeReached !== "boolean") {
    throw new SessionValidationError(
      "missing-outcome-reached",
      "outcomeReached boolean is required",
      `${path}.outcomeReached`,
    );
  }

  const supportLadder = validateSupportLadderUsage(raw.supportLadder, `${path}.supportLadder`);

  if (!Array.isArray(raw.stumblingPoints)) {
    throw new SessionValidationError(
      "missing-stumbling-points",
      "stumblingPoints array is required",
      `${path}.stumblingPoints`,
    );
  }

  const stumblingPoints: StumblingPointRecord[] = raw.stumblingPoints.map((sp, i) => {
    if (!isRecord(sp)) {
      throw new SessionValidationError(
        "invalid-stumbling-point",
        "Stumbling point must be an object",
        `${path}.stumblingPoints[${i}]`,
      );
    }
    if (!STUMBLING_POINT_CODES.includes(sp.code as StumblingPointCode)) {
      throw new SessionValidationError(
        "invalid-stumbling-point-code",
        `Invalid stumbling point code "${sp.code}". Must be one of: ${STUMBLING_POINT_CODES.join(", ")}`,
        `${path}.stumblingPoints[${i}].code`,
      );
    }
    if (typeof sp.target !== "string" || !sp.target.trim()) {
      throw new SessionValidationError(
        "missing-target",
        "target is required",
        `${path}.stumblingPoints[${i}].target`,
      );
    }
    if (typeof sp.observation !== "string") {
      throw new SessionValidationError(
        "missing-observation",
        "observation string is required",
        `${path}.stumblingPoints[${i}].observation`,
      );
    }
    return {
      code: sp.code as StumblingPointCode,
      target: sp.target,
      observation: sp.observation,
    };
  });

  return {
    sessionId: raw.sessionId,
    paper: raw.paper,
    route: raw.route,
    argumentId: raw.argumentId,
    facilitator: raw.facilitator,
    date: raw.date,
    buildCommit: raw.buildCommit,
    initialAccomplishment: raw.initialAccomplishment as Accomplishment,
    accomplishmentChanges: changes,
    currentAccomplishment: raw.currentAccomplishment as Accomplishment,
    outcomeReached: raw.outcomeReached,
    supportLadder,
    stumblingPoints,
    ...(Array.isArray(raw.stopRuleObservations)
      ? { stopRuleObservations: raw.stopRuleObservations }
      : {}),
  };
}

export function validateSupportLadderUsage(
  raw: unknown,
  path = "SupportLadderUsage",
): SupportLadderUsage {
  if (!isRecord(raw)) {
    throw new SessionValidationError(
      "invalid-record",
      "SupportLadderUsage must be an object",
      path,
    );
  }

  if (!Array.isArray(raw.rungsUsed)) {
    throw new SessionValidationError(
      "missing-rungs-used",
      "rungsUsed array is required",
      `${path}.rungsUsed`,
    );
  }
  for (let i = 0; i < raw.rungsUsed.length; i++) {
    if (!SUPPORT_RUNGS.includes(raw.rungsUsed[i] as SupportRung)) {
      throw new SessionValidationError(
        "invalid-rung",
        `Invalid rung "${raw.rungsUsed[i]}". Valid rungs: ${SUPPORT_RUNGS.join(", ")}`,
        `${path}.rungsUsed[${i}]`,
      );
    }
  }

  if (!Array.isArray(raw.rungOrder)) {
    throw new SessionValidationError(
      "missing-rung-order",
      "rungOrder array is required",
      `${path}.rungOrder`,
    );
  }
  for (let i = 0; i < raw.rungOrder.length; i++) {
    if (!SUPPORT_RUNGS.includes(raw.rungOrder[i] as SupportRung)) {
      throw new SessionValidationError(
        "invalid-rung",
        `Invalid rung "${raw.rungOrder[i]}". Valid rungs: ${SUPPORT_RUNGS.join(", ")}`,
        `${path}.rungOrder[${i}]`,
      );
    }
  }

  if (typeof raw.wentStraightToExplanation !== "boolean") {
    throw new SessionValidationError(
      "missing-went-straight",
      "wentStraightToExplanation boolean is required",
      `${path}.wentStraightToExplanation`,
    );
  }

  if (!SUPPORT_RUNGS.includes(raw.stoppedAt as SupportRung)) {
    throw new SessionValidationError(
      "invalid-stopped-at",
      `stoppedAt "${raw.stoppedAt}" must be one of: ${SUPPORT_RUNGS.join(", ")}`,
      `${path}.stoppedAt`,
    );
  }

  if (typeof raw.transferCaseResolved !== "boolean") {
    throw new SessionValidationError(
      "missing-transfer-case",
      "transferCaseResolved boolean is required",
      `${path}.transferCaseResolved`,
    );
  }

  return {
    rungsUsed: raw.rungsUsed as readonly SupportRung[],
    rungOrder: raw.rungOrder as readonly SupportRung[],
    wentStraightToExplanation: raw.wentStraightToExplanation,
    stoppedAt: raw.stoppedAt as SupportRung,
    transferCaseResolved: raw.transferCaseResolved,
  };
}

export function validateSupportDefaultChange(
  raw: unknown,
  path = "SupportDefaultChangeRecord",
): SupportDefaultChangeRecord {
  if (!isRecord(raw)) {
    throw new SessionValidationError(
      "invalid-record",
      "SupportDefaultChangeRecord must be an object",
      path,
    );
  }

  if (typeof raw.stageId !== "string" || !raw.stageId.trim()) {
    throw new SessionValidationError("missing-stage-id", "stageId is required", `${path}.stageId`);
  }

  if (!SUPPORT_RUNGS.includes(raw.previousDefaultRung as SupportRung)) {
    throw new SessionValidationError(
      "invalid-previous-default",
      `previousDefaultRung "${raw.previousDefaultRung}" must be one of: ${SUPPORT_RUNGS.join(", ")}`,
      `${path}.previousDefaultRung`,
    );
  }

  if (!SUPPORT_RUNGS.includes(raw.newDefaultRung as SupportRung)) {
    throw new SessionValidationError(
      "invalid-new-default",
      `newDefaultRung "${raw.newDefaultRung}" must be one of: ${SUPPORT_RUNGS.join(", ")}`,
      `${path}.newDefaultRung`,
    );
  }

  if (!Array.isArray(raw.justifyingRoundIds) || raw.justifyingRoundIds.length === 0) {
    throw new SessionValidationError(
      "missing-justifying-round-ids",
      "Support-default change requires justifyingRoundIds (must cite at least one round ID).",
      `${path}.justifyingRoundIds`,
    );
  }

  for (let i = 0; i < raw.justifyingRoundIds.length; i++) {
    const id = raw.justifyingRoundIds[i];
    if (typeof id !== "string" || !id.trim()) {
      throw new SessionValidationError(
        "invalid-round-id",
        "Round ID must be a non-empty string",
        `${path}.justifyingRoundIds[${i}]`,
      );
    }
  }

  if (typeof raw.changeDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.changeDate)) {
    throw new SessionValidationError(
      "invalid-change-date",
      "changeDate must be YYYY-MM-DD",
      `${path}.changeDate`,
    );
  }

  if (typeof raw.rationale !== "string" || !raw.rationale.trim()) {
    throw new SessionValidationError(
      "missing-rationale",
      "rationale is required",
      `${path}.rationale`,
    );
  }

  return {
    stageId: raw.stageId,
    previousDefaultRung: raw.previousDefaultRung as SupportRung,
    newDefaultRung: raw.newDefaultRung as SupportRung,
    justifyingRoundIds: raw.justifyingRoundIds,
    changeDate: raw.changeDate,
    rationale: raw.rationale,
  };
}
