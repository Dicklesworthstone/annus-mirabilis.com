#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
/**
 * Run one FrankenSim probe command. Keep the transcript. Never retry.
 */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ASUPERSYNC_PIN, classifyProbeFailure, FRANKENSIM_PIN } from "../src/testing/probeCopy.ts";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PIN = FRANKENSIM_PIN;

function newLogRunId(): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  const hex = createHash("sha256")
    .update(`${stamp}-${process.pid}-${performance.now()}`)
    .digest("hex")
    .slice(0, 8);
  return `${stamp}-${hex}`;
}

function main(): Promise<number> {
  const dash = process.argv.indexOf("--");
  if (dash < 4 || process.argv.length <= dash + 1) {
    process.stderr.write("usage: run-frankensim-probe.ts TEST_ID TARGET -- command...\n");
    return Promise.resolve(2);
  }
  const testId = process.argv[2];
  const target = process.argv[3];
  const cmd = process.argv.slice(dash + 1);
  if (testId === undefined || target === undefined) return Promise.resolve(2);

  const logRunId = process.env.PROBE_LOG_RUN_ID ?? newLogRunId();
  const buildRoot =
    process.env.PROBE_BUILD_ROOT ??
    join(REPO, "artifacts/wasm-build", `probe-${PIN}`, "20260915T204024Z-fa82f3e8");
  const cwd = process.env.PROBE_CWD ?? join(buildRoot, "frankensim");
  const probeLog = join(REPO, "artifacts/frankensim-probe", logRunId);
  const testLog = join(REPO, "artifacts/test-logs/frankensim-probe", `${logRunId}.jsonl`);
  mkdirSync(probeLog, { recursive: true });
  mkdirSync(dirname(testLog), { recursive: true });
  mkdirSync(join(buildRoot, "logs"), { recursive: true });
  mkdirSync(join(buildRoot, "env"), { recursive: true });

  const env = { ...process.env };
  const started = Date.now();
  const ts = new Date().toISOString();

  return new Promise((resolvePromise) => {
    const child = spawn(cmd[0] ?? "false", cmd.slice(1), {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout?.on("data", (chunk) => {
      const text = chunk.toString();
      out += text;
      process.stderr.write(text);
    });
    child.stderr?.on("data", (chunk) => {
      const text = chunk.toString();
      out += text;
      process.stderr.write(text);
    });
    child.on("close", (code, signal) => {
      const durationMs = Date.now() - started;
      const exitCode = code ?? (signal ? 1 : 0);
      const outcome = exitCode === 0 ? "pass" : "fail";
      const transcript = join(probeLog, `${testId}.transcript.txt`);
      writeFileSync(transcript, out);
      if (exitCode !== 0) {
        const envPath = join(probeLog, `${testId}.env.txt`);
        const envLines = Object.keys(env)
          .filter(
            (k) =>
              k.startsWith("RCH_") ||
              k.startsWith("CARGO_") ||
              k.startsWith("RUST") ||
              ["PATH", "PWD", "HOME"].includes(k),
          )
          .sort()
          .map((k) => `${k}=${env[k]}\n`)
          .join("");
        writeFileSync(envPath, envLines);
        writeFileSync(join(buildRoot, "env", `${testId}.env.txt`), envLines);
        writeFileSync(join(buildRoot, "logs", `${testId}.transcript.txt`), out);
      }
      const failureClass = exitCode === 0 ? "none" : classifyProbeFailure(out);
      const record = {
        timestamp: ts,
        suite: "frankensim-probe",
        logRunId,
        testId,
        beadId: process.env.PROBE_BEAD_ID ?? "am-fs-probe-copy-incomplete-hy6a",
        outcome,
        durationMs,
        message: `${testId} exit ${exitCode} in ${durationMs}ms class=${failureClass}`,
        extra: {
          command: cmd,
          workingDirectory: resolve(cwd),
          frankensimRevision: PIN,
          siblingRevisions: { asupersync: ASUPERSYNC_PIN },
          toolchain: "nightly-2026-07-06",
          target,
          exitCode,
          signal,
          failureClass,
          transcriptPath: transcript,
          cargoTargetDir: env.CARGO_TARGET_DIR ?? null,
          rchVisibility: env.RCH_VISIBILITY ?? null,
        },
      };
      const line = `${JSON.stringify(record)}\n`;
      appendFileSync(join(probeLog, "probe.jsonl"), line);
      appendFileSync(testLog, line);
      process.stdout.write(
        `LOGGED ${testId} outcome=${outcome} exit=${exitCode} durationMs=${durationMs} class=${failureClass}\n`,
      );
      resolvePromise(0);
    });
  });
}

main().then((code) => process.exit(code));
