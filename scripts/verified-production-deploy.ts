/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: scripts/verified-production-deploy.ts
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 *
 * Modifications:
 * - Adapted for annus-mirabilis.com under am-rel-verified-deploy-qndt.
 *
 * The only supported production deploy entry point for annus-mirabilis.com,
 * adapted under am-rel-verified-deploy-qndt. It stays intentionally
 * fail-closed: it will not upload a stale or partial `.vercel/output`
 * directory, and it will never move a public hostname until a freshly
 * created prebuilt deployment answers its candidate checks correctly.
 *
 * Vercel CLI commands this pipeline calls (locked at CLI `59.10.0`):
 *   vercel pull --yes                               fetch project settings
 *   vercel build --prod                             produce a Build Output API v3 bundle locally
 *   vercel deploy --prebuilt --prod --skip-domain    upload the prebuilt candidate without aliasing (never omit --skip-domain)
 *   vercel inspect <url>                             read deployment status and aliases
 *   vercel alias set <previewUrl> <hostname>          atomically promote the verified candidate
 *   vercel curl --deployment <d> <path> -- ...        fetch protected-preview HTTP status before promotion
 *   vercel link --project <name>                      link the workspace to canonical project
 * `vercel deploy --prebuilt --prod` is never called without `--skip-domain`.
 *
 * Safety Behaviors:
 * 1. Exclusive local lock on port 48915 (released in finally).
 * 2. Canonical production project identity validation against CANONICAL_PRODUCTION_PROJECT.
 * 3. Conflicting build detection via ps + lsof inside this workspace.
 * 4. Clean git working tree and commit invariability check across stages.
 * 5. Quality gates run before building (profile-aware, exit code 1 and 2 fail closed).
 * 6. Prebuilt Build Output API v3 artifact verification (version 3, fresh mtime, >= 100 files).
 * 7. Candidate-only mode (--candidate-only): builds, checks, records candidate; never aliases.
 * 8. Promotion mode (--promote): verifies candidate record, commit, and status; never builds.
 * 9. Promotion state machine with automatic rollback to previous deployment on partial failure.
 * 10. Persistent toolRunId across stages; unique logRunId per process invocation.
 * 11. Protected-preview adapter for Vercel Deployment Protection.
 * 12. Profile-driven target hostnames (scaffold platform-only unless authorized custom domains).
 * 13. Verbatim user authorization check via scripts/authorization.ts.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import { createServer, type Server } from "node:net";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadAndValidateAuthorization,
  type ReleaseProfile,
  type ReleaseScope,
} from "./authorization";
import {
  allCandidateChecksPassed,
  type CandidateBrowserProbe,
  runCandidateChecksAgainst,
  summarizeCandidateChecks,
  vercelCurlFetcher,
} from "./candidate-checks";
import { createCandidateBrowserProbe } from "./candidateBrowserProbe";
import {
  assertCanonicalProjectIdentity,
  assertDeploymentReadyAndAliased,
  CANONICAL_PRODUCTION_PROJECT,
  PROMOTION_REQUIRED_DOMAINS,
  parseDeploymentInspect,
} from "./deployment-target";
import type { CandidateCheckResult } from "./deployment-verification";
import { newToolRunId } from "./runIds";

export const DEPLOYMENT_LOCK_PORT = 48_915;
export const PUBLIC_HOSTNAMES = CANONICAL_PRODUCTION_PROJECT.customDomains;
export const PLATFORM_HOSTNAME = CANONICAL_PRODUCTION_PROJECT.platformDomain;
export const PROMOTION_HOSTNAMES = PROMOTION_REQUIRED_DOMAINS;

export const RELEASE_RECORD_SCHEMA = "annus-mirabilis-release-record.v1" as const;

export interface ReleaseCandidateRecord {
  readonly schema: typeof RELEASE_RECORD_SCHEMA;
  readonly toolRunId: string;
  readonly createdAt: string;
  readonly commit: string;
  readonly profile: ReleaseProfile;
  readonly mode?: ReleaseScope | undefined;
  readonly logRunId?: string | undefined;
  readonly candidateUrl: string;
  readonly candidateDeploymentId: string;
  readonly candidateChecksPassed: boolean;
  readonly manifestDigest?: string | undefined;
  readonly determinismDigest?: string | undefined;
  readonly candidateCheckSummary?: string | undefined;
  readonly candidateCheckLogPath?: string | undefined;
  /** Each candidate check's own result, including the ones that did not run and why. */
  readonly candidateChecks?: readonly CandidateCheckResult[] | undefined;
  readonly authorizationRef?: string | undefined;
  readonly targetHostnames?: readonly string[] | undefined;
}

