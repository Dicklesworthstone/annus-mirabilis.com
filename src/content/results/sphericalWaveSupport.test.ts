import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Expression } from "../../equations/ast.ts";
import { verifySRSphericalWave } from "../../equations/derivations/srSphericalWaveProof.ts";
import { type EquationRecord, parseEquationRecord } from "../../equations/record.ts";
import { toCard } from "../../reader/faces/results/fromRecords.ts";
import { checkedSupportFor } from "./checkedSupport.ts";
import { ResultCardsError } from "./printedChecks.ts";
import { loadResultCards } from "./resultCards.ts";

const ROOT = process.cwd();
const directory = join(ROOT, "content/equations/special-relativity");
const equations = readdirSync(directory)
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) =>
    parseEquationRecord(JSON.parse(readFileSync(join(directory, name), "utf8")), name),
  );
const catalogue = loadResultCards(ROOT, "special-relativity");
const compatibility = catalogue?.cards.find((card) => card.id === "sr-principles-compatible");
if (!compatibility) throw new Error("Missing the spherical-wave compatibility result.");
const conclusion = equations.find((record) => record.id === "eq-model-sr-spherical-wave-moving");
if (!conclusion) throw new Error("Missing the moving spherical-wave conclusion.");

function project(source: readonly EquationRecord[] = equations) {
  const argument = JSON.parse(
    readFileSync(
      join(ROOT, "content/arguments/special-relativity/arg-sr-lorentz-map.json"),
      "utf8",
    ),
  ) as { limitations: string[] };
  return toCard(
    ROOT,
    compatibility!,
    new Map([["arg-sr-lorentz-map", argument]]),
    undefined,
    undefined,
    source,
  );
}

describe("the spherical-wave result uses the exact compatibility owner", () => {
  test("the reader card exposes the actual checked conclusion and every admitted premise", () => {
    expect(catalogue?.problems).toEqual([]);
    const support = project().support;
    expect(support?.kind).toBe("checked-proof");
    expect(support?.proofId).toBe("sr-spherical-wave-compatibility");
    expect(support?.conclusion.equationId).toBe(conclusion!.id);
    expect(support?.href).toBe("/papers/special-relativity/s3/#sr-spherical-wave-check");
    expect(support?.scope).toContain("common scale remains arbitrary");
    for (const id of [
      "sr-spherical-wave-admitted-scaled-map",
      "sr-positive-light-speed-subluminal-frame",
      "sr-spherical-wave-finite-nonzero-common-scale",
      "eq-s3-d17",
    ])
      expect(support?.assumptions.map((premise) => premise.id)).toContain(id);
    expect(JSON.parse(JSON.stringify(support))).toEqual(support);
  });

  test("the full coordinate transformation retains its honest unverified scope", () => {
    const transformation = catalogue?.cards.find(
      (card) => card.id === "sr-transformation-equations",
    );
    expect(transformation?.support.kind).toBe("no-checked-proof");
    if (!transformation) throw new Error("Missing the coordinate transformation result.");
    expect(checkedSupportFor(transformation, equations)).toBeUndefined();
  });

  test("a schema-valid wrong wave coefficient fails both the equation check and the result join", () => {
    const original = conclusion!;
    if (original.tree.kind !== "relation") throw new Error("Expected a wave equation.");
    const tree: Expression = {
      ...original.tree,
      right: { kind: "product", args: [{ kind: "number", value: "2" }, original.tree.right] },
    };
    const corrupted = parseEquationRecord({ ...original, tree }, "wrong moving-wave coefficient");
    expect(verifySRSphericalWave(undefined, corrupted.tree).passed).toBe(false);
    expect(() =>
      project(equations.map((record) => (record.id === original.id ? corrupted : record))),
    ).toThrow(ResultCardsError);
  });

  test("the result cannot dispense with the admitted coordinate map or its positive Lorentz factor", () => {
    for (const id of [
      "eq-model-sr-map-position",
      "eq-model-sr-map-time",
      "eq-model-sr-lorentz-factor",
    ])
      expect(() => project(equations.filter((record) => record.id !== id))).toThrow(
        ResultCardsError,
      );
  });
});
