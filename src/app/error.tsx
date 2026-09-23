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
      <p>
        Part of the site&rsquo;s code failed while drawing it. That is a fault in the software, and
        it says nothing about the papers or their physics.
      </p>
      <button type="button" onClick={reset}>
        Try this page again
      </button>
      <p>
        <a href="/">Go to the home page</a>
      </p>
    </section>
  );
}
