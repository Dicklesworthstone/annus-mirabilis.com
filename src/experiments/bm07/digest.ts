import { createHash } from "node:crypto";

export function observationDigest(increments: Float64Array, extra = ""): string {
  const hash = createHash("sha256");
  hash.update(Buffer.from(increments.buffer, increments.byteOffset, increments.byteLength));
  hash.update(extra);
  return `sha256:${hash.digest("hex")}`;
}

export function observationDigestNumber(increments: Float64Array): number {
  const bytes = new Uint8Array(increments.buffer, increments.byteOffset, increments.byteLength);
  let h = 2166136261;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
