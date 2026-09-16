#!/usr/bin/env bun
/**
 * CLI for the instrument audit (am-cm-audit-scripts-d34).
 */
import { readFileSync } from "node:fs";
import { auditInstruments, type InstrumentAuditRow } from "../src/content/audits/instruments.ts";

const idx = process.argv.indexOf("--fixture");
const fixture = process.argv[idx + 1];
if (idx === -1 || fixture === undefined) {
  console.error("Usage: bun scripts/audit-instruments.ts --fixture <file.json>");
  process.exit(2);
}
const rows = JSON.parse(readFileSync(fixture, "utf8")) as InstrumentAuditRow[];
const report = auditInstruments(rows);
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
