import type { AcceptedSnapshot } from "../../../experiments/store/instanceStore.ts";
import { sentenceNumber } from "../presentation.ts";

const measurements = [
  ["Elapsed time (seconds)", "eventTimeMoving", "eventTimeStationary"],
  ["x displacement (light-seconds)", "eventXMoving", "eventXStationary"],
  ["y displacement (light-seconds)", "eventYMoving", "eventYStationary"],
  ["x displacement ÷ elapsed time (fraction of c)", "eventSlopeXMoving", "eventSlopeXStationary"],
  ["y displacement ÷ elapsed time (fraction of c)", "eventSlopeYMoving", "eventSlopeYStationary"],
] as const;

function eventTable(snapshot: AcceptedSnapshot, index: number, caption: string) {
  function reading(id: string) {
    const output = snapshot.outputs.find(entry => entry.quantityId === id);
    if (output?.status !== "value" || typeof output.value === "number" || output.value.length <= index)
      return "Unavailable";
    return sentenceNumber(output.value.at(index), 6);
  }
  return (
    <table className="inference-summary" data-velocity-event={index === 0 ? "B" : "C"}>
      <caption>{caption}</caption>
      <thead><tr><th scope="col">Measurement</th><th scope="col">Moving frame k</th><th scope="col">Stationary frame K</th></tr></thead>
      <tbody>
        {measurements.map(([label, moving, stationary]) => (
          <tr key={moving}>
            <th scope="row">{label}</th>
            <td>{reading(moving)}</td>
            <td>{reading(stationary)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function VelocityEventComparison({ snapshot }: { snapshot: AcceptedSnapshot }) {
  if (!snapshot.outputs.some(output => output.quantityId === "eventTimeMoving")) {
    return <p>Apply the saved settings to measure this motion from two events.</p>;
  }
  return (
    <details>
      <summary>Measure the velocity from two events</summary>
      <p>
        At event A the origins meet and both clocks read zero.
        {snapshot.parameters.mode === "two-boosts"
          ? " Follow the origin of the second moving frame as it passes clocks in k and K."
          : " Follow the moving point, or the light ray when its speed is c."}
        {" "}Each frame uses its own synchronized clocks. A light-second is the distance light travels in one second.
      </p>
      {eventTable(snapshot, 0, "A to B · one second elapses in the moving frame k")}
      <details>
        <summary>End the measurement after one second in K instead</summary>
        {eventTable(snapshot, 1, "A to C · one second elapses in the stationary frame K")}
        <p>Changing the end event changes the elapsed times and displacements together. Each frame measures the same component velocities for either stretch of this uniform motion.</p>
      </details>
      <p>
        <a href="/equations/special-relativity/eq-s5-d2/">Follow the transformed trajectory in §5</a>
      </p>
    </details>
  );
}
