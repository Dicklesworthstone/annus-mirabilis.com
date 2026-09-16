# `public/`

Only assets admitted for public redistribution live here (plan §15.2). Every
file under this tree ships to readers as-is; rights status is recorded
before a file lands, never inferred afterward (AGENTS.md, "Sources, Rights,
and Provenance").

This scaffold creates none of the paper/facsimile/WASM assets below; it
documents where later beads put them so nobody invents a second location
(git does not track empty directories, so an entry below with no files yet
simply does not exist on disk until its owning bead adds one).

| Directory | Holds | Owning bead(s) |
|---|---|---|
| `papers/pdfs/` | Pinned facsimile scans, named `<bibliographic-key>.pdf` (e.g. `ap-17-549.pdf`) | `am-src-download-script-15ar` |
| `papers/transcripts/` | Diplomatic transcription ledgers, named `<bibliographic-key>-reviewed.txt` | `am-src-download-script-15ar` and the editorial ledger beads |
| `wasm/` | Content-addressed generated FrankenSim WASM artifacts, pinned by digest | `am-fs-slim-artifact-0yh` |
| `figures/` | Authored diagrams and reviewed source crops | Instrument and reading beads, per figure |

`public/edition/` (gitignored) holds versioned reading payloads and
public machine-readable exports regenerated at build time; it is never
hand-edited or committed.

Never pin a publisher PDF served under a subscription license, and never
replace a pinned facsimile because a reading looks surprising — diagnose the
reading or the provenance instead (AGENTS.md, "Pinned facsimile sources").
