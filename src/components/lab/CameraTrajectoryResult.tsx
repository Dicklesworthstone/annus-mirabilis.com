import type { CameraTrajectoryAnalysis } from "../../experiments/bm07/trajectoryCamera.ts";

const display = (value: number) => (value === 0 ? "0" : value.toExponential(5));
const PREVIEW_PAIRS = 32;

/** Read only the accepted model and pairing receipt, never the current draft. */
export function CameraTrajectoryResult({ analysis }: { analysis: CameraTrajectoryAnalysis }) {
  const { camera, pairing } = analysis;
  if (!pairing) return null;
  return (
    <section aria-label="Accepted camera analysis">
      <h4>Disjoint frame pairs, not adjacent noisy displacements</h4>
      <p>
        Selected {pairing.pairs.length} complete pair(s) from {pairing.contributingTracks} track(s).
        Pairs never cross a track boundary or reuse a frame. All original positions remain in both
        observation exports.
      </p>
      <p>
        {pairing.unpairedRows.length === 0
          ? "Every imported frame belongs to a selected pair."
          : `Unmatched final frames, not used in this estimate: CSV row(s) ${pairing.unpairedRows.join(", ")}. They have not been removed from the observations.`}
      </p>
      {camera && (
        <table className="inference-summary" data-analysis-model="camera-disjoint-pairs">
          <caption>Camera-aware diffusion · host reference calculation · inputs held exact</caption>
          <thead>
            <tr>
              <th scope="col">Quantity</th>
              <th scope="col">Result</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Noise-corrected diffusion estimate (not clipped)</th>
              <td>{display(camera.estimate)} m²/s</td>
            </tr>
            <tr>
              <th scope="row">Disjoint frame pairs used</th>
              <td>{camera.pairs}</td>
            </tr>
            <tr>
              <th scope="row">Degrees of freedom after fitting drift</th>
              <td>{camera.q}</td>
            </tr>
            <tr>
              <th scope="row">Conditional physical diffusion confidence set</th>
              <td>
                {camera.empty
                  ? "Empty physical confidence set; not replaced by zero."
                  : camera.interval
                    ? `[${display(camera.interval.lower)}, ${display(camera.interval.upper)}] m²/s`
                    : "Not available; no interval is implied."}
              </td>
            </tr>
            <tr>
              <th scope="row">Declared localization variance (held exact)</th>
              <td>{display(camera.noiseInterval[0])} m²</td>
            </tr>
          </tbody>
        </table>
      )}
      <details>
        <summary>Inspect the selected CSV row pairs</summary>
        <p className="fine">
          Showing the first {Math.min(PREVIEW_PAIRS, pairing.pairs.length)} of {pairing.pairs.length}
          {" "}pairs. The accepted-analysis JSON contains the complete pairing receipt and all
          observations. Row numbers refer to the original CSV, including its header.
        </p>
        <table>
          <caption>Pair selection within each original track</caption>
          <thead>
            <tr>
              <th scope="col">Track</th>
              <th scope="col">First frame row</th>
              <th scope="col">Second frame row</th>
            </tr>
          </thead>
          <tbody>
            {pairing.pairs.slice(0, PREVIEW_PAIRS).map((pair) => (
              <tr key={pair.firstRow}>
                <th scope="row">{pair.track}</th>
                <td>{pair.firstRow}</td>
                <td>{pair.secondRow}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
