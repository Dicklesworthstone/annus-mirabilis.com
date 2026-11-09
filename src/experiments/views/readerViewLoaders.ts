/**
 * THE READER STACK'S VIEW LOADERS (am-read-return-stack-oxa).
 *
 * `ExperimentDispatch` takes its view map by injection and defaults to `{}`, so an instrument
 * opened with no map resolves no loader and renders the in-preparation surface -- the same surface
 * an instrument with no manifest shows, which is why nobody could tell the two apart from a page.
 * Measured on the live site 2026-09-28 (dispatch 374): `?open=instrument-view:bm-01` mounted
 * `in-preparation-notice` for a REGISTERED instrument. This map is what the reader stack passes.
 *
 * Each entry adapts a working laboratory to `ExperimentViewProps`. Prepared examples and
 * numerical owners are the same ones used by the standalone laboratory; the parent paper's
 * query string must never be interpreted as a laboratory setup or tape.
 *
 * Each laboratory stays behind a module-scope React.lazy() in a client boundary. This map
 * imports only the plain wrappers from that boundary, so the laboratory's code and styles
 * remain in a chunk fetched when the reader opens it.
 *
 * The embed route has its own populated map (src/experiments/embed/adapters.tsx), and this is
 * deliberately not it: that one is an async function returning prepared JSX for `/embed/lab/`,
 * keyed on the same ids but answering a different call shape. Two maps over one id space is the
 * shape that has cost this repository several defects. These adapters keep the reader's instance
 * identity and disable parent-URL restoration, which the embed route does not request.
 */
import type { ViewLoaders } from "../dispatch.tsx";
import {
  Bm01ClarificationView,
  Bm02ClarificationView,
  Bm03ClarificationView,
  Bm04ClarificationView,
  Bm05ClarificationView,
  Bm06ClarificationView,
  Bm07ClarificationView,
  Bm08ClarificationView,
  Lq01ClarificationView,
  Lq02ClarificationView,
  Lq03ClarificationView,
  Lq04ClarificationView,
  Lq05ClarificationView,
  Lq06ClarificationView,
  Lq07ClarificationView,
  Lq08ClarificationView,
  Lq09ClarificationView,
  Me01ClarificationView,
  Me02ClarificationView,
  Me03ClarificationView,
  Sr01ClarificationView,
  Sr02ClarificationView,
  Sr03ClarificationView,
  Sr04ClarificationView,
  Sr05ClarificationView,
  Sr06ClarificationView,
  Sr07ClarificationView,
  Sr08ClarificationView,
  Sr09ClarificationView,
  Sr10ClarificationView,
  Sr11ClarificationView,
  Sr12ClarificationView,
  Sr13ClarificationView,
} from "./lazyClarificationViews.tsx";

/**
 * THROUGH A BOUNDARY (dispatch 385). 9d6b6d4d held `() => import("./sr01View.tsx")`
 * here and it cost the reading route its budget: 169,840 bytes of initial JavaScript became
 * 342,297 against 204,800, and the Performance Budgets Gate refused a deploy. 0116e261 withdrew it.
 *
 * The arrow was never the mechanism. All 41 laboratory components are already client references of
 * /papers/[paper]; of those, exactly the ones this map reached had a chunk in the route's INITIAL
 * file list, and the 39 that escape do so because they are reached through `React.lazy()` at module
 * scope inside a "use client" boundary. So the entries below hand out components that
 * ./lazyClarificationViews.tsx has already made lazy, and that module is the boundary. The
 * measurement is in this commit's message; the reasoning is in that module's docblock.
 */
export const READER_VIEW_LOADERS: ViewLoaders = Object.freeze({
  "bm-01": () => Promise.resolve({ default: Bm01ClarificationView }),
  "bm-02": () => Promise.resolve({ default: Bm02ClarificationView }),
  "bm-03": () => Promise.resolve({ default: Bm03ClarificationView }),
  "bm-04": () => Promise.resolve({ default: Bm04ClarificationView }),
  "bm-05": () => Promise.resolve({ default: Bm05ClarificationView }),
  "bm-06": () => Promise.resolve({ default: Bm06ClarificationView }),
  "bm-07": () => Promise.resolve({ default: Bm07ClarificationView }),
  "bm-08": () => Promise.resolve({ default: Bm08ClarificationView }),
  "lq-01": () => Promise.resolve({ default: Lq01ClarificationView }),
  "lq-02": () => Promise.resolve({ default: Lq02ClarificationView }),
  "lq-03": () => Promise.resolve({ default: Lq03ClarificationView }),
  "lq-04": () => Promise.resolve({ default: Lq04ClarificationView }),
  "lq-05": () => Promise.resolve({ default: Lq05ClarificationView }),
  "lq-06": () => Promise.resolve({ default: Lq06ClarificationView }),
  "lq-07": () => Promise.resolve({ default: Lq07ClarificationView }),
  "lq-08": () => Promise.resolve({ default: Lq08ClarificationView }),
  "lq-09": () => Promise.resolve({ default: Lq09ClarificationView }),
  "me-01": () => Promise.resolve({ default: Me01ClarificationView }),
  "me-02": () => Promise.resolve({ default: Me02ClarificationView }),
  "me-03": () => Promise.resolve({ default: Me03ClarificationView }),
  "sr-01": () => Promise.resolve({ default: Sr01ClarificationView }),
  "sr-02": () => Promise.resolve({ default: Sr02ClarificationView }),
  "sr-03": () => Promise.resolve({ default: Sr03ClarificationView }),
  "sr-04": () => Promise.resolve({ default: Sr04ClarificationView }),
  "sr-05": () => Promise.resolve({ default: Sr05ClarificationView }),
  "sr-06": () => Promise.resolve({ default: Sr06ClarificationView }),
  "sr-07": () => Promise.resolve({ default: Sr07ClarificationView }),
  "sr-08": () => Promise.resolve({ default: Sr08ClarificationView }),
  "sr-09": () => Promise.resolve({ default: Sr09ClarificationView }),
  "sr-10": () => Promise.resolve({ default: Sr10ClarificationView }),
  "sr-11": () => Promise.resolve({ default: Sr11ClarificationView }),
  "sr-12": () => Promise.resolve({ default: Sr12ClarificationView }),
  "sr-13": () => Promise.resolve({ default: Sr13ClarificationView }),
});
