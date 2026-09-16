/**
 * Quality Gates Runner for annus-mirabilis.com
 *
 * Implements the quality gate execution engine supporting:
 * - Modes: --fail-fast (default for local runs), --all (for CI), --profile <scaffold|preview|launch> (for release verification)
 * - Filtering: --family <fast|browser|perf|apple>, --cadence <every-run|nightly|all>, --only <ids>
 * - Structured logging: JSONL output under artifacts/test-logs/quality-gates/<log-run-id>.jsonl
 * - Evidence retention on failure: logs/stdout/stderr saved for failed steps.
 *
 * Exit codes:
 * - 0: All executed and required steps passed
 * - 1: Any executed or required step failed
 * - 2: Refused (e.g. required step unavailable in profile mode)
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { generateLogRunId } from "./app-router-architecture.ts";
import {
  type GateCadence,
  type GateFamily,
  type GateOutcome,
  type GateProfile,
  type GateSkipReason,
  type GateStep,
  KNOWN_CADENCES,
  KNOWN_FAMILIES,
  KNOWN_PROFILES,
  QUALITY_GATE_STEPS,
  validateRegistry,
} from "./quality-gates/registry.ts";

export type RunnerMode = "fail-fast" | "all" | "profile";

export interface QualityGatesOptions {
  readonly rootDir?: string;
  readonly mode?: RunnerMode;
  readonly profile?: GateProfile;
  readonly family?: GateFamily | "all";
  readonly cadence?: GateCadence | "all";
  readonly only?: readonly string[];
  readonly steps?: readonly GateStep[];
  readonly logRunId?: string;
  readonly logsDir?: string;
  readonly silent?: boolean;
}

export interface StepExecutionResult {
  readonly stepId: string;
  readonly title: string;
  readonly owner: string;
  readonly family: GateFamily;
  readonly cadence: GateCadence;
  readonly command: readonly string[];
  readonly outcome: GateOutcome;
  readonly reason?: GateSkipReason | string;
  readonly exitCode: number | null;
  readonly durationMs: number;
  readonly message?: string;
  readonly stdout?: string;
  readonly stderr?: string;
}

export interface QualityGatesSummary {
  readonly logRunId: string;
  readonly mode: RunnerMode;
  readonly profile?: GateProfile;
  readonly cadence: GateCadence | "all";
  readonly family: GateFamily | "all";
  readonly outcome: "passed" | "failed" | "refused";
  readonly exitCode: number;
  readonly totalSteps: number;
  readonly passedCount: number;
  readonly failedCount: number;
  readonly notAvailableCount: number;
  readonly skippedCount: number;
  readonly refusedCount: number;
  readonly durationMs: number;
  readonly results: readonly StepExecutionResult[];
  readonly logPath?: string;
}

/**
 * Checks if a command-line tool exists in the environment PATH.
 */
export function isToolOnPath(tool: string): boolean {
  if (!tool) return false;
  const pathEnv = process.env.PATH || "";
  const pathDirs = pathEnv.split(delimiter);
  for (const dir of pathDirs) {
    if (!dir) continue;
    const fullPath = join(dir, tool);
    try {
      if (existsSync(fullPath)) {
        return true;
      }
    } catch {
      // Ignore filesystem permission errors during PATH search
    }
  }
  return false;
}

export interface AvailabilityCheckResult {
  readonly available: boolean;
  readonly kind: "available" | "script-missing" | "tool-missing";
  readonly details: string;
}

/**
 * Evaluates the availability of a gate step.
 */
export function checkStepAvailability(step: GateStep, rootDir: string): AvailabilityCheckResult {
  if (step.availability.scriptPath) {
    const fullScriptPath = resolve(rootDir, step.availability.scriptPath);
    if (!existsSync(fullScriptPath)) {
      return {
        available: false,
        kind: "script-missing",
        details: `Script '${step.availability.scriptPath}' does not exist on disk.`,
      };
    }
  }

  if (step.availability.tool) {
    const tool = step.availability.tool;
    const hasTool = isToolOnPath(tool);
    if (!hasTool) {
      // Check if tool is runnable via bun/npx in node_modules/.bin
      const localBin = join(rootDir, "node_modules", ".bin", tool);
      if (!existsSync(localBin)) {
        return {
          available: false,
          kind: "tool-missing",
          details: `Required tool '${tool}' was not found in PATH or node_modules/.bin.`,
        };
      }
    }
  }

  return {
    available: true,
    kind: "available",
    details: "All required scripts and tools are available.",
  };
}

