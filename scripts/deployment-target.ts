/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: scripts/deployment-target.ts
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 *
 * Modifications:
 * - Replaced the donor's canonical Vercel project identity with placeholder
 *   constants; every check built on them refuses until am-rel-vercel-setup-ituk
 *   and am-rel-verified-deploy-qndt fill in the real annus-mirabilis values.
 * - Replaced the donor's public hostnames with the three annus-mirabilis
 *   hostnames named in AGENTS.md's Vercel Deployment Standards.
 * - Removed the patent source-route manifest, the forbidden audit-hold string
 *   list, and the headless browser source-reader sweep (`runSourceReaderBrowserSweep`
 *   and its supporting types). All three read `../src/data/patents` and the
 *   patent editions modules, which do not exist here; the equivalent paper
 *   candidate checks belong to `am-rel-candidate-checks-kc7y` and the paper
 *   browser acceptance harness belongs to `am-test-e2e-harness-bqmh`.
 * - Kept `parseDeploymentInspect` and `assertDeploymentReadyAndAliased`
 *   unchanged: parsing `vercel inspect` text and asserting alias coverage is
 *   product-agnostic infrastructure.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Canonical production project identity: the Vercel project `annus-mirabilis` in team
 * `dicklesworthstones-projects`, the one serving annus-mirabilis.com, www and the -seven platform
 * alias. The values are the ones in the `.vercel/project.json` that the owner's 2026-09-21 deploy
 * linked. Until 2026-09-22 these were placeholder strings, so every assertion built on them
 * refused and no deploy could pass this gate; `annus-mirabilis.vercel.app` is still another
 * account's project and must never match.
 */
export const CANONICAL_PRODUCTION_PROJECT = {
  projectId: "prj_2x78UKZvaughODjplAHyTIqzIXHM",
  projectName: "annus-mirabilis",
  orgId: "team_F5Q3EH8Qxu3nDEOyEZLcQPe6",
  customDomains: ["annus-mirabilis.com", "www.annus-mirabilis.com"] as const,
  platformDomain: "annus-mirabilis-seven.vercel.app" as const,
} as const;

export const PROMOTION_REQUIRED_DOMAINS = [
  ...CANONICAL_PRODUCTION_PROJECT.customDomains,
  CANONICAL_PRODUCTION_PROJECT.platformDomain,
] as const;

export interface ProjectJsonConfig {
  projectId?: string;
  projectName?: string;
  orgId?: string;
  settings?: Record<string, unknown>;
}

export function assertCanonicalProjectIdentity(customPath?: string): ProjectJsonConfig {
  const filePath = customPath ?? path.join(process.cwd(), ".vercel", "project.json");
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Deployment target check failed: ${filePath} does not exist. ` +
        `Link the workspace to the canonical production project with: vercel link --project ${CANONICAL_PRODUCTION_PROJECT.projectName}`,
    );
  }

  let config: ProjectJsonConfig;
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    config = JSON.parse(raw) as ProjectJsonConfig;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Deployment target check failed: ${filePath} is invalid JSON: ${msg}`);
  }

  if (
    config.projectId !== CANONICAL_PRODUCTION_PROJECT.projectId ||
    config.projectName !== CANONICAL_PRODUCTION_PROJECT.projectName
  ) {
    throw new Error(
      `Deployment target mismatch: ${filePath} is linked to project "${config.projectName ?? "unknown"}" ` +
        `(${config.projectId ?? "unknown"}), but the canonical production project owning ${CANONICAL_PRODUCTION_PROJECT.customDomains[0]} ` +
        `is "${CANONICAL_PRODUCTION_PROJECT.projectName}" (${CANONICAL_PRODUCTION_PROJECT.projectId}). ` +
        `Refusing deployment to wrong project. Relink with: vercel link --project ${CANONICAL_PRODUCTION_PROJECT.projectName}`,
    );
  }

  return config;
}

export interface ParsedDeploymentInspect {
  id: string;
  name: string;
  target: string;
  status: string;
  url: string;
  aliases: string[];
}

export function parseDeploymentInspect(output: string): ParsedDeploymentInspect {
  const lines = output.split("\n");
  let id = "";
  let name = "";
  let target = "";
  let status = "";
  let url = "";
  const aliases: string[] = [];

  let inAliases = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line === "Aliases") {
      inAliases = true;
      continue;
    }
    if (line === "Builds" || line === "General") {
      inAliases = false;
      continue;
    }

    if (inAliases) {
      const aliasMatch = line.match(/(?:╶\s+)?https?:\/\/([^\s]+)/);
      if (aliasMatch?.[1]) {
        aliases.push(aliasMatch[1].replace(/\/$/, ""));
      }
      continue;
    }

    const idMatch = line.match(/^id\s+([^\s]+)/i);
    if (idMatch?.[1]) {
      id = idMatch[1];
      continue;
    }
    const nameMatch = line.match(/^name\s+([^\s]+)/i);
    if (nameMatch?.[1]) {
      name = nameMatch[1];
      continue;
    }
    const targetMatch = line.match(/^target\s+([^\s]+)/i);
    if (targetMatch?.[1]) {
      target = targetMatch[1];
      continue;
    }
    const statusMatch = line.match(/^status\s+(.+)$/i);
    if (statusMatch?.[1]) {
      status = statusMatch[1].trim();
      continue;
    }
    const urlMatch = line.match(/^url\s+https?:\/\/([^\s]+)/i);
    if (urlMatch?.[1]) {
      url = urlMatch[1].replace(/\/$/, "");
    }
  }

  return { id, name, target, status, url, aliases };
}

export function assertDeploymentReadyAndAliased(
  inspectOutput: string,
  requiredDomains: readonly string[] = CANONICAL_PRODUCTION_PROJECT.customDomains,
): ParsedDeploymentInspect {
  const parsed = parseDeploymentInspect(inspectOutput);

  // am-o44v. This asked whether the status CONTAINS "ready", which is a substring test standing
  // in for a category test, on the gate that moves production aliases. "already" contains "ready",
  // so a status of ALREADY_PROMOTED passed it, and status is parsed from free text (/^status (.+)$/)
  // so the whole rest of the line is matched. The category test is equality with the one status
  // that means ready.
  //
  // The Vercel CLI decorates the status with a bullet ("status  \u25cf Ready"), so the leading
  // non-alphanumeric run is stripped before the comparison. Everything after it is compared
  // WHOLE. Stripping the decoration is not a licence to match loosely: "NOT READY" and
  // "ALREADY_PROMOTED" both survive the strip intact and both fail the equality.
  const statusToken = parsed.status
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .trim()
    .toUpperCase();
  if (statusToken !== "READY") {
    throw new Error(
      `Deployment is not Ready (current status: "${parsed.status || "unknown"}", url: "${parsed.url || "unknown"}"). ` +
        `Refusing release promotion.`,
    );
  }

  const normalizedAliases = new Set(
    parsed.aliases.map((a) =>
      a
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "")
        .toLowerCase(),
    ),
  );

  const missingDomains = requiredDomains.filter((req) => !normalizedAliases.has(req.toLowerCase()));

  if (missingDomains.length > 0) {
    throw new Error(
      `Deployment ${parsed.url} (${parsed.id}) is Ready, but missing required production alias(es): ` +
        `${missingDomains.join(", ")}. Existing aliases: [${parsed.aliases.join(", ")}]. ` +
        `Refusing release promotion without live custom domain aliases attached.`,
    );
  }

  return parsed;
}
