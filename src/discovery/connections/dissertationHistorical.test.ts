import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { correctMolecularCoefficient, inferMolecularProducts } from "../../physics/reference/molecularProducts.ts";
import { checkNumericAnswer, numericPartProblems, referenceFromEvaluation } from "../exercises/numeric.ts";
import {
  DISSERTATION_NUMERIC_PARTS as parts,
  DISSERTATION_PRINTED as printed,
  DISSERTATION_RECONSTRUCTION as computed,
  DISSERTATION_SOURCES as sources,
} from "./dissertationHistorical.ts";

test("the historical readings point to the exact pinned primary sources without claiming human review", () => {
  for (const source of [sources.dissertation, sources.correction]) {
    const bytes = readFileSync(new URL("../../../" + source.path, import.meta.url));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(source.sha256);
  }
  expect(sources.dissertation.mainHref).toEndWith("#page=17");
  expect(sources.dissertation.supplementHref).toEndWith("#page=18");
  expect(sources.correction.href).toEndWith("#page=2");
  expect(sources.humanReviewed).toBe(false);
  expect(sources.checkedBy).toContain("AI agent");
});

test("the supplement's printed radius and the calculated corrected radius remain distinct", () => {
  expect(printed.supplement.radius).toBe(0.78e-9);
  expect(printed.supplement.radius / 1e-9).toBeCloseTo(0.78, 12);
  expect(Object.hasOwn(printed.correction, "radius")).toBe(false);
  expect(computed.correctedSupplement.radius.value / 1e-9).toBeCloseTo(0.4933153, 6);
  expect(computed.correctedSupplement.molecularNumber.value / 1e23).toBeCloseTo(6.56172614, 6);
  expect(computed.correctedMain.molecularNumber.value).toBeLessThan(3.4e23);
});

test("references are computed by the shared owner and are not the printed answer strings", () => {
  const original = inferMolecularProducts(printed.main.products);
  const correction = correctMolecularCoefficient({
    radius: printed.supplement.radius,
    molecularNumber: printed.supplement.molecularNumber,
    fromCoefficient: 1,
    toCoefficient: 2.5,
  });
  const reference = (result: Parameters<typeof referenceFromEvaluation>[0]) =>
    referenceFromEvaluation(result, { constantSetId: "none", owner: "test", exerciseId: "test" }).value;
  expect(computed.main.radius.value).toBe(reference(original.radius));
  expect(computed.main.molecularNumber.value).toBe(reference(original.molecularNumber));
  expect(computed.correctedSupplement.molecularNumber.value).toBe(reference(correction.molecularNumber));
  expect(computed.main.molecularNumber.value).not.toBe(printed.main.molecularNumber);
  expect(computed.correctedSupplement.molecularNumber.value).not.toBe(printed.correction.molecularNumber);
  expect(parts.length).toBeGreaterThan(0);
  for (const part of parts) {
    expect(numericPartProblems(part)).toEqual([]);
    expect(part.reference.constantSetId).toStartWith("none:");
    expect(part.reference.owner).toStartWith("molecular-dimensions.");
  }
});

test("the numeric checker accepts the reconstruction and its stated rounding, but not unit or coefficient mistakes", () => {
  const [radius, number, correction] = parts;
  if (!radius || !number || !correction) throw new Error("The three source questions must be present.");
  expect(checkNumericAnswer(radius, String(radius.reference.value * 1e9), "nm").kind).toBe("agrees");
  expect(checkNumericAnswer(radius, "0.99", "nm").kind).toBe("agrees");
  expect(checkNumericAnswer(radius, "0.99", "cm").kind).toBe("differs");
  expect(checkNumericAnswer(number, "2.1e23", "1/mol").kind).toBe("agrees");
  expect(checkNumericAnswer(correction, "6.56e23", "1/mol").kind).toBe("agrees");
  expect(checkNumericAnswer(correction, "6.02214076e23", "1/mol").kind).toBe("differs");
  expect(checkNumericAnswer(correction, String(4.15e23 * 2.5), "1/mol").kind).toBe("slip");
  expect(checkNumericAnswer(correction, String(computed.correctedMain.molecularNumber.value), "1/mol").kind).toBe("differs");
  expect(checkNumericAnswer(number, "2.1e23", "1").kind).toBe("input-error");
});

test("a nonvalue cannot become a historical exercise reference", () => {
  const bad = inferMolecularProducts({ ...printed.main.products, radiusTimesNumber: 0 });
  expect(() =>
    referenceFromEvaluation(bad.molecularNumber, {
      constantSetId: "none: printed products",
      owner: "molecular-dimensions.inferMolecularProducts",
      exerciseId: "invalid-products",
    }),
  ).toThrow("not a value");
});
