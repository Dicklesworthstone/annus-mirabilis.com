/**
 * Validator for comprehension round reports (am-edit-comprehension-protocol-ouih).
 * Validates markdown round reports against front matter schema, section requirements,
 * and strict participant code rules.
 */

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
  readonly bodyText: string;
}

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
    bodyText,
  };
}