export type CommandResult = {
  stdout: string;
  stderr: string;
  status?: number | null;
};

export type SpawnFn = typeof spawnSync;

let activeSpawn: SpawnFn = spawnSync;

export function __setSpawnForTesting(fn: SpawnFn): void {
  activeSpawn = fn;
}

export function __resetSpawnForTesting(): void {
  activeSpawn = spawnSync;
}

export function toolRunArtifactDirectory(toolRunId: string = newToolRunId()): string {
  return path.join(process.cwd(), "artifacts", "verified-production-deploy", toolRunId);
}

/*
 * A FAILED COMMAND SAYS WHAT WENT WRONG (dispatch 476).
 *
 * THE DEFECT. `run` captured stderr and threw before reading it, so every captured command's failure
 * reached the operator as one line: "vercel exited with status 1." A deploy of 44 commits was refused
 * with exactly that and nobody could say why. The output was not lost in a log file; it was in
 * `result.stderr` in the same scope, discarded four lines later. AGENTS.md states the rule this broke,
 * in the swarm chapter: never silence stderr in a command whose output will be cited as evidence.
 *
 * WHY THE MESSAGE AND NOT A LOG. `main().catch` prints `error.message` and nothing else, so the
 * message is the entire diagnosis surface a person reading a refusal has.
 *
 * THE BOUND, and why these numbers. Vercel can emit thousands of lines. The last 40 of stderr is a
 * diagnosis; the whole buffer is a wall nobody reads, and `maxBuffer` here is 64 MiB. stdout is kept
 * too but shorter, at 10 lines, because tools that report failures on stdout put the reason last;
 * both are capped together at 4000 characters so one enormous line cannot defeat the line bound.
 *
 * WHAT IS NEVER PRINTED. The command's environment. A deploy environment can carry a token, and none
 * of it is read here: only the command name, its arguments and its own output. An argument naming a
 * path is kept, because a path is not its contents, and a value following a flag whose NAME says
 * token, secret, password or key is replaced, which is cheap insurance rather than the main defence.
 */
export const FAILED_COMMAND_STDERR_LINES = 40;
export const FAILED_COMMAND_STDOUT_LINES = 10;
export const FAILED_COMMAND_MAX_CHARS = 4000;

/** The last `lines` lines, then truncated to `maxChars` from the END, which is where the reason is. */
export function outputTail(text: string, lines: number, maxChars: number): string {
  const trimmed = text.replace(/\s+$/u, "");
  if (trimmed === "") return "";
  const kept = trimmed.split("\n").slice(-lines).join("\n");
  return kept.length <= maxChars ? kept : `...${kept.slice(kept.length - maxChars)}`;
}

const SECRET_FLAG = /(token|secret|password|passwd|credential|apikey|api-key|key)$/iu;

/**
 * The argument list as the operator needs to see it, with any value that FOLLOWS a secret-named flag
 * replaced. This is not a general secret scanner and does not pretend to be: the real guarantee is
 * that the environment is never read, and that nothing here opens a file an argument names.
 */
export function redactArgs(args: readonly string[]): string[] {
  const out: string[] = [];
  let redactNext = false;
  for (const arg of args) {
    if (redactNext) {
      out.push("<redacted>");
      redactNext = false;
      continue;
    }
    const inline = /^(--?[A-Za-z0-9-]+)=(.*)$/su.exec(arg);
    if (inline?.[1] !== undefined && SECRET_FLAG.test(inline[1])) {
      out.push(`${inline[1]}=<redacted>`);
      continue;
    }
    if (/^--?[A-Za-z0-9-]+$/u.test(arg) && SECRET_FLAG.test(arg)) {
      out.push(arg);
      redactNext = true;
      continue;
    }
    out.push(arg);
  }
  return out;
}

