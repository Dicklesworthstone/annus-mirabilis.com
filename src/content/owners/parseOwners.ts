/**
 * Parser and validator for docs/OWNERS.md table.
 * Specification: docs/OWNERS.md and am-edit-review-records-hofz
 */

import fs from "node:fs";
import path from "node:path";

export const KNOWN_ROLE_IDS = [
  "editorial-owner",
  "implementation-owner",
  "german-source-reviewer",
  "physics-math-reviewer",
  "r2-readability-reviewer",
  "tour-tester",
  "history-reviewer",
  "transfer-task-reviewer",
  "cross-projection-reviewer",
  "accessibility-codesign-facilitator",
  "comprehension-facilitator",
  "real-device-tester",
  "translator",
  "checking-editor",
  "glossator",
  "edition-editor",
] as const;

export type OwnerRole = (typeof KNOWN_ROLE_IDS)[number];

export const ROLE_TO_REVIEW_TYPE = {
  "german-source-reviewer": "german-source",
  "physics-math-reviewer": "physics-math",
  "r2-readability-reviewer": "r2-readability",
  "tour-tester": "tour-completion",
  "history-reviewer": "history",
  "transfer-task-reviewer": "transfer-task",
  "cross-projection-reviewer": "cross-projection",
  "accessibility-codesign-facilitator": "accessibility-codesign",
  "comprehension-facilitator": "comprehension-round",
} as const;

export type ReviewTypeFromRole = (typeof ROLE_TO_REVIEW_TYPE)[keyof typeof ROLE_TO_REVIEW_TYPE];

export type OwnerRow = Readonly<{
  id: string;
  displayName: string;
  roles: readonly OwnerRole[];
  scope: string;
  status: string;
  consentToBeNamed: string;
  assignedBy: string;
  assignedOn: string;
  rowNumber: number;
}>;

export type OwnersRegistry = Readonly<{
  rows: readonly OwnerRow[];
  byId: ReadonlyMap<string, OwnerRow>;
  rolesOf: (id: string) => readonly OwnerRole[];
  hasRole: (id: string, role: string) => boolean;
  getOwner: (id: string) => OwnerRow | undefined;
}>;

export class OwnersParseError extends Error {
  readonly code: string;
  readonly rowNumber?: number | undefined;

  constructor(code: string, message: string, rowNumber?: number) {
    super(
      rowNumber !== undefined ? `Row ${rowNumber}: ${message} (${code})` : `${message} (${code})`,
    );
    this.name = "OwnersParseError";
    this.code = code;
    this.rowNumber = rowNumber;
  }
}

const EXPECTED_HEADERS = [
  "id",
  "displayName",
  "roles",
  "scope",
  "status",
  "consentToBeNamed",
  "assignedBy",
  "assignedOn",
] as const;

const ID_REGEX = /^[a-z0-9][a-z0-9-]{1,40}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses markdown table content from docs/OWNERS.md.
 */
