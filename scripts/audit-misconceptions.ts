#!/usr/bin/env bun
/**
 * CLI for the misconceptions audit (am-cm-audit-scripts-d34).
 */
import { readFileSync } from "node:fs";
import {
  auditMisconceptions,
  type MisconceptionAuditInput,
} from "../src/content/audits/misconceptions.ts";

const idx = process.argv.indexOf("--fixture");
const fixture = process.argv[idx + 1];
if (idx === -1 || !fixture) {
  console.error("Usage: bun scripts/audit-misconceptions.ts --fixture <file.json>");
  process.exit(2);
}
const raw = JSON.parse(readFileSync(fixture, "utf8")) as {
  papers: MisconceptionAuditInput["papers"];
  knownAnchors: string[];
  knownInstruments: string[];
  knownResults: string[];
  knownSources: string[];
};
const report = auditMisconceptions({
  papers: raw.papers,
  knownAnchors: new Set(raw.knownAnchors),
  knownInstruments: new Set(raw.knownInstruments),
  knownResults: new Set(raw.knownResults),
  knownSources: new Set(raw.knownSources),
});
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
