/**
 * The named simulators from D-2026-09-23-apple-toolchain, created when absent
 * and reused when present, so no test attaches to "whatever is booted".
 *
 * This never deletes, erases or renames a simulator. A plan can only create.
 *
 * Usage: `bun scripts/app/simulators.ts` prints the named simulators' UDIDs as JSON.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

export type SimulatorSpec = {
  readonly name: string;
  readonly deviceType: string;
  readonly runtime: string;
};

export type SimctlDevice = {
  readonly name: string;
  readonly udid: string;
  readonly isAvailable?: boolean;
};

/** `xcrun simctl list devices --json`: devices keyed by runtime identifier. */
export type SimctlDevices = { readonly devices: Readonly<Record<string, readonly SimctlDevice[]>> };

export type SimulatorPlanEntry =
  | { readonly action: "reuse"; readonly spec: SimulatorSpec; readonly udid: string }
  | { readonly action: "create"; readonly spec: SimulatorSpec };

/** The simulators block of the `apple-toolchain` decision, or null when the entry has none. */
export function readSimulatorSpecs(decisions: string): SimulatorSpec[] | null {
  const match = /```yaml apple-toolchain\n([\s\S]*?)```/.exec(decisions);
  if (match === null) {
    return null;
  }
  const block = yaml.load(match[1] ?? "") as { simulators?: SimulatorSpec[] };
  return Array.isArray(block.simulators) ? block.simulators : null;
}

/**
 * Reuse an available simulator with the spec's name on the spec's runtime;
 * otherwise create one. The plan has no other action, by construction.
 */
export function planSimulators(
  specs: readonly SimulatorSpec[],
  listed: SimctlDevices,
): SimulatorPlanEntry[] {
  return specs.map((spec) => {
    const existing = (listed.devices[spec.runtime] ?? []).find(
      (device) => device.name === spec.name && device.isAvailable !== false,
    );
    return existing === undefined
      ? { action: "create", spec }
      : { action: "reuse", spec, udid: existing.udid };
  });
}

export function ensureSimulators(repo: string): { name: string; udid: string; created: boolean }[] {
  const specs = readSimulatorSpecs(readFileSync(join(repo, "docs", "DECISIONS.md"), "utf8")) ?? [];
  const listed = JSON.parse(
    execFileSync("xcrun", ["simctl", "list", "devices", "--json"], { encoding: "utf8" }),
  ) as SimctlDevices;
  return planSimulators(specs, listed).map((entry) => {
    if (entry.action === "reuse") {
      return { name: entry.spec.name, udid: entry.udid, created: false };
    }
    const udid = execFileSync(
      "xcrun",
      ["simctl", "create", entry.spec.name, entry.spec.deviceType, entry.spec.runtime],
      {
        encoding: "utf8",
      },
    ).trim();
    return { name: entry.spec.name, udid, created: true };
  });
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  process.stdout.write(`${JSON.stringify(ensureSimulators(repo), null, 2)}\n`);
}
