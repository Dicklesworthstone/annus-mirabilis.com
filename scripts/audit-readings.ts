#!/usr/bin/env bun
/**
 * CLI for the readings audit (am-cm-audit-scripts-d34).
 * Pass --fixture <json> with a ReadingsAuditInput payload.
 */
import { readFileSync } from "node:fs";
import { auditReadings, type ReadingsAuditInput } from "../src/content/audits/readings.ts";

const idx = process.argv.indexOf("--fixture");
const fixture = process.argv[idx + 1];
if (idx === -1 || !fixture) {
  console.error("Usage: bun scripts/audit-readings.ts --fixture <file.json>");
  process.exit(2);
}
const input = JSON.parse(readFileSync(fixture, "utf8")) as ReadingsAuditInput;
const report = auditReadings(input);
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
