/**
 * The local Apple gate for the iPhone app (App plan §14.2; bead
 * am-app-apple-quality-gate-q6gs). Each step is one registry entry in
 * scripts/quality-gates/registry.ts, family "apple", and runs as
 *
 *   bun scripts/app/apple-quality.ts --step <id>
 *
 * exiting 0 when it passes and 1 when it fails, with the reason and the repair
 * on stderr. `bun run gates:apple` runs them in order through the shared runner.
 * The website's gates never run this family; it builds with Xcode.
 *
 * Every step appends one JSON line to artifacts/test-logs/app-apple-gate/<logRunId>.jsonl.
 * Test counts come from the .xcresult bundle, never from console text.
 *
 * Xcode's output goes to DERIVED_DATA_PATH outside the repository (scripts/app/xcode.ts),
 * not under ios/: the bundled edition carries a `pages` directory, which the
 * architecture gate refuses anywhere under ios/.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statfsSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { newRunIdentity } from "../../src/testing/log/logger.ts";
import {
  ASSET_CATALOG,
  decodePng,
  ICON_SIZE,
  iconPalettes,
  MARK_SIZE,
  rasterize,
} from "./generate-app-icon.ts";
import { ensureSimulators } from "./simulators.ts";
import { DERIVED_DATA_PATH, isInsideRepository } from "./xcode.ts";

export { APPLE_STEPS, type AppleStepId } from "./apple-steps.ts";

import type { AppleStepId } from "./apple-steps.ts";
import { APPLE_STEPS } from "./apple-steps.ts";

export type StepVerdict = {
  readonly outcome: "passed" | "failed";
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
};

export type AppleToolchain = {
  readonly xcode: string;
  readonly xcodeBuild: string;
  readonly xcodegen: string;
  readonly swiftlint: string;
  readonly swiftFormat: string;
  readonly diskFreeGigabytesMinimum: number;
  readonly simulators: readonly { readonly name: string }[];
};

/** The `apple-toolchain` block of docs/DECISIONS.md, or null when absent. */
export function parseAppleToolchain(decisions: string): AppleToolchain | null {
  const match = /```yaml apple-toolchain\n([\s\S]*?)```/.exec(decisions);
  if (match === null) {
    return null;
  }
  const block = yaml.load(match[1] ?? "") as Partial<AppleToolchain>;
  if (
    typeof block.xcode !== "string" ||
    typeof block.xcodeBuild !== "string" ||
    typeof block.xcodegen !== "string" ||
    typeof block.swiftlint !== "string" ||
    typeof block.swiftFormat !== "string" ||
    typeof block.diskFreeGigabytesMinimum !== "number"
  ) {
    return null;
  }
  return block as AppleToolchain;
}

export type ObservedTools = {
  readonly xcode: string | null;
  readonly xcodeBuild: string | null;
  readonly xcodegen: string | null;
  readonly swiftlint: string | null;
  readonly swiftFormat: string | null;
};

/** `xcodebuild -version` prints "Xcode 26.1.1" then "Build version 17B100". */
export function parseXcodeVersion(text: string): {
  xcode: string | null;
  xcodeBuild: string | null;
} {
  return {
    xcode: /^Xcode (\S+)/m.exec(text)?.[1] ?? null,
    xcodeBuild: /^Build version (\S+)/m.exec(text)?.[1] ?? null,
  };
}

/** `xcodegen --version` prints "Version: 2.46.0". */
export function parseXcodegenVersion(text: string): string | null {
  return /Version:\s*(\S+)/.exec(text)?.[1] ?? null;
}

/** One sentence per tool whose version differs from the decision, naming both versions and the install. */
export function toolchainMismatches(expected: AppleToolchain, observed: ObservedTools): string[] {
  const rows: [string, string, string | null, string][] = [
    [
      "Xcode",
      expected.xcode,
      observed.xcode,
      "install that Xcode, or update the decision after rerunning the WebKit probe",
    ],
    ["Xcode build", expected.xcodeBuild, observed.xcodeBuild, "install that Xcode build"],
    [
      "XcodeGen",
      expected.xcodegen,
      observed.xcodegen,
      "brew install xcodegen, at the recorded version",
    ],
    [
      "SwiftLint",
      expected.swiftlint,
      observed.swiftlint,
      "brew install swiftlint, at the recorded version",
    ],
    [
      "swift-format",
      expected.swiftFormat,
      observed.swiftFormat,
      "it ships with Xcode; install the recorded Xcode",
    ],
  ];
  return rows
    .filter(([, want, have]) => want !== have)
    .map(
      ([tool, want, have, repair]) =>
        `${tool} is ${have ?? "not installed"}, the decision records ${want}: ${repair}.`,
    );
}

