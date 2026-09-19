/**
 * Validator for comprehension round reports (am-edit-comprehension-protocol-ouih).
 * Validates markdown round reports against front matter schema, section requirements,
 * and strict participant code rules.
 */

import {
  BARRIER_DISPOSITIONS,
  type BarrierRecord,
  RECURRENT_BARRIER_THRESHOLD,
  STUMBLING_POINT_CODES,
} from "../../comprehension/types.ts";
import { parseYaml } from "../../content/provenance/yaml.ts";
import { parseParticipantCode, VALID_PAPERS, VALID_ROUTES } from "./participantCodes.ts";

export interface RoundReportFrontMatter {
  readonly paper: string;
  readonly route: string;
  readonly date: string;
  readonly buildCommit: string;
  readonly anchors: readonly string[];
  readonly facilitator: string;
}

export interface ParsedRoundReport {
  readonly frontMatter: RoundReportFrontMatter;
  readonly participantCodes: readonly string[];
  readonly barriers: readonly BarrierRecord[];
  readonly bodyText: string;
}

/** A barrier is recurrent within one round when enough participants met it (PROTOCOL.md §15). */
export function isRecurrentBarrier(barrier: BarrierRecord): boolean {
  return barrier.met >= RECURRENT_BARRIER_THRESHOLD;
}

/** Tracker ids as this repository writes them: the `am` prefix and a suffix. */
const BEAD_ID = /^am-[a-z0-9-]+$/;

