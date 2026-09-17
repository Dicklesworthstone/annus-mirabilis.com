/**
 * Markup contract for reading-only (am-a11y-reading-only-6wwd): the
 * explanation and the static worked case stay in the served HTML.
 * Motion and expense are deferred; content is not removed.
 */

export function ReadingOnlyKeepContent({
  explanation,
  workedCase,
}: {
  explanation: string;
  workedCase: string;
}) {
  return (
    <div data-reading-only-surface data-execution-label="static">
      <section data-explanation>
        <h2>Explanation</h2>
        <p>{explanation}</p>
      </section>
      <section data-static-worked-case data-worked-example>
        <h2>Static worked case</h2>
        <p>{workedCase}</p>
      </section>
    </div>
  );
}
