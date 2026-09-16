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
 * No entries yet: the scaffold's root layout has no inline script of its
 * own. The baseline manifest is therefore empty and the HTML scan passes on
 * empty, which is correct, not a gap. Known future ids, so later beads keep
 * them stable (they appear in the manifest and in failure messages):
 * "theme", "detail", "view", "root-arming", "perspective", "storage-keys",
 * "offline-detail".
 *
 * am-read-shell-routes-3ua built and tested "view"
 * (src/reader/prepaintView.inline.ts) and "root-arming"
 * (src/reader/rootArming.inline.ts) in this same wave, but deliberately did
 * NOT register them here yet: scripts/build/inline-script-hashes.ts fails a
 * registered entry that no route emits, and no route wires either script
 * into a layout in this pass (that lands with the Shell/ShellIsland routes,
 * blocked on am-cm-compiler-core-oa7 and am-test-e2e-harness-bqmh — see
 * docs/decisions/reader-faces-static.md). Registering an unemitted entry
 * now would break the build for every lane; the entry lands in the same
 * change as the route that actually emits the script.
 */
export const INLINE_SCRIPT_REGISTRY: InlineScriptRegistry = Object.freeze([]);
