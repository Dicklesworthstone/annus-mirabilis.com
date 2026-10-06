/**
 * DOES EVERY KERNEL BINDING NAME A QUANTITY THAT EXISTS? (am-f3e4, am-bzsk, 2026-10-06.)
 *
 * AGENTS.md lists among the content compiler's rejections "a live term that is not an exact canonical
 * quantity id". Nothing enforced it for SLICE_KERNEL_CATALOG. On 2026-10-06 nine bindings and five
 * liveTerms across three of its entries named ids that `content/quantities` does not define, and
 * verify-content, the kernel binding audit and a full 16,000-test lane all passed over them. They were
 * found by hand, by querying the registry while writing the entries, which is not a gate.
 *
 * WHY IT MATTERS MORE THAN A TYPO. A binding is what colours an identifier in show-the-code with its
 * equation term's colour. One pointing at an undefined quantity cannot resolve to a dimension, a unit
 * or a frame, so the reader is told that a symbol in the source means something the edition has no
 * record of. That is the failure the canonical-id rule exists to prevent, and it reads as working.
 *
 * THE NINE ARE NAMED BELOW RATHER THAN COUNTED, because they divide into two different problems and a
 * count would hide that. Seven are names the KERNELS use for their own outputs - the code calls a
 * quantity `stepMean` or `meanRadialDistance` and the registry defines neither - so the evaluators and
 * the quantity records have drifted, which is recorded on am-bzsk and is not this test's business to
 * repair. Two, `stepKernelChoice` and `limitingProcedureChoice`, were mine and were wrong in a
 * different way: a kernel choice and a limiting procedure are not physical quantities and have no
 * canonical id to bind to at all.
 *
 * The plant goes through the predicate with a synthetic entry rather than by editing the real
 * catalogue, so it cannot be swept into a peer's commit while it is red.
 */

import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { loadQuantityRegistry } from "../quantities/registry.ts";
import { SLICE_KERNEL_CATALOG } from "./catalog.ts";
import type { KernelCatalogEntry } from "./types.ts";

const ROOT = process.cwd();

/** Every binding's quantity and every liveTerm that the registry does not define, named. */
function unknownQuantities(
  catalogue: readonly KernelCatalogEntry[],
  known: ReadonlySet<string>,
): Readonly<{ bindings: string[]; liveTerms: string[]; bindingCount: number; liveCount: number }> {
  const bindings: string[] = [];
  const liveTerms: string[] = [];
  let bindingCount = 0;
  let liveCount = 0;
  for (const entry of catalogue) {
    for (const binding of entry.identifierBindings) {
      bindingCount += 1;
      if (!known.has(binding.quantityId))
        bindings.push(
          `${entry.instrumentId}/${binding.kernelFunction}: ${binding.identifier} -> ${binding.quantityId}`,
        );
    }
    for (const term of entry.liveTerms) {
      liveCount += 1;
      if (!known.has(term)) liveTerms.push(`${entry.instrumentId}: ${term}`);
    }
  }
  return { bindings, liveTerms, bindingCount, liveCount };
}

const registry = loadQuantityRegistry(resolve(ROOT, "content", "quantities"));
const known = new Set(registry.ids);
const report = unknownQuantities(SLICE_KERNEL_CATALOG, known);

describe("every kernel catalogue quantity id is one content/quantities defines", () => {
  test("the registry and the catalogue are both real populations, so nothing below is vacuous", () => {
    // THE GUARD THAT CAUGHT MY OWN FIRST MEASUREMENT. A probe for this read `registry.byId`, which
    // the type does not have, so it reported 0 ids and every quantity came back unknown. An empty
    // known-set makes the two assertions below fail loudly instead; an empty catalogue makes them
    // pass over nothing, which is what these floors are for.
    expect(known.size).toBeGreaterThan(250);
    expect(registry.files.length).toBeGreaterThan(0);
    expect(SLICE_KERNEL_CATALOG.length).toBeGreaterThan(100);
    expect(report.bindingCount).toBeGreaterThan(300);
    expect(report.liveCount).toBeGreaterThan(250);
    console.log(
      `[catalogue quantities] ${known.size} registry ids across ${registry.files.length} files; ` +
        `${SLICE_KERNEL_CATALOG.length} entries, ${report.bindingCount} bindings, ` +
        `${report.liveCount} liveTerms; ${report.bindings.length} bindings and ` +
        `${report.liveTerms.length} liveTerms name an id the registry does not define`,
    );
  });

  test("no binding names a quantity the registry does not define", () => {
    expect(report.bindings).toEqual([]);
  });

  test("no liveTerm names a quantity the registry does not define", () => {
    expect(report.liveTerms).toEqual([]);
  });

  test("the nine that were wrong on 2026-10-06 are still not registered, so this cannot pass by their arrival", () => {
    // If one of these is later added to content/quantities as a real record with a dimension and a
    // frame, this case fails and should be deleted along with its name: the gate above then covers it
    // properly. Until then it pins the historical fact, and it stops the two tests above from being
    // satisfied by someone defining a quantity merely to silence them.
    for (const id of [
      "stepMean",
      "stepVariance",
      "meanSquareDisplacement",
      "meanRadialDistance",
      "rmsRadialDistance",
      "mostLikelyRadius2d",
      "continuumDiffusionCoefficient",
      "stepKernelChoice",
      "limitingProcedureChoice",
    ])
      expect(known.has(id)).toBe(false);
    // And the counterpart, so the list above is not a list of typos: these ARE registered, and the
    // kernels that hold them are bound to them.
    for (const id of ["meanSquareDisplacement1d", "rmsDisplacement1d", "kolmogorovDistance"])
      expect(known.has(id)).toBe(true);
  });

  test("PLANTED: a synthetic entry naming an undefined quantity is reported, in both fields", () => {
    const planted: KernelCatalogEntry = {
      instrumentId: "zz-01",
      kernel: {
        displayRole: "reference-implementation",
        language: "ts",
        module: "src/physics/reference/does-not-matter.ts",
        exportName: "plantedKernel",
      },
      words: { r0: "x", r1: "x", r2: "x" },
      liveTerms: ["zzNoSuchQuantity"],
      identifierBindings: [
        { kernelFunction: "plantedKernel", identifier: "q", quantityId: "zzAlsoNoSuchQuantity" },
      ],
    };
    const found = unknownQuantities([planted], known);
    expect(found.bindings).toEqual(["zz-01/plantedKernel: q -> zzAlsoNoSuchQuantity"]);
    expect(found.liveTerms).toEqual(["zz-01: zzNoSuchQuantity"]);
    // THE CONTROL, in the same arm: an entry naming a REGISTERED quantity is reported by neither, so
    // the predicate is not simply flagging everything it is handed.
    const clean: KernelCatalogEntry = {
      ...planted,
      liveTerms: ["diffusionCoefficient"],
      identifierBindings: [
        { kernelFunction: "plantedKernel", identifier: "D", quantityId: "diffusionCoefficient" },
      ],
    };
    const ok = unknownQuantities([clean], known);
    expect(ok.bindings).toEqual([]);
    expect(ok.liveTerms).toEqual([]);
    expect(ok.bindingCount).toBe(1);
  });
});
