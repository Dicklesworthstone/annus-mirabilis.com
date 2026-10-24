import type { WorkedExample as WorkedExampleRecord } from "../content/schemas/argument";

/**
 * NO CALLER, AND NO RECORD TO RENDER EITHER (am-50bk triage, 2026-10-24). The gap here is
 * authoring, not wiring, which is the opposite of what "unused component" usually means.
 *
 * This renders the `WorkedExample` type of `src/content/schemas/argument.ts`: the five parts
 * `question`, `given`, `plausibleFirstThought`, `decisiveStep`, `limitation`. Measured over the
 * whole corpus, NOTHING carries that shape. `plausibleFirstThought` appears in no content file at
 * all -- only in the schema, its fixtures and its tests. The 45 records in `content/foundations/`
 * carry a different shape (`question`, `explanation`, `example`, `exampleTitle`, `summary`,
 * `stoppingPoint`), and all four `bridge` records embedded in the entrance records omit the field,
 * which `Bridge` makes optional.
 *
 * SO OUTCOME 2 IS NOT UNMET. AGENTS.md's "Unfamiliar mathematics opens into an explanation with a
 * worked example" is delivered: `FoundationBody` in `src/reader/Blocks.tsx` renders every lesson's
 * worked example from its `example` blocks under a "Worked example" heading, and that is what a
 * reader gets on `/foundations/<concept>/`. What is absent is this particular five-part structure,
 * whose value is naming the plausible first thought and the limitation explicitly.
 *
 * Mounting this component would therefore render nothing. The work it waits on is editorial -- a
 * record authored in that shape -- and it belongs to am-found-library-infra-002t. Kept under
 * RULE 1.
 *
 * ---- as authored ----
 *
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
