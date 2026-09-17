import type { ReactNode } from "react";

/** Connect the instruments to the shared reasoning tools without changing their state. */
export default function LaboratoryLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <nav className="actions no-print" aria-label="Reasoning laboratories">
        <a className="button secondary" href="/lab/bm-01/compare/">Hold something fixed</a>
        <a className="button secondary" href="/lab/countermodels/">Compare competing models</a>
        <a className="button secondary" href="/lab/what-can-you-infer/">What can you infer?</a>
      </nav>
      {children}
    </>
  );
}
