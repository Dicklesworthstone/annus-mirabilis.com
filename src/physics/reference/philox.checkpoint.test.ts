import { describe, expect, test } from "bun:test";
import {
  createPhiloxStream,
  decodeStreamCheckpoint,
  encodeStreamCheckpoint,
  STREAM_CHECKPOINT_CANONICAL_LEN,
  STREAM_CHECKPOINT_VERSION,
  STREAM_SEMANTICS_VERSION,
} from "./philox.ts";
import vectors from "./philox.vectors.json";

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

describe("Philox Canonical 83-Byte StreamCheckpoint Codec Across 315 Positions", () => {
  test("all 315 positions match canonical 83-byte frame byte-for-byte", () => {
    for (const pos of vectors.positions) {
      const stream = createPhiloxStream(
        { seed: pos.seed, kernel: pos.streamKernel, tile: pos.tile },
        pos.index,
      );

      const frame = stream.toCanonicalCheckpoint();
      expect(frame.length).toBe(STREAM_CHECKPOINT_CANONICAL_LEN);
      expect(bytesToHex(frame)).toBe(pos.checkpoint);

      // Decoding reproduces exact fields
      const decoded = decodeStreamCheckpoint(frame);
      expect(decoded.checkpointVersion).toBe(STREAM_CHECKPOINT_VERSION);
      expect(decoded.streamSemanticsVersion).toBe(STREAM_SEMANTICS_VERSION);
      expect(decoded.key.seed).toBe(pos.seed);
      expect(decoded.key.kernel).toBe(pos.streamKernel);
      expect(decoded.key.tile).toBe(pos.tile);
      expect(decoded.index.toString()).toBe(pos.index);

      // Resuming from decoded checkpoint produces identical next draw
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
    const truncated = valid.subarray(0, 82);
    expect(() => decodeStreamCheckpoint(truncated)).toThrow();
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
