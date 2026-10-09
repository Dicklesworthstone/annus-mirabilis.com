/**
 * EVERY DECLARED OUTPUT JOINS ITS LABORATORY'S RUNTIME CONTRACT, OR IS DECLARED AS NOT JOINING.
 *
 * am-gpk5 reports thirteen manifest outputs the contract "does not emit" and asks for either a
 * rename across three laboratories or a hand-written join table. The measurement here says
 * neither is needed, and that the bead's own hardest question is already answered in the tree:
 *
 *   356 declared outputs across the 31 laboratories that expose a contract
 *   333 join because the manifest's output id IS a contract key
 *    19 join through `quantityId`, and 10 of those have the contract's `ownerId` naming the
 *       manifest's output id back, which is a second, independent field agreeing
 *     4 join by nothing, and the bead found none of them
 *
 * me-02's `limitingCoefficient` -- "NO UNAMBIGUOUS COUNTERPART ... needs me-02's author" -- is
 * `inertialMassDecrease`, with `ownerId: "massEnergy.limitingCoefficient"` and
 * `semanticKind: "limiting-mass-coefficient"`. Two fields say so.
 *
 * WHY THE BEAD MISSED FOUR AND FOUND A PHANTOM THAT ISN'T ONE: it walked the outputs a VIEW
 * cites. An output no view cites is invisible to that walk and still declared, which is how
 * sr-09's `detectorCrossings` -- matching nothing among twelve contract keys -- went unlisted
 * while me-02's well-documented output was written up as the mystery.
 *
 * THE GATE IS THE requiredUnitKinds PATTERN: an undeclared absence fails, and a declaration that
 * is no longer needed is reported rather than left to rot. Both directions are planted below
 * against synthetic manifests, because planting against the real corpus would mean editing a
 * laboratory's contract.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";
import {
  type CitedManifest,
  type ContractOutputs,
  outputContractJoins,
  UNJOINED_OUTPUTS,
} from "./viewCitations.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function manifests(): CitedManifest[] {
  const dir = join(ROOT, "content/experiments");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .sort()
    .map((f) => loadYaml(readFileSync(join(dir, f), "utf8")) as CitedManifest);
}

/**
 * Each laboratory's contract, discovered by convention rather than listed: `src/experiments/<dir>/
 * definition.ts` exporting one `*_OUTPUTS`. A list would go stale silently as laboratories land.
 */
async function contracts(): Promise<Record<string, ContractOutputs>> {
  const found: Record<string, ContractOutputs> = {};
  for (const dir of readdirSync(join(ROOT, "src/experiments")).sort()) {
    const path = join(ROOT, "src/experiments", dir, "definition.ts");
    if (!existsSync(path)) continue;
    const mod = (await import(path)) as Record<string, unknown>;
    const key = Object.keys(mod).find((k) => k.endsWith("_OUTPUTS"));
    if (key === undefined) continue;
    // `bm-01` is directory `bm01`: the manifest id with its hyphens removed.
    found[dir.replace(/^([a-z]+)(\d.*)$/, "$1-$2")] = mod[key] as ContractOutputs;
  }
  return found;
}

describe("manifest outputs join their laboratory's contract", () => {
  test("the population is real, and the join kinds are reported", async () => {
    const { joins, labsWithoutContract } = outputContractJoins(manifests(), await contracts());
    const of = (k: string) => joins.filter((j) => j.kind === k).length;
    console.log(
      `[census] output-contract-join examined ${joins.length} declared outputs across ` +
        `${new Set(joins.map((j) => j.lab)).size} laboratories (minimum 300 outputs); ` +
        `${of("id")} by id, ${of("quantityId-confirmed")} by quantityId with ownerId confirming, ` +
        `${of("quantityId-only")} by quantityId alone, ${of("unjoined")} by nothing`,
    );
    console.log(
      `[census] ${labsWithoutContract.length} manifest(s) expose no contract and are skipped: ` +
        `${labsWithoutContract.join(", ")}`,
    );
    expect(joins.length).toBeGreaterThanOrEqual(300);
    // Non-vacuity in the direction that matters: the quantityId route must actually be carrying
    // outputs, or this gate would pass on a corpus where every id happened to match.
    expect(of("quantityId-confirmed") + of("quantityId-only")).toBeGreaterThan(0);
  });

  test("EVERY unjoined output is declared, and every declaration is still unjoined", async () => {
    const { joins } = outputContractJoins(manifests(), await contracts());
    const unjoined = joins
      .filter((j) => j.kind === "unjoined")
      .map((j) => `${j.lab}/${j.outputId}`)
      .sort();
    const declared = Object.keys(UNJOINED_OUTPUTS).sort();

    // An undeclared absence fails, naming it.
    expect(unjoined.filter((u) => !declared.includes(u))).toEqual([]);
    // A stale declaration is reported: once an output joins, its entry must go.
    expect(declared.filter((d) => !unjoined.includes(d))).toEqual([]);
    // And each declaration says why, because "no counterpart" without a reason is the silence
    // this bead refuses.
    for (const [id, reason] of Object.entries(UNJOINED_OUTPUTS)) {
      expect(reason.length, id).toBeGreaterThan(80);
    }
  });

  test("me-02's limitingCoefficient joins, which the bead says needs its author", async () => {
    const { joins } = outputContractJoins(manifests(), await contracts());
    const it = joins.find((j) => j.lab === "me-02" && j.outputId === "limitingCoefficient");
    expect(it?.kind).toBe("quantityId-confirmed");
    expect(it?.contractKey).toBe("inertialMassDecrease");
  });
});

describe("THE PLANT: the join is decided by the data, in both directions", () => {
  const contract: ContractOutputs = {
    realKey: { ownerId: "lab.declaredId" },
    otherKey: { ownerId: "lab.somethingElse" },
  };

  test("an output joining by nothing is unjoined, and one joining by quantityId is not", () => {
    const planted: CitedManifest[] = [
      {
        id: "fx-01",
        outputs: [
          { id: "declaredId", quantityId: "realKey" },
          { id: "otherId", quantityId: "otherKey" },
          { id: "realKey" },
          { id: "phantom", quantityId: "namesNothing" },
          { id: "noQuantityId" },
        ],
      },
    ];
    const { joins } = outputContractJoins(planted, { "fx-01": contract });
    const byId = Object.fromEntries(joins.map((j) => [j.outputId, j.kind]));
    // ownerId "lab.declaredId" names the manifest id back, so this is the strongest kind.
    expect(byId.declaredId).toBe("quantityId-confirmed");
    // Joins by quantityId, but the ownerId names someone else: real, weaker, and reported as such.
    expect(byId.otherId).toBe("quantityId-only");
    // The manifest id IS a contract key.
    expect(byId.realKey).toBe("id");
    // Neither route resolves.
    expect(byId.phantom).toBe("unjoined");
    expect(byId.noQuantityId).toBe("unjoined");
  });

  test("a laboratory with no contract is skipped, never reported as unjoined", () => {
    const { joins, labsWithoutContract } = outputContractJoins(
      [{ id: "fx-02", outputs: [{ id: "anything" }] }],
      {},
    );
    // The distinction that stops this gate inventing defects in bm-02 and lq-02.
    expect(joins).toEqual([]);
    expect(labsWithoutContract).toEqual(["fx-02"]);
  });
});