/**
 * What a failed command's refusal says. The status comes first, because it is the first thing to
 * know; the output follows it. When the command was not captured its output went straight to this
 * terminal, so the message says to look above rather than implying there was nothing.
 */
export function describeCommandFailure(
  command: string,
  args: readonly string[],
  captured: boolean,
  result: Readonly<{ status: number | null; stdout?: string | null; stderr?: string | null }>,
): string {
  const invocation = [command, ...redactArgs(args)].join(" ");
  const head = `${command} exited with status ${result.status ?? "unknown"}.`;
  if (!captured)
    return `${head} It ran as: ${invocation}. Its output was not captured and went to this terminal, so the reason is in the lines above.`;
  const stderr = outputTail(
    result.stderr ?? "",
    FAILED_COMMAND_STDERR_LINES,
    FAILED_COMMAND_MAX_CHARS,
  );
  const stdout = outputTail(
    result.stdout ?? "",
    FAILED_COMMAND_STDOUT_LINES,
    Math.max(0, FAILED_COMMAND_MAX_CHARS - stderr.length),
  );
  const parts = [`${head} It ran as: ${invocation}.`];
  if (stderr !== "")
    parts.push(`Last ${FAILED_COMMAND_STDERR_LINES} lines of its stderr:\n${stderr}`);
  if (stdout !== "")
    parts.push(`Last ${FAILED_COMMAND_STDOUT_LINES} lines of its stdout:\n${stdout}`);
  if (stderr === "" && stdout === "")
    parts.push("It wrote nothing to stdout or stderr, so the status code is all it said.");
  return parts.join("\n\n");
}

export function run(
  command: string,
  args: string[],
  capture = false,
  printCapturedOutput = true,
): CommandResult {
  const result = activeSpawn(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: capture ? ["ignore", "pipe", "pipe"] : ["ignore", "inherit", "inherit"],
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    // The output is read BEFORE the throw. It used to be discarded here and read four lines below,
    // which no failure ever reached.
    throw new Error(describeCommandFailure(command, args, capture, result));
  }

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  if (capture && printCapturedOutput) {
    process.stdout.write(stdout);
    process.stderr.write(stderr);
  }
  return { stdout, stderr, status: result.status };
}

