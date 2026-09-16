#!/usr/bin/env node
/**
 * Runs every test file bunfig.toml excludes from `bun test`, plus the
 * scripts/e2e suite, under node --experimental-strip-types --test.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  BUNFIG_RELATIVE_PATH,
  nodeOnlyTestArgs,
  nodeOnlyTestCommand,
} from "./quality-gates/bunfigNodeOnlyTests.ts";

export function runNodeOnlyTests(root: string = process.cwd()): number {
  const bunfigText = readFileSync(resolve(root, BUNFIG_RELATIVE_PATH), "utf8");
  const args = nodeOnlyTestArgs(bunfigText, root);
  const command = nodeOnlyTestCommand(args);
  console.log(`▶ ${command}`);
  const result = spawnSync("node", ["--experimental-strip-types", "--test", ...args], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) {
    console.error(`Failed to spawn node --test: ${result.error.message}`);
    return 1;
  }
  return result.status ?? (result.signal ? 1 : 0);
}

const isMain =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("run-node-only-tests.ts") ||
    pathToFileURL(process.argv[1]).href === import.meta.url);

if (isMain) {
  process.exit(runNodeOnlyTests());
}
