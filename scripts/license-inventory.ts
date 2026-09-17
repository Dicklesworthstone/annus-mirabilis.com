#!/usr/bin/env bun
/**
 * CLI tool for generating and checking third-party license inventory.
 * Bead: am-gov-license-inventory-w6yz
 *
 * Usage:
 *   bun scripts/license-inventory.ts --generate   # Generate and write THIRD_PARTY_NOTICES.md
 *   bun scripts/license-inventory.ts --check      # Verify inventory and fail if stale or invalid
 */

import { runLicenseInventoryCheck } from "./license-inventory/index.ts";

const args = process.argv.slice(2);
const shouldGenerate = args.includes("--generate") || args.includes("--write");

const result = runLicenseInventoryCheck({
  rootDir: process.cwd(),
  write: shouldGenerate,
});

process.exit(result.exitCode);
