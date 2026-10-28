/**
 * THE PROOF FOR `quantityBindings`, IN TWO HALVES THAT WATCH DIFFERENT THINGS.
 *
 * The SYNTHETIC half drives every class and both directions of the baseline comparison with
 * manifests and a resolution built here, and it is what establishes that the gate can fail at all.
 * It replants the historical cases from the corpus rather than inventing shapes: lq-01's
 * `screenIntensity` carrying `coordinate-intensity`, which is hyphenated and so can never be a
 * quantity id; lq-07's four energy outputs all carrying the kind word `energy`; and bm-01's
 * parameter `M` carrying `ensembleSize`, which is its own output's self-name. Those survive the tree
 * being repaired, which is the point of planting them here (AGENTS.md: a gate's own test must not
 * live only in the lane that gate controls, and this half needs neither the registry nor the corpus).
 *
 * The LIVE half reads all 33 manifests from disk with the real validator and the real registry and
 * asserts that the set of unresolved bindings is EXACTLY the recorded one. It is the half that
 * notices a new unregistered binding, and the half that would go vacuous if the glob ever matched
 * nothing, so it also asserts floors on what it examined. A sweep that cannot fail and a sweep with
 * nothing to find look identical.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { getQuantityRegistry } from "../quantities/registry.ts";
import { getLegacySpellings } from "../quantities/resolveQuantityId.ts";
import { validateExperiment } from "../schemas/experiment.ts";
import { strictParse } from "../schemas/strictParse.ts";
import {
  type BoundManifest,
  checkQuantityBindings,
  compareToBaseline,
  type QuantityResolution,
  summarizeQuantityBindings,
} from "./quantityBindings.ts";
import baseline from "./quantityBindingsBaseline.json" with { type: "json" };

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "../../..");
const DIR = join(ROOT, "content/experiments");

function liveManifests(): BoundManifest[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".yaml"))
    .sort()
    .map((f) => validateExperiment(strictParse(readFileSync(join(DIR, f), "utf8"), "yaml")))
    .map((exp) => exp as unknown as BoundManifest);
}

/** The real resolution: the registry's own membership, its representation fields, its legacy table. */
function liveResolution(): QuantityResolution {
  const registry = getQuantityRegistry();
  const owning = new Map<string, string>();
  for (const [id, quantity] of registry.quantities)
    for (const field of quantity.representationFields ?? []) owning.set(field, id);
  const legacy = getLegacySpellings();
  return {
    registered: (id) => registry.quantities.has(id),
    representationField: (id) => owning.get(id),
    legacySpelling: (id) => legacy.get(id)?.canonicalIds,
  };
}

/** A resolution with nothing registered, so the synthetic half decides every class itself. */
function fakeResolution(
  over: Partial<{
    registered: readonly string[];
    representation: Readonly<Record<string, string>>;
    legacy: Readonly<Record<string, readonly string[]>>;
  }> = {},
): QuantityResolution {
  const registered = new Set(over.registered ?? []);
  const representation = over.representation ?? {};
  const legacy = over.legacy ?? {};
  return {
    registered: (id) => registered.has(id),
    representationField: (id) => representation[id],
    legacySpelling: (id) => legacy[id],
  };
}

