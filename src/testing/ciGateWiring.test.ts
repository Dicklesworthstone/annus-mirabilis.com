import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { QUALITY_GATE_STEPS } from "../../scripts/quality-gates/registry.ts";
import { DSR_CHECKS } from "./dsrChecks.ts";

/**
 * A gate that declares itself required must be RUN by a job (am-browser-gate-identity-7nq2).
 *
 * The defect this exists for: browser-acceptance read `requiredInCi: true` from the day it was
 * written, and no workflow ever executed it. Its family was "browser" and no job passed
 * --family browser; the workflow that carried its name ran a different command over 20 files
 * the node lane already runs. The flag was never wrong. The wiring was missing, and nothing
 * compared the two.
 *
 * SO THIS TEST MUST NOT ASSERT THE DECLARATION. A test that read requiredInCi and checked it was
 * true would have passed every day of that period, which is the tautology the bead exists
 * because of. The flag is used only to SELECT the population; the evidence is the text of what
 * the CI actually runs. Nothing in scripts/quality-gates/ can satisfy this test on its own.
 *
 * THE EVIDENCE MOVED, 2026-09-22, am-7bkr. This read `.github/workflows/*.yml` and was green
 * while browser-acceptance was run by nothing, which is the very drift the file was written to
 * prevent. The owner's standing rule is verbatim "we don't use gh actions for CI *EVER*, we
 * ONLY use /dsr", and ~/.config/dsr/repos.yaml says the same in a comment on this repository:
 * "No `workflow:` key on purpose - GitHub Actions is never the CI on this account." So the
 * workflow text was the wiring of a runner that never starts, and a guard pointed at it cannot
 * see the thing it guards. Measured before the repair, with the CI's own flags:
 *
 *   bun scripts/quality-gates.ts --fail-fast --family fast --only browser-acceptance
 *     -> Selected Steps: 0, exit 0
 *   the same command with --only architecture (a fast step, as a positive control)
 *     -> Selected Steps: 1, passed
 *
 * The evidence is now package.json, because dsr runs `bun run <script>` and those scripts are
 * in the repository.
 */

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

/**
 * dsr's checks for this repository, from ~/.config/dsr/repos.yaml, tools.annus-mirabilis.checks:
 * `bun run typecheck`, `bun run test`, `bun run test:node`, `bun run gates`.
 *
 * That file is outside the repository and is not on every machine, so the list is MIRRORED here
 * and every entry is asserted to exist in package.json below. A mirror that drifted would name a
 * script that is not there, and the population test fails on that rather than quietly narrowing.
 */
// The list itself is MIRRORED ONCE, in dsrChecks.ts, which carries the provenance above and the
// reason. It was copied here and in scripts/perf/gateRegistration.test.ts, identically and with
// the same reasoning spelled out twice (am-7bkr).

type Step = Readonly<{ file: string; line: string }>;

function ciRunSteps(): readonly Step[] {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const steps: Step[] = [];
  for (const name of DSR_CHECKS) {
    const body = pkg.scripts?.[name];
    if (body) steps.push({ file: `package.json scripts.${name}`, line: body });
  }
  return steps;
}

/** Families the gate chain is invoked for, and whether any invocation omits the filter. */
function chainCoverage(steps: readonly Step[]): {
  families: ReadonlySet<string>;
  everyFamily: boolean;
  cadences: ReadonlySet<string>;
} {
  const families = new Set<string>();
  const cadences = new Set<string>();
  let everyFamily = false;
  for (const step of steps) {
    if (!step.line.includes("quality-gates.ts")) continue;
    // matchAll, not exec: one script may chain several invocations, and `gates` does - it runs
    // the fast family and then the browser family. Reading only the first would report the
    // browser gate unwired, which is the failure this file exists to report truthfully.
    const familyMatches = [...step.line.matchAll(/--family\s+(\S+)/g)].map((m) => m[1]);
    if (familyMatches.length === 0 || familyMatches.includes("all")) everyFamily = true;
    for (const family of familyMatches) {
      if (family !== undefined && family !== "all") families.add(family);
    }
    // An omitted --cadence is NOT "all". quality-gates.ts:168 defaults it to "every-run" outside
    // profile mode, and line 286 then SKIPS any step whose cadence differs. Modelling the default
    // as "all" would report a requiredInCi gate with cadence nightly as wired while the runner
    // skips it every time - the same declaration-versus-wiring gap one layer down.
    const cadenceMatches = [...step.line.matchAll(/--cadence\s+(\S+)/g)].map((m) => m[1]);
    if (cadenceMatches.length === 0) cadences.add("every-run");
    for (const cadence of cadenceMatches) if (cadence !== undefined) cadences.add(cadence);
  }
  return { families, everyFamily, cadences };
}