/** A passage anchor (#s4-p2) or an action id (bm-01:step-drag). */
const BARRIER_ANCHOR = /^(#[a-z0-9][a-z0-9-]*|[a-z]{2}-\d{2}:[a-z0-9-]+)$/;

export class RoundReportValidationError extends Error {
  readonly code: string;
  readonly file: string;
  readonly line?: number | undefined;

  constructor(code: string, message: string, file: string, line?: number) {
    super(
      line !== undefined
        ? `${file}:${line}: ${message} (${code})`
        : `${file}: ${message} (${code})`,
    );
    this.name = "RoundReportValidationError";
    this.code = code;
    this.file = file;
    this.line = line;
  }
}

export function validateRoundReportText(content: string, filePath: string): ParsedRoundReport {
  // 1. Extract front matter between ---
  if (!content.startsWith("---")) {
    throw new RoundReportValidationError(
      "missing-front-matter",
      "Round report must start with YAML front matter ('---')",
      filePath,
      1,
    );
  }

  const secondDelimiter = content.indexOf("\n---", 3);
  if (secondDelimiter === -1) {
    throw new RoundReportValidationError(
      "unclosed-front-matter",
      "Round report has unclosed YAML front matter",
      filePath,
      1,
    );
  }

  const rawYaml = content.slice(3, secondDelimiter).trim();
  const bodyText = content.slice(secondDelimiter + 4).trim();

  let parsedFm: unknown;
  try {
    parsedFm = parseYaml(rawYaml);
  } catch (err) {
    throw new RoundReportValidationError(
      "malformed-front-matter-yaml",
      `Invalid YAML in front matter: ${String(err)}`,
      filePath,
      1,
    );
  }

  if (!parsedFm || typeof parsedFm !== "object" || Array.isArray(parsedFm)) {
    throw new RoundReportValidationError(
      "invalid-front-matter",
      "Front matter must be a YAML mapping",
      filePath,
      1,
    );
  }

  function findLineOfKey(content: string, key: string): number {
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      if (new RegExp(`^\\s*${key}\\s*:`, "i").test(line)) {
        return i + 1;
      }
    }
    return 1;
  }

  const fm = parsedFm as Record<string, unknown>;

  // Validate paper
  if (typeof fm.paper !== "string" || !(VALID_PAPERS as readonly string[]).includes(fm.paper)) {
    throw new RoundReportValidationError(
      "invalid-paper",
      `Invalid paper "${fm.paper}". Valid papers: ${VALID_PAPERS.join(", ")}`,
      filePath,
      findLineOfKey(content, "paper"),
    );
  }

  // Validate route
  if (typeof fm.route !== "string" || !(VALID_ROUTES as readonly string[]).includes(fm.route)) {
    throw new RoundReportValidationError(
      "invalid-route",
      `Invalid route "${fm.route}". Valid routes: ${VALID_ROUTES.join(", ")}`,
      filePath,
      findLineOfKey(content, "route"),
    );
  }

  // Validate date
  if (typeof fm.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fm.date)) {
    throw new RoundReportValidationError(
      "invalid-date",
      "date must be YYYY-MM-DD",
      filePath,
      findLineOfKey(content, "date"),
    );
  }

  // Validate buildCommit
  if (typeof fm.buildCommit !== "string" || !/^[a-f0-9]{7,64}$/i.test(fm.buildCommit.trim())) {
    throw new RoundReportValidationError(
      "missing-build-commit",
      "buildCommit must be a git commit SHA (7 to 64 hex characters)",
      filePath,
      findLineOfKey(content, "buildCommit"),
    );
  }

  // Validate anchors
  if (!Array.isArray(fm.anchors) || fm.anchors.length === 0) {
    throw new RoundReportValidationError(
      "missing-anchors",
      "anchors must be a non-empty array of passage anchors or action IDs",
      filePath,
      findLineOfKey(content, "anchors"),
    );
  }

  // Validate facilitator
  if (typeof fm.facilitator !== "string" || !fm.facilitator.trim()) {
    throw new RoundReportValidationError(
      "missing-facilitator",
      "facilitator ID is required",
      filePath,
      findLineOfKey(content, "facilitator"),
    );
  }

  if (fm.facilitator.includes("@")) {
    throw new RoundReportValidationError(
      "facilitator-contains-email",
      `Facilitator ID "${fm.facilitator}" contains '@'; must be an owners-table ID, not an email address.`,
      filePath,
      findLineOfKey(content, "facilitator"),
    );
  }

  // 2. Privacy scan on the full content
  const lines = content.split("\n");
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (emailRegex.test(line)) {
      throw new RoundReportValidationError(
        "privacy-email-detected",
        `Embedded email address detected in violation of privacy rules: "${line.trim()}"`,
        filePath,
        i + 1,
      );
    }
  }

  // 2b. Barrier dispositions. PROTOCOL.md sections 14 and 15: a finding that
  // changes nothing is not a finding, so a recurrent or blocking barrier has
  // to name the bead that tracks its repair, and a barrier is not fixed
  // because someone edited the passage.
  const barriers: BarrierRecord[] = [];
  const barriersLine = findLineOfKey(content, "barriers");
  if (fm.barriers !== undefined) {
    if (!Array.isArray(fm.barriers)) {
      throw new RoundReportValidationError(
        "invalid-barriers",
        "barriers must be a list; omit the key entirely when the round recorded none",
        filePath,
        barriersLine,
      );
    }
    for (const [index, raw] of fm.barriers.entries()) {
      const where = `barriers[${index}]`;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new RoundReportValidationError(
          "invalid-barrier",
          `${where} must be a mapping`,
          filePath,
          barriersLine,
        );
      }
      const b = raw as Record<string, unknown>;

      if (
        typeof b.code !== "string" ||
        !(STUMBLING_POINT_CODES as readonly string[]).includes(b.code)
      ) {
        throw new RoundReportValidationError(
          "unknown-stumbling-point-code",
          `${where}.code "${String(b.code)}" is not one of the five stumbling-point codes: ${STUMBLING_POINT_CODES.join(", ")}`,
          filePath,
          barriersLine,
        );
      }

      if (typeof b.anchor !== "string" || !BARRIER_ANCHOR.test(b.anchor)) {
        throw new RoundReportValidationError(
          "barrier-anchor-missing",
          `${where}.anchor must be a passage anchor (#s4-p2) or an action id (bm-01:step-drag); got "${String(b.anchor)}". A barrier with no place on the page cannot be repaired.`,
          filePath,
          barriersLine,
        );
      }

      const met = b.met;
      const resolved = b.resolved;
      if (typeof met !== "number" || !Number.isInteger(met) || met < 1) {
        throw new RoundReportValidationError(
          "barrier-counts-invalid",
          `${where}.met must be a positive integer count of participants who met the barrier`,
          filePath,
          barriersLine,
        );
      }
      if (
        typeof resolved !== "number" ||
        !Number.isInteger(resolved) ||
        resolved < 0 ||
        resolved > met
      ) {
        throw new RoundReportValidationError(
          "barrier-counts-invalid",
          `${where}.resolved must be an integer between 0 and met (${met}); got ${String(resolved)}`,
          filePath,
          barriersLine,
        );
      }

      if (typeof b.blocking !== "boolean") {
        throw new RoundReportValidationError(
          "barrier-blocking-missing",
          `${where}.blocking must be true or false: whether any participant could not continue without help beyond the neutral prompts`,
          filePath,
          barriersLine,
        );
      }

      if (
        typeof b.disposition !== "string" ||
        !(BARRIER_DISPOSITIONS as readonly string[]).includes(b.disposition)
      ) {
        throw new RoundReportValidationError(
          "barrier-disposition-unknown",
          `${where}.disposition must be one of: ${BARRIER_DISPOSITIONS.join(", ")}`,
          filePath,
          barriersLine,
        );
      }

      const barrier: BarrierRecord = {
        code: b.code as BarrierRecord["code"],
        anchor: b.anchor,
        met,
        resolved,
        blocking: b.blocking,
        disposition: b.disposition as BarrierRecord["disposition"],
        ...(typeof b.bead === "string" ? { bead: b.bead } : {}),
        ...(typeof b.verifiedBy === "string" ? { verifiedBy: b.verifiedBy } : {}),
        ...(typeof b.reason === "string" ? { reason: b.reason } : {}),
      };

      const needsBead =
        isRecurrentBarrier(barrier) || barrier.blocking || barrier.disposition !== "open";
      if (needsBead && (!barrier.bead || !BEAD_ID.test(barrier.bead))) {
        const why = barrier.blocking
          ? "blocking"
          : isRecurrentBarrier(barrier)
            ? `met by ${barrier.met} participants, so recurrent`
            : `dispositioned "${barrier.disposition}"`;
        throw new RoundReportValidationError(
          "recurrent-barrier-without-bead",
          `${where} is ${why} and must name the bead tracking it (bead: am-...). Prose saying an issue was logged is not a tracked issue.`,
          filePath,
          barriersLine,
        );
      }

      if (barrier.disposition === "fixed" && !barrier.verifiedBy) {
        throw new RoundReportValidationError(
          "fixed-barrier-without-verification",
          `${where} is dispositioned "fixed" and must name the later round that recorded no participant meeting it (verifiedBy). Editing the passage is not verification.`,
          filePath,
          barriersLine,
        );
      }

      if (barrier.disposition === "accepted" && !barrier.reason?.trim()) {
        throw new RoundReportValidationError(
          "accepted-barrier-without-reason",
          `${where} is dispositioned "accepted" and must carry the written reason the site will not repair it`,
          filePath,
          barriersLine,
        );
      }

      barriers.push(barrier);
    }
  }

  // 3. Extract and validate participant codes from the body
  const participantCodeRegex =
    /`([a-z0-9-]+-(?:no-algebra|nonvisual|full-derivation|low-cost-phone)-[a-z0-9-]+)`/g;
  const codes: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const matches = [...line.matchAll(participantCodeRegex)];
    for (const match of matches) {
      const code = match[1] ?? "";
      const parsed = parseParticipantCode(code);
      if (!parsed.ok) {
        throw new RoundReportValidationError(
          "invalid-participant-code",
          `Invalid participant code "${code}": ${parsed.error}`,
          filePath,
          i + 1,
        );
      }
      codes.push(code);
    }
  }

  return {
    frontMatter: {
      paper: fm.paper,
      route: fm.route,
      date: fm.date,
      buildCommit: fm.buildCommit,
      anchors: fm.anchors as readonly string[],
      facilitator: fm.facilitator,
    },
    participantCodes: codes,
    barriers,
    bodyText,
  };
}

/**
 * Cross-report recurrence (PROTOCOL.md §15): the same stumbling-point code at
 * the same anchor in two or more reports is recurrent even when no single
 * round met it twice, and each occurrence must name its bead. Recurrence is
 * computed over the directory, not remembered by a facilitator.
 */
export function findCrossReportRecurrenceViolations(
  reports: readonly { readonly file: string; readonly report: ParsedRoundReport }[],
): string[] {
  const seen = new Map<string, { file: string; barrier: BarrierRecord }[]>();
  for (const { file, report } of reports) {
    for (const barrier of report.barriers) {
      const key = `${barrier.code}@${barrier.anchor}`;
      const bucket = seen.get(key) ?? [];
      bucket.push({ file, barrier });
      seen.set(key, bucket);
    }
  }

  const violations: string[] = [];
  for (const [key, bucket] of seen) {
    if (bucket.length < 2) continue;
    for (const { file, barrier } of bucket) {
      if (!barrier.bead) {
        violations.push(
          `${file}: barrier ${key} appears in ${bucket.length} reports (${bucket
            .map((b) => b.file)
            .join(", ")}) and is therefore recurrent, but names no bead.`,
        );
      }
    }
  }
  return violations;
}
