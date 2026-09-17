// Browser-safe numeric digest over increment bytes (FNV-1a, 32-bit).
// Deliberately separate from digest.ts, which pulls in node:crypto for SHA256
// and must not be reachable from browser workers.
export function observationDigestNumber(increments: Float64Array): number {
  const bytes = new Uint8Array(increments.buffer, increments.byteOffset, increments.byteLength);
  let h = 2166136261;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
