#!/usr/bin/env bun
/**
 * CLI for the shelf audit (am-cm-audit-scripts-d34).
 */
import { readFileSync } from "node:fs";
import { auditShelf, type ShelfAuditInput } from "../src/content/audits/shelf.ts";

const idx = process.argv.indexOf("--fixture");
const fixture = process.argv[idx + 1];
if (idx === -1 || !fixture) {
  console.error("Usage: bun scripts/audit-shelf.ts --fixture <file.json>");
  process.exit(2);
}
const input = JSON.parse(readFileSync(fixture, "utf8")) as ShelfAuditInput;
const report = auditShelf(input);
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
