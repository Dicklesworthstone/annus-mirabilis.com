/**
 * Tests for monomial factor-set binding, extraction, and dual-view representation.
 *
 * Implements acceptance criteria for am-eq-expression-tree-8kl:
 * (a) Monomial factor-set binding implemented, with tests for both RT/N and R*beta*nu/N
 *     showing each member keeps its own quantity binding AND the printed structure is
 *     unchanged. Both directions: subtree view and factor-set view of the same node.
 * (d) Planted negative: disabling one of the new binding rules causes exactly
 *     the corresponding test to fail.
 */

import { describe, expect, test } from "bun:test";
import { ContentError } from "../content/compiler/json.ts";
import { canonical, type Expression, findNode, walk } from "./ast.ts";
import {
  bindCompositeGroup,
  type CompositeGroup,
  extractMonomialFactorSet,
  validateCompositeGroup,
  viewNode,
} from "./monomial.ts";

const sym = (termId: string, quantityId: string): Expression => ({
  kind: "symbol",
  termId,
  quantityId,
});
const num = (value: string): Expression => ({ kind: "number", value });
const constant = (name: "pi"): Expression => ({ kind: "constant", name });
const prod = (args: readonly Expression[], opId?: string): Expression => ({
  kind: "product",
  args,
  ...(opId ? { opId } : {}),
});
const sum = (args: readonly Expression[], opId?: string): Expression => ({
  kind: "sum",
  args,
  ...(opId ? { opId } : {}),
});
const quot = (numerator: Expression, denominator: Expression, opId?: string): Expression => ({
  kind: "quotient",
  numerator,
  denominator,
  ...(opId ? { opId } : {}),
});
const rel = (
  operator: "=" | "approx" | "define",
  left: Expression,
  right: Expression,
  opId?: string,
): Expression => ({
  kind: "relation",
  operator,
  left,
  right,
  ...(opId ? { opId } : {}),
});

