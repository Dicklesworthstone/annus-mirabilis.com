import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import position from "../../../content/equations/special-relativity/eq-model-sr-event-separation-position.json";
import time from "../../../content/equations/special-relativity/eq-model-sr-event-separation-time.json";
import { SR03_OUTPUTS } from "../../experiments/sr03/definition.ts";
import { parseEquationRecord } from "../record.ts";
import { compileEquation } from "../render.ts";
import {
  LABORATORY_EQUATION_OUTPUTS,
  LABORATORY_OUTPUT_PROJECTIONS,
  matchesLaboratorySource,
} from "./laboratoryOutputs.ts";
import { laboratoryEquationRecords } from "./laboratoryRecords.ts";

const records = [position, time].map((record) => parseEquationRecord(record, record.id));

test("SR03 records bind event differences and keep unowned speed and constants symbolic", () => {
  const originals = structuredClone(records);
  const contextual = laboratoryEquationRecords(records, "sr-03").map(compileEquation);
  expect(contextual).toHaveLength(2);
  for (const equation of contextual) {
    expect(equation.bindings).toHaveLength(4);
    expect(equation.spoken).toContain("times the difference between");
    expect(equation.sentence.map((phrase) => phrase.text).join("")).toContain(
      "times the difference between",
    );
    for (const binding of equation.bindings) {
      expect(binding.experimentId).toBe("sr-03");
      expect(binding.instanceSlot).toBe("primary");
      const term = equation.terms.find((item) => item.termId === binding.termId);
      const contract = LABORATORY_EQUATION_OUTPUTS["sr-03"][binding.outputId];
      const projection = LABORATORY_OUTPUT_PROJECTIONS["sr-03"][binding.outputId];
      assert.ok(term && contract && projection);
      const source = SR03_OUTPUTS[projection.sourceQuantityId];
      assert.ok(source);
      expect(matchesLaboratorySource(source, projection)).toBe(true);
      expect(contract.unit).toBe(term.quantity.unit);
      expect(contract.semanticKind).toBe(term.quantity.semanticKind);
      expect(contract.ownerId).toBe("sr03-rod-simultaneity-v1");
    }
    for (const term of equation.terms) {
      if (term.quantityId !== "frameSpeed" && term.quantityId !== "speedOfLight") continue;
      expect(equation.bindings.some((binding) => binding.termId === term.termId)).toBe(false);
    }
    expect(
      equation.terms.some((term) => term.quantityId.startsWith("coordinatePosition")),
    ).toBe(false);
    expect(
      equation.terms.some((term) => term.quantityId.startsWith("coordinateTime")),
    ).toBe(false);
  }
  expect(records).toEqual(originals);
  expect(records.flatMap((record) => record.bindings)).toHaveLength(0);
});
