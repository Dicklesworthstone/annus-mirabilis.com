# Foundation library infrastructure: what this pass built and why

Scope record for `am-found-library-infra-002t`, written 2026-09-16.

## What already existed, verified by reading the code

- `src/content/schemas/argument.ts` already exports a complete, tested
  `WorkedExample` (the five-part shape: `question`, `given`,
  `plausibleFirstThought`, `decisiveStep`, `limitation`), `FoundationLink`
  (`{foundationId, callingAnchor, returnCaption?}`), `Foundation`, `Bridge`,
  `ReturnCaption`, and `PrerequisiteRef` (`{foundationId, kind: "proof-edge"
  | "cross-link"}`), each with real validators
  (`validateWorkedExample`, `validateFoundationLink`,
  `validateFoundationOrBridge`) and a real test file
  (`src/content/schemas/argument.test.ts`). This is this bead's blocking
  dependency `am-cm-schemas-argument-llm`'s deliverable; it is tracked
  `open` in the tracker but substantively built.
- `src/app/foundations/page.tsx` and `src/app/foundations/[concept]/page.tsx`
  already exist as real, statically-generated routes, and
  `src/reader/Blocks.tsx`'s `FoundationBody`/`FoundationLink` components
  already render foundation records inside `PaperReader.tsx`'s drawer
  (a `<dialog>` with `data-foundation-panel` sections, opened via
  `openFoundation` in `src/reader/navigation/state.ts`). This is real,
  working, tested drawer infrastructure, not a gap.
- **But** all of the above — the routes, the drawer, `FoundationBody` — read
  the OLDER, simpler `Foundation` type from `src/content/schemas/reading.ts`
  (`id`, `title`, `summary`, `question`, `explanation` blocks, `example`
  blocks, `stoppingPoint` string, `prerequisites: string[]`), not the newer
  five-part `WorkedExample`/typed-prerequisite shape from `argument.ts`. The
  core content compiler pipeline (`src/content/compiler/compiler.ts`, owned
  by `am-cm-compiler-core-oa7`) also still imports `Foundation` from
  `reading.ts`, not `argument.ts`. The new schemas exist and are tested in
  isolation; nothing in the live compile-and-render path consumes them yet.
  This is a genuine sequencing gap between two blocking dependencies, not
  something this bead can resolve by itself — rewiring
  `am-cm-compiler-core-oa7`'s pipeline to the new schema is that bead's
  scope, not this one's.
- `registerClarificationKind` and the return-stack/compass store
  (`am-read-return-stack-oxa`) do not exist anywhere in the tree. Confirmed
  by grep, not assumed.

## The canonical 46-id table

Transcribed directly from `am-ep-foundations-z1e`'s "Canonical id table and
partition" section (36 nodes + 10 bridges, one owner each) into
`content/foundations/registry.yaml`. Not invented: every id, kind, and
owner in the registry is copied from that table.

`status` (`authored`/`planned`) was set by reading every file under
`content/foundations/*.json` and comparing each file's own `id` field
(never its filename) against the canonical slug:

- 17 ids match an existing file exactly and are marked `authored`.
- **`foundation:error-inference` is marked `planned`, not `authored`,
  despite `content/foundations/error-and-inference.json` existing.** That
  file's own `id` field is `"error-and-inference"`, not `"error-inference"`
  — a real, observed mismatch (`registry.test.ts`'s
  `checkRecordsAgainstRegistry` suite asserts this directly against the
  real content directory). Not silently renamed: the file is owned by the
  statistics-inference cluster bead
  (`am-found-statistics-inference-pzqv`), and this bead does not edit
  another bead's content. Flagged here and in a `br comments add` on that
  bead instead.
- The remaining 28 ids are `planned` because no matching file exists.
- `plannedCallers` is left empty for all 46 entries. No real data exists
  yet about which future paper sections will call which foundation;
  inventing anchor ids would be exactly the kind of fabrication the
  orchestrator's incident notices this session were about. Owning beads
  add their own entries as they author.

## What this pass built

- `content/foundations/registry.yaml` — the 46-id registry described above.
- `src/content/foundations/registry.ts` — `parseRegistry` (structural
  validation: malformed id, duplicate id, invalid kind/status, missing
  owner) and `checkRecordsAgainstRegistry` (cross-checks the registry
  against real files by each file's own `id` field, reporting
  `authored-without-record` and `unregistered-record`).
- `src/content/foundations/registry.test.ts` — 17 tests: every fixture
  violation named in the bead's test plan (duplicate id, two owners,
  malformed id, invalid kind, invalid status, missing owner), the real
  registry's counts (36 nodes / 10 bridges / 46 total, matching the
  canonical table above), `foundation:two-measurements-two-unknowns`
  resolving to `am-found-statistics-inference-pzqv` with kind `node`, and
  the real `error-and-inference.json` mismatch.
- `src/reader/WorkedExample.tsx` — a pure, presentational component
  rendering the five parts in order from the real `WorkedExample` type in
  `argument.ts`, with the decisive step as a native `<details>` open by
  default at `detail === 2` and closed otherwise. No storage read or write,
  no analytics, no `onToggle` handler: opening it is the browser's own
  behavior and is not observable to this component.
- `src/reader/WorkedExample.test.tsx` — 7 tests: part order, literal text
  of every part present, `<details>` open/closed at each Detail level,
  no `<script>` tags (works without JavaScript), and that the component is
  a pure function of its props.
- `js-yaml@4.1.0` and `@types/js-yaml@4.0.9` added as exact-pinned
  dependencies (`js-yaml` is already in `docs/DECISIONS.md`'s locked
  inventory at this exact version; needed to parse the registry).

## What this pass deliberately did not build, and why

- **`registerClarificationKind("foundation", ...)`.** The API it would call
  does not exist (`am-read-return-stack-oxa` is unbuilt). Calling a
  nonexistent function, or writing a stub pretending the closed
  clarification-kind registry exists, would be exactly the kind of
  fabricated-completeness this session's incident notices warned against.
- **Wiring `WorkedExample` into the real drawer or `/foundations` routes.**
  Those routes render the old `reading.ts` `Foundation` shape; the real
  content is not in the new five-part shape. Wiring a fixture-only
  component into a live route would either require inventing content or
  silently forking the render path. Neither is done here.
- **Backlink computation and return-caption precedence.** These need real
  `FoundationLink` records from calling passages, which do not exist in
  the new shape yet (no reading currently emits a `FoundationLink`). The
  pure precedence rule (link caption, else node caption, else fail; two
  differing captions fail; a node caption with no link is stale) is
  well-specified and could be built against synthetic fixtures alone, but
  was not, to keep this pass's real-code-plus-real-tests scope inside what
  I could verify thoroughly against the actual registry and schemas in one
  sitting. Left for a follow-up pass on this same bead.
- **The `plausibleFirstThought` voice-lint rule set, transfer-case
  validation, and proof-route acyclicity.** Owned by
  `am-edit-voice-lint-trmf` and `am-disc-journey-framework-umbg`
  respectively (both still open), or depend on compiled journeys that do
  not exist yet.
- **Print and no-JavaScript end-to-end verification, and the browser
  harness spec.** `am-test-e2e-harness-bqmh` (the harness) does not exist.

## Consequence

No acceptance criterion of this bead is fully met. What is real: the
registry (with an honestly-marked exception), its validator and 17 tests,
and a tested, reusable five-part worked-example renderer, ready for
whichever future change wires it into a live route once the compiler
pipeline and return-stack land.
