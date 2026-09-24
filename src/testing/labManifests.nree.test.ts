import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateExperiment } from "../content/schemas/experiment.ts";
import { strictParse } from "../content/schemas/strictParse.ts";
import { DEFAULT_BM02_INPUTS } from "../experiments/bm02/session.ts";
import { DEFAULT_LQ02_INPUTS } from "../experiments/lq02/session.ts";
import { SR05_DEFAULTS, SR05_NOT_MODELED } from "../experiments/sr05/definition.ts";

/*
 * The three manifests written for am-lab-manifests-embeds-questions-missing-nree (LQ-02, BM-02,
 * SR-05) describe the laboratories as they run, not as a plan hopes. Each one validates; every
 * owner function it names is a real export; each parameter's default is the lab's own default
 * input. A manifest drifting from its lab fails here, not in a reader's page.
 */
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const manifest = (id: string) =>
  validateExperiment(
    strictParse(readFileSync(join(ROOT, "content", "experiments", `${id}.yaml`), "utf8"), "yaml"),
    id,
  );

const DEFAULTS: Record<string, Record<string, number>> = {
  "lq-02": {
    T: DEFAULT_LQ02_INPUTS.T,
    nuCutoff: DEFAULT_LQ02_INPUTS.nuCutoff,
    probeFrequency: DEFAULT_LQ02_INPUTS.probeFrequency,
  },
  "bm-02": {
    Np: DEFAULT_BM02_INPUTS.Np,
    V_um3: DEFAULT_BM02_INPUTS.V_um3,
    T: DEFAULT_BM02_INPUTS.T,
    a_um: DEFAULT_BM02_INPUTS.a_um,
    A_um2: DEFAULT_BM02_INPUTS.A_um2,
  },
  "sr-05": {
    speed: SR05_DEFAULTS.speed,
    coordinateDuration: SR05_DEFAULTS.coordinateDuration,
    lightClockArm: SR05_DEFAULTS.lightClockArm,
    frameOfDescription: SR05_DEFAULTS.frameOfDescription,
  },
};

describe("the LQ-02, BM-02 and SR-05 manifests describe the labs as they run", () => {
  for (const id of Object.keys(DEFAULTS)) {
    test(`${id}: validates, and every parameter default is the lab's own`, () => {
      const m = manifest(id);
      expect(m.id).toBe(id);
      expect(m.notModeled.length).toBeGreaterThan(0);
      expect(m.actions.length).toBeGreaterThan(0);
      const defaults = Object.fromEntries(m.parameters.map((p) => [p.id, p.default]));
      expect(defaults).toEqual(DEFAULTS[id] as Record<string, number>);
    });

    test(`${id}: every owner function it names is a real export of its module`, async () => {
      const functions = manifest(id).owner.kernelFunctions ?? [];
      expect(functions.length).toBeGreaterThan(0);
      for (const fn of functions) {
        const mod = (await import(join(ROOT, fn.module as string))) as Record<string, unknown>;
        expect({
          fn: `${fn.module}#${fn.exportName}`,
          type: typeof mod[fn.exportName as string],
        }).toEqual({
          fn: `${fn.module}#${fn.exportName}`,
          type: "function",
        });
      }
    });
  }

  test("sr-05: the manifest's not-modelled list is the lab's own", () => {
    expect([...manifest("sr-05").notModeled]).toEqual([...SR05_NOT_MODELED]);
  });
});
