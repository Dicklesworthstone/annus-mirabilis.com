/** Deliberate violation: view accumulating sum of squares in a loop. */
export function PlantedSumOfSquares({ points }: { points: readonly number[] }) {
  let sum = 0;
  for (const p of points) {
    sum += p * p;
  }
  return <div>{sum}</div>;
}
