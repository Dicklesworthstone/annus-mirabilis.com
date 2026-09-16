# Reader faces: static generation and this pass's scope

Decision record for `am-read-shell-routes-3ua`, required by that bead's
"Static generation and the no-JavaScript reader" section.

## What exists before this bead

`src/reader/{ReaderController.tsx,PaperReader.tsx,navigation/state.ts,detail/prepaint.ts}`
already implement a real, committed, tested single-page reader for
`brownian-motion`: view/detail/lens switching, history push/replace, focus
restoration on return from a foundation drill-down, and a
`[data-reader-root]` element. It predates or was built in parallel with this
bead's formal specification, and it works. It is not thrown away or
duplicated here.

It diverges from this bead's spec in ways worth recording rather than
silently reconciling:

- it sets `data-readerView` on `<html>`, not `data-view`;
- its `FACES` list (`src/reader/navigation/state.ts`) has six faces:
  `reading`, `results`, `german`, `english`, `parallel`, `gloss` — missing
  `facsimile` and `split`;
- there is no `data-ready` attribute or root-arming script (the harness
  readiness contract this bead owns);
- it is one monolithic client controller, not the modular
  `Shell.tsx`/`ShellIsland.tsx`/`faces/*` split this bead's Technical
  Approach describes.

Reconciling the two — either extending `ReaderController.tsx` in place or
migrating its logic into the modular shell — is a real design decision
(which one becomes canonical, and what happens to the working brownian-motion
reader while that migration happens) that this pass does not make
unilaterally. Flagged to the orchestrator; not resolved here.

## What this pass built

Real, tested, additive infrastructure that does not touch the existing
controller and that a future Shell can consume regardless of how the
reconciliation above is resolved:

- `src/reader/faces/registry.ts` — the full eight-face table from this
  bead's spec (`german`, `english`, `gloss`, `parallel`, `reading`,
  `results`, `facsimile`, `split`), which face split can pair, and which
  faces are separate-language documents needing `hreflang` alternates.
- `src/reader/viewMode.ts` — `parseViewFromSearch`, `parseSplitPanesFromSearch`,
  `applyViewToUrl`, and `canonicalHref`: pure, donor-ported-and-generalized
  URL computation with no DOM access, so callers push or replace history
  exactly once per face change and never lose other query keys or the hash.
- `src/reader/prepaintView.inline.ts` — the head pre-paint script that sets
  `data-view` on `<html>` before first paint, for CSS only.
- `src/reader/rootArming.inline.ts` — the reader-root arming script: sets
  `data-ready="false"` and copies the requested face onto the root as its
  own `data-view`, as the harness's readiness contract requires.

Both inline scripts are real, directly-testable functions; each module's
exported source string is derived from `fn.toString()`, never hand-copied,
so it can never drift from what the tests actually exercise.

## What this pass deliberately did not build, and why

- **The actual routes** (`/papers/[paper]`, `/papers/[paper]/[section]`,
  the `/view/[face]` static fallbacks) and the `Shell.tsx`/`ShellIsland.tsx`
  modules that would wire the above into them. `am-cm-compiler-core-oa7`
  (route-local payloads) and `am-test-e2e-harness-bqmh` (the harness this
  bead's browser spec runs through) are both still open; building routes
  against a payload contract or a harness contract that isn't settled would
  mean guessing at both.
- **Registering `view` and `root-arming` in `src/app/inline-scripts/registry.ts`.**
  `scripts/build/inline-script-hashes.ts` fails a registered entry that no
  route emits. Since no route wires either script into a layout yet,
  registering them now would break the build-output scan for every lane.
  The registry entry lands in the same change as the route that actually
  emits the script, per the scaffold's own stated rule.
- **Split-view rendering, canonical/`hreflang` output, the sitemap policy,
  and `e2e/reader/shell-routes.spec.ts`.** All depend on real routes existing
  first.
- **Reconciling `data-view` vs `data-readerView`**, per above.

## Consequence

None of this bead's acceptance criteria are met yet — they are all about
routes, static generation, and the harness contract running against real
pages, none of which exist in this pass. What is real and true: the face
table, the URL-computation helpers, and both inline scripts are implemented,
unit-tested, and ready for whichever future change wires them into routes.
