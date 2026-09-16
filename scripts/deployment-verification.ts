/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: scripts/deployment-verification.ts
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 *
 * Modifications:
 * - Replaced the donor's production project identity with unfilled
 *   placeholders (see scripts/deployment-target.ts's header for why the
 *   refusal is intentional).
 * - Replaced the donor's custom domains and platform alias with the three
 *   annus-mirabilis hostnames.
 * - Removed `FORBIDDEN_AUDIT_HOLD_STRINGS`, `getNonRedirectPatentIds`, and
 *   `runLiveSourceReaderSweep`. Those checked patent detail routes for
 *   editorial audit-hold banners; there is no equivalent editorial hold
 *   concept for papers, and a live headless-browser sweep over paper routes
 *   is exactly what candidate checks are for.
 * - Removed the import of `classifyPatentE2EDiagnostic` from the donor's
 *   patent-e2e-contract; the annus-mirabilis equivalent
 *   (`classifyPaperE2EDiagnostic`) now lives in scripts/e2e/paper-e2e-contract.ts
 *   and is not imported here to avoid coupling deploy verification to the
 *   browser acceptance harness.
 * - Added `CandidateCheckDefinition` / `CandidateCheckResult` /
 *   `CANDIDATE_CHECK_REGISTRY` / `runCandidateChecks`: a registry of named
 *   checks, each `not-available` until am-rel-candidate-checks-kc7y
 *   implements it (per this bead's acceptance criteria: unimplemented checks
 *   report `not-available`, never `passed`). The six named checks are the
 *   ones AGENTS.md's "Vercel Deployment Standards" section requires:
 *   four complete paper texts, representative foundation pages, every
 *   instrument bundle, one no-JavaScript source-text check, one real
 *   accepted WASM result per numerical capability, and one deliberate typed
 *   refusal. am-rel-smoke-rollback-cache-phre extends this registry with the
 *   post-promotion mass-energy smoke test and cache headers.
 * - `parseAndValidateVercelProjectConfig` and `assertCanonicalVercelProject`
 *   are otherwise unchanged: they carry no patent-specific assumption.
 */

import * as fs from "node:fs";
import * as path from "node:path";

export const CANONICAL_VERCEL_PROJECT_ID =
  "PLACEHOLDER_VERCEL_PROJECT_ID__FILLED_BY_am-rel-vercel-setup-ituk";
export const CANONICAL_VERCEL_ORG_ID =
  "PLACEHOLDER_VERCEL_ORG_ID__FILLED_BY_am-rel-vercel-setup-ituk";
export const CANONICAL_VERCEL_PROJECT_NAME =
  "PLACEHOLDER_VERCEL_PROJECT_NAME__FILLED_BY_am-rel-vercel-setup-ituk";

export const CANONICAL_PUBLIC_HOSTNAMES = [
  "annus-mirabilis.com",
  "www.annus-mirabilis.com",
] as const;
export const CANONICAL_PLATFORM_HOSTNAME = "annus-mirabilis-seven.vercel.app";

export interface VercelProjectConfig {
  projectId: string;
  orgId: string;
  projectName: string;
}

/**
 * Validates that the provided .vercel/project.json content exactly matches the
 * canonical production project that owns annus-mirabilis.com.
 */
export function parseAndValidateVercelProjectConfig(
  projectJsonContent: string,
): VercelProjectConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(projectJsonContent);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid JSON in .vercel/project.json: ${message}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error(".vercel/project.json content must be a JSON object.");
  }

  const raw = parsed as Partial<VercelProjectConfig>;

  if (!raw.projectId || typeof raw.projectId !== "string") {
    throw new Error(".vercel/project.json is missing required 'projectId' string.");
  }
  if (!raw.orgId || typeof raw.orgId !== "string") {
    throw new Error(".vercel/project.json is missing required 'orgId' string.");
  }
  if (!raw.projectName || typeof raw.projectName !== "string") {
    throw new Error(".vercel/project.json is missing required 'projectName' string.");
  }

  if (raw.projectName !== CANONICAL_VERCEL_PROJECT_NAME) {
    throw new Error(
      `Incorrect Vercel projectName: expected '${CANONICAL_VERCEL_PROJECT_NAME}', found '${raw.projectName}'. ` +
        `A duplicate project does not own the production domain alias and will cause silent deployment divergence.`,
    );
  }

  if (raw.projectId !== CANONICAL_VERCEL_PROJECT_ID) {
    throw new Error(
      `Incorrect Vercel projectId: expected '${CANONICAL_VERCEL_PROJECT_ID}', found '${raw.projectId}'. ` +
        `Refusing to deploy to a non-canonical Vercel project target.`,
    );
  }

  if (raw.orgId !== CANONICAL_VERCEL_ORG_ID) {
    throw new Error(
      `Incorrect Vercel orgId: expected '${CANONICAL_VERCEL_ORG_ID}', found '${raw.orgId}'.`,
    );
  }

  return {
    projectId: raw.projectId,
    orgId: raw.orgId,
    projectName: raw.projectName,
  };
}

