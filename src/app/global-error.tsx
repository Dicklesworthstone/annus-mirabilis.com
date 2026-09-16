"use client";
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <section className="reading">
          <h1>This page could not be displayed.</h1>
          <p>No scientific conclusion follows from this software failure.</p>
          <button type="button" onClick={reset}>
            Try this page again
          </button>
        </section>
      </body>
    </html>
  );
}
