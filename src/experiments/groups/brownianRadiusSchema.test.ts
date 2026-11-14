import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parseContentYaml } from "../../content/compiler/loaders.ts";
import { getQuantityRegistry } from "../../content/quantities/registry.ts";
import { validateExperiment } from "../../content/schemas/experiment.ts";
import { loadBrownianRadiusGroup } from "./loadBrownianRadius.ts";
import {
  compileExperimentGroup,
  ExperimentGroupDefinitionError,
  insideGroupDomain as insideLinkedDomain,
} from "./schema.ts";

const raw = parseContentYaml(
  readFileSync("content/experiments/groups/brownian-radius.yaml", "utf8"),
) as Record<string, unknown>;
const manifests = ["bm-01", "bm-06"].map((id) =>
  validateExperiment(parseContentYaml(readFileSync("content/experiments/" + id + ".yaml", "utf8"))),
);
const ids = new Set(getQuantityRegistry().ids);
function validateLinkedGroup(
  input: unknown,
  experiments: typeof manifests,
  quantities: ReadonlySet<string>,
) {
  return compileExperimentGroup(
    input,
    new Map(experiments.map((experiment) => [experiment.id, experiment])),
    quantities,
  );
}
function changed(parameter: Record<string, unknown>) {
  return manifests.map((manifest) => ({
    ...manifest,
    parameters: manifest.parameters.map((entry) =>
      manifest.id === "bm-06" && entry.id === "a" ? { ...entry, ...parameter } : entry,
    ),
  }));
}

describe("the authored Brownian radius group", () => {
  test("invalid-experiment-group preserves its code for a mismatched quantity and empty domain (schema.ts:46)", () => {
    expect(validateLinkedGroup(raw, manifests, ids).quantityId).toBe("particleRadius");
    for (const invalid of [
      changed({ quantityId: "frameSpeed" }),
      changed({ modelDomain: { min: 6e-6, max: 8e-6 } }),
    ]) {
      let caught: unknown;
      try {
        validateLinkedGroup(raw, invalid, ids);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(ExperimentGroupDefinitionError);
      expect((caught as ExperimentGroupDefinitionError).code).toBe("invalid-experiment-group");
    }
  });

  test("resolves both canonical parameter contracts and their actual domain intersection", () => {
    const group = loadBrownianRadiusGroup();
    expect(group.quantityId).toBe("particleRadius");
    expect(group.commandClass).toBe("setup-change");
    expect(group.defaultEnabled).toBe(false);
    expect(group.members.map((member) => member.instrumentId)).toEqual(["bm-01", "bm-06"]);
    expect(group.domain).toEqual({ min: 1e-7, max: 5e-6, minInclusive: true, maxInclusive: true });
    expect(insideLinkedDomain(group.domain, 1e-7)).toBe(true);
    expect(insideLinkedDomain(group.domain, 5e-6)).toBe(true);
    expect(insideLinkedDomain(group.domain, 9e-8)).toBe(false);
    expect(insideLinkedDomain(group.domain, Number.NaN)).toBe(false);
  });

  test("same symbol and units cannot link a different physical quantity", () => {
    expect(() =>
      validateLinkedGroup(raw, changed({ quantityId: "observationInterval" }), ids),
    ).toThrow("bm-06/a binds observationInterval, while the group binds particleRadius");
    expect(() =>
      validateLinkedGroup({ ...raw, quantityId: "ParticleRadius" }, manifests, ids),
    ).toThrow("Unknown canonical quantity ParticleRadius");
  });

  test("an observer command or a derived value cannot become a setup input", () => {
    expect(() =>
      validateLinkedGroup(raw, changed({ commandClass: "observer-change" }), ids),
    ).toThrow("declares observer-change, while the group declares setup-change");
    expect(() => validateLinkedGroup(raw, changed({ role: "derived" }), ids)).toThrow(
      "derived and cannot be linked",
    );
  });

  test("rejects disjoint domains and respects exclusive boundaries", () => {
    expect(() =>
      validateLinkedGroup(raw, changed({ modelDomain: { min: 6e-6, max: 8e-6 } }), ids),
    ).toThrow("no common admissible value");
    const open = validateLinkedGroup(
      raw,
      changed({ modelDomain: { min: 1e-7, max: 5e-6, minInclusive: false } }),
      ids,
    );
    expect(insideLinkedDomain(open.domain, 1e-7)).toBe(false);
    expect(insideLinkedDomain(open.domain, 2e-7)).toBe(true);
  });

  test("does not silently accept an unimplemented policy, mode or unit conversion", () => {
    for (const patch of [
      { commitPolicy: "progressive" },
      { direction: "leads" },
      { conversion: "multiply-by-one-million" },
      { defaultEnabled: true },
      {
        members: [
          { instrumentId: "bm-01", parameterId: "a", mode: "other" },
          { instrumentId: "bm-06", parameterId: "a" },
        ],
      },
      {
        members: [
          { instrumentId: "bm-01", parameterId: "a" },
          { instrumentId: "bm-01", parameterId: "a" },
        ],
      },
    ])
      expect(() => validateLinkedGroup({ ...raw, ...patch }, manifests, ids)).toThrow();
  });
});