export function diskVerdict(freeGigabytes: number, floorGigabytes: number): StepVerdict {
  const free = freeGigabytes.toFixed(1);
  return freeGigabytes >= floorGigabytes
    ? { outcome: "passed", message: `${free} GB free, floor ${floorGigabytes} GB.` }
    : {
        outcome: "failed",
        message: `${free} GB free, below the ${floorGigabytes} GB floor in D-2026-09-23-apple-toolchain. Free space before building; do not lower the floor to pass.`,
      };
}

export type XcresultSummary = {
  readonly result: string;
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly failures: readonly string[];
  readonly device: string | null;
  readonly osVersion: string | null;
  readonly udid: string | null;
};

/** `xcrun xcresulttool get test-results summary --compact`, reduced to what the gate reports. */
export function summarizeXcresult(json: unknown): XcresultSummary | null {
  if (typeof json !== "object" || json === null) {
    return null;
  }
  const d = json as Record<string, unknown>;
  const count = (key: string) => (typeof d[key] === "number" ? (d[key] as number) : null);
  const total = count("totalTestCount");
  const passed = count("passedTests");
  const failed = count("failedTests");
  const skipped = count("skippedTests");
  if (
    typeof d.result !== "string" ||
    total === null ||
    passed === null ||
    failed === null ||
    skipped === null
  ) {
    return null;
  }
  const failures = Array.isArray(d.testFailures)
    ? d.testFailures.map((entry) => {
        const f = entry as Record<string, unknown>;
        return `${String(f.testIdentifierString ?? f.testName ?? "?")}: ${String(f.failureText ?? "")}`;
      })
    : [];
  const config = Array.isArray(d.devicesAndConfigurations)
    ? (d.devicesAndConfigurations[0] as { device?: Record<string, unknown> } | undefined)
    : undefined;
  const device = config?.device;
  return {
    result: d.result,
    total,
    passed,
    failed,
    skipped,
    failures,
    device: typeof device?.deviceName === "string" ? device.deviceName : null,
    osVersion: typeof device?.osVersion === "string" ? device.osVersion : null,
    udid: typeof device?.deviceId === "string" ? device.deviceId : null,
  };
}

/** A test run passes only when xcodebuild succeeded, the bundle says Passed, and it ran something. */
export function testVerdict(
  label: string,
  exitCode: number | null,
  summary: XcresultSummary | null,
): StepVerdict {
  if (summary === null) {
    return {
      outcome: "failed",
      message: `${label}: no readable .xcresult summary (xcodebuild exit ${exitCode}).`,
    };
  }
  const counts = `${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped of ${summary.total}`;
  if (summary.total === 0) {
    return { outcome: "failed", message: `${label}: ran 0 tests. An empty run is not a pass.` };
  }
  if (exitCode !== 0 || summary.result !== "Passed" || summary.failed > 0) {
    return {
      outcome: "failed",
      message: `${label}: ${counts}. ${summary.failures.slice(0, 5).join(" | ")}`,
      details: { ...summary },
    };
  }
  return { outcome: "passed", message: `${label}: ${counts}.`, details: { ...summary } };
}

// ---------------------------------------------------------------------------
// The steps. Everything below touches the machine.

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const IOS = join(REPO, "ios");
const DEVICE = process.env.AM_APPLE_DEVICE ?? "AM iPhone 17";

function run(command: string, args: readonly string[], cwd = REPO) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  return {
    status: result.status,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    missing: (result.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT",
  };
}

function lastLines(text: string, count: number): string {
  return text.split("\n").slice(-count).join("\n");
}

