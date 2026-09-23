import type { Metadata } from "next";
import { DataPanel } from "../../platform/storage/DataPanel.tsx";
import "../../platform/storage/dataPanel.css";

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
          <h2 className="privacy-card-title">No network transmission</h2>
          <p className="privacy-card-desc">
            Stored data never leaves your device. No analytics, tracking beacons, or cloud sync
            services are used.
          </p>
        </div>

        <div className="privacy-card">
          <h2 className="privacy-card-title">Take it with you</h2>
          <p className="privacy-card-desc">
            Download everything you have saved, your notes and predictions included, as one JSON
            file, whenever you like.
          </p>
        </div>

        <div className="privacy-card">
          <h2 className="privacy-card-title">Delete it yourself</h2>
          <p className="privacy-card-desc">
            Clear one kind of saved data, or all of it, from the panel below. Clearing affects this
            browser only.
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

      <section aria-label="The data stored in this browser" className="data-management-section">
        <DataPanel />
      </section>
    </div>
  );
}
