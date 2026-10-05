/**
 * A MISSING TOOL IS NOT A GATE FINDING, AND THE MESSAGE HAS TO SAY SO (am-dbuk).
 *
 * `ubs-diff` and `ubs-staged` put `ubs` on the LAUNCH profile's critical path. The behaviour is
 * fail-closed, which is right: on a machine without the binary the profile refuses rather than
 * silently skipping a scan. What was wrong is what a releaser READS. The bare message is
 * "Required tool 'ubs' was not found in PATH or node_modules/.bin", which reads as a broken release
 * rather than an uninstalled dependency, so somebody would debug the release instead of installing
 * a tool. The bead's words: a gate that fails for an unnameable reason trains people to discount it.
 *
 * `AvailabilityProbe.toolHint` and the `tool-missing` kind were added for exactly this, and
 * `quality-gates.ts` joins the hint to the base message. NOTHING TESTED ANY OF IT, which is the gap
 * this file closes: a mechanism whose only evidence is that it was written is a mechanism nobody
 * knows still works. The check runs in the bun lane while the gates run in the gate lane, so this
 * proof does not live in the lane it describes.
 *
 * WHAT IS NOT DECIDED HERE, because the bead says so explicitly: whether `ubs` belongs on the launch
 * path at all is an owner call about release requirements. These tests pin the MESSAGE and the
 * typed kind, not the policy.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { checkStepAvailability, isToolOnPath } from "../quality-gates.ts";
import type { GateStep } from "./registry.ts";
import { QUALITY_GATE_STEPS } from "./registry.ts";

const ROOT = process.cwd();

/** A step naming a tool that cannot exist, so the absence branch is reached deterministically. */
function stepRequiring(tool: string, toolHint?: string): GateStep {
  return {
    id: "probe",
    title: "probe",
    command: [tool],
    family: "fast",
    cadence: "every-run",
    requiredInCi: false,
    requiredInProfiles: [],
    owner: "am-dbuk",
    availability: { tool, ...(toolHint === undefined ? {} : { toolHint }) },
  };
}

const ABSENT_TOOL = "am-dbuk-tool-that-cannot-exist";

/**
 * Tools assumed present on any machine that can check out this repository.
 *
 * Deliberately tiny and explicit rather than inferred: `git` is how the working tree got here, so a
 * gate requiring it needs no instructions. Anything else not installed BY this repo has to say where
 * it comes from, which is the point of am-dbuk.
 */
const ASSUMED_PRESENT = new Set(["git"]);

describe("a missing tool is reported as missing, not as a finding (am-dbuk)", () => {
  it("names the tool and carries the hint, and is typed tool-missing", () => {
    const hint = "Obtain the binary and put it on PATH; its absence is not a scan finding.";
    const result = checkStepAvailability(stepRequiring(ABSENT_TOOL, hint), ROOT);
    assert.equal(result.available, false);
    // The typed kind is what lets a caller tell this from a gate that ran and failed.
    assert.equal(result.kind, "tool-missing");
    assert.match(result.details, new RegExp(ABSENT_TOOL));
    assert.match(result.details, /not found in PATH/);
    // The hint is appended, not substituted: a reader gets both the mechanical fact and the reason.
    assert.ok(result.details.includes(hint), "the hint is not in the details");
  });

  it("without a hint the message is bare, which is the state the bead was filed about", () => {
    // The negative control for the hint itself. If this also carried an explanation, the assertion
    // above would pass whether or not toolHint was ever read.
    const result = checkStepAvailability(stepRequiring(ABSENT_TOOL), ROOT);
    assert.equal(result.kind, "tool-missing");
    assert.match(result.details, /not found in PATH/);
    assert.ok(
      !/not a scan finding/.test(result.details),
      "a step with no hint must not acquire one from somewhere else",
    );
  });

  it("a tool that IS present is available, so the branch is not always taken", () => {
    // The positive control. `node` is running this test, so it is on PATH by construction.
    assert.equal(isToolOnPath("node"), true);
    const result = checkStepAvailability(stepRequiring("node"), ROOT);
    assert.equal(result.available, true);
    assert.equal(result.kind, "available");
  });
});

describe("every registered gate that needs a tool explains its absence", () => {
  it("the ubs gates carry a hint naming the binary and disclaiming a finding", () => {
    const ubsGates = QUALITY_GATE_STEPS.filter(
      (step: GateStep) => step.availability?.tool === "ubs",
    );
    // The population is real: this bead is about two gates, and a rename must not empty the check.
    assert.ok(ubsGates.length >= 2, `expected the ubs gates, found ${ubsGates.length}`);
    for (const step of ubsGates) {
      const hint = step.availability?.toolHint ?? "";
      assert.ok(hint.length > 0, `${step.id} has no toolHint`);
      // Named, so a reader knows what to install.
      assert.match(hint, /ubs/, `${step.id}'s hint does not name the binary`);
      // And disclaimed, so nobody reads the refusal as a result about the code.
      assert.match(
        hint,
        /NOT a finding about the code|not a scan finding|not a finding/i,
        `${step.id}'s hint does not say its absence is not a finding`,
      );
    }
  });

  it("a gate whose tool is NOT bundled with the repo explains how to get it", () => {
    // THE RULE IS NARROWER THAN "every tool needs a hint", and the first version of this test was
    // that blunt rule: it reported 20 of 22 gates failing, naming tsc, biome and git. Those are not
    // this bead's problem. `tsc` and `biome` resolve from node_modules/.bin, so the absence branch is
    // unreachable for them on any machine with the repo installed, and a hint there is noise.
    //
    // What matters is a tool that must be obtained SEPARATELY, because that is the one whose absence
    // reads as a broken release. The criterion is therefore resolvability rather than a hand-kept
    // list: a tool neither on PATH nor in node_modules/.bin is external to this repo, and a gate
    // declaring one has to say where it comes from.
    const bundled: string[] = [];
    const external: string[] = [];
    for (const step of QUALITY_GATE_STEPS) {
      const tool = step.availability?.tool;
      if (!tool) continue;
      // NOT `isToolOnPath`, and that correction matters: the first version of this rule treated a
      // tool as bundled if it was on PATH, which on the REFERENCE MACHINE includes `ubs` -- so the
      // external list came back empty and the rule examined nothing while passing. A check whose
      // population is empty reads exactly like a clean one.
      //
      // node_modules/.bin is the stable criterion: it holds what this repo installs, on any machine
      // that installed it, and never holds a separately obtained binary however available it is here.
      const resolvable =
        existsSync(join(ROOT, "node_modules", ".bin", tool)) || ASSUMED_PRESENT.has(tool);
      (resolvable ? bundled : external).push(`${step.id}:${tool}`);
    }
    console.log(
      `[tool absence] ${bundled.length + external.length} gate(s) declare a tool; ` +
        `${bundled.length} resolvable here, ${external.length} not: ${external.join(", ") || "none"}`,
    );
    // Non-vacuity: with no gate declaring a tool, every verdict below would be empty and true.
    assert.ok(bundled.length + external.length > 0, "no gate declares a tool; nothing examined");
    const unexplained = QUALITY_GATE_STEPS.filter(
      (step: GateStep) =>
        step.availability?.tool &&
        external.includes(`${step.id}:${step.availability.tool}`) &&
        !step.availability.toolHint,
    ).map((step: GateStep) => `${step.id} (tool ${step.availability?.tool})`);
    assert.deepEqual(unexplained, []);
  });
});
