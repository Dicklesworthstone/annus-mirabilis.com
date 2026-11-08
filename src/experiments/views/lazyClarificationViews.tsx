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

const Bm01Chunk = lazy(() => import("./bm01View.tsx"));
const Bm02Chunk = lazy(() => import("./bm02View.tsx"));
const Bm03Chunk = lazy(() => import("./bm03View.tsx"));
const Bm05Chunk = lazy(() => import("./bm05View.tsx"));
const Bm06Chunk = lazy(() => import("./bm06View.tsx"));
const Bm07Chunk = lazy(() => import("./bm07View.tsx"));
const Lq01Chunk = lazy(() => import("./lq01View.tsx"));
const Lq02Chunk = lazy(() => import("./lq02View.tsx"));
const Lq03Chunk = lazy(() => import("./lq03View.tsx"));
const Lq04Chunk = lazy(() => import("./lq04View.tsx"));
const Lq05Chunk = lazy(() => import("./lq05View.tsx"));
const Lq06Chunk = lazy(() => import("./lq06View.tsx"));
const Lq07Chunk = lazy(() => import("./lq07View.tsx"));
const Lq08Chunk = lazy(() => import("./lq08View.tsx"));
const Lq09Chunk = lazy(() => import("./lq09View.tsx"));
const Me01Chunk = lazy(() => import("./me01View.tsx"));
const Me02Chunk = lazy(() => import("./me02View.tsx"));
const Me03Chunk = lazy(() => import("./me03View.tsx"));
const Sr01Chunk = lazy(() => import("./sr01View.tsx"));
const Sr02Chunk = lazy(() => import("./sr02View.tsx"));
const Sr03Chunk = lazy(() => import("./sr03View.tsx"));
const Sr04Chunk = lazy(() => import("./sr04View.tsx"));
const Sr05Chunk = lazy(() => import("./sr05View.tsx"));
const Sr06Chunk = lazy(() => import("./sr06View.tsx"));
const Sr07Chunk = lazy(() => import("./sr07View.tsx"));
const Sr08Chunk = lazy(() => import("./sr08View.tsx"));
const Sr09Chunk = lazy(() => import("./sr09View.tsx"));
const Sr10Chunk = lazy(() => import("./sr10View.tsx"));
const Sr11Chunk = lazy(() => import("./sr11View.tsx"));
const Sr12Chunk = lazy(() => import("./sr12View.tsx"));
const Sr13Chunk = lazy(() => import("./sr13View.tsx"));

/**
 * A PLAIN COMPONENT AROUND THE LAZY ONE, not the lazy one itself. The dispatcher applies its own
 * `lazy()` to whatever a ViewLoader resolves to, and React refuses a component wrapped in lazy
 * twice: "Lazy element type must resolve to a class or function." So the map hands out this
 * wrapper, the dispatcher's lazy resolves it immediately, and the chunk behind `Sr01Chunk`
 * suspends to the Suspense boundary the dispatcher already provides.
 */
export function Bm01ClarificationView(props: ExperimentViewProps) {
  return <Bm01Chunk {...props} />;
}

export function Bm02ClarificationView(props: ExperimentViewProps) {
  return <Bm02Chunk {...props} />;
}

export function Bm03ClarificationView(props: ExperimentViewProps) {
  return <Bm03Chunk {...props} />;
}

export function Bm05ClarificationView(props: ExperimentViewProps) {
  return <Bm05Chunk {...props} />;
}

export function Bm06ClarificationView(props: ExperimentViewProps) {
  return <Bm06Chunk {...props} />;
}

export function Bm07ClarificationView(props: ExperimentViewProps) {
  return <Bm07Chunk {...props} />;
}

export function Lq01ClarificationView(props: ExperimentViewProps) {
  return <Lq01Chunk {...props} />;
}

export function Lq02ClarificationView(props: ExperimentViewProps) {
  return <Lq02Chunk {...props} />;
}

export function Lq03ClarificationView(props: ExperimentViewProps) {
  return <Lq03Chunk {...props} />;
}

export function Lq04ClarificationView(props: ExperimentViewProps) {
  return <Lq04Chunk {...props} />;
}

export function Lq05ClarificationView(props: ExperimentViewProps) {
  return <Lq05Chunk {...props} />;
}

export function Lq06ClarificationView(props: ExperimentViewProps) {
  return <Lq06Chunk {...props} />;
}

export function Lq07ClarificationView(props: ExperimentViewProps) {
  return <Lq07Chunk {...props} />;
}

export function Lq08ClarificationView(props: ExperimentViewProps) {
  return <Lq08Chunk {...props} />;
}

export function Lq09ClarificationView(props: ExperimentViewProps) {
  return <Lq09Chunk {...props} />;
}

export function Me01ClarificationView(props: ExperimentViewProps) {
  return <Me01Chunk {...props} />;
}

export function Me02ClarificationView(props: ExperimentViewProps) {
  return <Me02Chunk {...props} />;
}

export function Me03ClarificationView(props: ExperimentViewProps) {
  return <Me03Chunk {...props} />;
}

export function Sr01ClarificationView(props: ExperimentViewProps) {
  return <Sr01Chunk {...props} />;
}

export function Sr02ClarificationView(props: ExperimentViewProps) {
  return <Sr02Chunk {...props} />;
}

export function Sr03ClarificationView(props: ExperimentViewProps) {
  return <Sr03Chunk {...props} />;
}

export function Sr04ClarificationView(props: ExperimentViewProps) {
  return <Sr04Chunk {...props} />;
}

export function Sr05ClarificationView(props: ExperimentViewProps) {
  return <Sr05Chunk {...props} />;
}

export function Sr06ClarificationView(props: ExperimentViewProps) {
  return <Sr06Chunk {...props} />;
}

export function Sr07ClarificationView(props: ExperimentViewProps) {
  return <Sr07Chunk {...props} />;
}

export function Sr08ClarificationView(props: ExperimentViewProps) {
  return <Sr08Chunk {...props} />;
}

export function Sr09ClarificationView(props: ExperimentViewProps) {
  return <Sr09Chunk {...props} />;
}

export function Sr10ClarificationView(props: ExperimentViewProps) {
  return <Sr10Chunk {...props} />;
}

export function Sr11ClarificationView(props: ExperimentViewProps) {
  return <Sr11Chunk {...props} />;
}

export function Sr12ClarificationView(props: ExperimentViewProps) {
  return <Sr12Chunk {...props} />;
}

export function Sr13ClarificationView(props: ExperimentViewProps) {
  return <Sr13Chunk {...props} />;
}
