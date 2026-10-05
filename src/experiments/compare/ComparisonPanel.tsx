import type { Baseline, ComparisonValue } from "./Baseline.ts";
import { comparisonDownload } from "./comparisonExport.ts";
import {
  COMPARISON_UNCERTAINTY_NOTE,
  comparisonInputRole,
  comparisonReadoutText,
  comparisonUncertaintyText,
} from "./comparisonPresentation.ts";
import { comparisonDisplay } from "./comparisonStatement.ts";
import type { ComparisonNumber, ComparisonResult } from "./compatibility.ts";
import type { ComparisonContract } from "./singleVariationLock.ts";

function Readout({
  result,
  factor,
  unit,
}: {
  result: ComparisonValue;
  factor: number;
  unit: string;
}) {
  const uncertainty = comparisonUncertaintyText(result, factor, unit);
  return (
    <div data-result-status={result.status}>
      <span>{comparisonReadoutText(result, factor)}</span>
      {uncertainty && <p data-comparison-uncertainty>{uncertainty}</p>}
      {result.evidence && (
        <details>
          <summary>Inspect scientific evidence</summary>
          <p>Evidence retains its stored units; the readout above may use converted units.</p>
          <pre>{JSON.stringify(result.evidence, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}

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
  const download =
    result.kind === "accepted" ? comparisonDownload(baseline, variant, contract) : null;
  const hasUncertainty =
    result.kind === "accepted" &&
    result.rows.some((row) =>
      [row.baseline, row.variant].some(
        (entry) => entry.evidence?.status === "value" && entry.evidence.uncertainty,
      ),
    );
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
                  <td>{comparisonInputRole(fixed, input.command)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <h3>What changed as a consequence?</h3>
      {hasUncertainty && <p>{COMPARISON_UNCERTAINTY_NOTE}</p>}
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
                    <td>
                      <Readout
                        result={row.baseline}
                        factor={metadata.displayFactor}
                        unit={metadata.displayUnit}
                      />
                    </td>
                    <td>
                      <Readout
                        result={row.variant}
                        factor={metadata.displayFactor}
                        unit={metadata.displayUnit}
                      />
                    </td>
                    <td data-comparison-ratio>{number(row.ratio)}</td>
                    <td>{number(row.difference, metadata.displayFactor)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
      {download && (
        <section aria-label="Save comparison">
          <h3>Keep this comparison</h3>
          <p>
            Save the completed inputs, readouts, scientific evidence, and calculation identities.
            This is a comparison record, not a replay tape.
          </p>
          {download.kind === "ready" ? (
            <a href={download.href} download={download.filename}>
              Download comparison record (JSON)
            </a>
          ) : (
            <p className="notice">{download.message}</p>
          )}
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
