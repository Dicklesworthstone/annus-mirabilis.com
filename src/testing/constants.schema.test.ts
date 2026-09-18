import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { ExperimentValidationError, validateConstantSet } from "../content/schemas/experiment.ts";
import { parseStrictYaml } from "../content/schemas/strictParse.ts";
import { ConstantSetError, freezeConstantSet } from "../physics/reference/constants.ts";

const CONSTANT_SETS_DIR = path.join(process.cwd(), "content", "quantities", "constant-sets");

describe("constants.schema.test.ts: validation of committed constant-set records", () => {
  const yamlFiles = readdirSync(CONSTANT_SETS_DIR).filter((f) => f.endsWith(".yaml"));

  test("all committed YAML files parse strictly and validate through schema", () => {
    expect(yamlFiles.length).toBeGreaterThanOrEqual(7);
    for (const file of yamlFiles) {
      const filePath = path.join(CONSTANT_SETS_DIR, file);
      const text = readFileSync(filePath, "utf-8");
      const raw = parseStrictYaml(text, file);
      const validated = validateConstantSet(raw, file);
      expect(validated.id).toBe(file.replace(/\.ya?ml$/, ""));
      expect(validated.entries.length).toBeGreaterThan(0);
    }
  });

  test("corpus sweep: evidentialRole is present on every entry of every committed record", () => {
    for (const file of yamlFiles) {
      const filePath = path.join(CONSTANT_SETS_DIR, file);
      const text = readFileSync(filePath, "utf-8");
      const raw = parseStrictYaml(text, file) as {
        entries: { quantityId: string; evidentialRole?: string }[];
      };
      for (const entry of raw.entries) {
        expect(entry.evidentialRole).toBeDefined();
        expect(typeof entry.evidentialRole).toBe("string");
        expect(entry.evidentialRole?.length).toBeGreaterThan(0);
      }
    }
  });

  test("corpus sweep: Number(exactDecimal) === value on every entry", () => {
    for (const file of yamlFiles) {
      const filePath = path.join(CONSTANT_SETS_DIR, file);
      const text = readFileSync(filePath, "utf-8");
      const raw = parseStrictYaml(text, file) as {
        entries: { quantityId: string; value: number; exactDecimal: string }[];
      };
      for (const entry of raw.entries) {
        expect(Number(entry.exactDecimal)).toBe(entry.value);
      }
    }
  });

  test("corpus sweep: printed-historical entries carry printedStatus and locators", () => {
    for (const file of yamlFiles) {
      if (!file.includes("-printed")) continue;
      const filePath = path.join(CONSTANT_SETS_DIR, file);
      const text = readFileSync(filePath, "utf-8");
      const raw = parseStrictYaml(text, file) as {
        entries: {
          quantityId: string;
          printedStatus?: string;
          printedReading?: string;
          reason?: string;
          sensitivity?: string;
          receiptRef?: string;
          correctedValue?: number;
          journalPage?: string;
          facsimilePdfPage?: number;
        }[];
      };
      for (const entry of raw.entries) {
        expect(entry.printedStatus).toBeDefined();
        if (entry.printedStatus === "printed") {
          expect(entry.printedReading).toBeDefined();
          expect(entry.journalPage).toBeDefined();
          expect(entry.facsimilePdfPage).toBeDefined();
        } else if (entry.printedStatus === "editorial-input") {
          expect(entry.reason).toBeDefined();
          expect(entry.sensitivity).toBeDefined();
        } else if (entry.printedStatus === "printed-corrected") {
          expect(entry.printedReading).toBeDefined();
          expect(entry.correctedValue).toBeDefined();
          expect(entry.receiptRef).toBeDefined();
        }
      }
    }
  });
});

