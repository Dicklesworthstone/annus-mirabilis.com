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
  compareWithDirectory,
  type EditionManifestFiles,
  summary as parityHeadline,
  writeParityLog,
} from "./edition-parity.ts";
import {
  ASSET_CATALOG,
  decodePng,
  ICON_SIZE,
  iconPalettes,
  MARK_SIZE,
  rasterize,
} from "./generate-app-icon.ts";
import { recordedIdentity } from "./identity.ts";
import {
  appExecutables,
  markersIn,
  RELEASE_CONTROLS,
  releaseAbsenceVerdict,
  TEST_ONLY_MARKERS,
} from "./release-absence.ts";
import {
  ensureSimulators,
  planSimulators,
  readSimulatorSpecs,
  type SimctlDevices,
} from "./simulators.ts";
import {
  APP_EVIDENCE_FOLDER,
  checkEvidence,
  type EvidenceItem,
  evidenceFolderName,
  failureRecord,
  gatherEvidence,
} from "./test-evidence.ts";
import { collectTestRecords, writeTestRecords } from "./test-records.ts";
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
  /** Each failing test once, by the identifier the .xcresult gives it, with its first failure. */
  readonly failedTests: readonly { readonly id: string; readonly text: string }[];
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
  const failedTests: { id: string; text: string }[] = [];
  for (const entry of Array.isArray(d.testFailures) ? d.testFailures : []) {
    const f = entry as Record<string, unknown>;
    const id = typeof f.testIdentifierString === "string" ? f.testIdentifierString : null;
    if (id !== null && !failedTests.some((test) => test.id === id)) {
      failedTests.push({ id, text: String(f.failureText ?? "") });
    }
  }
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
    failedTests,
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

/** The one test the seeded-failure lane runs (HarnessUITests.swift), as the .xcresult names it. */
export const SEEDED_TEST = "HarnessUITests/testSeededFailureRetainsEvidence()";

/**
 * The seeded-failure lane (bead am-app-test-harness-da6e, requirement 7) passes only when the run
 * failed the seeded test alone, for the seeded reason, and its evidence lacks nothing. A run that
 * passed, failed another way, or kept less than everything fails the lane.
 */
export function seededFailureVerdict(
  summary: XcresultSummary | null,
  items: readonly EvidenceItem[] | null,
): StepVerdict {
  if (summary === null) {
    return { outcome: "failed", message: "Seeded failure: no readable .xcresult summary." };
  }
  const [only] = summary.failedTests;
  if (summary.total !== 1 || summary.failed !== 1 || only?.id !== SEEDED_TEST) {
    return {
      outcome: "failed",
      message: `Seeded failure: expected ${SEEDED_TEST} to be the one test and to fail; ran ${summary.total}, ${summary.failed} failed (${summary.failures.slice(0, 3).join(" | ") || "none"}).`,
    };
  }
  if (!only.text.includes("seeded failure")) {
    return {
      outcome: "failed",
      message: `Seeded failure: the test failed before its seeded failure, so the evidence shows another state: ${only.text}`,
    };
  }
  const missing = (items ?? []).filter((item) => !item.present);
  if (items === null || items.length === 0 || missing.length > 0) {
    return {
      outcome: "failed",
      message: `Seeded failure: evidence missing: ${items === null || items.length === 0 ? "all of it" : missing.map((item) => `${item.item} (${item.detail})`).join("; ")}.`,
    };
  }
  return {
    outcome: "passed",
    message: `Seeded failure kept every evidence item: ${items.map((item) => `${item.item} (${item.detail})`).join("; ")}.`,
  };
}

// ---------------------------------------------------------------------------
// The steps. Everything below touches the machine.

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const IOS = join(REPO, "ios");
const DEVICE = process.env.AM_APPLE_DEVICE ?? "AM iPhone 17";

function run(
  command: string,
  args: readonly string[],
  cwd = REPO,
  env?: Readonly<Record<string, string>>,
) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    env: env === undefined ? process.env : { ...process.env, ...env },
  });
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

/**
 * The gate's simulator by UDID (bead am-app-test-harness-da6e, requirement 4): the one the
 * apple-toolchain decision names DEVICE on its runtime, so a simulator of the same name on another
 * runtime is never picked. Null when the decision does not name DEVICE, or it does not exist yet.
 */
function gateDeviceUdid(): string | null {
  const spec = (
    readSimulatorSpecs(readFileSync(join(REPO, "docs", "DECISIONS.md"), "utf8")) ?? []
  ).find((candidate) => candidate.name === DEVICE);
  if (spec === undefined) return null;
  let listed: SimctlDevices;
  try {
    listed = JSON.parse(
      execFileSync("xcrun", ["simctl", "list", "devices", "--json"], { encoding: "utf8" }),
    ) as SimctlDevices;
  } catch {
    return null;
  }
  const [entry] = planSimulators([spec], listed);
  return entry?.action === "reuse" ? entry.udid : null;
}