function toolchain(): AppleToolchain | null {
  return parseAppleToolchain(readFileSync(join(REPO, "docs", "DECISIONS.md"), "utf8"));
}

function xcodebuildArgs(action: readonly string[], resultBundle?: string): string[] {
  const args = [
    "-project",
    "AnnusMirabilis.xcodeproj",
    "-scheme",
    "AnnusMirabilis",
    "-destination",
    `platform=iOS Simulator,name=${DEVICE}`,
    "-derivedDataPath",
    DERIVED_DATA_PATH,
  ];
  if (resultBundle !== undefined) {
    args.push("-resultBundlePath", resultBundle);
  }
  return [...args, ...action];
}

function runTests(
  label: string,
  target: string,
  logRunId: string,
  extra: readonly string[],
): StepVerdict {
  const bundle = join(DERIVED_DATA_PATH, "Results", `${logRunId}-${target}.xcresult`);
  const test = run(
    "xcodebuild",
    xcodebuildArgs(["test-without-building", `-only-testing:${target}`, ...extra], bundle),
    IOS,
  );
  const summaryRun = run("xcrun", [
    "xcresulttool",
    "get",
    "test-results",
    "summary",
    "--path",
    bundle,
    "--compact",
  ]);
  let summary: XcresultSummary | null = null;
  try {
    summary = summarizeXcresult(JSON.parse(summaryRun.output));
  } catch {
    summary = null;
  }
  const verdict = testVerdict(label, test.status, summary);
  return {
    ...verdict,
    details: {
      ...verdict.details,
      xcresultPath: bundle,
      ...(verdict.outcome === "failed" ? { lastOutput: lastLines(test.output, 200) } : {}),
    },
  };
}

function sameRaster(
  path: string,
  size: number,
  palette: ReturnType<typeof iconPalettes>["light"],
): boolean {
  const decoded = decodePng(readFileSync(path));
  if (decoded === null || decoded.width !== size) {
    return false;
  }
  const expected = rasterize(size, palette);
  return (
    decoded.rgb.length === expected.length &&
    decoded.rgb.every((byte, index) => byte === expected[index])
  );
}

