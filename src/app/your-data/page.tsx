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
    <main className="your-data-page">
      <header className="page-intro">
        <p className="eyebrow">Privacy &amp; Local Storage</p>
        <h1>Your data stays on your device.</h1>
        <p className="lead">
          Annus Mirabilis has no accounts, no logins, no advertising, and no tracking cookies. All
          reading preferences, notes, predictions, and tour progress are stored solely in your
          browser’s local storage.
        </p>
      </header>

      <section
        data-testid="privacy-guarantees"
        aria-label="Privacy Guarantees"
        className="privacy-guarantees"
      >
        <div className="privacy-card">
          <h2 className="privacy-card-title">No Network Transmission</h2>
          <p className="privacy-card-desc">
            Stored data never leaves your device. No analytics, tracking beacons, or cloud sync
            services are used.
          </p>
        </div>

        <div className="privacy-card">
          <h2 className="privacy-card-title">Full Portability</h2>
          <p className="privacy-card-desc">
            Export all your saved work, notebook reflections, and predictions at any time as a
            standard JSON file.
          </p>
        </div>

        <div className="privacy-card">
          <h2 className="privacy-card-title">Unilateral Deletion</h2>
          <p className="privacy-card-desc">
            Clear individual namespaces or wipe all stored data with a single click. Clearing is
            strictly local to your browser.
          </p>
        </div>
      </section>

      <noscript>
        <div data-testid="noscript-notice" className="noscript-notice">
          <p className="noscript-title">JavaScript is currently disabled.</p>
          <p className="noscript-desc">
            With JavaScript disabled, the interactive data viewer below is not available, and local
            storage is not accessed. Your stored data remains untouched on this device. To inspect,
            export, or clear data interactively, enable JavaScript.
          </p>
        </div>
      </noscript>

      <section aria-label="Local Data Management" className="data-management-section">
        <DataPanel />
      </section>
    </main>
  );
}
