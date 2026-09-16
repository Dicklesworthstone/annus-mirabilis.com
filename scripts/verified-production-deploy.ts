/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: scripts/verified-production-deploy.ts
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 *
 * The only supported production deploy entry point for annus-mirabilis.com,
 * once am-rel-verified-deploy-qndt adapts it. It stays intentionally
 * fail-closed: it will not upload a stale or partial `.vercel/output`
 * directory, and it will never move a public hostname until a freshly
 * created prebuilt deployment answers its candidate checks correctly.
 *
 * Vercel CLI commands this pipeline calls, once adapted (locked at CLI
 * `59.10.0` by am-gov-decision-stack-versions-6ax; see docs/DECISIONS.md
 * section 5's machine-readable capability record):
 *   vercel pull --yes                               fetch project settings
 *   vercel build --prod                             produce a Build Output API v3 bundle locally
 *   vercel deploy --prebuilt --prod --skip-domain    upload the prebuilt candidate without aliasing (never omit --skip-domain)
 *   vercel inspect <url>                             read deployment status and aliases
 *   vercel alias set <previewUrl> <hostname>          atomically promote the verified candidate
 *   vercel curl --deployment <d> <path> -- ...        fetch protected-preview HTTP status before promotion (beta in 59.10.0;
 *                                                      `assertProtectedPreviewResponse` is the one adapter function that owns
 *                                                      this call, so a future CLI without it needs one change, not many. Its
 *                                                      documented fallback is plain `curl` with an
 *                                                      `x-vercel-protection-bypass: ${VERCEL_AUTOMATION_BYPASS_SECRET}` header.)
 *   vercel link --project <name>                      link the workspace to the canonical project (scripts/deployment-target.ts)
 * `vercel deploy --prebuilt --prod` is never called without `--skip-domain`.
 *
 * Modifications from the donor:
 * - The main entry now throws a clear "not yet adapted" error before any
 *   network, git, or Vercel call, per this bead's acceptance criteria. Every
 *   helper function below it is a pure or narrowly side-effecting primitive
 *   that am-rel-verified-deploy-qndt assembles into a real pipeline; none of
 *   them are called from `main` yet. A half-adapted deploy script is
 *   dangerous, so disabling the entry point is the safe default.
 * - `run` now calls an injectable spawn function (`__setSpawnForTesting`)
 *   instead of `node:child_process`'s `spawnSync` directly, so a test can
 *   prove zero commands were invoked by injecting a recording spawn function
 *   and asserting its recorded call list stays empty.
 * - Added `toolRunArtifactDirectory`: pure path construction (no filesystem
 *   write) naming this pipeline's future structured-log directory with a
 *   fresh `toolRunId` from scripts/runIds.ts, per AGENTS.md "Structured
 *   logs" (a release is a tool run; its events carry `toolRunId`, never
 *   `runId`).
 * - Removed `assertWrightManualEditionInWorkspace` and its call from
 *   `assertCompletePrebuiltArtifact`; it validated the donor's hand-prepared
 *   Wright Flyer archival edition, which has no equivalent here. The Build
 *   Output API v3 shape check is otherwise unchanged.
 * - Removed `WRIGHT_ROUTE`, `WRIGHT_ARCHIVAL_TEXT_LABEL`,
 *   `COMPLETE_SOURCE_DELIVERY_ROUTE`, `COMPLETE_SOURCE_DELIVERY_MARKER`,
 *   `assertReleaseRoutes`, `assertProtectedPreviewRoutes`, and the donor's
 *   hard-coded `PUBLICATION_CONTRACT_TESTS` list (patent- and donor-specific
 *   test file paths that do not exist here). `assertResponse` and
 *   `assertProtectedPreviewResponse` are kept as the generic adapters;
 *   am-rel-verified-deploy-qndt wires them to
 *   `scripts/deployment-verification.ts`'s `CANDIDATE_CHECK_REGISTRY`.
 * - `DEPLOYMENT_LOCK_PORT`, `PUBLIC_HOSTNAMES`, and `PLATFORM_HOSTNAME` are
 *   now imported from `./deployment-target` (annus-mirabilis hostnames and
 *   the unfilled project-identity placeholders) instead of being redefined
 *   locally with the donor's port `45_267` and hostnames.
 * - `assertNoConflictingBuilds`'s process-name allowlist and build-command
 *   pattern are otherwise unchanged: they carry no patent-specific
 *   assumption.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import { createServer } from "node:net";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { CANONICAL_PRODUCTION_PROJECT, PROMOTION_REQUIRED_DOMAINS } from "./deployment-target";
import { newToolRunId } from "./runIds";

/**
 * Local deployment lock port. Deliberately not the donor's original port
 * number, which this file's header names as a forbidden donor identity
 * (docs/DONOR_AUDIT.md section 10.4). This value is a real, usable port
 * choice for annus-mirabilis's own exclusive local deployment lock, not a
 * "fill me in" placeholder like the project identity constants.
 */