describe("quantityBindings: synthetic, which is what proves the gate can fail", () => {
  test("the hyphenated case: lq-01's screenIntensity carries coordinate-intensity, which no id can be", () => {
    // The contract's semanticKind copied into the field. Ids are lower camel case, so this one could
    // not become valid by any future authoring -- it is a kind word standing where an identity goes.
    const report = checkQuantityBindings(
      [{ id: "lq-01", outputs: [{ id: "screenIntensity", quantityId: "coordinate-intensity" }] }],
      fakeResolution(),
    );
    expect(report.unresolved.length).toBe(1);
    expect(report.unresolved[0]?.bindingClass).toBe("unbound");
    expect(report.unresolved[0]?.key).toBe("lq-01:outputs:screenIntensity");
  });

  test("a kind word shared by four outputs is unbound four times, not once", () => {
    // lq-07's e1Ev, e2Ev, energyDeficitEv and eOtherEv all carry `energy`. A report keyed by the
    // quantityId would collapse these to one finding and understate it by three.
    const report = checkQuantityBindings(
      [
        {
          id: "lq-07",
          outputs: [
            { id: "e1Ev", quantityId: "energy" },
            { id: "e2Ev", quantityId: "energy" },
            { id: "energyDeficitEv", quantityId: "energy" },
            { id: "eOtherEv", quantityId: "energy" },
          ],
        },
      ],
      fakeResolution(),
    );
    expect(report.unresolved.length).toBe(4);
    expect(report.unresolved.every((b) => b.bindingClass === "unbound")).toBe(true);
    expect(new Set(report.unresolved.map((b) => b.key)).size).toBe(4);
  });

  test("a self-named entry asserts no reference, and is not reported as unbound", () => {
    const report = checkQuantityBindings(
      [{ id: "bm-05", outputs: [{ id: "walkPositions", quantityId: "walkPositions" }] }],
      fakeResolution(),
    );
    expect(report.unresolved[0]?.bindingClass).toBe("self-named");
  });

  test("a REGISTERED id wins over self-naming, so a real binding is never demoted", () => {
    // bm-05's diffusionCoefficient output carries the registered `diffusionCoefficient`. If
    // self-naming were tested first, 418 real bindings would be reclassified as local names.
    const report = checkQuantityBindings(
      [
        {
          id: "bm-05",
          outputs: [{ id: "diffusionCoefficient", quantityId: "diffusionCoefficient" }],
        },
      ],
      fakeResolution({ registered: ["diffusionCoefficient"] }),
    );
    expect(report.unresolved.length).toBe(0);
    expect(report.bindings[0]?.bindingClass).toBe("registered");
  });

  test("bm-01's parameter M names its own output's self-name, which is a local reference", () => {
    const report = checkQuantityBindings(
      [
        {
          id: "bm-01",
          outputs: [{ id: "ensembleSize", quantityId: "ensembleSize" }],
          parameters: [{ id: "M", quantityId: "ensembleSize" }],
        },
      ],
      fakeResolution(),
    );
    const byKey = new Map(report.unresolved.map((b) => [b.key, b.bindingClass]));
    expect(byKey.get("bm-01:parameters:M")).toBe("local-reference");
    expect(byKey.get("bm-01:outputs:ensembleSize")).toBe("self-named");
  });

  test("a local reference only crosses entries of the SAME manifest", () => {
    // The same name self-named in another laboratory is not a reference this manifest can make.
    const report = checkQuantityBindings(
      [
        { id: "bm-01", outputs: [{ id: "ensembleSize", quantityId: "ensembleSize" }] },
        { id: "bm-05", parameters: [{ id: "walkers", quantityId: "ensembleSize" }] },
      ],
      fakeResolution(),
    );
    const byKey = new Map(report.unresolved.map((b) => [b.key, b.bindingClass]));
    expect(byKey.get("bm-05:parameters:walkers")).toBe("unbound");
  });

  test("a representation field is declared data, never a typo", () => {
    const report = checkQuantityBindings(
      [{ id: "lq-03", outputs: [{ id: "logDensity", quantityId: "logFrequencyEnergyDensity" }] }],
      fakeResolution({
        representation: { logFrequencyEnergyDensity: "frequencyEnergyDensity" },
      }),
    );
    expect(report.unresolved[0]?.bindingClass).toBe("representation-field");
    expect(report.unresolved[0]?.canonical).toEqual(["frequencyEnergyDensity"]);
  });

  test("a recorded legacy spelling carries the canonical ids it resolves toward", () => {
    const report = checkQuantityBindings(
      [{ id: "sr-01", parameters: [{ id: "v", quantityId: "observerSpeed" }] }],
      fakeResolution({ legacy: { observerSpeed: ["frameSpeed"] } }),
    );
    expect(report.unresolved[0]?.bindingClass).toBe("legacy-spelling");
    expect(report.unresolved[0]?.canonical).toEqual(["frameSpeed"]);
  });

  test("an entry with no quantityId counts toward the denominator and contributes no binding", () => {
    // The schema already refuses a parameter with no quantityId, so treating one as unbound here
    // would report a schema refusal as a binding defect -- and the entry still has to be counted,
    // or the denominator would quietly shrink to whatever happened to carry the field.
    const report = checkQuantityBindings(
      [{ id: "bm-02", outputs: [{ id: "noField" }, { id: "blank", quantityId: "   " }] }],
      fakeResolution(),
    );
    expect(report.entries).toBe(2);
    expect(report.bindings.length).toBe(0);
    expect(report.unresolved.length).toBe(0);
  });

  test("a manifest with no outputs and no parameters contributes nothing, and the report says so", () => {
    const report = checkQuantityBindings([{ id: "bm-03" }], fakeResolution());
    expect(report.labs).toBe(1);
    expect(report.entries).toBe(0);
    expect(report.bindings.length).toBe(0);
  });

  test("the summary names its denominator, so a zero cannot read as a clean result", () => {
    const empty = checkQuantityBindings([], fakeResolution());
    expect(summarizeQuantityBindings(empty)).toContain("across 0 manifest(s)");
  });
});

