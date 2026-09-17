import type { ReactNode } from "react";
import { BottomSheet } from "./BottomSheet.tsx";
import "./layout.css";
import "./overflow.css";

/**
 * Server layout: passage, outline, and companion. CSS container queries choose
 * a column (wide/medium) or a bottom sheet (narrow). Both slots are in the
 * HTML so the book works with JavaScript disabled.
 */
export function ReaderLayout({
  outline,
  companion,
  companionTitle = "Notes and laboratory",
  children,
}: {
  outline: ReactNode;
  companion: ReactNode;
  companionTitle?: string;
  children: ReactNode;
}) {
  return (
    <div data-reader-anatomy="" className="reader-anatomy-host">
      <div className="reader-anatomy">
        <aside data-reader-outline="" className="reader-outline">
          {outline}
        </aside>
        <div data-reader-main="" className="reader-main">
          {children}
        </div>
        <aside
          data-reader-companion-column=""
          className="reader-companion-column"
          aria-label={companionTitle}
        >
          {companion}
        </aside>
        <BottomSheet title={companionTitle}>{companion}</BottomSheet>
      </div>
    </div>
  );
}
