"use client";

/**
 * Mounts a lesson's construction into the dialog after its body has loaded (lessonBody.ts).
 * Imported dynamically, so the six constructions reach the browser only when a reader opens a
 * lesson that has one, not with every reading page.
 */
import { createRoot } from "react-dom/client";
import { FoundationConstruction } from "../components/foundations/FoundationConstruction.tsx";
import type { MountedConstruction } from "./lessonBody.ts";

export function mountConstruction(slot: HTMLElement, foundationId: string): MountedConstruction {
  const root = createRoot(slot);
  root.render(<FoundationConstruction foundationId={foundationId} headingLevel={3} />);
  return { unmount: () => root.unmount() };
}
