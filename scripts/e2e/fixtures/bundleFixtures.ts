/**
 * The one fixture bundler (am-test-e2e-harness-bqmh requirement 8): builds
 * every entry in `fixtureApps.ts`'s registry with `bun build` for the
 * browser target, with source maps and deterministic output names
 * (`FIXTURE_BUNDLE_OUTPUT_NAMES`), then copies each entry's `staticInputs`
 * byte for byte. There is never a second bundler.
 *
 * `bun build <entry> --outdir <outDir> --entry-naming bundle.js
 * --sourcemap=external --target=browser --format=esm` always emits exactly
 * `bundle.js` and `bundle.js.map`, verified deterministic (byte-identical
 * across two runs on the same input) in this module's own test.
 */

import { execFile } from "node:child_process";
import { realpathSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import type { FixtureAppEntry } from "./fixtureApps.ts";
import { FIXTURE_BUNDLE_OUTPUT_NAMES } from "./fixtureApps.ts";

const execFileAsync = promisify(execFile);

export interface FixtureBundleResult {
  readonly id: string;
  readonly outDir: string;
  readonly bundleFiles: readonly string[];
  readonly staticInputsCopied: readonly string[];
}

async function copyStaticInputs(
  entry: FixtureAppEntry,
  outDir: string,
  root: string,
): Promise<string[]> {
  const copied: string[] = [];
  for (const input of entry.staticInputs ?? []) {
    const from = resolve(root, input.from);
    const to = resolve(outDir, input.servedPath);
    await mkdir(dirname(to), { recursive: true });
    try {
      await copyFile(from, to);
    } catch (error) {
      throw new Error(
        `fixture application "${entry.id}" declares staticInputs.from "${input.from}", which does not exist at ${from}`,
        { cause: error },
      );
    }
    copied.push(input.servedPath);
  }
  return copied;
}

/** Bundles one registered fixture application and copies its staticInputs. */
export async function bundleFixtureApp(
  entry: FixtureAppEntry,
  root: string = realpathSync(process.cwd()),
): Promise<FixtureBundleResult> {
  const entryFile = resolve(root, entry.entry, "index.ts");
  const outDir = resolve(root, entry.outDir);
  await mkdir(outDir, { recursive: true });
  if (typeof Bun !== "undefined" && typeof Bun.build === "function") {
    const buildResult = await Bun.build({
      entrypoints: [entryFile],
      outdir: outDir,
      naming: "bundle.js",
      sourcemap: "external",
      target: "browser",
      format: "esm",
    });
    if (!buildResult.success) {
      throw new Error(`Failed to bundle fixture: ${buildResult.logs.map(String).join("\n")}`);
    }
  } else {
    const bunBin = process.execPath.includes("bun") ? process.execPath : "bun";
    await execFileAsync(
      bunBin,
      [
        "build",
        entryFile,
        "--outdir",
        outDir,
        "--entry-naming",
        "bundle.js",
        "--sourcemap=external",
        "--target=browser",
        "--format=esm",
      ],
      { env: process.env },
    );
  }
  const staticInputsCopied = await copyStaticInputs(entry, outDir, root);
  return { id: entry.id, outDir, bundleFiles: FIXTURE_BUNDLE_OUTPUT_NAMES, staticInputsCopied };
}

/** Bundles every registered application in order, failing on the first error. */
export async function bundleFixtureApps(
  registry: readonly FixtureAppEntry[],
  root: string = process.cwd(),
): Promise<FixtureBundleResult[]> {
  const results: FixtureBundleResult[] = [];
  for (const entry of registry) {
    results.push(await bundleFixtureApp(entry, root));
  }
  return results;
}

export function fixtureBundlePath(
  entry: Pick<FixtureAppEntry, "outDir">,
  root: string = process.cwd(),
): string {
  return join(resolve(root, entry.outDir), "bundle.js");
}
