/** Numeric id and tile mapping from docs/FRANKENSIM_BINDING.md decision C.5/C.6. */
export const BM01_ALLOCATION = Object.freeze({
  allocationId: "bm-01.latent.v1", streamKernelId: 0x19050001, streamVersion: 1,
  axes: 3, drawsPerStep: 2, maximumTracers: 10000,
});
export function bm01Tile(tracer: number, axis: number): number {
  if (!Number.isInteger(tracer) || tracer < 0 || tracer >= BM01_ALLOCATION.maximumTracers || !Number.isInteger(axis) || axis < 0 || axis >= 3) throw new RangeError("Tracer or axis lies outside the registered allocation.");
  return 3 * tracer + axis;
}

/** BM-05 uses the same physical export but a distinct, explicit 1-D tile allocation. */
export const BM05_ALLOCATION = Object.freeze({
  allocationId: "bm-05.walk.v1", streamKernelId: 0x19050001, streamVersion: 1,
  maximumWalkers: 10000, maximumSteps: 10000,
});
export function bm05Tile(walker: number): number {
  if (!Number.isInteger(walker) || walker < 0 || walker >= BM05_ALLOCATION.maximumWalkers) throw new RangeError("Walker lies outside the registered allocation.");
  return walker;
}
