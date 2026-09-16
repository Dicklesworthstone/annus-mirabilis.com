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
| `source-blocks/` | `SourceBlock` records: immutable id, kind, diplomatic transcription, source locator, review state |
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
