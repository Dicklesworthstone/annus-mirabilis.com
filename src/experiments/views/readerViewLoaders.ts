/**
 * THE READER STACK'S VIEW LOADERS (am-read-return-stack-oxa).
 *
 * `ExperimentDispatch` takes its view map by injection and defaults to `{}`, so an instrument
 * opened with no map resolves no loader and renders the in-preparation surface -- the same surface
 * an instrument with no manifest shows, which is why nobody could tell the two apart from a page.
 * Measured on the live site 2026-09-28 (dispatch 374): `?open=instrument-view:bm-01` mounted
 * `in-preparation-notice` for a REGISTERED instrument. This map is what the reader stack passes.
 *
 * ONE ENTRY, ON PURPOSE. 37 of the catalogue's 38 instruments are registered and every one of them
 * renders that placeholder through the stack today. The other 36 need an adapter each, because a
 * laboratory's props are its own and the dispatcher's contract is `ExperimentViewProps`; sr-01 is
 * the one whose component asks for least, and establishing the shape on one is worth more than
 * thirty-seven at once.
 *
 * EVERY ENTRY IS A `() => import()`, never a static import, and that is a budget constraint rather
 * than a style. src/reader/stack/kinds.ts is reached from every paper route, so anything this
 * module imports statically lands in the initial JavaScript of every page in the edition. The
 * laboratory must stay a chunk that is fetched when a reader opens it and not before.
 *
 * The embed route has its own populated map (src/experiments/embed/adapters.tsx), and this is
 * deliberately not it: that one is an async function returning prepared JSX for `/embed/lab/`,
 * keyed on the same ids but answering a different call shape. Two maps over one id space is the
 * shape that has cost this repository several defects, so when a second instrument lands here the
 * question of a single shared map is worth asking then, with two real entries to compare.
 */
import type { ViewLoaders } from "../dispatch.tsx";

export const READER_VIEW_LOADERS: ViewLoaders = Object.freeze({
  "sr-01": () => import("./sr01View.tsx"),
});
