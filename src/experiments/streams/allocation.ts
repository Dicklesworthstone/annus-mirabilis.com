/** Numeric id and tile mapping from docs/FRANKENSIM_BINDING.md decision C.5/C.6. */
export const BM01_ALLOCATION = Object.freeze({
  allocationId: "bm-01.latent.v1", streamKernelId: 0x19050001, streamVersion: 1,
  axes: 3, drawsPerStep: 2, maximumTracers: 10000,
});
export function bm01Tile(tracer: number, axis: number): number {
  if (!Number.isInteger(tracer) || tracer < 0 || tracer >= BM01_ALLOCATION.maximumTracers || !Number.isInteger(axis) || axis < 0 || axis >= 3) throw new RangeError("Tracer or axis lies outside the registered allocation.");
  return 3 * tracer + axis;
}
