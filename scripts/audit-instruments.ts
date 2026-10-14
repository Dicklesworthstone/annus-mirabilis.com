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
// Under --json the table is a human rendering beside a machine-readable report, so it goes to
// stderr: stdout is what a caller parses. Printing both to stdout made `--json` unparseable from
// the first byte (12427 bytes, "Expecting value at 0"), which is the same defect five gates had
// with their census line. Without --json the table stays where it was.
const table = formatInstrumentAuditTable(report, rows);
const printsJson = process.argv.includes("--json");
if (printsJson) {
  console.error(table);
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(table);
}
process.exit(report.ok ? 0 : 1);