describe("Monomial Factor-Set Binding and Dual View", () => {
  // --------------------------------------------------------------------------
  // Fixture 1: RT/N inside D = (RT / N) * (1 / (6 * pi * k * P))
  // --------------------------------------------------------------------------
  const rtOverNNode: Expression = quot(
    prod(
      [sym("eq-bm-s3-d4.t.R", "molarGasConstant"), sym("eq-bm-s3-d4.t.T", "temperature")],
      "eq-bm-s3-d4.op.numProd",
    ),
    sym("eq-bm-s3-d4.t.N", "avogadroConstant"),
    "eq-bm-s3-d4.op.quot",
  );

  const brownianEquation: Expression = rel(
    "=",
    sym("eq-bm-s3-d4.t.D", "diffusionCoefficient"),
    prod(
      [
        rtOverNNode,
        quot(
          num("1"),
          prod(
            [
              num("6"),
              constant("pi"),
              sym("eq-bm-s3-d4.t.k", "viscosity"),
              sym("eq-bm-s3-d4.t.P", "particleRadius"),
            ],
            "eq-bm-s3-d4.op.stokesDenom",
          ),
          "eq-bm-s3-d4.op.stokesQuot",
        ),
      ],
      "eq-bm-s3-d4.op.rhs",
    ),
    "eq-bm-s3-d4.op.rel",
  );

  // --------------------------------------------------------------------------
  // Fixture 2: R * beta * nu / N
  // --------------------------------------------------------------------------
  const rBetaNuOverNNode: Expression = quot(
    prod(
      [
        sym("eq-lq-s1-d1.t.R", "molarGasConstant"),
        sym("eq-lq-s1-d1.t.beta", "wienConstantBeta"),
        sym("eq-lq-s1-d1.t.nu", "frequency"),
      ],
      "eq-lq-s1-d1.op.numProd",
    ),
    sym("eq-lq-s1-d1.t.N", "avogadroConstant"),
    "eq-lq-s1-d1.op.quot",
  );

  describe("AC3(a): RT/N Monomial Factor Set and Dual View", () => {
    test("extracts monomial factor set with correct exponents (+1 for numerator, -1 for denominator)", () => {
      const factorSet = extractMonomialFactorSet(rtOverNNode);
      expect(factorSet.factors).toHaveLength(3);

      expect(factorSet.has("eq-bm-s3-d4.t.R")).toBe(true);
      expect(factorSet.has("eq-bm-s3-d4.t.T")).toBe(true);
      expect(factorSet.has("eq-bm-s3-d4.t.N")).toBe(true);

      expect(factorSet.exponentOf("eq-bm-s3-d4.t.R")).toBe(1);
      expect(factorSet.exponentOf("eq-bm-s3-d4.t.T")).toBe(1);
      expect(factorSet.exponentOf("eq-bm-s3-d4.t.N")).toBe(-1);

      const rFactor = factorSet.get("eq-bm-s3-d4.t.R");
      expect(rFactor?.quantityId).toBe("molarGasConstant");
      const nFactor = factorSet.get("eq-bm-s3-d4.t.N");
      expect(nFactor?.quantityId).toBe("avogadroConstant");
    });

    test("dual view: operates in both directions on the exact same node", () => {
      const view = viewNode(rtOverNNode);

      // 1. Subtree view of the node
      expect(view.subtree.kind).toBe("quotient");
      expect(view.getSubtreeView().kind).toBe("quotient");
      const subNodes = walk(view.subtree);
      expect(subNodes.some((n) => n.kind === "quotient")).toBe(true);
      expect(subNodes.some((n) => n.kind === "product")).toBe(true);

      // 2. Factor-set view of the same node
      const factorSet = view.getFactorSetView();
      expect(factorSet.factors).toHaveLength(3);
      expect(factorSet.exponentOf("eq-bm-s3-d4.t.R")).toBe(1);
      expect(factorSet.exponentOf("eq-bm-s3-d4.t.N")).toBe(-1);

      // 3. Navigation from factor back to subtree node (Factor-set -> Subtree)
      const rFactor = factorSet.get("eq-bm-s3-d4.t.R")!;
      const rNode = view.nodeForFactor(rFactor);
      expect(rNode).toBeDefined();
      expect(rNode?.kind).toBe("symbol");
      if (rNode?.kind === "symbol") {
        expect(rNode.termId).toBe("eq-bm-s3-d4.t.R");
        expect(rNode.quantityId).toBe("molarGasConstant");
      }

      const nFactor = factorSet.get("eq-bm-s3-d4.t.N")!;
      const nNode = view.nodeForFactor(nFactor);
      expect(nNode).toBeDefined();
      expect(nNode?.kind).toBe("symbol");
      if (nNode?.kind === "symbol") {
        expect(nNode.termId).toBe("eq-bm-s3-d4.t.N");
        expect(nNode.quantityId).toBe("avogadroConstant");
      }
    });

    test("binds Boltzmann constant {R^1, N^-1} while preserving member bindings and printed structure", () => {
      const boltzmannGroup: CompositeGroup = {
        id: "grp-bm-boltzmann",
        quantityId: "boltzmannConstant",
        kind: "monomial",
        termIds: ["eq-bm-s3-d4.t.R", "eq-bm-s3-d4.t.N"],
        exponents: {
          "eq-bm-s3-d4.t.R": 1,
          "eq-bm-s3-d4.t.N": -1,
        },
      };

      const initialCanonical = canonical(brownianEquation);

      const bindResult = bindCompositeGroup(boltzmannGroup, brownianEquation);
      expect(bindResult.ok).toBe(true);

      // Printed structure is byte-for-byte unchanged
      const finalCanonical = canonical(brownianEquation);
      expect(finalCanonical).toBe(initialCanonical);

      // Each member keeps its own individual quantity binding
      const rNode = findNode(brownianEquation, "eq-bm-s3-d4.t.R");
      expect(rNode?.kind).toBe("symbol");
      if (rNode?.kind === "symbol") {
        expect(rNode.quantityId).toBe("molarGasConstant");
      }

      const nNode = findNode(brownianEquation, "eq-bm-s3-d4.t.N");
      expect(nNode?.kind).toBe("symbol");
      if (nNode?.kind === "symbol") {
        expect(nNode.quantityId).toBe("avogadroConstant");
      }

      const tNode = findNode(brownianEquation, "eq-bm-s3-d4.t.T");
      expect(tNode?.kind).toBe("symbol");
      if (tNode?.kind === "symbol") {
        expect(tNode.quantityId).toBe("temperature");
      }
    });
  });

  describe("AC3(a): R*beta*nu/N Monomial Factor Set and Dual View", () => {
    test("extracts monomial factor set for R*beta*nu/N with correct exponents", () => {
      const factorSet = extractMonomialFactorSet(rBetaNuOverNNode);
      expect(factorSet.factors).toHaveLength(4);

      expect(factorSet.exponentOf("eq-lq-s1-d1.t.R")).toBe(1);
      expect(factorSet.exponentOf("eq-lq-s1-d1.t.beta")).toBe(1);
      expect(factorSet.exponentOf("eq-lq-s1-d1.t.nu")).toBe(1);
      expect(factorSet.exponentOf("eq-lq-s1-d1.t.N")).toBe(-1);
    });

    test("dual view of R*beta*nu/N in both directions", () => {
      const view = viewNode(rBetaNuOverNNode);

      // Subtree view
      expect(view.subtree.kind).toBe("quotient");

      // Factor-set view
      const fs = view.getFactorSetView();
      expect(fs.factors).toHaveLength(4);

      // Navigation back to subtree AST nodes
      const betaFactor = fs.get("eq-lq-s1-d1.t.beta")!;
      const betaNode = view.nodeForFactor(betaFactor);
      expect(betaNode?.kind).toBe("symbol");
      if (betaNode?.kind === "symbol") {
        expect(betaNode.quantityId).toBe("wienConstantBeta");
      }
    });

    test("binds Planck constant {R^1, beta^1, N^-1} while nu remains frequency", () => {
      const planckGroup: CompositeGroup = {
        id: "grp-lq-planck",
        quantityId: "planckConstant",
        kind: "monomial",
        termIds: ["eq-lq-s1-d1.t.R", "eq-lq-s1-d1.t.beta", "eq-lq-s1-d1.t.N"],
        exponents: {
          "eq-lq-s1-d1.t.R": 1,
          "eq-lq-s1-d1.t.beta": 1,
          "eq-lq-s1-d1.t.N": -1,
        },
      };

      const initialCanonical = canonical(rBetaNuOverNNode);

      const bindResult = bindCompositeGroup(planckGroup, rBetaNuOverNNode);
      expect(bindResult.ok).toBe(true);

      // Printed AST structure is unmodified
      expect(canonical(rBetaNuOverNNode)).toBe(initialCanonical);

      // All member symbols maintain their individual quantity bindings
      const rNode = findNode(rBetaNuOverNNode, "eq-lq-s1-d1.t.R");
      expect(rNode && "quantityId" in rNode && rNode.quantityId).toBe("molarGasConstant");

      const betaNode = findNode(rBetaNuOverNNode, "eq-lq-s1-d1.t.beta");
      expect(betaNode && "quantityId" in betaNode && betaNode.quantityId).toBe("wienConstantBeta");

      const nNode = findNode(rBetaNuOverNNode, "eq-lq-s1-d1.t.N");
      expect(nNode && "quantityId" in nNode && nNode.quantityId).toBe("avogadroConstant");

      const nuNode = findNode(rBetaNuOverNNode, "eq-lq-s1-d1.t.nu");
      expect(nuNode && "quantityId" in nuNode && nuNode.quantityId).toBe("frequency");
    });
  });

  describe("Subtree vs Monomial Factor-Set Distinction", () => {
    test("R and T in RT/N form a contiguous subtree, but R and N do not", () => {
      // Group {R, T} as subtree -> valid because numerator is product([R, T])
      const rtSubtreeGroup: CompositeGroup = {
        id: "grp-rt-subtree",
        quantityId: "thermalEnergyPerMole",
        kind: "subtree",
        termIds: ["eq-bm-s3-d4.t.R", "eq-bm-s3-d4.t.T"],
      };
      const rtRes = validateCompositeGroup(rtSubtreeGroup, rtOverNNode);
      expect(rtRes.ok).toBe(true);

      // Group {R, N} as subtree -> fails because R and N do not form a subtree without T
      const rnSubtreeGroup: CompositeGroup = {
        id: "grp-rn-subtree",
        quantityId: "boltzmannConstant",
        kind: "subtree",
        termIds: ["eq-bm-s3-d4.t.R", "eq-bm-s3-d4.t.N"],
      };
      const rnRes = validateCompositeGroup(rnSubtreeGroup, rtOverNNode);
      expect(rnRes.ok).toBe(false);
      if (!rnRes.ok) {
        expect(rnRes.rule).toBe("composite-group-subtree-mismatch");
      }

      // But group {R, N} as monomial -> succeeds!
      const rnMonomialGroup: CompositeGroup = {
        id: "grp-rn-monomial",
        quantityId: "boltzmannConstant",
        kind: "monomial",
        termIds: ["eq-bm-s3-d4.t.R", "eq-bm-s3-d4.t.N"],
        exponents: {
          "eq-bm-s3-d4.t.R": 1,
          "eq-bm-s3-d4.t.N": -1,
        },
      };
      const rnMonomialRes = validateCompositeGroup(rnMonomialGroup, rtOverNNode);
      expect(rnMonomialRes.ok).toBe(true);
    });
  });

  describe("AC3(d): Planted Negatives for Composite Group Binding Rules", () => {
    test("Planted Negative 1: Exponent mismatch fails rule 'composite-group-exponents-mismatch'", () => {
      // Inverted exponent: claims N is in numerator (+1) instead of denominator (-1)
      const invertedGroup: CompositeGroup = {
        id: "grp-inverted-n",
        quantityId: "boltzmannConstant",
        kind: "monomial",
        termIds: ["eq-bm-s3-d4.t.R", "eq-bm-s3-d4.t.N"],
        exponents: {
          "eq-bm-s3-d4.t.R": 1,
          "eq-bm-s3-d4.t.N": 1, // Wrong! Actual is -1
        },
      };

      // With default checks enabled: fails
      const strictRes = validateCompositeGroup(invertedGroup, rtOverNNode);
      expect(strictRes.ok).toBe(false);
      if (!strictRes.ok) {
        expect(strictRes.rule).toBe("composite-group-exponents-mismatch");
        expect(strictRes.error).toContain("exponent mismatch for term 'eq-bm-s3-d4.t.N'");
      }

      // If the exponent check rule is disabled: the test would pass
      const disabledRuleRes = validateCompositeGroup(invertedGroup, rtOverNNode, {
        checkExponents: false,
      });
      expect(disabledRuleRes.ok).toBe(true);
    });

    test("Planted Negative 2 (monomial.ts:301): Terms in a sum fail rule 'composite-group-monomial-mismatch'", () => {
      // Terms from different parts of a sum: (x + y) * z
      const sumExpr: Expression = prod([
        sum([sym("eq-test.t.x", "coordinateX"), sym("eq-test.t.y", "coordinateY")]),
        sym("eq-test.t.z", "coordinateZ"),
      ]);

      const sumGroup: CompositeGroup = {
        id: "grp-sum-terms",
        quantityId: "compositePosition",
        kind: "monomial",
        termIds: ["eq-test.t.x", "eq-test.t.y"],
      };

      const res = validateCompositeGroup(sumGroup, sumExpr);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.rule).toBe("composite-group-monomial-mismatch");
        expect(res.error).toContain("is not a monomial product or quotient");
      }
    });

    test("Planted Negative 3: Missing term fails rule 'composite-group-terms-exist'", () => {
      const missingTermGroup: CompositeGroup = {
        id: "grp-missing-term",
        quantityId: "boltzmannConstant",
        kind: "monomial",
        termIds: ["eq-bm-s3-d4.t.R", "eq-bm-s3-d4.t.nonexistent"],
      };

      const res = validateCompositeGroup(missingTermGroup, rtOverNNode);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.rule).toBe("composite-group-terms-exist");
        expect(res.error).toContain("not found as a symbol");
      }

      // If checkTermsExist is disabled: fails at monomial check instead
      const disabledTermsExist = validateCompositeGroup(missingTermGroup, rtOverNNode, {
        checkTermsExist: false,
      });
      expect(disabledTermsExist.ok).toBe(false);
      if (!disabledTermsExist.ok) {
        expect(disabledTermsExist.rule).toBe("composite-group-monomial-mismatch");
      }
    });

    test("Planted Negative 4: Member quantity binding mutation fails rule 'composite-group-member-binding-preserved'", () => {
      // Create a corrupted tree where a member symbol was mutated to the group's composite quantityId
      const mutatedTree: Expression = quot(
        sym("eq-bm.t.R", "boltzmannConstant"), // Corrupted! Should be molarGasConstant
        sym("eq-bm.t.N", "avogadroConstant"),
      );

      const group: CompositeGroup = {
        id: "grp-boltzmann",
        quantityId: "boltzmannConstant",
        kind: "monomial",
        termIds: ["eq-bm.t.R", "eq-bm.t.N"],
      };

      const res = validateCompositeGroup(group, mutatedTree);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.rule).toBe("composite-group-member-binding-preserved");
        expect(res.error).toContain("individual quantity binding replaced");
      }

      // If checkPreserveMemberBindings is disabled: it passes
      const bypassRes = validateCompositeGroup(group, mutatedTree, {
        checkPreserveMemberBindings: false,
      });
      expect(bypassRes.ok).toBe(true);
    });
  });

  describe("monomial refusal throw sites (am-muyh)", () => {
    test("refusal (monomial.ts:108): monomial-fractional-power rejects fractional exponents", () => {
      // Accept: integer power (den: 1)
      const accepted = extractMonomialFactorSet({
        kind: "power",
        base: sym("t.x", "q"),
        exponent: { num: 2, den: 1 },
      });
      expect(accepted.factors.length).toBe(1);
      expect(accepted.exponentOf("t.x")).toBe(2);

      // Reject: fractional power (den: 2)
      let thrown: unknown;
      try {
        extractMonomialFactorSet({
          kind: "power",
          base: sym("t.x", "q"),
          exponent: { num: 1, den: 2 },
        });
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(ContentError);
      expect((thrown as ContentError).code).toBe("monomial-fractional-power");
    });

    test("refusal (monomial.ts:125): monomial-invalid-node rejects unsupported node kinds", () => {
      // Accept: symbol node
      const accepted = extractMonomialFactorSet(sym("t.x", "q"));
      expect(accepted.factors.length).toBe(1);

      // Reject: sum node
      let thrown: unknown;
      try {
        extractMonomialFactorSet(sum([sym("t.x", "q"), sym("t.y", "q")]));
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(ContentError);
      expect((thrown as ContentError).code).toBe("monomial-invalid-node");
    });

    /**
     * THIS TEST'S TITLE WAS WRONG IN THREE WAYS, and all three survived because
     * composite-group-monomial-mismatch has three sites that emit the same rule string.
     *
     * It cited monomial.ts:324, which holds composite-group-EXPONENTS-mismatch, a different
     * code. It said "term missing from factor set", which is the site at :311. And the input
     * it builds reaches neither: 't.notInFactorSet' is nowhere in the tree, so
     * findInnermostContainingNode returns null and the refusal comes from :290, "no common
     * containing expression". Planting :290 reddens it; planting :311 does not.
     *
     * Retitled to what it actually drives. The :311 case it was reaching for is the test
     * below, which needed a different tree to get there at all.
     */
    test("refusal (monomial.ts:290): composite-group-monomial-mismatch rejects terms with no common containing expression", () => {
      // Accept: term is a factor
      const accepted = validateCompositeGroup(
        {
          id: "grp-1",
          quantityId: "q",
          kind: "monomial",
          termIds: ["t.x"],
        },
        prod([sym("t.x", "q1"), sym("t.y", "q2")]),
      );
      expect(accepted.ok).toBe(true);

      // Reject: with checkTermsExist false, a term absent from the tree entirely has no
      // containing node, which is :290 rather than the factor-set membership check.
      const rejected = validateCompositeGroup(
        {
          id: "grp-1",
          quantityId: "q",
          kind: "monomial",
          termIds: ["t.notInFactorSet"],
        },
        prod([sym("t.x", "q1"), sym("t.y", "q2")]),
        { checkTermsExist: false },
      );
      expect(rejected.ok).toBe(false);
      if (!rejected.ok) {
        expect(rejected.rule).toBe("composite-group-monomial-mismatch");
        // The message is what separates this site from its two siblings, which all emit the
        // same rule. Without it the assertion above cannot tell which of the three fired.
        expect(rejected.error).toContain("no common containing expression");
      }
    });

    test("refusal (monomial.ts:311): composite-group-monomial-mismatch rejects a term that is present but is not a factor", () => {
      // The site the test above was reaching for, and could not reach.
      //
      // Getting here is narrower than it looks. findInnermostContainingNode and
      // extractMonomialFactorSet walk the SAME symbols, so any term inside a valid monomial is
      // normally in its factor set and this check cannot fire. My first attempt nested a term
      // under a sum, which only reached :301, because a sum is not a monomial at all.
      //
      // The one way through is CANCELLATION: extractMonomialFactorSet drops factors whose
      // exponent came out zero (monomial.ts:128), so a term appearing once in a numerator and
      // once in a denominator is present in the tree and absent from the factor set. Here t.a
      // cancels, and asking for t.a, t.x and t.d together forces the innermost containing node
      // up to the quotient, which is where the cancellation is visible.
      const root = quot(
        prod([sym("t.a", "qa"), sym("t.x", "qx")]),
        prod([sym("t.a", "qa"), sym("t.d", "qd")]),
      );

      // Accept: terms that survive with a nonzero exponent.
      const accepted = validateCompositeGroup(
        { id: "grp-ok", quantityId: "q", kind: "monomial", termIds: ["t.x", "t.d"] },
        root,
      );
      expect(accepted.ok).toBe(true);

      // Reject: t.a is in the tree twice, cancels to exponent zero, and is not a factor.
      const rejected = validateCompositeGroup(
        { id: "grp-1", quantityId: "q", kind: "monomial", termIds: ["t.a", "t.x", "t.d"] },
        root,
      );
      expect(rejected.ok).toBe(false);
      if (!rejected.ok) {
        expect(rejected.rule).toBe("composite-group-monomial-mismatch");
        // Distinguishes :311 from :290 and :301, which share the rule.
        expect(rejected.error).toContain("is not a factor of the monomial factor set");
        expect(rejected.error).toContain("t.a");
      }
    });

    test("refusal (monomial.ts:346): composite-group-invalid-kind rejects unrecognized group kind", () => {
      // Accept: valid group kind "subtree"
      const accepted = validateCompositeGroup(
        {
          id: "grp-1",
          quantityId: "q",
          kind: "subtree",
          termIds: ["t.x"],
        },
        sym("t.x", "q1"),
      );
      expect(accepted.ok).toBe(true);

      // Reject: invalid group kind
      const rejected = validateCompositeGroup(
        {
          id: "grp-1",
          quantityId: "q",
          kind: "invalid-kind" as unknown as "monomial",
          termIds: ["t.x"],
        },
        sym("t.x", "q1"),
      );
      expect(rejected.ok).toBe(false);
      if (!rejected.ok) {
        expect(rejected.rule).toBe("composite-group-invalid-kind");
      }
    });
  });
});
