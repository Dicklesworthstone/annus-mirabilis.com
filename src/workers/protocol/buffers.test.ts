/**
 * Comprehensive accept/reject tests for all 11 refusal return sites in buffers.ts (am-muyh).
 *
 * Governed by am-rt-worker-protocol-gaq and AGENTS.md:
 * - Versioned buffer headers: shape, byteLength, littleEndian, ownership.
 * - Accept/reject pair per refusal return site.
 * - Every test carries explicit line citation (buffers.ts:<line>) and literal code string.
 * - No mocks: tests validate direct uncoerced header inputs against pure validation rules.
 */

import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  type BufferValidationError,
  createBufferHeader,
  isHostLittleEndian,
  type VersionedBufferHeader,
  validateBufferHeader,
} from "./buffers.ts";

const VALID_BROWNIAN_HEADER: VersionedBufferHeader = {
  layoutId: "brownian-frames",
  layoutVersion: 1,
  dtype: "float64",
  shape: [10, 101],
  byteLength: 10 * 101 * 8, // 8080 bytes
  littleEndian: true,
  ownership: "transfer",
};

const VALID_DIFFUSION_HEADER: VersionedBufferHeader = {
  layoutId: "diffusion1d-frames",
  layoutVersion: 1,
  dtype: "float64",
  shape: [5, 50],
  byteLength: 5 * 50 * 8, // 2000 bytes
  littleEndian: true,
  ownership: "copy",
};

const VALID_PHILOX_HEADER: VersionedBufferHeader = {
  layoutId: "philox-normals",
  layoutVersion: 1,
  dtype: "float64",
  shape: [1024],
  byteLength: 1024 * 8, // 8192 bytes
  littleEndian: true,
  ownership: "transfer",
};

function assertRejection(
  res: ReturnType<typeof validateBufferHeader>,
  expectedCode: BufferValidationError,
  contextMsg: string,
): void {
  assert.equal(res.ok, false, `Expected rejection for: ${contextMsg}`);
  if (!res.ok) {
    assert.equal(
      res.code,
      expectedCode,
      `Expected code "${expectedCode}", got "${res.code}" (${res.reason})`,
    );
  }
}

