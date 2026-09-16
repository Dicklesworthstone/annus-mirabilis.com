import type { WorkedExample as WorkedExampleRecord } from "../content/schemas/argument";

/**
 * Renders a Foundation or Bridge's five-part worked example
 * (am-found-library-infra-002t). Pure and presentational: no storage read
 * or write, no analytics, no onToggle handler of any kind. The decisive
 * step is a native `<details>`, so opening it is the browser's own
 * behavior with zero JavaScript — nothing about a reader opening it is
 * observable to this component, let alone logged.
 *
 * `detail` selects the server-computed default open state (open at
 * "Show every step", closed otherwise). Live, no-remount reactivity to a
 * later client-side Detail change belongs to whichever future integration
 * wires this into the reader shell's Detail axis (am-read-detail-axis-sfc);
 * this component only guarantees the correct state for whatever `detail`
 * it is given, including on first paint and in print.
 */
export type Detail = 0 | 1 | 2;

export function WorkedExample({
  example,
  detail,
}: {
  example: WorkedExampleRecord;
  detail: Detail;
}) {
  return (
    <div className="worked-example" data-worked-example>
      <p className="worked-example-question" data-example-part="question">
        {example.question}
      </p>
      <p className="worked-example-given" data-example-part="given">
        <strong>Given:</strong> {example.given}
      </p>
      <p className="worked-example-first-thought" data-example-part="plausibleFirstThought">
        <strong>A reasonable first thought:</strong> {example.plausibleFirstThought}
      </p>
      <details data-example-part="decisiveStep" data-decisive-step open={detail === 2}>
        <summary>Show the decisive step</summary>
        <p>{example.decisiveStep}</p>
      </details>
      <p className="worked-example-limitation" data-example-part="limitation">
        <strong>Where this example stops:</strong> {example.limitation}
      </p>
    </div>
  );
}
