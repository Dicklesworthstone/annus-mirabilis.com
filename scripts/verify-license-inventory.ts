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

import { runLicenseInventoryCheck } from "./license-inventory/index.ts";

const result = runLicenseInventoryCheck({
  rootDir: process.cwd(),
});

process.exit(result.exitCode);
