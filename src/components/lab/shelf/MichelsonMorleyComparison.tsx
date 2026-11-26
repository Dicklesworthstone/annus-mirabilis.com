import { primaryShelfMetrics, type ShelfReport } from "../../../experiments/shelfOptics/state.ts";
import type { AcceptedSnapshot } from "../../../experiments/store/instanceStore.ts";
import { sentenceNumber } from "../presentation.ts";

// Michelson and Morley, American Journal of Science 34 (1887), pp. 336, 341.
// Both limits refer to the authors' *printed* expectation, even when a reader changes the model.
const publishedExpectation = 0.4;
const upperLimit = publishedExpectation / 20;
const probableLimit = publishedExpectation / 40;

type Props = { historical: AcceptedSnapshot } | { modern: ShelfReport };

function acceptedShifts(props: Props) {
  if ("modern" in props) {
    const { parameters } = props.modern;
    if (parameters.instrumentId !== "shelf-michelson-morley") return null;
    const points = primaryShelfMetrics(props.modern);
    const shift = (model: string) =>
      points.find((p) => p.modelId === model && p.quantityId === "fringeShift" && p.unit === "fringes")?.value;
    return {
      pathInWavelengths: parameters.armLength / parameters.wavelength,
      beta: parameters.beta,
      ether: shift("mm-ether"),
      contracted: shift("mm-ether-contraction"),
    };
  }
  const { parameters, outputs } = props.historical;
  const shift = (key: string) => {
    const r = outputs.find((o) => o.quantityId === key && o.semanticKind === "fringe-shift" && o.unit === "dimensionless");
    return r?.status === "value" && typeof r.value === "number" ? r.value : undefined;
  };
  return {
    pathInWavelengths: parameters.pathInWavelengths,
    beta: parameters.beta,
    ether: shift("etherShift"),
    contracted: shift("contractedShift"),
  };
}

/** The printed upper limits stay fixed. Only an accepted quarter-turn prediction can be compared. */
export function MichelsonMorleyComparison(props: Props) {
  const shifts = acceptedShifts(props);
  if (!shifts) return null;
  const sourceScale = typeof shifts.pathInWavelengths === "number" &&
    Math.abs(shifts.pathInWavelengths / 2e7 - 1) < 1e-12 &&
    typeof shifts.beta === "number" && Math.abs(shifts.beta) === 1e-4;
  return (
    <section className="reading" aria-label="Michelson and Morley’s published limits" data-mm-source-scale={sourceScale}>
      <h3>How large a shift did Michelson and Morley see?</h3>
      <p>
        In 1887 they estimated that a quarter-turn would move the fringes by {publishedExpectation} of a fringe
        if the apparatus travelled through a stationary ether at the Earth’s orbital speed.
        Their effective arm was about 20 million wavelengths long. They judged the displacement
        certainly below {upperLimit} fringe and probably below {probableLimit} fringe.
        These are their two upper limits on the same signal. The paper gives neither an exact
        zero nor a statistical confidence level for either limit.
      </p>
      <p>
        {sourceScale
          ? "Your calculation uses the paper’s approximate path in wavelengths and its assumed orbital speed ratio."
          : "You have changed the path in wavelengths or the assumed speed ratio. These predictions are for your apparatus. The 1887 limits still describe the original experiment."}
      </p>
      <table>
        <caption>Predicted quarter-turn shift compared with the published upper limit of 0.02 fringe</caption>
        <thead><tr><th scope="col">Hypothesis</th><th scope="col">Shift (fringes)</th><th scope="col">Compared with the limit</th></tr></thead>
        <tbody>
          {([["Without contraction", shifts.ether], ["With longitudinal contraction", shifts.contracted]] as const).map(([label, value]) => {
            const magnitude = typeof value === "number" && Number.isFinite(value) ? Math.abs(value) : null;
            return (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{magnitude === null ? "Unavailable" : sentenceNumber(magnitude, 3)}</td>
                <td>{magnitude === null ? "No accepted shift" : magnitude >= upperLimit ? "At or above the limit" : "Below the limit"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p>
        At the paper’s assumed speed, a rigid apparatus gives a shift about twenty times the larger
        limit. Longitudinal contraction makes the two round trips equal. This experiment alone cannot
        distinguish accounts that both predict a vanishing shift.
      </p>
      <p><a href="https://history.aip.org/exhibits/gap/PDF/michelson.pdf#page=5">
        Read the authors’ comparison on printed page 341
      </a> of their November 1887 paper. Figure 6 draws the theoretical curves at one-eighth scale.</p>
    </section>
  );
}
