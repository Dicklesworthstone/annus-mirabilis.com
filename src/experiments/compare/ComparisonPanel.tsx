import type { Baseline, ComparisonValue } from "./Baseline.ts";
import { comparisonDisplay } from "./comparisonStatement.ts";
import type { ComparisonNumber, ComparisonResult } from "./compatibility.ts";
import type { ComparisonContract } from "./singleVariationLock.ts";

const value = (result: ComparisonValue, factor: number) =>
  result.status === "value" && result.value !== null
    ? comparisonDisplay(result.value, factor)
    : `${result.status}: ${result.reason}`;
const number = (result: ComparisonNumber, factor = 1) =>
  result.status === "value"
    ? comparisonDisplay(result.value, factor)
    : `Not applicable: ${result.reason}`;

/** All cells read the same pair of frozen accepted projections, never requested parameters. */
export function ComparisonPanel({
  baseline,
  variant,
  contract,
  result,
}: {
  baseline: Baseline;
  variant: Baseline;
  contract: ComparisonContract;
  result: ComparisonResult;
}) {
  return (
    <div
      data-comparison-results
      data-baseline-run-id={baseline.runId}
      data-variant-run-id={variant.runId}
      data-baseline-snapshot={baseline.snapshotVersion}
      data-variant-snapshot={variant.snapshotVersion}
    >
      <h3>What was held fixed?</h3>
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a horizontally scrollable
          region must be keyboard focusable so keyboard-only readers can scroll it;
          WCAG 2.1 SC 2.1.1. The semantic element satisfies useSemanticElements. */}
      <section className="comparison-scroll" aria-label="Comparison inputs" tabIndex={0}>
        <table>
          <caption>Independent inputs · values belong to the completed results below</caption>
          <thead>
            <tr>
              <th scope="col">Input</th>
              <th scope="col">Unit</th>
              <th scope="col">Baseline</th>
              <th scope="col">Variant</th>
              <th scope="col">Role</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(contract.inputs).map(([key, input]) => {
              const a = baseline.parameters[key],
                b = variant.parameters[key];
              const fixed = Object.is(a, b);
              return (
                <tr key={key} data-comparison-input={key}>
                  <th scope="row">{input.label}</th>
                  <td>{input.unit || "no unit"}</td>
                  <td>
                    {a === undefined ? "Unavailable" : comparisonDisplay(a, input.displayFactor)}
                  </td>
                  <td>
                    {b === undefined ? "Unavailable" : comparisonDisplay(b, input.displayFactor)}
                  </td>
                  <td>
                    {fixed
                      ? "Held fixed (locked)"
                      : input.command === "measurement-change"
                        ? "Measurement changed"
                        : input.command === "observer-change"
                          ? "Re-described"
                          : "Physically changed"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <h3>What changed as a consequence?</h3>
      {result.kind === "refused" ? (
        <p className="notice" data-comparison-refusal={result.code}>
          {result.message}
        </p>
      ) : (
        <section
          className="comparison-scroll"
          aria-label="Comparison outputs"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard focusable so keyboard-only readers can scroll it (WCAG 2.1 SC 2.1.1)
          tabIndex={0}
        >
          <table>
            <caption>Accepted readouts · ratio means variant divided by baseline</caption>
            <thead>
              <tr>
                <th scope="col">Quantity</th>
                <th scope="col">Unit</th>
                <th scope="col">Baseline</th>
                <th scope="col">Variant</th>
                <th scope="col">Ratio</th>
                <th scope="col">Difference</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => {
                const metadata = contract.outputs.find((output) => output.id === row.id);
                if (!metadata) return null;
                return (
                  <tr key={row.id} data-comparison-output={row.id}>
                    <th scope="row">{metadata.label}</th>
                    <td>{metadata.displayUnit}</td>
                    <td>{value(row.baseline, metadata.displayFactor)}</td>
                    <td>{value(row.variant, metadata.displayFactor)}</td>
                    <td data-comparison-ratio>{number(row.ratio)}</td>
                    <td>{number(row.difference, metadata.displayFactor)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
      <details>
        <summary>Inspect the two accepted identities</summary>
        {[
          { label: "Baseline", entry: baseline },
          { label: "Variant", entry: variant },
        ].map(({ label, entry }) => {
          return (
            <section key={label}>
              <h4>{label}</h4>
              <p className="comparison-identity">
                Instance: {entry.instanceId}; run: {entry.runId}; snapshot: {entry.snapshotVersion};
                accepted input revision: {entry.acceptedInputRevision}.
              </p>
              <p className="comparison-identity">
                Model: {entry.identity.modelVersion}; constants: {entry.identity.constantSetId};
                stream: {entry.identity.streamVersion}; allocation: {entry.identity.allocationId};
                executable: {entry.identity.sourceDigest}.
              </p>
              <p>
                {entry.identity.artifactDigest === null
                  ? "Host calculation; no WASM artifact is claimed."
                  : entry.identity.artifactDigest}
              </p>
            </section>
          );
        })}
      </details>
    </div>
  );
}