describe("constants.schema.test.ts: failure fixtures for validation rules", () => {
  test("transcribed-and-checked without checkedBy or checkedAt fails", () => {
    const raw = {
      id: "test-missing-check",
      era: "1905",
      provenance: "test",
      precisionNote: "test",
      gasConstantProvenance: "not-applicable",
      entries: [
        {
          quantityId: "speedOfLight",
          value: 3e8,
          exactDecimal: "3e8",
          kind: "declared-scenario",
          era: "1905",
          provenance: "test",
          precision: "test",
          transcriptionStatus: "transcribed-and-checked",
          // missing checkedBy / checkedAt
        },
      ],
    };
    expect(() => validateConstantSet(raw)).toThrow(ExperimentValidationError);
    try {
      validateConstantSet(raw);
    } catch (e) {
      expect((e as ExperimentValidationError).code).toBe("checked-missing-checked-by-at");
    }
  });

  test("exact-defined with uncertainty fails", () => {
    const raw = {
      id: "test-exact-uncertainty",
      era: "2019",
      provenance: "test",
      precisionNote: "test",
      gasConstantProvenance: "defined",
      entries: [
        {
          quantityId: "speedOfLight",
          value: 299792458,
          exactDecimal: "299792458",
          kind: "exact-defined",
          era: "2019",
          provenance: "test",
          precision: "exact",
          uncertainty: 0.1,
        },
      ],
    };
    try {
      validateConstantSet(raw);
      throw new Error("expected throw");
    } catch (e) {
      expect((e as ExperimentValidationError).code).toBe("exact-defined-has-uncertainty");
    }
  });

  test("measured without uncertainty fails", () => {
    const raw = {
      id: "test-measured-no-uncertainty",
      era: "2022",
      provenance: "test",
      precisionNote: "test",
      gasConstantProvenance: "not-applicable",
      entries: [
        {
          quantityId: "electronMass",
          value: 9.1e-31,
          exactDecimal: "9.1e-31",
          kind: "measured",
          era: "2022",
          provenance: "test",
          precision: "test",
          // missing uncertainty
        },
      ],
    };
    try {
      validateConstantSet(raw);
      throw new Error("expected throw");
    } catch (e) {
      expect((e as ExperimentValidationError).code).toBe("measured-missing-uncertainty");
    }
  });

  test("printed-historical without printedStatus fails", () => {
    const raw = {
      id: "einstein-1905-test-printed",
      era: "1905",
      provenance: "test",
      precisionNote: "test",
      gasConstantProvenance: "not-applicable",
      entries: [
        {
          quantityId: "speedOfLight",
          value: 3e8,
          exactDecimal: "3e8",
          kind: "printed-historical",
          era: "1905",
          provenance: "test",
          precision: "test",
          // missing printedStatus
        },
      ],
    };
    try {
      validateConstantSet(raw);
      throw new Error("expected throw");
    } catch (e) {
      expect((e as ExperimentValidationError).code).toBe("missing-printed-status");
    }
  });

  test("printedStatus printed without printedReading fails", () => {
    const raw = {
      id: "einstein-1905-test-printed",
      era: "1905",
      provenance: "test",
      precisionNote: "test",
      gasConstantProvenance: "not-applicable",
      entries: [
        {
          quantityId: "speedOfLight",
          value: 3e8,
          exactDecimal: "3e8",
          kind: "printed-historical",
          printedStatus: "printed",
          era: "1905",
          provenance: "test",
          precision: "test",
          // missing printedReading
        },
      ],
    };
    try {
      validateConstantSet(raw);
      throw new Error("expected throw");
    } catch (e) {
      expect((e as ExperimentValidationError).code).toBe("printed-missing-reading");
    }
  });

  test("printedStatus editorial-input without reason or sensitivity fails", () => {
    const raw = {
      id: "einstein-1905-test-printed",
      era: "1905",
      provenance: "test",
      precisionNote: "test",
      gasConstantProvenance: "not-applicable",
      entries: [
        {
          quantityId: "speedOfLight",
          value: 3e8,
          exactDecimal: "3e8",
          kind: "printed-historical",
          printedStatus: "editorial-input",
          era: "1905",
          provenance: "test",
          precision: "test",
        },
      ],
    };
    try {
      validateConstantSet(raw);
      throw new Error("expected throw");
    } catch (e) {
      expect((e as ExperimentValidationError).code).toBe(
        "editorial-input-missing-reason-sensitivity",
      );
    }
  });

  test("printedStatus printed-corrected without receiptRef fails", () => {
    const raw = {
      id: "einstein-1905-test-printed",
      era: "1905",
      provenance: "test",
      precisionNote: "test",
      gasConstantProvenance: "not-applicable",
      entries: [
        {
          quantityId: "speedOfLight",
          value: 3e8,
          exactDecimal: "3e8",
          kind: "printed-historical",
          printedStatus: "printed-corrected",
          printedReading: "3e8",
          correctedValue: 3e8,
          correctionReason: "test",
          era: "1905",
          provenance: "test",
          precision: "test",
        },
      ],
    };
    try {
      validateConstantSet(raw);
      throw new Error("expected throw");
    } catch (e) {
      expect((e as ExperimentValidationError).code).toBe("printed-corrected-missing-receipt-ref");
    }
  });

  test("retired constant set id einstein-1905-brownian fails with instruction to use einstein-1905-brownian-printed", () => {
    const raw = {
      id: "einstein-1905-brownian",
      era: "1905",
      provenance: "test",
      precisionNote: "test",
      gasConstantProvenance: "not-applicable",
      entries: [
        {
          quantityId: "viscosity",
          value: 0.001,
          kind: "declared-scenario",
        },
      ],
    };
    try {
      validateConstantSet(raw);
      throw new Error("expected throw");
    } catch (e) {
      expect((e as ExperimentValidationError).code).toBe("retired-constant-set-id");
      expect((e as Error).message).toContain("einstein-1905-brownian-printed");
    }
  });
});

describe("constants.schema.test.ts: printedRegion validation", () => {
  const baseEntry = {
    quantityId: "test",
    value: 1,
    exactDecimal: "1",
    unit: "1",
    kind: "printed-historical" as const,
    evidentialRole: "measured-observation" as const,
    provenance: "test",
    dependsOn: [],
    printedStatus: "printed" as const,
    printedReading: "1",
    transcriptionStatus: "transcribed-and-checked" as const,
    checkedBy: "tester",
    checkedAt: "2026-09-17",
  };

  test("a printedRegion of {x: 12, y: 40, width: 18, height: 3} validates", () => {
    expect(() =>
      freezeConstantSet({
        id: "test-valid-region",
        kind: "printed-historical",
        era: 1905,
        provenance: "test",
        precisionNote: "test",
        gasConstantProvenance: "not-applicable",
        entries: [{ ...baseEntry, printedRegion: { x: 12, y: 40, width: 18, height: 3 } }],
      }),
    ).not.toThrow();
  });

  test("a printedRegion of {x: 90, width: 20} fails with invalid-printed-region", () => {
    try {
      freezeConstantSet({
        id: "test-invalid-region",
        kind: "printed-historical",
        era: 1905,
        provenance: "test",
        precisionNote: "test",
        gasConstantProvenance: "not-applicable",
        entries: [{ ...baseEntry, printedRegion: { x: 90, y: 0, width: 20, height: 3 } }],
      });
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ConstantSetError);
      expect((e as ConstantSetError).code).toBe("invalid-printed-region");
      expect((e as Error).message).toContain("out-of-bounds printedRegion");
    }
  });
});