function xcodebuildArgs(
  action: readonly string[],
  resultBundle?: string,
  udid: string | null = gateDeviceUdid(),
): string[] {
  const args = [
    "-project",
    "AnnusMirabilis.xcodeproj",
    "-scheme",
    "AnnusMirabilis",
    "-destination",
    udid === null ? `platform=iOS Simulator,name=${DEVICE}` : `id=${udid}`,
    "-derivedDataPath",
    DERIVED_DATA_PATH,
  ];
  if (resultBundle !== undefined) {
    args.push("-resultBundlePath", resultBundle);
  }
  return [...args, ...action];
}

type TestRun = {
  readonly status: number | null;
  readonly output: string;
  readonly summary: XcresultSummary | null;
  readonly bundle: string;
  readonly udid: string;
  readonly records: { readonly invalid: readonly string[]; readonly summary: string };
  /** Each failing test's evidence items, by the identifier the .xcresult gives it. */
  readonly evidence: ReadonlyMap<string, readonly EvidenceItem[]>;
};

function noSimulator(label: string): StepVerdict {
  return {
    outcome: "failed",
    message: `${label}: ${DEVICE} is not a simulator the apple-toolchain decision names on its runtime, or it does not exist yet. Run the apple-simulators step.`,
  };
}

/**
 * Runs a test target, or one test, on the gate's simulator by UDID, then collects the tests' records
 * and each failing test's evidence. Null when the gate's simulator does not exist.
 */
function runTestTarget(
  target: string,
  logRunId: string,
  extra: readonly string[],
  env: Readonly<Record<string, string>> = {},
): TestRun | null {
  const udid = gateDeviceUdid();
  if (udid === null) return null;
  const name = `${logRunId}-${target.replaceAll("/", "-")}`;
  const bundle = join(DERIVED_DATA_PATH, "Results", `${name}.xcresult`);
  const started = new Date();
  // The runner sees TEST_RUNNER_-prefixed variables without the prefix: AMTestLog reads
  // AM_LOG_RUN_ID, and HarnessDevice holds every launch to AM_SIMULATOR_UDID.
  const test = run(
    "xcodebuild",
    xcodebuildArgs(["test-without-building", `-only-testing:${target}`, ...extra], bundle, udid),
    IOS,
    { TEST_RUNNER_AM_LOG_RUN_ID: logRunId, TEST_RUNNER_AM_SIMULATOR_UDID: udid, ...env },
  );
  const window = { start: started, end: new Date() };
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
  const attachments = join(DERIVED_DATA_PATH, "Results", `${name}-attachments`);
  const records = collectRecords(bundle, attachments);
  const evidence = keepEvidence(
    summary?.failedTests ?? [],
    attachments,
    logRunId,
    bundle,
    udid,
    window,
  );
  return { status: test.status, output: test.output, summary, bundle, udid, records, evidence };
}

function runTests(
  label: string,
  target: string,
  logRunId: string,
  extra: readonly string[],
): StepVerdict {
  const tested = runTestTarget(target, logRunId, extra);
  if (tested === null) return noSimulator(label);
  const counted = testVerdict(label, tested.status, tested.summary);
  const reported = tested.summary?.udid ?? null;
  const problems = [
    ...(reported !== null && reported !== tested.udid
      ? [`The run reports simulator ${reported}, but the gate chose ${tested.udid}.`]
      : []),
    ...(tested.records.invalid.length > 0
      ? [
          `${tested.records.invalid.length} test record(s) fail the shared log schema, first: ${tested.records.invalid[0]}`,
        ]
      : []),
  ];
  const kept =
    tested.evidence.size > 0
      ? ` Evidence for ${tested.evidence.size} failing test(s) in artifacts/test-logs/app-evidence/${logRunId}/.`
      : "";
  const verdict: StepVerdict =
    problems.length > 0
      ? {
          ...counted,
          outcome: "failed",
          message: `${counted.message} ${problems.join(" ")}${kept}`,
        }
      : { ...counted, message: `${counted.message} ${tested.records.summary}${kept}` };
  return {
    ...verdict,
    details: {
      ...verdict.details,
      xcresultPath: tested.bundle,
      ...(verdict.outcome === "failed" ? { lastOutput: lastLines(tested.output, 200) } : {}),
    },
  };
}