/**
 * Main execution function for quality gates.
 */
export function runQualityGates(options: QualityGatesOptions = {}): QualityGatesSummary {
  const startTime = Date.now();
  const rootDir = options.rootDir || process.cwd();
  const rawMode: RunnerMode = options.profile ? "profile" : options.mode || "fail-fast";
  const profile: GateProfile | undefined = options.profile;
  const cadence: GateCadence | "all" =
    options.cadence || (rawMode === "profile" ? "all" : "every-run");
  const familyFilter: GateFamily | "all" = options.family || "all";
  const onlyFilter = options.only && options.only.length > 0 ? new Set(options.only) : null;
  const logRunId = options.logRunId || generateLogRunId();
  const silent = !!options.silent;

  const allSteps = options.steps || QUALITY_GATE_STEPS;
  const validation = validateRegistry(allSteps);
  if (!validation.valid) {
    if (!silent) {
      console.error(
        `🚨 Quality Gate Registry Invalid:\n${validation.errors.map((e) => `   - ${e}`).join("\n")}`,
      );
    }
    return {
      logRunId,
      mode: rawMode,
      profile,
      cadence,
      family: familyFilter,
      outcome: "refused",
      exitCode: 2,
      totalSteps: allSteps.length,
      passedCount: 0,
      failedCount: 0,
      notAvailableCount: 0,
      skippedCount: 0,
      refusedCount: 1,
      durationMs: Date.now() - startTime,
      results: [],
    };
  }

  // 1. Filter relevant steps
  const selectedSteps = allSteps.filter((step) => {
    if (onlyFilter && !onlyFilter.has(step.id)) {
      return false;
    }
    if (familyFilter !== "all" && step.family !== familyFilter) {
      return false;
    }
    if (rawMode === "profile" && profile) {
      if (!step.requiredInProfiles.includes(profile)) {
        return false;
      }
    }
    return true;
  });

  const results: StepExecutionResult[] = [];

  // 2. Profile mode pre-flight check: Refuse if ANY required step is unavailable
  if (rawMode === "profile" && profile) {
    for (const step of selectedSteps) {
      const avail = checkStepAvailability(step, rootDir);
      if (!avail.available) {
        if (!silent) {
          console.error(
            `\n🚨 Release Profile '${profile}' Refusal: Required step '${step.id}' is unavailable.`,
          );
          console.error(`   ${avail.details}`);
        }
        const refusalResult: StepExecutionResult = {
          stepId: step.id,
          title: step.title,
          owner: step.owner,
          family: step.family,
          cadence: step.cadence,
          command: step.command,
          outcome: "refused",
          reason: avail.kind === "tool-missing" ? "tool-unavailable" : "script-missing",
          exitCode: null,
          durationMs: 0,
          message: avail.details,
        };
        results.push(refusalResult);

        const summary: QualityGatesSummary = {
          logRunId,
          mode: rawMode,
          profile,
          cadence,
          family: familyFilter,
          outcome: "refused",
          exitCode: 2,
          totalSteps: selectedSteps.length,
          passedCount: 0,
          failedCount: 0,
          notAvailableCount: 0,
          skippedCount: 0,
          refusedCount: 1,
          durationMs: Date.now() - startTime,
          results,
        };
        writeStructuredLogs(rootDir, summary, options.logsDir);
        return summary;
      }
    }
  }

  if (!silent) {
    console.log(`\n======================================================`);
    console.log(`🛡️  Annus Mirabilis Quality Gates Chain`);
    console.log(
      `   Mode: ${rawMode} | Profile: ${profile || "none"} | Family: ${familyFilter} | Cadence: ${cadence}`,
    );
    console.log(`   Selected Steps: ${selectedSteps.length}`);
    console.log(`======================================================\n`);
  }

  // 3. Execute steps
  let hasFailed = false;

  for (let i = 0; i < selectedSteps.length; i++) {
    const step = selectedSteps[i];
    const stepHeader = `[${i + 1}/${selectedSteps.length}] ${step.title} (${step.id})`;

    // Check cadence filter
    if (cadence !== "all" && step.cadence !== cadence) {
      results.push({
        stepId: step.id,
        title: step.title,
        owner: step.owner,
        family: step.family,
        cadence: step.cadence,
        command: step.command,
        outcome: "skipped",
        reason: "cadence",
        exitCode: null,
        durationMs: 0,
        message: `Skipped: cadence is '${step.cadence}', current run cadence filter is '${cadence}'.`,
      });
      if (!silent) {
        console.log(`⏭️  ${stepHeader} -> Skipped (cadence: ${step.cadence})`);
      }
      continue;
    }

    // Check availability
    const avail = checkStepAvailability(step, rootDir);
    if (!avail.available) {
      if (avail.kind === "script-missing") {
        results.push({
          stepId: step.id,
          title: step.title,
          owner: step.owner,
          family: step.family,
          cadence: step.cadence,
          command: step.command,
          outcome: "not-available",
          reason: "script-missing",
          exitCode: null,
          durationMs: 0,
          message: avail.details,
        });
        if (!silent) {
          console.log(`⚠️  ${stepHeader} -> Not Available (${avail.details})`);
        }
      } else {
        // Tool missing
        results.push({
          stepId: step.id,
          title: step.title,
          owner: step.owner,
          family: step.family,
          cadence: step.cadence,
          command: step.command,
          outcome: "skipped",
          reason: "tool-unavailable",
          exitCode: null,
          durationMs: 0,
          message: avail.details,
        });
        if (!silent) {
          console.log(`⏭️  ${stepHeader} -> Skipped (${avail.details})`);
        }
      }
      continue;
    }

    // Execute step
    if (!silent) {
      console.log(`▶  ${stepHeader}...`);
      console.log(`   $ ${step.command.join(" ")}`);
    }

    const stepStart = Date.now();
    let procResult: {
      status: number | null;
      signal: string | null;
      stdout: Buffer;
      stderr: Buffer;
      error?: Error;
    };
    try {
      const [cmd, ...args] = step.command;
      let procResult = spawnSync(cmd, args, {
        cwd: rootDir,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      if (procResult.error && (procResult.error as NodeJS.ErrnoException).code === "EBADF") {
        for (let attempt = 1; attempt <= 3; attempt++) {
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50 * attempt);
          procResult = spawnSync(cmd, args, {
            cwd: rootDir,
            env: process.env,
            stdio: ["ignore", "pipe", "pipe"],
          });
          if (!procResult.error) break;
        }
      }
    } catch (err) {
      const stepDuration = Date.now() - stepStart;
      const errorMsg = (err as Error).message;
      results.push({
        stepId: step.id,
        title: step.title,
        owner: step.owner,
        family: step.family,
        cadence: step.cadence,
        command: step.command,
        outcome: "failed",
        exitCode: 1,
        durationMs: stepDuration,
        message: `Failed to spawn process: ${errorMsg}`,
      });
      hasFailed = true;
      if (!silent) {
        console.error(`✖  ${stepHeader} FAILED in ${stepDuration}ms: ${errorMsg}`);
      }
      if (rawMode === "fail-fast") {
        break;
      }
      continue;
    }

    const stepDuration = Date.now() - stepStart;
    const stdoutText = procResult.stdout ? procResult.stdout.toString("utf8") : "";
    const stderrText = procResult.stderr ? procResult.stderr.toString("utf8") : "";

    if (procResult.error) {
      results.push({
        stepId: step.id,
        title: step.title,
        owner: step.owner,
        family: step.family,
        cadence: step.cadence,
        command: step.command,
        outcome: "failed",
        exitCode: 1,
        durationMs: stepDuration,
        message: `Failed to execute process: ${procResult.error.message}`,
        stdout: stdoutText,
        stderr: stderrText,
      });
      hasFailed = true;
      if (!silent) {
        console.error(`✖  ${stepHeader} FAILED in ${stepDuration}ms: ${procResult.error.message}`);
      }
      if (rawMode === "fail-fast") {
        break;
      }
      continue;
    }

    const exitCode = procResult.status ?? (procResult.signal ? 1 : 0);

    if (exitCode === 0) {
      results.push({
        stepId: step.id,
        title: step.title,
        owner: step.owner,
        family: step.family,
        cadence: step.cadence,
        command: step.command,
        outcome: "passed",
        exitCode: 0,
        durationMs: stepDuration,
        stdout: stdoutText,
        stderr: stderrText,
      });
      if (!silent) {
        console.log(`✔  ${stepHeader} PASSED in ${stepDuration}ms`);
      }
    } else {
      results.push({
        stepId: step.id,
        title: step.title,
        owner: step.owner,
        family: step.family,
        cadence: step.cadence,
        command: step.command,
        outcome: "failed",
        exitCode,
        durationMs: stepDuration,
        message: `Command exited with code ${exitCode}`,
        stdout: stdoutText,
        stderr: stderrText,
      });
      hasFailed = true;
      if (!silent) {
        console.error(`\n✖  ${stepHeader} FAILED with exit code ${exitCode} in ${stepDuration}ms`);
        if (stderrText.trim().length > 0) {
          console.error(`--- stderr ---\n${stderrText}\n--------------`);
        }
        if (stdoutText.trim().length > 0) {
          console.error(`--- stdout ---\n${stdoutText}\n--------------`);
        }
      }
      if (rawMode === "fail-fast") {
        break;
      }
    }
  }

  const passedCount = results.filter((r) => r.outcome === "passed").length;
  const failedCount = results.filter((r) => r.outcome === "failed").length;
  const notAvailableCount = results.filter((r) => r.outcome === "not-available").length;
  const skippedCount = results.filter((r) => r.outcome === "skipped").length;
  const refusedCount = results.filter((r) => r.outcome === "refused").length;

  let overallOutcome: "passed" | "failed" | "refused" = "passed";
  let exitCode = 0;

  if (refusedCount > 0) {
    overallOutcome = "refused";
    exitCode = 2;
  } else if (failedCount > 0 || hasFailed) {
    overallOutcome = "failed";
    exitCode = 1;
  }

  const summary: QualityGatesSummary = {
    logRunId,
    mode: rawMode,
    profile,
    cadence,
    family: familyFilter,
    outcome: overallOutcome,
    exitCode,
    totalSteps: selectedSteps.length,
    passedCount,
    failedCount,
    notAvailableCount,
    skippedCount,
    refusedCount,
    durationMs: Date.now() - startTime,
    results,
  };

  const logPath = writeStructuredLogs(rootDir, summary, options.logsDir);
  const finalSummary = { ...summary, logPath };

  if (!silent) {
    console.log(`\n======================================================`);
    console.log(`📊 Quality Gates Summary`);
    console.log(`   Status:        ${overallOutcome.toUpperCase()} (exit code: ${exitCode})`);
    console.log(`   Duration:      ${summary.durationMs}ms`);
    console.log(`   Steps Passed:  ${passedCount}`);
    console.log(`   Steps Failed:  ${failedCount}`);
    console.log(`   Not Available: ${notAvailableCount}`);
    console.log(`   Skipped:       ${skippedCount}`);
    console.log(`   Refused:       ${refusedCount}`);
    if (logPath) {
      console.log(`   Log File:      ${logPath}`);
    }
    console.log(`======================================================\n`);
  }

  return finalSummary;
}

/**
 * Writes JSONL structured logs and failure evidence.
 */
function writeStructuredLogs(
  rootDir: string,
  summary: QualityGatesSummary,
  customLogsDir?: string,
): string {
  const logsDir = customLogsDir || join(rootDir, "artifacts", "test-logs", "quality-gates");
  mkdirSync(logsDir, { recursive: true });

  const logFile = join(logsDir, `${summary.logRunId}.jsonl`);
  const lines: string[] = [];
  const timestamp = new Date().toISOString();

  // 1. One JSON line per step
  for (const r of summary.results) {
    const entry = {
      timestamp,
      suite: "quality-gates",
      logRunId: summary.logRunId,
      mode: summary.mode,
      profile: summary.profile || null,
      cadence: summary.cadence,
      stepId: r.stepId,
      owner: r.owner,
      family: r.family,
      command: r.command,
      outcome: r.outcome,
      reason: r.reason || null,
      exitCode: r.exitCode,
      durationMs: r.durationMs,
      message: r.message || null,
    };
    lines.push(JSON.stringify(entry));
  }

  // 2. Summary line
  const summaryEntry = {
    timestamp,
    suite: "quality-gates",
    logRunId: summary.logRunId,
    mode: summary.mode,
    profile: summary.profile || null,
    cadence: summary.cadence,
    family: summary.family,
    outcome: summary.outcome,
    exitCode: summary.exitCode,
    totalSteps: summary.totalSteps,
    passedCount: summary.passedCount,
    failedCount: summary.failedCount,
    notAvailableCount: summary.notAvailableCount,
    skippedCount: summary.skippedCount,
    refusedCount: summary.refusedCount,
    durationMs: summary.durationMs,
  };
  lines.push(JSON.stringify(summaryEntry));

  writeFileSync(logFile, `${lines.join("\n")}\n`, "utf8");

  // 3. Retain evidence for failed steps
  const failedSteps = summary.results.filter(
    (r) => r.outcome === "failed" || r.outcome === "refused",
  );
  if (failedSteps.length > 0) {
    const evidenceDir = join(logsDir, summary.logRunId, "evidence");
    mkdirSync(evidenceDir, { recursive: true });
    for (const failed of failedSteps) {
      if (failed.stdout) {
        writeFileSync(join(evidenceDir, `${failed.stepId}.stdout.txt`), failed.stdout, "utf8");
      }
      if (failed.stderr) {
        writeFileSync(join(evidenceDir, `${failed.stepId}.stderr.txt`), failed.stderr, "utf8");
      }
      writeFileSync(
        join(evidenceDir, `${failed.stepId}.meta.json`),
        JSON.stringify(failed, null, 2),
        "utf8",
      );
    }
  }

  return logFile;
}

/**
 * Parses CLI arguments.
 */
export function parseCliArgs(argv: string[]): QualityGatesOptions {
  const options: {
    mode?: RunnerMode;
    profile?: GateProfile;
    family?: GateFamily | "all";
    cadence?: GateCadence | "all";
    only?: string[];
  } = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--fail-fast") {
      options.mode = "fail-fast";
    } else if (arg === "--all") {
      options.mode = "all";
    } else if (arg === "--profile") {
      const val = argv[++i];
      if (KNOWN_PROFILES.includes(val as GateProfile)) {
        options.profile = val as GateProfile;
      } else {
        console.error(`Unknown profile '${val}'. Expected one of: ${KNOWN_PROFILES.join(", ")}`);
        process.exit(2);
      }
    } else if (arg === "--family") {
      const val = argv[++i];
      if (val === "all" || KNOWN_FAMILIES.includes(val as GateFamily)) {
        options.family = val as GateFamily | "all";
      } else {
        console.error(
          `Unknown family '${val}'. Expected one of: ${KNOWN_FAMILIES.join(", ")}, all`,
        );
        process.exit(1);
      }
    } else if (arg === "--cadence") {
      const val = argv[++i];
      if (val === "all" || KNOWN_CADENCES.includes(val as GateCadence)) {
        options.cadence = val as GateCadence | "all";
      } else {
        console.error(
          `Unknown cadence '${val}'. Expected one of: ${KNOWN_CADENCES.join(", ")}, all`,
        );
        process.exit(1);
      }
    } else if (arg === "--only") {
      const val = argv[++i];
      if (val) {
        options.only = (options.only || []).concat(val.split(",").map((s) => s.trim()));
      }
    }
  }

  return options;
}

// Auto-run if executed directly as a script
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("quality-gates.ts") ||
    pathToFileURL(process.argv[1]).href === import.meta.url);

if (isMain) {
  const parsedOptions = parseCliArgs(process.argv.slice(2));
  const summary = runQualityGates({
    rootDir: process.cwd(),
    ...parsedOptions,
  });
  process.exit(summary.exitCode);
}
