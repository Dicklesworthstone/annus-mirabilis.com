# `docs/`

Governance, provenance, and binding-decision records for the project (plan
§15.2). This scaffold documents the layout; it does not create the
source-pipeline paths below (git does not track empty directories, so an
entry with no files yet simply does not exist until its owning bead adds
one).

| Path | Holds | Owning bead |
|---|---|---|
| `provenance/<key>.md` | Provenance receipts, one per bibliographic key, written before editorial copy | `am-src-receipt-format-npo5` |
| `provenance/survey/` | Scan-source survey records (candidate facsimiles considered before pinning) | `am-src-receipt-format-npo5`, `am-src-scan-survey-sqnu` |
| `editorial/RECEIPT_FORMAT.md` | The machine-readable provenance receipt front-matter format and the receipt checker's rules | `am-src-receipt-format-npo5` |
| `rights-vocabulary.yaml` | The controlled vocabulary for rights statements used across provenance receipts | `am-src-rights-policy-1dp` |

Already present and out of this bead's scope: `DECISIONS.md` (binding
architectural/governance/editorial decisions), `DONOR_AUDIT.md` and
`FRANKENSIM_BINDING.md` (pinned donor-revision audits), `PLAN_MINING_DECISIONS.md`
(declined proposals from converting the plan into beads), `RIGHTS.md`,
`OWNERS.md`, and `design/placeholder/` (the reference copy of the current
placeholder's Annalen design, kept per project decision).
