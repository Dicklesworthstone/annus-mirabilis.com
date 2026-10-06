/**
 * WHICH RUNNER REACHES A GATE, and the trap in asking (am-rc1001-bridge-plan-pcjk.9).
 *
 * In the node lane, like the rest of the census, because the census judges every registry step and
 * `bun run test` is one of them.
 *
 * The specimens are hand-written package.json texts rather than the real one, so a change to the real
 * scripts cannot quietly make a case vacuous. Two cases DO read the real tree, and they are the ones
 * that must: the declaration of the release gate's own invocation is checked against
 * verified-production-deploy.ts, and the real routes are asserted to be non-empty.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { GateStep } from "../quality-gates/registry.ts";
import { QUALITY_GATE_STEPS } from "../quality-gates/registry.ts";
import {
  allRoutes,
  RELEASE_INVOCATION_ARGS,
  RELEASE_SOURCE,
  reachedBy,
  releaseRoutes,
  routeReaches,
  routesFromPackageJson,
} from "./reach.ts";

const pkg = (scripts: Record<string, string>): string => JSON.stringify({ scripts });

const step = (over: Partial<GateStep> = {}): GateStep => ({
  id: "s",
  title: "t",
  command: ["bun", "x.ts"],
  family: "fast",
  cadence: "every-run",
  requiredInCi: true,
  requiredInProfiles: ["preview", "launch"],
  availability: {},
  owner: "am-x",
  ...over,
});

test("a script invoking quality-gates with a family becomes a route", () => {
  const routes = routesFromPackageJson(
    pkg({ gates: "bun scripts/quality-gates.ts --fail-fast --family fast" }),
  );
  assert.equal(routes.length, 1);
  assert.equal(routes[0]?.invocation, "bun run gates");
  assert.deepEqual(routes[0]?.families, ["fast"]);
  assert.equal(routes[0]?.cadence, "every-run", "no --cadence means every-run for a family run");
});

test("a script chaining two invocations with && becomes TWO routes", () => {
  // The real `gates` script does exactly this, and reading it as one route would credit the browser
  // family to a fast-only filter.
  const routes = routesFromPackageJson(
    pkg({
      gates:
        "bun scripts/quality-gates.ts --fail-fast --family fast && bun scripts/quality-gates.ts --fail-fast --family browser",
    }),
  );
  assert.equal(routes.length, 2);
  assert.deepEqual(
    routes.map((r) => r.families[0]),
    ["fast", "browser"],
  );
});

test("a script that does not invoke quality-gates is not a route, however it is named", () => {
  const routes = routesFromPackageJson(
    pkg({ gates: "echo no", "gates:fake": "bun scripts/something-else.ts --family fast" }),
  );
  assert.deepEqual(routes, []);
});

test("an explicit --cadence is honoured, and a --profile implies cadence all", () => {
  const nightly = routesFromPackageJson(
    pkg({ n: "bun scripts/quality-gates.ts --family perf --cadence nightly" }),
  );
  assert.equal(nightly[0]?.cadence, "nightly");
  const profiled = routesFromPackageJson(
    pkg({ p: "bun scripts/quality-gates.ts --profile preview" }),
  );
  assert.equal(
    profiled[0]?.cadence,
    "all",
    "quality-gates.ts defaults a profile run to cadence all",
  );
  assert.equal(profiled[0]?.profile, "preview");
});

test("an unknown family or profile is dropped rather than invented", () => {
  const routes = routesFromPackageJson(
    pkg({ x: "bun scripts/quality-gates.ts --family quantum --profile midnight" }),
  );
  assert.deepEqual(routes[0]?.families, []);
  assert.equal(routes[0]?.profile, undefined);
});

test("THE CADENCE FILTER: a family route does not reach a nightly step", () => {
  // The whole reason a 'fast' step can be unreachable by every local command: `bun run gates` passes
  // no --cadence, and quality-gates.ts then defaults to every-run.
  const route = routesFromPackageJson(
    pkg({ gates: "bun scripts/quality-gates.ts --family fast" }),
  )[0];
  assert.ok(route);
  assert.equal(routeReaches(route, step({ family: "fast", cadence: "every-run" })), true);
  assert.equal(routeReaches(route, step({ family: "fast", cadence: "nightly" })), false);
  assert.equal(routeReaches(route, step({ family: "perf", cadence: "every-run" })), false);
});

test("a profile route reaches a step only when the step requires that profile", () => {
  const [scaffold] = releaseRoutes();
  assert.ok(scaffold);
  assert.equal(scaffold.profile, "scaffold");
  assert.equal(
    routeReaches(scaffold, step({ requiredInProfiles: ["preview", "launch"] })),
    false,
    "required in preview and launch is not required in scaffold",
  );
  assert.equal(routeReaches(scaffold, step({ requiredInProfiles: ["scaffold"] })), true);
  assert.equal(
    routeReaches(scaffold, step({ requiredInProfiles: [], cadence: "nightly" })),
    false,
    "a step required in no profile is never reached by a release run",
  );
});

test("reachedBy returns an empty list for a step nothing runs, which is what the census reddens", () => {
  const routes = routesFromPackageJson(
    pkg({ gates: "bun scripts/quality-gates.ts --family fast" }),
  );
  const orphan = step({ family: "perf", cadence: "nightly", requiredInProfiles: [] });
  assert.deepEqual(reachedBy(routes, orphan), []);
  // And the control, so an empty answer is not this function's only answer.
  assert.deepEqual(reachedBy(routes, step()), ["bun run gates"]);
});

test("the release gate's declared invocation is still the one in the deploy script", () => {
  // The one declaration here that is not parsed, so it is the one that could drift. If this fails,
  // either the deploy script stopped running the gate chain or it changed how, and the census's
  // release routes are describing something that no longer happens.
  const source = readFileSync(RELEASE_SOURCE, "utf8");
  for (const arg of RELEASE_INVOCATION_ARGS) {
    assert.ok(source.includes(`"${arg}"`), `${RELEASE_SOURCE} no longer passes ${arg}`);
  }
  assert.match(
    source,
    /\["scripts\/quality-gates\.ts",\s*"--profile",\s*profile/,
    `${RELEASE_SOURCE} no longer invokes the gate chain with the requested profile`,
  );
});

test("the real tree yields routes and a reachable registry, so nothing above is vacuous", () => {
  // NOT a census of reachedBy per step - that belongs to the census CLI and its own output. This is
  // the floor: if package.json stopped naming a gate script, every assertion in this file would still
  // pass while the census reported 48 unreachable gates.
  const routes = allRoutes(process.cwd());
  assert.ok(routes.length >= 4, `only ${routes.length} routes found`);
  assert.ok(
    routes.some((r) => r.invocation === "bun run gates"),
    "bun run gates is not among the parsed routes",
  );
  assert.ok(QUALITY_GATE_STEPS.length > 40, `only ${QUALITY_GATE_STEPS.length} registry steps`);
  const unreachable = QUALITY_GATE_STEPS.filter((s) => reachedBy(routes, s).length === 0);
  assert.deepEqual(
    unreachable.map((s) => s.id),
    [],
    "a registry step is reached by no runner; the census names it and this is the floor",
  );
});