export function runStep(id: AppleStepId, logRunId: string): StepVerdict {
  switch (id) {
    case "apple-disk": {
      const floor = toolchain()?.diskFreeGigabytesMinimum;
      if (floor === undefined) {
        return {
          outcome: "failed",
          message: "docs/DECISIONS.md has no readable apple-toolchain block.",
        };
      }
      const stats = statfsSync(REPO);
      return diskVerdict((stats.bavail * stats.bsize) / 1e9, floor);
    }
    case "apple-toolchain": {
      const expected = toolchain();
      if (expected === null) {
        return {
          outcome: "failed",
          message: "docs/DECISIONS.md has no readable apple-toolchain block.",
        };
      }
      const xcode = parseXcodeVersion(run("xcodebuild", ["-version"]).output);
      const observed: ObservedTools = {
        ...xcode,
        xcodegen: parseXcodegenVersion(run("xcodegen", ["--version"]).output),
        swiftlint: run("swiftlint", ["version"]).output.trim() || null,
        swiftFormat: run("xcrun", ["swift-format", "--version"]).output.trim() || null,
      };
      const mismatches = toolchainMismatches(expected, observed);
      return mismatches.length === 0
        ? {
            outcome: "passed",
            message: `Xcode ${observed.xcode} (${observed.xcodeBuild}), XcodeGen ${observed.xcodegen}, SwiftLint ${observed.swiftlint}, swift-format ${observed.swiftFormat}.`,
            details: observed,
          }
        : { outcome: "failed", message: mismatches.join(" "), details: observed };
    }
    case "apple-project-fresh": {
      const generate = run("xcodegen", ["generate", "--quiet"], IOS);
      if (generate.status !== 0) {
        return {
          outcome: "failed",
          message: `xcodegen generate failed: ${lastLines(generate.output, 20)}`,
        };
      }
      const diff = run("git", ["status", "--porcelain", "--", "ios/AnnusMirabilis.xcodeproj"]);
      return diff.output.trim() === ""
        ? {
            outcome: "passed",
            message: "Regenerating ios/project.yml changes nothing in the committed project.",
          }
        : {
            outcome: "failed",
            message: `The committed project differs from what ios/project.yml generates:\n${diff.output.trim()}\nThe regenerated project is now in the working tree. Review it and commit it with the project.yml change that caused it; never hand-edit the project.`,
          };
    }
    case "apple-plist-lint": {
      const files = ["Info.plist", "PrivacyInfo.xcprivacy", "AnnusMirabilis.entitlements"].map(
        (name) => join(IOS, "AnnusMirabilis", "Resources", name),
      );
      const lint = run("plutil", ["-lint", ...files]);
      return lint.status === 0
        ? { outcome: "passed", message: `plutil -lint: ${files.length} of ${files.length} OK.` }
        : { outcome: "failed", message: `plutil -lint refused:\n${lint.output.trim()}` };
    }
    case "apple-swiftlint": {
      const lint = run("swiftlint", ["lint", "--strict"], IOS);
      const examined = Number(/in (\d+) files?\./.exec(lint.output)?.[1] ?? "0");
      if (examined === 0) {
        return {
          outcome: "failed",
          message: "SwiftLint examined 0 files. An empty run is not a pass.",
        };
      }
      return lint.status === 0
        ? { outcome: "passed", message: `SwiftLint: 0 violations in ${examined} files.` }
        : { outcome: "failed", message: `SwiftLint:\n${lastLines(lint.output, 40)}` };
    }
    case "apple-swift-format": {
      const roots = ["AnnusMirabilis", "AnnusMirabilisTests", "AnnusMirabilisUITests"];
      const examined = roots.reduce(
        (sum, root) =>
          sum +
          readdirSync(join(IOS, root), { recursive: true }).filter((f) =>
            String(f).endsWith(".swift"),
          ).length,
        0,
      );
      if (examined === 0) {
        return {
          outcome: "failed",
          message: "swift-format would examine 0 Swift files. An empty run is not a pass.",
        };
      }
      const lint = run(
        "xcrun",
        [
          "swift-format",
          "lint",
          "--strict",
          "--recursive",
          "--configuration",
          ".swift-format",
          ...roots,
        ],
        IOS,
      );
      return lint.status === 0 && lint.output.trim() === ""
        ? { outcome: "passed", message: `swift-format: 0 findings in ${examined} files.` }
        : {
            outcome: "failed",
            message: `swift-format:\n${lastLines(lint.output, 40)}\nRun: cd ios && xcrun swift-format format --in-place --recursive --configuration .swift-format ${roots.join(" ")}`,
          };
    }
    case "apple-generated-fresh": {
      const catalog = join(REPO, ASSET_CATALOG);
      const palettes = iconPalettes();
      const checks: [string, number, (typeof palettes)["light"]][] = [
        [join(catalog, "AppIcon.appiconset", "AppIcon-light.png"), ICON_SIZE, palettes.light],
        [join(catalog, "AppIcon.appiconset", "AppIcon-dark.png"), ICON_SIZE, palettes.dark],
        [join(catalog, "PageMark.imageset", "PageMark-light.png"), MARK_SIZE, palettes.light],
        [join(catalog, "PageMark.imageset", "PageMark-dark.png"), MARK_SIZE, palettes.dark],
      ];
      const stale = checks.filter(
        ([path, size, palette]) => !existsSync(path) || !sameRaster(path, size, palette),
      );
      return stale.length === 0
        ? {
            outcome: "passed",
            message: `${checks.length} of ${checks.length} generated images match the current theme tokens.`,
          }
        : {
            outcome: "failed",
            message: `Stale: ${stale.map(([p]) => p.replace(`${REPO}/`, "")).join(", ")}. Run: bun scripts/app/generate-app-icon.ts`,
          };
    }
    case "apple-edition-fresh": {
      const manifestPath = join(REPO, "generated", "app-edition", "edition-manifest.json");
      if (!existsSync(manifestPath)) {
        return {
          outcome: "failed",
          message: "No exported edition. Run: bun scripts/app/export-edition.ts",
        };
      }
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        files: { path: string; sha256: string }[];
      };
      const changed = manifest.files.filter((file) => {
        const source = join(REPO, "out", file.path);
        return (
          !existsSync(source) ||
          createHash("sha256").update(readFileSync(source)).digest("hex") !== file.sha256
        );
      });
      if (manifest.files.length === 0) {
        return { outcome: "failed", message: "The exported edition lists 0 files." };
      }
      return changed.length === 0
        ? {
            outcome: "passed",
            message: `${manifest.files.length} of ${manifest.files.length} exported files still match out/.`,
          }
        : {
            outcome: "failed",
            message: `${changed.length} of ${manifest.files.length} exported files differ from out/ (first: ${changed[0]?.path}). Run: bun scripts/app/export-edition.ts`,
          };
    }
    case "apple-simulators": {
      const simulators = ensureSimulators(REPO);
      const created = simulators.filter((s) => s.created).map((s) => s.name);
      return {
        outcome: simulators.length > 0 ? "passed" : "failed",
        message:
          simulators.length === 0
            ? "The apple-toolchain decision names no simulators."
            : `${simulators.length} named simulators ready${created.length > 0 ? `, created ${created.join(", ")}` : ""}.`,
        details: { simulators },
      };
    }
    case "apple-build": {
      if (isInsideRepository(REPO, DERIVED_DATA_PATH)) {
        return {
          outcome: "failed",
          message: `DerivedData ${DERIVED_DATA_PATH} is inside the repository. Refusing.`,
        };
      }
      mkdirSync(join(DERIVED_DATA_PATH, "Results"), { recursive: true });
      const build = run("xcodebuild", xcodebuildArgs(["build-for-testing"]), IOS);
      return build.status === 0
        ? { outcome: "passed", message: `Built for testing on ${DEVICE}.` }
        : {
            outcome: "failed",
            message: `xcodebuild build-for-testing exit ${build.status}`,
            details: { lastOutput: lastLines(build.output, 200) },
          };
    }
    case "apple-unit-tests":
      return runTests("Unit tests", "AnnusMirabilisTests", logRunId, []);
    case "apple-ui-tests":
      return runTests("UI tests", "AnnusMirabilisUITests", logRunId, [
        "-parallel-testing-enabled",
        "NO",
      ]);
  }
}