const DEPLOYMENT_LOCK_PORT = 48_915;
const PUBLIC_HOSTNAMES = CANONICAL_PRODUCTION_PROJECT.customDomains;
const PLATFORM_HOSTNAME = CANONICAL_PRODUCTION_PROJECT.platformDomain;
const PROMOTION_HOSTNAMES = PROMOTION_REQUIRED_DOMAINS;

type CommandResult = {
  stdout: string;
  stderr: string;
};

export type SpawnFn = typeof spawnSync;

let activeSpawn: SpawnFn = spawnSync;

/**
 * Swaps the function `run` uses to launch subprocesses. Tests use this to
 * inject a recording spawn function and prove that a refused entry point
 * invoked zero commands, without touching the real filesystem, git, or
 * network. Production code never calls this.
 */
export function __setSpawnForTesting(fn: SpawnFn): void {
  activeSpawn = fn;
}

export function __resetSpawnForTesting(): void {
  activeSpawn = spawnSync;
}

/**
 * The structured-log artifact directory this pipeline writes to once
 * adapted, named by a fresh tool-run id per release attempt. A release is a
 * tool run, not a test suite and not an experiment realization, so its
 * events carry `toolRunId` (AGENTS.md "Structured logs"), never `runId`.
 * Pure string construction; it performs no filesystem write itself, so
 * calling it (including from a test) creates nothing on disk.
 */
export function toolRunArtifactDirectory(toolRunId: string = newToolRunId()): string {
  return path.join(process.cwd(), "artifacts", "verified-production-deploy", toolRunId);
}

function run(
  command: string,
  args: string[],
  capture = false,
  printCapturedOutput = true,
): CommandResult {
  console.log(`\n$ ${[command, ...args].join(" ")}`);
  const result = activeSpawn(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: capture ? ["ignore", "pipe", "pipe"] : ["ignore", "inherit", "inherit"],
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status ?? "unknown"}.`);
  }

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  if (capture && printCapturedOutput) {
    process.stdout.write(stdout);
    process.stderr.write(stderr);
  }
  return { stdout, stderr };
}

export function trackedWorkingTreeChanges(): string {
  const status = run(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all"],
    true,
    false,
  ).stdout;
  return status
    .split("\n")
    .filter(
      (line) =>
        line &&
        !line.endsWith(" tsconfig.tsbuildinfo") &&
        !line.endsWith(" next-env.d.ts") &&
        !line.includes(" .beads/"),
    )
    .join("\n");
}

export function assertCleanTrackedWorkingTree(stage: string) {
  const changes = trackedWorkingTreeChanges();
  if (changes) {
    throw new Error(
      `${stage}: refusing to deploy from a shared worktree with uncommitted or untracked files:\n${changes}`,
    );
  }
}

export function currentCommit(): string {
  return run("git", ["rev-parse", "--verify", "HEAD"], true, false).stdout.trim();
}

export function assertCommitUnchanged(expectedCommit: string, stage: string) {
  const actualCommit = currentCommit();
  if (actualCommit !== expectedCommit) {
    throw new Error(
      `${stage}: HEAD changed during the release (${expectedCommit} -> ${actualCommit}); refusing to promote.`,
    );
  }
}

function isProcessInCurrentWorkspace(pid: string): boolean {
  try {
    const lsofResult = activeSpawn("lsof", ["-p", pid, "-a", "-d", "cwd", "-Fn"], {
      encoding: "utf8",
    });
    const stdout = lsofResult.stdout ?? "";
    const cwdLine = stdout.split("\n").find((line) => line.startsWith("n"));
    if (!cwdLine) return true;
    const procCwd = cwdLine.slice(1);
    const root = process.cwd();
    return procCwd === root || procCwd.startsWith(`${root}/`);
  } catch {
    return true;
  }
}

export function conflictingBuilds(): string[] {
  const currentPid = process.pid.toString();
  const processList = run("ps", ["-Ao", "pid=,ppid=,etime=,command="], true, false).stdout;
  return processList.split("\n").filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    const parts = trimmed.split(/\s+/);
    const pid = parts[0];
    const ppid = parts[1];
    if (!pid) return false;
    if (pid === currentPid || ppid === currentPid) return false;
    const commandStr = parts.slice(3).join(" ");
    if (
      /\b(?:SkyComputerUseClient|Codex Computer Use|Google Chrome|Electron|Antigravity)\b/i.test(
        commandStr,
      )
    ) {
      return false;
    }
    if (
      !/\b(?:next\s+(?:build|dev)|vercel\s+(?:build|deploy)|bun\s+(?:run\s+(?:build|dev)|scripts\/build\.ts))\b/.test(
        commandStr,
      )
    ) {
      return false;
    }
    if (!isProcessInCurrentWorkspace(pid)) {
      return false;
    }
    return true;
  });
}

export function assertNoConflictingBuilds(stage: string) {
  for (let attempt = 0; attempt < 120; attempt++) {
    const conflicts = conflictingBuilds();
    if (conflicts.length === 0) return;
    if (attempt < 119) {
      activeSpawn("sleep", ["1"], {});
      continue;
    }
    throw new Error(
      `${stage}: another Next process, build, or deployment is using shared artifacts. Wait for it to finish:\n${conflicts.join("\n")}`,
    );
  }
}

function countFiles(directory: string): number {
  return fs
    .readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile()).length;
}

function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export function assertCompletePrebuiltArtifact(buildStartedAtMs: number) {
  const outputDirectory = path.join(process.cwd(), ".vercel", "output");
  const configPath = path.join(outputDirectory, "config.json");
  const staticDirectory = path.join(outputDirectory, "static");
  if (!fs.existsSync(configPath)) {
    throw new Error("Vercel build did not create .vercel/output/config.json.");
  }
  if (!fs.existsSync(staticDirectory)) {
    throw new Error(
      "Vercel build produced no static output; refusing to deploy a partial artifact.",
    );
  }

  let config: { version?: unknown };
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8")) as { version?: unknown };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Vercel output config is not valid JSON: ${detail}`);
  }
  if (config.version !== 3) {
    throw new Error("Vercel output config is not a version 3 Build Output API artifact.");
  }
  const configModifiedAtMs = fs.statSync(configPath).mtimeMs;
  if (configModifiedAtMs + 1_000 < buildStartedAtMs) {
    throw new Error(
      "Vercel output predates this release attempt; refusing to upload a stale prebuilt artifact.",
    );
  }

  const fileCount = countFiles(outputDirectory);
  if (fileCount < 100) {
    throw new Error(
      `Vercel output has only ${fileCount} files; a valid Annus Mirabilis release has a full static site.`,
    );
  }

  console.log(`Validated fresh Vercel artifact: ${fileCount} files.`);
}