describe("quantityBindings: the baseline comparison, in both directions", () => {
  const report = () =>
    checkQuantityBindings(
      [
        {
          id: "bm-01",
          outputs: [{ id: "ensembleSize", quantityId: "ensembleSize" }],
          parameters: [{ id: "seed", quantityId: "streamSeed" }],
        },
      ],
      fakeResolution(),
    );

  test("a NEW unresolved binding is added, which is the defect the gate exists for", () => {
    const { added, stale, reclassified } = compareToBaseline(report(), {
      "bm-01:outputs:ensembleSize": "self-named",
    });
    expect(added.map((b) => b.key)).toEqual(["bm-01:parameters:seed"]);
    expect(stale).toEqual([]);
    expect(reclassified).toEqual([]);
  });

  test("a recorded binding that no longer appears is STALE, so a paid debt cannot sit in the record", () => {
    const { added, stale } = compareToBaseline(report(), {
      "bm-01:outputs:ensembleSize": "self-named",
      "bm-01:parameters:seed": "unbound",
      "bm-01:parameters:gone": "unbound",
    });
    expect(added).toEqual([]);
    expect(stale).toEqual(["bm-01:parameters:gone"]);
  });

  test("a binding that changed class is reported rather than accepted on its key alone", () => {
    // The shape that would otherwise pass silently: an unbound parameter edited into a self-name
    // keeps its key and stops asserting a reference, which is a change of meaning, not a repair.
    const { added, stale, reclassified } = compareToBaseline(report(), {
      "bm-01:outputs:ensembleSize": "unbound",
      "bm-01:parameters:seed": "unbound",
    });
    expect(added).toEqual([]);
    expect(stale).toEqual([]);
    expect(reclassified).toEqual([
      { key: "bm-01:outputs:ensembleSize", was: "unbound", now: "self-named" },
    ]);
  });

  test("an exactly matching baseline reports nothing in any direction", () => {
    const { added, stale, reclassified } = compareToBaseline(report(), {
      "bm-01:outputs:ensembleSize": "self-named",
      "bm-01:parameters:seed": "unbound",
    });
    expect(added).toEqual([]);
    expect(stale).toEqual([]);
    expect(reclassified).toEqual([]);
  });
});

