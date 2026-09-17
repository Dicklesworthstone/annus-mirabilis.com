/**
 * The one registry of inline pre-paint scripts the root layout injects.
 *
 * Every reader/platform bead that adds a `data-` attribute to `<html>` before
 * first paint (theme, Detail, view/root-arming, perspective/notation/units,
 * storage-key constants, the offline chapter's Detail script) registers its
 * entry here in the same change as its script, so a missing entry becomes a
 * build failure (scripts/build/inline-script-hashes.ts) instead of a silent
 * Content-Security-Policy relaxation. `am-plat-security-f644` consumes the
 * emitted manifest to assemble `script-src`; this file and its emitter never
 * write CSP policy themselves.
 *
 * `source` must be the exact string the layout injects (produced by
 * compiling a tested pure function to a string, never hand-copied), because
 * a CSP hash is over exact bytes: a trailing newline or a changed quote
 * style produces a different hash.
 */

import { READING_SETTINGS_PREPAINT } from "../../a11y/readingSettings/prepaint.ts";
import { READER_PREPAINT } from "../../reader/detail/prepaint.ts";
import { ROOT_ARMING_SOURCE } from "../../reader/rootArming.inline.ts";
import { THEME_INIT_SOURCE } from "../theme/themeInit.inline.ts";

export type InlineScriptRoutes = "all" | readonly string[];

export type InlineScriptRegistryEntry = {
  readonly id: string;
  readonly ownerBeadId: string;
  readonly module: string;
  readonly source: string;
  readonly routes: InlineScriptRoutes;
};

export type InlineScriptRegistry = readonly InlineScriptRegistryEntry[];

/**
 * Still-future ids, so later beads keep them stable (they appear in the
 * manifest and in failure messages): "perspective", "storage-keys",
 * "offline-detail".
 *
 * "theme" (am-design-themes-typography-288q) is
 * `src/app/theme/themeInit.inline.ts`'s `THEME_INIT_SOURCE`, injected
 * verbatim by `src/app/layout.tsx` via
 * `dangerouslySetInnerHTML={{ __html: THEME_INIT_SOURCE }}` in `<head>` on
 * every route, alongside "detail" and "reading-settings" below: each sets
 * only its own `data-` attribute and reads only its own storage key.
 *
 * "detail" (am-read-detail-axis-sfc) is `src/reader/detail/prepaint.ts`'s
 * `READER_PREPAINT` — the combined detail/lens/view pre-paint script,
 * injected verbatim by `src/app/layout.tsx` via
 * `dangerouslySetInnerHTML={{ __html: READER_PREPAINT }}` in `<head>` on
 * every route. It predated this registry; this is the entry that closes
 * that gap.
 *
 * "root-arming" (am-read-shell-routes-3ua) is `src/reader/rootArming.inline.ts`,
 * wired into `PaperReader.tsx` as the reader root's first child on the
 * brownian-motion paper and section routes (per the orchestrator's decision
 * in docs/decisions/reader-faces-static.md to extend the existing reader in
 * place rather than migrate to a modular Shell). `routes: "all"` because any
 * future route that renders a reader root reuses the same script, not
 * because every route emits it today.
 *
 * am-read-shell-routes-3ua also built and tested "view"
 * (src/reader/prepaintView.inline.ts), a separate, unused-for-now head
 * pre-paint script kept as ready infrastructure for a future modular Shell.
 * It is not registered because nothing emits it: the existing "detail"
 * script (above) already sets `data-view`, renamed from `data-readerView`
 * to match this bead's contract, in the same change.
 */
export const INLINE_SCRIPT_REGISTRY: InlineScriptRegistry = Object.freeze([
  Object.freeze({
    id: "root-arming",
    ownerBeadId: "am-read-shell-routes-3ua",
    module: "src/reader/rootArming.inline.ts",
    source: ROOT_ARMING_SOURCE,
    routes: "all",
  }),
  Object.freeze({
    id: "detail",
    ownerBeadId: "am-read-detail-axis-sfc",
    module: "src/reader/detail/prepaint.ts",
    source: READER_PREPAINT,
    routes: "all",
  }),
  Object.freeze({
    id: "reading-settings",
    ownerBeadId: "am-a11y-reading-only-6wwd",
    module: "src/a11y/readingSettings/prepaint.ts",
    source: READING_SETTINGS_PREPAINT,
    routes: "all",
  }),
  Object.freeze({
    id: "theme",
    ownerBeadId: "am-design-themes-typography-288q",
    module: "src/app/theme/themeInit.inline.ts",
    source: THEME_INIT_SOURCE,
    routes: "all",
  }),
]);
