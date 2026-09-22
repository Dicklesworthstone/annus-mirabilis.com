import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { QUALITY_GATE_STEPS } from "../../scripts/quality-gates/registry.ts";

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
const DSR_CHECKS = ["typecheck", "test", "test:node", "gates"] as const;

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