export function parseOwners(markdownText: string): OwnersRegistry {
  const lines = markdownText.split(/\r?\n/);
  let tableHeaderIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine ? rawLine.trim() : "";
    if (line.startsWith("|") && line.endsWith("|")) {
      const cells = line
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      if (
        cells.length === EXPECTED_HEADERS.length &&
        (cells.includes("id") || cells.includes("displayName"))
      ) {
        tableHeaderIndex = i;
        break;
      }
    }
  }

  if (tableHeaderIndex === -1) {
    throw new OwnersParseError(
      "missing-header",
      "Could not find valid table header in owners markdown.",
    );
  }

  const rawHeaderLine = lines[tableHeaderIndex];
  const headerLine = rawHeaderLine ? rawHeaderLine.trim() : "";
  const headerCells = headerLine
    .slice(1, -1)
    .split("|")
    .map((c) => c.trim());

  for (let i = 0; i < EXPECTED_HEADERS.length; i++) {
    if (headerCells[i] !== EXPECTED_HEADERS[i]) {
      throw new OwnersParseError(
        "reordered-header",
        `Header column ${i} is "${headerCells[i]}", expected "${EXPECTED_HEADERS[i]}".`,
        tableHeaderIndex + 1,
      );
    }
  }

  // Next line should be separator
  const separatorIndex = tableHeaderIndex + 1;
  if (separatorIndex >= lines.length) {
    throw new OwnersParseError(
      "missing-table-separator",
      "Table separator line missing after header.",
      separatorIndex + 1,
    );
  }

  const rawSeparatorLine = lines[separatorIndex];
  const separatorLine = rawSeparatorLine ? rawSeparatorLine.trim() : "";
  if (!separatorLine.startsWith("|") || !separatorLine.endsWith("|")) {
    throw new OwnersParseError(
      "invalid-table-separator",
      "Invalid table separator line.",
      separatorIndex + 1,
    );
  }

  const rows: OwnerRow[] = [];
  const byId = new Map<string, OwnerRow>();

  for (let lineIdx = separatorIndex + 1; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx];
    const line = rawLine ? rawLine.trim() : "";
    const rowNumber = lineIdx + 1;

    // Stop table parsing if we reach an empty line, a section heading (e.g. ## Qualifications), or a non-table line
    if (!line.startsWith("|") || !line.endsWith("|")) {
      if (line.startsWith("#")) {
        // Stop at section heading
        break;
      }
      if (!line) {
        continue;
      }
      break;
    }

    const cells = line
      .slice(1, -1)
      .split("|")
      .map((c) => c.trim());

    if (cells.length !== EXPECTED_HEADERS.length) {
      throw new OwnersParseError(
        "invalid-column-count",
        `Expected ${EXPECTED_HEADERS.length} columns but found ${cells.length}.`,
        rowNumber,
      );
    }

    const [id, displayName, rawRoles, scope, status, consentToBeNamed, assignedBy, assignedOn] =
      cells as [string, string, string, string, string, string, string, string];

    if (!id) {
      throw new OwnersParseError("missing-id", "Owner ID is empty.", rowNumber);
    }

    if (id.includes("@")) {
      throw new OwnersParseError(
        "email-like-id",
        `Owner ID "${id}" must not be an email address.`,
        rowNumber,
      );
    }

    if (id.startsWith("model:")) {
      throw new OwnersParseError(
        "model-id-rejected",
        `Owner ID "${id}" must not start with "model:".`,
        rowNumber,
      );
    }

    if (!ID_REGEX.test(id)) {
      throw new OwnersParseError(
        "invalid-id-format",
        `Owner ID "${id}" does not match pattern [a-z0-9][a-z0-9-]{1,40}.`,
        rowNumber,
      );
    }

    if (byId.has(id)) {
      throw new OwnersParseError("duplicate-id", `Duplicate owner ID "${id}".`, rowNumber);
    }

    const roleTokens = rawRoles
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);

    if (roleTokens.length === 0) {
      throw new OwnersParseError(
        "missing-roles",
        `Owner ID "${id}" has no roles defined.`,
        rowNumber,
      );
    }

    const validatedRoles: OwnerRole[] = [];
    for (const token of roleTokens) {
      if (!KNOWN_ROLE_IDS.includes(token as OwnerRole)) {
        throw new OwnersParseError(
          "unknown-role",
          `Unknown role "${token}" for owner "${id}". Known roles: ${KNOWN_ROLE_IDS.join(", ")}.`,
          rowNumber,
        );
      }
      validatedRoles.push(token as OwnerRole);
    }

    if (status === "assigned" && consentToBeNamed !== "yes") {
      throw new OwnersParseError(
        "missing-consent",
        `Assigned owner "${id}" must have consentToBeNamed: yes (found "${consentToBeNamed}").`,
        rowNumber,
      );
    }

    if (!ISO_DATE_REGEX.test(assignedOn)) {
      throw new OwnersParseError(
        "invalid-assigned-date",
        `Invalid assignedOn date "${assignedOn}" for owner "${id}". Expected YYYY-MM-DD.`,
        rowNumber,
      );
    }

    const ownerRow: OwnerRow = {
      id,
      displayName,
      roles: Object.freeze(validatedRoles),
      scope,
      status,
      consentToBeNamed,
      assignedBy,
      assignedOn,
      rowNumber,
    };

    rows.push(ownerRow);
    byId.set(id, ownerRow);
  }

  const frozenRows = Object.freeze(rows);
  const rolesOf = (id: string): readonly OwnerRole[] => {
    const row = byId.get(id);
    return row ? row.roles : [];
  };

  const hasRole = (id: string, role: string): boolean => {
    const row = byId.get(id);
    if (!row) return false;
    return row.roles.includes(role as OwnerRole);
  };

  const getOwner = (id: string): OwnerRow | undefined => {
    return byId.get(id);
  };

  return {
    rows: frozenRows,
    byId,
    rolesOf,
    hasRole,
    getOwner,
  };
}

let cachedRegistry: OwnersRegistry | null = null;

/**
 * Loads and parses docs/OWNERS.md from the filesystem.
 */
export function loadOwnersRegistry(repoRoot = process.cwd()): OwnersRegistry {
  const filePath = path.join(repoRoot, "docs", "OWNERS.md");
  const content = fs.readFileSync(filePath, "utf8");
  return parseOwners(content);
}

/**
 * Global helper for role lookup.
 */
export function rolesOf(
  idOrRegistry: string | OwnersRegistry,
  roleOrId?: string,
): readonly OwnerRole[] {
  if (typeof idOrRegistry === "string") {
    if (!cachedRegistry) {
      cachedRegistry = loadOwnersRegistry();
    }
    return cachedRegistry.rolesOf(idOrRegistry);
  }
  if (typeof roleOrId === "string") {
    return idOrRegistry.rolesOf(roleOrId);
  }
  return [];
}

/**
 * Global helper for checking if an ID holds a role.
 */
export function hasRole(
  idOrRegistry: string | OwnersRegistry,
  roleOrId: string,
  maybeRole?: string,
): boolean {
  if (typeof idOrRegistry === "string") {
    if (!cachedRegistry) {
      cachedRegistry = loadOwnersRegistry();
    }
    return cachedRegistry.hasRole(idOrRegistry, roleOrId);
  }
  if (maybeRole !== undefined) {
    return idOrRegistry.hasRole(roleOrId, maybeRole);
  }
  return false;
}
