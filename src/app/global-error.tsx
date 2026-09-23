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
          <p>
            Part of the site&rsquo;s code failed while drawing it. That is a fault in the software,
            and it says nothing about the papers or their physics.
          </p>
          <button type="button" onClick={reset}>
            Try this page again
          </button>
        </section>
      </body>
    </html>
  );
}
