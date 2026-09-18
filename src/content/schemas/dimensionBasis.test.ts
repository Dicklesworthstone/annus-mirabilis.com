import { describe, test } from "bun:test";
import assert from "node:assert/strict";
import {
  DimensionSchemaError,
  validateRationalDimension,
  validateRationalScale,
} from "./dimensionBasis.ts";

describe("dimensionBasis schema refusal throw sites (am-muyh)", () => {
  test("dimensionBasis: (dimensionBasis.ts:60) invalid-rational raised when scale is not an object", () => {
    assert.throws(
      () => validateRationalScale(null),
      (err) => {
        assert.ok(err instanceof DimensionSchemaError);
        assert.equal(err.code, "invalid-rational");
        return true;
      },
    );

    // Accept valid rational scale
    const accepted = validateRationalScale({ num: 1, den: 2 });
    assert.deepEqual(accepted, { num: 1, den: 2 });
  });

  test("dimensionBasis: (dimensionBasis.ts:68) invalid-numerator raised when numerator is non-integer", () => {
    assert.throws(
      () => validateRationalScale({ num: 1.5, den: 2 }),
      (err) => {
        assert.ok(err instanceof DimensionSchemaError);
        assert.equal(err.code, "invalid-numerator");
        return true;
      },
    );

    // Accept integer numerator
    const accepted = validateRationalScale({ num: 3, den: 4 });
    assert.equal(accepted.num, 3);
  });

  test("dimensionBasis: (dimensionBasis.ts:76) invalid-denominator raised when denominator is non-integer", () => {
    assert.throws(
      () => validateRationalScale({ num: 1, den: 2.5 }),
      (err) => {
        assert.ok(err instanceof DimensionSchemaError);
        assert.equal(err.code, "invalid-denominator");
        return true;
      },
    );
  });

  test("dimensionBasis: (dimensionBasis.ts:82) invalid-denominator raised when denominator is zero", () => {
    assert.throws(
      () => validateRationalScale({ num: 1, den: 0 }),
      (err) => {
        assert.ok(err instanceof DimensionSchemaError);
        assert.equal(err.code, "invalid-denominator");
        assert.match(err.message, /cannot be zero/);
        return true;
      },
    );

    // Accept non-zero denominator
    const accepted = validateRationalScale({ num: 1, den: 1 });
    assert.equal(accepted.den, 1);
  });

  test("dimensionBasis: (dimensionBasis.ts:89) invalid-denominator raised when denominator is negative", () => {
    assert.throws(
      () => validateRationalScale({ num: 1, den: -5 }),
      (err) => {
        assert.ok(err instanceof DimensionSchemaError);
        assert.equal(err.code, "invalid-denominator");
        assert.match(err.message, /strictly positive/);
        return true;
      },
    );

    // Accept strictly positive denominator
    const accepted = validateRationalScale({ num: 1, den: 5 });
    assert.equal(accepted.den, 5);
  });

  test("dimensionBasis: (dimensionBasis.ts:96) zero-scale-forbidden raised when allowZero is false and num is 0", () => {
    assert.throws(
      () => validateRationalScale({ num: 0, den: 1 }, "scale", false),
      (err) => {
        assert.ok(err instanceof DimensionSchemaError);
        assert.equal(err.code, "zero-scale-forbidden");
        return true;
      },
    );
  });

  test("dimensionBasis: (dimensionBasis.ts:104) rational-not-reduced raised when fraction is not in lowest terms", () => {
    assert.throws(
      () => validateRationalScale({ num: 2, den: 4 }),
      (err) => {
        assert.ok(err instanceof DimensionSchemaError);
        assert.equal(err.code, "rational-not-reduced");
        return true;
      },
    );
  });

  test("dimensionBasis: (dimensionBasis.ts:128) luminous-intensity-forbidden raised when object specifies cd/candela", () => {
    assert.throws(
      () => validateRationalDimension({ cd: 1 }),
      (err) => {
        assert.ok(err instanceof DimensionSchemaError);
        assert.equal(err.code, "luminous-intensity-forbidden");
        return true;
      },
    );
  });

  test("dimensionBasis: (dimensionBasis.ts:136) invalid-dimension-array raised when dimension is not an array", () => {
    assert.throws(
      () => validateRationalDimension("not-an-array"),
      (err) => {
        assert.ok(err instanceof DimensionSchemaError);
        assert.equal(err.code, "invalid-dimension-array");
        return true;
      },
    );

    // Accept array of 6 exponents
    const accepted = validateRationalDimension([0, 0, 0, 0, 0, 0]);
    assert.equal(accepted.length, 6);
  });

  test("dimensionBasis: (dimensionBasis.ts:144) luminous-intensity-forbidden raised when array length exceeds 6", () => {
    assert.throws(
      () => validateRationalDimension([0, 0, 0, 0, 0, 0, 0]),
      (err) => {
        assert.ok(err instanceof DimensionSchemaError);
        assert.equal(err.code, "luminous-intensity-forbidden");
        return true;
      },
    );

    // Accept exactly 6 exponents
    const accepted = validateRationalDimension([1, 0, 0, 0, 0, 0]);
    assert.equal(accepted.length, 6);
  });

  test("dimensionBasis: (dimensionBasis.ts:150) invalid-dimension-length raised when array length is under 6", () => {
    assert.throws(
      () => validateRationalDimension([0, 0, 0]),
      (err) => {
        assert.ok(err instanceof DimensionSchemaError);
        assert.equal(err.code, "invalid-dimension-length");
        return true;
      },
    );

    // Accept exactly 6 exponents
    const accepted = validateRationalDimension([0, 1, 0, 0, 0, 0]);
    assert.equal(accepted.length, 6);
  });

  test("dimensionBasis: (dimensionBasis.ts:161) invalid-rational-string raised when rational string is malformed", () => {
    assert.throws(
      () => validateRationalDimension(["not-a-rational", 0, 0, 0, 0, 0]),
      (err) => {
        assert.ok(err instanceof DimensionSchemaError);
        assert.equal(err.code, "invalid-rational-string");
        return true;
      },
    );

    // Accept valid rational strings
    const accepted = validateRationalDimension(["1/2", -1, 0, 0, 0, 0]);
    assert.deepEqual(accepted[0], { num: 1, den: 2 });
  });

  test("dimensionBasis: (dimensionBasis.ts:181) invalid-dimension-length raised when isCgs encounters missing slot at index 4", () => {
    const sparse = [0, 0, 0, 0];
    sparse.length = 6;
    assert.throws(
      () => validateRationalDimension(sparse, "dimension", true),
      (err) => {
        assert.ok(err instanceof DimensionSchemaError);
        assert.equal(err.code, "invalid-dimension-length");
        assert.match(err.message, /Missing current dimension slot/);
        return true;
      },
    );

    // Accept valid CGS dimension with zero current
    const accepted = validateRationalDimension([1, 0, 0, 0, 0, 0], "dimension", true);
    assert.equal(accepted[4]?.num, 0);
  });

  test("dimensionBasis: (dimensionBasis.ts:188) cgs-nonzero-current raised when isCgs has nonzero current exponent", () => {
    assert.throws(
      () => validateRationalDimension([0, 0, 0, 0, 1, 0], "dimension", true),
      (err) => {
        assert.ok(err instanceof DimensionSchemaError);
        assert.equal(err.code, "cgs-nonzero-current");
        return true;
      },
    );
  });
});