describe("Versioned buffer header validation refusal sites (am-muyh)", () => {
  // Site 1 (line 95)
  test("site (buffers.ts:95) non-plain-header: rejects non-object or null header, accepts valid plain object header", () => {
    const accepted = validateBufferHeader(VALID_BROWNIAN_HEADER);
    assert.equal(accepted.ok, true);

    assertRejection(validateBufferHeader(null), "non-plain-header", "null header");
    assertRejection(validateBufferHeader(undefined), "non-plain-header", "undefined header");
    assertRejection(validateBufferHeader("not-an-object"), "non-plain-header", "string header");
    assertRejection(validateBufferHeader(42), "non-plain-header", "number header");
    assertRejection(
      validateBufferHeader([VALID_BROWNIAN_HEADER]),
      "non-plain-header",
      "array header",
    );
  });

  // Site 2 (line 101)
  test("site (buffers.ts:101) unknown-field: rejects unknown fields in buffer header, accepts canonical fields", () => {
    const accepted = validateBufferHeader(VALID_BROWNIAN_HEADER);
    assert.equal(accepted.ok, true);

    const withExtra = {
      ...VALID_BROWNIAN_HEADER,
      unauthorizedField: "unexpected",
    };
    assertRejection(
      validateBufferHeader(withExtra),
      "unknown-field",
      "header with extra unknown field",
    );

    const withPadding = {
      ...VALID_BROWNIAN_HEADER,
      trailingPaddingBytes: 128,
    };
    assertRejection(
      validateBufferHeader(withPadding),
      "unknown-field",
      "header with trailingPaddingBytes",
    );
  });

  // Site 3 (line 110)
  test("site (buffers.ts:110) unknown-layout: rejects missing or non-primitive layoutId or layoutVersion, accepts valid layout identifiers", () => {
    const accepted = validateBufferHeader(VALID_BROWNIAN_HEADER);
    assert.equal(accepted.ok, true);

    const nonStringLayoutId = {
      ...VALID_BROWNIAN_HEADER,
      layoutId: 123 as unknown as string,
    };
    assertRejection(validateBufferHeader(nonStringLayoutId), "unknown-layout", "numeric layoutId");

    const nonNumberVersion = {
      ...VALID_BROWNIAN_HEADER,
      layoutVersion: "1" as unknown as number,
    };
    assertRejection(
      validateBufferHeader(nonNumberVersion),
      "unknown-layout",
      "string layoutVersion",
    );

    const missingLayoutId = {
      ...VALID_BROWNIAN_HEADER,
      layoutId: undefined as unknown as string,
    };
    assertRejection(validateBufferHeader(missingLayoutId), "unknown-layout", "undefined layoutId");
  });

  // Site 4 (line 120)
  test("site (buffers.ts:120) unknown-layout: rejects unregistered layoutId@version combination, accepts registered layout combinations", () => {
    const acceptedBrownian = validateBufferHeader(VALID_BROWNIAN_HEADER);
    assert.equal(acceptedBrownian.ok, true);
    const acceptedPhilox = validateBufferHeader(VALID_PHILOX_HEADER);
    assert.equal(acceptedPhilox.ok, true);

    const unregisteredLayout = {
      ...VALID_BROWNIAN_HEADER,
      layoutId: "quantum-superposition-frames",
      layoutVersion: 1,
    };
    assertRejection(
      validateBufferHeader(unregisteredLayout),
      "unknown-layout",
      "unregistered layout name",
    );

    const unregisteredVersion = {
      ...VALID_BROWNIAN_HEADER,
      layoutVersion: 99,
    };
    assertRejection(
      validateBufferHeader(unregisteredVersion),
      "unknown-layout",
      "unregistered layout version",
    );
  });

  // Site 5 (line 128)
  test("site (buffers.ts:128) unsupported-dtype: rejects non-float64 dtype, accepts float64 dtype", () => {
    const accepted = validateBufferHeader(VALID_BROWNIAN_HEADER);
    assert.equal(accepted.ok, true);

    const float32Header = {
      ...VALID_BROWNIAN_HEADER,
      dtype: "float32" as unknown as "float64",
    };
    assertRejection(validateBufferHeader(float32Header), "unsupported-dtype", "float32 dtype");

    const int32Header = {
      ...VALID_BROWNIAN_HEADER,
      dtype: "int32" as unknown as "float64",
    };
    assertRejection(validateBufferHeader(int32Header), "unsupported-dtype", "int32 dtype");

    const uint8Header = {
      ...VALID_BROWNIAN_HEADER,
      dtype: "uint8" as unknown as "float64",
    };
    assertRejection(validateBufferHeader(uint8Header), "unsupported-dtype", "uint8 dtype");
  });

  // Site 6 (line 139)
  test("site (buffers.ts:139) buffer-shape-mismatch: rejects non-array shape or shape with negative/non-integer dimensions, accepts valid array of positive integers", () => {
    const accepted = validateBufferHeader(VALID_BROWNIAN_HEADER);
    assert.equal(accepted.ok, true);

    const nonArrayShape = {
      ...VALID_BROWNIAN_HEADER,
      shape: "10x101" as unknown as readonly number[],
    };
    assertRejection(validateBufferHeader(nonArrayShape), "buffer-shape-mismatch", "string shape");

    const negativeDimShape = {
      ...VALID_BROWNIAN_HEADER,
      shape: [-10, 101],
      byteLength: -10 * 101 * 8,
    };
    assertRejection(
      validateBufferHeader(negativeDimShape),
      "buffer-shape-mismatch",
      "negative dimension",
    );

    const floatDimShape = {
      ...VALID_BROWNIAN_HEADER,
      shape: [10.5, 101],
    };
    assertRejection(
      validateBufferHeader(floatDimShape),
      "buffer-shape-mismatch",
      "non-integer dimension",
    );

    const nonNumberDimShape = {
      ...VALID_BROWNIAN_HEADER,
      shape: ["10", "101"] as unknown as readonly number[],
    };
    assertRejection(
      validateBufferHeader(nonNumberDimShape),
      "buffer-shape-mismatch",
      "string dimension",
    );
  });

  // Site 7 (line 147)
  test("site (buffers.ts:147) buffer-shape-mismatch: rejects shape with wrong dimensionality for layout, accepts exact dimension count", () => {
    // brownian-frames@1 expects 2 dimensions
    const accepted2D = validateBufferHeader(VALID_BROWNIAN_HEADER);
    assert.equal(accepted2D.ok, true);

    const shape1D = {
      ...VALID_BROWNIAN_HEADER,
      shape: [1010],
      byteLength: 1010 * 8,
    };
    assertRejection(
      validateBufferHeader(shape1D),
      "buffer-shape-mismatch",
      "1D shape for 2D brownian layout",
    );

    const shape3D = {
      ...VALID_BROWNIAN_HEADER,
      shape: [10, 101, 1],
      byteLength: 10 * 101 * 1 * 8,
    };
    assertRejection(
      validateBufferHeader(shape3D),
      "buffer-shape-mismatch",
      "3D shape for 2D brownian layout",
    );

    // philox-normals@1 expects 1 dimension
    const philox2D = {
      ...VALID_PHILOX_HEADER,
      shape: [32, 32],
      byteLength: 32 * 32 * 8,
    };
    assertRejection(
      validateBufferHeader(philox2D),
      "buffer-shape-mismatch",
      "2D shape for 1D philox layout",
    );
  });

  // Site 8 (line 155)
  test("site (buffers.ts:155) buffer-shape-mismatch: rejects shape violating layout-specific constraint, accepts shape satisfying constraints", () => {
    // brownian-frames@1 requires shape[0] >= 1 && shape[1] >= 1
    const acceptedBrownian = validateBufferHeader(VALID_BROWNIAN_HEADER);
    assert.equal(acceptedBrownian.ok, true);

    const zeroParticles = {
      ...VALID_BROWNIAN_HEADER,
      shape: [0, 101],
      byteLength: 0,
    };
    assertRejection(
      validateBufferHeader(zeroParticles),
      "buffer-shape-mismatch",
      "0 particles in brownian layout",
    );

    const zeroSteps = {
      ...VALID_BROWNIAN_HEADER,
      shape: [10, 0],
      byteLength: 0,
    };
    assertRejection(
      validateBufferHeader(zeroSteps),
      "buffer-shape-mismatch",
      "0 steps in brownian layout",
    );

    // diffusion1d-frames@1 requires shape[0] >= 1 && shape[1] >= 3
    const acceptedDiffusion = validateBufferHeader(VALID_DIFFUSION_HEADER);
    assert.equal(acceptedDiffusion.ok, true);

    const diffusionTooFewSpatialPoints = {
      ...VALID_DIFFUSION_HEADER,
      shape: [5, 2], // requires >= 3
      byteLength: 5 * 2 * 8,
    };
    assertRejection(
      validateBufferHeader(diffusionTooFewSpatialPoints),
      "buffer-shape-mismatch",
      "fewer than 3 spatial grid points in diffusion1d layout",
    );

    // philox-normals@1 requires shape[0] >= 1
    const philoxZeroCount = {
      ...VALID_PHILOX_HEADER,
      shape: [0],
      byteLength: 0,
    };
    assertRejection(
      validateBufferHeader(philoxZeroCount),
      "buffer-shape-mismatch",
      "0 count in philox layout",
    );
  });

  // Site 9 (line 169)
  test("site (buffers.ts:169) buffer-length-mismatch: rejects byteLength not matching shape product * 8, accepts exact byte length", () => {
    const accepted = validateBufferHeader(VALID_BROWNIAN_HEADER);
    assert.equal(accepted.ok, true);

    const tooShort = {
      ...VALID_BROWNIAN_HEADER,
      byteLength: VALID_BROWNIAN_HEADER.byteLength - 8,
    };
    assertRejection(
      validateBufferHeader(tooShort),
      "buffer-length-mismatch",
      "byteLength 8 bytes shorter than expected",
    );

    const tooLong = {
      ...VALID_BROWNIAN_HEADER,
      byteLength: VALID_BROWNIAN_HEADER.byteLength + 8,
    };
    assertRejection(
      validateBufferHeader(tooLong),
      "buffer-length-mismatch",
      "byteLength 8 bytes longer than expected",
    );

    const nonNumberByteLength = {
      ...VALID_BROWNIAN_HEADER,
      byteLength: "8080" as unknown as number,
    };
    assertRejection(
      validateBufferHeader(nonNumberByteLength),
      "buffer-length-mismatch",
      "string byteLength",
    );
  });

  // Site 10 (line 177)
  test("site (buffers.ts:177) endianness-unsupported: rejects non-little-endian buffer header, accepts little-endian true", () => {
    const accepted = validateBufferHeader(VALID_BROWNIAN_HEADER);
    assert.equal(accepted.ok, true);

    const bigEndian = {
      ...VALID_BROWNIAN_HEADER,
      littleEndian: false,
    };
    assertRejection(
      validateBufferHeader(bigEndian),
      "endianness-unsupported",
      "littleEndian: false",
    );

    const missingEndianness = {
      ...VALID_BROWNIAN_HEADER,
      littleEndian: undefined as unknown as boolean,
    };
    assertRejection(
      validateBufferHeader(missingEndianness),
      "endianness-unsupported",
      "undefined littleEndian",
    );
  });

  // Site 11 (line 185)
  test("site (buffers.ts:185) invalid-ownership: rejects ownership kind other than transfer or copy, accepts transfer and copy", () => {
    const acceptedTransfer = validateBufferHeader({
      ...VALID_BROWNIAN_HEADER,
      ownership: "transfer",
    });
    assert.equal(acceptedTransfer.ok, true);

    const acceptedCopy = validateBufferHeader({
      ...VALID_BROWNIAN_HEADER,
      ownership: "copy",
    });
    assert.equal(acceptedCopy.ok, true);

    const sharedOwnership = {
      ...VALID_BROWNIAN_HEADER,
      ownership: "shared" as unknown as "transfer",
    };
    assertRejection(
      validateBufferHeader(sharedOwnership),
      "invalid-ownership",
      "shared ownership kind",
    );

    const emptyOwnership = {
      ...VALID_BROWNIAN_HEADER,
      ownership: "" as unknown as "transfer",
    };
    assertRejection(
      validateBufferHeader(emptyOwnership),
      "invalid-ownership",
      "empty string ownership kind",
    );

    const nullOwnership = {
      ...VALID_BROWNIAN_HEADER,
      ownership: null as unknown as "transfer",
    };
    assertRejection(
      validateBufferHeader(nullOwnership),
      "invalid-ownership",
      "null ownership kind",
    );
  });
});

