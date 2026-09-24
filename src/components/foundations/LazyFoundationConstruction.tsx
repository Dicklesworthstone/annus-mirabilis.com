"use client";
/**
 * A lesson's construction, loaded in its own chunk on the pages that show one.
 *
 * Blocks renders lessons on every paper page (embedded in "Show every step") and on each
 * lesson's own page. It used to render FoundationConstruction directly, which put all six
 * constructions, about 8 KB brotli, into the first JavaScript of every one of those routes, while
 * of the four paper pages only brownian-motion shows a construction at all. Blocks now renders
 * this only for a lesson that has one (constructionIds.ts), so the chunk is fetched where it
 * draws something. Server rendering is unchanged; see src/reader/lazyIslands.tsx for how a lazy
 * island is still written into the static HTML.
 *
 * The constructions' stylesheets are imported here, by the eagerly loaded wrapper, so they stay
 * linked in the page's head: inside the lazy chunk they would arrive only with its script.
 */
import { type ComponentProps, lazy, Suspense } from "react";
import type { FoundationConstruction } from "./FoundationConstruction.tsx";
import "./foundations.css";
import "../lab/sci.css";

const Construction = lazy(() =>
  import("./FoundationConstruction.tsx").then((m) => ({ default: m.FoundationConstruction })),
);

export function LazyFoundationConstruction(props: ComponentProps<typeof FoundationConstruction>) {
  return (
    <Suspense fallback={null}>
      <Construction {...props} />
    </Suspense>
  );
}
