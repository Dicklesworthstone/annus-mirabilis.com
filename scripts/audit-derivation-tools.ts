#!/usr/bin/env bun

/**
 * CLI for derivation tool audit (am-eq-derivation-chains-r4c).
 * Scans derivation chains and reports pending tool attachments or registry resolution errors.
 *
 * Usage:
 *   bun scripts/audit-derivation-tools.ts [--paper <slug>] [--chains <glob>] [--registry <path>]
 */

import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { parseYaml } from "../src/content/provenance/yaml.ts";
import {
  fixtureBrownianPedagogicalReconstruction,
  fixtureBrownianSourceOrder,
  fixtureLorentzMapConstruction,
  fixturePaper1WienEntropy,
  fixturePaper4TwoLedgers,
} from "../src/equations/derivations/fixtures.ts";
import { auditChainTools, type ToolAuditReport } from "../src/equations/derivations/toolAudit.ts";
import type { DerivationChain } from "../src/equations/derivations/types.ts";

export function newToolRunId(now: Date = new Date()): string {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const hex = randomBytes(4).toString("hex");
  return `${stamp}-${hex}`;
}

export function runAuditCli(argv: string[] = process.argv.slice(2)): {
  readonly report: ToolAuditReport;
  readonly toolRunId: string;
  readonly reportPath: string;
  readonly exitCode: number;
} {
  const { values } = parseArgs({
    args: argv,
    options: {
      paper: { type: "string" },
      chains: { type: "string" },
      registry: { type: "string" },
    },
    strict: false,
    allowPositionals: true,
  });

  const allChains: DerivationChain[] = [
    fixtureBrownianPedagogicalReconstruction,
    fixtureBrownianSourceOrder,
    fixturePaper1WienEntropy,
    fixturePaper4TwoLedgers,
    fixtureLorentzMapConstruction,
  ];

  let filteredChains = allChains;
  if (values.paper) {
    filteredChains = filteredChains.filter((c) => c.id.includes(values.paper as string));
  }

  let registrySet: Set<string> | null = null;
  if (values.registry) {
    const regPath = resolve(process.cwd(), values.registry as string);
    if (existsSync(regPath)) {
      const content = readFileSync(regPath, "utf8");
      const data = parseYaml(content);
      if (Array.isArray(data)) {
        registrySet = new Set(
          data.map((item: unknown) => {
            if (typeof item === "string") return item;
            if (typeof item === "object" && item !== null && "id" in item) {
              return String((item as { id: unknown }).id);
            }
            return "";
          }),
        );
      } else if (typeof data === "object" && data !== null) {
        const obj = data as Record<string, unknown>;
        if (Array.isArray(obj.foundations)) {
          registrySet = new Set(
            obj.foundations.map((f: unknown) => {
              if (typeof f === "object" && f !== null) {
                const item = f as Record<string, unknown>;
                return String(item.id || `foundation:${item.slug}`);
              }
              return String(f);
            }),
          );
        } else {
          registrySet = new Set(Object.keys(data));
        }
      }
    } else {
      registrySet = new Set();
    }
  }

  const report = auditChainTools(filteredChains, registrySet);
  const toolRunId = newToolRunId();
  const reportDir = join(process.cwd(), "artifacts/audits/derivation-tools", toolRunId);
  mkdirSync(reportDir, { recursive: true });
  const reportPath = join(reportDir, "report.jsonl");

  const lines: string[] = [];
  for (const p of report.pending) {
    lines.push(JSON.stringify({ status: "pending", ...p, toolRunId }));
  }
  for (const e of report.errors) {
    lines.push(JSON.stringify({ status: "error", ...e, toolRunId }));
  }
  writeFileSync(reportPath, lines.join("\n") + (lines.length > 0 ? "\n" : ""), "utf8");

  // Format table output
  console.log(`\n=== Derivation Tool Audit (${toolRunId}) ===`);
  console.log(
    `Total Steps: ${report.totalSteps} | Valid with Tool: ${report.validSteps} | Pending Tool: ${report.pending.length} | Errors: ${report.errors.length}`,
  );

  if (report.pending.length > 0) {
    console.log("\nPending Steps (Waiting for foundation attachment):");
    for (const p of report.pending) {
      console.log(
        `  [PENDING] ${p.chainId} -> ${p.stepId} (${p.reasonKind} / ${p.ruleKind}): "${p.r1Excerpt}"`,
      );
    }
  }

  if (report.errors.length > 0) {
    console.log("\nUnresolved Tool Errors:");
    for (const e of report.errors) {
      console.log(`  [ERROR] ${e.chainId} -> ${e.stepId}: ${e.reason}`);
    }
  }

  console.log(`\nDetailed report written to: ${reportPath}\n`);

  const exitCode = report.errors.length > 0 ? 1 : 0;
  return { report, toolRunId, reportPath, exitCode };
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("audit-derivation-tools.ts") ||
    resolve(process.argv[1]) === fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const { exitCode } = runAuditCli();
  process.exit(exitCode);
}
