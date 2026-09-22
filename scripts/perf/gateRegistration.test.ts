import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type GateStep, QUALITY_GATE_STEPS } from "../quality-gates/registry.ts";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "../..");

export function validateStepRegistration(
  step: GateStep,
  expected: {
    id: string;
    family: string;
    cadence: string;
    owner: string;
  },
): void {
  if (step.id !== expected.id) {
    throw new Error(`Expected step id '${expected.id}', but got '${step.id}'`);
  }
  if (step.family !== expected.family) {
    throw new Error(`Step '${step.id}' has family '${step.family}', expected '${expected.family}'`);
  }
  if (step.cadence !== expected.cadence) {
    throw new Error(
      `Step '${step.id}' has cadence '${step.cadence}', expected '${expected.cadence}'`,
    );
  }
  if (step.owner !== expected.owner) {
    throw new Error(`Step '${step.id}' has owner '${step.owner}', expected '${expected.owner}'`);
  }
}

describe("Gate Registration Verification", () => {
  const stepsMap = new Map(QUALITY_GATE_STEPS.map((s) => [s.id, s]));

  test("registry contains perf-budgets (family perf, cadence nightly, owned by am-plat-perf-budgets-s3ww)", () => {
    const step = stepsMap.get("perf-budgets");
    expect(step).toBeDefined();
    if (!step) return;

    validateStepRegistration(step, {
      id: "perf-budgets",
      family: "perf",
      cadence: "nightly",
      owner: "am-plat-perf-budgets-s3ww",
    });
    expect(step.command).toEqual(["bun", "scripts/run-perf-budgets.ts"]);
    expect(step.availability.scriptPath).toBe("scripts/run-perf-budgets.ts");
    expect(step.requiredInProfiles).toContain("preview");
    expect(step.requiredInProfiles).toContain("launch");
  });

  test("registry contains perf-budget-change (family fast, cadence every-run, owned by am-plat-perf-budgets-s3ww)", () => {
    const step = stepsMap.get("perf-budget-change");
    expect(step).toBeDefined();
    if (!step) return;

    validateStepRegistration(step, {
      id: "perf-budget-change",
      family: "fast",
      cadence: "every-run",
      owner: "am-plat-perf-budgets-s3ww",
    });
    expect(step.command).toEqual(["bun", "scripts/perf-budget-diff.ts"]);
    expect(step.availability.scriptPath).toBe("scripts/perf-budget-diff.ts");
    expect(step.requiredInCi).toBe(true);
    expect(step.requiredInProfiles).toContain("preview");
    expect(step.requiredInProfiles).toContain("launch");
  });

  test("fixture registration with different family, cadence, or id fails naming both values", () => {
    const fixtureStep: GateStep = {
      id: "wrong-id",
      title: "Wrong step",
      command: ["bun", "scripts/wrong.ts"],
      family: "browser",
      cadence: "every-run",
      requiredInCi: false,
      requiredInProfiles: [],
      availability: { scriptPath: "scripts/wrong.ts" },
      owner: "other-bead",
    };

    expect(() =>
      validateStepRegistration(fixtureStep, {
        id: "perf-budgets",
        family: "perf",
        cadence: "nightly",
        owner: "am-plat-perf-budgets-s3ww",
      }),
    ).toThrow("Expected step id 'perf-budgets', but got 'wrong-id'");

    const fixtureWithWrongFamily: GateStep = {
      ...fixtureStep,
      id: "perf-budgets",
    };
    expect(() =>
      validateStepRegistration(fixtureWithWrongFamily, {
        id: "perf-budgets",
        family: "perf",
        cadence: "nightly",
        owner: "am-plat-perf-budgets-s3ww",
      }),
    ).toThrow("Step 'perf-budgets' has family 'browser', expected 'perf'");
  });

  /**
   * REPOINTED 2026-09-22, am-7bkr. This read `.github/workflows/perf-budgets.yml` and asserted
   * that it passes --family perf, holds read-only permissions, and contains no deploy, alias,
   * cloudflare or dns token. Every assertion passed, and none of them constrained anything: the
   * owner's standing rule is verbatim "we don't use gh actions for CI *EVER*, we ONLY use /dsr",
   * and ~/.config/dsr/repos.yaml says the same in a comment on this repository, so that file
   * never executes. A safety control over a non-runner reads exactly like a safety control.
   *
   * The --family perf half is dropped rather than moved: the registry's own family is already
   * asserted directly, fifteen lines above, against QUALITY_GATE_STEPS rather than against a
   * YAML file's text. The permissions half has no counterpart outside GitHub Actions and is
   * dropped with it.
   *
   * The deploy half is the one worth keeping, so it is pointed at the surfaces that DO run: the
   * four package.json scripts dsr invokes, and every command in the gate registry. Measured when
   * this was written: 36 surfaces, 4 scripts plus 32 registry commands, no banned token in any.
   */
  test("no command the CI actually runs carries a deploy, alias, or DNS token", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    // Mirrored from ~/.config/dsr/repos.yaml, tools.annus-mirabilis.checks. Asserted present
    // below, so a drifted mirror fails here instead of narrowing the population in silence.
    const DSR_CHECKS = ["typecheck", "test", "test:node", "gates"] as const;

    const surfaces = [
      ...DSR_CHECKS.map((name) => ({
        where: `package.json scripts.${name}`,
        text: pkg.scripts?.[name] ?? "",
      })),
      ...QUALITY_GATE_STEPS.map((step) => ({
        where: `registry ${step.id}`,
        text: step.command.join(" "),
      })),
    ];

    // Non-vacuity, named rather than implied: a missing script or an emptied registry would make
    // every assertion below true over nothing.
    expect(surfaces.length).toBe(DSR_CHECKS.length + QUALITY_GATE_STEPS.length);
    expect(surfaces.every((s) => s.text.length > 0)).toBe(true);

    const banned = ["deploy", "alias", "cloudflare", "dns"];
    const hits = surfaces.flatMap((s) =>
      banned
        .filter((token) => s.text.toLowerCase().includes(token))
        .map((token) => `${s.where}: "${token}" in ${s.text}`),
    );
    expect(
      hits,
      "A command the CI runs names a deploy, alias or DNS operation. Releases go only through scripts/verified-production-deploy.ts behind a human authorization file; the gate chain never moves an alias or a DNS record.",
    ).toEqual([]);
  });
});
