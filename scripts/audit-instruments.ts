#!/usr/bin/env bun
/**
 * CLI for the instrument audit (am-cm-audit-scripts-d34).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  auditInstruments,
  formatInstrumentAuditTable,
  type InstrumentAuditRow,
  loadLiveInstrumentRows,
} from "../src/content/audits/instruments.ts";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const idx = process.argv.indexOf("--fixture");
const fixture = idx !== -1 ? process.argv[idx + 1] : undefined;

let rows: readonly InstrumentAuditRow[];
if (fixture) {
  rows = JSON.parse(readFileSync(fixture, "utf8")) as InstrumentAuditRow[];
} else {
  rows = loadLiveInstrumentRows(root);
}

const report = auditInstruments(rows);
console.log(formatInstrumentAuditTable(report, rows));
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
}
process.exit(report.ok ? 0 : 1);