describe("quantityBindings: the live corpus against the recorded debt", () => {
  const report = checkQuantityBindings(liveManifests(), liveResolution());

  test("the census, printed beside the verdict", () => {
    console.log(`[quantity bindings] ${summarizeQuantityBindings(report)}`);
    // Floors, not equalities: the corpus grows, and an equality here would go red on correct work.
    // Zero of any of them would mean the sweep examined nothing and the verdict below is vacuous.
    expect(report.labs).toBeGreaterThanOrEqual(33);
    expect(report.entries).toBeGreaterThanOrEqual(600);
    expect(report.bindings.filter((b) => b.bindingClass === "registered").length).toBeGreaterThan(
      400,
    );
  });

  test("every entry carries a quantityId, so the denominator is the whole population", () => {
    // Measured 2026-10-28: 638 of 638. If this ever stops holding, the census above is counting a
    // smaller population than it names and the floors would not notice.
    expect(report.bindings.length).toBe(report.entries);
  });

  test("the unresolved set is EXACTLY the recorded one", () => {
    const { added, stale, reclassified } = compareToBaseline(report, baseline);
    expect({
      added: added.map((b) => `${b.key} (${b.bindingClass}, names ${b.quantityId})`),
      stale,
      reclassified,
    }).toEqual({ added: [], stale: [], reclassified: [] });
  });

  test("PLANTED AGAINST THE REAL CORPUS: a new unregistered binding turns it red", () => {
    /*
     * The plant the bead asks for, on its own named historical case, executed against the real 33
     * manifests rather than a fixture -- and in memory rather than in `content/`. A tree edit would
     * be the stronger-looking plant and the weaker one: this checkout is shared, an unidentified
     * process has committed panes' unfinished work before (am-decision-stop-the-sweeper-6pan), and
     * a plant committed by a peer is a defect shipped under someone else's message. Mutating the
     * loaded manifest keeps the population real, keeps the proof permanent, and touches nothing.
     */
    const manifests = liveManifests();
    const bm05 = manifests.find((m) => m.id === "bm-05");
    const walk = bm05?.outputs?.find((o) => o.id === "walkPositions");
    // The control for the plant itself: if the case ever moves, this says so instead of planting
    // nothing and reading the green as a pass.
    expect(walk?.quantityId).toBe("walkPositions");

    const planted = manifests.map((m) =>
      m.id !== "bm-05"
        ? m
        : {
            ...m,
            outputs: [
              ...(m.outputs ?? []).map((o) =>
                o.id === "walkPositions" ? { ...o, quantityId: "walkPositionsMetres" } : o,
              ),
              { id: "plantedOutput", quantityId: "noSuchQuantityAnywhere" },
            ],
          },
    );
    const { added, reclassified } = compareToBaseline(
      checkQuantityBindings(planted, liveResolution()),
      baseline,
    );
    expect(added.map((b) => b.key)).toEqual(["bm-05:outputs:plantedOutput"]);
    expect(added[0]?.bindingClass).toBe("unbound");
    // The rename stops being a self-name and starts asserting a reference to nothing, which is a
    // change of meaning under an unchanged key -- the shape a count-only baseline would miss.
    expect(reclassified).toEqual([
      { key: "bm-05:outputs:walkPositions", was: "self-named", now: "unbound" },
    ]);
  });

  test("PLANTED THE OTHER WAY: binding one of the 84 to a registered quantity reports only a paid debt", () => {
    // lq-07's `dissipatedHeatWatts` carries the kind word `power`. Bound to a registered id instead,
    // it leaves the unresolved set entirely: no `added`, no `reclassified`, and its record becomes
    // stale -- which is the ratchet doing its job, not a false positive. A gate that stayed silent
    // here would let the baseline outlive the debt, and "a baseline that only ever rises is a budget".
    const registered = [...getQuantityRegistry().quantities.keys()];
    const anyRegistered = registered.find((id) => id.length > 0);
    expect(typeof anyRegistered).toBe("string");
    const manifests = liveManifests().map((m) =>
      m.id !== "lq-07"
        ? m
        : {
            ...m,
            outputs: (m.outputs ?? []).map((o) =>
              o.id === "dissipatedHeatWatts" ? { ...o, quantityId: anyRegistered } : o,
            ),
          },
    );
    const { added, stale, reclassified } = compareToBaseline(
      checkQuantityBindings(manifests, liveResolution()),
      baseline,
    );
    expect(added).toEqual([]);
    expect(reclassified).toEqual([]);
    expect(stale).toEqual(["lq-07:outputs:dissipatedHeatWatts"]);
  });

  test("the recorded debt is not vacuous, and its shape is what the finding says", () => {
    // Explicit non-vacuity: a baseline that had emptied would make the comparison above pass while
    // proving nothing, and the classes are asserted as PROPERTIES of the record rather than as a
    // census, so authoring that moves one does not turn this red for the wrong reason.
    const counts = Object.values(baseline as Readonly<Record<string, string>>);
    expect(counts.length).toBeGreaterThan(0);
    expect(counts.filter((c) => c === "unbound").length).toBeGreaterThan(0);
    expect(counts.filter((c) => c === "self-named").length).toBeGreaterThan(0);
    // Every recorded class is one the classifier can produce, so a typo in the record cannot sit
    // there as a permanently unmatchable key.
    const known = new Set([
      "self-named",
      "unbound",
      "local-reference",
      "representation-field",
      "legacy-spelling",
    ]);
    expect([...new Set(counts)].filter((c) => !known.has(c))).toEqual([]);
  });
});
