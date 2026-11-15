import { describe, expect, it } from "bun:test";
import { resolveLayerRights } from "./rights.ts";
import {
  ARGUMENT_EXPORT_SCHEMA,
  EQUATION_EXPORT_SCHEMA,
  EXPERIMENT_EXPORT_SCHEMA,
  PAPER_EXPORT_SCHEMA,
  SECTION_EXPORT_SCHEMA,
  validateExportRecord,
} from "./schemas.ts";

describe("additive live export contract", () => {
  it("declares independent provenance, exact alignments, and full authored records", () => {
    expect(PAPER_EXPORT_SCHEMA.properties).toHaveProperty("sourceRevision");
    expect(PAPER_EXPORT_SCHEMA.properties).toHaveProperty("translationDigest");
    expect(PAPER_EXPORT_SCHEMA.properties).toHaveProperty("editorialNotes");
    for (const field of ["alignments", "translationUnits", "arguments", "sourceRevision", "translationDigest"]) {
      expect(SECTION_EXPORT_SCHEMA.properties).toHaveProperty(field);
    }
    expect(ARGUMENT_EXPORT_SCHEMA.properties).toHaveProperty("prerequisites");
    expect(ARGUMENT_EXPORT_SCHEMA.properties).toHaveProperty("readings");
    expect(EQUATION_EXPORT_SCHEMA.properties).toHaveProperty("tree");
    expect(EXPERIMENT_EXPORT_SCHEMA.properties).toHaveProperty("manifest");
  });

  it("preserves v1 required fields, numeric summaries, and closed top-level schemas", () => {
    expect(EQUATION_EXPORT_SCHEMA.required).toContain("latexModern");
    expect(EXPERIMENT_EXPORT_SCHEMA.properties.parameters.items.properties.default.type).toBe("number");
    for (const schema of [
      PAPER_EXPORT_SCHEMA, SECTION_EXPORT_SCHEMA, ARGUMENT_EXPORT_SCHEMA,
      EQUATION_EXPORT_SCHEMA, EXPERIMENT_EXPORT_SCHEMA,
    ]) expect(schema.additionalProperties).toBe(false);
    const record = {
      schemaVersion: 1, paperSlug: "mass-energy", sectionId: "s0", title: "The argument",
      sentences: [], blocks: [], rights: resolveLayerRights({ explanatoryProse: true }),
      contentRevision: "content-revision",
      sourceRevision: "a".repeat(64), translationDigest: "b".repeat(64),
      alignments: [], translationUnits: [], arguments: [],
    };
    expect(() => validateExportRecord("section", record)).not.toThrow();
    expect(() => validateExportRecord("section", { ...record, mystery: true }))
      .toThrow("export-key-undeclared");
    const missingRequired = Object.fromEntries(Object.entries(record).filter(([key]) => key !== "sentences"));
    expect(() => validateExportRecord("section", missingRequired)).toThrow("Missing required field");
    expect(() => validateExportRecord("section", {
      ...record, translationUnits: [{ id: "example", execute: () => 1 }],
    })).toThrow("Forbidden private or executable key");
  });
});
