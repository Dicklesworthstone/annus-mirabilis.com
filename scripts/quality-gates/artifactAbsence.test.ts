/**
 * A STEP THAT MEASURES THE BUILD MUST NOT PASS WITHOUT ONE (am-7bkr, owner's decision 2026-10-08).
 *
 * `perf-budgets` was `family: "perf"`, `cadence: "nightly"`, required only by the `preview` and
 * `launch` profiles. dsr runs `--family fast` and `--family browser`, `bun run gates` is every-run,
 * and dsr has no nightly runner, so in practice the step had never executed. The registry header
 * recorded that and named the fix as an owner call.
 *
 * Runtime was the obvious objection and was measured first: 3 seconds, passing. So `nightly` was
 * never justified by cost. The real obstacle was that the step measures the production build while
 * `gates` builds nothing, and the owner's choice was: refuse without a build, THEN every-run.
 *
 * WHY THE REFUSAL HAD TO COME FIRST. Without it, moving the step to every-run makes a green that
 * measured nothing routine. Run with no build output it reports "2 of 8 rows reached real build
 * output; 6 reported not-available" and exits 0 -- and with no `.next` at all the 2 becomes 0. A
 * pass over an empty population is indistinguishable from a clean result, which AGENTS.md names
 * first among the ways this repository has actually broken.
 *
 * `AvailabilityProbe.requiresArtifact` and the `artifact-missing` kind exist for that, and this file
 * is their proof. It tests the PREDICATE and the RUNNER separately, because a typed kind nothing
 * acts on would be decoration: the second group asserts that a missing artefact becomes
 * `not-available` and is never counted as a pass.
 *
 * It runs in the bun lane while the gates run in the gate lane, so this proof does not live in the
 * lane it describes.
 */

import { describe, it } from "bun:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { checkStepAvailability, runQualityGates } from "../quality-gates.ts";
import type { GateStep } from "./registry.ts";
import { QUALITY_GATE_STEPS } from "./registry.ts";

const ROOT = process.cwd();

/** A path that cannot exist, so the absence branch is reached deterministically. */
const ABSENT = "am-7bkr-artifact-that-cannot-exist/manifest.json";

/** Present on any checkout of this repository, so the positive control is not machine-dependent. */
const PRESENT = "package.json";

function stepRequiring(path: string, hint = "Run `bun run build` first."): GateStep {
  return {
    id: "probe",
    title: "probe",
    command: ["bun", "scripts/run-perf-budgets.ts"],
    family: "fast",
    cadence: "every-run",
    requiredInCi: false,
    requiredInProfiles: [],
    owner: "am-7bkr",
    availability: { requiresArtifact: { path, hint } },
  };
}

describe("the predicate: a declared artefact that is absent is reported as absent", () => {
  it("names the path, carries the hint, and is typed artifact-missing", () => {
    const hint = "The budgets are measured from the production build. Run `bun run build` first.";
    const result = checkStepAvailability(stepRequiring(ABSENT, hint), ROOT);
    assert.equal(result.available, false);
    // The typed kind is what lets a caller tell this from a gate that ran and failed.
    assert.equal(result.kind, "artifact-missing");
    assert.ok(result.details.includes(ABSENT), "the details do not name the missing path");
    assert.ok(result.details.includes(hint), "the hint is not in the details");
    // It says what the consequence is, not only what is missing.
    assert.match(result.details, /measure nothing/);
  });

  it("a declared artefact that EXISTS does not block the step", () => {
    // The positive control. Without it, a predicate that returned artifact-missing unconditionally
    // would satisfy every assertion above.
    assert.equal(existsSync(join(ROOT, PRESENT)), true, "the control path is itself missing");
    const result = checkStepAvailability(stepRequiring(PRESENT), ROOT);
    assert.equal(result.available, true);
    assert.equal(result.kind, "available");
  });

  it("a step declaring no artefact does not acquire the requirement", () => {
    const step: GateStep = { ...stepRequiring(ABSENT), availability: {} };
    const result = checkStepAvailability(step, ROOT);
    assert.equal(result.available, true);
    assert.equal(result.kind, "available");
  });
});

