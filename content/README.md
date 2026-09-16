# `content/`

Declarative, reviewable source records for the edition (plan §15.2). Each
record is a small, independently reviewable file under a schema — JSON or
YAML, plus constrained Markdown for long prose. Executable MDX, functions,
runtime objects, and untrusted JavaScript never live here. A build-time
compiler (`bun scripts/build-content.ts` and `bun scripts/build-equations.ts`)
joins these records into route-local payloads under the gitignored
`src/generated/` tree.

This scaffold creates none of the editorial content below; it documents where
later beads put it, so nobody invents a second location or mistakes a missing
directory for a stray one. Directories are created by the first bead that
writes a file into them (git does not track empty directories).

| Directory | Holds |
|---|---|
| `papers/` | `Paper` records: slug, bibliographic key, titles, dates, journal record, ordered source-block ids |
| `source-blocks/` | `SourceBlock` records: immutable id, kind, diplomatic transcription, source locator, review state; plus `manifest.yaml` (`SourceManifest`: page range, page coverage, unit inventory, exports, imports, and frozen id timestamps) |
| `translations/` | `TranslationUnit` records: stable id, source-block references, English text, attribution, revision |
| `glosses/` | `GlossUnit` records: word-level German-to-English gloss, attributed |
| `annotations/` | `EditorialNote` records: historian's margin, correction, typographical, dispute, side note |
| `arguments/` | `ArgumentNode` records: question, premises, conclusion, logical role, derivation steps, coverage obligation |
| `foundations/` | `Foundation` records: learning objective, R0–R3 explanations, worked example, instrument, prerequisites |
| `misconceptions/` | `Misconception` records: tempting claim, why it is tempting, what is true, instrument, anchors, sources |
| `historical-premises/` | `HistoricalPremise` records: proposition, availability date/range, evidence, admitted discovery stages |
| `equations/` | `Equation` records: semantic expression tree, notation forms, term/operation ids, canonical quantity bindings |
| `quantities/` | `Quantity` records: canonical id, dimension, mathematical kind, frame, permitted units |
| `experiments/` | `Experiment` manifests: parameter schema, owner capability, model domain, outputs, acceptance cases |
| `scenarios/` | `Scenario` records: exact initial conditions, seed policy, actions, expected invariants |
| `datasets/` | `HistoricalDataset` records: citation, digitizer, columns, rows, uncertainty |
| `tours/` | `Tour` records: ordered anchors with a budget label and completion statement |
| `bibliography/` | `Citation` records: bibliographic record with role (primary, comparison witness, secondary, technical) |

See AGENTS.md ("The Content Model") for the full entity definitions and
naming conventions, and `docs/CONTENT_IDS.md` for the sentence/anchor id
grammar once it exists.

## Source Manifest Format (`content/source-blocks/<slug>/manifest.yaml`)

Source manifests define the canonical inventory of source units and measure completeness block by block across distinct dimensions (diplomatic transcription, mathematical transcription, translation, review) without aggregating into a single percentage (plan §3.2, AGENTS.md).

### Header Fields
- `paper`: Paper slug (`light-quanta`, `brownian-motion`, `special-relativity`, `mass-energy`, `molecular-dimensions`).
- `document`: Primary bibliographic key (e.g. `ap-17-132`).
- `documents`: Optional array of all related bibliographic keys (e.g. `[ap-19-289, ap-34-591]`).
- `status`: Edition status (`in-preparation`, `complete`, `scoped`).
- `scope`: `full-document` or `selected-sections` (for scoped companion).
- `pageCount`: Positive integer page count.
- `pageRange`: 2-element tuple `[firstPage, lastPage]` matching journal pagination.
- `idsFrozenAt`: ISO date timestamp of whole-paper id freeze.
- `frozenBy`: Editor or agent identifier who froze the ids.
- `figures`: Explicitly `none` (1905 papers contain no source figures).
- `exportedResults`: Optional array of `{id, blockIds?, equationIds?, statement, printedForm}`.
- `importedResults`: Optional array of `{paper, resultId, use: "premise" | "comparison"}`.

### Unit Records (`units[]`)
- `id`: Stable unit identifier (`s<n>-p<m>`, `eq-s<n>-<k>`, `s<n>-fn<k>`, etc.).
- `kind`: `masthead-title`, `masthead-author`, `heading`, `part-heading`, `section-heading`, `paragraph`, `equation`, `display-equation`, `inline-equation`, `footnote`, `closing-dateline`, `closing-ack`, `closing-received`.
- `locators`: Ordered list of `{page, column?, line?, region?, splitPage?}`.
- `containedIn`: Identifier of enclosing paragraph or footnote for display and inline equations.
- `originalLabel`: Printed equation number or label (e.g. `(1)`).
- `references`: Array of sub-entries `{id: "<unit>-r<i>", printedText, kind: "bibliographic" | "internal" | "cross-paper", target: {citationId?, id?, paper?}}`.
- `destination`: Planning metadata (`editionBlockId`, `translationUnits`, `argumentObligations`, `notes`).
- `scope`: `in-scope` or `not-in-scope` (with `notInScopeReason`).
- `footnoteMark`: Printed footnote marker in text.
- `unmarked`: Boolean if footnote has no text mark (with `unmarkedReason`).

