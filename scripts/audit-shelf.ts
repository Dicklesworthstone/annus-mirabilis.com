#!/usr/bin/env bun
/**
 * CLI for the shelf audit (am-cm-audit-scripts-d34).
 *
 * With no arguments it audits the cards the four journeys render, through auditLiveShelves, the
 * same function verify-content calls, so the two cannot disagree (am-rc1001-bridge-plan-pcjk.12).
 * Until 2026-10-02 it accepted only --fixture. --fixture <file.json> still audits a fixture.
 */
import { readFileSync } from "node:fs";
import { auditShelf, type ShelfAuditInput } from "../src/content/audits/shelf.ts";
import { auditLiveShelves } from "../src/content/audits/shelfLive.ts";

const idx = process.argv.indexOf("--fixture");
let report: ReturnType<typeof auditShelf>;
if (idx === -1) {
  const live = auditLiveShelves();
  console.error(`[audit-shelf] examined ${live.cards} cards on ${live.shelves} shelves`);
  report = live.report;
} else {
  const fixture = process.argv[idx + 1];
  if (!fixture) {
    console.error("Usage: bun scripts/audit-shelf.ts [--fixture <file.json>]");
    process.exit(2);
  }
  report = auditShelf(JSON.parse(readFileSync(fixture, "utf8")) as ShelfAuditInput);
}
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
