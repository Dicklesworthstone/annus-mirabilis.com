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
- its `FACES` list (`src/reader/navigation/state.ts`) has seven faces:
  `reading`, `results`, `german`, `english`, `parallel`, `gloss`,
  `facsimile` — missing `split`;
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
  route emits. Since no route wired either script into a layout yet at the
  time this section was written, registering them then would have broken
  the build-output scan for every lane. See "Resolution" below: this
  changed once `root-arming` was actually wired into the existing reader.
- **Split-view rendering, canonical/`hreflang` output, the sitemap policy,
  and `e2e/reader/shell-routes.spec.ts`.** All depend on real routes existing
  first.
- **Reconciling `data-view` vs `data-readerView`**, per above. See
  "Resolution" below: this was decided and implemented in the same wave.

## Consequence

None of this bead's acceptance criteria are met yet — they are all about
routes, static generation, and the harness contract running against real
pages, none of which exist in this pass. What is real and true: the face
table, the URL-computation helpers, and both inline scripts are implemented,
unit-tested, and ready for whichever future change wires them into routes.

## Resolution

**Decider:** `agent:BoldHarbor`, orchestrator, acting on this bead's escalated
design question (not the project owner — he has not seen this decision).
**Date:** 2026-09-16.

**Decision: extend the existing `ReaderController.tsx` in place. It stays
canonical. Do not migrate to the modular Shell split.**

Reasons, in the order that decided it, quoted from the orchestrator's
message:

1. "The brownian-motion reader WORKS and is under test. It is one of the
   three things on this site a reader can actually use today. A migration
   that risks it buys structure we do not yet need."
2. "The modular `Shell.tsx`/`ShellIsland.tsx`/`faces/*` split in the bead's
   Technical Approach is a shape justified by eight faces across four
   papers. We have one paper with content and three faces with real data.
   Building the general structure now is speculative generality, and the
   plan's own governing design test asks for the simplest working
   interaction that addresses a named reader obstacle."
3. "Your `faces/registry.ts`, `viewMode.ts`, and the pre-paint scripts are
   the genuinely reusable parts, and you built them as pure modules with no
   DOM access. A future Shell can consume them unchanged. So the migration
   remains cheap later if a second paper actually forces it."

**What changed as a result** (same pass, am-read-shell-routes-3ua):

- `data-readerView` renamed to `data-view` everywhere it appeared
  (`src/reader/detail/prepaint.ts`'s inline script,
  `src/reader/ReaderController.tsx`'s render function, and the
  corresponding `[data-reader-view="…"]` CSS selectors in
  `src/reader/reader.css`, now `[data-view="…"]`), covered by a new test in
  `src/testing/readerNavigation.test.mjs`. This is a rename, not a
  migration: the controller's architecture is unchanged.
- `FACES` in `src/reader/navigation/state.ts` extended from seven entries
  to the full eight in `src/reader/faces/registry.ts`, adding `split`.
  `facsimile` and `split` render the existing, honest `[data-face-source]`
  "not yet available" notice (now naming split view explicitly) rather than
  a new state, since neither a pinned facsimile nor a second content pane
  exists yet. An eight-entry table where two entries truthfully say
  "nothing here yet" is correct; omitting them is not.
- `data-ready` wired into the existing controller, not a new Shell: the
  reader root now renders `data-ready="true"` `data-view="reading"`
  statically (the no-JavaScript baseline) with
  `src/reader/rootArming.inline.ts`'s script as its first child
  (`PaperReader.tsx`), which flips `data-ready` to `"false"` synchronously
  before the rest of the root parses. `ReaderController.tsx`'s `render()`
  now sets `root.dataset.ready = "false"` at its start and `"true"` at its
  end on every face change — synchronous today because no face content is
  code-split or async-loaded yet; a future lazily-loaded face panel would
  set it `"true"` only once its own load settles, not merely once
  `render()` returns.
- `root-arming` registered in `src/app/inline-scripts/registry.ts`,
  because it is now actually emitted by the brownian-motion paper and
  section routes. `view` (`src/reader/prepaintView.inline.ts`) stays
  unregistered and unused: the existing `detail` script already sets
  `data-view` after this change, so nothing emits the separate module.

**Still not done, per the "what this pass deliberately did not build"
section above**, unaffected by this resolution: the modular routes, static
fallback pages, split-view rendering (two real panes), canonical/`hreflang`
output, the sitemap policy, and the e2e spec. Those still depend on
`am-cm-compiler-core-oa7` and `am-test-e2e-harness-bqmh`.

## Routes landed (am-read-shell-routes-3ua, later pass)

App Router routes now exist and are paper-agnostic:

- `/papers/[paper]` and `/papers/[paper]/[section]` from the compiled content index
- `/papers/[paper]/view/[face]` and `/papers/[paper]/[section]/view/[face]` for the seven no-JavaScript fallback faces
- dedicated `/papers/brownian-motion/view/[face]` (and section) siblings so the existing brownian-motion tree does not swallow `view` as a section id

`src/reader/paperRoutes.ts` is the single resolver: bibliographic keys (`ap-17-549`) refuse, unknown slugs and sections 404, `reading` is not a fallback page. Canonical / hreflang / sitemap follow the policy in this bead. Face contents for German/English/gloss/facsimile remain honest "not yet available" notices until those face beads land. The full browser spec through `am-test-e2e-harness-bqmh` is still that harness's work.