export function deploymentUrl(output: string): string {
  const urls = output.match(/https:\/\/[^\s"']+\.vercel\.app/g) ?? [];
  const url = urls.at(-1);
  if (!url) throw new Error("Vercel did not return a deployment URL.");
  return url.replace(/[),.]$/, "");
}

export async function assertResponse(
  url: string,
  pathName: string,
  requiredText: string,
): Promise<string> {
  const response = await fetch(`${url}${pathName}`, { signal: AbortSignal.timeout(30_000) });
  const body = await response.text();
  if (!response.ok || !body.includes(requiredText)) {
    throw new Error(
      `Release check failed for ${url}${pathName}: HTTP ${response.status}; required content was not present.`,
    );
  }
  return body;
}

/**
 * The one adapter function for `vercel curl`, which is in beta in the
 * locked CLI version (docs/DECISIONS.md section 5). If a future CLI drops
 * it, only this function needs to switch to the documented fallback:
 * plain `curl` with `x-vercel-protection-bypass: ${VERCEL_AUTOMATION_BYPASS_SECRET}`.
 */
export function assertProtectedPreviewResponse(
  deployment: string,
  pathName: string,
  requiredText: string,
): string {
  const marker = "__ANNUS_MIRABILIS_HTTP_STATUS__";
  const response = run(
    "vercel",
    [
      "curl",
      "--deployment",
      deployment,
      pathName,
      "--",
      "--silent",
      "--show-error",
      "--write-out",
      `\n${marker}%{http_code}`,
    ],
    true,
    false,
  ).stdout;
  const statusIndex = response.lastIndexOf(marker);
  const status = Number.parseInt(response.slice(statusIndex + marker.length).trim(), 10);
  const body = response.slice(0, statusIndex);
  if (statusIndex < 0 || status < 200 || status >= 300 || !body.includes(requiredText)) {
    throw new Error(
      `Release check failed for protected preview ${deployment}${pathName}: HTTP ${status || "unknown"}; required content was not present.`,
    );
  }
  return body;
}

export async function acquireDeploymentLock() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", (error) => {
      if ((error as NodeJS.ErrnoException).code === "EADDRINUSE") {
        reject(
          new Error(
            "A verified annus-mirabilis deployment is already running on this machine; wait for it to finish.",
          ),
        );
        return;
      }
      reject(error);
    });
    server.listen({ host: "127.0.0.1", port: DEPLOYMENT_LOCK_PORT, exclusive: true }, resolve);
  });
  return server;
}

export async function main(): Promise<void> {
  if (process.argv.includes("--help")) {
    console.log("Usage: bun scripts/verified-production-deploy.ts");
    return;
  }

  // Deliberately the first thing main() does, before any network, git, or
  // Vercel call: am-rel-verified-deploy-qndt fills the project identity
  // constants, the release manifest, and the candidate checks, then removes
  // this guard. Until then, refusing here is the safe default; every helper
  // function above remains independently testable.
  throw new Error(
    "verified-production-deploy.ts is not yet adapted for annus-mirabilis.com; see am-rel-verified-deploy-qndt. " +
      `Public hostnames pending: ${PUBLIC_HOSTNAMES.join(", ")} (platform alias ${PLATFORM_HOSTNAME}). ` +
      `Promotion hostnames: ${PROMOTION_HOSTNAMES.join(", ")}. No network, git, or Vercel command was executed.`,
  );
}

const isMainModule =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nVerified production deployment refused: ${message}`);
    process.exitCode = 1;
  });
}
