/** Deliberate violation: view using Math.random(). */
export function PlantedRandom() {
  const r = Math.random();
  return <div>{r}</div>;
}
