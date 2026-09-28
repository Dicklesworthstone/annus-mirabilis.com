"use client";
/**
 * THE CLARIFICATION VIEWS, EACH IN A CHUNK OF ITS OWN (am-read-return-stack-oxa, dispatch 385).
 *
 * WHY THIS MODULE EXISTS AT ALL, since the map could hold `() => import()` directly and did.
 * It could not. 9d6b6d4d put one such entry in readerViewLoaders.ts and the reading route's
 * initial JavaScript went from 169,840 bytes to 342,297 against a 204,800 budget, 28 files to 43,
 * and the Performance Budgets Gate refused a deploy.
 *
 * The arrow function was never the mechanism. Measured from the paper route's own
 * page_client-reference-manifest.js: ALL 41 laboratory components are already client references of
 * /papers/[paper], with or without any map, so reachability was never the question. Of those 41,
 * exactly the ones the map reached had a chunk in the route's INITIAL file list; the other 39 had
 * none. The 39 escape because they are reached through `React.lazy()` called AT MODULE SCOPE INSIDE
 * A "use client" BOUNDARY MODULE -- src/experiments/embed/lazyEmbeddedLabs.tsx, and
 * src/reader/lazyIslands.tsx for the paper routes' own islands. A module with no directive is
 * folded into the importing client entry's graph and its dynamic import's chunk is emitted as part
 * of the route.
 *
 * So this module is the boundary, and it is deliberately the smallest thing that can be one: a
 * directive, a `lazy()` per instrument, and nothing else. What lands in every paper route is these
 * few lines; what stays async is the laboratory behind them.
 *
 * NO <Suspense> HERE, for lazyIslands.tsx's reason: a boundary of its own makes React write the
 * subtree into a hidden segment. The dispatcher already wraps its view in one.
 *
 * NO STYLESHEET IMPORTS HERE, and this differs from lazyEmbeddedLabs on purpose. That module
 * imports each laboratory's CSS so Next links it in the embed page's head, because an embed renders
 * its laboratory on arrival. A clarification is opened on demand, and its stylesheet arriving with
 * its chunk is the correct trade: the reading route should not carry a laboratory's CSS for a modal
 * most readers never open.
 */
import { lazy } from "react";
import type { ExperimentViewProps } from "../dispatch.tsx";

const Sr01Chunk = lazy(() => import("./sr01View.tsx"));

/**
 * A PLAIN COMPONENT AROUND THE LAZY ONE, not the lazy one itself. The dispatcher applies its own
 * `lazy()` to whatever a ViewLoader resolves to, and React refuses a component wrapped in lazy
 * twice: "Lazy element type must resolve to a class or function." So the map hands out this
 * wrapper, the dispatcher's lazy resolves it immediately, and the chunk behind `Sr01Chunk`
 * suspends to the Suspense boundary the dispatcher already provides.
 */
export function Sr01ClarificationView(props: ExperimentViewProps) {
  return <Sr01Chunk {...props} />;
}
