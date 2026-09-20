import { describe, expect, test } from "bun:test";
import {
  at,
  createPhiloxStream,
  decodeStreamCheckpoint,
  encodeStreamCheckpoint,
  HOST_NORMAL_VERSION,
  philox4x32_10,
  STREAM_CHECKPOINT_CANONICAL_LEN,
  STREAM_CHECKPOINT_IDENTITY_DOMAIN,
  STREAM_CHECKPOINT_MAGIC,
  STREAM_CHECKPOINT_VERSION,
  STREAM_SEMANTICS_VERSION,
  StreamInputError,
  U64_MAX,
} from "./philox.ts";
import vectors from "./philox.vectors.json";

function f64ToHexBits(val: number): string {
  const buf = new ArrayBuffer(8);
  new Float64Array(buf)[0] = val;
  return new DataView(buf).getBigUint64(0, true).toString(16).padStart(16, "0");
}

function hexBitsToF64(hex: string): number {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setBigUint64(0, BigInt(`0x${hex}`), true);
  return new Float64Array(buf)[0] ?? 0;
}

function bytesToHex(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b !== undefined) {
      s += b.toString(16).padStart(2, "0");
    }
  }
  return s;
}

describe("Philox4x32-10 TypeScript Reference Port (am-fs-philox-ts-port-7kp)", () => {
  // ---------------------------------------------------------------------------
  // 1. Random123 Known-Answer Tests (KAT)
  // ---------------------------------------------------------------------------
  describe("Random123 Published Known-Answer Tests", () => {
    const kats = [
      {
        name: "zero_block",
        counter: [0, 0, 0, 0],
        key: [0, 0],
        expected: [0x6627e8d5, 0xe169c58d, 0xbc57ac4c, 0x9b00dbd8],
      },
      {
        name: "all_ones",
        counter: [0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff],
        key: [0xffffffff, 0xffffffff],
        expected: [0x408f276d, 0x41c83b0e, 0xa20bc7c6, 0x6d5451fd],
      },
      {
        name: "pi_digits",
        counter: [0x243f6a88, 0x85a308d3, 0x13198a2e, 0x03707344],
        key: [0xa4093822, 0x299f31d0],
        expected: [0xd16cfe09, 0x94fdcceb, 0x5001e420, 0x24126ea1],
      },
    ];

    for (const kat of kats) {
      test(`matches Random123 KAT: ${kat.name}`, () => {
        const actual = philox4x32_10(kat.counter, kat.key);
        expect(Array.from(actual)).toEqual(kat.expected);
      });
    }

    test("matches all 3 knownAnswers in philox.vectors.json", () => {
      expect(vectors.knownAnswers.length).toBe(3);
      for (const ka of vectors.knownAnswers) {
        const counter = ka.counter.map((h: string) => Number.parseInt(h, 16));
        const key = ka.key.map((h: string) => Number.parseInt(h, 16));
        const expectedBlock = ka.block.map((h: string) => Number.parseInt(h, 16));
        const actual = philox4x32_10(counter, key);
        expect(Array.from(actual)).toEqual(expectedBlock);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Block Output Across Cross-Check Vectors
  // ---------------------------------------------------------------------------
  describe("Block Function Bitwise Parity Across 315 Positions", () => {
    test("every Philox block matches bitwise", () => {
      expect(vectors.positions.length).toBe(315);
      for (const pos of vectors.positions) {
        const key = { seed: pos.seed, kernel: pos.streamKernel, tile: pos.tile };
        const actualBlock = at(key, pos.index);
        const expectedWords = pos.block.map((h: string) => Number.parseInt(h, 16));
        expect(Array.from(actualBlock)).toEqual(expectedWords);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 3. nextU64 and nextF64 Bitwise Parity & Boundary Conditions
  // ---------------------------------------------------------------------------
  describe("Uniform Draws (nextU64, nextF64) Bitwise Parity", () => {
    test("every nextU64 matches bitwise across all 315 positions", () => {
      for (const pos of vectors.positions) {
        const stream = createPhiloxStream(
          { seed: pos.seed, kernel: pos.streamKernel, tile: pos.tile },
          pos.index,
        );
        const actualU64 = stream.nextU64();
        expect(actualU64.toString()).toBe(pos.u64);
      }
    });

    test("every nextF64 matches IEEE-754 bit pattern exactly (53-bit ladder)", () => {
      for (const pos of vectors.positions) {
        const stream = createPhiloxStream(
          { seed: pos.seed, kernel: pos.streamKernel, tile: pos.tile },
          pos.index,
        );
        const actualF64 = stream.nextF64();
        expect(f64ToHexBits(actualF64)).toBe(pos.f64Bits);
      }
    });

    test("boundary indices (4294967295, 4294967296, 18446744073709551614) and boundary seeds (0, 1, ..., 18446744073709551615) match bitwise", () => {
      const boundaryIndices = new Set(["4294967295", "4294967296", "18446744073709551614"]);
      const boundarySeeds = new Set(["0", "1", "4294967295", "4294967296", "18446744073709551615"]);

      let matchedBoundaryCases = 0;
      for (const pos of vectors.positions) {
        if (boundaryIndices.has(pos.index) && boundarySeeds.has(pos.seed)) {
          const stream = createPhiloxStream(
            { seed: pos.seed, kernel: pos.streamKernel, tile: pos.tile },
            pos.index,
          );
          expect(stream.nextU64().toString()).toBe(pos.u64);

          const stream2 = createPhiloxStream(
            { seed: pos.seed, kernel: pos.streamKernel, tile: pos.tile },
            pos.index,
          );
          expect(f64ToHexBits(stream2.nextF64())).toBe(pos.f64Bits);
          matchedBoundaryCases++;
        }
      }
      expect(matchedBoundaryCases).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Lemire nextBelow Widening Multiply with Deterministic Rejection
  // ---------------------------------------------------------------------------
  describe("nextBelow Rejection Sampling & Consumed Draws", () => {
    test("every nextBelow value and consumed draw count match the vectors", () => {
      for (const pos of vectors.positions) {
        for (const entry of pos.below) {
          const startIdx = BigInt(pos.index);
          const stream = createPhiloxStream(
            { seed: pos.seed, kernel: pos.streamKernel, tile: pos.tile },
            startIdx,
          );

          const val = stream.nextBelow(BigInt(entry.n));
          const drawsConsumed = Number(BigInt.asUintN(64, stream.index - startIdx));

          expect(val.toString()).toBe(entry.value);
          expect(drawsConsumed).toBe(entry.drawsConsumed);
        }
      }
    });

    test("nextBelow(0) throws invalid-parameter", () => {
      const stream = createPhiloxStream({ seed: "1", kernel: 0, tile: 0 });
      expect(() => stream.nextBelow(0)).toThrow();
      expect(() => stream.nextBelow(0n)).toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Box-Muller nextNormal Within Tolerance and Consuming Exactly 2 Draws
  // ---------------------------------------------------------------------------
  describe("Box-Muller Normal Draws (nextNormal)", () => {
    test("every nextNormal matches within |Δ| <= 8 * ε * max(1, |z|) and consumes 2 draws", () => {
      let maxObservedDeviation = 0;
      const eps = 2 ** -52;

      for (const pos of vectors.positions) {
        const startIdx = BigInt(pos.index);
        const stream = createPhiloxStream(
          { seed: pos.seed, kernel: pos.streamKernel, tile: pos.tile },
          startIdx,
        );

        const actualZ = stream.nextNormal();
        const expectedZ = hexBitsToF64(pos.normalBits);

        // Verify exactly 2 draws consumed per normal
        expect(Number(BigInt.asUintN(64, stream.index - startIdx))).toBe(2);

        const delta = Math.abs(actualZ - expectedZ);
        if (delta > maxObservedDeviation) {
          maxObservedDeviation = delta;
        }

        const tol = 8 * eps * Math.max(1, Math.abs(expectedZ));
        expect(delta).toBeLessThanOrEqual(tol);
      }

      const bunVersion = (globalThis as Record<string, any>).Bun?.version;
      const engineInfo = bunVersion
        ? `Bun ${bunVersion} (JavaScriptCore)`
        : `Node ${process.version} (V8)`;
      console.log(
        `[philox.test] Engine: ${engineInfo}, Max Deviation: ${maxObservedDeviation.toExponential(4)}, Bound: ${(8 * eps).toExponential(4)}`,
      );
      expect(maxObservedDeviation).toBeLessThanOrEqual(8 * eps * 10);
    });

    test("draw-based indexing: normal sequence starting at draw 6 equals suffix from draw 0", () => {
      expect(vectors.normalSequences.length).toBe(2);
      const from0 = vectors.normalSequences.find((s) => s.startIndex === "0");
      const from6 = vectors.normalSequences.find((s) => s.startIndex === "6");
      expect(from0).toBeDefined();
      expect(from6).toBeDefined();
      if (!from0 || !from6) return;

      const s0 = createPhiloxStream({ seed: "1", kernel: 0, tile: 0 }, "0");
      const s6 = createPhiloxStream({ seed: "1", kernel: 0, tile: 0 }, "6");

      const vals0 = Array.from({ length: 8 }, () => s0.nextNormal());
      const vals6 = Array.from({ length: 8 }, () => s6.nextNormal());

      const eps = 2 ** -52;
      for (let i = 0; i < 8; i++) {
        const exp0 = hexBitsToF64(from0.normalBits[i] ?? "0");
        const tol0 = 8 * eps * Math.max(1, Math.abs(exp0));
        expect(Math.abs((vals0[i] ?? 0) - exp0)).toBeLessThanOrEqual(tol0);

        const exp6 = hexBitsToF64(from6.normalBits[i] ?? "0");
        const tol6 = 8 * eps * Math.max(1, Math.abs(exp6));
        expect(Math.abs((vals6[i] ?? 0) - exp6)).toBeLessThanOrEqual(tol6);
      }

      // 6 draws = 3 normals, so vals6[0..4] must equal vals0[3..7]
      for (let i = 0; i < 5; i++) {
        expect(vals6[i]).toBe(vals0[i + 3]);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Bulk Fill Methods and Allocation-Free Generation
  // ---------------------------------------------------------------------------
  describe("Bulk Fill Methods (fillF64, fillNormals)", () => {
    test("fillF64 produces bitwise-identical values to sequential nextF64 calls", () => {
      const key = { seed: "9876543210", kernel: 5, tile: 12 };
      const n = 1024;

      const stream1 = createPhiloxStream(key, 0n);
      const stream2 = createPhiloxStream(key, 0n);

      const bulk = new Float64Array(n);
      stream1.fillF64(bulk);

      for (let i = 0; i < n; i++) {
        const seq = stream2.nextF64();
        expect(bulk[i]).toBe(seq);
      }

      expect(stream1.index).toBe(BigInt(n));
      expect(stream2.index).toBe(BigInt(n));
    });

    test("fillNormals produces bitwise-identical values to sequential nextNormal calls", () => {
      const key = { seed: "123456789", kernel: 3, tile: 7 };
      const n = 512;

      const stream1 = createPhiloxStream(key, 0n);
      const stream2 = createPhiloxStream(key, 0n);

      const bulk = new Float64Array(n);
      stream1.fillNormals(bulk);

      for (let i = 0; i < n; i++) {
        const seq = stream2.nextNormal();
        expect(bulk[i]).toBe(seq);
      }

      expect(stream1.index).toBe(BigInt(n * 2));
      expect(stream2.index).toBe(BigInt(n * 2));
    });

    test("generating 1,000,000 uniforms completes without per-draw allocation within performance limit", () => {
      const stream = createPhiloxStream({ seed: "42", kernel: 0, tile: 0 });
      const buffer = new Float64Array(100_000);

      const t0 = performance.now();
      for (let chunk = 0; chunk < 10; chunk++) {
        stream.fillF64(buffer);
      }
      const durationMs = performance.now() - t0;

      expect(stream.index).toBe(1_000_000n);
      console.log(`[philox.test] 1,000,000 uniforms filled in ${durationMs.toFixed(2)}ms`);
      expect(durationMs).toBeLessThan(1000);
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Canonical 83-Byte StreamCheckpoint Codec Fail-Closed Verification
  // ---------------------------------------------------------------------------
  describe("Canonical 83-Byte StreamCheckpoint Codec", () => {
    test("all 315 positions match canonical 83-byte frame byte-for-byte", () => {
      for (const pos of vectors.positions) {
        const stream = createPhiloxStream(
          { seed: pos.seed, kernel: pos.streamKernel, tile: pos.tile },
          pos.index,
        );

        const frame = stream.toCanonicalCheckpoint();
        expect(frame.length).toBe(STREAM_CHECKPOINT_CANONICAL_LEN);
        expect(bytesToHex(frame)).toBe(pos.checkpoint);

        // Roundtrip decode
        const decoded = decodeStreamCheckpoint(frame);
        expect(decoded.checkpointVersion).toBe(STREAM_CHECKPOINT_VERSION);
        expect(decoded.streamSemanticsVersion).toBe(STREAM_SEMANTICS_VERSION);
        expect(decoded.key.seed).toBe(pos.seed);
        expect(decoded.key.kernel).toBe(pos.streamKernel);
        expect(decoded.key.tile).toBe(pos.tile);
        expect(decoded.index.toString()).toBe(pos.index);

        // Resume produces identical next draw
        const resumed = createPhiloxStream(decoded);
        expect(resumed.nextU64().toString()).toBe(pos.u64);
      }
    });

    test("fail-closed: trailing byte is refused", () => {
      const valid = encodeStreamCheckpoint({ seed: "1", kernel: 0, tile: 0, index: 0n });
      const trailing = new Uint8Array(valid.length + 1);
      trailing.set(valid, 0);
      trailing[valid.length] = 0xaa;
      expect(() => decodeStreamCheckpoint(trailing)).toThrow();
    });

    test("fail-closed: truncated frame is refused", () => {
      const valid = encodeStreamCheckpoint({ seed: "1", kernel: 0, tile: 0, index: 0n });
      expect(() => decodeStreamCheckpoint(valid.subarray(0, 82))).toThrow();
    });

    test("fail-closed: corrupted magic is refused", () => {
      const valid = encodeStreamCheckpoint({ seed: "1", kernel: 0, tile: 0, index: 0n });
      valid[0] = 0xff;
      expect(() => decodeStreamCheckpoint(valid)).toThrow();
    });

    test("fail-closed: corrupted domain is refused", () => {
      const valid = encodeStreamCheckpoint({ seed: "1", kernel: 0, tile: 0, index: 0n });
      valid[10] = 0xff;
      expect(() => decodeStreamCheckpoint(valid)).toThrow();
    });

    test("fail-closed: unknown checkpoint version is refused", () => {
      const valid = encodeStreamCheckpoint({
        seed: "1",
        kernel: 0,
        tile: 0,
        index: 0n,
        checkpointVersion: 99,
      });
      expect(() => decodeStreamCheckpoint(valid)).toThrow();
    });

    test("fail-closed: unknown stream semantics version is refused", () => {
      const valid = encodeStreamCheckpoint({
        seed: "1",
        kernel: 0,
        tile: 0,
        index: 0n,
        streamSemanticsVersion: 99,
      });
      expect(() => decodeStreamCheckpoint(valid)).toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // 8. 64-Bit Index Natural Wrapping
  // ---------------------------------------------------------------------------
  describe("64-Bit Index Natural Wrapping at 2^64", () => {
    test("index increments wrap at 2^64 exactly like upstream wrapping_add", () => {
      const key = { seed: "12345", kernel: 1, tile: 1 };
      const nearEnd = U64_MAX - 1n; // 18446744073709551614

      const stream = createPhiloxStream(key, nearEnd);
      expect(stream.index).toBe(nearEnd);

      stream.nextU64();
      expect(stream.index).toBe(U64_MAX);

      stream.nextU64();
      expect(stream.index).toBe(0n);

      stream.nextU64();
      expect(stream.index).toBe(1n);
    });

    test("nextNormal wraps across 2^64 boundary seamlessly", () => {
      const key = { seed: "999", kernel: 2, tile: 4 };
      const nearEnd = U64_MAX - 1n;

      const stream = createPhiloxStream(key, nearEnd);
      const z = stream.nextNormal();
      expect(Number.isFinite(z)).toBe(true);
      expect(stream.index).toBe(0n);
    });

    test("fillF64 wraps across 2^64 boundary seamlessly", () => {
      const key = { seed: "777", kernel: 0, tile: 0 };
      const nearEnd = U64_MAX - 3n;

      const stream = createPhiloxStream(key, nearEnd);
      const out = new Float64Array(8);
      stream.fillF64(out);

      expect(stream.index).toBe(4n);
      for (const v of out) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 9. Constants and Vector Provenance
  // ---------------------------------------------------------------------------
  describe("Constants and Vector Provenance", () => {
    test("exported constants match schema specification", () => {
      expect(STREAM_SEMANTICS_VERSION).toBe(1);
      expect(STREAM_CHECKPOINT_VERSION).toBe(1);
      expect(STREAM_CHECKPOINT_MAGIC).toBe("FSRCKPT\0");
      expect(STREAM_CHECKPOINT_IDENTITY_DOMAIN).toBe("org.frankensim.fs-rand.stream-checkpoint.v1");
      expect(STREAM_CHECKPOINT_CANONICAL_LEN).toBe(83);
      expect(HOST_NORMAL_VERSION).toBe("philox-box-muller-host-v1");
      expect(U64_MAX).toBe(18446744073709551615n);
    });

    test("provenance header matches pinned FrankenSim revision", () => {
      expect(vectors.provenance.frankensimRevision).toBe(
        "5bbbfae6f7de614422f6f97f5798a3e00f8ad813",
      );
      expect(vectors.provenance.streamSemanticsVersion).toBe(STREAM_SEMANTICS_VERSION);
      expect(vectors.provenance.streamCheckpointVersion).toBe(STREAM_CHECKPOINT_VERSION);
      expect(vectors.provenance.sha256).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
