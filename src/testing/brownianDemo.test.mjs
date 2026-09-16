import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { runBrownianDemo } from "../../scripts/reference/brownian-demo.mjs";

const near = (a, b) => assert.ok(Math.abs(a - b) < Math.abs(b) * 1e-12);
test("Brownian example composes the actual owners in canonical SI", () => {
  const result = runBrownianDemo();
  near(result.diffusionCoefficient.value, 4.294395645549615e-13);
  near(result.analytic.rmsDisplacement.value, 9.267573194261392e-7);
  assert.equal(result.grid.kind, "accepted");
  assert.equal(result.grid.elapsedTime, 1);
  assert.equal(result.grid.lastFrame.length, 101);
  near(result.grid.lastFrame.reduce((a, b) => a + b, 0) * result.inputs.dx, 1);
  assert.equal(result.comparison.kind, "accepted");
  assert.equal(result.comparison.wallContact, false);
  assert.equal(result.execution, "host-reference");
});
test("zero-time example returns a point distribution and its initial grid", () => {
  const result = runBrownianDemo({ t: 0 });
  assert.equal(result.analytic.densityAtOrigin.status, "analytic-limit");
  assert.equal(result.analytic.probabilityWithinOneMicrometre.value, 1);
  assert.equal(result.grid.elapsedTime, 0);
  assert.equal(result.grid.stepCount, 0);
  assert.equal(result.comparison.maxCellMassDifference.value, 0);
});
test("example exposes instability instead of silently repairing or running it", () => {
  const result = runBrownianDemo({ steps: 1 });
  assert.equal(result.grid.kind, "refused");
  assert.equal(result.grid.refusal.code, "ftcs-unstable");
  assert.equal(result.requestedGrid.dt, 1);
  assert.equal("lastFrame" in result.grid, false);
});
test("example distinguishes budget limits and physical parameter-domain results", () => {
  const exhausted = runBrownianDemo({ n: 100000 });
  assert.equal(exhausted.grid.kind, "outcome");
  assert.equal(exhausted.grid.outcome.outcome, "budget-exhausted");
  const domain = runBrownianDemo({ a: 0 });
  assert.equal(domain.diffusionCoefficient.status, "outside-domain");
  assert.equal("grid" in domain, false);
});
test("example rejects malformed inputs and the CLI reports an invalid invocation", () => {
  for (const bad of [
    null,
    [],
    { dt: 1 },
    { a: NaN },
    { steps: 0 },
    { t: -1 },
    {
      get T() {
        throw new Error("must not execute");
      },
    },
  ])
    assert.throws(() => runBrownianDemo(bad));
  const isBun = typeof process.versions.bun === "string";
  const execArgs = isBun
    ? ["scripts/reference/brownian-demo.mjs", '{"unknown":1}']
    : ["--experimental-strip-types", "scripts/reference/brownian-demo.mjs", '{"unknown":1}'];
  let child;
  for (let attempt = 1; attempt <= 3; attempt++) {
    child = spawnSync(
      process.execPath,
      execArgs,
      { cwd: new URL("../../", import.meta.url), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    if (!child.error) break;
    if (child.error.code === "EBADF" && attempt < 3) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50 * attempt);
      continue;
    }
  }
  if (child.error) {
    throw new Error(`Failed to spawn brownian-demo.mjs: ${child.error.message}`, { cause: child.error });
  }
  assert.equal(child.status, 1);
  assert.equal(child.stdout, "");
  assert.match(child.stderr, /Invalid input: unknown/);
});