/**
 * Families whose steps no dsr check runs, ON PURPOSE, each naming where that decision is recorded.
 *
 * This is a declared debt and not an allowlist: the test below refuses a stale entry and refuses an
 * entry whose family has become reachable, so it can only shrink. Adding a family here is a claim
 * that someone decided, in a place that can be read.
 */
const FAMILIES_OUT_OF_CI: Readonly<Record<string, string>> = {
  apple:
    "AGENTS.md: \"Apple validation runs locally as the `apple` gate family, not in the website's CI.\" Run by package.json scripts.gates:apple, which is not one of dsr's checks.",
};

/**
 * The dsr checks that actually run `gate`, by name, or an empty list.
 *
 * Both routes count, because both are real wiring: the gate chain invoked for the gate's family
 * with a cadence that admits it, or a check whose script runs the gate's own command directly. The
 * cadence half matters and is easy to miss -- an omitted `--cadence` is not "all", it defaults to
 * "every-run" and the runner then SKIPS any step whose cadence differs, so a nightly step inside a
 * covered family is still reached by nothing.
 */
function reachingChecks(
  gate: (typeof QUALITY_GATE_STEPS)[number],
  steps: readonly Step[],
): readonly string[] {
  const reached: string[] = [];
  for (const step of steps) {
    const name = step.file.replace("package.json scripts.", "");
    if (step.line.includes("quality-gates.ts")) {
      const families = [...step.line.matchAll(/--family\s+(\S+)/g)].map((m) => m[1]);
      const cadences = [...step.line.matchAll(/--cadence\s+(\S+)/g)].map((m) => m[1]);
      const everyFamily = families.length === 0 || families.includes("all");
      const familyOk = everyFamily || families.includes(gate.family);
      const admitted = cadences.length === 0 ? ["every-run"] : cadences;
      const cadenceOk = admitted.includes("all") || admitted.includes(gate.cadence);
      if (familyOk && cadenceOk) {
        reached.push(name);
        continue;
      }
    }
    if (gate.command.slice(1).every((part) => step.line.includes(part))) reached.push(name);
  }
  return [...new Set(reached)];
}

