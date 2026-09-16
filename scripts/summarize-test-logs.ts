import { readdirSync, readFileSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";
import { parseLogLine, type LogEvent, type Outcome } from "../src/testing/log/schema.ts";
import { artifactsRoot } from "../src/testing/log/logger.ts";

export interface SummaryFailure {
  suite: string;
  logRunId: string;
  testId: string;
  message?: string;
  evidence?: LogEvent["evidence"];
}

export interface ToolRunGroup {
  toolRunId: string;
  logRunIds: string[];
  eventCount: number;
}

export interface LogSummary {
  counts: Record<string, Record<Outcome, number>>;
  totalEvents: number;
  failures: SummaryFailure[];
  toolRuns: ToolRunGroup[];
}

function emptyCounts(): Record<Outcome, number> {
  return { passed: 0, failed: 0, skipped: 0, "not-available": 0 };
}

/** Pure core: takes parsed events, returns the summary. No I/O, so it is tested with in-memory fixtures. */
export function summarize(events: readonly LogEvent[]): LogSummary {
  const counts: Record<string, Record<Outcome, number>> = {};
  const failures: SummaryFailure[] = [];
  const toolRuns = new Map<string, { logRunIds: Set<string>; eventCount: number }>();

  for (const event of events) {
    const suiteCounts = counts[event.suite] ?? emptyCounts();
    if (event.outcome !== undefined) suiteCounts[event.outcome] += 1;
    counts[event.suite] = suiteCounts;

    if (event.outcome === "failed") {
      failures.push({
        suite: event.suite,
        logRunId: event.logRunId,
        testId: event.testId,
        ...(event.message !== undefined ? { message: event.message } : {}),
        ...(event.evidence !== undefined ? { evidence: event.evidence } : {}),
      });
    }

    if (event.toolRunId !== undefined) {
      const group = toolRuns.get(event.toolRunId) ?? { logRunIds: new Set<string>(), eventCount: 0 };
      group.logRunIds.add(event.logRunId);
      group.eventCount += 1;
      toolRuns.set(event.toolRunId, group);
    }
  }

  return {
    counts,
    totalEvents: events.length,
    failures,
    toolRuns: Array.from(toolRuns.entries()).map(([toolRunId, group]) => ({
      toolRunId,
      logRunIds: Array.from(group.logRunIds).sort(),
      eventCount: group.eventCount,
    })),
  };
}

function readEventsFromFile(filePath: string): LogEvent[] {
  return readFileSync(filePath, "utf8")
    .split("\n")
    .filter((line) => line.length > 0)
    .map(parseLogLine);
}

export interface CollectOptions {
  root?: string;
  suite?: string;
  logRunId?: string;
  toolRunId?: string;
}

/** Walks `artifacts/test-logs/<suite>/<log-run-id>.jsonl`, applying the CLI filters. */
export function collectEvents(options: CollectOptions = {}): LogEvent[] {
  const root = options.root ?? artifactsRoot();
  let suiteDirs: string[];
  try {
    suiteDirs = readdirSync(root).filter((entry) => statSync(path.join(root, entry)).isDirectory() && entry !== "summary");
  } catch {
    return [];
  }
  if (options.suite !== undefined) suiteDirs = suiteDirs.filter((dir) => dir === options.suite);

  const events: LogEvent[] = [];
  for (const suiteDir of suiteDirs) {
    const suitePath = path.join(root, suiteDir);
    for (const entry of readdirSync(suitePath)) {
      if (!entry.endsWith(".jsonl")) continue;
      const logRunId = entry.slice(0, -".jsonl".length);
      if (options.logRunId !== undefined && logRunId !== options.logRunId) continue;
      const fileEvents = readEventsFromFile(path.join(suitePath, entry));
      for (const event of fileEvents) {
        if (options.toolRunId !== undefined && event.toolRunId !== options.toolRunId) continue;
        events.push(event);
      }
    }
  }
  return events;
}

function parseArgs(argv: readonly string[]): CollectOptions {
  const options: CollectOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--run") options.logRunId = argv[++i];
    else if (arg === "--suite") options.suite = argv[++i];
    else if (arg === "--tool-run") options.toolRunId = argv[++i];
    // Not part of AGENTS.md's documented CLI; lets tests and CI point the
    // summarizer at a fixture or archived log directory instead of the live
    // artifacts/test-logs tree.
    else if (arg === "--root") options.root = argv[++i];
  }
  return options;
}

function printSummary(summary: LogSummary): void {
  console.log("Test log summary");
  console.log("=================");
  for (const [suite, outcomes] of Object.entries(summary.counts)) {
    console.log(`${suite}: passed=${outcomes.passed} failed=${outcomes.failed} skipped=${outcomes.skipped} not-available=${outcomes["not-available"]}`);
  }
  console.log(`total events: ${summary.totalEvents}`);
  if (summary.failures.length > 0) {
    console.log("\nFailures:");
    for (const failure of summary.failures) {
      const evidenceNote = failure.evidence ? ` evidence=${JSON.stringify(failure.evidence)}` : "";
      console.log(`  [${failure.suite}] ${failure.testId}: ${failure.message ?? "(no message)"}${evidenceNote}`);
    }
  }
  if (summary.toolRuns.length > 0) {
    console.log("\nTool runs:");
    for (const group of summary.toolRuns) {
      console.log(`  ${group.toolRunId}: ${group.eventCount} events across logRunIds [${group.logRunIds.join(", ")}]`);
    }
  }
}

function writeSummaryFile(summary: LogSummary, logRunId: string, root: string): string {
  const summaryDir = path.join(root, "summary");
  mkdirSync(summaryDir, { recursive: true });
  const target = path.join(summaryDir, `${logRunId}.json`);
  writeFileSync(target, JSON.stringify(summary, null, 2) + "\n", "utf8");
  return target;
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  const root = options.root ?? artifactsRoot();
  const events = collectEvents(options);
  const summary = summarize(events);
  printSummary(summary);
  const writtenLogRunId = options.logRunId ?? new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const target = writeSummaryFile(summary, writtenLogRunId, root);
  console.log(`\nWrote summary to ${target}`);
  return summary.failures.length > 0 ? 1 : 0;
}

const isMainModule = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().then((code) => process.exit(code));
}
