/**
 * Deploy Authorization Parser and Validator for annus-mirabilis.com
 * Quality gate / deployment verification module
 * Owner: am-rel-verified-deploy-qndt
 *
 * Requirement 14: User authorization file.
 * A deployment or alias move requires `--authorization <path>`.
 * The file is JSON or YAML with:
 * - schema: "annus-mirabilis-deploy-authorization.v1"
 * - authorizedBy: "jemanuel"
 * - authorizedAt: ISO 8601, within 24 h
 * - commit: must match preflight HEAD (40-char git commit SHA)
 * - profile: "scaffold" | "preview" | "launch"
 * - scope: "candidate-only" | "promote"
 * - allowedHostnames: string array, must include every hostname this run will move
 * - verbatimText: non-empty explanation of why this deploy is authorized
 *
 * A file for `preview` cannot be used with `launch`; a file naming only
 * `annus-mirabilis-seven.vercel.app` cannot be used with `--include-custom-domains`;
 * a file cannot authorize more hostnames than the run would move.
 *
 * The reference is copied into the release record and the deploy log.
 * A human gate is never self-certified: no agent writes such a file without the
 * user's actual words in the current conversation, and no mode infers
 * authorization from a plan document, a bead, or an earlier release.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as yaml from "js-yaml";

export const AUTHORIZATION_SCHEMA = "annus-mirabilis-deploy-authorization.v1" as const;
export const CANONICAL_AUTHORIZED_BY = "jemanuel" as const;

export type ReleaseProfile = "scaffold" | "preview" | "launch";
export type ReleaseScope = "candidate-only" | "promote";

export interface DeployAuthorization {
  readonly schema: typeof AUTHORIZATION_SCHEMA;
  readonly authorizedBy: typeof CANONICAL_AUTHORIZED_BY;
  readonly authorizedAt: string;
  readonly commit: string;
  readonly profile: ReleaseProfile;
  readonly scope: ReleaseScope;
  readonly allowedHostnames: readonly string[];
  readonly verbatimText: string;
}

export interface ValidateAuthorizationOptions {
  readonly expectedCommit: string;
  readonly expectedProfile: ReleaseProfile;
  readonly expectedScope: ReleaseScope;
  readonly targetHostnames: readonly string[];
  readonly now?: Date;
  readonly maxAgeMs?: number;
}

export interface ValidatedAuthorization {
  readonly authorization: DeployAuthorization;
  readonly filePath: string;
  readonly reference: string;
}

export function formatAuthorizationReference(filePath: string, commit: string): string {
  const base = path.basename(filePath);
  const shortSha = commit.slice(0, 8);
  return `${base}#${shortSha}`;
}

export function parseAuthorizationContent(content: string, sourcePath = "<inline>"): unknown {
  try {
    return yaml.load(content);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Authorization check failed: cannot parse authorization content from ${sourcePath}: ${message}`,
    );
  }
}

export function validateAuthorization(
  raw: unknown,
  options: ValidateAuthorizationOptions,
  sourcePath = "<inline>",
): ValidatedAuthorization {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(
      `Authorization check failed: authorization at ${sourcePath} must be a valid mapping object.`,
    );
  }

  const record = raw as Record<string, unknown>;

  if (record.schema !== AUTHORIZATION_SCHEMA) {
    throw new Error(
      `Authorization check failed: invalid schema '${String(record.schema)}', expected '${AUTHORIZATION_SCHEMA}'.`,
    );
  }

  if (record.authorizedBy !== CANONICAL_AUTHORIZED_BY) {
    throw new Error(
      `Authorization check failed: authorizedBy must be '${CANONICAL_AUTHORIZED_BY}', found '${String(record.authorizedBy)}'.`,
    );
  }

  if (typeof record.authorizedAt !== "string" || !record.authorizedAt) {
    throw new Error("Authorization check failed: missing required 'authorizedAt' timestamp.");
  }

  const authTime = Date.parse(record.authorizedAt);
  if (Number.isNaN(authTime)) {
    throw new Error(
      `Authorization check failed: invalid ISO 8601 timestamp in authorizedAt: '${record.authorizedAt}'.`,
    );
  }

  const nowMs = options.now ? options.now.getTime() : Date.now();
  const maxAgeMs = options.maxAgeMs ?? 24 * 60 * 60 * 1000;
  const ageMs = nowMs - authTime;

  if (ageMs < -5 * 60 * 1000) {
    throw new Error(
      `Authorization check failed: authorizedAt timestamp is in the future: '${record.authorizedAt}'.`,
    );
  }

  if (ageMs > maxAgeMs) {
    throw new Error(
      `Authorization check failed: authorization is stale (authorizedAt '${record.authorizedAt}' is older than 24 hours).`,
    );
  }

  if (typeof record.commit !== "string" || !/^[0-9a-fA-F]{40}$/.test(record.commit)) {
    throw new Error(
      `Authorization check failed: commit must be a 40-character hex commit SHA, found '${String(record.commit)}'.`,
    );
  }

  if (record.commit.toLowerCase() !== options.expectedCommit.toLowerCase()) {
    throw new Error(
      `Authorization check failed: commit mismatch (authorization specifies ${record.commit}, but preflight HEAD is ${options.expectedCommit}).`,
    );
  }

  const validProfiles: readonly ReleaseProfile[] = ["scaffold", "preview", "launch"];
  if (!validProfiles.includes(record.profile as ReleaseProfile)) {
    throw new Error(
      `Authorization check failed: unknown profile '${String(record.profile)}', expected one of: ${validProfiles.join(", ")}.`,
    );
  }

  if (record.profile !== options.expectedProfile) {
    throw new Error(
      `Authorization check failed: profile mismatch (authorization is for '${String(record.profile)}', but current run profile is '${options.expectedProfile}').`,
    );
  }

  const validScopes: readonly ReleaseScope[] = ["candidate-only", "promote"];
  if (!validScopes.includes(record.scope as ReleaseScope)) {
    throw new Error(
      `Authorization check failed: unknown scope '${String(record.scope)}', expected one of: ${validScopes.join(", ")}.`,
    );
  }

  if (record.scope !== options.expectedScope) {
    throw new Error(
      `Authorization check failed: scope mismatch (authorization is for scope '${String(record.scope)}', but current run scope is '${options.expectedScope}').`,
    );
  }

  if (!Array.isArray(record.allowedHostnames) || record.allowedHostnames.length === 0) {
    throw new Error(
      "Authorization check failed: allowedHostnames must be a non-empty array of hostnames.",
    );
  }

  const allowedHostnames: string[] = [];
  for (const h of record.allowedHostnames) {
    if (typeof h !== "string" || !h.trim()) {
      throw new Error(
        `Authorization check failed: allowedHostnames contains invalid hostname '${String(h)}'.`,
      );
    }
    allowedHostnames.push(h.trim());
  }

  const allowedSet = new Set(allowedHostnames);
  const missingTargets = options.targetHostnames.filter((h) => !allowedSet.has(h));
  if (missingTargets.length > 0) {
    throw new Error(
      `Authorization check failed: authorization does not allow targeted hostnames: ${missingTargets.join(", ")}.`,
    );
  }

  const targetSet = new Set(options.targetHostnames);
  const extraHostnames = allowedHostnames.filter((h) => !targetSet.has(h));
  if (extraHostnames.length > 0) {
    throw new Error(
      `Authorization check failed: authorization specifies hostnames not targeted by this run: ${extraHostnames.join(", ")}.`,
    );
  }

  if (typeof record.verbatimText !== "string" || record.verbatimText.trim().length === 0) {
    throw new Error(
      "Authorization check failed: verbatimText explanation must be a non-empty string.",
    );
  }

  const authorization: DeployAuthorization = {
    schema: AUTHORIZATION_SCHEMA,
    authorizedBy: CANONICAL_AUTHORIZED_BY,
    authorizedAt: record.authorizedAt,
    commit: record.commit.toLowerCase(),
    profile: record.profile as ReleaseProfile,
    scope: record.scope as ReleaseScope,
    allowedHostnames,
    verbatimText: record.verbatimText.trim(),
  };

  const reference = formatAuthorizationReference(sourcePath, authorization.commit);

  return {
    authorization,
    filePath: sourcePath,
    reference,
  };
}

export function loadAndValidateAuthorization(
  filePath: string,
  options: ValidateAuthorizationOptions,
): ValidatedAuthorization {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Authorization check failed: file does not exist: ${resolvedPath}`);
  }

  const content = fs.readFileSync(resolvedPath, "utf8");
  const raw = parseAuthorizationContent(content, resolvedPath);
  return validateAuthorization(raw, options, resolvedPath);
}
