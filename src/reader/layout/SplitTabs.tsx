import type { ReactNode } from "react";

export function SplitTabs({ panes, active }: { panes: readonly [string, string]; active: string }) {
  return (
    <div
      className="reader-split-tabs"
      data-split-tabs=""
      role="tablist"
      aria-label="Split reading faces"
    >
      {panes.map((pane) => (
        <a
          key={pane}
          role="tab"
          href={`?view=split&pane=${encodeURIComponent(pane)}`}
          aria-selected={pane === active}
        >
          {pane}
        </a>
      ))}
    </div>
  );
}

export function OverflowRegion({
  authoredMultiline,
  children,
}: {
  authoredMultiline: boolean;
  children: ReactNode;
}) {
  if (authoredMultiline) {
    return <div className="reader-multiline-equation">{children}</div>;
  }
  return (
    <section
      className="reader-local-overflow"
      data-overflow-affordance="true"
      aria-label="Wide equation or table. Scroll sideways from the keyboard."
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable
      tabIndex={0}
    >
      {children}
    </section>
  );
}
