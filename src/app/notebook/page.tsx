import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your private reading notebook",
  description: "Keep questions, examples and notes on your own device, with explicit local export.",
};

export default function NotebookPage() {
  return (
    <article className="reading">
      <header className="page-intro">
        <p className="eyebrow">Read · Keep your questions</p>
        <h1>Your reading notebook</h1>
        <p className="lead">
          Save a question, an example or a next step without losing the argument. Add your own
          notes, then return to the same passage and reading view.
        </p>
      </header>
      <p>
        <a className="button" href="/notebook/" data-open-notebook>
          Open your notebook
        </a>
      </p>
      <p>
        On a paper page, use Save question, Save next step or Add a note beside a passage. Save
        example is offered where an authored example exists. Saved example links reopen the
        foundation beside its original passage.
      </p>
      <h2>Keep the evidence behind an explanation</h2>
      <p>
        In the <a href="/lab/bm-01/compare/">controlled Brownian comparison</a>, use “Save this
        comparison and my explanation” to keep accepted results, exact seeds, the one-change replay
        recipe, and your before-and-after explanation. Open that entry here to inspect what you saw
        or explicitly start a new replay. Old evidence stays labeled and separate when the model or
        passage changes.
      </p>
      <h2>Only on this device</h2>
      <p>
        Nothing in the notebook is uploaded or used to assess you. Questions and free text never
        enter a shareable passage URL. Saved comparisons and their optional predictions stay in this
        same notebook; unrelated discovery notes keep their own existing storage.
      </p>
      <p>
        Browser storage is not a permanent backup. Export important entries as JSON or a readable
        HTML document before changing devices or clearing browser data. When saving is blocked or
        full, this tab keeps your work and offers export. Unsupported saved versions remain
        available as a preserved-original export rather than being overwritten.
      </p>
      <h2>Continue where you were</h2>
      <p>
        After you interact with a reading passage, its location and authored recap are kept locally.
        A later visit offers a dismissible reminder. A link to another passage always takes
        precedence; there is no forced detour or requirement to redo anything.
      </p>
      <noscript>
        <p className="notice">
          JavaScript is off. Your private notebook cannot be loaded or edited here without
          JavaScript. The papers, explanations and outlines remain readable.
        </p>
      </noscript>
      <div className="actions">
        <a href="/papers/">Open the papers and outlines →</a>
        <a href="/discover/brownian-motion/">Start with the Brownian encounter →</a>
      </div>
    </article>
  );
}
