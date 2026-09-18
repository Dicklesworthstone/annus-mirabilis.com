import { cloneElement, isValidElement, type ReactNode } from "react";
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
  const columnCompanion = isValidElement(companion)
    ? cloneElement(companion as React.ReactElement<{ slot?: string }>, { slot: "column" })
    : companion;
  const sheetCompanion = isValidElement(companion)
    ? cloneElement(companion as React.ReactElement<{ slot?: string }>, { slot: "sheet" })
    : companion;

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
          {columnCompanion}
        </aside>
        <BottomSheet title={companionTitle}>{sheetCompanion}</BottomSheet>
      </div>
    </div>
  );
}
