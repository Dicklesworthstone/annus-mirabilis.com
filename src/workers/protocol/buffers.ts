/**
 * Versioned Typed Buffer Layout Registry and Header Validation.
 * Governed by bead am-rt-worker-protocol-gaq.
 *
 * Implements:
 * - Versioned buffer headers with shape, byteLength, littleEndian, and ownership
 * - Layout registration for brownian-frames, diffusion1d-frames, and philox-normals
 * - Strict length, shape, and endianness validation
 * - Big-endian environment detection
 */

export type DType = "float64";
export type OwnershipKind = "transfer" | "copy";

export interface VersionedBufferHeader {
  readonly layoutId: string;
  readonly layoutVersion: number;
  readonly dtype: DType;
  readonly shape: readonly number[];
  readonly byteLength: number;
  readonly littleEndian: boolean;
  readonly ownership: OwnershipKind;
}

export interface RegisteredLayoutSpec {
  readonly layoutId: string;
  readonly layoutVersion: number;
  readonly dtype: DType;
  readonly expectedDimensions: number;
  readonly validateShape?: (shape: readonly number[]) => boolean;
}

export const REGISTERED_LAYOUTS: Readonly<Record<string, RegisteredLayoutSpec>> = {
  "brownian-frames@1": {
    layoutId: "brownian-frames",
    layoutVersion: 1,
    dtype: "float64",
    expectedDimensions: 2, // [nParticles, steps + 1]
    // Both dimensions carry the same lower bound, so every() states it without
    // indexing past a length check that TypeScript cannot see through.
    validateShape: (shape) => shape.length === 2 && shape.every((n) => n >= 1),
  },
  "diffusion1d-frames@1": {
    layoutId: "diffusion1d-frames",
    layoutVersion: 1,
    dtype: "float64",
    expectedDimensions: 2, // [frames, n]
    // The two dimensions have different lower bounds - frames and cells - so this one
    // reads them by name after the length check rather than asserting non-null.
    validateShape: (shape) => {
      if (shape.length !== 2) return false;
      const [frames, cells] = shape;
      return frames !== undefined && cells !== undefined && frames >= 1 && cells >= 3;
    },
  },
  "philox-normals@1": {
    layoutId: "philox-normals",
    layoutVersion: 1,
    dtype: "float64",
    expectedDimensions: 1, // [count]
    validateShape: (shape) => shape.length === 1 && shape.every((n) => n >= 1),
  },
};

/**
 * Checks if the host runtime environment is little-endian.
 */
export function isHostLittleEndian(): boolean {
  const u16 = new Uint16Array([0x1234]);
  const u8 = new Uint8Array(u16.buffer);
  return u8[0] === 0x34;
}

export type BufferValidationError =
  | "non-plain-header"
  | "unknown-field"
  | "unknown-layout"
  | "unsupported-dtype"
  | "buffer-length-mismatch"
  | "buffer-shape-mismatch"
  | "endianness-unsupported"
  | "invalid-ownership";

export const BUFFER_HEADER_ALLOWED_KEYS = new Set([
  "layoutId",
  "layoutVersion",
  "dtype",
  "shape",
  "byteLength",
  "littleEndian",
  "ownership",
]);

/**
 * Validates a versioned buffer header structure against the layout registry.
 */
export function validateBufferHeader(
  input: unknown,
):
  | { ok: true; header: VersionedBufferHeader }
  | { ok: false; code: BufferValidationError; reason: string } {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, code: "non-plain-header", reason: "Buffer header must be a plain object." };
  }

  const obj = input as Record<string, unknown>;
  for (const k of Object.keys(obj)) {
    if (!BUFFER_HEADER_ALLOWED_KEYS.has(k)) {
      return { ok: false, code: "unknown-field", reason: `Unknown buffer header field "${k}".` };
    }
  }

  const { layoutId, layoutVersion, dtype, shape, byteLength, littleEndian, ownership } = obj;

  if (typeof layoutId !== "string" || typeof layoutVersion !== "number") {
    return {
      ok: false,
      code: "unknown-layout",
      reason: "layoutId and layoutVersion are required.",
    };
  }

  const key = `${layoutId}@${layoutVersion}`;
  const spec = REGISTERED_LAYOUTS[key];
  if (!spec) {
    return {
      ok: false,
      code: "unknown-layout",
      reason: `Buffer layout "${key}" is not registered in the layout registry.`,
    };
  }

  if (dtype !== "float64") {
    return {
      ok: false,
      code: "unsupported-dtype",
      reason: `Dtype "${String(dtype)}" is unsupported; expected "float64".`,
    };
  }

  if (
    !Array.isArray(shape) ||
    shape.some((d) => typeof d !== "number" || !Number.isInteger(d) || d < 0)
  ) {
    return {
      ok: false,
      code: "buffer-shape-mismatch",
      reason: "shape must be an array of non-negative integers.",
    };
  }

  if (shape.length !== spec.expectedDimensions) {
    return {
      ok: false,
      code: "buffer-shape-mismatch",
      reason: `Layout "${key}" expects ${spec.expectedDimensions} dimensions, got ${shape.length}.`,
    };
  }

  if (spec.validateShape && !spec.validateShape(shape)) {
    return {
      ok: false,
      code: "buffer-shape-mismatch",
      reason: `Shape [${shape.join(", ")}] violates constraints for layout "${key}".`,
    };
  }

  let expectedCount = 1;
  for (const dim of shape) {
    expectedCount *= dim;
  }
  const expectedByteLength = expectedCount * 8; // float64 is 8 bytes

  if (typeof byteLength !== "number" || byteLength !== expectedByteLength) {
    return {
      ok: false,
      code: "buffer-length-mismatch",
      reason: `Buffer byteLength ${byteLength} does not match shape product * 8 (${expectedByteLength}).`,
    };
  }

  if (littleEndian !== true) {
    return {
      ok: false,
      code: "endianness-unsupported",
      reason: "Only little-endian buffers (littleEndian: true) are supported.",
    };
  }

  if (ownership !== "transfer" && ownership !== "copy") {
    return {
      ok: false,
      code: "invalid-ownership",
      reason: 'ownership must be "transfer" or "copy".',
    };
  }

  return {
    ok: true,
    header: {
      layoutId,
      layoutVersion,
      dtype,
      shape: Object.freeze([...shape]),
      byteLength,
      littleEndian: true,
      ownership,
    },
  };
}

/**
 * Creates a valid VersionedBufferHeader for a registered layout.
 */
export function createBufferHeader(
  layoutId: string,
  layoutVersion: number,
  shape: readonly number[],
  ownership: OwnershipKind = "transfer",
): VersionedBufferHeader {
  let count = 1;
  for (const dim of shape) count *= dim;
  const byteLength = count * 8;

  const header: VersionedBufferHeader = {
    layoutId,
    layoutVersion,
    dtype: "float64",
    shape: Object.freeze([...shape]),
    byteLength,
    littleEndian: true,
    ownership,
  };

  const check = validateBufferHeader(header);
  if (!check.ok) {
    throw new TypeError(`Cannot create invalid buffer header: ${check.reason}`);
  }
  return header;
}
