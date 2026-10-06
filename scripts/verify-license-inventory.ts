#!/usr/bin/env bun

/**
 * Verification script for third-party license inventory.
 * Quality gate step: 'license-inventory'
 * Bead: am-gov-license-inventory-w6yz
 *
 * Requirements:
 * - Checks all production dependencies, fonts, vendored code, donor extractions, and WASM artifacts.
 * - Rejects any unlicensed material or unapproved licenses.
 * - Rejects stale committed THIRD_PARTY_NOTICES.md.
 * - Emits structured JSONL logs under artifacts/test-logs/license-inventory/<log-run-id>.jsonl
 */

import { reportPopulation } from "./gate-census/population.ts";
import { runLicenseInventoryCheck } from "./license-inventory/index.ts";

const result = runLicenseInventoryCheck({
  rootDir: process.cwd(),
});

// The census line (am-rc1001-bridge-plan-pcjk.9). The population is the inventory ITEMS: a run that
// built an inventory of three would report "no policy violations" and read as a clean inventory.
// Measured 2026-10-06: 82 items, 75 of them against a settled rights position and 7 exempt pending an
// owner ruling (am-gov-decision-license-rights-tps). The floor is 40.
const censusVacuous = reportPopulation({
  gate: "license-inventory",
  examined: result.inventory.items.length,
  noun: "license inventory items",
  minimum: 40,
});

process.exit(censusVacuous ? 1 : result.exitCode);
