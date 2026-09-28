/**
 * SR-01 AS A CLARIFICATION, NOT AS A PAGE (am-read-return-stack-oxa).
 *
 * NO `"use client"` DIRECTIVE, DELIBERATELY. This module is only ever reached through the
 * dispatcher's `lazy()`, from inside the reader's client graph, and ClockSyncLab carries its own
 * directive. A directive here would make it a client ENTRY, and next-flight-client-entry-loader
 * imports every client entry a route's graph names with webpackMode "eager" -- the mechanism
 * src/reader/lazyIslands.tsx documents, and the reason the first wiring of this put 28,463 bytes
 * brotli of laboratory into every paper page's first JavaScript.
 *
 * The dispatcher's view contract is `ExperimentViewProps` -- `{ instanceId, mode, presentation }`
 * -- and a laboratory component's props are its own. This module is the adapter between them, and
 * it is deliberately the whole of the adapter: one default export per instrument, loaded through
 * `() => import()` so the laboratory is a chunk the reading route never fetches until a reader
 * opens it.
 *
 * WHAT A READER GETS, AND WHAT IS LEFT OUT. The laboratory, with the same prepared example the
 * /lab/sr-01 page shows, and nothing else of that page: no page header, no lead paragraph, no
 * "From here" navigation. The frame around it already carries those jobs -- the dialog is labelled
 * with the catalogue's own title for the instrument, and the compass above it says where the reader
 * is and offers "Return to the exact step". Repeating the page's chrome inside the modal would
 * announce the same name twice and offer a second, competing way out.
 *
 * `restoreFromLocation` IS LEFT AT FALSE, which is the default and is a decision rather than an
 * omission. The address in the bar belongs to the reader's passage: it carries `?open=` and the
 * reading axes, not this laboratory's tape. Reading a `?tape=` out of a paper URL into a modal is
 * permalink restore for a clarification, which am-a11y-reading-only-6wwd asks about and nothing
 * here settles.
 *
 * THE MODE IS ACCEPTED AND UNUSED, and that is the honest state of the "and preset" half of this
 * bead's criterion rather than a gap this file can close. `resolveCatalogueAddress` already refuses
 * a mode an instrument does not declare, sr-02's `apparatus` is the only declared mode in the
 * catalogue, and no laboratory component in src/components/lab takes a mode prop at all. Passing
 * one here would have nowhere to arrive.
 */
import { ClockSyncLab } from "../../components/lab/sr01/ClockSyncLab.tsx";
import type { ExperimentViewProps } from "../dispatch.tsx";
import { DEFAULT_PREPARED_EXAMPLE } from "../sr01/session.ts";

export default function Sr01ClarificationView(_props: ExperimentViewProps) {
  return <ClockSyncLab example={DEFAULT_PREPARED_EXAMPLE} />;
}
