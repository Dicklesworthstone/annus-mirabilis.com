/**
 * Acceptance test suite for equation alternate forms and rename rejection.
 *
 * Implements acceptance criteria for am-eq-expression-tree-8kl:
 * - "The modern notation form is generated from the primary tree by renames only.
 *    Unit conversions and modernizations exist only as alternate forms with their
 *    required fields, and an alternate that is only a rename is rejected."
 * - Rejection rule: 'alternate-is-rename' ("renames belong in the notation concordance,
 *    not alternate forms").
 * - Required fields check:
 *   - 'unit-conversion' requires 'unitSystem' { from, to } and 'derivationChainId'
 *   - 'modernization' requires 'modernLensRef' and historicalStatus: 'later-development'
 */

import { describe, expect, test } from "bun:test";
import { ContentError } from "../content/compiler/json.ts";
import { parseAlternateFormId } from "../content/ids.ts";
import {
  type AlternateFormModernization,
  type AlternateFormUnitConversion,
  type Expression,
  isTreeEquivalentUpToRenames,
  parseAlternateForm,
  parseAlternateForms,
  validateAlternateForm,
  validateAlternateForms,
} from "./ast.ts";
import type { CompositeGroup } from "./monomial.ts";

// Helper builders for clean Expression trees in test fixtures
function sym(termId: string, quantityId: string, scale?: { num: number; den: number }): Expression {
  return { kind: "symbol", termId, quantityId, ...(scale ? { scale } : {}) };
}

function num(value: string): Expression {
  return { kind: "number", value };
}

function sum(args: readonly Expression[], opId?: string): Expression {
  return { kind: "sum", args, ...(opId ? { opId } : {}) };
}

function prod(args: readonly Expression[], opId?: string): Expression {
  return { kind: "product", args, ...(opId ? { opId } : {}) };
}

function quot(numerator: Expression, denominator: Expression, opId?: string): Expression {
  return { kind: "quotient", numerator, denominator, ...(opId ? { opId } : {}) };
}

function power(
  base: Expression,
  exponent: { num: number; den: number },
  opId?: string,
): Expression {
  return { kind: "power", base, exponent, ...(opId ? { opId } : {}) };
}

function root(radicand: Expression, degree: number, opId?: string): Expression {
  return { kind: "root", radicand, degree, ...(opId ? { opId } : {}) };
}

function group(argument: Expression, opId?: string): Expression {
  return { kind: "group", argument, ...(opId ? { opId } : {}) };
}

function rel(
  operator: "=" | "approx" | "define",
  left: Expression,
  right: Expression,
  opId?: string,
): Expression {
  return { kind: "relation", operator, left, right, ...(opId ? { opId } : {}) };
}

