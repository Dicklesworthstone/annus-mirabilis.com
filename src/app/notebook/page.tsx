import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your private reading notebook",
  description:
    "Keep questions, worked examples and notes in this browser, and download them as a file to keep.",
};

export default function NotebookPage() {
  return (
    // The introduction sits outside the reading column, as on the other top-level pages, so the
    // page starts at the header's left edge and top rather than 280px in and 64px down at 1440.
    <article>
      <header className="page-intro page-flush">
        <p className="eyebrow">Notebook</p>
        <h1>Your reading notebook</h1>
        <p className="lead">
          Save a question, an example or a next step without losing your place in the argument. Add
          your own notes, and come back later to the same passage, in the same view.
        </p>
      </header>
      <div className="reading page-flush">
        {/*
        THE NOTEBOOK ITSELF, not a button that opens it (TanElk's ruling 66.1). The notebook script,
        which the header's Notebook link already loads on every page, renders the saved places,
        questions, next steps and notes into this host, with export, import and clear beside them,
        because they live only in this browser and the server never sees them. Nothing renders here
        without JavaScript, so the notice that says so sits in the same place.

        It replaced a disabled "Open your notebook" button, which opened a modal over this very page.
      */}
        <div data-notebook-inline />
        <noscript>
          <p className="notice">
            The notebook needs JavaScript, which is off in this browser. The papers, explanations
            and outlines read without it.
          </p>
        </noscript>
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
                <strong>Save this comparison and my explanation</strong> keeps the results, the
                exact seeds, the one change you made and your before-and-after explanation. Open it
                here to look again, or run it again on purpose. If the model or the passage changes
                later, the old record stays, labelled as old.
              </li>
            </ul>
          </section>
          <section aria-labelledby="notebook-private">
            <h2 id="notebook-private">Only on this device</h2>
            <p>
              Nothing in the notebook is uploaded or used to assess you. Your questions and notes
              never go into a passage link you share. Saved comparisons and their predictions stay
              in this notebook; notes from the discovery pages keep their own storage.
            </p>
          </section>
          <section aria-labelledby="notebook-copy">
            <h2 id="notebook-copy">Keep a copy</h2>
            <p>
              Browser storage is not a permanent backup. Export what matters, as JSON or as a
              readable HTML page, before you change devices or clear your browser. If saving is
              blocked or the storage is full, this tab keeps your work and offers the export. A
              notebook saved by an older version of the site is kept as it was and offered as an
              export, never overwritten.
            </p>
          </section>
          <section aria-labelledby="notebook-return">
            <h2 id="notebook-return">Continue where you were</h2>
            <p>
              Once you have worked with a passage, its place and a short recap are kept on this
              device, and on a later visit the home page and the papers index offer, in one line, to
              take you back. You can dismiss the offer, and a link you follow to another passage
              always takes you there instead.
            </p>
          </section>
        </div>
        <div className="actions">
          <a href="/papers/">Open the papers and outlines</a>
          <a href="/discover/brownian-motion/">Start with Brownian motion in Discover</a>
        </div>
      </div>
    </article>
  );
}