describe("a gate required in CI is run by a CI job (am-browser-gate-identity-7nq2)", () => {
  const steps = ciRunSteps();
  const required = QUALITY_GATE_STEPS.filter((step) => step.requiredInCi);

  test("the population is real, so a pass cannot mean the test found nothing", () => {
    // Every assertion below quantifies over these three. An empty one would make the suite green
    // by computing over nothing, which is how a check that has stopped running looks from here.
    expect(steps.length, "no dsr check resolved to a package.json script").toBe(DSR_CHECKS.length);
    expect(required.length, "no gate declares requiredInCi").toBeGreaterThan(0);
    expect(steps.some((s) => s.line.includes("quality-gates.ts"))).toBe(true);
  });

  test("every requiredInCi gate is executed by some dsr check", () => {
    const { families, everyFamily, cadences } = chainCoverage(steps);
    const unwired = required
      .filter((gate) => {
        const byChain = everyFamily || families.has(gate.family);
        // A cadence filter can exclude a gate the family would otherwise cover, so a gate is
        // only chain-covered when some invocation would admit its cadence too.
        const cadenceOk = cadences.has("all") || cadences.has(gate.cadence);
        if (byChain && cadenceOk) return false;
        // Or a job may run the gate's own command directly, which is equally real wiring.
        const direct = steps.some((s) =>
          gate.command.slice(1).every((part) => s.line.includes(part)),
        );
        return !direct;
      })
      .map((gate) => `${gate.id} (family ${gate.family}, cadence ${gate.cadence})`);

    expect(
      unwired,
      `A gate declares requiredInCi and no dsr check runs it. Declaring a requirement is not the same as wiring one, and this is the exact defect am-browser-gate-identity-7nq2 documents: browser-acceptance read true for its whole life while nothing executed it. Either widen the --family filter in package.json's 'gates' script, run its command directly from another dsr check, or stop claiming it is required.\n${unwired.join("\n")}`,
    ).toEqual([]);
  });

  /**
   * THE PER-STEP LIST, PRINTED (am-7bkr item 1, verbatim: "Enumerate every registry step and say,
   * per step, which dsr check reaches it. Print 'reached by: <check>' or 'reached by: NOTHING'.
   * That list is the deliverable; the count alone is not.").
   *
   * The test above already asserts the PROPERTY that no requiredInCi gate is unreached, and it
   * passes. What it does not do is say which check reaches which step, so nobody reading a green
   * run can see that the apple family's fifteen steps are reached by nothing -- a fact that is
   * correct and deliberate, and was invisible.
   *
   * THE ASSERTIONS HERE ARE NOT A SECOND COPY OF THE ONE ABOVE. That one quantifies over
   * `requiredInCi` steps and asks whether each is wired. This one quantifies over ALL steps and
   * asks the opposite question: for every step nothing runs, is that an intention recorded
   * somewhere true? Those are different populations and different failures. A step landing in a
   * brand-new family that no dsr check invokes passes the test above, because a new step is
   * unlikely to declare requiredInCi on its first day, and fails this one.
   */
  test("every registry step says which dsr check reaches it, or NOTHING", () => {
    const rows = QUALITY_GATE_STEPS.map((gate) => ({ gate, by: reachingChecks(gate, steps) }));
    // Printed grouped, because 51 unsorted lines is a list nobody reads. The grouping is by
    // reaching check so the "NOTHING" group is one block rather than scattered through the rest.
    const groups = new Map<string, string[]>();
    for (const { gate, by } of rows) {
      const key = by.length > 0 ? by.join(" + ") : "NOTHING";
      const list = groups.get(key) ?? [];
      // The profile route is printed for every row, because a step reached by no dsr check may
      // still run on every release, and a reader of this list must be able to tell those apart.
      const profiles = gate.requiredInProfiles ?? [];
      const alsoProfile = profiles.length > 0 ? `, runs in profile: ${profiles.join("/")}` : "";
      list.push(
        `${gate.id} (family ${gate.family}, cadence ${gate.cadence}${gate.requiredInCi ? ", requiredInCi" : ""}${alsoProfile})`,
      );
      groups.set(key, list);
    }
    console.log(
      `[ci reachability] ${rows.length} registry steps against ${DSR_CHECKS.length} dsr checks:`,
    );
    for (const [by, ids] of [...groups].sort()) {
      console.log(`  reached by: ${by}  -- ${ids.length} step(s)`);
      for (const id of ids.sort()) console.log(`      ${id}`);
    }

    // A pass computed over nothing would print an empty list and read exactly like this one.
    expect(rows.length, "the registry resolved to no steps").toBeGreaterThan(40);
    expect(
      rows.some((r) => r.by.length > 0),
      "no step is reached by any dsr check",
    ).toBe(true);

    // TWO ROUTES MAKE A STEP DELIBERATELY UNREACHED, and they are declared in different places,
    // which is why this is not a single allowlist. A step excused by neither is a step nothing
    // runs and nobody decided, and that is the finding.
    const unreached = rows.filter((r) => r.by.length === 0).map((r) => r.gate);
    const undeclared = unreached
      .filter((gate) => {
        // By FAMILY: the whole family is run somewhere other than CI, recorded below.
        if (gate.family in FAMILIES_OUT_OF_CI) return false;
        // By CADENCE: no package.json script passes `--cadence` at all, so "nightly" is a cadence
        // no dsr check invokes. That is a real declaration only when the step also stops claiming
        // to be required and says why -- both of which `ciExemptionReasons.node.test.ts` gates.
        // A PROFILE RUN IS REAL WIRING, and leaving it out would have made this list overstate.
        // quality-gates.ts:185 sets the cadence filter to "all" in profile mode, so a
        // `--profile preview` run DOES execute a nightly step. A nightly step that declares
        // requiredInProfiles therefore runs on every release; one that declares none runs nowhere
        // at all, and only the second is a finding. Both of this repository's nightly steps are the
        // first kind, which is why "reached by: NOTHING" is reported against the four dsr checks
        // and is not a claim that nothing ever runs them.
        if (
          gate.cadence === "nightly" &&
          !gate.requiredInCi &&
          gate.notRequiredInCiReason &&
          (gate.requiredInProfiles?.length ?? 0) > 0
        ) {
          return false;
        }
        return true;
      })
      .map((gate) => `${gate.id} (family ${gate.family}, cadence ${gate.cadence})`);
    expect(
      undeclared,
      `These steps are reached by no dsr check and nothing declares why. A step nothing runs is not a gate. Fix it one of three ways: wire its family into package.json's 'gates' script; add the family to FAMILIES_OUT_OF_CI naming where the decision is recorded; or, if it is genuinely nightly-only, give it cadence "nightly", requiredInCi false and a notRequiredInCiReason.\n${undeclared.join("\n")}`,
    ).toEqual([]);

    // The contradiction this repository is most likely to produce next: a step that declares it is
    // required in CI while carrying a cadence no CI invocation admits. It would read as enforced.
    const requiredButNightly = QUALITY_GATE_STEPS.filter(
      (gate) => gate.requiredInCi && gate.cadence === "nightly",
    ).map((gate) => gate.id);
    expect(
      requiredButNightly,
      'A step is requiredInCi with cadence "nightly", and no package.json script passes --cadence, so no dsr check admits that cadence. Either give it cadence "every-run" or stop claiming it is required.',
    ).toEqual([]);
  });

  /**
   * THE DECLARATION REFUSES IN BOTH DIRECTIONS, which is what separates it from an allowlist.
   *
   * A map of families excused from CI is one edit away from being a standing permission. Two
   * assertions stop that: a declared family with no steps is a stale excuse and must go, and a
   * declared family that a dsr check DOES reach is an excuse that has outlived its reason -- the
   * case that matters, because it is what happens the day someone widens the --family filter and
   * leaves the declaration behind, which is how this repository's own browser gate came to read
   * `requiredInCi: true` for its whole life while nothing executed it.
   */
  test("no family is declared out of CI stalely, and none is declared while reachable", () => {
    for (const [family, where] of Object.entries(FAMILIES_OUT_OF_CI)) {
      const inFamily = QUALITY_GATE_STEPS.filter((gate) => gate.family === family);
      expect(
        inFamily.length,
        `Family "${family}" is declared out of CI but the registry has no step in it. A declaration with no population is a stale excuse: remove it.`,
      ).toBeGreaterThan(0);

      const reachable = inFamily.filter((gate) => reachingChecks(gate, steps).length > 0);
      expect(
        reachable.map((gate) => gate.id),
        `Family "${family}" is declared out of CI (${where}) but a dsr check now reaches ${reachable.length} of its ${inFamily.length} steps. The declaration has outlived its reason: delete the entry rather than keeping an excuse beside a gate that runs.`,
      ).toEqual([]);

      // The declaration must name where the decision lives, not merely that one was taken.
      expect(where.length, `Family "${family}" declares no provenance`).toBeGreaterThan(30);
    }
  });

  /**
   * THE CADENCE EXCUSE IS REFUSED THE SAME WAY, because it rests on a fact that can change.
   *
   * "Nightly steps are reached by nothing" is true only while no package.json script passes
   * `--cadence`. The moment one does, a nightly step IS reachable and the excuse above would be
   * silently excusing a step that runs -- the same shape as a stale family declaration. So the fact
   * is asserted rather than assumed, and it fails loudly the day it stops being true, pointing at
   * the excuse that then needs removing rather than leaving it to be noticed.
   */
  test("the nightly excuse rests on a measured fact: no dsr check names a cadence", () => {
    const naming = steps.filter((step) => step.line.includes("--cadence"));
    expect(
      naming.map((step) => step.file),
      'A dsr check now passes --cadence. If it admits "nightly", the cadence route in the reachability test above is excusing steps that actually run, and that branch must go. Re-measure which steps are reached before trusting it.',
    ).toEqual([]);
    // And the population the excuse covers is real, so this is not a rule about an empty set.
    const nightly = QUALITY_GATE_STEPS.filter((gate) => gate.cadence === "nightly");
    console.log(
      `[ci reachability] ${nightly.length} nightly step(s) excused by cadence: ${nightly
        .map((g) => `${g.id} [profiles: ${(g.requiredInProfiles ?? []).join("/") || "NONE"}]`)
        .join(", ")}`,
    );
    expect(nightly.length).toBeGreaterThan(0);
    // The excuse rests on the profile route existing. A nightly step with no profile is a step
    // nothing anywhere runs, and it must not be quietly excused by its cadence.
    const nowhere = nightly
      .filter((gate) => (gate.requiredInProfiles?.length ?? 0) === 0)
      .map((gate) => gate.id);
    expect(
      nowhere,
      'A nightly step declares no requiredInProfiles. No dsr check admits the nightly cadence and no profile run requires it, so nothing executes it at all. Either give it a profile or give it cadence "every-run".',
    ).toEqual([]);
  });

  test("the browser gate specifically, by name, because it is the one that was unwired", () => {
    // Named as well as counted. A change that narrowed the --family filter would otherwise only
    // shrink a list, and the failure would not say which capability had gone quiet.
    const browser = required.find((gate) => gate.family === "browser");
    expect(browser, "no requiredInCi gate in the browser family").toBeDefined();
    const runsBrowserFamily = steps.some(
      (s) => s.line.includes("quality-gates.ts") && /--family\s+(browser|all)/.test(s.line),
    );
    expect(
      runsBrowserFamily,
      "no dsr check runs the browser gate family. The nine live-class runtime-conformance assertions would then be carried only by live.test.ts in the node lane, which is the accidental route this decision replaced.",
    ).toBe(true);
  });
});
