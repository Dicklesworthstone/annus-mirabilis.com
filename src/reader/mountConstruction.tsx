"use client";

/**
 * Mounts a lesson's construction into the dialog after its body has loaded (lessonBody.ts).
 * Imported dynamically, so the six constructions reach the browser only when a reader opens a
 * lesson that has one, not with every reading page.
 */
import { createRoot } from "react-dom/client";
import { FoundationConstruction } from "../components/foundations/FoundationConstruction.tsx";
import type { HeadingLevel } from "../components/foundations/headingLevel.ts";
import type { MountedConstruction } from "./lessonBody.ts";

/**
 * `headingLevel` is 3 in the dialog, under the lesson's h2; a lesson embedded in a passage's
 * steps (stepsBody.ts) passes the level its construction had on the section page.
 */
export function mountConstruction(
  slot: HTMLElement,
  foundationId: string,
  headingLevel: HeadingLevel = 3,
): MountedConstruction {
  const root = createRoot(slot);
  root.render(<FoundationConstruction foundationId={foundationId} headingLevel={headingLevel} />);
  return { unmount: () => root.unmount() };
}