describe("Equation Alternate Forms Validation", () => {
  // Paper 3 §6: Gaussian field transformation
  // Y' = beta * (Y - (v / V) * N)
  // Here Y' is comoving E_y, beta is Lorentz factor, Y is rest E_y,
  // v is velocity, V is speed of light, N is rest B_z.
  const s6EquationId = "eq-s6-d3";
  const gaussianPrimaryTree: Expression = rel(
    "=",
    sym("eq-s6-d3.t.yPrime", "electricFieldComovingY"),
    prod([
      sym("eq-s6-d3.t.beta", "lorentzFactor"),
      group(
        sum([
          sym("eq-s6-d3.t.y", "electricFieldRestY"),
          prod([
            num("-1"),
            prod([
              quot(sym("eq-s6-d3.t.v", "relativeVelocityX"), sym("eq-s6-d3.t.V", "speedOfLight")),
              sym("eq-s6-d3.t.N", "magneticFieldRestZ"),
            ]),
          ]),
        ]),
      ),
    ]),
  );

  // Genuine SI unit-conversion alternate:
  // E'_y = gamma * (E_y - v * B_z)
  // Notice: no division by V (speed of light) in the v * B_z product!
  const siConvertedTree: Expression = rel(
    "=",
    sym("eq-s6-d3.t.yPrime", "electricFieldComovingY"),
    prod([
      sym("eq-s6-d3.t.beta", "lorentzFactor"),
      group(
        sum([
          sym("eq-s6-d3.t.y", "electricFieldRestY"),
          prod([
            num("-1"),
            prod([
              sym("eq-s6-d3.t.v", "relativeVelocityX"),
              sym("eq-s6-d3.t.N", "magneticFieldRestZ"),
            ]),
          ]),
        ]),
      ),
    ]),
  );

  // Rename-only alternate masquerading as an alternate form:
  // E'_y = gamma * (E_y - (v / c) * B_z)
  // Everything has identical mathematical structure and identical canonical quantities;
  // only term IDs / symbols were renamed (V -> c, beta -> gamma, etc.).
  const renameOnlyTree: Expression = rel(
    "=",
    sym("eq-s6-d3.t.eyPrime", "electricFieldComovingY"),
    prod([
      sym("eq-s6-d3.t.gamma", "lorentzFactor"),
      group(
        sum([
          sym("eq-s6-d3.t.ey", "electricFieldRestY"),
          prod([
            num("-1"),
            prod([
              quot(
                sym("eq-s6-d3.t.vRel", "relativeVelocityX"),
                sym("eq-s6-d3.t.c", "speedOfLight"),
              ),
              sym("eq-s6-d3.t.bz", "magneticFieldRestZ"),
            ]),
          ]),
        ]),
      ),
    ]),
  );

  describe("Canonical Test Pair: Genuine Unit Conversion vs Rename-Only Alternate", () => {
    test("genuine unit-conversion alternate is ACCEPTED", () => {
      const validConversion = {
        id: "eq-s6-d3.alt.si",
        relation: "unit-conversion",
        label: "SI units form (converted from Gaussian units)",
        tree: siConvertedTree,
        unitSystem: {
          from: "gaussian",
          to: "si",
        },
        derivationChainId: "chain-s6-gaussian-to-si",
      };

      const result = validateAlternateForm(validConversion, gaussianPrimaryTree, s6EquationId);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.form.id).toBe("eq-s6-d3.alt.si");
        expect(result.form.relation).toBe("unit-conversion");
        expect(result.form.unitSystem?.from).toBe("gaussian");
        expect(result.form.unitSystem?.to).toBe("si");
        expect(result.form.derivationChainId).toBe("chain-s6-gaussian-to-si");
      }
    });

    test("rename-only alternate is REJECTED with 'alternate-is-rename' (alternateForms.ts:433)", () => {
      const renameAlternate = {
        id: "eq-s6-d3.alt.modernNotation",
        relation: "unit-conversion",
        label: "Modern notation attempt",
        tree: renameOnlyTree,
        unitSystem: {
          from: "gaussian",
          to: "si", // Claims to be SI, but tree is still Gaussian with v/c factor!
        },
        derivationChainId: "chain-fake-conversion",
      };

      const result = validateAlternateForm(renameAlternate, gaussianPrimaryTree, s6EquationId);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rule).toBe("alternate-is-rename");
        expect(result.equationId).toBe(s6EquationId);
        expect(result.formId).toBe("eq-s6-d3.alt.modernNotation");
        expect(result.error).toContain("only a rename of primary tree");
        expect(result.error).toContain("renames belong in the notation concordance");
      }
    });
  });

  describe("Modernization Alternate Form", () => {
    // Paper 3 §10: Einstein's transverse mass vs modern transverse mass
    const s10EquationId = "eq-s10-d1";

    // Einstein's §10: m_t = mu / (1 - (v / V)^2) [exponent 1 in denominator]
    const transverseMassPrimaryTree: Expression = rel(
      "=",
      sym("eq-s10-d1.t.mTransverse", "transverseMass"),
      quot(
        sym("eq-s10-d1.t.mu", "restMass"),
        sum([
          num("1"),
          prod([
            num("-1"),
            power(
              quot(sym("eq-s10-d1.t.v", "relativeVelocityX"), sym("eq-s10-d1.t.V", "speedOfLight")),
              { num: 2, den: 1 },
            ),
          ]),
        ]),
      ),
    );

    // Modern transverse mass: m_t = m / sqrt(1 - (v / c)^2) [square root in denominator]
    const modernTransverseMassTree: Expression = rel(
      "=",
      sym("eq-s10-d1.t.mTransverse", "transverseMass"),
      quot(
        sym("eq-s10-d1.t.mu", "restMass"),
        root(
          sum([
            num("1"),
            prod([
              num("-1"),
              power(
                quot(
                  sym("eq-s10-d1.t.v", "relativeVelocityX"),
                  sym("eq-s10-d1.t.V", "speedOfLight"),
                ),
                { num: 2, den: 1 },
              ),
            ]),
          ]),
          2,
        ),
      ),
    );

    test("genuine modernization alternate is ACCEPTED", () => {
      const validModernization = {
        id: "eq-s10-d1.alt.momentumRateConvention",
        relation: "modernization",
        label: "Modern transverse mass under momentum-rate force convention",
        tree: modernTransverseMassTree,
        modernLensRef: "lens-relativistic-dynamics-force-convention",
        historicalStatus: "later-development",
      };

      const result = validateAlternateForm(
        validModernization,
        transverseMassPrimaryTree,
        s10EquationId,
      );
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.form.id).toBe("eq-s10-d1.alt.momentumRateConvention");
        expect(result.form.relation).toBe("modernization");
        expect(result.form.modernLensRef).toBe("lens-relativistic-dynamics-force-convention");
        expect(result.form.historicalStatus).toBe("later-development");
      }
    });

    test("modernization that is only a rename is REJECTED with 'alternate-is-rename'", () => {
      // Tree is identical to primary (or up to symbol renames)
      const duplicateModernization = {
        id: "eq-s10-d1.alt.fakeModernization",
        relation: "modernization",
        label: "Fake modernization that changed nothing",
        tree: transverseMassPrimaryTree,
        modernLensRef: "lens-something",
        historicalStatus: "later-development",
      };

      const result = validateAlternateForm(
        duplicateModernization,
        transverseMassPrimaryTree,
        s10EquationId,
      );
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rule).toBe("alternate-is-rename");
      }
    });
  });

  describe("Composite Group Renames are Recognized and Rejected", () => {
    // Diffusion equation: D = (R / N) * T / (6 * pi * k * P)
    // Primary has R / N
    const bmEquationId = "eq-s3-d4";
    const primaryDiffusionTree: Expression = rel(
      "=",
      sym("eq-s3-d4.t.D", "diffusionCoefficient"),
      prod([
        quot(sym("eq-s3-d4.t.R", "molarGasConstant"), sym("eq-s3-d4.t.N", "avogadroConstant")),
        sym("eq-s3-d4.t.T", "absoluteTemperature"),
      ]),
    );

    // Alternate tree where R / N was substituted with k_B:
    const substitutedTree: Expression = rel(
      "=",
      sym("eq-s3-d4.t.D", "diffusionCoefficient"),
      prod([sym("eq-s3-d4.t.kB", "boltzmannConstant"), sym("eq-s3-d4.t.T", "absoluteTemperature")]),
    );

    const compositeGroup: CompositeGroup = {
      id: "grp-boltzmann",
      quantityId: "boltzmannConstant",
      kind: "monomial",
      termIds: ["eq-s3-d4.t.R", "eq-s3-d4.t.N"],
    };

    test("substituting a composite group (R/N -> k_B) is recognized as a rename and rejected", () => {
      const alternate = {
        id: "eq-s3-d4.alt.boltzmannSubstituted",
        relation: "modernization",
        label: "Boltzmann substitution",
        tree: substitutedTree,
        modernLensRef: "lens-statistical-mechanics",
        historicalStatus: "later-development",
      };

      const result = validateAlternateForm(alternate, primaryDiffusionTree, bmEquationId, {
        compositeGroups: [compositeGroup],
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rule).toBe("alternate-is-rename");
      }
    });
  });

  describe("Required-Fields Enforcement and Type Contract", () => {
    test("compile-time type contract: AlternateForm declares required fields per relation", () => {
      const validConversionRes = parseAlternateFormId("eq-s6-d3.alt.si");
      expect(validConversionRes.ok).toBe(true);

      const typedConversion: AlternateFormUnitConversion = {
        id: validConversionRes.ok ? validConversionRes.value : ("eq-s6-d3.alt.si" as any),
        relation: "unit-conversion",
        label: "SI units form",
        tree: siConvertedTree,
        unitSystem: { from: "gaussian", to: "si" },
        derivationChainId: "chain-s6-gaussian-to-si",
      };
      expect(typedConversion.unitSystem.from).toBe("gaussian");
      expect(typedConversion.derivationChainId).toBe("chain-s6-gaussian-to-si");

      const validModRes = parseAlternateFormId("eq-s10-d1.alt.mod");
      expect(validModRes.ok).toBe(true);

      const typedModernization: AlternateFormModernization = {
        id: validModRes.ok ? validModRes.value : ("eq-s10-d1.alt.mod" as any),
        relation: "modernization",
        label: "Modern transverse mass",
        tree: siConvertedTree,
        modernLensRef: "lens-relativistic-force",
        historicalStatus: "later-development",
      };
      expect(typedModernization.modernLensRef).toBe("lens-relativistic-force");
      expect(typedModernization.historicalStatus).toBe("later-development");
    });

    test("unit-conversion missing 'unitSystem' fails rule 'unit-conversion-missing-fields' (alternateForms.ts:373)", () => {
      const missingUnitSystem = {
        id: "eq-s6-d3.alt.si",
        relation: "unit-conversion",
        label: "SI units form",
        tree: siConvertedTree,
        derivationChainId: "chain-s6-gaussian-to-si",
      };

      const result = validateAlternateForm(missingUnitSystem, gaussianPrimaryTree, s6EquationId);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rule).toBe("unit-conversion-missing-fields");
        expect(result.error).toContain("requires 'unitSystem'");
      }
    });

    test("unit-conversion missing 'from' or 'to' in unitSystem fails rule 'unit-conversion-missing-fields'", () => {
      const incompleteUnitSystem = {
        id: "eq-s6-d3.alt.si",
        relation: "unit-conversion",
        label: "SI units form",
        tree: siConvertedTree,
        unitSystem: { from: "gaussian" }, // missing 'to'
        derivationChainId: "chain-s6-gaussian-to-si",
      };

      const result = validateAlternateForm(incompleteUnitSystem, gaussianPrimaryTree, s6EquationId);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rule).toBe("unit-conversion-missing-fields");
      }
    });

    test("unit-conversion missing 'derivationChainId' fails rule 'unit-conversion-missing-fields' (alternateForms.ts:383)", () => {
      const missingChain = {
        id: "eq-s6-d3.alt.si",
        relation: "unit-conversion",
        label: "SI units form",
        tree: siConvertedTree,
        unitSystem: { from: "gaussian", to: "si" },
      };

      const result = validateAlternateForm(missingChain, gaussianPrimaryTree, s6EquationId);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rule).toBe("unit-conversion-missing-fields");
        expect(result.error).toContain("derivationChainId");
      }
    });

    test("modernization missing 'modernLensRef' fails rule 'modernization-missing-fields' (alternateForms.ts:393)", () => {
      const missingLens = {
        id: "eq-s6-d3.alt.modern",
        relation: "modernization",
        label: "Modern form",
        tree: siConvertedTree,
        historicalStatus: "later-development",
      };

      const result = validateAlternateForm(missingLens, gaussianPrimaryTree, s6EquationId);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rule).toBe("modernization-missing-fields");
        expect(result.error).toContain("modernLensRef");
      }
    });

    test("modernization missing or invalid 'historicalStatus' fails rule 'modernization-missing-fields' (alternateForms.ts:403)", () => {
      const invalidStatus = {
        id: "eq-s6-d3.alt.modern",
        relation: "modernization",
        label: "Modern form",
        tree: siConvertedTree,
        modernLensRef: "lens-ref",
        historicalStatus: "contemporary", // Must be 'later-development'
      };

      const result = validateAlternateForm(invalidStatus, gaussianPrimaryTree, s6EquationId);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rule).toBe("modernization-missing-fields");
        expect(result.error).toContain("later-development");
      }
    });
  });

  describe("ID, Label, and Relation Grammar Rejections", () => {
    test("relation: 'rename-only' is rejected with 'invalid-alternate-relation'", () => {
      const renameRelation = {
        id: "eq-s6-d3.alt.si",
        relation: "rename-only",
        label: "Rename only form",
        tree: siConvertedTree,
      };

      const result = validateAlternateForm(renameRelation, gaussianPrimaryTree, s6EquationId);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rule).toBe("invalid-alternate-relation");
        expect(result.error).toContain("renames belong in the notation concordance");
      }
    });

    test("invalid alternate form ID grammar is rejected", () => {
      const badId = {
        id: "eq-s6-d3.alt.SI_FORM", // uppercase and underscore rejected
        relation: "unit-conversion",
        label: "SI form",
        tree: siConvertedTree,
        unitSystem: { from: "gaussian", to: "si" },
        derivationChainId: "chain-1",
      };

      const result = validateAlternateForm(badId, gaussianPrimaryTree, s6EquationId);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rule).toBe("alternate-form-id-grammar");
      }
    });

    test("alternate form ID equation mismatch is rejected", () => {
      const mismatchedId = {
        id: "eq-s10-d1.alt.si", // does not match eq-s6-d3
        relation: "unit-conversion",
        label: "SI form",
        tree: siConvertedTree,
        unitSystem: { from: "gaussian", to: "si" },
        derivationChainId: "chain-1",
      };

      const result = validateAlternateForm(mismatchedId, gaussianPrimaryTree, s6EquationId);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rule).toBe("alternate-form-equation-mismatch");
      }
    });

    test("missing label is rejected with 'alternate-missing-label'", () => {
      const missingLabel = {
        id: "eq-s6-d3.alt.si",
        relation: "unit-conversion",
        label: "   ",
        tree: siConvertedTree,
        unitSystem: { from: "gaussian", to: "si" },
        derivationChainId: "chain-1",
      };

      const result = validateAlternateForm(missingLabel, gaussianPrimaryTree, s6EquationId);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.rule).toBe("alternate-missing-label");
      }
    });
  });

  describe("Parser and Array Utilities", () => {
    test("parseAlternateForm returns typed AlternateForm on success", () => {
      const validConversion = {
        id: "eq-s6-d3.alt.si",
        relation: "unit-conversion",
        label: "SI form",
        tree: siConvertedTree,
        unitSystem: { from: "gaussian", to: "si" },
        derivationChainId: "chain-s6-gaussian-to-si",
      };

      const form = parseAlternateForm(validConversion, gaussianPrimaryTree, s6EquationId);
      expect(form.id).toBe("eq-s6-d3.alt.si");
      expect(form.relation).toBe("unit-conversion");
    });

    test("parseAlternateForm throws ContentError with rule code on failure", () => {
      const renameAlternate = {
        id: "eq-s6-d3.alt.renameOnly",
        relation: "unit-conversion",
        label: "Rename only",
        tree: renameOnlyTree,
        unitSystem: { from: "gaussian", to: "si" },
        derivationChainId: "chain-fake",
      };

      expect(() => {
        parseAlternateForm(renameAlternate, gaussianPrimaryTree, s6EquationId);
      }).toThrow(ContentError);

      try {
        parseAlternateForm(renameAlternate, gaussianPrimaryTree, s6EquationId);
      } catch (err) {
        expect(err instanceof ContentError).toBe(true);
        if (err instanceof ContentError) {
          expect(err.code).toBe("alternate-is-rename");
        }
      }
    });

    test("validateAlternateForms validates array and catches duplicates", () => {
      const validConversion = {
        id: "eq-s6-d3.alt.si",
        relation: "unit-conversion",
        label: "SI form",
        tree: siConvertedTree,
        unitSystem: { from: "gaussian", to: "si" },
        derivationChainId: "chain-s6-gaussian-to-si",
      };

      const resEmpty = validateAlternateForms([], gaussianPrimaryTree, s6EquationId);
      expect(resEmpty.valid).toBe(true);

      const resSingle = validateAlternateForms(
        [validConversion],
        gaussianPrimaryTree,
        s6EquationId,
      );
      expect(resSingle.valid).toBe(true);
      if (resSingle.valid) {
        expect(resSingle.forms.length).toBe(1);
      }

      // Duplicate IDs in array:
      const resDup = validateAlternateForms(
        [validConversion, validConversion],
        gaussianPrimaryTree,
        s6EquationId,
      );
      expect(resDup.valid).toBe(false);
      if (!resDup.valid) {
        expect(resDup.rule).toBe("duplicate-alternate-id");
      }
    });

    test("parseAlternateForms returns empty array for undefined", () => {
      const forms = parseAlternateForms(undefined, gaussianPrimaryTree, s6EquationId);
      expect(forms).toEqual([]);
    });
  });

  describe("Planted Negatives (verifiable rule gates)", () => {
    test("Planted Negative: Disabling checkRename allows rename-only alternate to pass", () => {
      const renameAlternate = {
        id: "eq-s6-d3.alt.renameOnly",
        relation: "unit-conversion",
        label: "Rename only",
        tree: renameOnlyTree,
        unitSystem: { from: "gaussian", to: "si" },
        derivationChainId: "chain-fake",
      };

      // Default: fails
      const strictRes = validateAlternateForm(renameAlternate, gaussianPrimaryTree, s6EquationId);
      expect(strictRes.valid).toBe(false);
      if (!strictRes.valid) {
        expect(strictRes.rule).toBe("alternate-is-rename");
      }

      // If checkRename is disabled (the planted negative):
      const disabledRes = validateAlternateForm(
        renameAlternate,
        gaussianPrimaryTree,
        s6EquationId,
        {
          checkRename: false,
        },
      );
      expect(disabledRes.valid).toBe(true);
    });

    test("Planted Negative: Disabling checkRequiredFields allows incomplete alternate to pass", () => {
      const incomplete = {
        id: "eq-s6-d3.alt.si",
        relation: "unit-conversion",
        label: "SI form",
        tree: siConvertedTree,
        // Missing unitSystem and derivationChainId
      };

      // Default: fails
      const strictRes = validateAlternateForm(incomplete, gaussianPrimaryTree, s6EquationId);
      expect(strictRes.valid).toBe(false);
      if (!strictRes.valid) {
        expect(strictRes.rule).toBe("unit-conversion-missing-fields");
      }

      // If checkRequiredFields is disabled (the planted negative):
      const disabledRes = validateAlternateForm(incomplete, gaussianPrimaryTree, s6EquationId, {
        checkRequiredFields: false,
      });
      expect(disabledRes.valid).toBe(true);
    });
  });

  describe("alternateForms refusal throw sites (am-muyh)", () => {
    const dummyTree: Expression = sym("t.x", "q");
    const validForm = {
      id: "eq-bm-s3-d4.alt.modern",
      relation: "modernization" as const,
      label: "Modern form with eta",
      tree: sum([sym("t.x", "q"), num("1")]),
      modernLensRef: "lens-modern",
      historicalStatus: "later-development" as const,
    };

    test("refusal (alternateForms.ts:298): invalid-alternate-form rejects non-object input", () => {
      // Accept: valid object
      const accepted = validateAlternateForm(validForm, dummyTree, "eq-bm-s3-d4");
      expect(accepted.valid).toBe(true);

      // Reject: string primitive
      const rejected = validateAlternateForm("not-an-object", dummyTree, "eq-bm-s3-d4");
      expect(rejected.valid).toBe(false);
      if (!rejected.valid) {
        expect(rejected.rule).toBe("invalid-alternate-form");
      }
    });

    test("refusal (alternateForms.ts:416): alternate-missing-tree rejects alternate missing tree", () => {
      // Accept: valid form with tree
      const accepted = validateAlternateForm(validForm, dummyTree, "eq-bm-s3-d4");
      expect(accepted.valid).toBe(true);

      // Reject: form missing tree
      const missingTree = {
        id: "eq-bm-s3-d4.alt.modern",
        relation: "modernization",
        label: "Modern form",
        modernLensRef: "lens-modern",
        historicalStatus: "later-development",
      };
      const rejected = validateAlternateForm(missingTree, dummyTree, "eq-bm-s3-d4");
      expect(rejected.valid).toBe(false);
      if (!rejected.valid) {
        expect(rejected.rule).toBe("alternate-missing-tree");
      }
    });

    test("refusal (alternateForms.ts:492): invalid-alternate-forms-list rejects non-array alternate forms list", () => {
      // Accept: valid array
      const accepted = validateAlternateForms([validForm], dummyTree, "eq-bm-s3-d4");
      expect(accepted.valid).toBe(true);

      // Reject: non-array input
      const rejected = validateAlternateForms("not-an-array", dummyTree, "eq-bm-s3-d4");
      expect(rejected.valid).toBe(false);
      if (!rejected.valid) {
        expect(rejected.rule).toBe("invalid-alternate-forms-list");
      }
    });
  });
});