/** The seeded-failure lane: the one seeded test, which must fail and leave every evidence item. */
function seededFailureLane(logRunId: string): StepVerdict {
  const tested = runTestTarget(
    `AnnusMirabilisUITests/${SEEDED_TEST.replace(/\(\)$/, "")}`,
    logRunId,
    ["-parallel-testing-enabled", "NO"],
    { TEST_RUNNER_AM_SEEDED_FAILURE: "1" },
  );
  if (tested === null) return noSimulator("Seeded failure");
  const verdict = seededFailureVerdict(tested.summary, tested.evidence.get(SEEDED_TEST) ?? null);
  const outcome = tested.records.invalid.length > 0 ? "failed" : verdict.outcome;
  return {
    outcome,
    message:
      tested.records.invalid.length > 0
        ? `${verdict.message} A test record fails the shared log schema: ${tested.records.invalid[0]}`
        : `${verdict.message} In artifacts/test-logs/app-evidence/${logRunId}/${evidenceFolderName(SEEDED_TEST)}/.`,
    details: {
      xcresultPath: tested.bundle,
      udid: tested.udid,
      ...(outcome === "failed" ? { lastOutput: lastLines(tested.output, 200) } : {}),
    },
  };
}

/**
 * The tests' AMTestLog records (bead am-app-test-harness-da6e): exported from the .xcresult into
 * `dir`, validated with the web's own schema, appended to artifacts/test-logs/<suite>/<logRunId>.jsonl.
 */
function collectRecords(bundle: string, dir: string): { invalid: string[]; summary: string } {
  mkdirSync(dir, { recursive: true });
  const exported = run("xcrun", [
    "xcresulttool",
    "export",
    "attachments",
    "--path",
    bundle,
    "--output-path",
    dir,
  ]);
  if (exported.status !== 0 || !existsSync(join(dir, "manifest.json"))) {
    return {
      invalid: [`attachments could not be exported (xcresulttool exit ${exported.status})`],
      summary: "",
    };
  }
  const { records, invalid } = collectTestRecords(dir);
  const files = writeTestRecords(REPO, records);
  return {
    invalid: invalid.map((entry) => `${entry.attachment}: ${entry.reason}`),
    summary: `${records.length} test record(s)${files.length > 0 ? ` in ${files.join(", ")}` : ""}.`,
  };
}

/**
 * Each failing test's evidence (bead am-app-test-harness-da6e, requirement 5), gathered into
 * artifacts/test-logs/app-evidence/<logRunId>/<test>/, and the test's record, naming the files, in
 * artifacts/test-logs/app-ui/<logRunId>.jsonl. A record the schema refuses is itself a missing item.
 */