/**
 * Reads and verifies the project identity from disk (.vercel/project.json).
 */
export function assertCanonicalVercelProject(customPath?: string): VercelProjectConfig {
  const filePath = customPath ?? path.join(process.cwd(), ".vercel", "project.json");
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Missing .vercel/project.json at ${filePath}. Link the repository to the canonical '${CANONICAL_VERCEL_PROJECT_NAME}' project before deploying.`,
    );
  }
  const content = fs.readFileSync(filePath, "utf8");
  return parseAndValidateVercelProjectConfig(content);
}

/**
 * Asserts that the deployment's aliases include the required production custom domains.
 */
export function assertDeploymentHasRequiredAliases(
  aliases: readonly string[],
  requiredHostnames: readonly string[] = CANONICAL_PUBLIC_HOSTNAMES,
): void {
  const normalized = aliases.map((a) =>
    a
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, ""),
  );

  const missing = requiredHostnames.filter((host) => !normalized.includes(host.toLowerCase()));

  if (missing.length > 0) {
    throw new Error(
      `Deployment does not possess required domain aliases: [${missing.join(", ")}]. ` +
        `Available aliases: [${normalized.join(", ")}]. Refusing promotion.`,
    );
  }
}

export type CandidateCheckStatus = "passed" | "failed" | "not-available";

export interface CandidateCheckResult {
  name: string;
  status: CandidateCheckStatus;
  detail: string;
}

export interface CandidateCheckDefinition {
  /** Stable identifier; also the JSONL/log key for this check. */
  name: string;
  /** What this check proves, in one sentence, for the release manifest. */
  description: string;
  run: (baseUrl: string) => Promise<CandidateCheckResult>;
}

function notAvailableCheck(name: string, description: string): CandidateCheckDefinition {
  return {
    name,
    description,
    run: async () => ({
      name,
      status: "not-available",
      detail: `${name} is not implemented yet; am-rel-candidate-checks-kc7y fills this in.`,
    }),
  };
}

/**
 * Named candidate checks a verified release runs against the deployed,
 * unpromoted candidate before promotion. Every entry starts `not-available`
 * and stays that way until am-rel-candidate-checks-kc7y implements it; the
 * registry exists now so the release script and its tests can depend on a
 * stable, named shape instead of an ad hoc list assembled per release.
 */
export const CANDIDATE_CHECK_REGISTRY: readonly CandidateCheckDefinition[] = [
  notAvailableCheck(
    "four-complete-paper-texts",
    "Loads all four complete paper texts (light-quanta, brownian-motion, special-relativity, mass-energy) against the deployed candidate.",
  ),
  notAvailableCheck(
    "representative-foundations",
    "Loads representative foundation pages against the deployed candidate.",
  ),
  notAvailableCheck(
    "every-instrument-bundle",
    "Loads every instrument bundle against the deployed candidate.",
  ),
  notAvailableCheck(
    "no-javascript-source-text",
    "Confirms the source text is present in the HTML response with JavaScript disabled.",
  ),
  notAvailableCheck(
    "accepted-wasm-result-per-capability",
    "Obtains one real accepted WASM result per numerical capability from the deployed candidate.",
  ),
  notAvailableCheck(
    "deliberate-typed-refusal",
    "Triggers one deliberate typed refusal and confirms it is reported as a typed refusal, never a silent zero.",
  ),
];

export async function runCandidateChecks(
  baseUrl: string,
  registry: readonly CandidateCheckDefinition[] = CANDIDATE_CHECK_REGISTRY,
): Promise<CandidateCheckResult[]> {
  const results: CandidateCheckResult[] = [];
  for (const check of registry) {
    results.push(await check.run(baseUrl));
  }
  return results;
}
