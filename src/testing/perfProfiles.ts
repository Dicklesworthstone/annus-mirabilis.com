import { readFileSync, mkdirSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const BUDGET_IDS = [
  "initial-route-js",
  "reading-face-html",
  "visible-text-math",
  "interaction-latency-p75",
  "layout-shift",
  "instrument-feedback",
  "animation-frame-rate",
  "resource-lifecycle",
] as const;

export type BudgetId = (typeof BUDGET_IDS)[number];

export type CpuCalibrationState = "provisional" | "none" | "measured";

export type Viewport = {
  id: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
};

export type CpuSlowdown = {
  factor: number;
  calibration: CpuCalibrationState;
  phoneModel: string;
  host: string;
  benchmarkMsHost: number | null;
  benchmarkMsPhone: number | null;
  testerId: string;
  date: string;
  chromiumCdpCommand: string;
  webkitCpuThrottling: "unavailable";
};

export type Profile = {
  id: string;
  description: string;
  engines: Array<"chromium" | "webkit">;
  viewports: Viewport[];
  cpuSlowdown: CpuSlowdown;
  network: {
    downKbps: number;
    upKbps: number;
    rttMs: number;
    enforcedOn: Array<"chromium" | "webkit">;
  };
  cacheStates: Array<"cold" | "warm">;
  budgets: BudgetId[];
  emulated: boolean;
  hardwareRecordedLaterBy?: string[];
};

export type ProfilesFile = {
  schemaVersion: number;
  decisionId: string;
  playwrightVersion: string;
  budgetCatalog: Record<string, unknown>;
  measurement: {
    interactionRepetitionsMin: number;
    interactionPercentile: number;
    nearestRankOneIndexed: number;
    eventTimingRoundingMs: number;
    animationWindowMs: number;
    frameIntervalDesktopMedianMaxMs: number;
    frameIntervalDesktopLongMaxMs: number;
    frameIntervalDesktopLongMaxFraction: number;
    frameIntervalMobileMedianMaxMs: number;
    frameIntervalMobileLongMaxMs: number;
    frameIntervalMobileLongMaxFraction: number;
  };
  profiles: Profile[];
};

export type ValidationIssue = { path: string; message: string };

const here = dirname(fileURLToPath(import.meta.url));
export const PROFILES_PATH = join(here, "../../perf/profiles.json");
export const SCHEMA_PATH = join(here, "../../perf/profiles.schema.json");

export function repoRoot(): string {
  return join(here, "../..");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveRef(root: Record<string, unknown>, ref: string): Record<string, unknown> {
  if (!ref.startsWith("#/")) {
    throw new Error(`unsupported $ref ${ref}`);
  }
  const parts = ref.slice(2).split("/");
  let node: unknown = root;
  for (const part of parts) {
    if (!isObject(node) || !(part in node)) {
      throw new Error(`unresolved $ref ${ref}`);
    }
    node = node[part];
  }
  if (!isObject(node)) {
    throw new Error(`$ref ${ref} did not resolve to an object`);
  }
  return node;
}

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function matchesType(value: unknown, type: string | string[]): boolean {
  const types = Array.isArray(type) ? type : [type];
  const actual = typeOf(value);
  return types.some((t) => {
    if (t === "integer") return typeof value === "number" && Number.isInteger(value);
    if (t === "number") return typeof value === "number" && Number.isFinite(value);
    return actual === t;
  });
}

export function validateAgainstSchema(
  data: unknown,
  schema: Record<string, unknown>,
  root = schema,
  path = "$",
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const node = schema.$ref ? resolveRef(root, String(schema.$ref)) : schema;

  if (node.const !== undefined && data !== node.const) {
    issues.push({ path, message: `expected const ${JSON.stringify(node.const)}` });
    return issues;
  }
  if (Array.isArray(node.enum) && !node.enum.includes(data as never)) {
    issues.push({ path, message: `expected one of ${JSON.stringify(node.enum)}, got ${JSON.stringify(data)}` });
    return issues;
  }
  if (node.type !== undefined && !matchesType(data, node.type as string | string[])) {
    issues.push({ path, message: `expected type ${JSON.stringify(node.type)}, got ${typeOf(data)}` });
    return issues;
  }
  if (typeof node.minimum === "number" && typeof data === "number" && data < node.minimum) {
    issues.push({ path, message: `expected >= ${node.minimum}, got ${data}` });
  }
  if (typeof node.minLength === "number" && typeof data === "string" && data.length < node.minLength) {
    issues.push({ path, message: `expected minLength ${node.minLength}` });
  }
  if (typeof node.pattern === "string" && typeof data === "string" && !new RegExp(node.pattern).test(data)) {
    issues.push({ path, message: `expected to match /${node.pattern}/` });
  }
  if (node.type === "object" || (isObject(node.properties) && isObject(data))) {
    if (!isObject(data)) return issues;
    const required = Array.isArray(node.required) ? (node.required as string[]) : [];
    for (const key of required) {
      if (!(key in data)) {
        issues.push({ path: `${path}.${key}`, message: "missing required field" });
      }
    }
    const properties = isObject(node.properties) ? node.properties : {};
    if (node.additionalProperties === false) {
      for (const key of Object.keys(data)) {
        if (!(key in properties)) {
          issues.push({ path: `${path}.${key}`, message: "unexpected property" });
        }
      }
    }
    for (const [key, sub] of Object.entries(properties)) {
      if (key in data && isObject(sub)) {
        issues.push(...validateAgainstSchema(data[key], sub, root, `${path}.${key}`));
      }
    }
  }
  if (node.type === "array" || (node.items && Array.isArray(data))) {
    if (!Array.isArray(data)) return issues;
    if (typeof node.minItems === "number" && data.length < node.minItems) {
      issues.push({ path, message: `expected minItems ${node.minItems}` });
    }
    if (isObject(node.items)) {
      data.forEach((item, i) => {
        issues.push(...validateAgainstSchema(item, node.items as Record<string, unknown>, root, `${path}[${i}]`));
      });
    }
  }
  return issues;
}

export function validateDomain(file: ProfilesFile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  for (const profile of file.profiles) {
    if (ids.has(profile.id)) {
      issues.push({ path: `$.profiles.${profile.id}`, message: "duplicate profile id" });
    }
    ids.add(profile.id);
    if (!profile.network) {
      issues.push({ path: `$.profiles.${profile.id}.network`, message: "missing network field" });
    }
    if (profile.cpuSlowdown.factor < 1) {
      issues.push({
        path: `$.profiles.${profile.id}.cpuSlowdown.factor`,
        message: `CPU factor below 1: ${profile.cpuSlowdown.factor}`,
      });
    }
    for (const viewport of profile.viewports) {
      if (viewport.width < 320) {
        issues.push({
          path: `$.profiles.${profile.id}.viewports.${viewport.id}.width`,
          message: `viewport narrower than 320 px: ${viewport.width}`,
        });
      }
    }
    for (const budget of profile.budgets) {
      if (!BUDGET_IDS.includes(budget)) {
        issues.push({
          path: `$.profiles.${profile.id}.budgets`,
          message: `unknown budget id: ${budget}`,
        });
      }
    }
    if (profile.id === "mobile-low-cost") {
      const has320 = profile.viewports.some((v) => v.width === 320);
      if (!has320) {
        issues.push({
          path: `$.profiles.${profile.id}.viewports`,
          message: "mobile-low-cost must include a 320-pixel viewport",
        });
      }
      if (profile.cpuSlowdown.factor < 4 && profile.cpuSlowdown.calibration === "provisional") {
        issues.push({
          path: `$.profiles.${profile.id}.cpuSlowdown.factor`,
          message: "provisional mobile-low-cost CPU slowdown must be 4",
        });
      }
      if (profile.cpuSlowdown.calibration !== "provisional" && profile.cpuSlowdown.calibration !== "measured") {
        issues.push({
          path: `$.profiles.${profile.id}.cpuSlowdown.calibration`,
          message: `mobile-low-cost calibration must be provisional or measured, got ${profile.cpuSlowdown.calibration}`,
        });
      }
    }
    if (profile.cpuSlowdown.calibration === "provisional") {
      if (profile.cpuSlowdown.testerId !== "") {
        issues.push({
          path: `$.profiles.${profile.id}.cpuSlowdown.testerId`,
          message: "testerId must stay empty while calibration is provisional",
        });
      }
      if (profile.cpuSlowdown.date !== "") {
        issues.push({
          path: `$.profiles.${profile.id}.cpuSlowdown.date`,
          message: "date must stay empty while calibration is provisional",
        });
      }
      if (profile.cpuSlowdown.phoneModel !== "" || profile.cpuSlowdown.host !== "") {
        issues.push({
          path: `$.profiles.${profile.id}.cpuSlowdown`,
          message: "phoneModel and host must stay empty while calibration is provisional",
        });
      }
    }
    if (profile.cpuSlowdown.calibration === "measured") {
      if (!profile.cpuSlowdown.host) {
        issues.push({ path: `$.profiles.${profile.id}.cpuSlowdown.host`, message: "measured calibration missing host" });
      }
      if (!profile.cpuSlowdown.phoneModel) {
        issues.push({
          path: `$.profiles.${profile.id}.cpuSlowdown.phoneModel`,
          message: "measured calibration missing phone model",
        });
      }
      if (!profile.cpuSlowdown.testerId) {
        issues.push({
          path: `$.profiles.${profile.id}.cpuSlowdown.testerId`,
          message: "measured calibration missing tester id",
        });
      }
      if (!profile.cpuSlowdown.date) {
        issues.push({ path: `$.profiles.${profile.id}.cpuSlowdown.date`, message: "measured calibration missing date" });
      }
    }
    if (profile.cpuSlowdown.webkitCpuThrottling !== "unavailable") {
      issues.push({
        path: `$.profiles.${profile.id}.cpuSlowdown.webkitCpuThrottling`,
        message: "WebKit CPU throttling must be recorded as unavailable",
      });
    }
  }
  if (!ids.has("mobile-low-cost") || !ids.has("desktop-capable") || !ids.has("tablet") || !ids.has("real-device-small")) {
    issues.push({ path: "$.profiles", message: "missing one of the four required profile ids" });
  }
  return issues;
}

export function validateProfilesFile(data: unknown, schema: Record<string, unknown>): ValidationIssue[] {
  const schemaIssues = validateAgainstSchema(data, schema);
  if (schemaIssues.length > 0) return schemaIssues;
  return validateDomain(data as ProfilesFile);
}

export function loadCommittedProfiles(): { data: ProfilesFile; schema: Record<string, unknown>; issues: ValidationIssue[] } {
  const data = JSON.parse(readFileSync(PROFILES_PATH, "utf8")) as ProfilesFile;
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8")) as Record<string, unknown>;
  return { data, schema, issues: validateProfilesFile(data, schema) };
}

/**
 * Nearest-rank p75 for Event Timing samples.
 * With n = 20, ceil(0.75 * 20) = 15, so the 15th 1-indexed value (index 14).
 */
export function nearestRankPercentile(sortedAscending: number[], percentile: number, minSamples: number): number {
  if (sortedAscending.length < minSamples) {
    throw new Error(`need at least ${minSamples} samples, got ${sortedAscending.length}`);
  }
  const rank = Math.ceil(percentile * sortedAscending.length);
  return sortedAscending[rank - 1]!;
}

export function median(values: number[]): number {
  if (values.length === 0) throw new Error("median of empty sample");
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function frameRatePasses(opts: {
  intervalsMs: number[];
  medianMaxMs: number;
  longMaxMs: number;
  longMaxFraction: number;
}): { ok: boolean; medianMs: number; longFraction: number } {
  const medianMs = median(opts.intervalsMs);
  const longCount = opts.intervalsMs.filter((v) => v > opts.longMaxMs).length;
  const longFraction = longCount / opts.intervalsMs.length;
  const ok = medianMs <= opts.medianMaxMs && longFraction <= opts.longMaxFraction;
  return { ok, medianMs, longFraction };
}

export function cdpDownloadBytesPerSecond(downKbps: number): number {
  return Math.floor((downKbps * 1000) / 8);
}

export function appendPerfProfilesLog(entry: {
  testId: string;
  profileId?: string;
  outcome: "pass" | "fail";
  message: string;
  logRunId: string;
}): void {
  const dir = join(repoRoot(), "artifacts/test-logs/perf-profiles");
  mkdirSync(dir, { recursive: true });
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    suite: "perf-profiles",
    logRunId: entry.logRunId,
    testId: entry.testId,
    profileId: entry.profileId ?? null,
    outcome: entry.outcome,
    message: entry.message,
  });
  appendFileSync(join(dir, `${entry.logRunId}.jsonl`), `${line}\n`);
}

export function newLogRunId(): string {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const hex = Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, "0");
  return `${stamp}-${hex}`;
}

if ((import.meta as ImportMeta & { main?: boolean }).main) {
  const { data, issues } = loadCommittedProfiles();
  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(`${issue.path}: ${issue.message}`);
    }
    console.error(`FAIL ${PROFILES_PATH} (${issues.length} issues)`);
    process.exit(1);
  }
  const mobile = data.profiles.find((p) => p.id === "mobile-low-cost");
  console.log(
    JSON.stringify(
      {
        outcome: "pass",
        path: PROFILES_PATH,
        schema: SCHEMA_PATH,
        profileIds: data.profiles.map((p) => p.id),
        mobileCalibration: mobile?.cpuSlowdown.calibration,
        mobileFactor: mobile?.cpuSlowdown.factor,
        mobileTesterIdEmpty: mobile?.cpuSlowdown.testerId === "",
        mobileDateEmpty: mobile?.cpuSlowdown.date === "",
        webkitCpuThrottling: mobile?.cpuSlowdown.webkitCpuThrottling,
        playwrightVersion: data.playwrightVersion,
      },
      null,
      2,
    ),
  );
}
