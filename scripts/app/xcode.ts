/**
 * Build or test the iPhone app on a named simulator, with Xcode's output kept
 * OUTSIDE the repository (docs/DECISIONS.md D-2026-09-23-apple-toolchain).
 *
 * DerivedData must never land under ios/: the architecture gate walks ios/, and
 * the bundled edition carries the web export's own `figures/plates/pages/`
 * directory, which the gate reads as a Pages Router root. That happened once,
 * on 2026-09-23, and turned `bun run check:architecture` red for every pane.
 *
 * Usage: `bun scripts/app/xcode.ts build|test [--device "AM iPhone 17"]`
 */

import { spawnSync } from "node:child_process";
import { existsSync, statfsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** From D-2026-09-23-apple-toolchain: refuse to build below this much free disk. */
export const DISK_FREE_GIGABYTES_MINIMUM = 10;
export const DEFAULT_DEVICE = "AM iPhone 17";

export const DERIVED_DATA_PATH = join(
  homedir(),
  "Library",
  "Developer",
  "Xcode",
  "DerivedData",
  "AnnusMirabilis-am",
);

/** True when `path` is the repository or anything inside it. */
export function isInsideRepository(repo: string, path: string): boolean {
  const rel = relative(resolve(repo), resolve(path));
  return rel === "" || !(rel === ".." || rel.startsWith("../") || isAbsolute(rel));
}

export type XcodeCommand = "build" | "test";

export function xcodebuildArguments(options: {
  readonly command: XcodeCommand;
  readonly device: string;
  readonly derivedDataPath: string;
  readonly resultBundlePath?: string;
}): string[] {
  const args = [
    "-project",
    "AnnusMirabilis.xcodeproj",
    "-scheme",
    "AnnusMirabilis",
    "-destination",
    `platform=iOS Simulator,name=${options.device}`,
    "-derivedDataPath",
    options.derivedDataPath,
  ];
  if (options.command === "test" && options.resultBundlePath !== undefined) {
    args.push("-resultBundlePath", options.resultBundlePath);
  }
  args.push(options.command);
  return args;
}

function main(argv: readonly string[]): number {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const command = argv[0];
  if (command !== "build" && command !== "test") {
    process.stderr.write(
      "usage: bun scripts/app/xcode.ts build|test [--device <simulator name>]\n",
    );
    return 2;
  }
  const deviceIndex = argv.indexOf("--device");
  const device = deviceIndex >= 0 ? (argv[deviceIndex + 1] ?? DEFAULT_DEVICE) : DEFAULT_DEVICE;

  if (isInsideRepository(repo, DERIVED_DATA_PATH)) {
    process.stderr.write(
      `xcode [derived-data-in-repository]: ${DERIVED_DATA_PATH} is inside ${repo}. Refusing.\n`,
    );
    return 1;
  }
  const stats = statfsSync(repo);
  const freeGigabytes = (stats.bavail * stats.bsize) / 1e9;
  if (freeGigabytes < DISK_FREE_GIGABYTES_MINIMUM) {
    process.stderr.write(
      `xcode [disk-below-floor]: ${freeGigabytes.toFixed(1)} GB free, the floor is ${DISK_FREE_GIGABYTES_MINIMUM} GB. Free space before building.\n`,
    );
    return 1;
  }
  if (!existsSync(join(repo, "generated", "app-edition", "edition-manifest.json"))) {
    process.stderr.write(
      "xcode [no-app-edition]: run `bun scripts/app/export-edition.ts` first.\n",
    );
    return 1;
  }

  const resultBundlePath =
    command === "test"
      ? join(
          DERIVED_DATA_PATH,
          "Results",
          `${new Date().toISOString().replace(/[:.]/g, "-")}.xcresult`,
        )
      : undefined;
  const args = xcodebuildArguments({
    command,
    device,
    derivedDataPath: DERIVED_DATA_PATH,
    ...(resultBundlePath === undefined ? {} : { resultBundlePath }),
  });
  process.stdout.write(`xcodebuild ${args.join(" ")}\n`);
  const run = spawnSync("xcodebuild", args, { cwd: join(repo, "ios"), stdio: "inherit" });
  if (resultBundlePath !== undefined) {
    process.stdout.write(`result bundle: ${resultBundlePath}\n`);
  }
  return run.status ?? 1;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
