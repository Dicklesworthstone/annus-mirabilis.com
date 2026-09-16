"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="reading">
      <h1>This page could not be displayed.</h1>
      <p>No scientific conclusion follows from this software failure.</p>
      <button type="button" onClick={reset}>
        Try this page again
      </button>
      <p>
        <a href="/">Return to Annus Mirabilis</a>
      </p>
    </section>
  );
}
