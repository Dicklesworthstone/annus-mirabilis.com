#!/usr/bin/env bun
/**
 * Reachability audit CLI script (am-edit-comprehension-protocol-ouih).
 * Walks the compiled/authored argument corpus and evaluates reachability
 * across the 5 accomplishment reach-sets (Appreciate, Explain, Predict, Derive, Critique).
 *
 * Crucially: this audit does NOT fail the build; it exits 0 with findings present.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ComprehensionLogger } from "../src/comprehension/logger.ts";
import { auditCorpusReachability } from "../src/comprehension/reachability.ts";
import type { Argument } from "../src/content/schemas/reading.ts";
import { reportPopulation } from "./gate-census/population.ts";

function loadArgumentsFromDir(dir: string): Argument[] {
  const args: Argument[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        args.push(...loadArgumentsFromDir(fullPath));
      } else if (entry.isFile() && entry.name.endsWith(".json") && entry.name.startsWith("arg-")) {
        try {
          const content = readFileSync(fullPath, "utf8");
          const parsed = JSON.parse(content);
          if (parsed && parsed.kind === "argument") {
            args.push(parsed as Argument);
          }
        } catch {
          // ignore unparseable scratch files
        }
      }
    }
  } catch {
    // Directory may not exist yet
  }
  return args;
}

function loadFoundationIds(dir: string): Set<string> {
  const ids = new Set<string>();
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".json")) {
        const id = entry.name.replace(/\.json$/, "");
        ids.add(id);
      }
    }
  } catch {
    // Directory may not exist yet
  }
  return ids;
}

export function runReachabilityAuditCli(): void {
  const rootDir = process.cwd();
  const argumentsDir = join(rootDir, "content/arguments");
  const foundationsDir = join(rootDir, "content/foundations");

  const args = loadArgumentsFromDir(argumentsDir);
  const foundationIds = loadFoundationIds(foundationsDir);

  const logger = new ComprehensionLogger(undefined, rootDir);

  const report = auditCorpusReachability(
    args,
    {
      rootDir,
      knownFoundationIds: foundationIds,
    },
    logger,
  );

  // The census line (am-rc1001-bridge-plan-pcjk.9). 48 argument nodes were measured on 2026-10-06, so
  // 40 is a floor a real corpus clears and a partial load does not. Printed beside the JSON line rather
  // than replacing it, since the JSON is what the audit's own consumers read.
  //
  // RECORDED WHILE ADDING THIS: the line below exits 0 unconditionally, with the comment "Always exit 0
  // as specified in acceptance criteria", so this registry step cannot fail however many findings it
  // reports. The census can now at least see what it examined. Changing its verdict belongs to its
  // owner, am-edit-comprehension-protocol-ouih.
  reportPopulation({
    gate: "audit-reachability",
    examined: report.totalNodes,
    noun: "argument nodes",
    minimum: 40,
  });

  console.log(
    JSON.stringify({
      event: "reachability-audit-complete",
      totalArguments: report.totalNodes,
      resolvedChecks: report.resolvedNodes,
      unresolvedFindings: report.unreachedNodes,
      toolRunId: report.toolRunId,
      exitCode: 0,
    }),
  );

  // Always exit 0 as specified in acceptance criteria
  process.exit(0);
}

const isMain =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  runReachabilityAuditCli();
}