function keepEvidence(
  failed: XcresultSummary["failedTests"],
  attachmentsDir: string,
  logRunId: string,
  xcresultPath: string,
  udid: string,
  window: { readonly start: Date; readonly end: Date },
): Map<string, EvidenceItem[]> {
  const kept = new Map<string, EvidenceItem[]>();
  if (failed.length === 0) return kept;
  const bundleId = recordedIdentity(REPO)?.bundleId ?? null;
  const container = bundleId === null ? null : appDataContainer(udid, bundleId);
  const appEvidence =
    container === null ? null : join(container, "Library", "Caches", APP_EVIDENCE_FOLDER);
  const recordsPath = join(REPO, "artifacts", "test-logs", "app-ui", `${logRunId}.jsonl`);
  mkdirSync(dirname(recordsPath), { recursive: true });
  for (const test of failed) {
    const dest = join(
      REPO,
      "artifacts",
      "test-logs",
      "app-evidence",
      logRunId,
      evidenceFolderName(test.id),
    );
    gatherEvidence({
      attachmentsDir,
      appEvidenceDir: appEvidence,
      testIdentifier: test.id,
      dest,
      appLog: (start, end) => (bundleId === null ? "" : appLog(udid, bundleId, start, end)),
      runWindow: window,
    });
    const items = checkEvidence(dest, xcresultPath);
    try {
      const record = failureRecord({
        repo: REPO,
        logRunId,
        testIdentifier: test.id,
        failureText: test.text,
        dir: dest,
        xcresultPath,
        items,
      });
      appendFileSync(recordsPath, `${JSON.stringify(record)}\n`);
      items.push({
        item: "record",
        present: true,
        detail: `in ${recordsPath.slice(REPO.length + 1)}`,
      });
    } catch (error) {
      items.push({
        item: "record",
        present: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
    kept.set(test.id, items);
  }
  return kept;
}

/**
 * Builds the Release configuration into its own DerivedData, so the DEBUG products the tests use
 * are untouched, and searches both builds for the test-only markers (scripts/app/release-absence.ts).
 */
function releaseAbsence(): StepVerdict {
  const releaseData = `${DERIVED_DATA_PATH}-release`;
  if (isInsideRepository(REPO, releaseData)) {
    return {
      outcome: "failed",
      message: `DerivedData ${releaseData} is inside the repository. Refusing.`,
    };
  }
  const udid = gateDeviceUdid();
  const build = run(
    "xcodebuild",
    [
      "-project",
      "AnnusMirabilis.xcodeproj",
      "-scheme",
      "AnnusMirabilis",
      "-configuration",
      "Release",
      "-destination",
      udid === null ? `platform=iOS Simulator,name=${DEVICE}` : `id=${udid}`,
      "-derivedDataPath",
      releaseData,
      "build",
    ],
    IOS,
  );
  if (build.status !== 0) {
    return {
      outcome: "failed",
      message: `xcodebuild Release build exit ${build.status}`,
      details: { lastOutput: lastLines(build.output, 200) },
    };
  }
  const products = (data: string, configuration: string) =>
    join(data, "Build", "Products", `${configuration}-iphonesimulator`, "AnnusMirabilis.app");
  const debugFiles = appExecutables(products(DERIVED_DATA_PATH, "Debug"));
  const releaseFiles = appExecutables(products(releaseData, "Release"));
  return releaseAbsenceVerdict({
    markers: TEST_ONLY_MARKERS,
    debugFiles,
    releaseFiles,
    foundInDebug: markersIn(debugFiles, TEST_ONLY_MARKERS),
    foundInRelease: markersIn(releaseFiles, TEST_ONLY_MARKERS),
    controlsInRelease: markersIn(releaseFiles, RELEASE_CONTROLS),
  });
}

/** The app's data container on the simulator, or null when the app is not installed there. */
function appDataContainer(udid: string, bundleId: string): string | null {
  const found = spawnSync("xcrun", ["simctl", "get_app_container", udid, bundleId, "data"], {
    encoding: "utf8",
  });
  return found.status === 0 && found.stdout.trim() !== "" ? found.stdout.trim() : null;
}

/** The app's own log lines between two instants, as ndjson, from the simulator's log store. */
function appLog(udid: string, bundleId: string, start: Date, end: Date): string {
  const two = (n: number) => String(n).padStart(2, "0");
  // `log show` reads local wall-clock times; the simulator keeps the host's time zone.
  const local = (d: Date) =>
    `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
  const shown = spawnSync(
    "xcrun",
    [
      "simctl",
      "spawn",
      udid,
      "log",
      "show",
      "--style",
      "ndjson",
      "--start",
      local(start),
      "--end",
      local(new Date(end.getTime() + 1000)),
      "--predicate",
      `subsystem == "${bundleId}"`,
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return shown.status === 0 ? shown.stdout : "";
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
      const roots = [
        "AnnusMirabilis",
        "AnnusMirabilisTests",
        "AnnusMirabilisUITests",
        "AnnusMirabilisTestSupport",
      ];
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
      const sourcePath = join(REPO, "generated", "app-edition", "edition-source.txt");
      const outDir = existsSync(sourcePath)
        ? readFileSync(sourcePath, "utf8").trim()
        : join(REPO, "out");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        files: { path: string; sha256: string }[];
      };
      const changed = manifest.files.filter((file) => {
        const source = join(outDir, file.path);
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
            message: `${manifest.files.length} of ${manifest.files.length} exported files still match ${outDir}.`,
          }
        : {
            outcome: "failed",
            message: `${changed.length} of ${manifest.files.length} exported files differ from ${outDir} (first: ${changed[0]?.path}). Run: bun scripts/app/export-edition.ts`,
          };
    }
    case "apple-edition-parity": {
      // Both ways, where apple-edition-fresh looks one way: every web file is carried with the same
      // bytes or dropped by a declared export rule, and every carried file is in the build.
      const manifestPath = join(REPO, "generated", "app-edition", "edition-manifest.json");
      const sourcePath = join(REPO, "generated", "app-edition", "edition-source.txt");
      if (!existsSync(manifestPath) || !existsSync(sourcePath)) {
        return {
          outcome: "failed",
          message: "No exported edition. Run: bun scripts/app/export-edition.ts --out <build>",
        };
      }
      const outDir = readFileSync(sourcePath, "utf8").trim();
      if (!existsSync(outDir)) {
        return {
          outcome: "failed",
          message: `The build the edition came from is gone: ${outDir}. Re-export from a build.`,
        };
      }
      const result = compareWithDirectory(
        JSON.parse(readFileSync(manifestPath, "utf8")) as EditionManifestFiles,
        outDir,
      );
      const log = writeParityLog(REPO, result).replace(`${REPO}/`, "");
      const failing = result.records.filter(
        (r) => r.outcome !== "same" && r.outcome !== "excluded",
      );
      return result.passed
        ? { outcome: "passed", message: `${parityHeadline(result)}. Log: ${log}` }
        : {
            outcome: "failed",
            message: `${parityHeadline(result)}. First: ${failing
              .slice(0, 3)
              .map((r) => `${r.outcome} ${r.path}`)
              .join("; ")}. Log: ${log}`,
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
    case "apple-harness-evidence":
      return seededFailureLane(logRunId);
    case "apple-release-absence":
      return releaseAbsence();
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
