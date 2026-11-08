/** A bad prepared case must fail explicitly, with the standalone laboratory still reachable. */
export function PreparedExampleNotice({ id }: { id: string }) {
  return (
    <p className="notice" role="alert">
      This laboratory's prepared example did not pass its own check, so it cannot be shown here.{" "}
      <a href={`/lab/${id}/`}>Open the full laboratory</a>.
    </p>
  );
}
