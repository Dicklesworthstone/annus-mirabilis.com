# Named Contributors Brief

This brief defines contributor roles, authorship metadata, and attribution rules for human translation, glossing, and editorial work in Annus Mirabilis.

## Evidence Format

Contributor assignments are recorded in `docs/OWNERS.md` and referenced in content metadata:
- `id`: contributor ID registered in `docs/OWNERS.md`
- `roles`: one or more of `translator`, `checking-editor`, `glossator`, `edition-editor`
- `scope`: papers or sections contributed
- `status`: `assigned` or `open: recruiting`
- `consentToBeNamed`: `yes` (or `not-applicable` for open roles)

## Four Contributor Roles

1. **`translator`**: Drafts English translation units directly from the 1905 German text.
2. **`checking-editor`**: Performs pre-review checking and editorial refinement of translations against the German text (recorded in `editedBy`).
3. **`glossator`**: Authors word-by-word interlinear gloss units preserving grammatical forms.
4. **`edition-editor`**: Editors named in `content/source-blocks/<slug>/edition.yaml` who perform page-by-page comparison against the facsimile to earn the `corrected` edition state.

## Authorship Block Metadata

Every content record carries an explicit authorship block with fields:
- `draftedBy`: contributor ID or agent tag (`agent:<name>`)
- `translatedBy`: contributor ID of the human translator
- `editedBy`: contributor ID(s) of human checking and edition editors

All human IDs in authorship blocks must resolve to a valid row in `docs/OWNERS.md`. Unresolved human IDs fail compilation with `authorship-unknown-contributor`.

## The `edition.yaml` Editors Rule

In `content/source-blocks/<slug>/edition.yaml`, the `editors` list must contain at least one valid human contributor ID registered in `docs/OWNERS.md`.

## Credit Consent

Consent to be named (`consentToBeNamed: yes`) in `docs/OWNERS.md` covers:
- The public owners registry
- Translation and editorial credits on provenance receipts (`docs/provenance/<key>.md`)
- The public `/sources` attribution page
