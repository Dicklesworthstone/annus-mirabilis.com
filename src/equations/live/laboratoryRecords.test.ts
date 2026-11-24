import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import brownian from "../../../content/equations/brownian-motion/eq-model-bm-rms.json";
import aberration from "../../../content/equations/special-relativity/eq-model-sr-aberration.json";
import doppler from "../../../content/equations/special-relativity/eq-model-sr-doppler-factor.json";
import ratio from "../../../content/equations/special-relativity/eq-model-sr-doppler-ratio.json";
import { parseEquationRecord } from "../record.ts";
import { compileEquation } from "../render.ts";
import {
  LABORATORY_EQUATION_OUTPUTS,
  LABORATORY_OUTPUT_PROJECTIONS,
  LABORATORY_SOURCE_OUTPUTS,
  matchesLaboratorySource,
} from "./laboratoryOutputs.ts";
import { laboratoryEquationRecords } from "./laboratoryRecords.ts";

const authored = [brownian, doppler, ratio, aberration].map((record) =>
  parseEquationRecord(record, record.id),
);

test("both laboratories bind declared terms from canonical source contracts", () => {
  for (const experimentId of ["bm-06", "sr-09"] as const) {
    const records = laboratoryEquationRecords(authored, experimentId);
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      const compiled = compileEquation(record);
      expect(compiled.bindings.length).toBeGreaterThan(0);
      for (const binding of compiled.bindings) {
        expect(binding.experimentId).toBe(experimentId);
        expect(binding.instanceSlot).toBe("primary");
        const term = compiled.terms.find((candidate) => candidate.termId === binding.termId);
        assert.ok(term);
        const contract = LABORATORY_EQUATION_OUTPUTS[experimentId][binding.outputId];
        const projection = LABORATORY_OUTPUT_PROJECTIONS[experimentId][binding.outputId];
        assert.ok(contract && projection);
        const source = LABORATORY_SOURCE_OUTPUTS[experimentId][projection.sourceQuantityId];
        assert.ok(source);
        expect(matchesLaboratorySource(source, projection)).toBe(true);
        expect(contract.unit).toBe(term.quantity.unit);
        expect(contract.semanticKind).toBe(term.quantity.semanticKind);
        expect(contract.ownerId).toBe(source.ownerId);
        expect(contract.statuses).toEqual(source.statuses);
      }
    }
  }
});

test("contextual bindings preserve sources and leave unpublished symbols unbound", () => {
  const before = structuredClone(authored);
  const brownianRecords = laboratoryEquationRecords(authored, "bm-06");
  const brownianEquation = brownianRecords.find((record) => record.id === brownian.id);
  assert.ok(brownianEquation);
  expect(brownianEquation.bindings.map((binding) => binding.quantityId)).toEqual([
    "rmsDisplacement1d",
    "diffusionCoefficient",
  ]);
  expect(
    brownianEquation.bindings.some((binding) => binding.quantityId === "observationInterval"),
  ).toBe(false);
  const sr = laboratoryEquationRecords(authored, "sr-09");
  const angle = sr.find((record) => record.id === aberration.id);
  assert.ok(angle);
  expect(
    angle.bindings
      .filter((binding) => binding.quantityId === "frameSpeed")
      .map((binding) => binding.termId),
  ).toEqual(["eq-model-sr-aberration.t.speed", "eq-model-sr-aberration.t.speed2"]);
  expect(
    angle.bindings
      .filter((binding) => binding.quantityId === "propagationAngleStationary")
      .map((binding) => binding.termId),
  ).toEqual(["eq-model-sr-aberration.t.angle", "eq-model-sr-aberration.t.angle2"]);
  expect(
    sr
      .flatMap((record) => record.bindings)
      .some((binding) => binding.quantityId === "speedOfLight"),
  ).toBe(false);
  expect(authored).toEqual(before);
  expect(authored.find((record) => record.id === brownian.id)?.bindings).toEqual(
    brownian.bindings,
  );
});

test("missing, duplicate and reading-only sources cannot acquire live bindings", () => {
  const selected = authored.find((record) => record.id === doppler.id);
  assert.ok(selected);
  expect(() =>
    laboratoryEquationRecords(
      authored.filter((record) => record.id !== doppler.id),
      "sr-09",
    ),
  ).toThrow("Expected one authored equation");
  expect(() => laboratoryEquationRecords([...authored, selected], "sr-09")).toThrow(
    "Expected one authored equation",
  );
  const readingOnly = authored.map((record) =>
    record.id === doppler.id ? { ...record, live: false as const } : record,
  );
  expect(() => laboratoryEquationRecords(readingOnly, "sr-09")).toThrow("reading-only");
});

test("an altered occurrence cannot borrow another occurrence's declared binding", () => {
  const changed = authored.map((record) => {
    if (record.id !== aberration.id) return record;
    const copy = structuredClone(record);
    const text = JSON.stringify(copy).replaceAll(
      "eq-model-sr-aberration.t.angle2",
      "eq-model-sr-aberration.t.otherAngle",
    );
    return parseEquationRecord(JSON.parse(text), "altered occurrence");
  });
  expect(() => laboratoryEquationRecords(changed, "sr-09")).toThrow("Binding must resolve");
});
