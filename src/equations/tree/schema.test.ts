/**
 * Exhaustive refusal throw site coverage for src/equations/tree/schema.ts (am-muyh).
 *
 * Each refusal throw site is exercised with an explicit accept/reject pair:
 * - Reject: Asserts that invalid input throws TreeSchemaError with the exact refusal code.
 * - Accept: Asserts that valid counter-input passes validation and returns the expected result.
 *
 * Line citations (schema.ts:LINE) map 1:1 to every throw site in schema.ts.
 */

import { describe, expect, test } from "bun:test";
import {
  TreeSchemaError,
  validateAlternateForm,
  validateCompositeGroup,
  validateEquationTree,
  validateExactScale,
  validateExpressionNode,
  validateLayoutHints,
} from "./schema.ts";
import { TREE_SCHEMA_VERSION } from "./types.ts";

describe("Exact Scale Validation (schema.ts)", () => {
  test("rejects non-object scale and accepts valid scale (schema.ts:36)", () => {
    // Rejection: non-object scale
    expect(() => validateExactScale(null)).toThrow(TreeSchemaError);
    try {
      validateExactScale(null);
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-scale");
    }

    // Acceptance: valid scale object
    const valid = validateExactScale({ num: 1, den: 1 });
    expect(valid).toEqual({ num: 1, den: 1 });
  });

  test("rejects non-safe-integer scale num/den and accepts safe integers (schema.ts:43)", () => {
    // Rejection: non-integer scale values
    expect(() => validateExactScale({ num: 1.5, den: 2 })).toThrow(TreeSchemaError);
    try {
      validateExactScale({ num: 1.5, den: 2 });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-scale");
    }

    // Acceptance: safe integers
    const valid = validateExactScale({ num: 3, den: 4 });
    expect(valid).toEqual({ num: 3, den: 4 });
  });

  test("rejects non-positive scale denominator and accepts positive denominator (schema.ts:46)", () => {
    // Rejection: denominator <= 0
    expect(() => validateExactScale({ num: 1, den: 0 })).toThrow(TreeSchemaError);
    try {
      validateExactScale({ num: 1, den: 0 });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-scale-denominator");
    }

    // Acceptance: positive denominator
    const valid = validateExactScale({ num: 1, den: 2 });
    expect(valid).toEqual({ num: 1, den: 2 });
  });

  test("rejects zero scale numerator when nonzero=true and accepts zero when nonzero=false (schema.ts:53)", () => {
    // Rejection: zero numerator when nonzero required
    expect(() => validateExactScale({ num: 0, den: 1 }, "scale", true)).toThrow(TreeSchemaError);
    try {
      validateExactScale({ num: 0, den: 1 }, "scale", true);
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("zero-scale");
    }

    // Acceptance: zero numerator when nonzero=false
    const valid = validateExactScale({ num: 0, den: 1 }, "scale", false);
    expect(valid).toEqual({ num: 0, den: 1 });
  });

  test("rejects non-reduced scale fraction and accepts reduced fraction (schema.ts:69)", () => {
    // Rejection: non-coprime numerator and denominator
    expect(() => validateExactScale({ num: 2, den: 4 })).toThrow(TreeSchemaError);
    try {
      validateExactScale({ num: 2, den: 4 });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("non-reduced-scale");
    }

    // Acceptance: coprime fraction
    const valid = validateExactScale({ num: 1, den: 2 });
    expect(valid).toEqual({ num: 1, den: 2 });
  });
});

describe("Expression Node Base Validation (schema.ts)", () => {
  test("rejects non-object expression node and accepts valid object (schema.ts:81)", () => {
    // Rejection: null expression node
    expect(() => validateExpressionNode(null)).toThrow(TreeSchemaError);
    try {
      validateExpressionNode(null);
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-node");
    }

    // Acceptance: valid node object
    const valid = validateExpressionNode({ kind: "number", value: "1" });
    expect(valid).toEqual({ kind: "number", value: "1", unit: undefined });
  });

  test("rejects missing kind on expression node and accepts present kind (schema.ts:87)", () => {
    // Rejection: missing kind property
    expect(() => validateExpressionNode({})).toThrow(TreeSchemaError);
    try {
      validateExpressionNode({});
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("missing-kind");
    }

    // Acceptance: valid kind
    const valid = validateExpressionNode({ kind: "number", value: "1" });
    expect(valid.kind).toBe("number");
  });

  test("rejects empty or whitespace opId and accepts valid opId (schema.ts:92)", () => {
    // Rejection: whitespace opId
    expect(() => validateExpressionNode({ kind: "number", value: "1", opId: "   " })).toThrow(
      TreeSchemaError,
    );
    try {
      validateExpressionNode({ kind: "number", value: "1", opId: "   " });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-op-id");
    }

    // Acceptance: valid opId
    const valid = validateExpressionNode({
      kind: "sum",
      args: [
        { kind: "number", value: "1" },
        { kind: "number", value: "2" },
      ],
      opId: "eq-1.op.add",
    });
    expect(valid.opId).toBe("eq-1.op.add");
  });

  test("rejects malformed opId failing grammar and accepts valid opId (schema.ts:100)", () => {
    // Rejection: invalid opId grammar
    expect(() =>
      validateExpressionNode({ kind: "number", value: "1", opId: "not-an-op-id" }),
    ).toThrow(TreeSchemaError);
    try {
      validateExpressionNode({ kind: "number", value: "1", opId: "not-an-op-id" });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-op-id");
    }

    // Acceptance: valid opId
    const valid = validateExpressionNode({
      kind: "sum",
      args: [
        { kind: "number", value: "1" },
        { kind: "number", value: "2" },
      ],
      opId: "eq-1.op.add",
    });
    expect(valid.opId).toBe("eq-1.op.add");
  });
});

