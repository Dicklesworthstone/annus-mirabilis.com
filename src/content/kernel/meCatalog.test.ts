/**
 * Mass-energy's show-the-code catalog entries are the manifests' kernel functions and bindings
 * (dispatch 173). The catalog is typed by hand, beside the manifests, so this test holds the two
 * equal and holds every binding to an identifier its kernel really contains.
 *
 * The negative is historical. Until 2026-09-25 the ME-01 and ME-03 manifests bound eight
 * identifiers their kernels do not contain (emissionAngle, lightComplexEnergyMoving,
 * kineticEnergyDifference, additiveEnergyConstant, speedOfLight in evaluateSubtraction; p, v,
 * DeltaX in evaluatePhotonBox). No check caught it, because verify-content reads only the BM
 * manifests. The last case feeds three of those old bindings to the real checker.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYaml } from "../provenance/yaml.ts";
import { checkIdentifierBindings } from "./bindings.ts";
import { SLICE_KERNEL_CATALOG } from "./catalog.ts";
import { extractTypeScriptExport } from "./extractTypeScript.ts";

const root = process.cwd();
type Owner = {
  kernelFunctions: { module: string; exportName: string }[];
  identifierBindings: { kernelFunction: string; identifier: string; quantityId: string }[];
};
const ownerOf = (id: string) =>
  (
    parseYaml(readFileSync(join(root, "content", "experiments", `${id}.yaml`), "utf8")) as {
      owner: Owner;
    }
  ).owner;
const key = (b: { kernelFunction: string; identifier: string; quantityId: string }) =>
  `${b.kernelFunction}|${b.identifier}|${b.quantityId}`;

for (const id of ["me-01", "me-02", "me-03"])
  describe(`${id}: the catalog is the manifest's kernel`, () => {
    const entries = SLICE_KERNEL_CATALOG.filter((e) => e.instrumentId === id);
    const owner = ownerOf(id);

    test("the same kernel functions, and at least one", () => {
      expect(entries.length).toBeGreaterThan(0);
      expect(entries.map((e) => `${e.kernel.module}#${e.kernel.exportName}`).sort()).toEqual(
        owner.kernelFunctions.map((k) => `${k.module}#${k.exportName}`).sort(),
      );
    });

    test("the same identifier bindings", () => {
      expect(entries.flatMap((e) => e.identifierBindings.map(key)).sort()).toEqual(
        owner.identifierBindings.map(key).sort(),
      );
    });

    test("every bound identifier is a token of its kernel's real source", () => {
      const missing: string[] = [];
      for (const entry of entries) {
        const source = extractTypeScriptExport({
          root,
          modulePath: entry.kernel.module as string,
          exportName: entry.kernel.exportName as string,
          revision: "test",
        });
        for (const b of entry.identifierBindings)
          if (!source.identifiers.includes(b.identifier)) missing.push(key(b));
      }
      expect(missing).toEqual([]);
    });

    test("every live term is bound, and every function is put in words", () => {
      for (const entry of entries) {
        const bound = new Set(entry.identifierBindings.map((b) => b.quantityId));
        expect(entry.liveTerms.filter((q) => !bound.has(q))).toEqual([]);
        expect(entry.words.r1.trim().length).toBeGreaterThan(40);
        expect(entry.words.r1).not.toContain("—");
      }
    });
  });

test("the binding checker refuses the identifiers the ME-03 manifest used to name", () => {
  const extracted = new Map([
    [
      "evaluatePhotonBox",
      extractTypeScriptExport({
        root,
        modulePath: "src/physics/reference/massEnergy.ts",
        exportName: "evaluatePhotonBox",
        revision: "test",
      }),
    ],
  ]);
  const issues = checkIdentifierBindings({
    instrumentId: "me-03",
    kernels: [
      {
        displayRole: "reference-implementation",
        language: "ts",
        module: "src/physics/reference/massEnergy.ts",
        exportName: "evaluatePhotonBox",
      },
    ],
    bindings: [
      { kernelFunction: "evaluatePhotonBox", identifier: "p", quantityId: "pulseMomentum" },
      { kernelFunction: "evaluatePhotonBox", identifier: "v", quantityId: "recoilSpeed" },
      {
        kernelFunction: "evaluatePhotonBox",
        identifier: "DeltaX",
        quantityId: "centerOfMassShift",
      },
    ],
    extracted,
  });
  expect(issues.map((i) => i.quantityId).sort()).toEqual(
    ["centerOfMassShift", "pulseMomentum", "recoilSpeed"].sort(),
  );
});
