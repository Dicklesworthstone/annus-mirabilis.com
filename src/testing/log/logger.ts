import { randomBytes } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { type LogEvent, validateEvent } from "./schema.ts";

/**
 * Mints a `YYYYMMDDTHHMMSSZ-<8 hex>` identity from a cryptographic random
 * source. Used for both `logRunId` (one suite execution) and `toolRunId`
 * (a pipeline or tool run) — never for the experiment `runId`.
 */
export function newRunIdentity(): string {
  const compact = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  return `${compact}-${randomBytes(4).toString("hex")}`;
}

export function artifactsRoot(): string {
  return path.join(process.cwd(), "artifacts", "test-logs");
}

export function suiteLogPath(suite: string, logRunId: string): string {
  return path.join(artifactsRoot(), suite, `${logRunId}.jsonl`);
}

const registry = new Map<string, TestLogger>();

// One process-wide 'exit' listener flushes every live logger synchronously,
// rather than one listener per instance (which trips Node's max-listener
// warning once a suite creates more than ten loggers).
const liveLoggers = new Set<TestLogger>();
let exitHandlerInstalled = false;
function ensureExitHandlerInstalled(): void {
  if (exitHandlerInstalled) return;
  exitHandlerInstalled = true;
  process.on("exit", () => {
    for (const logger of liveLoggers) logger.flushSync();
  });
}

/**
 * One suite's JSONL writer for one process run. Buffers validated events and
 * writes them as a single append per flush so concurrent flushes on the same
 * logger cannot interleave partial lines within one file.
 */
export class TestLogger {
  readonly suite: string;
  readonly logRunId: string;
  readonly logRoot: string;
  private buffer: string[] = [];
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    suite: string,
    logRunId: string = newRunIdentity(),
    logRoot: string = artifactsRoot(),
  ) {
    this.suite = suite;
    this.logRunId = logRunId;
    this.logRoot = logRoot;
    liveLoggers.add(this);
    ensureExitHandlerInstalled();
  }

  get filePath(): string {
    return path.join(this.logRoot, this.suite, `${this.logRunId}.jsonl`);
  }

  /**
   * Validates and buffers one event; call `flush()` to persist it.
   * `suite` and `logRunId` always come from this logger's own identity, never
   * from `rawEvent`, so an event can never land in a file that disagrees with
   * its own recorded suite or log-run id.
   */
  log(rawEvent: Record<string, unknown>): LogEvent {
    const event = validateEvent({
      timestamp: new Date().toISOString(),
      ...rawEvent,
      suite: this.suite,
      logRunId: this.logRunId,
    });
    this.buffer.push(JSON.stringify(event));
    return event;
  }

  info(message: string, extra?: Record<string, unknown>): LogEvent {
    return this.log({
      testId: (extra?.testId as string) || message,
      message,
      outcome: "passed",
      extra,
    });
  }

  /** Flushes the buffer as one append call, serialized against concurrent flushes. */
  flush(): Promise<void> {
    if (this.buffer.length === 0) return this.writeQueue;
    const lines = this.buffer
      .splice(0, this.buffer.length)
      .map((line) => line + "\n")
      .join("");
    const target = this.filePath;
    this.writeQueue = this.writeQueue.then(async () => {
      await mkdir(path.dirname(target), { recursive: true });
      await appendFile(target, lines, "utf8");
    });
    return this.writeQueue;
  }

  /** Synchronous flush for process-exit handlers, where async work cannot complete. */
  flushSync(): void {
    if (this.buffer.length === 0) return;
    const lines = this.buffer
      .splice(0, this.buffer.length)
      .map((line) => line + "\n")
      .join("");
    const target = this.filePath;
    mkdirSync(path.dirname(target), { recursive: true });
    appendFileSync(target, lines, "utf8");
  }
}

/** One logger per (suite, logRunId) pair, shared across call sites within a process. */
export function getLogger(suite: string, logRunId?: string): TestLogger {
  const requestedKey = `${suite}::${logRunId ?? "__auto__"}`;
  const existing = registry.get(requestedKey);
  if (existing) return existing;
  const logger = new TestLogger(suite, logRunId);
  registry.set(requestedKey, logger);
  registry.set(`${suite}::${logger.logRunId}`, logger);
  return logger;
}

/** Test-only escape hatch so isolated tests do not share loggers across suites/run ids. */
export function resetLoggerRegistryForTests(): void {
  registry.clear();
  liveLoggers.clear();
}