describe("Symbol, Constant, Number Node Validation (schema.ts)", () => {
  test("rejects missing symbol termId and accepts valid termId (schema.ts:107)", () => {
    // Rejection: missing or empty termId
    expect(() =>
      validateExpressionNode({ kind: "symbol", termId: "", quantityId: "mass" }),
    ).toThrow(TreeSchemaError);
    try {
      validateExpressionNode({ kind: "symbol", termId: "", quantityId: "mass" });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("missing-term-id");
    }

    // Acceptance: valid symbol termId
    const valid = validateExpressionNode({
      kind: "symbol",
      termId: "eq-1.t.m",
      quantityId: "mass",
    });
    expect(valid.kind).toBe("symbol");
  });

  test("rejects invalid symbol termId failing grammar and accepts valid termId (schema.ts:115)", () => {
    // Rejection: malformed termId
    expect(() =>
      validateExpressionNode({ kind: "symbol", termId: "bad_term_id", quantityId: "mass" }),
    ).toThrow(TreeSchemaError);
    try {
      validateExpressionNode({ kind: "symbol", termId: "bad_term_id", quantityId: "mass" });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-term-id");
    }

    // Acceptance: valid termId
    const valid = validateExpressionNode({
      kind: "symbol",
      termId: "eq-1.t.m",
      quantityId: "mass",
    });
    expect(valid.kind).toBe("symbol");
  });

  test("rejects missing symbol quantityId and accepts valid quantityId (schema.ts:118)", () => {
    // Rejection: missing quantityId
    expect(() =>
      validateExpressionNode({ kind: "symbol", termId: "eq-1.t.m", quantityId: "  " }),
    ).toThrow(TreeSchemaError);
    try {
      validateExpressionNode({ kind: "symbol", termId: "eq-1.t.m", quantityId: "  " });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("missing-quantity-id");
    }

    // Acceptance: valid quantityId
    const valid = validateExpressionNode({
      kind: "symbol",
      termId: "eq-1.t.m",
      quantityId: "mass",
    });
    expect(valid.kind).toBe("symbol");
  });

  test("rejects missing constant name and accepts valid name (schema.ts:139)", () => {
    // Rejection: missing name on constant
    expect(() => validateExpressionNode({ kind: "constant", name: "  " })).toThrow(TreeSchemaError);
    try {
      validateExpressionNode({ kind: "constant", name: "  " });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("missing-constant-name");
    }

    // Acceptance: valid constant
    const valid = validateExpressionNode({ kind: "constant", name: "c" });
    expect(valid).toEqual({ kind: "constant", name: "c" });
  });

  test("rejects missing number value and accepts valid value (schema.ts:149)", () => {
    // Rejection: missing value on number
    expect(() => validateExpressionNode({ kind: "number", value: "  " })).toThrow(TreeSchemaError);
    try {
      validateExpressionNode({ kind: "number", value: "  " });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("missing-number-value");
    }

    // Acceptance: valid number node
    const valid = validateExpressionNode({ kind: "number", value: "42" });
    expect(valid).toEqual({ kind: "number", value: "42", unit: undefined });
  });

  test("rejects invalid decimal string in number node and accepts valid decimal (schema.ts:156)", () => {
    // Rejection: invalid decimal string
    expect(() => validateExpressionNode({ kind: "number", value: "1.2.3" })).toThrow(
      TreeSchemaError,
    );
    try {
      validateExpressionNode({ kind: "number", value: "1.2.3" });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-number-value");
    }

    // Acceptance: valid decimal notation
    const valid = validateExpressionNode({ kind: "number", value: "-3.14e10" });
    expect(valid).toEqual({ kind: "number", value: "-3.14e10", unit: undefined });
  });
});

