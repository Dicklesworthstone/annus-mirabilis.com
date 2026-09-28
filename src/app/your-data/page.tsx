import type { Metadata } from "next";
import { DataPanel } from "../../platform/storage/DataPanel.tsx";
import { SEED_ENTRIES } from "../../platform/storage/keys.ts";
import "../../platform/storage/dataPanel.css";

/**
 * THE KEY LIST IS READ FROM THE REGISTRY, NOT TYPED HERE (dispatch 389).
 *
 * Every name a reader is told to look for comes from src/platform/storage/keys.ts, the same
 * registration the store itself uses, so a key added or renamed there appears here in the same
 * build. A hand-typed list on a page whose whole purpose is that a reader can CHECK it would be
 * the one thing worse than no list.
 */
const SETTINGS = SEED_ENTRIES.filter((entry) => entry.kind === "setting");
const DOCUMENTS = SEED_ENTRIES.filter((entry) => entry.kind === "document");

export const metadata: Metadata = {
  title: "Your data on this device",
  description:
    "Review, export, or clear the reading preferences, notes, predictions, and tour progress stored locally on your device.",
};

export default function YourDataPage() {
  return (
    // A <div>: the layout already renders the page's one <main id="main">, and a second nested
    // inside it gave this page two main landmarks.
    <div className="your-data-page">
      <header className="page-intro">
        <p className="eyebrow">Your data</p>
        <h1>Your data stays on your device.</h1>
        <p className="lead">
          Annus Mirabilis has no accounts, no logins, no advertising and no tracking cookies. Your
          reading preferences, notes, predictions and tour progress are kept in this browser&rsquo;s
          own storage, and nowhere else.
        </p>
      </header>

      <section
        data-testid="privacy-guarantees"
        aria-label="What this site promises about your data"
        className="privacy-guarantees"
      >
        <div className="privacy-card">
          <h2 className="privacy-card-title">Nothing you save is sent</h2>
          <p className="privacy-card-desc">
            No server receives your notes, settings or predictions. Open your browser&rsquo;s
            network panel and read this site: the only things it asks for are its own pages, fonts,
            figures, and the files an instrument needs when you open one.
          </p>
        </div>

        <div className="privacy-card">
          <h2 className="privacy-card-title">Take it with you</h2>
          <p className="privacy-card-desc">
            &ldquo;Download all of it&rdquo; below writes one JSON file named{" "}
            <code>annus-mirabilis-data-</code> and today&rsquo;s date. It contains every key listed
            on this page that has anything in it.
          </p>
        </div>

        <div className="privacy-card">
          <h2 className="privacy-card-title">Delete it yourself</h2>
          <p className="privacy-card-desc">
            Clear one kind, or all of it, from the panel below. Either way the site asks you to
            confirm on the page itself first, and clearing reaches this browser and nothing else.
          </p>
        </div>
      </section>

      <noscript>
        <div data-testid="noscript-notice" className="noscript-notice callout-note">
          <p className="noscript-title">JavaScript is currently disabled.</p>
          <p className="noscript-desc">
            With JavaScript disabled, the interactive data viewer below is not available, and local
            storage is not accessed. Your stored data remains untouched on this device. To inspect,
            export, or clear data interactively, enable JavaScript.
          </p>
        </div>
      </noscript>

      <section className="reading" aria-labelledby="key-names">
        <h2 id="key-names">The names to look for</h2>
        <p>
          Everything this site keeps is under a key beginning <code>am:</code> in this
          browser&rsquo;s local storage. You do not have to take that on trust: open your
          browser&rsquo;s developer tools, find local storage for this site, and compare what is
          there against this list. Anything under <code>am:</code> that is not named here is a
          defect, and nothing else on the page can tell you that.
        </p>
        <h3>Settings, one short value each</h3>
        <ul className="storage-key-list">
          {SETTINGS.map((entry) => (
            <li key={entry.key}>
              <code>{entry.key}</code> <span>{entry.label}</span>
            </li>
          ))}
        </ul>
        <h3>Work you saved</h3>
        <ul className="storage-key-list">
          {DOCUMENTS.map((entry) => (
            <li key={entry.key}>
              <code>{entry.key}</code> <span>{entry.label}</span>
            </li>
          ))}
        </ul>
        <p>
          Every one of them is included in the download and removed by a clear. Reading continues if
          your browser blocks storage or runs out of room: the site loses your place and your
          preferences, not the text.
        </p>
      </section>

      <section className="reading" aria-labelledby="not-built">
        <h2 id="not-built">One of these is not built yet</h2>
        <p>
          <code>am:clarity:v1</code> is reserved for a one-click &ldquo;this was clear / this was
          not&rdquo; answer under a paragraph, recording the detail level and the anchor and nothing
          about you. The key is registered and the control is not written, so as of today nothing
          writes to it and there is nothing in it to export. It is named here anyway, because a list
          that quietly left it out would be a list you could not check.
        </p>
      </section>

      <section className="reading" aria-labelledby="where-next">
        <h2 id="where-next">Where to go next</h2>
        <ul>
          <li>
            <a href="/about/">About this edition</a> says who made it, what is reviewed and what is
            not.
          </li>
          <li>
            <a href="/accessibility/">Accessibility</a> says what has been checked and by what
            method.
          </li>
          <li>
            The <strong>Reading preferences</strong> button in the header, beside the theme control,
            is where most of the settings above are set.
          </li>
          <li>
            <a href="/sources/">Sources</a> shows where the papers themselves come from, which is
            the other half of what this site asks you to trust.
          </li>
        </ul>
      </section>

      <section aria-label="The data stored in this browser" className="data-management-section">
        <DataPanel />
      </section>
    </div>
  );
}