describe("the runner: a missing artefact is not-available and never a pass", () => {
  it("records not-available with reason artifact-missing, and passedCount stays 0", () => {
    // The half that matters. A typed kind the runner ignored would leave the step PASSING, which is
    // the whole defect this guards.
    const summary = runQualityGates({
      steps: [stepRequiring(ABSENT)],
      mode: "all",
      silent: true,
    });
    assert.equal(summary.notAvailableCount, 1);
    assert.equal(summary.passedCount, 0);
    assert.equal(summary.failedCount, 0);
    assert.equal(summary.results[0]?.outcome, "not-available");
    assert.equal(summary.results[0]?.reason, "artifact-missing");
  });

  it("a profile run REFUSES rather than reporting it, because a release cannot measure nothing", () => {
    // The two modes differ on purpose: a local `bun run gates` says so and carries on, a release
    // stops. That asymmetry is why the requirement is declared on the step and classified by the
    // runner, rather than being an exit code inside the script.
    const summary = runQualityGates({
      steps: [{ ...stepRequiring(ABSENT), requiredInProfiles: ["launch"] }],
      mode: "profile",
      profile: "launch",
      silent: true,
    });
    assert.equal(summary.outcome, "refused");
    assert.equal(summary.passedCount, 0);
  });
});

describe("the live registry declares it where it is needed, and only there", () => {
  it("perf-budgets requires the build manifest and is now reached by a dsr check", () => {
    const step = QUALITY_GATE_STEPS.find((s) => s.id === "perf-budgets");
    assert.ok(step, "perf-budgets is not in the registry");
    assert.equal(step.availability?.requiresArtifact?.path, ".next/app-build-manifest.json");
    // family fast + every-run is what `bun run gates` selects; nightly in the perf family was not
    // reached by anything, which is what this bead was about.
    assert.equal(step.family, "fast");
    assert.equal(step.cadence, "every-run");
    assert.equal(step.requiredInCi, true);
  });

  it("resource-stress declares NO artefact, because it measures none", () => {
    // Measured 2026-10-08: it runs in under a second from a cold tree and passes 6 of 6 scenarios,
    // each with a real duration. Declaring a build requirement it does not have would make it
    // not-available for no reason, which is the mirror-image error.
    const step = QUALITY_GATE_STEPS.find((s) => s.id === "resource-stress");
    assert.ok(step, "resource-stress is not in the registry");
    assert.equal(step.availability?.requiresArtifact, undefined);
    assert.equal(step.family, "fast");
    assert.equal(step.cadence, "every-run");
  });

  it("only steps that measure a build artefact declare one, and each names a distinct one", () => {
    // THE MEMBERSHIP LIST IS KEPT ON PURPOSE, and that is the decision worth recording. This read
    // `deepEqual(declaring, ["perf-budgets"])` and went red when a second step legitimately needed
    // the field: adversarial-runtime loads the real built routes over HTTP and measures nothing
    // without out/. The obvious reading is that an exact census is brittle, and AGENTS.md says so
    // under "A Count Is For Reporting, Not For Asserting" -- but here the brittleness IS the
    // mechanism. Forcing a short conversation before a third step claims the field is the whole
    // function of this assertion, exactly like a declared-debt list, so the list stays and
    // adversarial-runtime was added to it deliberately rather than the list being loosened.
    //
    // What is NEW is that the list can no longer be a rubber stamp. The hazard named in the old
    // title was a declaration spreading BY COPYING, and a copied declaration shows up as a
    // duplicated path, so each declarer must now name a DISTINCT path under a build output
    // directory with a hint long enough to tell a reader which command makes it. Membership is
    // argued for; the properties are checked.
    const declaring = QUALITY_GATE_STEPS.filter(
      (s) => s.availability?.requiresArtifact !== undefined,
    );
    const ids = declaring.map((s) => s.id).sort();
    // Non-vacuity on purpose: a filter that matched nothing would satisfy every assertion below.
    assert.ok(declaring.length > 0, "no step declares a required artefact");
    assert.deepEqual(ids, ["adversarial-runtime", "perf-budgets"]);

    const paths = declaring.map((s) => s.availability?.requiresArtifact?.path ?? "");
    assert.equal(
      new Set(paths).size,
      paths.length,
      `two steps name the same artefact, which is what copying looks like: ${paths.join(", ")}`,
    );
    for (const step of declaring) {
      const artefact = step.availability?.requiresArtifact;
      assert.ok(artefact, `${step.id} lost its artefact between the filter and the loop`);
      assert.match(
        artefact.path,
        /^(\.next|out)\//,
        `${step.id} names ${artefact.path}, which is not under a build output directory`,
      );
      assert.ok(
        artefact.hint.length > 40,
        `${step.id}'s hint must tell a reader what is missing and the command that makes it`,
      );
    }
  });
});
