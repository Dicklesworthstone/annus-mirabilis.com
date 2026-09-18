import type { Metadata } from "next";
import { DataPanel } from "../../platform/storage/DataPanel.tsx";

export const metadata: Metadata = {
  title: "Your data on this device · Annus Mirabilis",
  description:
    "Review, export, or clear the reading preferences, notes, predictions, and tour progress stored locally on your device.",
};

export default function YourDataPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <header className="page-intro space-y-3">
        <p className="eyebrow text-xs uppercase tracking-wider text-slate-500 font-mono">
          Privacy & Local Storage
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Your data stays on your device.
        </h1>
        <p className="lead text-base text-slate-700 dark:text-slate-300">
          Annus Mirabilis has no accounts, no logins, no advertising, and no tracking cookies. All
          reading preferences, notes, predictions, and tour progress are stored solely in your
          browser’s local storage.
        </p>
      </header>

      <section
        data-testid="privacy-guarantees"
        aria-label="Privacy Guarantees"
        className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm"
      >
        <div className="p-4 rounded border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
            No Network Transmission
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Stored data never leaves your device. No analytics, tracking beacons, or cloud sync
            services are used.
          </p>
        </div>

        <div className="p-4 rounded border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
            Full Portability
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Export all your saved work, notebook reflections, and predictions at any time as a
            standard JSON file.
          </p>
        </div>

        <div className="p-4 rounded border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
            Unilateral Deletion
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Clear individual namespaces or wipe all stored data with a single click. Clearing is
            strictly local to your browser.
          </p>
        </div>
      </section>

      <noscript>
        <div
          data-testid="noscript-notice"
          className="p-4 rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 text-sm"
        >
          <p className="font-semibold">JavaScript is currently disabled.</p>
          <p className="mt-1">
            With JavaScript disabled, the interactive data viewer below is not available, and local
            storage is not accessed. Your stored data remains untouched on this device. To inspect,
            export, or clear data interactively, enable JavaScript.
          </p>
        </div>
      </noscript>

      <section aria-label="Local Data Management">
        <DataPanel />
      </section>
    </main>
  );
}
