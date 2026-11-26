import type { AcceptedSnapshot } from "../../../experiments/store/instanceStore.ts";
import { sentenceNumber } from "../presentation.ts";

const rows = [
  ["Final frame velocity along x in K (fraction of c)", "composedUxOverC", "reversedUxOverC"],
  ["Final frame velocity along y in K (fraction of c)", "composedUyOverC", "reversedUyOverC"],
  ["Speed in K (fraction of c)", "composedSpeedOverC", "reversedSpeedOverC"],
  ["Signed axes rotation in the x–y plane (degrees)", "rotationDeg", "reversedRotationDeg"],
] as const;

export function BoostOrderComparison({ snapshot }: { snapshot: AcceptedSnapshot }) {
  const output = (id: string) => snapshot.outputs.find((entry) => entry.quantityId === id);
  const reversed = output("reversedProductMatrix");
  if (!reversed) {
    return <p>Apply these saved settings to compare the two orders of boosts.</p>;
  }
  function reading(id: string) {
    const result = output(id);
    if (result?.status === "value" && typeof result.value === "number") return sentenceNumber(result.value, 6);
    return result && "reason" in result ? result.reason : "Unavailable";
  }
  const matrix = reversed.status === "value" && typeof reversed.value !== "number" ? reversed.value : null;
  return (
    <section aria-label="Reversing the order of the boosts">
      <h3>What changes when the boosts change order?</h3>
      <p>
        Call the boost along x A and the boost at the chosen angle B. Read each boost in the
        axes at its own step. A then B gives the matrix B·A. B then A uses the same two
        boost matrices in the opposite order, giving A·B. Both final velocities below are
        measured against the original axes of K.
      </p>
      <table className="inference-summary">
        <caption>Final motion and orientation for each order</caption>
        <thead><tr><th scope="col">Measurement</th><th scope="col">A then B</th><th scope="col">B then A</th></tr></thead>
        <tbody>
          {rows.map(([label, forward, reverse]) => (
            <tr key={reverse}>
              <th scope="row">{label}</th>
              <td>{reading(forward)}</td><td data-output={reverse}>{reading(reverse)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Reversing the order preserves the speed. With two nonzero boosts at an angle to
        one another, the velocity components change and the axes rotations have opposite signs.
        Along one line, the boosts commute and the rotation vanishes. The rotation is a later
        geometric result beyond Einstein’s §5.
      </p>
      {matrix?.length === 16 && (
        <details>
          <summary>Inspect the reversed 4 × 4 transformation</summary>
          <table className="sr06-matrix">
            <caption>B then A, acting on (ct, x, y, z)</caption>
            <thead><tr><th scope="col">Row</th>{["ct", "x", "y", "z"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
            <tbody>
              {["ct", "x", "y", "z"].map((label, i) => (
                <tr key={label}><th scope="row">{label}</th>
                  {[0, 1, 2, 3].map(j => <td key={j}>{sentenceNumber(matrix.at(4 * i + j), 6)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Divide the negatives of the ct row’s x and y entries by its ct entry to recover
            the final frame’s velocity components in K, in units of c.
          </p>
        </details>
      )}
    </section>
  );
}
