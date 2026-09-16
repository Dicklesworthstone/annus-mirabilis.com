# `scripts/`

Build, verification, source-acquisition, and release tooling, run with Bun
(plan §15.2, AGENTS.md "Tooling"). This scaffold documents the
source-pipeline layout below; it does not create those paths (git does not
track empty directories, so an entry with no files yet simply does not
exist until its owning bead adds one).

| Path | Holds | Owning bead |
|---|---|---|
| `sources/facsimile-sources/` | Per-bibliographic-key download configuration (scan URL, rights statement, retrieval policy) | `am-src-download-script-15ar` |
| `sources/ocr-plans/` | Bounded, checkpointed cloud-OCR job plans, one per source | `am-src-ocr-orchestrator-u1e0` |
| `sources/ocr-instructions/` | Per-source instructions handed to the cloud OCR worker | `am-src-ocr-orchestrator-u1e0` |

The gitignored root `sources/` directory (its `.gitignore` entry is added by
`am-src-download-script-15ar`) holds local-only pinned scans and parent
scans; it is never committed and never a substitute for the receipts under
`docs/provenance/`.

Already present and out of this bead's scope: `build-content.ts` and
`build-equations.ts` (the content compiler, owned by the content and
equations beads), `generate-lab.mjs`/`generate-tracers.mjs`/`generate-walks.mjs`/`generate-inference.mjs`
(laboratory data generators), `perf/` (the shared initial-route graph
check and byte budgets), `scaffold/` (the static-output check and shared
log-line helper), `build/` (the inline-script hash manifest emitter), and
`reference/` (donor extraction reference material). `app-router-architecture.ts`
is the App Router purity and root-file allowlist gate
(`am-scaf-architecture-gate-l1p`).
