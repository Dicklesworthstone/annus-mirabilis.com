import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { dimension } from "./rational.ts";
import { mapToRuntimeDimension } from "./runtimeMapping.ts";

describe("runtimeMapping refusal coverage (am-muyh)", () => {
  describe("out-of-range (runtimeMapping.ts:24) & (runtimeMapping.ts:62)", () => {
    test("reject: (runtimeMapping.ts:62) out-of-range refused when dimension exponent exceeds i8 upper bound 127", () => {
      const dimTooLarge = dimension(["128", "0", "0", "0", "0", "0"]);
      const res = mapToRuntimeDimension(dimTooLarge, "si");
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.code, "out-of-range");
        assert.ok(res.message.includes("exceeds i8 range"));
      }
    });

    test("reject: (runtimeMapping.ts:24) out-of-range refused when dimension exponent exceeds i8 lower bound -128", () => {
      const dimTooSmall = dimension(["-129", "0", "0", "0", "0", "0"]);
      const res = mapToRuntimeDimension(dimTooSmall, "si");
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.code, "out-of-range");
        assert.ok(res.message.includes("exceeds i8 range"));
      }
    });

    test("accept: valid exponents within [-128, 127] are mapped cleanly", () => {
      const dimValid = dimension(["127", "-128", "1", "0", "0", "0"]);
      const res = mapToRuntimeDimension(dimValid, "si");
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.deepEqual(res.runtimeExponents, [127, -128, 1, 0, 0, 0]);
      }
    });
  });

  describe("non-si-context (runtimeMapping.ts:37)", () => {
    test("reject: non-si-context refused when context is gaussian-cgs or cgs", () => {
      const dim = dimension(["1", "0", "0", "0", "0", "0"]);
      const resGaussian = mapToRuntimeDimension(dim, "gaussian-cgs");
      assert.equal(resGaussian.ok, false);
      if (!resGaussian.ok) {
        assert.equal(resGaussian.code, "non-si-context");
        assert.ok(resGaussian.message.includes("strictly canonical SI"));
      }

      const resEmu = mapToRuntimeDimension(dim, "emu-cgs");
      assert.equal(resEmu.ok, false);
      if (!resEmu.ok) {
        assert.equal(resEmu.code, "non-si-context");
      }
    });

    test("accept: canonical SI context is accepted", () => {
      const dim = dimension(["1", "0", "0", "0", "0", "0"]);
      const res = mapToRuntimeDimension(dim, "si");
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.deepEqual(res.runtimeExponents, [1, 0, 0, 0, 0, 0]);
      }
    });
  });

  describe("fractional-exponent (runtimeMapping.ts:53)", () => {
    test("reject: fractional-exponent refused when dimension has non-unit denominator", () => {
      const fracDim = dimension(["1/2", "0", "0", "0", "0", "0"]);
      const res = mapToRuntimeDimension(fracDim, "si");
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.code, "fractional-exponent");
        assert.ok(res.message.includes("fractional exponents"));
      }
    });

    test("accept: integer exponent dimensions are accepted", () => {
      const intDim = dimension(["2", "0", "-1", "0", "0", "0"]);
      const res = mapToRuntimeDimension(intDim, "si");
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.deepEqual(res.runtimeExponents, [2, 0, -1, 0, 0, 0]);
      }
    });
  });

  describe("state-dependent (runtimeMapping.ts:45)", () => {
    test("reject: state-dependent refused when isStateDependent is true", () => {
      const dim = dimension(["1", "0", "0", "0", "0", "0"]);
      const res = mapToRuntimeDimension(dim, "si", true);
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.code, "state-dependent");
      }
    });

    test("accept: non-state-dependent quantities are accepted", () => {
      const dim = dimension(["1", "0", "0", "0", "0", "0"]);
      const res = mapToRuntimeDimension(dim, "si", false);
      assert.equal(res.ok, true);
    });
  });
});
