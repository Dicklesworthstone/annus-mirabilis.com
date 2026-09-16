# Foundation library infrastructure: existing state and scope boundaries

Scope record for `am-found-library-infra-002t`, written 2026-09-16. Records
what already existed before this bead touched anything, and what this pass
deliberately left for a later change and why — not a progress log (see the
commit history and bead comments for that).

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

## The canonical 46-id table lives in code, not here

`src/content/foundations/canonicalIds.ts` is the frozen, exported table
(id, kind, ownerBead for all 46 entries), transcribed verbatim from
`am-ep-foundations-z1e`'s "Canonical id table and partition" section. It is
not restated in this document, so this document cannot drift from it.
`src/content/foundations/canonicalIds.test.ts` asserts the table's own
counts (36 nodes, 10 bridges, 46 total) and, separately, that
`content/foundations/registry.yaml` has no id absent from the table, no id
missing from the registry, and that every registry entry's `kind` and
`ownerBead` agree with the canonical table — so an editing mistake in
either file is a failing test, not a silent drift.

`content/foundations/registry.yaml` additionally carries `cluster`,
`status` (`authored`/`planned`), and `plannedCallers`, none of which are
part of the epic's table. `status` was set by reading every file under
`content/foundations/*.json` and comparing each file's own `id` field
(never its filename) against the canonical slug: 17 ids match an existing
file and are `authored`; the remaining 29 are `planned`.

**`foundation:error-inference` is marked `planned`, not `authored`,
despite `content/foundations/error-and-inference.json` existing.** That
file's own `id` field is `"error-and-inference"`, not `"error-inference"`
— a real, observed mismatch, asserted directly against the real content
directory by `registry.test.ts`'s `checkRecordsAgainstRegistry` suite. Not
silently renamed: the file is owned by the statistics-inference cluster
bead (`am-found-statistics-inference-pzqv`), and this bead does not edit
another bead's content. Flagged here and in a `br comments add` on that
bead instead.

`plannedCallers` is left empty for all 46 entries. No real data exists yet
about which future paper sections will call which foundation; inventing
anchor ids would be exactly the kind of fabrication the orchestrator's
incident notices this session were about. Owning beads add their own
entries as they author.

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

No acceptance criterion of this bead is fully met while the items above
stay unbuilt: they gate the drawer wiring, the backlinks, and the
end-to-end checks respectively.