export function filterTrackedWorkingTreeChanges(statusOutput: string): string {
  return statusOutput
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

export function trackedWorkingTreeChanges(): string {
  const status = run(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all"],
    true,
    false,
  ).stdout;
  return filterTrackedWorkingTreeChanges(status);
}

export function assertCleanTrackedWorkingTree(stage: string): void {
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

export function assertCommitUnchanged(expectedCommit: string, stage: string): void {
  const actualCommit = currentCommit();
  if (actualCommit.toLowerCase() !== expectedCommit.toLowerCase()) {
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

export function parseConflictingBuilds(
  processListOutput: string,
  currentPid = process.pid.toString(),
  isWorkspaceFn: (pid: string) => boolean = isProcessInCurrentWorkspace,
): string[] {
  return processListOutput.split("\n").filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    const parts = trimmed.split(/\s+/);
    const pid = parts[0];
    const ppid = parts[1];
    if (!pid) return false;
    if (pid === currentPid || ppid === currentPid) return false;
    const commandStr = parts.slice(3).join(" ");
    // A shell is never the build, however its command line reads. The shell that launched this very
    // deploy carries "bun run build" or "next build" in its argv when one command line runs both, and
    // it is an ancestor, so the pid/ppid check above cannot exclude it. Gate on the executable, as
    // AGENTS.md "Ask whether a build is running by gating on the EXECUTABLE" requires.
    const executable = (parts[3] ?? "").replace(/^-/, "").split("/").pop() ?? "";
    if (/^(?:zsh|bash|sh|dash|fish)$/.test(executable)) return false;
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
    if (!isWorkspaceFn(pid)) {
      return false;
    }
    return true;
  });
}

export function conflictingBuilds(): string[] {
  const currentPid = process.pid.toString();
  const processList = run("ps", ["-Ao", "pid=,ppid=,etime=,command="], true, false).stdout;
  return parseConflictingBuilds(processList, currentPid, isProcessInCurrentWorkspace);
}

export function assertNoConflictingBuilds(stage: string): void {
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

export function assertCompletePrebuiltArtifact(
  buildStartedAtMs: number,
  customOutputDir?: string,
  minFiles = 100,
): void {
  const outputDirectory = customOutputDir ?? path.join(process.cwd(), ".vercel", "output");
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
  if (fileCount < minFiles) {
    throw new Error(
      `Vercel output has only ${fileCount} files; a valid Annus Mirabilis release has a full static site.`,
    );
  }
}

export function deploymentUrl(output: string): string {
  const urls = output.match(/https:\/\/[^\s"']+\.vercel\.app/g) ?? [];
  const url = urls.at(-1);
  if (!url) throw new Error("Vercel did not return a deployment URL.");
  return url.replace(/[),.]$/, "");
}

export function parseProtectedPreviewStatus(
  output: string,
  marker = "__ANNUS_MIRABILIS_HTTP_STATUS__",
): { status: number; body: string } {
  const statusIndex = output.lastIndexOf(marker);
  if (statusIndex < 0) {
    return { status: 0, body: output };
  }
  const statusStr = output.slice(statusIndex + marker.length).trim();
  const status = Number.parseInt(statusStr, 10) || 0;
  const rawBody = output.slice(0, statusIndex);
  const body = rawBody.endsWith("\n") ? rawBody.slice(0, -1) : rawBody;
  return { status, body };
}

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

  const { status, body } = parseProtectedPreviewStatus(response, marker);
  if (status < 200 || status >= 300 || !body.includes(requiredText)) {
    throw new Error(
      `Release check failed for protected preview ${deployment}${pathName}: HTTP ${status || "unknown"}; required content was not present.`,
    );
  }
  return body;
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

export async function acquireDeploymentLock(): Promise<Server> {
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

export function assertQualityGatesResult(exitCode: number, stage = "preflight-gates"): void {
  if (exitCode === 2) {
    throw new Error(`${stage}: required quality gate step was unavailable (exit 2).`);
  }
  if (exitCode !== 0) {
    throw new Error(`${stage}: quality gate check failed with exit code ${exitCode}.`);
  }
}

export function determinePromotionHostnames(
  profile: ReleaseProfile,
  includeCustomDomains = false,
): readonly string[] {
  if (profile === "scaffold") {
    if (includeCustomDomains) {
      return PROMOTION_REQUIRED_DOMAINS;
    }
    return [PLATFORM_HOSTNAME];
  }
  if (profile === "preview") {
    if (includeCustomDomains) {
      return PROMOTION_REQUIRED_DOMAINS;
    }
    return [PLATFORM_HOSTNAME];
  }
  return PROMOTION_REQUIRED_DOMAINS;
}

export function executePromotionStateMachine(options: {
  candidateUrl: string;
  targetHostnames: readonly string[];
  aliasRunner: (candidateOrTarget: string, hostname: string) => CommandResult;
  inspectRunner: (hostname: string) => string;
  smokeRunner?: (() => void) | undefined;
}): {
  success: boolean;
  promoted: string[];
  rolledBack: boolean;
  previousAliases: Record<string, string>;
} {
  const previousAliases: Record<string, string> = {};
  const promoted: string[] = [];

  for (const hostname of options.targetHostnames) {
    try {
      const inspectText = options.inspectRunner(hostname);
      const parsed = parseDeploymentInspect(inspectText);
      if (parsed.url) {
        previousAliases[hostname] = parsed.url;
      }
    } catch {
      previousAliases[hostname] = "";
    }
  }

  const rollback = (failingSubject: string, err: unknown) => {
    const originalError = err instanceof Error ? err : new Error(String(err));
    const rollbackErrors: string[] = [];
    for (const movedHostname of [...promoted].reverse()) {
      const previousTarget = previousAliases[movedHostname];
      if (previousTarget) {
        try {
          options.aliasRunner(previousTarget, movedHostname);
        } catch (rbErr) {
          rollbackErrors.push(
            `Failed to restore ${movedHostname} to ${previousTarget}: ${rbErr instanceof Error ? rbErr.message : String(rbErr)}`,
          );
        }
      }
    }
    const rollbackSummary =
      rollbackErrors.length > 0
        ? `Rollback had errors: ${rollbackErrors.join("; ")}`
        : `Successfully rolled back ${promoted.length} hostname(s) to previous deployments.`;

    throw new Error(
      `Promotion failed on ${failingSubject}: ${originalError.message}. ${rollbackSummary}`,
    );
  };

  for (const hostname of options.targetHostnames) {
    try {
      options.aliasRunner(options.candidateUrl, hostname);
      promoted.push(hostname);
    } catch (err) {
      rollback(`hostname '${hostname}'`, err);
    }
  }

  if (options.smokeRunner) {
    try {
      options.smokeRunner();
    } catch (err) {
      rollback("smoke-test", err);
    }
  }

  return {
    success: true,
    promoted,
    rolledBack: false,
    previousAliases,
  };
}

/**
 * The release record this script writes today. No candidate check runs against the unpromoted
 * deployment yet (am-rel-candidate-checks-kc7y), so the record says exactly that: the checks are
 * not implemented and did not pass. Until 2026-09-24 this record hard-coded
 * the pass flag to true, so every release record claimed checks that never ran
 * (am-release-records-claim-unrun-checks-xxri). The direct deploy path still promotes, and the
 * record no longer lies about it. `--promote` refuses such a record, because nothing verified it.
 */
export function candidateRecordWithoutChecks(fields: {
  toolRunId: string;
  createdAt: string;
  commit: string;
  profile: ReleaseProfile;
  candidateUrl: string;
  authorizationRef?: string | undefined;
  targetHostnames?: readonly string[] | undefined;
}): ReleaseCandidateRecord {
  return {
    schema: RELEASE_RECORD_SCHEMA,
    toolRunId: fields.toolRunId,
    createdAt: fields.createdAt,
    commit: fields.commit,
    profile: fields.profile,
    candidateUrl: fields.candidateUrl,
    candidateDeploymentId: fields.candidateUrl,
    candidateChecksPassed: false,
    candidateCheckSummary:
      "not-implemented: no candidate check ran against this deployment (am-rel-candidate-checks-kc7y)",
    authorizationRef: fields.authorizationRef,
    targetHostnames: fields.targetHostnames,
  };
}

/**
 * The record once the candidate checks have run against the deployed candidate. It passes only
 * when every check in the catalogue ran and passed; a check that could not run is carried with
 * its reason and keeps candidateChecksPassed false (am-rel-candidate-checks-kc7y).
 */
export function candidateRecordWithChecks(
  record: ReleaseCandidateRecord,
  results: readonly CandidateCheckResult[],
): ReleaseCandidateRecord {
  return {
    ...record,
    candidateChecksPassed: allCandidateChecksPassed(results),
    candidateCheckSummary: summarizeCandidateChecks(results),
    candidateChecks: results,
  };
}

export function validatePromotePreconditions(options: {
  record: ReleaseCandidateRecord;
  currentHeadCommit: string;
  currentManifestDigest?: string | undefined;
}): void {
  if (options.record.schema !== RELEASE_RECORD_SCHEMA) {
    throw new Error(`Promote failed: invalid release record schema '${options.record.schema}'.`);
  }
  if (!options.record.candidateChecksPassed) {
    throw new Error(
      `Promote failed: candidate record '${options.record.toolRunId}' has failed candidate checks. Refusing to promote unverified deployment.`,
    );
  }
  if (options.record.commit.toLowerCase() !== options.currentHeadCommit.toLowerCase()) {
    throw new Error(
      `Promote failed: commit mismatch (candidate was built from ${options.record.commit}, but HEAD is ${options.currentHeadCommit}).`,
    );
  }
  if (
    options.record.manifestDigest &&
    options.currentManifestDigest &&
    options.record.manifestDigest !== options.currentManifestDigest
  ) {
    throw new Error(
      `Promote failed: release manifest digest mismatch (${options.record.manifestDigest} !== ${options.currentManifestDigest}).`,
    );
  }
}

export function getReleaseRecordPath(
  toolRunId: string,
  customDir?: string,
  commit?: string,
): string {
  const dir = customDir ?? path.join(process.cwd(), "artifacts", "releases");
  const fileName = commit ? `${commit}-${toolRunId}.json` : `${toolRunId}.json`;
  return path.join(dir, fileName);
}

export function saveReleaseCandidateRecord(
  record: ReleaseCandidateRecord,
  customDir?: string,
): string {
  const recordPath = getReleaseRecordPath(record.toolRunId, customDir, record.commit);
  const dir = path.dirname(recordPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(recordPath, JSON.stringify(record, null, 2), "utf8");
  return recordPath;
}

export function loadReleaseCandidate(
  identifier: string,
  customDir?: string,
): ReleaseCandidateRecord {
  if (fs.existsSync(identifier)) {
    const raw = fs.readFileSync(identifier, "utf8");
    return JSON.parse(raw) as ReleaseCandidateRecord;
  }
  const dir = customDir ?? path.join(process.cwd(), "artifacts", "releases");
  const directPath = path.join(dir, `${identifier}.json`);
  if (fs.existsSync(directPath)) {
    const raw = fs.readFileSync(directPath, "utf8");
    return JSON.parse(raw) as ReleaseCandidateRecord;
  }
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const fullPath = path.join(dir, file);
      try {
        const raw = fs.readFileSync(fullPath, "utf8");
        const record = JSON.parse(raw) as ReleaseCandidateRecord;
        if (
          record.toolRunId === identifier ||
          record.candidateDeploymentId === identifier ||
          record.candidateUrl === identifier ||
          file.includes(identifier)
        ) {
          return record;
        }
      } catch {
        // ignore unparseable or irrelevant records
      }
    }
  }
  throw new Error(
    `Candidate release record not found for identifier '${identifier}' (looked in ${dir}).`,
  );
}

export interface DeployCliOptions {
  profile?: ReleaseProfile | undefined;
  dryRun?: boolean | undefined;
  candidateOnly?: boolean | undefined;
  promote?: string | undefined;
  authorization?: string | undefined;
  includeCustomDomains?: boolean | undefined;
  help?: boolean | undefined;
}

export function parseCliArgs(args: string[]): DeployCliOptions {
  const options: DeployCliOptions = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--profile") {
      options.profile = args[++i] as ReleaseProfile;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--candidate-only") {
      options.candidateOnly = true;
    } else if (arg === "--promote") {
      options.promote = args[++i];
    } else if (arg === "--authorization") {
      options.authorization = args[++i];
    } else if (arg === "--include-custom-domains") {
      options.includeCustomDomains = true;
    }
  }
  return options;
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const options = parseCliArgs(argv);
  if (options.help) {
    console.log(
      "Usage: bun scripts/verified-production-deploy.ts --profile <scaffold|preview|launch> [--dry-run | --candidate-only | --promote <deployment-id-or-url>] [--authorization <path>] [--include-custom-domains]",
    );
    return;
  }

  const mode = options.promote ? "promote" : options.candidateOnly ? "candidate-only" : "deploy";

  const authPath = options.authorization;
  if (!options.dryRun && !authPath) {
    throw new Error(
      `Missing required --authorization <path> for mode '${mode}'. Every mutation mode requires an explicit authorization file.`,
    );
  }

  // Preflight check 1: canonical project identity linked
  // Requirement 2: Refuses before any build or network call if canonical project is unlinked/unconfigured.
  assertCanonicalProjectIdentity();

  if (!options.profile) {
    throw new Error("Missing required argument: --profile <scaffold|preview|launch>.");
  }
  const validProfiles: readonly ReleaseProfile[] = ["scaffold", "preview", "launch"];
  if (!validProfiles.includes(options.profile)) {
    throw new Error(
      `Invalid profile '${options.profile}'; must be one of: ${validProfiles.join(", ")}.`,
    );
  }

  const targetHostnames = determinePromotionHostnames(
    options.profile,
    !!options.includeCustomDomains,
  );

  const lock = await acquireDeploymentLock();
  try {
    assertNoConflictingBuilds("preflight");
    assertCleanTrackedWorkingTree("preflight");
    const headCommit = currentCommit();

    if (options.dryRun) {
      console.log(
        `[DRY-RUN] Verified deployment plan for profile '${options.profile}' (mode: ${mode})`,
      );
      console.log(`[DRY-RUN] Head commit: ${headCommit}`);
      console.log(`[DRY-RUN] Target hostnames: ${targetHostnames.join(", ")}`);
      return;
    }

    if (!authPath) {
      throw new Error(`Missing required --authorization <path> for mode '${mode}'.`);
    }

    const scope: ReleaseScope = mode === "candidate-only" ? "candidate-only" : "promote";
    const authResult = loadAndValidateAuthorization(authPath, {
      expectedCommit: headCommit,
      expectedProfile: options.profile,
      expectedScope: scope,
      targetHostnames: [...targetHostnames],
    });

    if (options.promote) {
      const record = loadReleaseCandidate(options.promote);
      validatePromotePreconditions({
        record,
        currentHeadCommit: headCommit,
      });

      const inspectOutput = run("vercel", ["inspect", record.candidateUrl], true).stdout;
      assertDeploymentReadyAndAliased(inspectOutput, targetHostnames);

      executePromotionStateMachine({
        candidateUrl: record.candidateUrl,
        targetHostnames,
        aliasRunner: (target, host) => run("vercel", ["alias", "set", target, host]),
        inspectRunner: (host) => run("vercel", ["inspect", host], true).stdout,
        smokeRunner: () => run("bun", ["scripts/smoke-test-deployment.ts"]),
      });
      return;
    }

    const gatesResult = activeSpawn(
      "bun",
      ["scripts/quality-gates.ts", "--profile", options.profile, "--fail-fast"],
      { encoding: "utf8" },
    );
    assertQualityGatesResult(gatesResult.status ?? 1, "preflight-quality-gates");

    assertNoConflictingBuilds("before-build");
    const buildStartedAt = Date.now();
    run("vercel", ["pull", "--yes"]);
    run("vercel", ["build", "--prod"]);
    assertCompletePrebuiltArtifact(buildStartedAt);

    assertNoConflictingBuilds("before-deploy");
    const deployResult = run("vercel", ["deploy", "--prebuilt", "--prod", "--skip-domain"], true);
    const candidateUrl = deploymentUrl(deployResult.stdout);

    const toolRunId = newToolRunId();
    const candidateRecord = candidateRecordWithoutChecks({
      toolRunId,
      createdAt: new Date().toISOString(),
      commit: headCommit,
      profile: options.profile,
      candidateUrl,
      authorizationRef: authResult.reference,
      targetHostnames,
    });
    saveReleaseCandidateRecord(candidateRecord);

    // What the unpromoted candidate serves, compared with the upload, before any alias moves.
    // The fetcher is shared with the browser probe, so the two checks that need a page to execute
    // run against the same authenticated bytes as the byte-identity checks. A probe that cannot
    // launch is not fatal here and is not excused either: both browser checks then report
    // not-available, neither is declared, and candidateChecksPassed stays false.
    const candidateFetcher = vercelCurlFetcher(candidateUrl);
    let probe: CandidateBrowserProbe | undefined;
    try {
      probe = await createCandidateBrowserProbe(candidateFetcher);
    } catch (error) {
      console.warn(
        `Candidate browser probe unavailable (${String(error).slice(0, 200)}); the accepted-WASM and typed-refusal checks will report not-available and candidateChecksPassed will stay false.`,
      );
    }
    let checks: Awaited<ReturnType<typeof runCandidateChecksAgainst>>;
    try {
      checks = await runCandidateChecksAgainst({
        fetcher: candidateFetcher,
        staticDir: path.join(process.cwd(), ".vercel/output/static"),
        probe,
      });
    } finally {
      await probe?.close();
    }
    saveReleaseCandidateRecord(candidateRecordWithChecks(candidateRecord, checks));
    for (const check of checks) {
      console.log(`candidate check ${check.name}: ${check.status}. ${check.detail}`);
    }
    if (checks.some((check) => check.status === "failed")) {
      console.error(
        `\nVerified production deployment refused: a candidate check failed on ${candidateUrl}; no alias moved. ${summarizeCandidateChecks(checks)}`,
      );
      process.exitCode = 1;
      return;
    }

    if (options.candidateOnly) {
      console.log(
        `Candidate deployment recorded: ${candidateUrl} (toolRunId: ${toolRunId}). No aliases moved.`,
      );
      return;
    }

    executePromotionStateMachine({
      candidateUrl,
      targetHostnames,
      aliasRunner: (target, host) => run("vercel", ["alias", "set", target, host]),
      inspectRunner: (host) => run("vercel", ["inspect", host], true).stdout,
      smokeRunner: () => run("bun", ["scripts/smoke-test-deployment.ts"]),
    });
  } finally {
    lock.close();
  }
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
