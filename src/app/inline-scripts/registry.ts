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
import { ROOT_ARMING_SOURCE } from "../../reader/rootArming.inline";

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
 * manifest and in failure messages): "theme", "detail", "view",
 * "perspective", "storage-keys", "offline-detail". "detail" is the existing
 * combined `src/reader/detail/prepaint.ts` script (theme/detail/lens/view
 * pre-paint together); it predates this registry and is not yet registered
 * here — that gap belongs to am-read-detail-axis-sfc, not this bead.
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
]);
