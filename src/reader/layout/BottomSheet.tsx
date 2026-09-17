import type { ReactNode } from "react";

type SheetProps = { title: string; children: ReactNode };

/**
 * Non-modal companion on the narrow tier. Implemented as details/summary so
 * it works without JavaScript: keyboard open/close, passage stays in the
 * document, peek via the summary. CSS hides this on wide/medium tiers.
 */
export function BottomSheet({ title, children }: SheetProps) {
  return (
    <details data-bottom-sheet="" className="reader-bottom-sheet">
      <summary>{title}</summary>
      {children}
    </details>
  );
}
