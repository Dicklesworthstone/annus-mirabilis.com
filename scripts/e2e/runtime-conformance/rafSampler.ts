export type PaintedSample = Readonly<{
  value: number;
  labeledRevision: number;
  acceptedRevision: number;
}>;

/**
 * A painted value whose labeled input revision is newer than the accepted
 * revision that produced it is an intermediate value under a newer label.
 */
export function findMislabeledPaint(samples: readonly PaintedSample[]): PaintedSample | undefined {
  return samples.find((sample) => sample.labeledRevision > sample.acceptedRevision);
}