describe("Buffer header creation and environment helpers", () => {
  test("createBufferHeader creates valid frozen header for registered layouts", () => {
    const header = createBufferHeader("brownian-frames", 1, [20, 200], "copy");
    assert.equal(header.layoutId, "brownian-frames");
    assert.equal(header.layoutVersion, 1);
    assert.equal(header.dtype, "float64");
    assert.deepEqual(header.shape, [20, 200]);
    assert.equal(header.byteLength, 20 * 200 * 8);
    assert.equal(header.littleEndian, true);
    assert.equal(header.ownership, "copy");
    assert.ok(Object.isFrozen(header.shape));

    const check = validateBufferHeader(header);
    assert.equal(check.ok, true);
  });

  test("createBufferHeader throws TypeError when invalid shape or layout is specified", () => {
    assert.throws(
      () => createBufferHeader("unknown-layout", 1, [10]),
      (err: unknown) =>
        err instanceof TypeError && err.message.includes("Cannot create invalid buffer header"),
    );

    assert.throws(
      () => createBufferHeader("brownian-frames", 1, [0, 10]),
      (err: unknown) =>
        err instanceof TypeError && err.message.includes("Cannot create invalid buffer header"),
    );
  });

  test("isHostLittleEndian returns boolean consistent with runtime architecture", () => {
    const result = isHostLittleEndian();
    assert.equal(typeof result, "boolean");
    // Standard consumer platforms (x86_64, arm64) are little-endian
    assert.equal(result, true);
  });
});