function log(logRunId: string, id: string, verdict: StepVerdict, durationMs: number): void {
  const path = join(REPO, "artifacts", "test-logs", "app-apple-gate", `${logRunId}.jsonl`);
  mkdirSync(dirname(path), { recursive: true });
  let xcode: string | null = null;
  try {
    xcode = parseXcodeVersion(execFileSync("xcodebuild", ["-version"], { encoding: "utf8" })).xcode;
  } catch {
    xcode = null;
  }
  const details = verdict.details ?? {};
  appendFileSync(
    path,
    `${JSON.stringify({
      timestamp: new Date().toISOString(),
      suite: "app-apple-gate",
      logRunId,
      step: id,
      outcome: verdict.outcome,
      durationMs,
      xcode,
      simulatorName: (details.device as string | undefined) ?? DEVICE,
      simulatorUdid: (details.udid as string | undefined) ?? null,
      osVersion: (details.osVersion as string | undefined) ?? null,
      xcresultPath: (details.xcresultPath as string | undefined) ?? null,
      message: verdict.message,
      ...(details.lastOutput === undefined ? {} : { lastOutput: details.lastOutput }),
    })}\n`,
  );
}

function main(argv: readonly string[]): number {
  const index = argv.indexOf("--step");
  const id = index >= 0 ? argv[index + 1] : undefined;
  const step = APPLE_STEPS.find((candidate) => candidate.id === id);
  if (step === undefined) {
    process.stderr.write(
      `usage: bun scripts/app/apple-quality.ts --step <${APPLE_STEPS.map((s) => s.id).join("|")}>\n`,
    );
    return 2;
  }
  const logRunId = process.env.AM_LOG_RUN_ID ?? newRunIdentity();
  const started = Date.now();
  const verdict = runStep(step.id, logRunId);
  log(logRunId, step.id, verdict, Date.now() - started);
  (verdict.outcome === "passed" ? process.stdout : process.stderr).write(
    `${step.id}: ${verdict.message}\n`,
  );
  return verdict.outcome === "passed" ? 0 : 1;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
