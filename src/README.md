# `src/`

The single Next.js App Router application (plan §15.2). `src/app/` is the
only App Router root in this repository — AGENTS.md Rule 2 forbids a
`src/pages` directory, a second app root, or legacy Pages Router files
(`_app`, `_document`, `_error`) anywhere in this tree, enforced by
`am-scaf-architecture-gate-l1p`'s architecture test.

This scaffold creates the directories below only where a file already lives
in them; the rest are documented here so later beads land in the right
place instead of inventing a sibling directory (git does not track empty
directories, so an entry with no files yet simply does not exist on disk).

| Directory | Owns |
|---|---|
| `app/` | Routes, layouts, the root error/not-found/robots/sitemap conventions, and the inline pre-paint script registry (`app/inline-scripts/`) |
| `content/` | Content schemas, the build-time compiler, validators, and route projections |
| `reader/` | The reading shell, return stack, source alignment, and the four reading faces (R0–R3) |
| `equations/` | The semantic expression tree, notation-form generation, static KaTeX rendering, term/operation interaction |
| `experiments/` | The instance-scoped experiment controller, accepted-snapshot ownership, and command classes |
| `workers/` | The versioned worker protocol, host-fed scheduler, transport, and worker loaders |
| `physics/reference/` | Audited TypeScript reference evaluators, one file per numerical capability, labeled as host calculations |
| `visuals/` | SVG, Canvas, and Three.js views that consume accepted snapshots and never recompute physics |
| `units/` | Display adapters and the shared tolerance/comparison module (`units/tolerance.ts`) for canonical quantities |
| `search/` | The build-time search index and client query layer |
| `testing/` | Source, numerical-boundary, and browser scenario fixtures; typechecked like the rest of the app (no `src/testing` exclusion) |

A reusable physical or numerical law belongs in FrankenSim, not here
(AGENTS.md, "FrankenSim Binding and Honesty"). This tree owns presentation,
teaching sequences, and the browser-boundary composition of FrankenSim's
generic capabilities into bounded educational experiments.
