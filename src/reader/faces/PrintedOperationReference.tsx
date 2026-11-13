import type {
  PrintedOperation,
  PrintedOperationReading,
} from "../../equations/printed/sourceSemantics.ts";

/** Shared authored words for the in-place explorer and its complete no-JavaScript destination. */
export function PrintedOperationNote({ operation }: { operation: PrintedOperation }) {
  return (
    <span className="printed-operation-note" data-operation-note={operation.id}>
      <strong>{operation.title}</strong>
      <span>
        <strong>What it does. </strong>
        {operation.does}
      </span>
      <span>
        <strong>Why this is allowed. </strong>
        {operation.why}
      </span>
      <span>Dimension: {operation.dimension}.</span>
      <a
        href={`/foundations/${operation.foundation}/`}
        data-foundation={operation.foundation}
        data-return-caption={`Return to the printed operation: ${operation.title}.`}
      >
        Read the prerequisite: {operation.foundationTitle}
      </a>
    </span>
  );
}

/** The existing equation page is also the permanent reference for every nested operation. */
export function PrintedOperationReference({
  reading,
  spoken,
}: {
  reading: PrintedOperationReading;
  spoken: string;
}) {
  return (
    <section id="operations" className="printed-operation-reference">
      <h2>What each operation does</h2>
      <p>{reading.context}</p>
      <p>{reading.premise}</p>
      <details>
        <summary>Read it aloud</summary>
        <p>{spoken}</p>
      </details>
      <p>
        Dimensional check: {reading.dimension}. In a relation, this is the dimension on both sides.
        This checks unit consistency under the paper's quantity bindings; it does not prove a
        physical premise or an approximation.
      </p>
      {[...reading.operations]
        .sort((a, b) => Number(b.primary) - Number(a.primary))
        .map((operation) => (
          <details key={operation.id} id={`operation-${operation.id}`} open={operation.primary}>
            <summary>
              {operation.title}
              {operation.primary ? " · a step in the argument" : " · nested arithmetic"}
            </summary>
            <PrintedOperationNote operation={operation} />
          </details>
        ))}
      <p>
        <a href={reading.next.href}>{reading.next.label} →</a>
      </p>
    </section>
  );
}
