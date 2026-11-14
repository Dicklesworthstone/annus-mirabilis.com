import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parseContentYaml } from "../../content/compiler/loaders.ts";
import { loadQuantityRegistry } from "../../content/quantities/registry.ts";
import { type Experiment, validateExperiment } from "../../content/schemas/experiment.ts";
import { convertValue } from "../../units/adapters.ts";
import { loadRelativityObserverGroup } from "./load.ts";
import {
  compileExperimentGroup,
  ExperimentGroupDefinitionError,
  insideGroupDomain,
} from "./schema.ts";

const file = "content/experiments/groups/relativity-observer.yaml";
const authored = parseContentYaml(readFileSync(file, "utf8"), file) as Record<string, unknown>;
const registry = loadQuantityRegistry();
const quantities = new Set(registry.ids);
const manifests = new Map(
  ["sr-09", "sr-10"].map((id) => {
    const path = `content/experiments/${id}.yaml`;
    return [
      id,
      validateExperiment(parseContentYaml(readFileSync(path, "utf8"), path), path),
    ] as const;
  }),
);

function changedParameter(patch: Record<string, unknown>): Map<string, Experiment> {
  const changed = structuredClone(manifests);
  const manifest = changed.get("sr-10") as Experiment;
  changed.set("sr-10", {
    ...manifest,
    parameters: manifest.parameters.map((parameter) =>
      parameter.id === "beta" ? ({ ...parameter, ...patch } as typeof parameter) : parameter,
    ),
  });
  return changed;
}

describe("authored observer group admission", () => {
  test("binds the actual manifest parameter identity and class; transports speed in SI", () => {
    const group = loadRelativityObserverGroup();
    expect(group.defaultEnabled).toBe(false);
    expect(group.quantityId).toBe("frameSpeed");
    expect(group.canonicalUnit).toBe("m/s");
    expect(group.commandClass).toBe("observer-change");
    expect(group.commitPolicy).toBe("coherent");
    expect(
      group.members.map((member) => [member.instrumentId, member.parameterId, member.displayUnit]),
    ).toEqual([
      ["sr-09", "beta", "c"],
      ["sr-10", "beta", "c"],
    ]);
    expect(registry.quantities.get(group.quantityId)?.dimension).toEqual(
      [1, 0, -1, 0, 0, 0].map((num) => ({ num, den: 1 })),
    );
    expect(group.domain.min).toBe(convertValue(-0.95, "c", "m/s"));
    expect(group.domain.max).toBe(convertValue(0.95, "c", "m/s"));
    expect(insideGroupDomain(group.domain, convertValue(-0.95, "c", "m/s"))).toBe(true);
    expect(insideGroupDomain(group.domain, convertValue(0.951, "c", "m/s"))).toBe(false);
  });

  test("invalid-experiment-group refuses a shared glyph or display unit without canonical identity", () => {
    expect(() =>
      compileExperimentGroup(
        authored,
        changedParameter({ quantityId: "lorentzFactor" }),
        quantities,
      ),
    ).toThrow(ExperimentGroupDefinitionError);
    expect(() =>
      compileExperimentGroup(
        authored,
        changedParameter({ commandClass: "setup-change" }),
        quantities,
      ),
    ).toThrow(/declares setup-change/);
    expect(() =>
      compileExperimentGroup(authored, changedParameter({ role: "derived" }), quantities),
    ).toThrow(/derived/);
    expect(() =>
      compileExperimentGroup(authored, changedParameter({ displayUnit: "Hz" }), quantities),
    ).toThrow(/cannot convert/);
  });

  test("invalid-experiment-group refuses unknown members, unknown quantities and implicit linking", () => {
    for (const patch of [
      { schemaVersion: 2 },
      { groupId: "" },
      { quantityId: "observerSpeed" },
      { canonicalUnit: "c" },
      { defaultEnabled: true },
      { commitPolicy: "progressive" },
      { direction: "read-only" },
      { undeclaredControl: "beta" },
      { members: [{ instrumentId: "sr-09", parameterId: "beta" }] },
      {
        members: [
          { instrumentId: "sr-09", parameterId: "beta" },
          { instrumentId: "sr-09", parameterId: "beta" },
        ],
      },
      {
        members: [
          { instrumentId: "sr-09", parameterId: "beta" },
          { instrumentId: "sr-10", parameterId: "observerSpeed" },
        ],
      },
    ])
      expect(() =>
        compileExperimentGroup({ ...authored, ...patch }, manifests, quantities),
      ).toThrow(ExperimentGroupDefinitionError);
    expect(() => compileExperimentGroup(null, manifests, quantities)).toThrow(
      ExperimentGroupDefinitionError,
    );
  });

  test("intersects every model and numerical range, including an open endpoint", () => {
    const group = compileExperimentGroup(
      authored,
      changedParameter({
        numericalDomain: { min: -0.4, max: 0.7, maxInclusive: false },
      }),
      quantities,
    );
    expect(group.domain.min).toBe(convertValue(-0.4, "c", "m/s"));
    expect(group.domain.max).toBe(convertValue(0.7, "c", "m/s"));
    expect(insideGroupDomain(group.domain, group.domain.max)).toBe(false);
    expect(insideGroupDomain(group.domain, group.domain.min)).toBe(true);
    expect(insideGroupDomain(group.domain, Number.NaN)).toBe(false);
  });

  test("invalid-experiment-group refuses an empty intersection or a noncontinuous domain", () => {
    expect(() =>
      compileExperimentGroup(
        authored,
        changedParameter({ modelDomain: { min: 0.96, max: 0.99 } }),
        quantities,
      ),
    ).toThrow(/no common admissible value/);
    expect(() =>
      compileExperimentGroup(
        authored,
        changedParameter({ modelDomain: { enumerated: [0, 0.6] } }),
        quantities,
      ),
    ).toThrow(/bounded continuous numeric domain/);
  });
});