describe("Arithmetic Node Validation (schema.ts)", () => {
  test("rejects sum with fewer than 2 arguments and accepts >= 2 arguments (schema.ts:170)", () => {
    // Rejection: sum with 1 argument
    expect(() =>
      validateExpressionNode({
        kind: "sum",
        args: [{ kind: "number", value: "1" }],
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateExpressionNode({
        kind: "sum",
        args: [{ kind: "number", value: "1" }],
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-args");
    }

    // Acceptance: sum with 2 arguments
    const valid = validateExpressionNode({
      kind: "sum",
      args: [
        { kind: "number", value: "1" },
        { kind: "number", value: "2" },
      ],
    });
    expect(valid.kind).toBe("sum");
  });

  test("rejects product with fewer than 2 arguments and accepts >= 2 arguments (schema.ts:185)", () => {
    // Rejection: product with empty args
    expect(() => validateExpressionNode({ kind: "product", args: [] })).toThrow(TreeSchemaError);
    try {
      validateExpressionNode({ kind: "product", args: [] });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-args");
    }

    // Acceptance: product with 2 arguments
    const valid = validateExpressionNode({
      kind: "product",
      args: [
        { kind: "number", value: "2" },
        { kind: "number", value: "3" },
      ],
    });
    expect(valid.kind).toBe("product");
  });

  test("rejects quotient missing numerator or denominator and accepts both (schema.ts:201)", () => {
    // Rejection: missing denominator
    expect(() =>
      validateExpressionNode({
        kind: "quotient",
        numerator: { kind: "number", value: "1" },
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateExpressionNode({
        kind: "quotient",
        numerator: { kind: "number", value: "1" },
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-quotient");
    }

    // Acceptance: quotient with numerator and denominator
    const valid = validateExpressionNode({
      kind: "quotient",
      numerator: { kind: "number", value: "1" },
      denominator: { kind: "number", value: "2" },
    });
    expect(valid.kind).toBe("quotient");
  });

  test("rejects power missing base or exponent and accepts both (schema.ts:217)", () => {
    // Rejection: missing exponent
    expect(() =>
      validateExpressionNode({
        kind: "power",
        base: { kind: "number", value: "2" },
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateExpressionNode({
        kind: "power",
        base: { kind: "number", value: "2" },
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-power");
    }

    // Acceptance: power with base and exponent
    const valid = validateExpressionNode({
      kind: "power",
      base: { kind: "number", value: "2" },
      exponent: { kind: "number", value: "3" },
    });
    expect(valid.kind).toBe("power");
  });

  test("rejects root missing radicand and accepts valid radicand (schema.ts:241)", () => {
    // Rejection: root missing radicand
    expect(() => validateExpressionNode({ kind: "root" })).toThrow(TreeSchemaError);
    try {
      validateExpressionNode({ kind: "root" });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-root");
    }

    // Acceptance: root with radicand
    const valid = validateExpressionNode({
      kind: "root",
      radicand: { kind: "number", value: "4" },
    });
    expect(valid.kind).toBe("root");
  });

  test("rejects root with degree < 2 and accepts degree >= 2 (schema.ts:245)", () => {
    // Rejection: degree = 1
    expect(() =>
      validateExpressionNode({
        kind: "root",
        radicand: { kind: "number", value: "4" },
        degree: 1,
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateExpressionNode({
        kind: "root",
        radicand: { kind: "number", value: "4" },
        degree: 1,
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-degree");
    }

    // Acceptance: degree = 3
    const valid = validateExpressionNode({
      kind: "root",
      radicand: { kind: "number", value: "8" },
      degree: 3,
    });
    expect(valid.kind).toBe("root");
  });

  test("rejects unary operation missing argument and accepts present argument (schema.ts:263)", () => {
    // Rejection: negate missing argument
    expect(() => validateExpressionNode({ kind: "negate" })).toThrow(TreeSchemaError);
    try {
      validateExpressionNode({ kind: "negate" });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-argument");
    }

    // Acceptance: negate with argument
    const valid = validateExpressionNode({
      kind: "negate",
      argument: { kind: "number", value: "1" },
    });
    expect(valid.kind).toBe("negate");
  });
});

describe("Functions and Relations Validation (schema.ts)", () => {
  test("rejects function with unallowed name and accepts allowed name (schema.ts:278)", () => {
    // Rejection: unallowed function name
    expect(() =>
      validateExpressionNode({
        kind: "function",
        name: "unsupportedFn",
        argument: { kind: "number", value: "1" },
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateExpressionNode({
        kind: "function",
        name: "unsupportedFn",
        argument: { kind: "number", value: "1" },
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-function-name");
    }

    // Acceptance: allowed function name
    const valid = validateExpressionNode({
      kind: "function",
      name: "sin",
      argument: { kind: "number", value: "1" },
    });
    expect(valid.kind).toBe("function");
  });

  test("rejects function missing argument and accepts present argument (schema.ts:285)", () => {
    // Rejection: function missing argument
    expect(() => validateExpressionNode({ kind: "function", name: "exp" })).toThrow(
      TreeSchemaError,
    );
    try {
      validateExpressionNode({ kind: "function", name: "exp" });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("missing-argument");
    }

    // Acceptance: function with argument
    const valid = validateExpressionNode({
      kind: "function",
      name: "exp",
      argument: { kind: "number", value: "1" },
    });
    expect(valid.kind).toBe("function");
  });

  test("rejects relation with unallowed operator and accepts allowed operator (schema.ts:316)", () => {
    // Rejection: unallowed operator
    expect(() =>
      validateExpressionNode({
        kind: "relation",
        operator: "!=",
        left: { kind: "number", value: "1" },
        right: { kind: "number", value: "1" },
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateExpressionNode({
        kind: "relation",
        operator: "!=",
        left: { kind: "number", value: "1" },
        right: { kind: "number", value: "1" },
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-relation-operator");
    }

    // Acceptance: allowed operator
    const valid = validateExpressionNode({
      kind: "relation",
      operator: "=",
      left: { kind: "number", value: "1" },
      right: { kind: "number", value: "1" },
    });
    expect(valid.kind).toBe("relation");
  });

  test("rejects relation missing left or right side and accepts both sides (schema.ts:323)", () => {
    // Rejection: missing right side
    expect(() =>
      validateExpressionNode({
        kind: "relation",
        operator: "=",
        left: { kind: "number", value: "1" },
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateExpressionNode({
        kind: "relation",
        operator: "=",
        left: { kind: "number", value: "1" },
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-relation");
    }

    // Acceptance: both left and right sides
    const valid = validateExpressionNode({
      kind: "relation",
      operator: "=",
      left: { kind: "number", value: "1" },
      right: { kind: "number", value: "1" },
    });
    expect(valid.kind).toBe("relation");
  });
});

describe("Calculus, Series, Vectors, Matrices (schema.ts)", () => {
  test("rejects derivative missing expression or variable and accepts both (schema.ts:343)", () => {
    // Rejection: missing variable
    expect(() =>
      validateExpressionNode({
        kind: "derivative",
        expression: { kind: "number", value: "1" },
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateExpressionNode({
        kind: "derivative",
        expression: { kind: "number", value: "1" },
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-derivative");
    }

    // Acceptance: expression and variable
    const valid = validateExpressionNode({
      kind: "derivative",
      expression: { kind: "number", value: "1" },
      variable: { kind: "symbol", termId: "eq-1.t.x", quantityId: "position" },
    });
    expect(valid.kind).toBe("derivative");
  });

  test("rejects derivative with order out of range 1-8 and accepts valid order (schema.ts:351)", () => {
    // Rejection: order = 9
    expect(() =>
      validateExpressionNode({
        kind: "derivative",
        expression: { kind: "number", value: "1" },
        variable: { kind: "symbol", termId: "eq-1.t.x", quantityId: "position" },
        order: 9,
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateExpressionNode({
        kind: "derivative",
        expression: { kind: "number", value: "1" },
        variable: { kind: "symbol", termId: "eq-1.t.x", quantityId: "position" },
        order: 9,
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-order");
    }

    // Acceptance: order = 2
    const valid = validateExpressionNode({
      kind: "derivative",
      expression: { kind: "number", value: "1" },
      variable: { kind: "symbol", termId: "eq-1.t.x", quantityId: "position" },
      order: 2,
    });
    expect(valid.kind).toBe("derivative");
  });

  test("rejects integral missing expression or variable and accepts both (schema.ts:374)", () => {
    // Rejection: missing variable
    expect(() =>
      validateExpressionNode({
        kind: "integral",
        expression: { kind: "number", value: "1" },
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateExpressionNode({
        kind: "integral",
        expression: { kind: "number", value: "1" },
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-integral");
    }

    // Acceptance: expression and variable
    const valid = validateExpressionNode({
      kind: "integral",
      expression: { kind: "number", value: "1" },
      variable: { kind: "symbol", termId: "eq-1.t.x", quantityId: "position" },
    });
    expect(valid.kind).toBe("integral");
  });

  test("rejects seriesSum missing index or body and accepts both (schema.ts:396)", () => {
    // Rejection: missing body
    expect(() =>
      validateExpressionNode({
        kind: "seriesSum",
        index: "n",
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateExpressionNode({
        kind: "seriesSum",
        index: "n",
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-series");
    }

    // Acceptance: index and body
    const valid = validateExpressionNode({
      kind: "seriesSum",
      index: "n",
      body: { kind: "number", value: "1" },
    });
    expect(valid.kind).toBe("seriesSum");
  });

  test("rejects limit missing variable, target, or body and accepts all three (schema.ts:416)", () => {
    // Rejection: missing target and body
    expect(() =>
      validateExpressionNode({
        kind: "limit",
        variable: { kind: "symbol", termId: "eq-1.t.x", quantityId: "position" },
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateExpressionNode({
        kind: "limit",
        variable: { kind: "symbol", termId: "eq-1.t.x", quantityId: "position" },
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-limit");
    }

    // Acceptance: variable, target, and body
    const valid = validateExpressionNode({
      kind: "limit",
      variable: { kind: "symbol", termId: "eq-1.t.x", quantityId: "position" },
      target: { kind: "number", value: "0" },
      body: { kind: "number", value: "1" },
    });
    expect(valid.kind).toBe("limit");
  });

  test("rejects dotProduct missing left or right operand and accepts both (schema.ts:433)", () => {
    // Rejection: missing right operand
    expect(() =>
      validateExpressionNode({
        kind: "dotProduct",
        left: { kind: "number", value: "1" },
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateExpressionNode({
        kind: "dotProduct",
        left: { kind: "number", value: "1" },
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-product");
    }

    // Acceptance: left and right operands
    const valid = validateExpressionNode({
      kind: "dotProduct",
      left: { kind: "number", value: "1" },
      right: { kind: "number", value: "2" },
    });
    expect(valid.kind).toBe("dotProduct");
  });

  test("rejects vector with non-array elements and accepts array elements (schema.ts:448)", () => {
    // Rejection: elements is not an array
    expect(() =>
      validateExpressionNode({
        kind: "vector",
        elements: "invalid",
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateExpressionNode({
        kind: "vector",
        elements: "invalid",
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-vector");
    }

    // Acceptance: array elements
    const valid = validateExpressionNode({
      kind: "vector",
      elements: [{ kind: "number", value: "1" }],
    });
    expect(valid.kind).toBe("vector");
  });

  test("rejects matrix with empty rows array and accepts non-empty rows (schema.ts:462)", () => {
    // Rejection: empty rows array
    expect(() =>
      validateExpressionNode({
        kind: "matrix",
        rows: [],
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateExpressionNode({
        kind: "matrix",
        rows: [],
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-matrix");
    }

    // Acceptance: non-empty rows array
    const valid = validateExpressionNode({
      kind: "matrix",
      rows: [[{ kind: "number", value: "1" }]],
    });
    expect(valid.kind).toBe("matrix");
  });

  test("rejects matrix with empty first row and accepts non-empty first row (schema.ts:470)", () => {
    // Rejection: rows[0] is empty
    expect(() =>
      validateExpressionNode({
        kind: "matrix",
        rows: [[]],
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateExpressionNode({
        kind: "matrix",
        rows: [[]],
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-matrix");
    }

    // Acceptance: rows[0] is non-empty
    const valid = validateExpressionNode({
      kind: "matrix",
      rows: [[{ kind: "number", value: "1" }]],
    });
    expect(valid.kind).toBe("matrix");
  });

  test("rejects ragged matrix with uneven row lengths and accepts rectangular matrix (schema.ts:478)", () => {
    // Rejection: ragged row lengths (row 0 has 1 cell, row 1 has 2 cells)
    expect(() =>
      validateExpressionNode({
        kind: "matrix",
        rows: [
          [{ kind: "number", value: "1" }],
          [
            { kind: "number", value: "2" },
            { kind: "number", value: "3" },
          ],
        ],
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateExpressionNode({
        kind: "matrix",
        rows: [
          [{ kind: "number", value: "1" }],
          [
            { kind: "number", value: "2" },
            { kind: "number", value: "3" },
          ],
        ],
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("ragged-matrix");
    }

    // Acceptance: uniform rectangular rows
    const valid = validateExpressionNode({
      kind: "matrix",
      rows: [
        [
          { kind: "number", value: "1" },
          { kind: "number", value: "2" },
        ],
        [
          { kind: "number", value: "3" },
          { kind: "number", value: "4" },
        ],
      ],
    });
    expect(valid.kind).toBe("matrix");
  });

  test("rejects piecewise with empty cases array and accepts non-empty cases (schema.ts:495)", () => {
    // Rejection: empty cases array
    expect(() =>
      validateExpressionNode({
        kind: "piecewise",
        cases: [],
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateExpressionNode({
        kind: "piecewise",
        cases: [],
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-piecewise");
    }

    // Acceptance: non-empty cases
    const valid = validateExpressionNode({
      kind: "piecewise",
      cases: [
        {
          condition: { kind: "number", value: "1" },
          value: { kind: "number", value: "2" },
        },
      ],
    });
    expect(valid.kind).toBe("piecewise");
  });

  test("rejects piecewise case missing condition or value and accepts complete case (schema.ts:503)", () => {
    // Rejection: missing value property
    expect(() =>
      validateExpressionNode({
        kind: "piecewise",
        cases: [{ condition: { kind: "number", value: "1" } }],
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateExpressionNode({
        kind: "piecewise",
        cases: [{ condition: { kind: "number", value: "1" } }],
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-case");
    }

    // Acceptance: case with condition and value
    const valid = validateExpressionNode({
      kind: "piecewise",
      cases: [
        {
          condition: { kind: "number", value: "1" },
          value: { kind: "number", value: "2" },
        },
      ],
    });
    expect(valid.kind).toBe("piecewise");
  });

  test("rejects textAnnotation missing text field and accepts present text (schema.ts:538)", () => {
    // Rejection: missing text field
    expect(() =>
      validateExpressionNode({
        kind: "textAnnotation",
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateExpressionNode({
        kind: "textAnnotation",
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("missing-text");
    }

    // Acceptance: present text string
    const valid = validateExpressionNode({
      kind: "textAnnotation",
      text: "note",
    });
    expect(valid.kind).toBe("textAnnotation");
  });

  test("rejects unknown node kind and accepts known kind (schema.ts:551)", () => {
    // Rejection: unknown node kind
    expect(() =>
      validateExpressionNode({
        kind: "completelyUnknownKind",
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateExpressionNode({
        kind: "completelyUnknownKind",
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("unknown-node-kind");
    }

    // Acceptance: known kind
    const valid = validateExpressionNode({
      kind: "number",
      value: "1",
    });
    expect(valid.kind).toBe("number");
  });
});

describe("Layout Hints Validation (schema.ts)", () => {
  test("rejects non-object layout hints and accepts valid object (schema.ts:561)", () => {
    // Rejection: null layout hints
    expect(() => validateLayoutHints(null)).toThrow(TreeSchemaError);
    try {
      validateLayoutHints(null);
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-layout");
    }

    // Acceptance: valid layout hints
    const valid = validateLayoutHints({ breaks: ["b1"] });
    expect(valid.breaks).toEqual(["b1"]);
  });

  test("rejects non-string break id in breaks array and accepts string break id (schema.ts:567)", () => {
    // Rejection: non-string break id
    expect(() => validateLayoutHints({ breaks: [123] })).toThrow(TreeSchemaError);
    try {
      validateLayoutHints({ breaks: [123] });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-break-id");
    }

    // Acceptance: string break id
    const valid = validateLayoutHints({ breaks: ["b1"] });
    expect(valid.breaks).toEqual(["b1"]);
  });

  test("rejects non-string align id in alignAt array and accepts string align id (schema.ts:579)", () => {
    // Rejection: non-string alignAt id
    expect(() => validateLayoutHints({ alignAt: [true] })).toThrow(TreeSchemaError);
    try {
      validateLayoutHints({ alignAt: [true] });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-align-id");
    }

    // Acceptance: string align id
    const valid = validateLayoutHints({ alignAt: ["a1"] });
    expect(valid.alignAt).toEqual(["a1"]);
  });
});

describe("Composite Group Validation (schema.ts)", () => {
  test("rejects non-object composite group and accepts valid object (schema.ts:593)", () => {
    // Rejection: null composite group
    expect(() => validateCompositeGroup(null)).toThrow(TreeSchemaError);
    try {
      validateCompositeGroup(null);
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-group");
    }

    // Acceptance: valid composite group
    const valid = validateCompositeGroup({
      id: "group-1",
      memberTermIds: ["eq-1.t.a", "eq-1.t.b"],
      quantityId: "mass",
    });
    expect(valid.id).toBe("group-1");
  });

  test("rejects missing or whitespace group id and accepts valid id (schema.ts:597)", () => {
    // Rejection: empty group id
    expect(() =>
      validateCompositeGroup({
        id: "  ",
        memberTermIds: ["eq-1.t.a", "eq-1.t.b"],
        quantityId: "mass",
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateCompositeGroup({
        id: "  ",
        memberTermIds: ["eq-1.t.a", "eq-1.t.b"],
        quantityId: "mass",
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("missing-group-id");
    }

    // Acceptance: valid group id
    const valid = validateCompositeGroup({
      id: "group-1",
      memberTermIds: ["eq-1.t.a", "eq-1.t.b"],
      quantityId: "mass",
    });
    expect(valid.id).toBe("group-1");
  });

  test("rejects memberTermIds with fewer than 2 elements and accepts >= 2 members (schema.ts:604)", () => {
    // Rejection: memberTermIds length < 2
    expect(() =>
      validateCompositeGroup({
        id: "group-1",
        memberTermIds: ["eq-1.t.a"],
        quantityId: "mass",
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateCompositeGroup({
        id: "group-1",
        memberTermIds: ["eq-1.t.a"],
        quantityId: "mass",
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-group-members");
    }

    // Acceptance: 2 members
    const valid = validateCompositeGroup({
      id: "group-1",
      memberTermIds: ["eq-1.t.a", "eq-1.t.b"],
      quantityId: "mass",
    });
    expect(valid.memberTermIds.length).toBe(2);
  });

  test("rejects non-string or whitespace member term id and accepts valid member id (schema.ts:612)", () => {
    // Rejection: whitespace member id
    expect(() =>
      validateCompositeGroup({
        id: "group-1",
        memberTermIds: ["eq-1.t.a", "  "],
        quantityId: "mass",
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateCompositeGroup({
        id: "group-1",
        memberTermIds: ["eq-1.t.a", "  "],
        quantityId: "mass",
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-group-member");
    }

    // Acceptance: valid member ids
    const valid = validateCompositeGroup({
      id: "group-1",
      memberTermIds: ["eq-1.t.a", "eq-1.t.b"],
      quantityId: "mass",
    });
    expect(valid.memberTermIds).toEqual(["eq-1.t.a", "eq-1.t.b"]);
  });

  test("rejects missing or whitespace group quantityId and accepts valid quantityId (schema.ts:620)", () => {
    // Rejection: empty quantityId
    expect(() =>
      validateCompositeGroup({
        id: "group-1",
        memberTermIds: ["eq-1.t.a", "eq-1.t.b"],
        quantityId: "  ",
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateCompositeGroup({
        id: "group-1",
        memberTermIds: ["eq-1.t.a", "eq-1.t.b"],
        quantityId: "  ",
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("missing-group-quantity-id");
    }

    // Acceptance: valid quantityId
    const valid = validateCompositeGroup({
      id: "group-1",
      memberTermIds: ["eq-1.t.a", "eq-1.t.b"],
      quantityId: "mass",
    });
    expect(valid.quantityId).toBe("mass");
  });
});

describe("Alternate Form Validation (schema.ts)", () => {
  test("rejects non-object alternate form and accepts valid object (schema.ts:638)", () => {
    // Rejection: null alternate form
    expect(() => validateAlternateForm(null)).toThrow(TreeSchemaError);
    try {
      validateAlternateForm(null);
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-alternate-form");
    }

    // Acceptance: valid alternate form
    const valid = validateAlternateForm({
      id: "eq-1.alt.cgs",
      relation: "unit-conversion",
      label: "CGS",
      tree: { kind: "number", value: "1" },
      unitSystem: { from: "SI", to: "CGS" },
      derivationChainId: "chain-1",
    });
    expect(valid.id).toBe("eq-1.alt.cgs");
  });

  test("rejects missing or whitespace alternate form id and accepts valid id (schema.ts:642)", () => {
    // Rejection: empty id
    expect(() =>
      validateAlternateForm({
        id: "  ",
        relation: "unit-conversion",
        label: "CGS",
        tree: { kind: "number", value: "1" },
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateAlternateForm({
        id: "  ",
        relation: "unit-conversion",
        label: "CGS",
        tree: { kind: "number", value: "1" },
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("missing-id");
    }

    // Acceptance: valid id
    const valid = validateAlternateForm({
      id: "eq-1.alt.cgs",
      relation: "unit-conversion",
      label: "CGS",
      tree: { kind: "number", value: "1" },
      unitSystem: { from: "SI", to: "CGS" },
      derivationChainId: "chain-1",
    });
    expect(valid.id).toBe("eq-1.alt.cgs");
  });

  test("rejects invalid alternate form id grammar and accepts valid id (schema.ts:646)", () => {
    // Rejection: malformed alternate form id
    expect(() =>
      validateAlternateForm({
        id: "bad_alternate_form_id",
        relation: "unit-conversion",
        label: "CGS",
        tree: { kind: "number", value: "1" },
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateAlternateForm({
        id: "bad_alternate_form_id",
        relation: "unit-conversion",
        label: "CGS",
        tree: { kind: "number", value: "1" },
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-alternate-id");
    }

    // Acceptance: valid id
    const valid = validateAlternateForm({
      id: "eq-1.alt.cgs",
      relation: "unit-conversion",
      label: "CGS",
      tree: { kind: "number", value: "1" },
      unitSystem: { from: "SI", to: "CGS" },
      derivationChainId: "chain-1",
    });
    expect(valid.id).toBe("eq-1.alt.cgs");
  });

  test("rejects unallowed alternate relation and accepts allowed relation (schema.ts:650)", () => {
    // Rejection: unallowed relation
    expect(() =>
      validateAlternateForm({
        id: "eq-1.alt.cgs",
        relation: "invalid-relation",
        label: "CGS",
        tree: { kind: "number", value: "1" },
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateAlternateForm({
        id: "eq-1.alt.cgs",
        relation: "invalid-relation",
        label: "CGS",
        tree: { kind: "number", value: "1" },
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-alternate-relation");
    }

    // Acceptance: unit-conversion relation
    const valid = validateAlternateForm({
      id: "eq-1.alt.cgs",
      relation: "unit-conversion",
      label: "CGS",
      tree: { kind: "number", value: "1" },
      unitSystem: { from: "SI", to: "CGS" },
      derivationChainId: "chain-1",
    });
    expect(valid.relation).toBe("unit-conversion");
  });

  test("rejects missing or whitespace alternate form label and accepts present label (schema.ts:658)", () => {
    // Rejection: empty label
    expect(() =>
      validateAlternateForm({
        id: "eq-1.alt.cgs",
        relation: "unit-conversion",
        label: "  ",
        tree: { kind: "number", value: "1" },
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateAlternateForm({
        id: "eq-1.alt.cgs",
        relation: "unit-conversion",
        label: "  ",
        tree: { kind: "number", value: "1" },
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("missing-label");
    }

    // Acceptance: present label
    const valid = validateAlternateForm({
      id: "eq-1.alt.cgs",
      relation: "unit-conversion",
      label: "CGS Form",
      tree: { kind: "number", value: "1" },
      unitSystem: { from: "SI", to: "CGS" },
      derivationChainId: "chain-1",
    });
    expect(valid.label).toBe("CGS Form");
  });

  test("rejects alternate form missing tree and accepts present tree (schema.ts:666)", () => {
    // Rejection: missing tree
    expect(() =>
      validateAlternateForm({
        id: "eq-1.alt.cgs",
        relation: "unit-conversion",
        label: "CGS",
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateAlternateForm({
        id: "eq-1.alt.cgs",
        relation: "unit-conversion",
        label: "CGS",
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("missing-tree");
    }

    // Acceptance: present tree
    const valid = validateAlternateForm({
      id: "eq-1.alt.cgs",
      relation: "unit-conversion",
      label: "CGS",
      tree: { kind: "number", value: "1" },
      unitSystem: { from: "SI", to: "CGS" },
      derivationChainId: "chain-1",
    });
    expect(valid.tree.kind).toBe("number");
  });

  test("rejects unit-conversion missing unitSystem and accepts present unitSystem (schema.ts:676)", () => {
    // Rejection: missing unitSystem
    expect(() =>
      validateAlternateForm({
        id: "eq-1.alt.cgs",
        relation: "unit-conversion",
        label: "CGS",
        tree: { kind: "number", value: "1" },
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateAlternateForm({
        id: "eq-1.alt.cgs",
        relation: "unit-conversion",
        label: "CGS",
        tree: { kind: "number", value: "1" },
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("missing-unit-system");
    }

    // Acceptance: present unitSystem
    const valid = validateAlternateForm({
      id: "eq-1.alt.cgs",
      relation: "unit-conversion",
      label: "CGS",
      tree: { kind: "number", value: "1" },
      unitSystem: { from: "SI", to: "CGS" },
      derivationChainId: "chain-1",
    });
    expect(valid.unitSystem).toEqual({ from: "SI", to: "CGS" });
  });

  test("rejects unitSystem with non-string from/to fields and accepts string fields (schema.ts:684)", () => {
    // Rejection: non-string unitSystem fields
    expect(() =>
      validateAlternateForm({
        id: "eq-1.alt.cgs",
        relation: "unit-conversion",
        label: "CGS",
        tree: { kind: "number", value: "1" },
        unitSystem: { from: 10, to: 20 },
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateAlternateForm({
        id: "eq-1.alt.cgs",
        relation: "unit-conversion",
        label: "CGS",
        tree: { kind: "number", value: "1" },
        unitSystem: { from: 10, to: 20 },
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-unit-system");
    }

    // Acceptance: string fields
    const valid = validateAlternateForm({
      id: "eq-1.alt.cgs",
      relation: "unit-conversion",
      label: "CGS",
      tree: { kind: "number", value: "1" },
      unitSystem: { from: "SI", to: "CGS" },
      derivationChainId: "chain-1",
    });
    expect(valid.unitSystem).toEqual({ from: "SI", to: "CGS" });
  });

  test("rejects unit-conversion missing derivationChainId and accepts present derivationChainId (schema.ts:691)", () => {
    // Rejection: missing derivationChainId
    expect(() =>
      validateAlternateForm({
        id: "eq-1.alt.cgs",
        relation: "unit-conversion",
        label: "CGS",
        tree: { kind: "number", value: "1" },
        unitSystem: { from: "SI", to: "CGS" },
        derivationChainId: "  ",
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateAlternateForm({
        id: "eq-1.alt.cgs",
        relation: "unit-conversion",
        label: "CGS",
        tree: { kind: "number", value: "1" },
        unitSystem: { from: "SI", to: "CGS" },
        derivationChainId: "  ",
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("missing-derivation-chain-id");
    }

    // Acceptance: present derivationChainId
    const valid = validateAlternateForm({
      id: "eq-1.alt.cgs",
      relation: "unit-conversion",
      label: "CGS",
      tree: { kind: "number", value: "1" },
      unitSystem: { from: "SI", to: "CGS" },
      derivationChainId: "chain-1",
    });
    expect(valid.derivationChainId).toBe("chain-1");
  });

  test("rejects modernization missing modernLensId and accepts present modernLensId (schema.ts:701)", () => {
    // Rejection: missing modernLensId
    expect(() =>
      validateAlternateForm({
        id: "eq-1.alt.mod",
        relation: "modernization",
        label: "Modern",
        tree: { kind: "number", value: "1" },
        modernLensId: "  ",
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateAlternateForm({
        id: "eq-1.alt.mod",
        relation: "modernization",
        label: "Modern",
        tree: { kind: "number", value: "1" },
        modernLensId: "  ",
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("missing-modern-lens-id");
    }

    // Acceptance: present modernLensId
    const valid = validateAlternateForm({
      id: "eq-1.alt.mod",
      relation: "modernization",
      label: "Modern",
      tree: { kind: "number", value: "1" },
      modernLensId: "lens-1",
      historicalStatus: "later-development",
    });
    expect(valid.modernLensId).toBe("lens-1");
  });

  test("rejects modernization with invalid historicalStatus and accepts later-development (schema.ts:708)", () => {
    // Rejection: historicalStatus !== 'later-development'
    expect(() =>
      validateAlternateForm({
        id: "eq-1.alt.mod",
        relation: "modernization",
        label: "Modern",
        tree: { kind: "number", value: "1" },
        modernLensId: "lens-1",
        historicalStatus: "contemporary",
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateAlternateForm({
        id: "eq-1.alt.mod",
        relation: "modernization",
        label: "Modern",
        tree: { kind: "number", value: "1" },
        modernLensId: "lens-1",
        historicalStatus: "contemporary",
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-historical-status");
    }

    // Acceptance: historicalStatus = 'later-development'
    const valid = validateAlternateForm({
      id: "eq-1.alt.mod",
      relation: "modernization",
      label: "Modern",
      tree: { kind: "number", value: "1" },
      modernLensId: "lens-1",
      historicalStatus: "later-development",
    });
    expect(valid.historicalStatus).toBe("later-development");
  });
});

describe("Equation Tree Record Validation (schema.ts)", () => {
  test("rejects non-object equation tree and accepts valid tree object (schema.ts:730)", () => {
    // Rejection: null equation tree
    expect(() => validateEquationTree(null)).toThrow(TreeSchemaError);
    try {
      validateEquationTree(null);
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("invalid-tree-record");
    }

    // Acceptance: valid equation tree object
    const valid = validateEquationTree({
      treeSchemaVersion: TREE_SCHEMA_VERSION,
      root: { kind: "number", value: "1" },
    });
    expect(valid.treeSchemaVersion).toBe(TREE_SCHEMA_VERSION);
  });

  test("rejects unsupported schema version and accepts current TREE_SCHEMA_VERSION (schema.ts:739)", () => {
    // Rejection: treeSchemaVersion = 99
    expect(() =>
      validateEquationTree({
        treeSchemaVersion: 99,
        root: { kind: "number", value: "1" },
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateEquationTree({
        treeSchemaVersion: 99,
        root: { kind: "number", value: "1" },
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("unsupported-schema-version");
    }

    // Acceptance: treeSchemaVersion = 1
    const valid = validateEquationTree({
      treeSchemaVersion: 1,
      root: { kind: "number", value: "1" },
    });
    expect(valid.treeSchemaVersion).toBe(1);
  });

  test("rejects equation tree missing root expression and accepts present root (schema.ts:747)", () => {
    // Rejection: missing root expression
    expect(() =>
      validateEquationTree({
        treeSchemaVersion: TREE_SCHEMA_VERSION,
      }),
    ).toThrow(TreeSchemaError);
    try {
      validateEquationTree({
        treeSchemaVersion: TREE_SCHEMA_VERSION,
      });
    } catch (err) {
      expect(err instanceof TreeSchemaError).toBe(true);
      expect((err as TreeSchemaError).code).toBe("missing-root");
    }

    // Acceptance: present root
    const valid = validateEquationTree({
      treeSchemaVersion: TREE_SCHEMA_VERSION,
      root: { kind: "number", value: "1" },
    });
    expect(valid.root.kind).toBe("number");
  });
});
