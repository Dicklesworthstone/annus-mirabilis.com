import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your private reading notebook",
  description: "Keep questions, examples and notes on your own device, with explicit local export.",
};

export default function NotebookPage() {
  return (
    <article className="reading">
      <header className="page-intro">
        <p className="eyebrow">Notebook</p>
        <h1>Your reading notebook</h1>
        <p className="lead">
          Save a question, an example or a next step without losing the argument. Add your own
          notes, then return to the same passage and reading view.
        </p>
      </header>
      {/*
        THE BUTTON USED TO LINK TO THIS PAGE. It read `href="/notebook/"` while standing ON
        /notebook/, and relied on the notebook script intercepting the click to open the panel.
        With JavaScript off, or before hydration, pressing the site's most prominent control
        reloaded the page the reader was already on and nothing happened. AGENTS.md is explicit:
        "No-JavaScript readers get real links, never hydration-dependent buttons."

        The panel still opens the same way for readers who have the script, through
        data-open-notebook, which browser.ts already delegates on. What changes is that the
        control is now a <button> that is DISABLED until the script arrives, so a reader without
        it meets a control that visibly cannot be pressed rather than one that silently does
        nothing. The noscript block below already explains why.
      */}
      <p>
        <button className="button" type="button" data-open-notebook disabled>
          Open your notebook
        </button>
      </p>
      {/* What goes in it, how it stays private, and how to keep a copy: three short blocks a
          reader can scan, where four paragraphs of equal weight used to run on. Every fact from
          those paragraphs is kept. */}
      <div className="notebook-guide">
        <section aria-labelledby="notebook-add">
          <h2 id="notebook-add">What goes in it</h2>
          <ul>
            <li>
              The bookmark beside each passage heading on a paper page opens{" "}
              <strong>Save question</strong>, <strong>Save next step</strong> and{" "}
              <strong>Add a note</strong>. With a mouse it appears when you point at the passage.
            </li>
            <li>
              <strong>Save example</strong> appears where a worked example exists; a saved example
              reopens its lesson beside the passage it came from.
            </li>
            <li>
              In the <a href="/lab/bm-01/compare/">controlled Brownian comparison</a>,{" "}
              <strong>Save this comparison and my explanation</strong> keeps the results, the exact
              seeds, the one change you made and your before-and-after explanation. Open it here to
              look again, or start a new replay on purpose. If the model or the passage changes
              later, the old record stays, labelled as old.
            </li>
          </ul>
        </section>
        <section aria-labelledby="notebook-private">
          <h2 id="notebook-private">Only on this device</h2>
          <p>
            Nothing in the notebook is uploaded or used to assess you. Your questions and notes
            never go into a passage link you share. Saved comparisons and their predictions stay in
            this notebook; notes from the discovery pages keep their own storage.
          </p>
        </section>
        <section aria-labelledby="notebook-copy">
          <h2 id="notebook-copy">Keep a copy</h2>
          <p>
            Browser storage is not a permanent backup. Export what matters, as JSON or as a readable
            HTML page, before you change devices or clear your browser. If saving is blocked or the
            storage is full, this tab keeps your work and offers the export. A notebook saved by an
            older version of the site is kept as it was and offered as an export, never overwritten.
          </p>
        </section>
        <section aria-labelledby="notebook-return">
          <h2 id="notebook-return">Continue where you were</h2>
          <p>
            Once you have worked with a passage, its place and its recap are kept on this device,
            and a later visit offers to take you back. You can dismiss it; a link to another passage
            always wins, and nothing has to be redone.
          </p>
        </section>
      </div>
      <noscript>
        <p className="notice">
          JavaScript is off. Your private notebook cannot be loaded or edited here without
          JavaScript. The papers, explanations and outlines remain readable.
        </p>
      </noscript>
      <div className="actions">
        <a href="/papers/">Open the papers and outlines</a>
        <a href="/discover/brownian-motion/">Start with the Brownian encounter</a>
      </div>
    </article>
  );
}
