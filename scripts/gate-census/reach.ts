import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type GateCadence,
  type GateFamily,
  type GateProfile,
  type GateStep,
  KNOWN_PROFILES,
} from "../quality-gates/registry.ts";

/**
 * WHAT ACTUALLY RUNS A GATE ON THIS PROJECT (am-rc1001-bridge-plan-pcjk.9).
 *
 * The census must say, per gate, which runner reaches it, and `NOTHING` has to be red. Getting the
 * SOURCE of that answer right matters more than the answer: the obvious place to look is
 * `.github/workflows/*.yml`, and on this project that is a dead configuration. The owner, verbatim on
 * 2026-09-22: "we don't use gh actions for CI *EVER*, we ONLY use /dsr". A workflow file here is not a
 * gate, a green run is not evidence, and a red one is not a blocker. This has already cost a session:
 * beads were filed on quality-gates.yml, a pane wired a browser gate into it, and a well-built test
 * asserting "every requiredInCi gate is executed by some workflow job" was verified red by plant and
 * pointed at the wrong artefact. A census that derived reachedBy from those files would repeat that
 * exactly, and would read as careful while doing it.
 *
 * So the routes are read from the two places that do run gates here:
 *
 *  1. `package.json` scripts that invoke `scripts/quality-gates.ts`. Parsed rather than hard-coded, so
 *     a script that changes its family filter changes this answer.
 *  2. The release gate, `scripts/verified-production-deploy.ts`, which runs
 *     `["scripts/quality-gates.ts", "--profile", profile, "--fail-fast"]` at its preflight stage. That
 *     one is declared below rather than parsed, and `reach.node.test.ts` checks the declaration
 *     against the file, so it cannot drift silently.
 *
 * `dsr` is the third possibility and is checked rather than assumed: as of 2026-10-06
 * `dsr repos list` includes `annus-mirabilis -> Dicklesworthstone/annus-mirabilis.com`, which was NOT
 * true on 2026-09-22. Registration means dsr can build and release the repo; no dsr check in this
 * repository runs the gate chain, and there is no dsr config file here (`find . -maxdepth 3 -iname
 * "*dsr*"` outside .git and node_modules is empty). So dsr is not a route for a gate today. Re-measure
 * before relying on that.
 *
 * THE CADENCE FILTER IS THE TRAP. `scripts/quality-gates.ts` defaults cadence to "every-run" for a
 * family run and to "all" for a profile run. So `bun run gates`, which passes no --cadence, does NOT
 * run a nightly step, and a step marked `cadence: "nightly"` in a family nothing schedules is reached
 * only through a release profile.
 */

export type GateRoute = Readonly<{
  /** How a person or script starts it, exactly. */
  invocation: string;
  /** Where the invocation is written. */
  source: string;
  families: readonly GateFamily[];
  cadence: GateCadence | "all";
  /** Set for a profile run; the step must require this profile. */
  profile?: GateProfile;
}>;

/** The release gate's own invocation, checked against the file by reach.node.test.ts. */
export const RELEASE_INVOCATION_ARGS = ["scripts/quality-gates.ts", "--profile"] as const;
export const RELEASE_SOURCE = "scripts/verified-production-deploy.ts";

/** Parse every `scripts/quality-gates.ts` invocation out of package.json's scripts. */
export function routesFromPackageJson(packageJsonText: string): GateRoute[] {
  const parsed: unknown = JSON.parse(packageJsonText);
  const scripts =
    typeof parsed === "object" && parsed !== null && "scripts" in parsed
      ? ((parsed as { scripts?: unknown }).scripts ?? {})
      : {};
  if (typeof scripts !== "object" || scripts === null) return [];
  const routes: GateRoute[] = [];
  for (const [name, bodyRaw] of Object.entries(scripts as Record<string, unknown>)) {
    if (typeof bodyRaw !== "string") continue;
    // One script may chain several invocations with &&; each is its own route.
    for (const piece of bodyRaw.split("&&")) {
      if (!piece.includes("scripts/quality-gates.ts")) continue;
      const families = [...piece.matchAll(/--family\s+(\S+)/g)]
        .map((m) => m[1])
        .filter(
          (f): f is GateFamily => f === "fast" || f === "browser" || f === "perf" || f === "apple",
        );
      const cadenceMatch = /--cadence\s+(\S+)/.exec(piece);
      const profileMatch = /--profile\s+(\S+)/.exec(piece);
      const profile = KNOWN_PROFILES.find((p) => p === profileMatch?.[1]);
      const cadence: GateCadence | "all" =
        cadenceMatch?.[1] === "nightly"
          ? "nightly"
          : cadenceMatch?.[1] === "all"
            ? "all"
            : cadenceMatch?.[1] === "every-run"
              ? "every-run"
              : profile !== undefined
                ? "all"
                : "every-run";
      routes.push({
        invocation: `bun run ${name}`,
        source: "package.json",
        families,
        cadence,
        ...(profile === undefined ? {} : { profile }),
      });
    }
  }
  return routes;
}

/** The three release-profile routes, which the deploy script starts. */
export function releaseRoutes(): GateRoute[] {
  return KNOWN_PROFILES.map((profile) => ({
    invocation: `bun scripts/verified-production-deploy.ts --profile ${profile}`,
    source: RELEASE_SOURCE,
    families: ["fast", "browser", "perf", "apple"],
    cadence: "all" as const,
    profile,
  }));
}

export function allRoutes(root: string): GateRoute[] {
  return [
    ...routesFromPackageJson(readFileSync(join(root, "package.json"), "utf8")),
    ...releaseRoutes(),
  ];
}

/** Does this route run this step? The same three filters quality-gates.ts applies. */
export function routeReaches(route: GateRoute, step: GateStep): boolean {
  if (route.families.length > 0 && !route.families.includes(step.family)) return false;
  if (route.cadence !== "all" && route.cadence !== step.cadence) return false;
  if (route.profile !== undefined && !step.requiredInProfiles.includes(route.profile)) return false;
  return true;
}

/** Every route that reaches a step, by invocation. Empty means NOTHING runs it. */
export function reachedBy(routes: readonly GateRoute[], step: GateStep): string[] {
  const seen = new Set<string>();
  for (const route of routes) if (routeReaches(route, step)) seen.add(route.invocation);
  return [...seen].sort();
}
