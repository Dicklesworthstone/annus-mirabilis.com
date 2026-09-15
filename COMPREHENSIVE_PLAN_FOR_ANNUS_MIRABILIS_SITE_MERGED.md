# COMPREHENSIVE PLAN FOR ANNUS MIRABILIS (annus-mirabilis.com)

## Four papers. One year. An interactive critical edition and a laboratory for learning how to discover.

**Working Name:** Annus Mirabilis (`annus-mirabilis.com`)
**Public Hostname:** `annus-mirabilis.com` (Cloudflare registrar and authoritative DNS; Next.js App Router on Vercel via the verified candidate-then-promote release workflow)
**Open Source Repository:** `github.com/Dicklesworthstone/annus-mirabilis.com` (to be created)
**License:** MIT with the OpenAI/Anthropic rider for code and new prose, matching `classic-patents.com`, with source-specific exceptions recorded per asset (§4.6)
**Sibling Projects:** `classic-patents.com` (architecture donor; the Bern patent office is the historical bridge) and `frankensim` (numerical owner)
**Document Status:** Version 2.0 (Master Architecture, Editorial, Scientific, and Engineering Blueprint). This document proposes work; it does not describe an implemented or deployed website.
**Prepared:** 2026-09-14

---

## 0. How to read this document

This is the single source of truth for the new site in the same sense that
`COMPREHENSIVE_PLAN_FOR_CLASSIC_PATENTS.md` is for the patent museum. It is
written for the people and agents who will build it. It inherits the Classic
Patents engineering doctrine (dual-projection parity, never dumb down,
visuals are instruments not decoration, kernels own the law, honest
execution labeling, deterministic replay, no theater metrics, no file
deletion without written permission, App Router only, cloud OCR only), and
it changes that doctrine where a physics paper is not a patent and where an
audience of "anyone" is not an audience of working engineers. Every such
change is stated where it happens.

Version 2.0 is the product of two independent drafts and a comparative
review. It keeps everything from both that survived a second look and
records, in §22, what was corrected or added and why.

Sections 1 to 7 define the product and its editorial architecture. Sections
8 to 10 are the scientific and pedagogical core: the paper-by-paper physics
inventory with the calculations that must be preserved, the four discovery
journeys, and the instrument catalogue with its acceptance contract.
Sections 11 to 13 are the engineering spec: content model, runtime and
FrankenSim binding, verification. Sections 14 to 21 cover the material
around the papers, routes and typography, accessibility and performance,
quality gates, deployment, delivery, risks, and the definition of a
successful launch. Section 22 is the appendix set.

A note on tone. This plan is long because the papers are short. Sixty-three
journal pages carry four arguments that most people have only ever seen
summarized; the entire product exists to stop summarizing them. Where this
document says "must," it means a build gate or an editorial acceptance
criterion. Where it says "should," it means a default that a named owner may
override with a recorded reason.

---

## 1. The Central Recommendation and Mission

### 1.1 The corpus

In 1905, working six days a week as a technical expert (third class) at the
Swiss Federal Office for Intellectual Property in Bern, the 26-year-old
Albert Einstein sent four papers to *Annalen der Physik*:

| # | Slug | German title (as printed) | Working English title | Annalen locator | Received |
|---|---|---|---|---|---|
| 1 | `light-quanta` | *Über einen die Erzeugung und Verwandlung des Lichtes betreffenden heuristischen Gesichtspunkt* | On a Heuristic Point of View Concerning the Production and Transformation of Light | Ann. Phys. (4) **17**, 132–148; whole-series vol. 322 | 18 Mar 1905 |
| 2 | `brownian-motion` | *Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in ruhenden Flüssigkeiten suspendierten Teilchen* | On the Motion of Small Particles Suspended in Liquids at Rest, as Required by the Molecular-Kinetic Theory of Heat | Ann. Phys. (4) **17**, 549–560; vol. 322 | 11 May 1905 |
| 3 | `special-relativity` | *Zur Elektrodynamik bewegter Körper* | On the Electrodynamics of Moving Bodies | Ann. Phys. (4) **17**, 891–921; vol. 322 | 30 Jun 1905 |
| 4 | `mass-energy` | *Ist die Trägheit eines Körpers von seinem Energieinhalt abhängig?* | Does the Inertia of a Body Depend on Its Energy Content? | Ann. Phys. (4) **18**, 639–641; vol. 323 | 27 Sep 1905 |

The page ranges total sixty-three journal pages: 17, 12, 31, and 3. The
publication dates recorded by the Einstein Papers Project are 9 June,
18 July, 26 September, and 21 November 1905 respectively; the site stores
composition date-line, receipt date, issue publication date, and later
edition dates as separate fields (§3.1) and verifies the issue-level
publication dates against the pinned facsimiles before displaying a
day-specific timeline. Received dates are never labeled as publication
dates.

Working English titles are editorial; they are not a declaration that any
existing translation will be republished (§4).

A fifth document from the same year is handled as a **companion record**,
not a flagship (§3.7): the doctoral dissertation *Eine neue Bestimmung der
Moleküldimensionen*, dated 30 April 1905, submitted to the University of
Zurich on 20 July 1905, published in Ann. Phys. (4) **19**, 289–306 (1906)
with Einstein's own correction in Ann. Phys. (4) **34**, 591–592 (1911). It
shares its mathematics with paper 2, supplies the third of three
determinations of Avogadro's number in one year, and contains the corpus's
best "Einstein made an arithmetic error and here is how it was caught"
story. It never delays the four papers.

Together the papers introduced light quanta and the photoelectric equation,
predicted and quantified Brownian motion as a way to count atoms, rebuilt
the kinematics of space and time from two postulates, and derived the
equivalence of mass and energy.

### 1.2 What to build

Build **an interactive critical edition and a discovery laboratory**, not an
Einstein biography, a physics encyclopedia, or four illustrated summaries.

The visitor should be able to move continuously between five things: the
exact historical passage in German; a faithful English translation; an
explanation that makes every inferential step intelligible at the depth the
reader asks for; an instrument that lets the visitor interrogate the claim;
and a reconstruction of the problem before its solution was known. These
are projections of one underlying content model, not separately maintained
versions of the website.

Classic Patents supplies the right foundation: serious primary-source
presentation, parallel explanations, colorized mathematics, and physical
instruments whose outputs have identifiable owners. Annus Mirabilis keeps
those strengths while changing the organizing unit from **a patented
mechanism** to **an argument**. A patent exhibit asks "How does this
mechanism work?" This site must additionally ask "What would make a
reasonable person suspect this idea, and what distinguishes that suspicion
from a derivation or a test?"

The defining experience:

> You encounter a real difficulty. You try a plausible response. You find
> out precisely what it preserves and what it breaks. You acquire one more
> mathematical tool. Then you make a small, consequential move yourself.
> Only afterward do you see where that move appears in the paper.

This must not become a disguised multiple-choice quiz in which every
alternative is foolish, and it must not pretend that Einstein's conclusions
followed inevitably from everything known in 1904. The distinction between
a logically sufficient reconstruction and a documented account of
Einstein's actual thinking is foundational (§5.1).

### 1.3 The problem the site solves

These are among the most famous documents in science and almost nobody has
read them. The barriers are specific:

1. **Language and access.** The originals are in German, in a journal now
   behind a publisher paywall. The standard English translations are a
   century old (Perrett and Jeffery 1923, Cowper 1926), in a
   university-press edition that is not freely reusable (Beck 1989), or
   scattered across journal articles (Arons and Peppard 1965). None sits
   next to the German, sentence by sentence.
2. **Notation.** Einstein writes the speed of light as $V$ (papers 3 and 4)
   and $L$ (paper 1), emitted energy as $L$ (paper 4), viscosity as $k$,
   particle radius as $P$, uses $R/N$ where we write $k_B$, never writes
   $h$ (he writes $R\beta/N$), and his $\beta$ is the modern $\gamma$. A
   modern reader with a physics degree stumbles; a programmer or physician
   gives up on page one.
3. **Missing scaffolding.** The papers assume the 1904 curriculum: kinetic
   theory, entropy, Maxwell's equations, Wien's law, Boltzmann's principle,
   Stokes drag, van 't Hoff's osmotic pressure, Lorentz's electron theory.
   The papers are short because that scaffolding is assumed, not because
   the ideas are simple.
4. **Static equations.** A reader cannot turn the dial on $T$ in Wien's
   law, cannot watch $\langle x^2\rangle$ grow linearly with $t$, cannot
   slide $v$ toward $c$ and watch simultaneity slip. Every result in these
   papers is a relationship between quantities, and relationships are
   learned by moving one thing and watching another.
5. **Hindsight.** Popular accounts explain the results. They rarely put the
   reader in 1904 with the facts Einstein had and ask what a careful person
   could have done with them, and when they try, they hand the reader the
   conclusion inside the premise.
6. **Gatekeeping by prerequisite.** Almost every existing explanation
   either assumes a physics degree or abandons the mathematics entirely.
   Neither serves the reader who is willing to work but starts without
   algebra, or the reader whose first language is neither German nor
   English, or the reader who cannot see a diagram.

### 1.4 The solution: Annus Mirabilis

A single-purpose, open-source, museum-grade reading and simulation
environment for the 1905 papers, built on the Classic Patents architecture:

1. **Pinned facsimiles and reviewed German ledgers** from the *Annalen der
   Physik* scans, with SHA-256 provenance receipts exactly as the patent
   museum does for USPTO PDFs, and a source manifest that measures
   completeness block by block (§3.2).
2. **A new, sentence-aligned English translation** made from the
   public-domain German, presented as a bilingual archival edition with
   term annotations, an interlinear gloss face, and a **notation
   concordance** (Einstein's 1905 symbols beside modern ones, scoped to the
   section where each symbol has its meaning).
3. **Explanations at the reader's chosen detail and perspective.** Every
   paragraph has an authored overview, a full explanation for a reader
   with undergraduate calculus and linear algebra, a from-the-ground-up
   explanation that shows every step, and a historian's margin. Beneath
   all of that, each paper has a **first encounter that assumes no
   algebra**, with a visible bridge to the real argument (§7.4). The reader
   chooses an activity and a kind of help, never a profession or an
   ability tier (§6.1).
4. **Colorized, live, semantic equations.** Every displayed equation in
   the four papers rendered in KaTeX from a semantic expression tree,
   dual-coded by color to a plain-English sentence, each term bound to a
   canonical quantity with dimension, frame, and live value. Derivations
   are shown as chains: step, reason, tool, with the "move" marked and the
   tool linked to a foundation lesson. Selecting an operation is as
   supported as selecting a symbol (§15.4).
5. **Instruments for every substantive obstacle**, not a slider for every
   sentence: blackbody spectra with honest coordinate handling, the
   radiation-entropy workbench with its integration constant, independent
   configurations, the photoelectric bench, a tracer ensemble with a
   specified inference model, clock synchronization as an event ledger,
   the boost constructed rather than handed over, field transformations,
   Doppler and aberration, the finite light complex and the moving mirror,
   the two-frame emission ledger. Every instrument runs on one accepted
   snapshot with typed results, deterministic control tapes, and
   FrankenSim ownership of the reusable laws (§10, §12).
6. **Discovery journeys.** For each paper, a guided reconstruction that
   starts from a dated 1904 shelf, poses the questions in an order a
   careful person might have asked them, lets the reader choose at forks
   where the real alternatives were on the table, shows what each branch
   preserves and breaks, and lands on the paper's own move with a live
   numerical check against dated measurements. The reconstruction is
   labeled "a route you could take," never "what Einstein thought" (§9).
7. **The material around the papers**: methodological essays on how ideas
   get found, the 1904 desk, connections among the papers, the
   three-ways-to-count-atoms lab, capstones, and the Bern bridge to
   `classic-patents.com` (§14).
8. **Scientific honesty that survives interactivity.** A rendered
   animation, a computed model consequence, a verified numerical method,
   and an empirical observation remain distinguishable everywhere on the
   site, and a result that is not a number (underdetermined, outside the
   model, a valid limiting state) is shown as such rather than as an
   invented value (§11.4).

### 1.5 Non-negotiable product outcomes

1. **Complete papers.** Every original paragraph, displayed equation,
   substantive inline equation, footnote, qualification, date-line,
   acknowledgment, and reference has a place in the edition. The difficult
   closing sections (paper 3, §§6–10; paper 1, §9) cannot disappear behind
   the familiar headlines.
2. **No prerequisite dead ends.** Unfamiliar mathematics opens into an
   explanation with a worked example, a picture or manipulable
   construction, and a route back to the exact interrupted argument.
3. **Equations are readable instruments.** Symbols, operations, units,
   assumptions, frames, and live quantities are linked explicitly. Color
   helps identify meaning but never carries meaning alone.
4. **Discovery is a first-class editorial product**, with reasonable
   alternatives, evidence limits, and opportunities to predict before
   seeing results, and a full explanation available regardless of the
   prediction.
5. **FrankenSim owns the reusable computational physics**; the website
   owns presentation and teaching sequences. Missing generic capabilities
   are developed upstream, not duplicated in page components.
6. **The reading experience is excellent without a GPU, without running a
   simulation, and without JavaScript.** Expensive features enhance the
   book; they do not hold it hostage.
7. **The no-algebra route is not a lesser website.** It leads to the same
   source passages and the same instruments, with the same scientific
   claims, and its bridges are authored with the same care as the
   derivations.

### 1.6 What "interactive visualizations of everything" means

Coverage of every substantive conceptual and mathematical obstacle, not a
slider attached to every sentence or a 3D scene for every noun. The
appropriate instrument can be a manipulable experiment, an event table, an
equation transformation, a counterexample, a probability distribution, an
annotated construction, or a linked geometric picture.

Each argument step carries a **coverage obligation** that names the
question a visual must answer, its observable response, its mathematical
owner, and its accessible nonvisual equivalent. A beautifully explained
static detail is acceptable where motion would add no information; an
unexplained central inference is not. Several related steps may share one
instrument provided the correspondence is explicit (§10.4).

### 1.7 The intended audience and the five accomplishments

The site welcomes anyone who wants to understand: readers with no algebra,
rusty or strong mathematical preparation, different first languages,
disabilities, limited time, or modest devices. The sustained English
critical edition remains available to technically fluent readers; it is
no longer the only front door. Basic calculus and linear algebra support
one route, not admission to the project.

Programmers will find event logs, transformations, invariants,
distributions, units, and debugging analogies useful. Physicians and other
scientifically literate readers will find measurement, inference, rates,
uncertainty, osmosis, and diffusion familiar. These are optional bridges
authored into the material, not stereotypes the reader must adopt. **A
reader never declares a profession, passes a placement test, or is
assigned a level.** The personas of §7.1 are editorial review lenses used
by the authors; they are invisible to the reader.

Let visitors choose what they are trying to do today, in ordinary words:

| Accomplishment | A meaningful outcome | What must remain within reach |
|---|---|---|
| **Appreciate** | Explain why the question mattered and what was surprising about the answer | A concrete example and the original passage |
| **Explain** | Reconstruct the main reasoning in words, pictures, or a small table | Definitions, assumptions, and a bridge to symbols |
| **Predict** | Anticipate how a specified change affects an observable and say why | Units, numerical examples, and the applicable model |
| **Derive** | Reproduce the mathematical steps and identify each premise | Every intermediate step, alternative derivations, source notation |
| **Critique** | Separate what follows, what is suggested, what has been measured, and what remains undetermined | Countermodels, uncertainty, primary sources, later qualifications |

These overlap; they are not a ladder of worth. A mathematician may want a
quick appreciation route; a reader who begins without algebra may
eventually want the full derivation. The site never hides the source,
disables advanced material, or silently simplifies future pages because of
an earlier choice.

The first screen asks a scientific question and offers **"Show me with an
example"** and **"Take me to the paper."** It does not ask whether the
visitor is clever enough to enter, and it does not promise that four
difficult papers can be mastered in minutes; it makes the first worthwhile
insight available quickly and the subsequent path dependable.

### 1.8 A concrete universal-access promise

For each paper, ship a short first encounter that assumes no algebra, no
graph-reading fluency, and no physics vocabulary, followed by a visible
bridge to the actual argument. Every bridge says what new skill it
introduces, why that skill is useful here, and how to continue with more or
less guidance. The promise is multiple viable routes toward the same
scientific questions, not identical presentation for everyone. Someone who
cannot operate a 3D scene can still choose observations, change conditions,
compare outcomes, and reason about the same relationship. Someone not ready
for calculus can still appreciate what a derivative means, then learn its
calculation when desired.

### 1.9 The governing design test

When proposing a feature, name a reader obstacle, show the simplest working
interaction that addresses it, and specify an observable sign of improved
understanding. Novelty alone is not a reason to ship. The most valuable
innovations here are semantic links between representations, explanations
that diagnose a specific missing step, fair comparisons between alternative
models, and scientific participation without assumed mathematical or
sensory abilities. None requires a large framework or an open-ended tutor.

### 1.10 What the site is not (explicit non-goals for the first release)

- Not a biography. Bern, Mileva Marić, the Olympia Academy, and the patent
  office appear only where they explain the physics or its reception.
- Not a general relativity site, a history of quantum mechanics, or a
  Schrödinger laboratory. Where a 1905 remark is only understood with
  later physics (the equator-clock note, the transverse mass), the
  historian's margin says so and stops.
- Not a popular-science paraphrase. The German is the source face; the
  translation is checked against it line by line; explanations retain
  units, limits, and uncertainty.
- Not a social network, a payment system, an account system, or an
  open-ended automated tutoring service. No hosted language model is in
  the reading path at launch.
- Not a port of the renderer to Rust, not a 3D scene for every diagram,
  not a new numerical library adopted because it is fashionable. The
  differentiator is unusually complete understanding of four papers, not
  the novelty of the web framework.

---

## 2. What the Donor Projects Establish

### 2.1 Audit identity and limitations

The plan is grounded in source inspection of two repositories and the
deployed patent museum. Record the revisions inspected so a later reader
can reproduce the audit:

| Repository | Inspection method | Role in this plan |
|---|---|---|
| `Dicklesworthstone/classic-patents.com` | Full clone; read README, the comprehensive plan, all of `AGENTS.md`, `package.json`, `src/types/*`, `src/physics/usePatentPhysics.ts`, `telemetryData.ts`, `genericWasm.ts`, `controlTape.ts`, `ColorizedEquation.tsx`, `LatexRenderer.tsx`, the edition and ledger contract, the Tesla edition, the Wright provenance receipt, `docs/PATENT_E2E_HARNESS.md`, the deploy scripts; inspected the deployed catalogue | Source-edition architecture, equation interaction, physics ownership, coverage schema, browser acceptance, release workflow |
| `Dicklesworthstone/frankensim` | Full clone; read README and workspace manifest, `crates/fs-wasm/src/lib.rs` (including `heat_frames` and `qmc_vs_mc`), `crates/fs-wasm/Cargo.toml`, `fs-rand` public API, crate descriptions | Numerical substrate, random streams, units, browser boundary pattern, capability-claim discipline |

At implementation kickoff, pin the exact commit hashes of both repositories
in `docs/DONOR_AUDIT.md`; every claim below about donor code is a claim
about the inspected revision. This was **source and document inspection,
not an execution audit**: no production slider behavior, screenshot
comparison, full test suite, native build, or WASM build was independently
exercised. Reported catalogue counts are documentation facts at the
inspected snapshot.

Trust the manifest, lockfile, and executing code over prose. The donor's
`package.json` declares `next`, `react`, `three`, `katex`, `pdfjs-dist`,
and `zod`; it does not declare React Three Fiber although architectural
prose mentions it. Plan against what is declared.

### 2.2 Concrete findings

**The donor has a real source-edition system.** It separates the pinned
facsimile, the reviewed transcription ledger, the visitor-facing authored
edition, and editorial explanation, and it explicitly rejects treating
editorial prose as a substitute for the historical document. This
separation becomes stronger here, because the edition is bilingual.

**Coverage is multidimensional.** The donor distinguishes 103 catalogue
records, 100 reviewed ledgers, 89 accepted editions, 3 patent-specific WASM
surfaces, 35 generic-WASM consumers, and 65 typed-host-only records. These
are not the same number and the donor never pretends they are. Annus
Mirabilis preserves that precision: source completeness, translation
review, argument coverage, instrument availability, accessibility
equivalence, and numerical validation are separate dimensions (§10.4).

**The equation interaction is a real foundation.** The schema links
symbols, roles, units, sentence fragments, colors, and telemetry; the
component supports term selection, keyboard navigation, a color-blind mode,
and live values. KaTeX produces HTML plus MathML with a restricted trust
callback. **Seams to redesign:** telemetry lookup by human label and
permissive token matching (`variableId.startsWith("var_" + id)`) are
tolerable in a museum and wrong for a bilingual scientific edition where a
symbol means different things in different sections; term identity must be
an exact canonical quantity id (§11.3).

**The shared parameter hook is the wrong ownership layer for experiments.**
`usePatentPhysics` keeps module-global maps keyed by patent id and
increments a control-change tick. That tick is a UI event count, not a
physical solver step, and one global map cannot host two independent
instances of the same experiment, a frame change that must not restart the
run, or a stochastic trajectory that must survive re-rendering. The runtime
of §12 replaces it with instance-scoped owners and accepted immutable
snapshots.

**The donor already understands bundle boundaries.** `DualProjectionViewer`
accepts server-resolved per-patent equation data rather than importing the
aggregate registry (its comments cite the registry at roughly 976 KB), and
the September 2026 build measured home first-load JavaScript at 192 kB
after that change. Extend the discipline to source editions, foundation
lessons, search, and simulation packages.

**Provenance is tied to ownership.** `coverageManifest.ts` distinguishes
packaged surfaces, loaded artifacts, typed refusal boundaries, and accepted
steps that actually own the bus; `HONEST_PLACEHOLDER`, `TS_FALLBACK`, and
`WASM` are distinct states. Keep the underlying truth even where the public
wording becomes gentler (§12.9).

**The generic WASM surface was checked function by function.** `fs-wasm`
already depends on `fs-rand` (counter-based Philox streams keyed by logical
identity, with `next_normal` and versioned checkpoints) and `fs-sparse`
(CSR Laplacians). Its `heat_frames` export is a fixed two-blob 2D
demonstration with a hard-coded initial field and a dimensionless time
step; it takes no diffusion coefficient, spacing, or profile, and it is
therefore not an honest owner for a diffusion instrument with real
controls. `fs-qty` represents base-dimension exponents as integers over six
base dimensions. `fs-demo-physics-wasm` shows the accepted/refusal JSON
envelope pattern with version identity and explicit no-claims. Repository
searches found no ready Brownian, radiation, or special-relativity product
API; absence in a search is not proof of absence, but no such capability is
assumed.

**The browser acceptance design is reusable.** It checks source identities,
exact routes, source assets, URL-restored views, actual controls, telemetry
and refusal behavior, 320 px screens, keyboard and touch, reduced motion,
and retained failure evidence, and it does not pretend browser checks
replace numerical or editorial review.

### 2.3 Reuse, refactor, and leave behind

Do not fork the repository and delete most of it. Start a new repository
with a small, attributable extraction of proven components and contracts,
preserving license notices. Changes useful to both sites become an
explicitly versioned shared package only after a second concrete use
establishes the interface; do not invent a "museum framework" before the
Einstein reader works.

| Existing seam | Decision | Adaptation for Annus Mirabilis |
|---|---|---|
| Pinned PDF + reviewed ledger + authored edition + provenance receipt | Reuse the architecture | Bilingual editions, many-to-many alignment, notation concordance, separately attributed editorial notes |
| `LatexRenderer.tsx`, `TextWithLatex`, `HudText` | Adapt | Build-time static mathematics (HTML + MathML); hydrate term interaction only; fail publication on malformed mathematics; never leave raw `$LaTeX$` visible |
| `ColorizedEquation.tsx`, `colorPalette.ts`, `equationValueFormatting.ts`, `src/types/equation.ts` | Refactor | Exact canonical quantity ids, operation-level explanations, derivation chains, typed quantity bindings, notation forms generated from an expression tree, accessible controls |
| `DualProjectionViewer.tsx`, `patentViewMode.ts` | Reuse the interaction ideas, not the monolith | A reader shell with independently loaded source, translation, explanation, discovery, and laboratory panels; `?view=` deep links kept |
| `parallelReadings.ts` (block-index keyed) | Replace the addressing model | Stable content ids and many-to-many alignment; inserting a paragraph must not shift annotations |
| `usePatentPhysics.ts` | Replace the ownership layer | Instance-scoped experiments; one accepted immutable snapshot; input revision separate from solver step (§12.5) |
| `controlTape.ts`, `tickScheduler.ts`, `transport.ts`, `paramAliases.ts` | Reuse with the new identities | Deterministic tape, host-fed time, aliasing across instruments and papers |
| `genericWasm.ts`, `useGenericWasmSource.ts`, `wasmArtifacts` tests, `lie.ts`, `qty.ts`, `intervals.ts`, `energyLedger.ts` | Reuse | Honest `wasm` / `ts-fallback` / `unloaded` labeling; units; intervals; energy bookkeeping |
| `coverageManifest.ts` | Extend | Source, translation, argument, instrument, accessibility, and numerical coverage stay separate dimensions |
| `specClauses.ts` and the weave concept | Generalize | Highlight the exact premise or conclusion affected by a parameter, without treating truth as a decorative glow |
| `ThreeStudioScene.ts`, `StudioKernelChips`, linked 2D/3D | Selectively adapt | 2D first for event geometry and distributions; 3D only for apparatus and spatial relations that need it (§10.9) |
| `ArchaicGlossaryModal.tsx`, `esotericPatentTerms.ts` | Refactor | Context-sensitive notation concordance and period vocabulary, scoped by section, not a global dictionary keyed by spelling |
| `PhysicsTelemetryBadge*`, `SensitivitySlider`, `ControlTapeScrubber`, `ClaimConstraintToggle` | Adapt | Typed-value entry beside every slider; probe toggles keyed to results |
| `PinnedPdfFacsimile.tsx`, `usePinnedPdfFacsimile.ts`, `public/pdfjs` | Reuse | Facsimile viewer with a page map to sections and equations |
| Layout chrome, theme toggle, search palette, OG image routes, error boundaries, `robots`, `sitemap` | Reuse | Themes of §15.2; build-time search index |
| `scripts/verified-production-deploy.ts`, `deployment-*`, `smoke-test-deployment.ts`, `app-router-architecture.ts` | Reuse | Candidate-then-promote release with a release manifest (§18.3) |
| `scripts/verify-data.ts` (pattern), the E2E harness | Adapt | Content compiler and paper vertical slices (§17) |
| `AGENTS.md` | Copy and edit | Rules 0–2, git safety, cloud-OCR-only, FrankenSim honesty, Three.js craft, release, Beads, Agent Mail, landing the plane; new chapters per §17.6 |
| `ios/` (the FrankenPatents app): XcodeGen project with a stale-project check, build-time export of web records, the pinned-digest PDF downloader, the zero-collection privacy manifest, DEBUG launch arguments, UI tests that produce store screenshots, the local Apple gate | Adapt the patterns, not the code | The iPhone app of §18.6: a native shell around the bundled edition in WKWebView. Its native TeX parser, SceneKit simulation tab, hand-typed theme, and source-substring parity checks are not ported |
| Patent claims, disputes, categories, lineages, era filters, broadside printing, audio narration player, wizard reports | Do not port | Replaced by argument steps, historical alternatives, evidence, connections; narration returns later as reviewed audio (§16.4) |
| Generic or Wright-default visual dispatch | Do not port | Exhaustive experiment registry; unknown ids fail explicitly rather than showing a plausible wrong model |

### 2.4 Stack

Retain the division of labor: Next.js App Router, React, TypeScript,
restrained Tailwind, KaTeX, direct Three.js where needed, and Rust/WASM
numerical owners. At kickoff select current supported compatible versions
and lock them; do not make a framework migration part of the scientific
critical path. New physics code follows FrankenSim's nightly Rust,
safe-code, and dependency policies; the web UI is not an excuse for a
separate numerical stack. Bun for tests and scripts, Biome for lint and
format, strict TypeScript, `ubs` for the bug scan, as in the donor.

---

## 3. The Corpus: Identity, Structure, and the Scope of Completeness

### 3.1 Identity fields and dates

Each paper record carries: the printed German title, the author line as
printed ("von A. Einstein"), the date-line as printed ("Bern, den 17. März
1905"; "Bern, Mai 1905"; "Bern, Juni 1905"; "Bern, September 1905"), the
receipt date recorded by the journal, the issue publication date, the
journal series and fourth-series volume, the whole-series (Wiley) volume,
the issue number as recorded by Wiley, the page range, and the DOI as
currently resolvable. Store each date with its **type**; a timeline card
says which date it is showing. The DOIs recorded so far are
`10.1002/andp.19053220607`, `10.1002/andp.19053220806`,
`10.1002/andp.19053221004`, and `10.1002/andp.19053231314` (a later Wiley
reissue DOI `10.1002/andp.200590007` also exists for paper 4); all are
verified against the publisher landing page at pinning time.

Route slugs are the short names of §1.1. The bibliographic keys
`ap-17-132`, `ap-17-549`, `ap-17-891`, `ap-18-639`, and `ap-19-289` are
stored in metadata and used for citation and file naming, never as URLs.

### 3.2 Completeness is measured against a source manifest

Before writing explanations, inventory each document into stable blocks:
title, author line, introduction, numbered sections, paragraphs, displayed
and inline mathematics, footnotes, references, date-line, acknowledgments,
and any source figures (the four papers have none). Each block gets a
permanent id, a source locator (PDF page index, printed journal page,
region on the facsimile), the original equation label where one exists and
an editorial label in a distinct namespace where none does, and a status
for transcription, mathematical transcription, translation, and review.

The manifest, not a hand-maintained percentage, determines whether an
edition is complete. A block cannot be "covered" by linking to a whole
paper. Every substantive argument step additionally requires an
explanation, its dependencies, at least one worked or visual treatment
where useful, and a statement of its assumptions (§10.4).

PDF page counts can differ from journal page counts when covers or
editorial matter are included; provenance distinguishes PDF page index,
printed journal page, and any translation page.

### 3.3 Paper 1, `light-quanta`: complete treatment map

Seventeen pages, nine numbered sections, no figures. The nine sections,
not merely the photoelectric application, are the product scope.

| Original part | Reader's central question | Required treatment | Results and printed checks |
|---|---|---|---|
| Introduction | Why might a successful wave description be incomplete? | Contrast continuous field descriptions with discrete matter without asserting that optical wave phenomena disappear; state the heuristic | The heuristic status, verbatim |
| §1 Difficulty in black-body theory | What goes wrong when classical energy sharing is applied to radiation? | Mode counting and energy allocation with explicit assumptions and a finite-cutoff instrument; the divergence shown as a refusal, not a clamp | $\rho_\nu = \frac{R}{N}\frac{8\pi\nu^2}{L^3}T$; $\int_0^\infty\rho_\nu d\nu$ has no finite value |
| §2 Planck's elementary quanta | What had Planck determined, and what is Einstein changing? | Historical constants and units; distinguish quantized oscillator energy from a hypothesis about radiation | $N = \frac{\beta}{\alpha}\frac{8\pi R}{L^3}$ **[printed $6.17\times10^{23}$]** |
| §3 Radiation entropy | How can a measured spectrum say something about entropy? | Derive $\partial\varphi/\partial\rho = 1/T$ and say what is held fixed (foundation: entropy and temperature) | The thermodynamic identity, derived not assumed |
| §4 Low-density monochromatic radiation | Why does the Wien regime simplify the problem? | Invert Wien's law, fix the integration constant, integrate at fixed narrow band; the complete calculation of §8.1 | $S - S_0 = \frac{E}{\beta\nu}\ln\frac{V}{V_0}$ |
| §5 Gases and dilute solutions | How does counting independent possibilities produce an entropy law? | Volume probability, independence, logarithms, the gas and solution analogy; the counterexample of locked positions | $S - S_0 = \frac{R}{N}\ln W$; $W = (V/V_0)^n$ |
| §6 Interpreting radiation entropy | Why does the same functional form suggest independent quanta? | Let the reader compare coefficients and infer an energy scale; mark the heuristic leap and its domain; do not round $E/(\beta\nu)$ to an integer | $W = (V/V_0)^{NE/(R\beta\nu)}$; quanta of energy $R\beta\nu/N$ |
| §7 Stokes's rule | What restrictions follow when light changes frequency? | Energy-budget instrument for fluorescence; reproduce the paper's qualifications rather than a universal prohibition | emitted $\nu \le$ absorbed $\nu$ with the thermal caveat |
| §8 Photoelectric emission | What changes electron energy, and what changes electron count? | Frequency, intensity, work function, stopping potential, losses; predictions distinguished from later confirmation | $\Pi\varepsilon = \frac{R}{N}\beta\nu - P$ **[printed: $\nu = 1.03\times10^{15}$ s$^{-1}$ gives about 4.3 V]** |
| §9 Gas ionization | What does the hypothesis predict about ionization energy and yield? | Threshold and upper-bound counting arguments; separate one-quantum assumptions from real cross-sections | energy per ion $\le R\beta\nu/N$ |
| Closing | | Date-line preserved | "Bern, den 17. März 1905" |

**Editorial boundary.** The paper argues from Wien's law, not Planck's, and
calls the result heuristic. §6 is never presented as a derivation of
Planck's law or a theory of the photon; it is an inference that radiation
in the Wien regime behaves thermodynamically as if made of independent
energy quanta, and the extension to emission and transformation processes
is a further physical hypothesis, not algebra alone.

**Notation concordance entries.** $R/N \to k_B$; $R\beta/N \to h$;
$\beta \to h/k_B$; $L \to c$ (in this paper); $\alpha, \beta \to$ Wien's
constants (editorial $A$, $B$ in the workbench); $\Pi \to$ stopping
potential magnitude; $\varepsilon \to e$; $P \to$ work function $\Phi$;
$\rho_\nu \to u_\nu(\nu, T)$, energy per volume per frequency, not
radiance.

### 3.4 Paper 2, `brownian-motion`: complete treatment map

Twelve pages, five numbered sections, no figures. The statistical-
mechanical foundation of §2 is not an optional omission merely because a
reader can proceed without it; both the direct route and the full
derivation are provided.

| Original part | Reader's central question | Required treatment | Results and printed checks |
|---|---|---|---|
| Introduction | Could molecular motion create visible, testable motion of suspended objects? | Einstein's conditional claim and his stated uncertainty about the observational reports, preserved faithfully | "it is possible that the motions to be discussed here are identical with so-called Brownian molecular motion" (paraphrase) |
| §1 Osmotic pressure of suspended particles | Why should visible particles share a law with dissolved molecules? | Semipermeable partition, dilution, number density, pressure, the force/area distinction | $p = \frac{RT}{N}\nu$ |
| §2 Statistical-mechanical justification | How can a vast microscopic problem yield a simple volume dependence? | Configuration counting, the volume factor $V^{N_p}$, free energy, pressure as a derivative; the original notation unpacked; "how did you avoid solving every molecular motion?" | the free-energy argument, complete |
| §3 Diffusion of small spheres | How can drag and equilibrium determine diffusion? | Stokes mobility and the cancellation between drift and diffusion flux; all limiting assumptions visible; the force drops out | $K\nu = \frac{RT}{N}\frac{\partial\nu}{\partial x}$, $K = 6\pi kPv$, $D = \frac{RT}{N}\frac{1}{6\pi kP}$ |
| §4 Irregular motion and diffusion | How do random displacements produce a deterministic equation? | Transition kernel, symmetry, Taylor expansion to second order, the diffusion equation, the Gaussian solution, the RMS; the coarse-graining assumption stated | $\partial f/\partial t = D\,\partial^2 f/\partial x^2$; $D = \frac{1}{\tau}\int\frac{\Delta^2}{2}\varphi(\Delta)d\Delta$ |
| §5 Molecular scale from visible motion | How could observations determine the molecular number? | Estimating diffusion from displacement, propagating uncertainty, distinguishing a synthetic exercise from historical data; the observable is a displacement, not a velocity | $\lambda_x = \sqrt{2Dt}$ **[printed: about 0.8 $\mu$m in 1 s, about 6 $\mu$m in 1 min, for 1 $\mu$m-diameter particles ($P = 0.5\,\mu$m) in water at 17°C with $k = 1.35\times10^{-2}$ CGS]**; $N = \frac{t}{\lambda_x^2}\frac{RT}{3\pi kP}$ |
| Closing | | The hope that an experimenter will decide the question; date-line | "Bern, Mai 1905" |

**Editorial boundary.** Einstein predicts a diffusive mean displacement.
He warns that the observable is not a mean velocity; the trajectory has no
tangent at microscope resolution. No instrument on the site shows a
"Brownian speed" as a physical quantity, and none estimates one from a
finely rendered polyline.

**Notation concordance entries.** $k \to \eta$ (viscosity, not Boltzmann's
constant); $P \to a$ (radius, not pressure); $\nu \to n$ (number density,
not frequency); $\lambda_x \to \sqrt{\langle x^2\rangle}$; $R/N \to k_B$;
$\varphi(\Delta) \to$ the transition kernel; $f \to p(x,t)$.

### 3.5 Paper 3, `special-relativity`: complete treatment map

Thirty-one pages, ten numbered sections in two parts, no figures, no
references, a closing acknowledgment to M. Besso. Allocate serious effort
to **both halves**. A train animation plus a Lorentz matrix is not a
complete treatment.

| Original part | Reader's central question | Required treatment | Results and printed checks |
|---|---|---|---|
| Introduction | Why does moving the magnet instead of the conductor create an explanatory asymmetry? | Apparatus, frame descriptions, measurable agreement, carefully scoped electrodynamics; the failed ether-drift detections; the two postulates; the ether declared superfluous | the two postulates, verbatim |
| §1 Simultaneity | How can distant clocks acquire an operational common time? | Signal exchange, the synchronization convention, event records, and the difference between an event and its reception | $t_B - t_A = t'_A - t_B$ |
| §2 Lengths and times | What do measurements of a moving rod actually compare? | Endpoint events and simultaneity; constraints on a light-based measurement procedure; observers moving with the rod find its clocks unsynchronized | the relativity of simultaneity |
| §3 Coordinate and time transformation | What map reconciles the postulates? | A full derivation: linearity assumptions, the remaining scale factor, reciprocity and isotropy, the inverse, the transverse step done honestly | $\tau = \beta(t - vx/V^2)$, $\xi = \beta(x - vt)$, $\eta = y$, $\zeta = z$, $\beta = (1 - v^2/V^2)^{-1/2}$ |
| §4 Physical meaning | What do clocks and rods report in different frames? | Contraction, dilation, transported clocks, curved paths, the equator remark with its limit-of-model note | ellipsoid axes $R\sqrt{1 - v^2/V^2}, R, R$; a moving clock loses $1 - \sqrt{1 - v^2/V^2}$ per second $\approx \tfrac{1}{2}v^2/V^2$ **[printed second-order form]** |
| §5 Velocity addition | Why doesn't adding ordinary speeds preserve light speed? | Differentiate the coordinate map; include transverse components; explore limits; the group property | $U = \frac{v + w}{1 + vw/V^2}$; two boosts give a boost |
| §6 Maxwell–Hertz transformation | How do electric and magnetic descriptions change together? | Chain rule, field components, unit conventions, the transformed equations component by component, the field-transformation ansatz and normalization argument as in the source; the magnet/conductor reconciliation | $X' = X$, $Y' = \beta(Y - \frac{v}{V}N)$, $Z' = \beta(Z + \frac{v}{V}M)$, $L' = L$, $M' = \beta(M + \frac{v}{V}Z)$, $N' = \beta(N - \frac{v}{V}Y)$ |
| §7 Doppler and aberration | How do frequency and propagation direction transform? | Wavefront phase and linked angular/frequency instruments, not sound analogies treated as proof | $\nu' = \nu\beta(1 - \frac{v}{V}\cos\varphi)$; $\cos\varphi' = \frac{\cos\varphi - v/V}{1 - \frac{v}{V}\cos\varphi}$ |
| §8 Light energy and moving mirrors | Why do amplitude and enclosed volume both matter? | Transform a finite light complex: amplitude factor and volume factor combine; then the mirror: transform in, reflect, transform out, with interception checks | $E'/E = \beta(1 - \frac{v}{V}\cos\varphi) = \nu'/\nu$; mirror pressure proportional to $\frac{(\cos\varphi - v/V)^2}{1 - v^2/V^2}$ in the printed Gaussian units |
| §9 Convection currents | How do charge density and moving charge fit the transformation? | Charge and current density, continuity, frame changes, the assumptions of the source; neutral current-carrying cases accepted | the transformed equations with $\rho$ |
| §10 Electron dynamics | What force, work, energy, and deflection relations follow? | The slowly accelerated electron; historical force and mass conventions preserved and explained; the work integral; the three relations "accessible to experiment" | longitudinal mass $m\beta^3$, transverse mass $m\beta^2$ (with the source's force convention); $W = mV^2(\beta - 1)$ |
| Closing | Who and what does the paper acknowledge? | The Besso acknowledgment, the date-line, the footnotes | "Bern, Juni 1905" |

**Editorial boundary.** §10's transverse coefficient corresponds to $m\gamma^2$
in modern factor notation because the source combines force components in
the instantaneously comoving frame with acceleration components in the
original frame; Planck's 1906 convention gives $m\gamma$. The site presents
§10 as printed, explains which frame's force and acceleration are being
compared, and offers a clearly identified modern momentum treatment beside
the faithful edition. It does not "repair" the source. The equator-clock
remark is shown as printed with a short limit-of-model note: on the
rotating geoid, gravitational and kinematic effects approximately cancel,
and that account needs later physics.

**Notation concordance entries.** $V \to c$; $\beta \to \gamma$ (the modern
$\beta = v/c$ appears nowhere in this paper); $(\xi,\eta,\zeta,\tau) \to
(x',y',z',t')$ and the moving-frame time symbol $\tau$ must not be read as
the modern proper-time symbol; $(X,Y,Z) \to \mathbf{E}$; $(L,M,N) \to
\mathbf{B}$; $\varphi \to$ the angle between the wave normal and the boost
axis; "light complex" $\to$ a finite plane-wave packet; $k$ and $K$ $\to$
the two coordinate systems.

### 3.6 Paper 4, `mass-energy`: complete treatment map

Three printed pages, no section structure. Its shortness makes exhaustive
treatment especially feasible, and brevity makes a missing premise easier
to hide, so it is reviewed with the same seriousness as the long papers.

| Argument block | Required treatment | Results and checks |
|---|---|---|
| Imported result from paper 3 | Trace the radiation-energy transformation to §8 of the relativity paper; never use the desired mass–energy result as an input | $E'/E = \beta(1 - \frac{v}{V}\cos\varphi)$ |
| Two equal opposite emissions | Explain the choice of symmetry and why the body remains at rest in its original frame | $\tfrac{1}{2}L$ each way |
| Energy balances in two frames | Track all before/after quantities with separate frame and event identifiers; the sum of the two transformed pulse energies is $L\beta$ for any emission angle | $E_0 - E_1 = L$; $H_0 - H_1 = L\beta$ |
| Subtraction and kinetic energy | Show the cancellation, the role of additive energy constants, and the identification of the kinetic-energy difference as a stated premise of the source | $K_0 - K_1 = L(\beta - 1)$ |
| Low-speed expansion | Derive the quadratic term and expose the approximation error rather than substituting an unexplained series | $L(\beta - 1) = \tfrac{1}{2}\frac{L}{V^2}v^2 + \ldots$ |
| Inertia change and generalization | Separate the specific radiation argument, the broader inference, and the later modern formulation | the mass diminishes by $L/V^2$; "the mass of a body is a measure of its energy content" |
| Empirical closing remark | Preserve the conditional suggestion (radium salts) without a nuclear-history digression | as printed |
| Date-line | | "Bern, September 1905" |

**Editorial boundary.** The argument's additive constant and its reliance
on the Newtonian form of kinetic energy at second order are stated premises
(Ives 1952 called the argument circular; Stachel and Torretti 1982
answered). The historian's margin presents both and Einstein's later
derivations (1906 center-of-mass argument, which itself credits Poincaré
1900 for the formal content; 1907; 1935; 1946). The formula $E = mc^2$ does
not appear in the paper; the paper says the mass falls by $L/V^2$. The site
neither pretends the 1905 argument is the last word nor pretends it is
wrong; it teaches the difference between a productive physical argument
and a theorem with fully specified hypotheses.

**Notation concordance entries.** $L \to E$ (emitted energy); $V \to c$;
$\beta \to \gamma$; $E_0, E_1 \to$ body energies before and after in the
rest frame; $H_0, H_1 \to$ the same in the moving frame; $K \to$ kinetic
energy; $C \to$ the additive constant.

### 3.7 The companion record, `molecular-dimensions`

The dissertation supplies the viscosity relation $\eta^* = \eta(1 + \varphi)$
for a dilute suspension (corrected in 1911 to $\eta(1 + 2.5\varphi)$),
combines it with the diffusion coefficient of paper 2 applied to sugar in
water, and extracts both the molecular radius and $N$. Einstein's 1905
value was about $2.1\times10^{23}$; after Jacques Bancelin's 1910 viscosity
measurements in Perrin's laboratory disagreed, Einstein and his assistant
Ludwig Hopf found the algebra error and the corrected 1911 value was about
$6.6\times10^{23}$. For decades this was Einstein's most-cited paper because
colloid science uses the viscosity relation.

Status: companion record. It is not on the hero, it is not one of "the
four," it is built only after the four are complete (§19), and it is
scoped to the sections the Avogadro lab needs. It does not become a fifth
flagship by accretion.

### 3.8 The count: four or five

Einstein's May 1905 letter to Conrad Habicht promises four papers: light
quanta, the molecular-dimensions dissertation, Brownian motion, and the
electrodynamics draft. Mass–energy was not yet written. The modern canon
swaps the dissertation for $E = mc^2$. The site says so on the About page
and in the timeline. The hero shows four papers; the catalogue shows the
four and one record labeled "companion."

### 3.9 Required historian's-margin entries

These are not optional color. Each is a typed record with a primary source
(§11.2), and a paper is not done until its list is present.

- **Paper 1.** (a) The photoelectric equation is not, by itself, proof that
  light consists of photons: a semiclassical theory with quantized matter
  and a classical field reproduces it (Lamb and Scully 1969); the decisive
  evidence came with Compton scattering (1923) and, for single photons,
  photon anti-bunching (Kimble, Dagenais, and Mandel 1977). The site does
  not repeat the textbook simplification. (b) Millikan verified the
  equation to better than one percent (1916) while rejecting the
  light-quantum hypothesis it came from. (c) Planck's 1913 recommendation
  of Einstein to the Prussian Academy excuses the light quanta as an
  overreach (paraphrased). (d) Einstein's 1951 letter to Besso, that fifty
  years of brooding had brought him no closer to answering what light
  quanta are (paraphrased). (e) The §1 derivation of the equipartition
  spectrum is independent of, and contemporary with, Jeans's 1905
  correction of Rayleigh's constant; the phrase "ultraviolet catastrophe"
  is Ehrenfest's, from 1911, and is labeled as later.
- **Paper 2.** (a) Sutherland's independent derivation and its history
  (Dunedin, January 1904; a misprinted congress proceedings version in
  early 1905; *Phil. Mag.* June 1905, between Einstein's submission and
  publication). (b) Smoluchowski's independent kinetic derivation (1906)
  with a different numerical factor. (c) Bachelier's 1900 random-walk
  mathematics for stock prices. (d) Einstein's assumption that the
  interval $\tau$ is long compared with the momentum relaxation time; for
  shorter intervals the motion is ballistic, $\langle x^2\rangle \propto
  t^2$, first measured in 2010 (Li et al., *Science*) and 2011 (Huang et
  al., *Nature Physics*). (e) The 1911 viscosity correction and Bancelin's
  measurement. (f) Perrin's program (1908–1909) and 1926 Nobel Prize. (g)
  Exner's 1900 "velocity" measurements and why the observable was wrong.
- **Paper 3.** (a) The paper has no references and closes by thanking
  Besso. (b) The 1905 manuscript was discarded; Einstein wrote out a copy
  by hand in 1943 for a war-bond auction, and that copy is in the Library
  of Congress. (c) Einstein's later statement to Shankland that Fizeau's
  experiment and stellar aberration weighed more with him than
  Michelson–Morley. (d) Lorentz 1904 and Poincaré 1905 (the 5 June note
  and the Palermo paper), stated from what they wrote, with the
  difference in interpretation and the ether. (e) The transverse mass and
  Planck 1906. (f) The equator-clock remark and the geoid (Hafele 1970).
  (g) The footnote conceding the imprecision of the rigid-body concept.
  (h) The notation $V$ and $\beta$.
- **Paper 4.** (a) $E = mc^2$ does not appear; the familiar form belongs
  to 1907 and later. (b) The additive constant and the Newtonian
  kinetic-energy premise (Ives 1952; Stachel and Torretti 1982). (c) The
  1906 paper credits Poincaré 1900 for the formal content of the
  center-of-mass argument. (d) Hasenöhrl 1904–1905 and the later priority
  claims, each with what was actually written. (e) The radium proposal
  and the first quantitative nuclear check (Cockcroft and Walton 1932;
  Bainbridge 1933). (f) Two equal opposite light pulses have nonzero
  invariant mass as a system, a later formal explanation that resolves a
  common confusion and is not a hidden premise of 1905.

---

## 4. Sources, Rights, Provenance, Translation, and the Notation Concordance

### 4.1 Rights basis

- The German texts were published in 1905 and 1906. Einstein died in 1955.
  In the United States, works published before 1929 are public domain; in
  life-plus-70 jurisdictions the author's term has expired. The German
  source text may be transcribed, reproduced, and translated freely.
- **Scans are not the text.** A particular scan file may carry the terms of
  the scanning institution. The provenance receipt records where each
  pinned PDF came from and what its stated terms are. Prefer library scans
  that state open terms; record URL, retrieval date, and SHA-256; do not
  pin publisher PDFs served under a subscription license. A host's
  possession of a scan is not itself a rights determination.
- **Existing English translations are not free to reuse.** The Perrett and
  Jeffery translation (Methuen, 1923; Dover reprint; the Fourmilab
  electronic text derives from it and changes notation) and the A. D.
  Cowper translation of the Brownian papers (Methuen, 1926, ed. R. Fürth;
  Dover 1956) are public domain in the United States by publication date;
  their status elsewhere depends on the translators' death dates and the
  site is served worldwide. The Beck translations (Princeton, 1989) and
  the Arons–Peppard translation of paper 1 (Am. J. Phys., 1965) are in
  copyright. **Policy: the site publishes its own translation, made from
  the German, and cites the historical translations as attributed
  comparison witnesses in the receipt only.** This is the conservative
  editorial choice, not a legal opinion, and it produces a better product
  because a sentence-aligned translation must be built from the German
  anyway.
- Quotations from secondary literature are limited to short attributed
  phrases; everything else is paraphrased with citation.
- **Letters and photographs.** The Habicht letter and other
  correspondence are paraphrased, not reproduced; the CPAE transcriptions
  and translations are Princeton's editorial work. Public-domain
  photographs of Einstein, such as Lucien Chavan's patent-office portrait
  of about 1905, may be used anywhere on the site, including the home page
  and share cards, with an accurate source credit.

### 4.2 Pinned facsimile sources (resolved in Batch A)

Candidate sources per paper, in order of preference; the receipt records
which was used and why.

1. A library or archive scan of the bound *Annalen der Physik* volumes 17
   and 18 (1905) and 19 (1906) with stated open terms (Internet Archive,
   HathiTrust full view, a university digital library). Whole-issue scans
   are preferred over article extracts because they show running heads,
   page numbers, and the editorial context, which the timeline uses.
2. The University of Augsburg's Einstein-in-Annalen facsimiles and
   bibliography as a comparison witness and cross-check.
3. The Princeton *Collected Papers of Albert Einstein*, Vol. 2, documents
   14, 15, 16, 23, 24, as a comparison edition for the German transcription
   and as the cited source of editorial notes; never the pinned facsimile.
   Its older deep links have already redirected once; pin bibliographic
   identities and admitted local assets rather than external routing.
4. German Wikisource transcriptions as a second comparison source for the
   ledger; never the source face.

The facsimile is immutable once pinned. The bibliographic key, PDF
filename, ledger filename, edition files, and receipt must match.

### 4.3 Provenance receipt (`docs/provenance/<key>.md`)

Same template as the donor's Wright receipt, with these fields:

- Bibliographic key, printed title, author line, date-line, receipt date,
  issue publication date, journal, series, volume, whole-series volume,
  issue, pages, DOI as currently resolvable, all dates typed.
- Scan source URL, scan rights statement, retrieval date, SHA-256, page
  count, and a page map (PDF page → Annalen page → section boundaries →
  numbered and unnumbered display equations on that page).
- Comparison witnesses consulted (CPAE document number; Augsburg
  facsimile; Wikisource revision id; each historical translation).
- Translation credits: translator (human or model, named), review dates,
  and the reviewer who checked each section against the German, with
  disagreements against the witnesses recorded when substantive.
- Editorial boundaries: which file is the source face, which is the
  ledger, which is the English face, which files are research evidence.
- Suspected historical typographical errors: original reading, proposed
  correction, reasoning, evidence. The source view retains the original;
  a corrected reading may be offered with an explicit marker. An error in
  a later translation belongs to that witness, not to Einstein; the source
  and translation layers keep separate correction histories.

### 4.4 The German ledger (cloud OCR only)

The donor rule is inherited without change: **no OCR on the development
host.** Recognition of the 1905 typesetting (as the facsimile shows: roman
body, italic mathematics, Greek, fractions, letter-spaced emphasis) is
delegated to bounded, checkpointed cloud jobs with page ranges, then every
line is corrected by hand against the facsimile. Mathematics is retyped by
the editor and compared directly with page images; parsed PDF text is
frequently unreliable for these sources and is never accepted for an
equation. The ledger is a **diplomatic transcription**: it preserves
mathematical content, meaningful punctuation, paragraph order, and original
notation, and normalizes only declared typography such as line-break
hyphenation. The file is `public/papers/transcripts/<key>-reviewed.txt`
with `--- REVIEWED TRANSCRIPTION PAGE k OF N ---` markers and page anchors.

### 4.5 The translation workflow

1. **Inventory and segment.** From the reviewed ledger, allocate permanent
   block ids and sentence ids (`s3-p2-s1`: section, paragraph, sentence;
   paper 4 has no sections and uses `s0`). Inventory every equation and
   nontrivial symbol.
2. **Draft** a close English translation sentence by sentence that
   preserves modality and qualification. "Suggests," "must," "under these
   assumptions," and "to this approximation" are not interchangeable; a
   heuristic remains a heuristic, an approximation remains approximate,
   and an assumed independent measurement does not become a derived fact.
   Preserve Einstein's sentence boundaries where English allows; where a
   German sentence must be split, both English sentences carry the source
   id with a suffix, and the alignment is many-to-many (§11.2).
3. **Notation is not translated.** Every symbol is kept as printed on both
   faces; the concordance (§4.7) is a separate annotation layer. Never
   silently replace $V$ with $c$ inside the translation.
4. **Review** the German/English alignment and the mathematical meaning
   independently, with the comparison witnesses open. Resolve
   disagreements by returning to the facsimile and context, not by
   majority vote among paraphrases. Record substantive disagreements with
   the historical translations in the receipt; the site may be right and
   a witness wrong, or the reverse, and either is worth a note.
5. **Term annotations** for period words and phrases: *Lichtkomplex*,
   *molekularkinetische Theorie der Wärme*, *ruhendes System*,
   *Elementarquantum*, *Kathodenstrahlen*, *Lichtäther*, *Beobachter*,
   *Trägheit*, *Energieinhalt*.
6. **Write the explanatory layer separately.** It may reorganize ideas,
   modernize notation, and add derivations; it cannot masquerade as source
   text.
7. **Publish** only after the source manifest and review criteria pass.
   Unresolved readings stay visible in internal review and, where
   intellectually important, in public editorial notes. Machine-drafted
   material is never marked "reviewed" because a schema or renderer
   accepted it.

### 4.6 Attribution and rights layers

Maintain separate policies for original historical text, facsimile scans,
the new translation, new explanatory prose, interactive code, numerical
libraries, fonts, images, and historical datasets. Preserve inherited
notices from Classic Patents and FrankenSim, including their rider
language. Decide the exact license and rider for new code and prose
intentionally before publication; do not imply that a license for code
grants rights to every embedded scan, dataset, or translation. Every asset
record carries its own rights status (§11.2, `SourceAsset`).

### 4.7 The notation concordance

A central feature, not a glossary. For each paper and each scope in it:
the original glyph, the section scope where that meaning holds, the
definition, the modern symbol, the dimension, the frame or reference
condition, and the transformation rule. Distinguish three different
operations that a careless reader collapses into one: a **symbol rename**
($V \to c$), a **unit-system conversion** (Gaussian to SI in paper 3), and a
**substantive modernization of the argument** (the modern transverse mass
with a different force convention). A global find-and-replace is
unacceptable.

The two dangerous collisions are called out in red on first use:
Einstein's $\beta$ is the modern $\gamma$, and Einstein's $k$ in paper 2 is
viscosity. Others get the same scoped treatment: $L$ (speed of light in
paper 1, emitted energy in paper 4, a magnetic-field component in paper 3
§6), $N$ (Avogadro's number in papers 1 and 2, a magnetic-field component
in paper 3), $E$ (energy, an electric field, a body's rest-frame energy),
$\tau$ (the moving-frame time in paper 3, an observation interval in
paper 2), $P$, $\nu$, $\varphi$, and $\alpha$.

Rendering rule: the source and translation faces show the printed
notation. The explanation faces show the printed notation by default with a
toggle to modern notation. The toggle re-renders every equation from its
semantic expression tree (§11.3), never by string substitution on LaTeX,
and updates the colorized sentence and the legend, so a reader can learn to
read Einstein's own symbols and then switch. "Modern notation" and "modern
knowledge" are different choices and are modeled independently (§6.1).

### 4.8 International reach without unreviewed translation

Design content ids, citation locators, number formatting, and layout for
multiple languages from the beginning. Publish the German source and the
English scientific edition first; add other languages as reviewed editions
with their own translators, scientific reviewers, revision status, and
correspondence to the source and explanation records. Interface
localization is separate from scientific translation: a translated menu
does not establish that a paper, its commentary, or its captions have been
reviewed in that language. Machine drafts may help; they never silently
replace the default explanation. Use explicit language and direction
metadata, readable left-to-right mathematics inside right-to-left prose, and
locale-aware display over a strict canonical numerical transport format
(§12.10). A reader can change display language without changing a seed, a
unit meaning, a source passage, or a physical experiment.

---

## 5. The 1904 Knowledge Boundary

### 5.1 Four historical statements that are not interchangeable

The discovery workspace is explicitly set at the end of 1904. It contains
problems, measurements, mathematical techniques, and competing
interpretations available by that cutoff. A separate chronological
progression admits results from the 1905 papers as they are developed: the
September mass–energy journey may use the earlier relativity paper, and its
provenance says so.

Distinguish:

1. A result was **publicly available** by a given date.
2. There is **evidence Einstein knew or used** it.
3. The **paper itself cites or asserts** it.
4. The **site uses it** in a plausible reconstruction.

The fourth category is labeled **"A route you could take,"** never "What
Einstein thought." A discovery step may use only category-1 items dated on
or before the cutoff (or the explicitly admitted 1905 result), and every
such item is a card.

### 5.2 Knowledge cards (the shelf)

Each historical premise is a card with: a source, a date or date interval
with the `latestYear` used by the audit, the precise proposition, its
relevant limits, its availability status (available / parallel work / later
confirmation), any Einstein-knowledge evidence when claimed, and the
discovery steps permitted to use it. A later experiment (Millikan 1916,
Perrin 1909, Ives–Stilwell 1938) can be excellent evidence while being
unavailable in the workspace; it appears on the timeline and in "check it
against the world," not on the shelf.

The launch shelf, per paper, is the dated list in §9. Publication of a
card requires checking its original source; the lists in this plan are a
research queue with dates the editors have verified to the best of their
ability, not a completed documentary history.

### 5.3 Anachronism controls

| Temptation | Required editorial treatment |
|---|---|
| Open with "ultraviolet catastrophe" | Identify the phrase as Ehrenfest's (1911); distinguish the pre-1905 radiation difficulty from the later textbook narrative |
| Put the full Rayleigh–Jeans history in the 1904 drawer | Audit dates and forms individually; Rayleigh's June 1900 form is on the shelf; Jeans's 1905 correction is not |
| Say Planck had already proposed Einstein's light quanta | Distinguish oscillator-energy elements from radiation behaving as independent quanta |
| Start with photons, wavefunctions, or Bose statistics | Modern vocabulary and theory are labeled and may not supply hidden historical premises |
| Describe Einstein as proving that light is not a wave | Preserve the wave description's successes and the restricted inference of the light paper |
| Say everyone rejected atoms | Represent real contemporary disagreement and existing molecular reasoning, not an invented consensus |
| Say Einstein explained observations he had studied in detail | Preserve the Brownian paper's introductory uncertainty about the reports |
| Use Langevin equations or Wiener-process notation as Einstein's derivation | Offer them as modern computational or mathematical lenses, dated 1908 and later |
| Use spacetime diagrams as though they were the paper's presentation | Identify them as a later geometric aid (Minkowski 1908); derive the source result without requiring them |
| Make Michelson–Morley the sole documented cause of the relativity paper | Separate the paper's reference to failed ether-drift detection from claims about Einstein's personal path |
| Conflate contraction with what a camera sees | Separate simultaneous-coordinate measurement from received light and optical appearance |
| Treat modern SI constants as measurements available in 1904 | Use separate historical and modern constant sets, with precision and evidential status; in the modern set $R = N_A k_B$ and $N_A$ is exact by definition |
| Use the train-and-embankment lightning picture as the 1905 argument | Label it as Einstein's 1917 popular illustration of §§1–2 |

The engineering requirement behind the table: unavailable premises cannot
enter a historical derivation invisibly. The content compiler checks the
`latestYear` and status of every premise a discovery step cites (§11.7).

### 5.4 Reasonable alternatives deserve a fair hearing

A "wrong turn" specifies a coherent hypothesis and the circumstances in
which it works. Galilean transformations remain useful at low speeds; wave
models retain enormous explanatory value; deterministic microscopic
mechanics can underlie stochastic coarse-grained predictions; Lorentz's
ether-plus-local-time produces the same formulas as Einstein's kinematics.
The site teaches model selection, not retrospective ridicule.

A failed alternative must fail on a stated constraint or observation. An
alternative empirically equivalent within the chosen scope is not declared
refuted merely because the site prefers a more economical interpretation.
No rival is made to fail by programming every test with the favored
conclusion, and the site does not claim to have searched all conceivable
alternatives.

### 5.5 The 1904 desk (`/1904`)

An inviting workspace, not a chronological wall of famous names. Offer a
few concrete objects: a radiation spectrum, a microscope observation, a
pair of clocks, a conductor and a magnet, and an energy ledger. Selecting an
object opens the relevant established results, the unresolved questions,
and the mathematical tools, and exposes three questions:

- What could you actually measure?
- What interpretation would you be tempted to put on that measurement?
- Which further measurement or argument would distinguish that
  interpretation from another?

The workspace is a pedagogical reconstruction, not a claim to reproduce
Einstein's desk, daily schedule, or private mental process. Shelf
instruments live here: the Michelson–Morley interferometer with and without
contraction, Fizeau's water-flow drag, the Galilean map applied to a light
ray, the classical mode-energy allocation with a cutoff, and the
signed-displacement exercise of §7.4.

---

## 6. The Editorial Architecture: One Corpus, Several Ways Through It

### 6.1 Three orthogonal choices, not a wall of switches

There are three different reader needs, modeled as three axes:

| Axis | Choices | What changes |
|---|---|---|
| **Activity** | Read / Discover / Experiment | Narrative organization and the immediate task |
| **Detail** | Overview / Full explanation / Show every step | Amount of scaffolding, never the truth conditions |
| **Perspective** | Paper and contemporary context / Explicit modern lens | Which knowledge, notation, and later interpretations may be used |

The source/translation comparison is a panel within Read, not a fourth
curriculum. The interface does not expose the Cartesian product as dozens
of modes. The default is **Read → Full explanation → Paper and
contemporary context**, with local actions on every passage: **"Why?"**,
**"Show the missing step,"** **"Show me one example first,"** **"Try it,"**
and **"Read the original."**

Two further properties of an explanation are represented in authoring and
kept behind tested presets rather than exposed as more switches:
**formalism** (how much notation) and **guidance** (how much is done for
the reader). A full account can use little notation while carefully
stating every premise; one line of symbols can be extremely demanding; a
worked example can contain advanced mathematics with extensive guidance.
The reader can ask for any of these without the scientific claim changing.

"Modern notation" and "modern knowledge" are different choices. Renaming
Einstein's $V$ to $c$ does not authorize importing a later proof. Both are
modeled independently in the data (§11.4) even where the interface offers
a sensible preset.

### 6.2 The four authored readings (the Detail axis, plus the margin)

Every paragraph, every equation, and every instrument caption has four
authored texts. The first three are the Detail axis; the fourth is the
Perspective axis's annotation layer.

| Reading | Name | Assumes | Style |
|---|---|---|---|
| R0 | **Overview** ("in one breath") | Nothing | One or two sentences. What this paragraph says and why it is here. True and complete at its resolution; not a teaser. |
| R1 | **Full explanation** (default) | Single-variable and multivariable calculus, basic linear algebra, basic probability, the ideal gas law | The site's main voice. Equations shown and explained; standard tools (Taylor expansion, Gaussian integral, Maxwell's equations in words) used with a link to their foundation lesson. |
| R2 | **Show every step** | High-school algebra and the willingness to read slowly; where even that is missing, the zero-assumed-algebra layer of §7.5 is embedded | Every symbol defined on first appearance in the section; every step of every derivation shown, including the algebra; every "it follows that" expanded; analogies after mechanisms, never instead; foundation lessons embedded inline rather than linked. |
| R3 | **Historian's margin** (modern lens) | R1 | What Einstein wrote and in what notation; where the argument is heuristic; where later physics changed the reading; who had the same result earlier or at the same time; what the primary literature says. Cited. |

Rules: the readings never contradict one another (R0 compresses R1, R2
expands R1, R3 annotates R1; an editor changing one rereads the others).
The reader can open a single paragraph at a deeper reading without
changing the global choice ("show me every step for this one"). The test
of an R2 reading is that a physician who has not used a derivative since
1998 can follow it with effort and without shame; the test of an R0
reading is that a reader with no physics can state what the paragraph
claims.

**Persistence and rendering.** The site is statically generated, so the
Detail choice is not a server-read cookie. All readings are rendered into
the static HTML of every paragraph, with R1 visible and the others carrying
`data-detail` and `hidden`; a two-line inline script in `<head>` reads
`localStorage` and the `?detail=` parameter and sets `data-detail` on
`<html>` before first paint, the same trick the theme toggle uses; CSS
shows the matching reading. Consequently the Detail axis works with
JavaScript disabled (R1), search engines index every reading, switching is
instant and offline, and a permalink with `?detail=2` opens at that
reading (`rel=canonical` omits the parameter). Cost: the reading face's
HTML grows roughly three to four times; the budget is 250 kB gzipped for
the largest paper's reading face, checked in CI, and if a paper exceeds it
the R2 and R3 texts for a section are fetched from a static JSON fragment
on first expansion, with real links (not inert buttons) for the no-script
reader.

### 6.3 The minimum explanation unit

Every substantial explanation answers, as authoring tests rather than six
identical boxes under every paragraph:

1. What question are we trying to resolve?
2. What is already assumed or known here?
3. What does this expression say in ordinary language?
4. Why is this move allowed?
5. What changes when a parameter changes, and what remains unchanged?
6. What would invalidate the argument or require a different model?

The prose should read like a well-written book, not an exported database
form.

### 6.4 Recursive clarification without recursive confusion

A selected term opens a compact explanation in context. From there the
reader can descend to a worked example, a prerequisite, and ultimately
ordinary arithmetic or a concrete counting or measuring operation. The
return stack retains the original paragraph, the selected expression, the
laboratory state, and the scroll position.

The prerequisite graph is finite and curated (§7.5). Every basic node has a
stated stopping point: multiplication as repeated scaling, a graph as a
record of paired quantities, a rate as change per unit of something. No
infinite cascade of definitions; no foundational philosophy of mathematics
before a derivative.

**"What is getting in the way?"** is a compact action beside every hard
passage with concrete choices: an unfamiliar word or symbol; an algebraic
move; the physical reason for a step; the connection to the picture; the
purpose of the calculation; or simply too much at once. Each choice opens
an authored response for this exact argument. The reader is never asked to
diagnose a learning disability or reveal a personal history.

**"Show me one example first"** sits beside every abstract derivation.
Concrete numerical examples often resolve confusion more efficiently than
another layer of terminology.

### 6.5 No circular explanations

Each derivation has an explicit dependency graph. The source-order route
and the discovery route may traverse it differently; neither may rely on
its own conclusion. Prohibited circles, each with a compiler or review
check:

- Inferring a molecular count from diffusion while silently using that
  same count to construct the supposedly independent data.
- Deriving mass–energy equivalence using a body-energy formula that already
  assumes it (initializing $E_0 = Mc^2$).
- "Discovering" the Lorentz transformation by requiring the Minkowski
  interval as an unexplained axiom in the historical route.
- Treating a photoelectric simulator programmed with a threshold as
  experimental proof that nature has a threshold.

A simulator makes the **consequences** of assumptions legible. Independent
observations are required to test whether those assumptions describe the
world. Every instrument says which it is doing (§11.4).

### 6.6 Meaning must survive a change of representation

Each explanatory treatment carries a small authoring contract, kept in the
editorial record rather than displayed under every sentence: the question,
the premises retained, the conclusion supported, the approximations
introduced, the omissions acknowledged, and the bridge to the fuller
treatment.

A concrete analogy says where it stops. A simplified account does not
quietly turn "approximately," "in this idealized case," or "suggests" into
"always" or "proves." Replacing an exact expression with a low-speed
approximation is a change in mathematical claim, not just a change of
reading level. The compiler checks referenced premises and approximation
labels; a reviewer still judges whether the prose preserves meaning.

Example: "A more viscous liquid makes the tracer spread less over the same
time" is a legitimate introductory consequence of the model. "Doubling the
viscosity halves the typical displacement" is not: it halves the
diffusivity and changes the RMS displacement by $1/\sqrt{2}$. All readings
preserve that distinction, and an adversarial fixture (§13.5) checks that
the site's own numbers do.

### 6.7 Guided discovery, not compulsory rediscovery

The invitation to discover is central, but the reader is never required to
invent a difficult concept before receiving instruction. Offer a sequence
with adjustable support: a fully worked example; a partly completed
comparison; an optional prediction; an explanation of the result; and a new
case that tests transfer. A reader may move directly to the explanation at
every point.

There is no defensible universal rule that minimal guidance is best.
Klahr and Nigam's study of elementary science instruction favored direct
instruction for initial acquisition in its tested task; Schwartz and
Martin's statistics study found value in an invention activity as
preparation for later learning. These are different populations and
designs, not rival slogans. Their practical implication here is to test
**productive exploration followed by sufficient explanation** and to
provide direct worked instruction when exploration is not helping. Before
a consequential reveal, show a fair puzzle with enough information to
reason about it. Afterward, make the full explanation available regardless
of the prediction. Do not equate being surprised with having learned, and
do not use an animation to conceal an omitted inference.

### 6.8 A returnable, interruptible reader

The explanation stack has a persistent, unobtrusive compass: **the question
we were answering**, **the idea we just opened**, and **return to the exact
step**. It supports back/forward history, a direct link to the current
clarification, and one action to close all side explanations without
losing the main passage.

A small local **reading notebook** holds optional pinned questions,
selected examples, predictions, and the next suggested step. Saving may
fail when storage is blocked or full; reading continues, and important
notes have an explicit local export rather than an assumption of permanent
browser storage. Nothing is uploaded; competence is never inferred from the
notebook.

An interrupted reader resumes with a short authored recap of the current
argument, not a demand to redo anything. No timers, streaks, punitive red
crosses, surprise audio, or forced full-screen. Scientific difficulty comes
from the ideas, not from navigating the site.

### 6.9 Faces, anchors, and the result weave

The reader shell keeps the donor's `?view=` deep-link model so every face
is a URL and the browser back button works.

| `view` | Face | Content |
|---|---|---|
| `german` | Source face | The German edition, term annotations, numbered equations as printed, continuous reading with no scan-page furniture |
| `english` | Translation face | The aligned English; focusing a sentence highlights its German source on the other face |
| `gloss` | Interlinear face | Each German sentence with a word-by-word English gloss beneath it (§7.11) |
| `parallel` | Bilingual face | German and English side by side (stacked at narrow widths), sentence-aligned, with the current paragraph's reading in a companion column |
| `reading` | Explanation face (default) | The paper section by section in the site's voice at the chosen Detail, with semantic equations, derivation chains, and the instrument for that step embedded in place |
| `results` | Results face | The paper's numbered results as cards: as printed, in modern notation, in one sentence, with the live probe, the misconceptions that cluster around it, and "where this is used later" |
| `facsimile` | Pinned scan | The Annalen pages via pdf.js with a page map to sections and equations |
| `split` | Split view | Any two faces side by side; the default split is `parallel` left and `reading` right |

Discover and Experiment are routes, not faces: `/discover/[paper]` and
`/lab/[experiment]` (§15.1). Each has exactly one canonical URL.

Every section, paragraph, sentence, equation, result, argument node, and
instrument has a stable anchor derived from the printed structure: `#s3`,
`#s3-p2`, `#s3-p2-s1`, `#eq-7` (the paper's own equation number) or
`#eq-s3-d2` (an unnumbered display equation), `#result-lorentz-transformation`,
`#arg-sr-03`, `#lab-bm-06`. Anchors are identical across faces, so
switching faces keeps the reader's place. Anchors are content ids, never
array positions (§11.2).

**Result weave.** The donor's spec-clause weave lights phrases on the
specification face when a kernel predicate holds. Here the same mechanism
lights the German and English sentences that state what an instrument is
currently demonstrating: dragging the boost past $0.5c$ lights the §4
sentence about the slowed clock; entering the Wien regime lights the §4
limiting-law sentence of paper 1; making the ensemble histogram and the
Gaussian overlay agree lights the §5 formula for $\lambda_x$. The
highlight is a pointer, not a claim that truth has been achieved.

---

## 7. Entrances, Readings, and the Foundation Library

### 7.1 Personas as editorial lenses (never shown to the reader)

Editors review every passage through five lenses:

- **The programmer.** Comfortable with loops, arrays, probability as
  simulation, matrices as transformations, event logs, invariants.
  Uncomfortable with partial derivatives used casually and with
  "obviously." Wants the algorithm. The random walk, the boost as a
  matrix, and the event ledger are written for this reader first; the
  distributed-event-log analogy for synchronization states its limit
  (relativistic synchronization is not network latency).
- **The physician.** Comfortable with diffusion (Fick), osmosis,
  exponential decay, dose-response, log scales, rates, and uncertainty.
  Uncomfortable with vector fields and unexplained constants. Paper 2 is a
  gift: van 't Hoff's osmotic pressure is medical-school material and
  Einstein's §1 begins exactly there.
- **The engineer.** Wants units, orders of magnitude, and the numerical
  check; impatient with the philosophy of simultaneity until the clock
  ledger makes it concrete.
- **The student.** Has a course in progress and wants derivations with no
  skipped steps.
- **The reader with no algebra.** Willing to work, starting from
  arithmetic. This lens is applied to every first encounter and every
  foundation node.

The reader never sees these names and never chooses one. They exist so
that the authored "what is getting in the way?" responses, the side doors
of §9, and the analogies are written for real obstacles.

### 7.2 Four welcoming entrances that still lead to the papers

Each paper ships a **first encounter** requiring no algebra, no
graph-reading fluency, and no physics vocabulary, built with the same care
as the derivations. Its purpose is one sound insight and a next step, not a
claim that a two-minute interaction exhausts a paper.

| Paper | First encounter without algebra | Bridge to the actual argument | Trap to avoid |
|---|---|---|---|
| Light quanta | Compare how one independently placed object versus several independent objects can all end up in half a space; enumerate small cases before naming a probability law | Explain why a matching volume dependence in radiation entropy would be surprising, then derive where that dependence comes from | Drawing dots is not evidence that radiation literally consists of those dots |
| Brownian motion | The signed-displacement exercise of §7.4; compare cancellation with spread | Show why the mean square is tractable, then connect diffusion to osmotic pressure and drag | Squaring is not the only valid way to notice movement |
| Relativity | Record a signal leaving a clock at 0 and returning at 10; discuss assigning the remote reflection the midpoint time 5 | Build the operational meaning of synchronized clocks, then ask whether another moving set of clocks uses the same simultaneity | The midpoint assignment is a stated synchronization procedure, not a direct measurement of an unknowable one-way time |
| Mass–energy | Compare two accounting sheets and remove a shared unknown by subtraction | Connect the second sheet to the radiation transformation, then to the small-speed coefficient | Do not put $Mc^2$ inside the covered box and pretend the comparison discovered it |

Each entrance has a words-and-table route, an optional visual manipulation,
and the exact source destination. The visual action, keyboard action, and
screen-reader action manipulate the same entries and expose the same
totals; a nonvisual reader never receives a weaker question.

### 7.3 Tours: three attention budgets

The same content is offered through three curated, ordered anchor lists
with progress kept locally (no accounts):

- **Fifteen minutes.** One paper: its first encounter, the R0 readings of
  the introduction and the key result, three or four instruments in
  predict mode, and the R0 line of the discovery path's move. Entirely
  without equations, and still true.
- **One evening.** One paper at R1, all instruments, the front-door
  discovery journey, the misconception ledger, the historian's margin for
  the editorial boundaries of §3.
- **The full course.** All four papers and the companion, both discovery
  doors, every foundation node, the connections, the essays, the
  exercises, the capstones. A printable syllabus lists prerequisites per
  session from the foundation graph.

The no-math tour is a first-class deliverable, not a fallback: a reader
who never opens an equation must leave knowing what each paper claimed,
why it was hard, and what it changed.

### 7.4 A fully specified first encounter: zero average is not no movement

Use four **authored arithmetic examples**, $-3, -1, +1, +3$ displacement
units. They are not a measured dataset and the page says so. Initially
describe them as three steps left, one left, one right, three right;
symbols come afterward.

Ask whether the observations show no movement. Add the signed
displacements: the result is zero. Then ask how to preserve the information
about how far the observations are from the start. Accept **both** "ignore
the direction" and "square each value" as sensible proposals. The mean
absolute displacement is 2 units; the mean-square displacement is 5 squared
units. Doubling every displacement gives 4 units and 20 squared units.

Only then explain why Einstein's route favors the mean square: under the
stated independence and zero-mean assumptions, the cross terms in the
square of a sum vanish on averaging, which makes the growth law especially
tractable. Mean absolute displacement is not a wrong answer; it answers a
related question and also scales with the spread in the ideal Gaussian
model. The link to the ensemble instrument (BM-01) and to the original
displacement passage makes the arithmetic a real entrance to the paper.

### 7.5 The foundation library (`/foundations`)

Build foundation lessons in response to the actual paper dependency
graphs. Do not author an independent undergraduate textbook. Each
foundation has a compact explanation, one worked example, one instrument or
manipulable construction where useful, a textual equivalent, prerequisites,
and backlinks to every calling passage. Its return caption names the right
quantity and what is held fixed at the calling passage. Foundation text
renders correctly in print and without JavaScript.

| Foundation | Concrete entry point | What the reader can do afterward |
|---|---|---|
| Quantities and units | Is a number in meters comparable with one in seconds? | Distinguish a quantity from its number; check an equation's dimensions |
| Ratios and scaling | Double a length; compare area, volume, and a plotted effect | Predict proportional, inverse, and squared dependence |
| Functions and graphs | A table of paired measurements | Read axes, inputs, outputs, slope, and a parameterized family |
| Derivatives | Move one control a little and compare the output | Interpret local sensitivity with units |
| Partial derivatives | Change temperature while holding volume fixed | State what is held fixed and why it matters |
| Integration | Add narrow strips or accumulated contributions | Interpret an integral as a limit of sums, including a normalization integral |
| Taylor expansion | Compare a curve with its local polynomial; the binomial series $(1 - x)^{-1/2}$ | Explain a retained term, a neglected term, and a range of usefulness |
| Exponentials | Repeated proportional changes | Read growth, decay, and dimensionless exponents |
| Logarithms | Turn repeated multiplication into addition | Understand why independent probability products give additive entropy |
| Probability and independence | Place independent points into subregions | Calculate a product probability; identify when independence fails |
| Distributions | Many repeated outcomes instead of one trajectory | Distinguish a density, a bin probability, and a single observation |
| Mean, variance, and RMS | A balanced set of signed displacements | Explain why the mean can vanish while the spread grows |
| Gaussian distributions | Accumulate many small symmetric displacements | Connect width, normalization, and second moment without the central limit theorem as magic |
| Flux and continuity | Count crossings of the boundary of a small interval | Derive a conservation equation; distinguish density from flux |
| Diffusion equation | More arrivals than departures at a local dip | Interpret curvature-driven change and boundary conditions |
| Random walks | Coin flips and the $\sqrt{t}$ spread | Predict how the spread of many walkers grows |
| Work and energy | Force through distance; accounting before and after | Distinguish force, work, power, and reference choices |
| Temperature and thermal energy | A distribution of microscopic motion | Use absolute temperature without equating it to one particle's energy |
| Entropy and multiplicity | More accessible configurations at fixed constraints | Understand a relative entropy change without the slogan "disorder" |
| Entropy and temperature | Why $dS = dQ/T$ and $\partial S/\partial E = 1/T$ | See why a spectrum can yield an entropy (paper 1 §3) |
| Free energy and osmotic pressure | Move a selective partition | Connect a volume-dependent free energy to a mechanical force |
| Viscosity and Stokes drag | Slow motion of a sphere through a liquid | Understand mobility and why geometry and regime qualifications matter |
| Vectors and components | Describe one arrow in two coordinate systems | Change components without confusing that with changing the object |
| Matrices and linear maps | Transform a grid and an event table together; determinants, eigenvectors | Read a matrix as a rule for combining inputs |
| Hyperbolic functions and rapidity | $\cosh$, $\sinh$, $\tanh$ and why boosts add like angles | Follow the composition of velocities (labeled as a later aid) |
| Frames and events | Several clocks record local occurrences | Distinguish coordinate description, measurement procedure, and optical reception |
| Dot and cross products | Projection and oriented area | Follow field transformations and magnetic-force directions |
| Fields and waves | Values across space sampled at successive times; frequency, wavelength, phase; the Doppler effect for sound | Understand phase, frequency, amplitude, direction, and local field quantities |
| Electromagnetism needed here | A charge, a current, a field, and a detector; Maxwell's equations in words | Follow the paper's claims without a complete prior E&M course |
| Momentum and energy of light | Radiation pressure and the momentum $E/c$ of a light pulse | Follow papers 3 and 4 |
| Conservation and symmetry | Relabel an experiment or change frame | Identify a quantity or relation that should remain unchanged |
| Error and inference | Several noisy estimates of the same parameter | Separate sampling, measurement, model, and numerical uncertainty |
| The 1905 unit system | Gaussian and CGS to SI, with Einstein's own numbers | Convert his printed values |
| Reading a German physics sentence | Word order, the Konjunktiv in hypotheses, *sei*, *es gilt*, *man erhält* | Read the source face with support |
| Orders of magnitude | A water molecule vs a $1\,\mu$m grain; $v/c$ for a bullet, a jet, the Earth's orbit, Kaufmann's electrons; $h\nu$ for red, green, ultraviolet; molecular kicks per second on a grain | Place every number in the papers on a scale |

**The zero-assumed-algebra layer** sits beneath this table. Its lessons are
generated by actual obstacles in the papers, not a semester course that
delays entry, and "Explain from the beginning" lands on one of these
concrete operations, not on another paragraph full of words like *linear*,
*differential*, *distribution*, and *invariant*.

| Small obstacle | Concrete bridge | Readiness shown without a test |
|---|---|---|
| A letter stands for a quantity | Replace a labeled blank in a measurement sentence with several numbers | Explain what changes and what the letter continues to mean |
| An equals sign describes a relationship | Balance two explicit counts or measurements | Distinguish a statement of equality from an instruction to calculate |
| Negative numbers and direction | Mark steps to the left and right of a start | Explain why opposite signed displacements cancel |
| Fractions and ratios | Share a fixed total among different numbers of items | Compare "per item" with the total |
| Squaring and square roots | Compare a length with the area of its square, then undo it | Understand why quadrupling a mean square doubles its root |
| Scientific notation and units | Zoom from a meter ruler to a micrometer scale with each conversion shown | Compare magnitudes without counting zeros |
| A graph | Build a two-column table first, then place its paired values on labeled axes | Identify a point without assuming familiarity with axes or slope |
| A sum and an average | Combine four values, then share the total equally | Distinguish total, average, and count |
| Mathematical punctuation | Compare a finite change $\Delta x$, a derivative, a primed frame label, and an exponent | Recognize that similar marks have different jobs |
| Probability notation | Count a selected outcome within a finite set | Distinguish a single outcome, a frequency, and a model probability |

Each foundation node offers a compact example, the mathematical account,
and an explanation of why it is needed at the calling passage. A selected
proof has an acyclic dependency route to its stated entry assumptions; the
broader concept map may contain cross-links and alternative routes, which
are not logical circles. A reader may use an already-understood result
while its deeper derivation is marked as available; not everyone must reach
the same elementary leaf.

### 7.6 The misconception ledger

The fastest way to help someone understand a famous result is to name the
wrong version they already carry. Each paper ships a typed `Misconception`
list (§11.2), surfaced inline as a "common wrong turn" callout at the
anchor where it usually arises and collected on the results face under the
result it concerns. Each entry has the tempting claim in the words people
use, why it is tempting, what is true at every reading, the instrument that
shows it, and sources. The launch ledger, at minimum:

- **Paper 1.** "Planck discovered the photon in 1900" (he introduced energy
  elements for oscillators and resisted light quanta for years); "the
  photoelectric effect proves light is particles" (§3.9); "brighter light
  means faster electrons"; "Einstein derived Planck's law here" (he argued
  from Wien's law and called it heuristic); "the quantum energy is $h\nu$
  because of $E = mc^2$" (unrelated); "Einstein proved light is not a wave."
- **Paper 2.** "Brownian motion is caused by single molecular hits"
  (Nägeli's objection; it is the imbalance of about $10^{20}$ kicks per
  second); "the particles have a speed you can measure" (§3.4); "Einstein
  explained an experiment" (he predicted one and was not sure the observed
  motion was the same phenomenon); "diffusion is a different thing from
  random walking" (one equation); "larger particles jiggle more because
  they get hit more" (they jiggle less); "halving the diffusivity halves
  the displacement" (it scales by $1/\sqrt{2}$).
- **Paper 3.** "Length contraction is an optical illusion" and its
  opposite "the rod is physically squashed" (it is a statement about
  measurements in two frames; the instrument shows both, and optical
  appearance is a separate topic); "time dilation is symmetric, so it
  cannot be real"; "the light-speed limit is only about needing infinite
  energy" (the paper gives two independent reasons: velocity composition
  never reaches $V$ in §5, and the kinetic energy grows without bound in
  §10); "Michelson–Morley made Einstein do it" (§3.9); "mass increases
  with speed" (a language the 1905 paper uses, with two different
  velocity-dependent masses, that modern physics replaces with invariant
  mass plus energy and momentum; the instrument shows both languages);
  "Einstein's $\beta$ is $v/c$"; "a larger spatial separation of two
  transformed events is a longer rod" (the events are not simultaneous in
  the new frame).
- **Paper 4.** "$E = mc^2$ is about nuclear bombs" (the argument concerns
  any body that radiates; a candle flame loses mass); "mass converts into
  energy" (the mass of a closed system is conserved; the body's rest mass
  falls because energy left it); "the formula is in the paper" (it is
  not); "Einstein was first" (the site presents the priority record); "a
  massless pulse cannot carry mass" (two opposite pulses have invariant
  mass as a system).

### 7.7 Predict, then perturb, then explain

Every instrument has a **predict mode**, on by default for first-time
visitors. Before the reader's first change, the response plot is hidden and
the reader is asked to choose or sketch what will happen (three candidate
curves, or a freehand line on empty axes). On release, the accepted
snapshot draws the real curve over the prediction and the two stay side by
side. The prediction is recorded on the control tape as a `prediction`
event so a shared permalink carries it and a teacher can see what a class
expected. The explanation is available regardless of the prediction; an
incorrect prediction is a productive starting point, never a usability
failure or a judgment about the person. Each chapter ends with a small
predict-perturb-explain task answerable in prose, by arranging a
construction, or by inspecting a counterexample, with feedback that
addresses the model of the situation rather than a right/wrong mark (§14.5).

### 7.8 Show me the code

Every instrument and every derivation chain has a "Show the code"
disclosure that renders the kernel's actual source (the TypeScript
reference evaluator, and the Rust of the FrankenSim owner where it applies)
extracted at build time with the function's source hash pinned to the
instrument. Identifiers that correspond to equation terms are colorized
with the same color as the term in the equation and the sentence, so
`gamma` in the code, $\gamma$ in the formula, and "the stretch factor" in
the sentence share a color. A test asserts that every live term's canonical
quantity id appears as an identifier binding in the kernel it is bound to.
For programmers the code is the derivation; for everyone else it is proof
that the number on the screen came from a function anyone can read.

### 7.9 Count atoms in your kitchen (BM-07, real-data mode)

Paper 2 is the one 1905 result a reader can reproduce at home, and the site
provides the protocol and the instrument:

- A real compound microscope with a 40× objective (a student microscope
  with a phone or USB eyepiece camera). Cheap "USB microscopes" that are
  really macro cameras do not resolve micron-scale particles, and the
  protocol says so. Whole milk diluted in water works: the fat globules are
  a few micrometers across and their Brownian motion is visible at 400×.
  Diluted ink or toner particles also work. No blood, no chemicals.
- Record about a minute of video at a known frame rate. In the instrument,
  load the video locally (nothing is uploaded; frames are read with
  `HTMLVideoElement` and a canvas), calibrate the scale against a stage
  micrometer if one exists or a known object (a human hair is roughly 50 to
  100 $\mu$m wide, so the instrument treats it as a coarse calibration and
  carries that uncertainty), then click the same particle once per second.
- The instrument uses the specified inference model of §8.2 with the
  reader's data: the independent-increment estimator and its chi-square
  interval only where the admitted assumptions hold; the observation-error
  and censoring models when the reader declares localization error or a
  particle leaves the field; the radius/molecular-number identifiability
  shown before a narrow interval is offered conditional on an estimated
  radius. Particle radius is the dominant uncertainty for polydisperse
  milk; the instrument asks the reader to estimate it from the image and
  shows how $N$ moves with it.
- The output is an estimate of $N$ with a stated interval, beside Perrin's
  1909 values (labeled historical) and the modern exact value (labeled
  defined). A reader who gets $2\times10^{23}$ learns about polydispersity
  and calibration, not that the physics is wrong.
- A classroom variant prints a worksheet and accepts a CSV of clicks. A
  reviewed, licensed real observation sequence with acquisition and
  calibration information is provided when one is obtained; until then the
  demonstration data is conspicuously labeled synthetic (§8.2).

A reader who does this has counted atoms with a microscope and a clock,
which is the sentence Einstein ends §5 with.

### 7.10 Capstones

Four optional capstones, one per paper: an ordered set of source-linked
claims, an experiment preset, a small number of annotated equations, and a
statement of assumptions, in an editable local worksheet with a print view.
The reader uses the template to explain the result to another person in
words, a table, a drawing, or equations. The purpose is to reveal whether
the reader can reconstruct the dependency chain without the animation
implying missing logic. Not a social network; nothing is posted.

### 7.11 Interlinear German

The `gloss` face renders each German sentence with a word-by-word English
gloss beneath it, authored at word level for paper 4 first and for the
introductions and key sections of the other papers next. It serves three
audiences at once: readers who want to read Einstein in his own language
with support; German learners, for whom a three-page physics paper is a
fine first text; and readers whose first language is neither German nor
English, for whom the gloss plus the R0 reading is the most direct route.
The same alignment infrastructure later admits reviewed editions of the
readings in other languages (§4.8).

### 7.12 Editorial voice

Inherited from the donor's de-slopify rule and tightened:

- No em dashes. No "seminal," "pivotal," "groundbreaking," "revolutionary"
  (except when quoting Einstein's "sehr revolutionär" to Habicht, with
  attribution). No "it's not X, it's Y." No "unlock." No listicles of
  vibes.
- Prefer Einstein's nouns. Prefer dates, page numbers, equation numbers,
  units, and named people.
- Never "obviously," "clearly," or "it is easy to see." If it were, the
  reader would not be at R2.
- Analogies after mechanisms. A programmer's loop is a mechanism;
  "imagine a drunk sailor" is an analogy, and it must say where it stops.
- Every numerical claim traces to the paper, to a named dated experiment,
  or to a live accepted snapshot. Einstein's printed numbers are
  regression fixtures, not decoration.
- The site never promises effortless comprehension or identical outcomes.
  It promises meaningful ways to appreciate, explain, predict, derive, and
  question, with honest bridges between them.

---

## 8. Physics Inventory: The Calculations the Site Must Preserve

The result tables of §3 list what each paper asserts. This section
specifies the calculations, conventions, and traps that the explanations
and instruments must get right. Every formula here is a build-time or
test-time obligation, not prose. Modern constants are the exact 2019 SI
values; historical constants carry their era, provenance, and precision;
the two sets are never mixed in one calculation without saying so.

### 8.1 Paper 1: radiation, entropy, and the light quantum

**The classical allocation (§1).** With $L$ the speed of light in this
paper's notation, equipartition gives $\rho_\nu = \frac{R}{N}\frac{8\pi\nu^2}{L^3}T$,
whose integral over all frequencies has no finite value. The instrument
(LQ-02) lets the reader raise a frequency cutoff and watch the implied
total grow without bound; the label says the model's historical status,
and a finite plot range never justifies integrating a divergent model to
infinity or silently truncating an energy ledger.

**Avogadro from Planck (§2).** At low $\nu/T$ Planck's law becomes
$\rho_\nu \to \frac{\alpha}{\beta}\nu^2 T$; matching to the classical
form gives $N = \frac{\beta}{\alpha}\frac{8\pi R}{L^3}$, and with Planck's
constants Einstein prints $N = 6.17\times10^{23}$. This is a historical
fixture; the modern exact value is a separate, labeled line.

**The entropy workbench (§§3–4, LQ-04).** Introduce editorial names $A$
and $B$ for the positive spectral constants with an explicit mapping to
Einstein's $\alpha$ and $\beta$. In the admitted Wien approximation,

$$\rho_\nu = A\nu^3 e^{-B\nu/T},\qquad
\left(\frac{\partial s_\nu}{\partial\rho_\nu}\right)_\nu = \frac{1}{T}
= -\frac{1}{B\nu}\ln\frac{\rho_\nu}{A\nu^3},$$

where $\rho_\nu$ and $s_\nu$ are spectral energy and entropy densities per
unit frequency. Integrating the derivative alone leaves an additive term
$C(\nu)$. The source fixes it by requiring the radiation entropy density
to vanish at zero radiation density (visible on journal page 139). Thus,
within the approximation,

$$s_\nu = -\frac{\rho_\nu}{B\nu}\left[\ln\frac{\rho_\nu}{A\nu^3} - 1\right].$$

With a narrow fixed frequency interval $\Delta\nu$, total energy
$E = V\Delta\nu\,\rho_\nu$, and $S = V\Delta\nu\,s_\nu$, comparing two
states of the same $E$ and band gives

$$S(V) - S(V_0) = \frac{E}{B\nu}\ln\frac{V}{V_0}.$$

Only after this calculation does the concordance identify $B = h/k_B$. An
unfixed entropy-density constant would contribute $\Delta\nu\,C(\nu)(V - V_0)$
and would **not** cancel; an adversarial fixture retains $C(\nu)$ and
checks that the site's derivation does not (§13.5). The instrument
compares **constrained states with the same energy and narrow band**; a
literal moving-mirror compression changes both energy and frequency, so
that movie does not stand in for this comparison. Both endpoints must
remain in the admitted dilute regime; when a proposed state leaves it, the
result is `outside-domain` with the readable explanation of why the
approximation fails, not a number.

The modernized endpoint $\Delta S_{\mathrm{rad}} = k_B\frac{E}{h\nu}\ln\frac{V}{V_0}$
is not initially interpreted as a particle count. $E/(h\nu)$ is a
coefficient that emerged from an entropy calculation; it is not rounded to
an integer to manufacture a count. A modern comparison may display
$(u_{\mathrm{Planck}} - u_{\mathrm{Wien}})/u_{\mathrm{Planck}} = e^{-x}$ with
$x = h\nu/(k_BT)$, labeled as a pointwise spectral-density comparison and
not an error certificate for the integrated entropy argument.

**Independent configurations (§5, LQ-05).** Put $n$ independent points into
$V_0$; the probability that all lie in a subvolume $V$ is $W = (V/V_0)^n$,
so $\Delta S = k_B\ln W = nk_B\ln(V/V_0)$. For small $n$ show individual
configurations and exact counting; for large $n$ show logarithmic
probability rather than an endless animation waiting for an astronomically
rare event. Distinguish a probability of spontaneous concentration from
the thermodynamic comparison between constrained states. The required
counterexample: if $n$ positions are perfectly locked together and
uniformly located, the probability that all lie in fraction $f$ is $f$, not
$f^n$; independence does the work in the gas analogy. This is an authored
mathematical comparison, not an alternative model of radiation asserted
without evidence.

**Matching the coefficients (§6, LQ-06).** Place the gas and radiation
entropy laws beside one another, initially without the interpretive label.
Ask what would play the role of "number of independent things" in the
radiation expression. Then reveal the correspondence and the implied
energy per thing. The important conclusion is not "we drew dots, therefore
light is made of dots"; it is that, within the stated regime, the
radiation's entropy has a dependence associated with independent energy
elements, and the extension to emission and transformation processes is a
further hypothesis.

**Two spectral-coordinate traps (LQ-03).** The conversion is $\nu = c/\lambda$
and $u_\lambda(\lambda) = u_\nu(c/\lambda)\,c/\lambda^2$; $u_\lambda$ is
energy per volume per wavelength, not per frequency. Use distinct canonical
quantity ids (`frequencyEnergyDensity`, `wavelengthEnergyDensity`); a
similar glyph is not a binding key. The energy in matching physical bands
agrees; the density peaks do not correspond by substituting
$\lambda = c/\nu$. For a distribution per logarithmic interval the plotted
density is $\nu u_\nu$ or $\lambda u_\lambda$ in natural-log coordinates,
with an extra $\ln 10$ for base-10 intervals. A logarithmic horizontal axis
does not redefine what the vertical density means; axis labels, units,
integrals, and captions must agree, and the reader can preserve a selected
band while switching representations. Distinguish $\nu$ from angular
frequency $\omega$; dimensional analysis alone does not catch a missing
$2\pi$.

**Stable evaluation.** Evaluate small and large dimensionless arguments
with `expm1`, scaled exponentials, or the admitted upstream primitives,
never with naive overflow-prone expressions. Empirical points, historical
fitted laws, and theoretical curves stay visibly distinct; the site never
manufactures a convincing "1904 measurement" by sampling a modern formula
and adding noise. Digitized historical measurements (Lummer–Pringsheim,
Rubens–Kurlbaum) are typed datasets with table or figure citations or they
are absent.

**Photoelectric contract (§8, LQ-08).** Inputs: frequency, incident optical
power, an explicitly modeled work function, collector potential, and a
declared collection/yield model. The central relation is $K_{\max} = h\nu - \Phi$
and $eV_s = K_{\max}$ when emission is allowed under the single-quantum
assumptions. Below threshold the physical output is **no emitted electron
in this model**, not a negative kinetic energy (the signed energy budget may
still be shown as a deficit). Define the collector-potential sign, the
electron charge sign, and the positive stopping-potential magnitude
separately. Separate maximum electron energy from electron count: an
optional idealized counting model uses a declared efficiency $\eta_q$ and
an incident quantum rate $P/(h\nu)$; at fixed frequency, changing power
changes rate not $K_{\max}$; at fixed power, raising frequency also reduces
the number of quanta per second. At threshold, zero maximum kinetic energy
does not guarantee a measurable current; a collector sweep needs a declared
distribution model, and the site does not imply a universal real-material
photocurrent curve. Named metals require cited, condition-specific work
functions; the neutral fixture is a **hypothetical** work function of 2 eV,
for which 600 THz gives $K_{\max} \approx 0.4814$ eV and the threshold is
about 483.6 THz (modern constants, not a measurement of a named metal).
Einstein's printed check, that $\nu = 1.03\times10^{15}$ s$^{-1}$ corresponds
to about 4.3 volts, is a historical fixture. Ultraviolet and infrared are
never shown as visible colors without a false-color legend, and the moving
marks in the apparatus are a teaching representation, not a picture of
photons.

**Fluorescence and ionization (§§7, 9, LQ-07, LQ-09).** The fluorescence
instrument tracks incident energy, emitted light, and other channels; a
lower emitted frequency is natural under a one-input-quantum, no-extra-
energy assumption, and relaxing an assumption updates the model explanation
rather than breaking conservation. The ionization instrument relates
absorbed energy, thresholds, and event counts under an explicit one-quantum
hypothesis; it is not a gas-discharge simulator and invents no cross-
sections.

### 8.2 Paper 2: two routes to $D$, and honest inference

**Begin with the observable.** Open on a calibrated microscopic field of
suspended tracers, a real licensed observation sequence when available
(with acquisition and calibration information) and a conspicuously labeled
synthetic one until then. Ask: Is there a net drift? Does a longer
observation produce proportionally more displacement? Which statistic
remains stable when individual paths do not? The first discovery is that
signed displacements average to about zero while their squares reveal a
growing spread; the reader chooses an observable before being given the
law.

**Route A: pressure, drag, equilibrium (§§1–3, BM-02 to BM-04).** A
selective partition passes solvent, not particles; the dilute osmotic
pressure is $\Pi = nk_BT$ with $n$ number per volume (a symbol card
distinguishes $n$ from the total count $N_p$ and from $N_A$). The
statistical-mechanical section builds the many-particle position integral
from a one-particle volume factor: under independence and dilution the
position contribution scales as $V^{N_p}$, its logarithm contributes
$N_p\ln V$ to the free energy, and differentiating with respect to volume
yields pressure ("how did you avoid solving every molecular motion?"). Then
a weak external force $F$ on a slowly moving sphere of radius $a$ in a
Newtonian fluid of viscosity $\eta$ gives Stokes mobility $\mu = 1/(6\pi\eta a)$,
drift $u = \mu F$, drift flux $n\mu F$, and diffusion flux $-D\,\partial n/\partial x$.
At equilibrium $J = n\mu F - D\,\partial n/\partial x = 0$; the osmotic balance
supplies $nF = k_BT\,\partial n/\partial x$; comparing,

$$D = \mu k_BT = \frac{k_BT}{6\pi\eta a} = \frac{RT}{6\pi\eta a N_A}.$$

The force is a device for relating two descriptions of equilibrium; its
magnitude drops out and that cancellation is made visible. At zero force
and zero gradient the site does not pretend $0/0$ proves the relation; it
explains the equilibrium construction and its limiting use.

**Route B: irregular steps to a deterministic distribution (§4, BM-05,
BM-06).** Start with a pedagogical walk of independent steps $\pm\ell$
separated by $\tau$; expand the square of the sum; cross terms average
away, leaving variance proportional to step count. This is a mathematical
bridge, not a claim that the liquid makes a tracer execute fixed jumps.
Generalize to a symmetric transition density $\varphi(\Delta)$:

$$p(x, t + \tau) = \int p(x - \Delta, t)\,\varphi(\Delta)\,d\Delta.$$

Expand the left side in $\tau$ and the right in $\Delta$; cancel the
zeroth-order terms; observe that the first spatial moment vanishes by
symmetry; identify $D = \langle\Delta^2\rangle/(2\tau)$ and
$\partial p/\partial t = D\,\partial^2 p/\partial x^2$. State the
coarse-graining assumption: independence is not asserted down to
arbitrarily small physical times. For an initially localized ensemble on an
unbounded line,

$$p(x,t) = \frac{1}{\sqrt{4\pi Dt}}e^{-x^2/(4Dt)},\qquad
\langle x\rangle = 0,\qquad \langle x^2\rangle = 2Dt.$$

Selecting an interval shades its probability mass, and the displayed
integral updates from the same accepted state; the foundation panel
explains how a density differs from a probability.

**Einstein's printed check and a modern baseline (BM-01, BM-06).** With his
printed viscosity for water at 17°C ($k = 1.35\times10^{-2}$ CGS, i.e.
$1.35\times10^{-3}$ Pa·s), $T = 290.15$ K, and $a = 0.5\,\mu$m, the kernel
returns $\lambda_x = 0.79\,\mu$m at 1 s and $6.1\,\mu$m at 60 s, matching
the printed "about 0.8 $\mu$" and "about 6 $\mu$." With the modern
viscosity of water at 17°C (about $1.08\times10^{-3}$ Pa·s) it returns
$0.89\,\mu$m; the instrument shows both and the margin says why. A separate
modern golden scenario uses $T = 293.15$ K, $\eta = 1.000$ mPa·s,
$a = 0.500\,\mu$m, giving $D \approx 0.42944\,\mu$m²/s and one-dimensional
RMS displacements of about $0.92676\,\mu$m after 1 s and $2.93066\,\mu$m
after 10 s. These are derived fixtures from stated constant sets, labeled
as such, not observations.

**Probability laws and limiting states (BM-06).** The Gaussian applies for
$D > 0$, $t > 0$. At $t = 0$ an initially localized particle has a **point
distribution**, represented as a tagged `analytic-limit` state with
interval probabilities, not an infinite bar, `NaN`, or an error. A
two-dimensional radial distance is not a signed Gaussian coordinate: in
free isotropic diffusion $p_r(r,t) = \frac{r}{2Dt}e^{-r^2/(4Dt)}$ for
$r \ge 0$, with $\langle r^2\rangle = 4Dt$ and $\langle r\rangle = \sqrt{\pi Dt}$,
so mean radius and RMS radius differ; the extra factor of $r$ counts the
growing circumference of available positions, and it gets a picture, a
table, and a nonvisual counting explanation. Three dimensions need their
own geometric factor. Keep four distinctions visible: a single trajectory
versus an ensemble; position versus displacement over a chosen interval; a
signed coordinate versus a radius; mean square versus square of the mean.
An ensemble histogram at one time never silently becomes a time average of
positions along one nonstationary path.

**The specified inference model (BM-07).** For $M$ independent
displacement vectors in $d$ measured coordinates, equally separated by
$\Delta t$, with known zero drift, isotropic free diffusion, and negligible
measurement error,

$$\widehat{D} = \frac{\sum_{i=1}^{M}\|\Delta\mathbf{r}_i\|^2}{2dM\Delta t}.$$

The standardized squared coordinates give the exact pivot
$q\widehat{D}/D \sim \chi^2_q$ with $q = dM$, and a two-sided interval with
nominal coverage $1 - \alpha$ is
$\left[q\widehat{D}/\chi^2_{q,1-\alpha/2},\; q\widehat{D}/\chi^2_{q,\alpha/2}\right]$.
The foundation route explains the interval through repeated hypothetical
experiments before naming chi-square, and it is never described as a
posterior probability for a fixed unknown without a Bayesian model. When an
unknown constant drift is estimated from the same data, center the
increments, use $M - 1$ with $q = d(M - 1)$, require $M > 1$; a
maximum-likelihood version using $M$ has a different finite-sample bias,
and the schema names which estimator is used. Neither formula is admitted
unchanged for blurred, correlated, irregularly timed, or censored tracks.

For $C = RT/(6\pi\eta a)$ the molecular-number estimate is $C/\widehat{D}$.
Inverting an unbiased estimate is not unbiased: in this model, for $q > 2$,
its expectation is $N_A\,q/(q - 2)$, an optional statistical explanation,
not a prerequisite. Transform the interval by reversing its endpoints,
$[C/D_{\mathrm{high}},\, C/D_{\mathrm{low}}]$ when $C$ is treated as known;
uncertainty in $C$ requires a stated additional procedure.

**Identifiability.** Doubling $a$ and halving $N_A$ leaves the predicted
diffusivity unchanged at fixed $R, T, \eta$. Displacements alone cannot
determine both. The instrument shows the family of compatible inputs
before offering a narrow interval conditional on a known radius, and asks
which independent measurement would reduce the ambiguity. In modern SI,
$N_A$ is defined exactly; distinguish a historical estimate or a modern
consistency experiment from "measuring an unknown constant."

**Two activities that are not the same.** A **synthetic inverse exercise**
uses a labeled generator with a hidden parameter; the reader estimates it,
and success checks the inference machinery, not the existence of
molecules. A **historical or real-data inference** uses source-pinned
observations with independently established calibration and conditions
and shows the data's acquisition date; later observations do not enter the
1904 workspace merely because they test a 1905 prediction. In the
discovery instrument the unknown stays unknown: $R$, temperature,
viscosity, radius, and measured displacements are the inputs, and a modern
exact $k_B$ must not quietly enter the data-generation or inference path
as independent historical evidence.

**Observation noise changes statistical dependence (BM-08).** For measured
positions $y_i = x_i + \varepsilon_i$ with independent zero-mean errors of
variance $\sigma^2$, the measured increment contains $\varepsilon_{i+1} - \varepsilon_i$;
neighboring increments share a noise sample with opposite signs, so their
noise covariance is $-\sigma^2$ even though the physical increments are
independent, and each displacement second moment gains $2\sigma^2$ per
coordinate. A separately admitted uniform-exposure model with exposure
$T_e \le \Delta t$, equal frame spacing, independent localization errors,
and zero drift has

$$\operatorname{Var}(\Delta y_i) = 2D(\Delta t - T_e/3) + 2\sigma^2,\qquad
\operatorname{Cov}(\Delta y_i, \Delta y_{i+1}) = DT_e/3 - \sigma^2,$$

following the camera-averaged Brownian covariance (Berglund 2010). These
are later measurement models, not Einstein's derivation. The
independent-increment interval is disabled or shown as an intentionally
invalid comparison when its assumptions fail. Physical-path randomness and
observation-error randomness use separate logical streams; changing a
camera setting re-observes the same identified path. Not every broadened
histogram is attributed to increased physical diffusion. An error slider
changes the likelihood and the uncertainty contract, not just visual
jitter. Overlapping displacement windows do not create independent
samples.

**The rendering must not change the observed population (BM-01).** A path
leaving the viewport remains part of the ensemble: it is not wrapped,
reflected, replaced with a fresh particle, or excluded from inference to
keep the screen populated. A finite field of view causes track loss;
treat it as censoring with a declared observation rule, not silent cleanup.
Smooth lines between sampled positions are a rendering convention and do
not supply an instantaneous physical velocity; a collision bath may
illustrate a proposed mechanism but is not the accepted owner of measured
displacement unless a validated microscopic model is running. A
model-validity check distinguishes an assumed regime from one checked with
supplied properties; without the fluid and particle data and time-scale
information, the site does not certify a low-Reynolds or overdamped regime
numerically, and it never estimates a "Brownian speed" from a fine polyline
to gate Stokes drag. A displayed microscope boundary is a camera viewport,
not a reflecting wall unless a wall model has been chosen.

**The velocity trap (BM-01 mode).** Show the apparent speed
$\lambda_x/\tau$ growing as $\tau^{-1/2}$ as the observation interval
shrinks, and use it to explain Exner's 1900 failure. **Physical boundaries
and later lenses.** The primary model is dilute, approximately spherical
tracers in a homogeneous Newtonian fluid in an admitted low-Reynolds,
long-enough-time regime; near-wall corrections, anomalous diffusion,
active motion, non-Newtonian effects, and microscopic collision dynamics
are not silently included. An underdamped Langevin extension (labeled
1908) can illustrate the ballistic-to-diffusive crossover at
$m/(6\pi\eta a)$, about $10^{-7}$ s for a micron particle, and the
historian's margin notes it was measured only in 2010; it is not required
before the core paper ships. Changing the render frame rate never changes
the stochastic experiment; common random numbers may isolate an effect but
are never called independent trials.

### 8.3 Paper 3: a measurement procedure, a constructed map, both halves

**Begin by making a measurement procedure (§1, SR-01).** The opening task
is not "accept that time is relative." It is: you have separated stations,
clocks, rulers, and light signals; how will you assign a time to an event
that happens elsewhere? The apparatus has an **event ledger** (primary) and
a spatial scene. The ledger records emission, reflection, and reception at
named clocks; the scene makes the procedure concrete without implying that
what a distant camera sees equals a simultaneous coordinate measurement.
The convention $t_B - t_A = t'_A - t_B$ is applied explicitly, and the
distinction between an event and its reception is kept in every view. A
pair of clocks synchronized in their own frame and moving at $v$ is seen
from the platform frame as out of step by $vL/c^2$ for proper separation
$L$.

**Make the ordinary assumption explicit (SR-04 shelf step).** Offer the
Galilean map $x' = x - vt$, $t' = t$; let the reader test it on low-speed
objects (it works) and then on light trajectories $x = \pm ct$ (it does
not preserve the light speed). The point is not that algebra has disproved
classical mechanics; the map does not jointly preserve the light-speed
postulate and absolute time, and the reader must decide what to reconsider.

**Build a candidate map instead of being handed the answer (§3, SR-04).**
In the accessible linear-algebra reconstruction, begin with
$x' = a(v)(x - vt)$, $t' = b(v)t + d(v)x$. Explain why uniform motion,
homogeneity, the chosen origins, and inertial coordinates motivate an
affine map and why the origin convention (the moving origin is at
$x = vt$) removes the offsets; linearity is not presented as a law needing
no assumptions. Requiring both light directions to remain $x' = \pm ct'$
gives $b(v) = a(v)$ and $d(v) = -a(v)v/c^2$. A scale factor remains, and
its existence is made visible because superficial explanations lose it:
applying the inverse gives $a(v)a(-v)(1 - v^2/c^2) = 1$; spatial isotropy
supplies $a(v) = a(-v)$; the positive branch continuously connected to the
identity gives $a(v) = \gamma = (1 - v^2/c^2)^{-1/2}$. Hence
$x' = \gamma(x - vt)$, $t' = \gamma(t - vx/c^2)$. **The longitudinal
derivation has not established the transverse equations.** Complete the
transverse step using the axis normalization, spatial symmetry, and light
propagation in transverse as well as longitudinal directions; do not copy
$y' = y$, $z' = z$ from the desired answer. As a $2\times2$ matrix on
$(x, t)$ the boost is $\begin{pmatrix}\gamma & -\gamma v\\ -\gamma v/c^2 & \gamma\end{pmatrix}$
with determinant 1, eigenvectors on the light lines, and eigenvalues
$\sqrt{(1 \mp v/c)/(1 \pm v/c)}$, which reappear as the Doppler factors;
with $\gamma = \cosh\phi$, $\gamma v/c = \sinh\phi$ the boost is a
hyperbolic rotation by the rapidity $\phi$ and two boosts compose by
adding rapidities. This is **a pedagogical reconstruction**; the
source-reading route separately walks Einstein's synchronization-based
derivation in his notation, and neither is advertised as his private
thought process. Spacetime diagrams, rapidity, and the light-clock
derivation are labeled later aids.

**Interpret each new term (§§2, 4, SR-03, SR-05).** The subtraction
$vx/c^2$ is not a correction to a defective clock; it says the new frame's
time assignment depends on position. At $v = 0.6c$, $\gamma = 1.25$: two
events 10 light-seconds apart and simultaneous in the unprimed frame have
$\Delta t' = -7.5$ s and $\Delta x' = 12.5$ light-seconds. That spatial
separation is **not** a rod-length measurement in the primed frame,
because the events are not simultaneous there; a separate control selects
the appropriate endpoint events for each measurement question, and only
frame-simultaneous endpoint pairs are credited as length measurements. A
sphere of radius $R$ is measured as an ellipsoid with axes
$R\sqrt{1 - v^2/V^2}, R, R$; a moving clock loses
$1 - \sqrt{1 - v^2/V^2}$ per second, about $\tfrac{1}{2}v^2/V^2$, and the
instrument shows the printed second-order form beside the exact one. The
light-clock construction is a supplemental derivation of time dilation,
used after the measurement definitions, not as a substitute for the
coordinate transformation.

**Derive consequences by changing the question, not the engine (§5,
SR-06).** The same event/frame model supports clock comparisons along
specified worldlines, rod measurements with frame-simultaneous endpoints,
velocity addition as a ratio of transformed differentials, null propagation
and causal ordering, and a labeled modern geometric view. For a boost along
$x$,

$$u'_x = \frac{u_x - v}{1 - u_xv/c^2},\qquad
u'_y = \frac{u_y}{\gamma(1 - u_xv/c^2)}.$$

The sign convention is fixed by the frame definition; a toggle never
silently reverses it; the inverse transform is a tested operation, not a
second set of display rules. Spacetime diagrams use coherent axis scaling
for a 45-degree light cone; a camera zoom never implies changed physics;
units such as light-seconds are used where they simplify geometry and the
conversion is never concealed. Non-collinear boost composition includes a
spatial rotation; it is never implemented by forcing the result into a
pure boost with parallel axes, and the software acceptance tests the full
matrix, not only an inferred speed. The initial kinematic core's scope is
explicit: aligned-axis boosts with the supported origins and orientations.

**Do not abandon electrodynamics after §5 (§6, SR-07, SR-08).** Start with
vectors and a concrete prescribed field, then show what a moving test
charge experiences. In the labeled modern SI layer, for the stated boost
convention, $\mathbf{E}'_\parallel = \mathbf{E}_\parallel$,
$\mathbf{B}'_\parallel = \mathbf{B}_\parallel$,
$\mathbf{E}'_\perp = \gamma(\mathbf{E} + \mathbf{v}\times\mathbf{B})_\perp$,
$\mathbf{B}'_\perp = \gamma(\mathbf{B} - \mathbf{v}\times\mathbf{E}/c^2)_\perp$.
The original equations use historical conventions; the conversion is a
derivation with an explicit mapping, not a typographic substitution. The
reader can open the chain-rule transformation of derivatives and follow the
transformed Maxwell–Hertz equations component by component. The full
explanation of §6 exposes the source's field-transformation ansatz, the
common-factor argument, and the normalization and symmetry conditions;
transforming the differential equations into the same form is not, by
itself, a uniqueness proof for every physical identification of the
transformed fields, and the modern verification layer that uses more
structure says so. For the magnet-and-conductor introduction, distinguish a
qualitative apparatus reconstruction from a quantitatively solved
electromagnetic model: a narrow analytic dipole field and test-charge
example establishes frame consistency (the induced electromotive force is
the same in both descriptions) without claiming that a generic flux routine
solves an arbitrary moving magnet and conductor.

**Compare covariant descriptions, not numerically identical components
(SR-08 acceptance).** A passive frame change describes the same events
differently: field components, force components, coordinate intervals, and
charge density change numerically. An acceptance test compares the correct
transformation law, the same event, and the same measurement procedure;
demanding equal raw force values in two frames would be a bug. Field
invariants $E^2 - c^2B^2$ and $\mathbf{E}\cdot\mathbf{B}$ are independent
checks in the modern layer, not proof that every displayed force or source
equation is right. Selecting an observer is separate from moving a physical
source or detector: "describe this detector in another frame" does not
change the experiment; "a detector moves differently" does, and both the
interface language and the runtime command type keep them apart (§12.6).

**Wave phase, Doppler, aberration (§7, SR-09).** One plane-wave phase model
drives wavefront geometry, detector events, frequency, and direction. For
a ray at angle $\theta$ to the boost axis in the unprimed frame,
$\nu' = \gamma\nu(1 - \beta\cos\theta)$ and
$\cos\theta' = (\cos\theta - \beta)/(1 - \beta\cos\theta)$ with
$\beta = v/c$ in the modern layer. At $\beta = 0.6$ a ray along the boost
direction is reduced to half its frequency and the opposite ray doubles.
These are analytic fixtures, not observations; Ives–Stilwell 1938 is the
dated confirmation on the timeline. Sound analogies are foundation
material, not proof.

**A light packet is not a material rod; a moving mirror is not a fixed
detector (§8, SR-10, SR-11).** For the finite plane-wave light complex,
define $q = \gamma(1 - \beta\cos\theta)$. The source calculation gives an
energy-density (amplitude-squared) factor $q^2$ and a bounding-volume factor
$1/q$, so the total-energy factor is $q$; the volume refers to the same
moving light complex on each frame's simultaneous slice, and substituting
the material-volume contraction $1/\gamma$ generally gives the wrong
result (journal pages 912–913). An adversarial fixture tests a transverse
ray, where the two differ. The instrument shows both factors before the
total. The moving-mirror instrument transforms into the mirror frame,
applies the specified reflection law, and transforms back, with
incidence-domain checks: a mirror receding faster than the normal
component of the incident ray does not intercept it. The narrow fixture is
normal incidence in the laboratory with signed mirror speed $\beta c$
along the incident ray and a prescribed infinite-mass boundary:
$\nu_{\mathrm{refl}}/\nu_{\mathrm{inc}} = (1 - \beta)/(1 + \beta)$ (one
quarter at $\beta = 0.6$); with incident laboratory intensity $I$ and
transverse area $A_m$, the energy reaching the moving surface per unit
laboratory time is $IA_m(1 - \beta)$, not $IA_m$, and the laboratory force
is $F = \frac{2IA_m}{c}\frac{1 - \beta}{1 + \beta}$, with radiation energy
lost per unit laboratory time equal to $Fv$ under these assumptions. This
is a derived, source-compatible fixture, not a real-material mirror
calibration; oblique incidence and a finite-mass mirror are separate
scopes.

**Charge and current (§9, SR-12).** Charge density and current density get
their own linked vector and continuity view; a labeled four-current
representation may help. Do not impose the invalid condition $|J/\rho| < c$
on net densities: a neutral conductor has zero net charge and nonzero
current, and the test suite accepts that case.

**Electron dynamics and the historical force conventions (§10, SR-13).**
Begin with force and acceleration in the appropriate frame, derive work as
an integral, and compare energy and deflection relations with the low-speed
limit. The original prints a transverse coefficient corresponding to
$m\gamma^2$, because its convention combines force components in the
instantaneously comoving frame with acceleration in the original frame;
preserve and explain that convention. At an instant when the particle moves
along the laboratory $x$-axis a modern comparison writes
$F'_y = m\gamma^2 a_y$, $F_y = F'_y/\gamma = m\gamma a_y$,
$F_x = F'_x = m\gamma^3 a_x$; at $\beta = 0.6$ the two transverse
coefficients are $1.5625m$ and $1.25m$, not competing values of one scalar
rest mass, and the instrument makes the changed definition visible before
comparing them. Every force and acceleration carries a frame identity.
$W = mV^2(\beta - 1)$ is compared with $\tfrac{1}{2}mv^2$. The three
relations Einstein says are accessible to experiment are shown as printed;
Kaufmann's data are presented as ambiguous in 1905–1906 and Bucherer 1908
as the dated later comparison. A tested analytic or narrowly integrated
charged-particle model in prescribed fields suffices; radiation reaction
and self-fields are excluded and said to be.

**Clocks on curved paths and the Earth's surface (§4 note, SR-05).** The
edition includes §4's transported clocks, their extension to curved paths,
and the equator-versus-pole remark. An ideal-clock interpretation along a
prescribed worldline is not a license to claim a model of arbitrary
accelerated clock mechanisms. The remark is not presented as an accurate
comparison of real clocks on the geoid using special relativity alone;
Hafele's analysis explains the approximate cancellation of gravitational
and kinematic effects in the idealized terrestrial comparison, and the note
is a short limit-of-model statement, not a general-relativity prerequisite.
For reciprocal clock-rate questions, compare complete specified worldlines
and reunion events; a modern proper-time aid can explain why different
elapsed times do not contradict reciprocal inertial descriptions; no
unexplained "acceleration penalty," and no splicing of incompatible
simultaneity conventions without saying so.

### 8.4 Paper 4: two ledgers, one subtraction, one coefficient

**The deliberately minimal experiment (ME-01).** A body at rest emits two
equal light pulses in opposite directions; in its own frame the emission is
symmetric. Ask why this is clever: it removes recoil from the rest-frame
bookkeeping and isolates an energy change. Do not begin by asserting that
each pulse is "mass converted to energy"; the argument investigates the
relation rather than assuming it. The needed import is the transformation
of light energy from paper 3, §8, with provenance.

**Two ledgers and four body-energy quantities.** With $L$ the total
emitted energy in the rest frame, $E_0, E_1$ the body's energies before and
after in that frame, and $H_0, H_1$ in a frame moving at $v$, the two pulses
have moving-frame energies $\tfrac{L}{2}\gamma(1 - \beta\cos\phi)$ and
$\tfrac{L}{2}\gamma(1 + \beta\cos\phi)$; their sum is $\gamma L$ for any
emission angle, and the reader can rotate the axis and watch the individual
energies change while the sum does not. The balances are
$E_0 - E_1 = L$ and $H_0 - H_1 = \gamma L$; subtracting,
$(H_0 - E_0) - (H_1 - E_1) = L(\gamma - 1)$. Every cancellation is a
selectable operation. The next step identifies each frame-energy difference
with kinetic energy plus the same additive constant before and after
emission; the source explicitly asserts that unchanged constant, and the
cancellation is not an independent derivation of the assertion. Preserve
this premise and the argument's scope rather than declaring the three-page
argument a premise-free theorem for arbitrary systems.

**Extract the low-speed coefficient (ME-02).** $K_0 - K_1 = L(\gamma - 1)
\approx \tfrac{1}{2}\frac{L}{c^2}v^2$. The reader varies $v$, compares the
exact curve with its quadratic approximation, and infers the change in the
coefficient of $v^2/2$; identification of the limiting quadratic
coefficient yields a mass loss of $L/c^2$ within the admitted premises. A
finite-speed estimate $2(K_0 - K_1)/v^2$ is generally **not** that limiting
coefficient and is never labeled the exact mass loss. The quantitative view
shows three outputs: the exact difference $L(\gamma - 1)$, the finite-speed
proxy $2L(\gamma - 1)/v^2$, and the limiting coefficient $L/c^2$; the proxy
approaches the coefficient as $v \to 0$, and at exactly zero the limiting
output is well defined even though the unreduced expression looks like
$0/0$. Near zero use a cancellation-resistant evaluation of $\gamma - 1$,
for example $\gamma^2\beta^2/(\gamma + 1)$. At $v = 0.6c$ the exact
kinetic-energy difference is $0.25L$ while the quadratic approximation is
$0.18L$; that deliberate discrepancy makes the approximation's domain
visible, and the reader moves toward low speed and watches the coefficient
stabilize (the proxy exceeds $L/c^2$ by about $\tfrac{3}{4}(v/c)^2$ at
small speed). Distinguish a positive mass lost, $M_{\mathrm{before}} - M_{\mathrm{after}} = L/c^2$,
from the signed change $\Delta M = -L/c^2$.

**Do not bake the desired answer into the ledger.** The discovery ledger's
independent input is the emitted rest-frame energy $L$ together with the
observer transformation and the stated premises; its immediate predictions
concern **energy differences**. It does not know the body's absolute rest
energy merely because the interface has room for a number. Keep $E_0, E_1,
H_0, H_1$ symbolic where appropriate, or show explicitly arbitrary offsets
that cancel; never initialize them with $Mc^2$ or $\gamma Mc^2$ and then
use the animation to claim the argument derived those inputs. A modern
four-momentum mode may use those relations under a distinct model identity
with an explicit dependency on later formalism.

**Make the system boundary visible (ME-03).** A second instrument follows
energy through three boundaries: the body alone, the emitted radiation, and
the combined isolated system. Energy leaving the body does not disappear
from the larger system, and the interface never implies that an isolated
system loses total mass-energy when energy merely moves internally. The
modern extension introduces total four-momentum and invariant system mass:
two equal opposite pulses have nonzero invariant mass as a system despite
massless constituents, a later formal explanation that resolves a common
confusion. A "heated sealed box" example specifies how energy entered and
what is inside; it is an energy/inertia ledger, not a gravitational
weighing experiment, and it does not smuggle in unmodeled external work or
wall stresses.

**Check it against the world (ME-03 cards).** Einstein proposes radium.
Cards with provenance: one radium-226 alpha decay releases about 4.87 MeV,
so a mole of radium loses about 5 mg of mass in that single step; the Sun
converts about four million tonnes of mass to light every second; burning a
kilogram of coal loses less than a nanogram; a candle flame loses mass. The
photon-in-a-box argument (a box of mass $M$ and length $\ell$ recoils at
$E/(Mc)$ for a time $\ell/c$ and shifts by $E\ell/(Mc^2)$, so mass
$E/c^2$ must have moved with the light if the center of mass of a closed
system cannot move on its own) is offered as the 1906 side door, labeled
with its date and Einstein's own credit to Poincaré.

**Teach the coefficient before the slogan.** The no-algebra entrance
presents two before/after accounting sheets in words and small numbers,
with unknown internal quantities as covered boxes; the reader subtracts the
sheets and discovers that some inaccessible details are not needed. Only
afterward come the frame transformation and the small-speed coefficient.
Closing the four-paper experience connects techniques rather than claiming
a finished unified theory: infer hidden structure from constraints; choose
observables that survive complexity; examine operational definitions;
compare the same process in two descriptions; exploit symmetry to cancel
what you do not need to know.

---

## 9. Discovery Journeys: "A Route You Could Take"

This is the site's signature content. Each journey is a guided
reconstruction with a fixed skeleton so the reader learns the moves, not
just the results, and each is labeled a route a reasonable person could
take from the 1904 shelf, never a transcript of Einstein's private
thinking.

### 9.1 The skeleton

1. **The shelf.** A dated list of results that a careful reader of the
   literature had by the end of 1904, each a knowledge card (§5.2) with
   source, one-line statement, limits, and, where useful, a shelf
   instrument on the 1904 desk. Nothing after 1904 is on the shelf
   unless flagged as parallel work. Nothing is invented to smooth the path.
2. **The nagging fact.** The observation or contradiction that does not
   fit.
3. **The first honest question.** One sentence, second person.
4. **The chain.** A sequence of questions in stages. Each step shows what
   the reader can compute from the shelf, with the instrument for that
   step embedded, and with "show me the reasoning" available at every
   point (§6.7).
5. **The forks.** At two or three points the path stops and offers the
   real alternatives on the table in 1904. The reader picks one. Each
   branch is worked far enough to show where it leads: a dead end on a
   stated constraint, a correct but weaker result, an empirically
   equivalent alternative that is not declared refuted, or the paper's
   route. Branches that Lorentz, Planck, Poincaré, Nägeli, or Exner took
   are labeled with their names. Nobody is mocked (§5.4).
6. **The move.** The one non-obvious step, named as such and marked in the
   derivation chain.
7. **Check it against the world.** A numerical prediction computed from
   the accepted snapshot, compared with a dated measurement that is
   clearly labeled as later evidence where it is.
8. **What Einstein actually wrote.** A jump into the reading face at the
   section where the paper makes the same move, with the result weave
   lit.
9. **Exercises.** Two to five problems with instrumented answers (checked
   by the kernel or by numerical equivalence, never by a stored string),
   plus a predict-perturb-explain task.

Each journey has a **front door** (Einstein's own argument) and at least
one **side door** (a route that starts from something a programmer,
physician, or arithmetic-only reader already owns: a loop, a matrix, Fick's
law, two accounting sheets). All arrive at the same equation and the site
says so.

### 9.2 Journey I: why suspect that light comes in energy quanta?

**The shelf (by end of 1904).** Maxwell (1865) and Hertz (1888): light is
an electromagnetic wave whose energy is continuously divisible. Hertz
(1887) and Hallwachs (1888): ultraviolet light discharges negatively
charged metal; J. J. Thomson (1899): what leaves is electrons. Lenard
(1902): the energy of the emitted electrons does not depend on the light's
intensity, and it depends on the light's frequency. Kirchhoff (1860),
Stefan (1879), Boltzmann (1884), Wien (1893, 1896): the black-body problem
and Wien's law $\rho = \alpha\nu^3 e^{-\beta\nu/T}$, which fits at high
frequency. Lummer and Pringsheim, Rubens and Kurlbaum (1899–1900): Wien's
law fails at long wavelength. Rayleigh (June 1900): equipartition gives a
form that works at long wavelength and cannot be right everywhere. Planck
(October and December 1900): an interpolation formula that fits all the
data, derived with energy elements as a computational device; the
constants $h$ and $k$; $N = 6.17\times10^{23}$. Boltzmann (1877), Planck
(1900): $S = k\ln W$. The ideal gas: $S - S_0 = nk\ln(V/V_0)$ for $n$
molecules expanding isothermally. Stokes (1852): fluorescent light is never
bluer than the light that excites it.

**The nagging fact.** Turn up the lamp and the electrons come out in
greater numbers but not with greater energy. A stronger wave should shake
them harder.

**The first honest question.** Is there any regime of light where I can do
honest thermodynamics without knowing what light is made of?

**The chain.**

- *Stage A: trust the successes before inspecting the failure.* Give the
  wave picture a serious demonstration (LQ-01): propagation, interference
  of a prescribed field, time-averaged intensity. State which effects the
  reduced model represents. No particle visualization is used to deny
  interference or to suggest the 1905 paper supplied quantum optics.
- *Stage B: examine a spectrum.* Plot spectral energy density against
  frequency at adjustable temperature (LQ-03), with empirical points,
  historical fitted laws, and theoretical curves visibly distinct.
  Introduce mode counting and classical energy sharing with a finite
  cutoff (LQ-02); the implied total grows without bound.
- *Stage C: choose the regime where the law is simple.* Enter the Wien
  regime. In the modern layer use $x = h\nu/(k_BT)$; in the discovery
  narration expose the historical spectral constants rather than
  introducing $h\nu$ as an already-established packet energy.
- *Stage D: recover the volume dependence of entropy.* Walk the
  thermodynamic relation, the inversion of Wien's law, the zero-radiation
  boundary condition, and the integration at fixed narrow band (§8.1,
  LQ-04). Compare constrained states at fixed energy, frequency, and band
  width. Every derivative, logarithm, normalization condition, and
  canceling term has a drill-down.
- *Fork A.* Where have you seen $\ln(V/V_0)$? (a) It is a coincidence of
  the mathematics; keep the continuum and treat $h$ as a property of the
  oscillators in the walls. This was Planck's position for years
  afterward; the site works it and shows that it leaves Lenard's result
  unexplained. (b) It is the ideal-gas volume law with
  $n = E/(\beta\nu)$ things. Branch (b) is the move.
- *Stage E: solve a simpler counting problem.* Put $n$ independent points
  into $V_0$ and ask for the probability that all lie in a subvolume
  (LQ-05); drag the partition; for small $n$ enumerate, for large $n$ show
  logarithmic probability. Meet the locked-positions counterexample.
- *Stage F: the move.* Place the gas and radiation entropy laws side by
  side without the label (LQ-06); ask what plays the role of "number of
  independent things"; reveal the correspondence and the energy per thing.
  In the Wien regime, monochromatic radiation *behaves* as if made of
  independent quanta of energy $R\beta\nu/N$. Einstein's word is
  heuristic, and the site keeps it.
- *Fork B.* If light arrives in lumps, what happens when one lump meets one
  electron? (a) The energy spreads through the metal, as in the wave
  picture; the site works it and shows it predicts an intensity
  dependence that Lenard did not see. (b) One electron gets the whole
  lump, pays the exit cost $P$, and leaves with at most $h\nu - P$: a
  stopping potential linear in frequency with slope $h/e$, independent of
  intensity (LQ-08).
- *Stage G: demand consequences.* Open fluorescence (LQ-07), photoelectric
  emission, and gas ionization (LQ-09), and let the reader predict what
  changes when intensity doubles, when frequency increases, and when the
  escape-energy parameter changes.
- *Check it against the world.* Einstein's printed 4.3 volts agrees with
  Lenard in order of magnitude. Millikan's 1916 sodium line (a dated later
  measurement, digitized with citation) has slope $h/e$ to better than one
  percent; Millikan had expected to refute the equation.

**The side door (programmer).** Write the microstate counter. Put $n$
labeled particles in a box at random; the chance that all are in the left
fraction $f$ is $f^n$. Now be told that the entropy of Wien radiation
changes with volume like $\frac{E}{h\nu}\ln f$. Invert: the radiation is
behaving like $n = E/(h\nu)$ independent things. The loop is the argument,
and the loop also shows what happens when the particles are not
independent.

**What the reader should leave able to explain.** Why entropy was an
unexpectedly powerful diagnostic; how a volume dependence suggested an
effective count; which step was heuristic; why the wave theory's successes
did not disappear.

**Exercises.** Compute $h$ from a given stopping-potential line; find the
threshold for a hypothetical work function; compute how many quanta per
second a one-watt green source emits; explain in two sentences why
intensity does not change $K_{\max}$; explain why locked positions give
$f$ rather than $f^n$.

### 9.3 Journey II: how can visible wandering reveal invisible molecules?

**The shelf (by end of 1904).** Brown (1827): fragments from pollen and
inorganic particles jiggle. Gouy (1888): the jiggling is intrinsic; faster
for smaller particles, in warmer and less viscous liquids; not caused by
light, convection, or vibration; Gouy proposed thermal molecular agitation.
Nägeli (1879): a single molecular impact cannot move a visible particle, so
agitation cannot be the cause (a wrong argument and a fork). Exner (1900):
measured the "speed" of the particles and found it far too small for
kinetic theory (a wrong observable and a fork). Maxwell (1860), Boltzmann:
kinetic theory; a particle in thermal equilibrium has mean kinetic energy
$\tfrac{3}{2}kT$ whatever its mass. Van 't Hoff (1887), Pfeffer (1877):
dissolved molecules exert an osmotic pressure obeying the gas law. Stokes
(1851): drag $6\pi\eta av$ on a slow sphere. Fick (1855): the diffusion
equation. Siedentopf and Zsigmondy (1902): the ultramicroscope. Loschmidt
(1865), Planck (1900): estimates of $N$. Bachelier (1900): the
random-walk-to-diffusion mathematics, worked out for stock prices in a
Paris thesis under Poincaré and unknown to physicists (a favorite for
programmers). Sutherland: the same diffusion formula with a slip
correction, presented at Dunedin in January 1904 (a legitimate shelf
card), misprinted in the congress proceedings in early 1905, and published
in *Philosophical Magazine* in June 1905, between Einstein's submission and
publication (parallel work, flagged).

**The nagging fact.** If Gouy is right and the jiggling is thermal, then a
one-micron particle is just a very large molecule, and everything we know
about molecules in solution should apply to it. Does it?

**The first honest question.** Does a visible particle in water exert an
osmotic pressure?

**The chain.**

- *Begin with the observable* (BM-01): a calibrated field, three questions
  (drift? proportional displacement? which statistic is stable?), and the
  discovery that signed displacements cancel while their squares grow. The
  reader chooses an observable before being given the law. The no-algebra
  entrance of §7.4 is this stage in arithmetic.
- *Route A begins.* Van 't Hoff's law has no term that knows how big the
  molecule is (BM-02); the statistical-mechanical section shows the volume
  factor without solving every molecular motion (BM-03).
- *Fork A (Nägeli).* (a) A particle in still water does not move, because
  no single kick is big enough; turn the kicks off in BM-04 and the
  gradient never relaxes, contradicting Fick. (b) The particle is kicked
  constantly from all sides and the imbalance is what we see. Branch (b)
  is the move.
- *Route A meets drag* (BM-04): osmotic force per particle balances Stokes
  drag; the force drops out; $D = k_BT/(6\pi\eta a)$ (§8.2).
- *Route B: the side door first, because it is clearest* (BM-05, BM-06).
  Simulate it: each interval the particle moves by a random symmetric
  step; after many intervals the histogram is a Gaussian whose variance
  grows linearly. Then do Einstein's calculation: the density at the next
  instant as an average over the step distribution, expanded to second
  order, and the diffusion equation appears with
  $D = \langle\Delta^2\rangle/(2\tau)$. The histogram is the solution of
  Fick's equation. The two routes meet: the two $D$'s are the same $D$,
  and $\langle x^2\rangle = 2Dt = \frac{k_BT}{3\pi\eta a}t$.
- *Fork B (Exner).* What do you measure? (a) The speed: worked, and the
  apparent speed depends on how often you look, growing as $\tau^{-1/2}$;
  Exner's number meant nothing. (b) The displacement over a fixed interval:
  the observable.
- *Check it against the world.* Water at 17°C, one-micron particles: about
  $0.8\,\mu$m in a second, about $6\,\mu$m in a minute, as Einstein
  printed, visible in an ordinary microscope.
- *The inversion* (BM-07): everything in $\langle x^2\rangle = \frac{k_BT}{3\pi\eta a}t$
  is measurable with a microscope, a thermometer, a viscometer, and a
  stopwatch, except $N$. Measure the jiggling and count the atoms, with
  the honest inference of §8.2: the interval, the bias, the
  identifiability of $a$ and $N$, and the difference between a synthetic
  exercise and real data. Perrin did it (1908–1909) and got values between
  roughly $6$ and $7.5\times10^{23}$ across his methods, with the 1909
  sedimentation-equilibrium value near $7\times10^{23}$; the 1926 Nobel
  Prize is a timeline card.

**The physician's door.** You already know Fick's law and osmotic
pressure. This paper is the bridge between them, and the bridge is Stokes
drag: osmotic force per particle equals drag, therefore diffusion
coefficient equals thermal energy over drag coefficient.

**Exercises.** Estimate $N$ from a given set of displacements with the
specified estimator and interval; predict the displacement of a
$0.1\,\mu$m particle in glycerol; explain why a warmer liquid gives a
larger $\lambda_x$ twice over (through $T$ and through $\eta$); explain
what Exner measured; explain why halving $D$ does not halve the
displacement; explain why two equally restless traces are insufficient to
distinguish two diffusion coefficients and what additional comparison
would help.

### 9.4 Journey III: how could you stop assuming that everyone shares the same time?

**The shelf (by end of 1904).** Galileo: the laws of mechanics look the
same below decks whether the ship moves or not. Maxwell (1865): the
equations, with light at $c$ relative to the ether; the equations do not
keep their form under $x' = x - vt$ (a shelf instrument substitutes and
watches a term appear). Faraday, and every dynamo patent on a Bern
examiner's desk: move the magnet or move the coil, the same current flows,
but the ether theory explains the two cases with two mechanisms. Bradley
(1729): stellar aberration, about $20.5''$. Fizeau (1851): light in moving
water is dragged by $(1 - 1/n^2)$ of the water's speed. Michelson (1881),
Michelson and Morley (1887): no ether wind to second order. FitzGerald
(1889), Lorentz (1892): bodies moving through the ether contract by
$\sqrt{1 - v^2/c^2}$, which would hide the wind. Lorentz (1895): a
fictitious "local time" $t' = t - vx/c^2$ makes the equations work to
first order. Poincaré (1898): simultaneity of distant events is a
convention; the natural one synchronizes clocks with light signals assuming
equal travel time each way. Poincaré (1900): Lorentz's local time is what
moving observers get from that convention. Lorentz (1904): the full
transformation with contraction, applied to a contractile electron, the
ether kept. Poincaré (September 1904, St. Louis): "the principle of
relativity" named as a general law. Kaufmann (1901–1903): electron mass
rises with speed; Abraham's rigid electron and Lorentz's contractile
electron compete. Poincaré (5 June 1905): the group property and corrected
transformations (parallel work, flagged).

**The nagging fact.** Nature does not care whether the magnet or the coil
moves; the theory does.

**The first honest question.** What if the principle of relativity is
exactly true for electrodynamics too, and the speed of light is the same
for every observer, and I follow both wherever they lead?

**The chain.**

- *Two postulates and nothing else.* No ether, no electron model, no
  contraction hypothesis.
- *Make a measurement procedure* (SR-01): what does "at the same time"
  mean for two clocks a kilometer apart? Only light can carry the
  comparison. Adopt the convention Poincaré had stated in 1898 (the paper
  cites no one): bounce a signal and assume equal travel times. Now you
  have a definition of time in each frame, and an event ledger to keep.
  The no-algebra entrance (a signal leaves at 0, returns at 10, the
  reflection is assigned 5) is this stage.
- *Make the ordinary assumption explicit.* Test the Galilean map on slow
  things and on light (§8.3); the conflict is between stated commitments,
  and the reader decides what to reconsider.
- *Watch simultaneity slip* (SR-03): two events simultaneous in one frame
  are not in another, by an amount proportional to their separation and to
  $v$. This is the step Lorentz had the mathematics for and did not take
  physically: he kept a true time and called the other one local.
  Poincaré came closer (1900, 1904) but kept the ether and a preferred
  frame.
- *Fork A.* (a) Keep the ether and the true time; the transformation is a
  calculational device (Lorentz 1904). Worked: it produces the same
  formulas and the site says so; what it cannot do is explain why the
  ether is undetectable in principle, and it is not declared refuted by
  the kinematics alone. (b) No privileged frame; every frame's clocks are
  as real as every other's.
- *The move (side door, linear algebra)* (SR-04): construct the map from
  the postulates, with the scale factor, reciprocity, isotropy, and the
  transverse step done honestly (§8.3). Read the matrix's determinant,
  eigenvectors, and eigenvalues; meet rapidity as a labeled later aid.
- *The front door.* Einstein's §3 does the same thing with a functional
  equation for $\tau$ and the synchronization condition; the reading face
  walks it with every step shown.
- *Read the consequences off the map* (SR-03, SR-05, SR-06): rods,
  clocks, velocity composition, nothing faster than $c$; the difference
  between event separation and a rod measurement.
- *Fork B.* Now the electrodynamics. (a) Maxwell's equations are true only
  in the ether frame and merely look true elsewhere. (b) They keep their
  exact form in every frame provided $\mathbf{E}$ and $\mathbf{B}$ mix under
  a boost (SR-07, SR-08). Branch (b) makes the magnet-and-coil asymmetry
  disappear: the "electromotive force" in the coil's frame is an electric
  field in the magnet's.
- *Transform a wave and a light complex* (SR-09, SR-10, SR-11): Doppler
  and aberration from the phase; the energy of a light complex changes by
  the same factor as its frequency; the moving mirror. File the energy
  result away for September.
- *Charge, current, the electron* (SR-12, SR-13), with the historical
  force conventions preserved.
- *Check it against the world.* Aberration: right. Fizeau's coefficient is
  the low-speed limit of velocity addition (Laue 1907, labeled later).
  Kaufmann's data: ambiguous in 1905–1906; Bucherer 1908 favored the
  Lorentz–Einstein prediction; Ives–Stilwell 1938, muon lifetimes 1941,
  flown clocks 1971, and satellite clocks are dated on the timeline, not
  claimed for 1905.

**Exercises.** Verify the determinant and eigenvectors by hand; show that
two collinear boosts give a boost and say what happens for non-collinear
ones; derive the desynchronization $vL/c^2$; compute the speed at which a
clock loses one second per day; explain the magnet-and-coil asymmetry in
three sentences without the word ether; explain why a larger spatial
separation of two transformed events is not a longer rod.

### 9.5 Journey IV: can emitting light change inertia?

**The shelf (by end of 1904, plus paper 3).** Maxwell, Poynting (1884):
light carries momentum $E/c$; radiation pressure exists; Lebedev (1901),
Nichols and Hull (1901–1903) measured it. J. J. Thomson (1881), Abraham
(1902–1903): a charged body's field adds to its inertia. Poincaré (1900):
to save the center-of-mass theorem when a body emits light, treat the
radiation as a "fictitious fluid" with mass $E/c^2$. Hasenöhrl
(1904–1905): the radiation inside a moving cavity adds to the cavity's
mass, with a factor he later corrected and which was still not the final
story. Paper 3, §8: a light complex's energy transforms exactly like its
frequency (admitted with provenance).

**The nagging fact.** A body that emits light in one direction recoils. If
it emits equal pulses in opposite directions it does not recoil, and yet
something about its motion has changed, because the two pulses carry
different energies to a moving observer.

**The first honest question.** If I already know how the energy of a light
pulse changes between frames, what does energy conservation force me to say
about the body that emitted it?

**The chain (front door, ME-01, ME-02).** The two ledgers (§8.4); the
subtraction that removes the unknown internal energies; the stated premise
about the additive constant; the low-speed expansion with its domain made
visible at $0.6c$; the limiting coefficient $L/c^2$; the general statement
that the mass of a body is a measure of its energy content. *Fork.* (a)
The center-of-mass theorem fails for radiation and needs a fictitious fluid
(Poincaré 1900), worked honestly as an empirically equivalent bookkeeping
within its scope; (b) energy has inertia.

**Check it against the world (ME-03).** Radium, with cards; the Sun; coal;
the candle. The first quantitative nuclear check (Cockcroft and Walton
1932; Bainbridge 1933) is a timeline card.

**The side door (the 1906 box, for programmers).** Simulate the box; the
shift appears; labeled 1906 with the credit to Poincaré. **The no-algebra
door.** Two accounting sheets and one subtraction (§7.2).

**Exercises.** Compute the mass lost by a 100 W bulb in a year; show the
$\cos\phi$ cancellation; compute the recoil of the box; explain why the
equal-and-opposite emission was chosen; explain which subtraction removes
the unknown internal energy and which premise makes it useful; explain
what the finite-speed proxy is and is not.

### 9.6 Cross-journey exercises and the connections

- Determine $N$ three ways from the year's work and compare (the Avogadro
  lab, §14.2).
- Show that the Doppler factor and the boost eigenvalue are the same
  number, and say why.
- Use paper 1's quantum energy and paper 4's relation to give a photon an
  "effective mass" $h\nu/c^2$, then explain in the margin why that phrase
  is discouraged today. Do not require quantum light packets to understand
  the September paper; its pulses need only the radiation-energy
  transformation, and the quantum paper's inference does not establish
  special relativity.
- The two statistical papers: macroscopic observations constrain
  microscopic descriptions, but the premises and conclusions are not
  identical; explain the difference.

---

## 10. The Instrument Catalogue and Its Acceptance Contract

### 10.1 Every instrument needs an answerable question

An instrument is not accepted because something moves. Its specification
contains an explanatory question, linked source and argument ids,
independent parameters, derived quantities, model assumptions, an admitted
domain, a computational owner, a representation mapping, accessible
equivalents, what it does not model, and tests that demonstrate the
intended relationship. All core rows below are part of complete-paper
scope. They share engines, renderers, and layouts; the table is not a
demand for one bespoke component or WASM binary per row.

Kernel-source labels, shown in plain words with an expandable model note:
"Ideal model, computed with FrankenSim" (an accepted call to the
registered owner stepped this snapshot), "Ideal model, host calculation"
(the audited TypeScript reference evaluator; closed-form physics is not a
deficiency, the papers are closed-form), "Static worked example," and
"This experiment is unavailable on this device." A loaded WASM file does
not earn the FrankenSim label; only an accepted result does.

### 10.2 Core instruments

| ID | Instrument | Principal controls or actions | Required observable / acceptance | Modes and probes |
|---|---|---|---|---|
| LQ-01 | Wave description and energy spreading | Amplitude, phase, observation region | Intensity follows the declared field model; a continuous representation is never misrepresented as a particle proof | Stage A of Journey I |
| LQ-02 | Classical mode-energy allocation | Temperature, frequency cutoff, mode bands | Integrated energy responds to the cutoff; dimensions and historical status explicit; the unbounded total is a refusal, not a clamp | Avogadro-from-Planck readout with Planck's printed constants **[6.17e23]** |
| LQ-03 | Radiation spectrum and regime comparison | Temperature (500–10 000 K), frequency or wavelength axis, log or linear, selected band | Band energy invariant under correctly transformed spectral coordinates; Wien and classical limits with explicit relative-error criteria; digitized historical points distinct from curves | Wien shading by $h\nu/k_BT$ |
| LQ-04 | Radiation entropy workbench | Accessible volume ratio, fixed energy, frequency band | The logarithmic volume dependence changes coherently across formula and graph; outside-domain states refuse with an explanation; $C(\nu)$ handled as in §8.1 | Probe: coincidence with the gas law iff the coefficient is $E/(h\nu)$ |
| LQ-05 | Independent configurations | Particle count (1–60), subvolume fraction, enumeration or sample view | Exact small-case probabilities match $f^n$; rare events on honest log scales; the locked-positions counterexample | Seeded, replayable |
| LQ-06 | Match the entropy coefficients | Compare expressions; propose a correspondence | The reader identifies the effective count and can inspect the heuristic step separately from the algebra | The move of Journey I |
| LQ-07 | Fluorescence energy budget | Incident frequency, allowed output channel, extra-energy assumption | No hidden energy creation; the assumptions behind Stokes-type restrictions inspectable; the anti-Stokes caveat | §7 inequality |
| LQ-08 | Photoelectric apparatus | Frequency (100–2 000 THz), power, work function (hypothetical 1–6 eV; named metals only with cited presets), collector potential | Energy and count respond differently; below-threshold states show no emitted electron rather than negative energy; the sign conventions of §8.1 | Millikan 1916 overlay (dated); Einstein's printed 4.3 V; intensity changes count not $K_{\max}$ |
| LQ-09 | Ionization bounds and counts | Incident energy, idealized threshold, absorbed fraction | Correct bounds and counts under the stated idealization; no invented material rates | §9 bound |
| BM-01 | Tracer ensemble and observable selection | Seed, observation interval, ensemble size (1–10 000), statistic, dimension (1D marginal / 2D projection / 3D) | A vanishing signed mean visibly compatible with growing spread; paths leaving the viewport stay in the ensemble; render cadence never changes the experiment | The velocity trap (apparent speed $\propto\tau^{-1/2}$); real-time toggle with scale bar; Einstein's printed 0.8 $\mu$m |
| BM-02 | Osmotic partition | Particle count, volume, temperature | Number-density pressure and mechanical interpretation agree; dilution assumptions visible | §1 |
| BM-03 | Configuration integral | Number of independent coordinates, accessible volume | The volume factor and logarithmic free-energy term emerge stepwise without molecular dynamics | §2 |
| BM-04 | Drift–diffusion balance | Weak force, gradient, mobility, temperature, kicks on/off | Drift and diffusive flux cancel at equilibrium and determine the same $D$; the force drops out; Nägeli's branch relaxes nothing | §3 |
| BM-05 | Random steps to diffusion | Step distribution, scale, observation interval | Symmetry removes the first moment; the second moment sets $D$; invalid limits explained | §4; `brownian_frames` |
| BM-06 | Gaussian spread | Diffusivity, time, integration interval, dimension | Normalization and $2dDt$ hold; density and probability not confused; point distribution at $t = 0$ as an analytic limit; radial law in 2D | §4; `diffusion1d_frames` beside the histogram |
| BM-07 | Infer the molecular number | Observation set, calibration, radius, viscosity, estimator choice | A dimensionally correct estimate with the stated interval and noncircular data provenance; identifiability shown first | Synthetic inverse exercise; historical data (Perrin 1909); the kitchen real-data mode (§7.9) |
| BM-08 | Measurement bias | Drift and independent localization error in the admitted model; optional exposure model | Bias changes the estimator in the predicted direction; the independent-increment interval is disabled when its assumptions fail; complex models are not faked | Berglund covariance fixture |
| SR-01 | Clock synchronization | Clock separation, offsets, signal events | The event ledger implements the specified procedure; reception and remote-event time distinct | §1; desynchronization $vL/c^2$ |
| SR-02 | Magnet/conductor descriptions | Frame selection, prescribed motion, declared dipole case | Equivalent modeled observables with different field descriptions; qualitative apparatus not mistaken for a solved field | Introduction and §6 |
| SR-03 | Rod measurement and simultaneity | Frame speed, endpoint-event selection, event pairs | Only frame-simultaneous endpoint pairs are credited as length measurements; the 10-light-second fixture | §§2, 4 |
| SR-04 | Construct the Lorentz map | Candidate coefficients, light trajectories, inverse test, scale factor | Constraints reveal the remaining freedom and the admissible map; no answer preinstalled as a constraint; matrix, determinant, eigenvectors, rapidity as labeled aids | §3; Galilean shelf step |
| SR-05 | Light clock and moving clocks | Relative speed, clock geometry, chosen worldline | Proper and coordinate intervals agree with the model; clock histories retained across view switches; equator note with its limit | §4 |
| SR-06 | Velocity composition | Frame speed, particle velocity vector | Inverse and low-speed checks; null velocity stays null; $U < c$; non-collinear cases produce a rotation | §5; Fizeau shelf |
| SR-07 | Transform the field equations | Select derivative or component; reveal each algebraic step | Every chain-rule and substitution step has a reason, with validated signs and unit conventions | §6 |
| SR-08 | Electric/magnetic frame change | Field components, boost, test-charge state | Field invariants and compatible force descriptions agree within declared tolerance; observer change never restarts the experiment | §6 |
| SR-09 | Doppler and aberration | Boost speed, propagation angle, frequency | Wavefronts, detector count rate, angle, and formula consume the same state; the 0.6c fixtures | §7 |
| SR-10 | Finite light complex | Boost, propagation direction, selected bounding surface | Energy-density and volume factors combine to the light-energy transformation; the transverse-ray fixture | §8 |
| SR-11 | Moving mirror | Mirror speed, incidence direction, intensity | Reflection and energy/momentum accounting respect interception geometry and the prescribed idealization; the quarter-frequency fixture | §8 |
| SR-12 | Charge/current density | Density, current components, boost, integration view | Continuity and transformations consistent; neutral current-carrying cases accepted | §9 |
| SR-13 | Electron work and deflection | Prescribed fields, initial state, interval, force-convention toggle | Work/energy and deflection relations match the model; the two transverse coefficients shown as different definitions; excluded effects explicit | §10 |
| ME-01 | Opposite pulses and two ledgers | Emitted energy, boost, emission-axis angle | Individual pulse energies vary; the sum and both balances remain consistent; internal energies stay symbolic | The paper's argument |
| ME-02 | Inertia from the small-speed coefficient | Boost range, exact/approximate/proxy view | Quadratic approximation converges in its domain; limiting evaluation stable near zero; the 0.25L vs 0.18L fixture | The move |
| ME-03 | System-boundary energy ledger | Include/exclude body and radiation; retain/release energy; cited energy-source cards | Internal transfer and escape distinguished; closed-system accounting coherent; a card without a citation refuses | Radium, Sun, coal, candle; the 1906 box as a labeled extension |

Optional modern deep dives follow the core and never substitute for a
missing core row: an underdamped Brownian comparison (1908), finite-exposure
inference, optical appearance versus coordinate geometry, rapidity and
non-collinear boost composition, four-momentum, and later experimental
confirmations. Shelf instruments (Michelson–Morley with and without
contraction, Fizeau's water, the Galilean map on a light ray, the classical
cutoff) live on the 1904 desk.

### 10.3 Parameter design and constraint handling

Each control declares physical dimension, display unit, valid model
domain, numerical domain, pedagogical default, step or logarithmic mapping,
and whether it is independent or derived. One schema generates controls,
URL-state validation, unit formatting, and test cases. Suggested teaching
ranges, to be admitted by the owners: radiation temperature 500–10 000 K
with logarithmic frequency controls over $10^{11}$–$10^{16}$ Hz;
photoelectric work function 1–6 eV hypothetical; photoelectric frequency
100–2 000 THz; Brownian radius 0.1–5 $\mu$m in the dilute-sphere model;
Brownian viscosity 0.5–20 mPa·s as an explicit fluid parameter (changing
temperature does not silently supply an unmodeled viscosity law; a gas
card refuses because Stokes drag without the Cunningham slip correction is
invalid when the mean free path is comparable to the radius); Brownian
temperature 273–330 K; frame speed signed $v/c$ within $\pm0.95$ in the
core, no inertial observer at $|v| \ge c$; emitted energy a positive
pedagogical range plus normalized ratios; sample count and time horizon
explicit and finite, with memory or time budget failure distinct from
physical invalidity.

Users may type exact values as well as drag. Out-of-domain inputs explain
the problem and offer an admissible boundary or a model change; they are
never silently clamped while the label displays the requested value. A
control's visual range may be narrower than the mathematical domain; the
two are documented separately.

### 10.4 Multiple ways to interact, and an executable coverage ledger

Sliders suit continuous parameters and nothing else. Use event selection
for simultaneity, interval selection for integrals, draggable partitions
for volume, coefficient manipulation for transformations, channel selection
for energy balances, and expression-level actions for derivations. A scene
begins with a useful question and a stable default, not a dense control
panel; advanced controls sit in an "Experiment settings" drawer. Every
reset restores both parameters and the relevant experiment history, with
"same seed" and "new trial" explicit.

For every source argument node, the coverage ledger records its
explanation, instrument or static treatment, numerical binding where
applicable, accessibility equivalent, and acceptance scenario. An omitted
treatment needs a written reason, not a blank cell. Translation
completeness, instrument availability, review approval, and empirical
validation are never aggregated into one flattering score.

### 10.5 The same scientific action through different interfaces

Every core instrument exposes an **action contract**: an action names its
inputs, the question it changes, the accepted result, and the equivalent
operation without dragging, color discrimination, sound, or a visual
canvas.

| Instrument family | Visual action | Equivalent scientific action |
|---|---|---|
| Probability and diffusion | Drag a selected histogram interval | Enter lower and upper limits, inspect interval probability, compare two named intervals |
| Clock and event geometry | Select points on a diagram | Choose named events from a table and ask which frame regards them as simultaneous |
| Radiation entropy | Resize the constrained-state volume | Enter a ratio or choose half/same/double, with fixed energy and band stated |
| Fields and boosts | Rotate an arrow or move an observer | Select an axis or component and signed magnitude, then inspect transformed components at the same event |
| Energy accounting | Drag a boundary around objects | Select the objects included in the system and inspect energy crossing that boundary |
| Derivations | Highlight and transform part of an equation | Select a named subexpression, read its role, and advance a justified step |

A long prose description alone is not equivalent to being able to
investigate. Conversely, no screen-reader user is forced through every
particle coordinate: summaries, selectable comparisons, and optional
detailed data at the scale of the question.

### 10.6 A scientific result is not always a number

Acceptance cases exist for **not enough information**, **outside this
model**, **a valid limiting state**, and **two hypotheses indistinguishable
under this observation**. BM-07 explains that a diffusion measurement
cannot separately identify radius and molecular number without more
information; ME-01 knows the change in body energy without knowing an
absolute zero; LQ-04 declines a dense-radiation state while explaining why
the approximation fails; BM-06 shows a point distribution at $t = 0$. Each
result offers a useful next action without inventing a value (§11.4).

### 10.7 Contract additions beyond the donor's

Every instrument also: declares what it does not model (`notModeled`,
shown as a plain line; an empty list fails the audit); has predict mode
(§7.7) or a recorded exemption; shows its code (§7.8); is shareable by
permalink (the accepted snapshot's identities and the compact valid control
tape serialized into `?tape=`, with bounded size, never a canonical
document URL per slider position); is embeddable at
`/embed/lab/[experiment]` with attribution, a link back, and respect for
detail, theme, and reduced-motion parameters; overlays historical data only
as typed, cited `HistoricalDataset` records (launch set: Millikan 1916
sodium, Perrin 1909, Bucherer 1908, Bancelin 1911, Lummer–Pringsheim and
Rubens–Kurlbaum 1899–1900, Kaufmann 1902–1906, Ives–Stilwell 1938, Fizeau
1851, each with table or figure number, digitizer, and uncertainty); and
can run at true physical rate with a scale bar where a natural rate exists
(the walk at $0.8\,\mu$m per second beside the sped-up version).

### 10.8 Keep the catalogue finite; deepen the instruments

The core rows are the launch coverage obligations. No-algebra entrances,
nonvisual actions, guided prediction, side-by-side comparisons, and
assumption inspection are cross-cutting capabilities of those rows, not
additional laboratories. Additional work earns priority by resolving an
observed misunderstanding or enabling a missing source argument. A new
color theme, camera preset, or duplicated wrapper is not another
scientific instrument.

### 10.9 Three.js scope

Three.js is a presentation tool, not a scientific authority. Use it only
where the mechanism is spatial and 2D genuinely loses information: the
sphere measured as an ellipsoid with a clock (SR-03/SR-05 studio), field
lines in two frames (SR-08), the box (ME-03 extension), and an optional
spacetime block view (later). Everything else is SVG or Canvas. Do not
build a 3D scene for a one-dimensional random walk. Rendering detail and
model fidelity are independent settings: a body may be rendered richly
while its governing experiment is a simple analytic ledger.

---

## 11. The Content Model and Compiler

### 11.1 Typed content, not hand-assembled page blobs

The corpus is declarative and reviewable: structured source blocks,
translation units, alignment, notation mappings, argument nodes, foundation
lessons, experiment manifests, scenarios, historical premises, datasets,
and citations live in text files with schemas (JSON or YAML, plus
constrained Markdown for long prose; executable MDX is not the interchange
format). A build-time compiler joins those records into route-local
payloads, validates structure, renders static mathematics, and emits the
smallest serializable subset a client component needs. Functions, runtime
objects, and untrusted JavaScript do not belong in content files. Avoid a
giant `allEinsteinContent.ts` imported into client components.

### 11.2 Entities

| Entity | Required identity and semantics |
|---|---|
| `Paper` | Slug, bibliographic key, German and English titles, author line, dates by type, journal record, ordered source block ids, companion flag |
| `SourceAsset` | Origin URL, acquisition date, SHA-256, MIME type, page mapping, rights status and statement, local publication decision |
| `SourceBlock` | Immutable id, kind (masthead, heading, paragraph, equation, footnote, closing), diplomatic transcription, source locator (PDF page, printed page, region), original label, editorial label namespace, review state, sentence spans |
| `TranslationUnit` | Stable id, one or more source-block references, English text, translator and editor attribution, revision, unresolved alternatives |
| `Alignment` | Explicit many-to-many relation between source spans and translated spans; no reliance on matching paragraph counts |
| `GlossUnit` | Word-level German-to-English gloss for a sentence, attributed |
| `EditorialNote` | Author, claim, source support, note kind (historian's margin, correction, typographical, dispute, side note), affected blocks, review state |
| `HistoricalPremise` | Proposition, availability date or range with `latestYear`, original evidence, Einstein-knowledge evidence when claimed, availability status (available / parallel-work / later), admitted discovery stages |
| `ArgumentNode` | Question, premises (with edge types), conclusion, logical role, derivation steps, source support, limitations, prerequisites, coverage obligation |
| `Equation` | Semantic expression tree; source and modern notation forms; term and operation ids; canonical quantity bindings; derivation links; numerical bindings; printed number; spoken form; readings (R0–R3) |
| `Quantity` | Canonical id, dimension (rational exponents), mathematical kind (scalar, vector, density, total, angular vs cyclic, coordinate vs proper, laboratory vs comoving, measured vs latent), frame, reference conditions, permitted units, formatting |
| `Foundation` | Learning objective, compact and full explanations, worked example, instrument, prerequisites, stopping point, backlinks |
| `Misconception` | Tempting claim, why tempting, what is true (R0–R3), instrument, anchors, sources |
| `Experiment` | Parameter schema, owner capability, model domain, outputs with statuses, views, default scenario, provenance, `notModeled`, acceptance cases, tape model identity, embeddable flag, predict-mode flag |
| `Scenario` | Exact initial conditions, seed policy, actions, expected invariants, results, or refusals, model and schema versions; golden and adversarial |
| `HistoricalDataset` | Title, full citation with table or figure number, digitizer, date, columns with units, rows, uncertainty, notes |
| `Tour` | Ordered anchors with a budget label and a completion statement |
| `Citation` | Bibliographic record with role (primary, comparison witness, secondary, technical) |

The TypeScript types that back these entities extend the donor's
`CuratedSpecificationInline` and `CuratedSpecificationBlock` with `math`,
`footnote`, `footnote-mark`, and `closing` kinds; the donor's
`ColorizedEquation` is replaced by an `Equation` whose `patentId` field is
omitted and whose LaTeX forms are generated from the expression tree; the
donor's `PhysicsControl` is reused as the control schema with the added
domain fields of §10.3.

### 11.3 Stable ids and revisions

Once published, source-block ids never change because a paragraph is
inserted into an explanation or split for translation. Allocate permanent
ids and maintain explicit aliases for retired or split nodes; a revised
claim gets a revision and lineage, not a new meaning hidden behind an old
hash. A translated paragraph can map to multiple source regions;
highlighting and deep links tolerate that. Anchors (§6.9) are content ids,
never array positions.

Separate `contentRevision`, `sourceAssetDigest`, `translationRevision`,
`modelVersion`, and `artifactDigest`. A changed annotation does not change
the physics; a changed physics model does not change which passage was
translated.

### 11.4 Equations: an expression model with authored bindings

Maintain a semantic representation of mathematical structure: symbols,
operations, relations, powers, fractions, integrals, derivatives, sums,
vectors, matrices, piecewise conditions. Generate plain and colorized LaTeX
in each notation from it where practical; for source-faithful exceptional
typography allow an explicitly authored LaTeX form with validated semantic
term bindings. Never infer meaning by replacing every occurrence of a
letter in raw LaTeX: the same symbol means different things in different
sections, and a letter can appear in a command name, exponent, subscript,
or annotation.

The compiler checks that every live term references an exact canonical
quantity id, every explanation references an existing term, and every
computed displayed output has an admitted owner. Human labels such as
"energy" are not API keys. The site does not need a general computer
algebra system at launch: an authored derivation graph with a small, tested
set of transformation rules is more tractable and more auditable, and
numerical spot checks help but cannot prove arbitrary symbolic
equivalence.

**Four kinds of meaning stay separate** on every argument node, equation,
and displayed quantity, and are never compressed into one color:

- **Logical role:** definition, assumption, derivation, heuristic
  inference, empirical observation, qualification.
- **Historical status:** available before the cutoff, introduced in the
  current paper, later development, pedagogical reconstruction.
- **Model status:** exact within the stated model, approximation,
  idealized representation, calibrated empirical model, unsupported
  outside the domain.
- **Execution status:** static illustration, host calculation, accepted
  FrankenSim/WASM result, unavailable or refused.

**Typed results beyond numbers.** Every output carries a status:

| Status | Meaning | Example |
|---|---|---|
| `value` | A finite result with units, semantic kind, owner, and uncertainty metadata where applicable | An admitted diffusion coefficient |
| `symbolic` | A relation whose unspecified symbols remain explicit | An absolute internal energy in the historical ledger |
| `analytic-limit` | A defined limit with its own representation | The point distribution at $t = 0$; the mass coefficient at $v = 0$ |
| `underdetermined` | The admitted information does not select a unique value | Radius and molecular number from diffusivity alone |
| `not-applicable` | The quantity is not defined for this model and question | A stopping potential when no electron is emitted |
| `outside-domain` | The model does not support the requested conditions | A Wien-only entropy comparison in a dense state |

Transport errors, allocation limits, worker cancellation, and missing
artifacts are separate **execution outcomes**. A model refusal is not a
numerical zero; a budget refusal is not a physical impossibility. A
snapshot may contain valid outputs plus honestly unknown ones if its model
permits partial results; it never mixes quantities from different input
revisions to fill gaps. Each lesson explains statuses in ordinary language;
enum names never leak into the reader's view as cryptic warnings.

### 11.5 Scoped semantics beyond integer units

The upstream quantity model represents base-dimension exponents as
integers, which suits admitted runtime quantities. The authoring validator
must handle roots deliberately: $\sqrt{Dt}$ has length dimension because
the radicand has squared-length dimension, and a fractional exponent is
never truncated during a check. Use exact rational dimension arithmetic in
the validator, or return an explicit unsupported-check status; map an
expression to the upstream runtime model only after dimensions and
operations are resolved. This is a validator for expressions, not a
competing units library. A source expression beyond the validator's
capability still requires review; it neither becomes dimensionally correct
by default nor gets removed from the historical text.

Track semantic distinctions that dimensions cannot settle: cyclic versus
angular frequency; a spectral density versus a total; coordinate time
versus a proper interval; laboratory versus comoving force; mean square
versus variance; measured versus latent position. Frame and observation
identities belong on quantities, not only in captions.

### 11.6 Proof routes, rendering routes, and the historical edge type

An argument can have several valid proofs. Each proof has an ordered
dependency graph, stated entry assumptions, logical move types, and a
mapping to source passages; the graph must be acyclic. The broader network
of cross-references may have cycles; a glossary link is not a logical
premise. Separate **historical derivation dependencies** from **modern
verification oracles** by edge type: a Lorentz-transform test may use
interval preservation without making Minkowski geometry a premise of the
1904 route, and the compiler detects the distinction from edge types
rather than prose. A rendering route selects authored representations and
guidance around a proof; it cannot silently change the proof's
assumptions, and when an explanatory shortcut changes the scope of a
conclusion the record says so and provides the bridge.

### 11.7 Compiler checks worth building

The first compiler rejects: duplicate ids; missing source blocks; broken
alignment edges; unresolved equation symbols; dimension mismatches in
supported expressions; invalid parameter dependencies; cycles in a selected
proof's prerequisites; dangling citations; impossible date ordering
(received before dated, published before received); a discovery step
citing a premise whose `latestYear` exceeds the cutoff without the
parallel-work or admitted-1905 flag; missing accessibility alternatives;
missing `notModeled`; unsupported math commands; experiment references
without an owner or explicit static status; an English equation block that
is not byte-identical to its aligned German block; a paper marked complete
while required source blocks or explanation obligations are absent; a
misconception ledger with fewer than five entries; a hero quote that does
not resolve to the edition text at its anchor; an instrument whose live
terms do not appear as identifiers in its pinned kernel source.

It flags rather than resolves: translation ambiguity, historical influence
claims, approximation claims, source disagreements. Passing a schema is not
evidence of a correct translation or good teaching.

### 11.8 Machine-readable access without a new product

Generate compact, stable JSON and Markdown representations of each paper,
section, argument node, equation, and experiment manifest for indexing,
agent-assisted review, citation, and future integrations. The HTML remains
canonical for people. No API platform, authentication, or database is
needed to serve a four-paper corpus.

---

## 12. Physics Architecture, Runtime Protocol, and FrankenSim Binding

### 12.1 The ownership rule

A reusable physical or numerical law belongs in FrankenSim. A source
passage, teaching prompt, historical annotation, visual metaphor, or
sequence of discoveries belongs in Annus Mirabilis. The browser boundary
composes generic capabilities into bounded educational experiments. Do not
create four physics engines named after the papers: Brownian diffusion
should be useful to other projects; Lorentz transformations should be
reusable beyond this site; radiation spectra and idealized energy-transfer
laws should not be buried in a React component.

### 12.2 Capability audit before naming crates

The first physics task is a bounded audit and build probe: identify
existing owners for the precise mathematical functions, examine their
contracts and tests, compile the needed dependency slice for native and
browser targets, and record the actual exports. Crate names such as
`fs-frame`, `fs-flux`, `fs-lattice`, or `fs-spectral` do not establish that
they implement spacetime frames, moving-conductor electromagnetism,
Brownian dynamics, or Planck spectra (the audit already found that
`fs-lattice` is infill optimization and `fs-flux` is Navier–Stokes).
Inspect semantics before reuse; do not create a new crate merely because a
suitable owner has a less obvious name. The `fs-rand` design is especially
valuable: logical stream identity, not thread scheduling, determines the
draws; preserve its stream-semantics version in replays, and choose
deliberately between its strict distribution paths and any faster path
awaiting stronger admission.

### 12.3 Proposed generic capabilities (to implement upstream)

The names describe new or extended capabilities, not existing APIs; final
placement follows the ownership audit.

| Capability family | Minimum useful surface | Likely owner decision |
|---|---|---|
| Radiation spectra | Frequency and wavelength spectral densities with the Jacobian; band integrals; Wien and classical limits; stable scaled evaluation | Extend a thermal/radiation owner or propose a narrow `fs-radiation` |
| Idealized quantum energy transfer | Single-quantum energy budget, threshold emission, fluorescence and ionization bounds, declared yield models | Module beside radiation; not a quantum-material solver |
| Diffusion and stochastic transport | Constant-coefficient free diffusion, Gaussian transition, seeded ensembles (`brownian_frames`), moments, drift–diffusion, Stokes–Einstein, the explicit 1D stepper (`diffusion1d_frames`) | Extend an existing transport owner or propose a focused `fs-diffusion` / `fs-stochastic` |
| Diffusion inference | Independent-increment estimator with chi-square interval, inverse-parameter bias, labeled observation-error and exposure models | Audited statistical primitives; no automatic promotion of correlated data into a valid estimate |
| Flat-spacetime kinematics | Inertial frames, exact aligned boosts, event transforms, interval classification, velocity composition, worldline sampling, clock and rod measurements | A generic relativity owner if none exists; a structural-frame crate is not assumed suitable |
| Relativistic electrodynamics | Prescribed-field transforms, plane-wave phase, light-energy transforms, the ideal mirror, charge and current transforms | Reuse the relativity core and audited field primitives; no full Maxwell solver for analytic cases |
| Prescribed-field particle dynamics | Work and energy, electric and magnetic deflection in prescribed fields | Tested integration primitives; radiation reaction and self-fields excluded |
| Relativistic energy accounting | Symmetric emission, two-frame ledgers, stable low-speed expansion, four-momentum extension | Generic operations in the relativity owner |
| Evidence and uncertainty | Quantity-specific provenance, numerical verification, input uncertainty, refusal reports | Adapt upstream evidence semantics; never equate a computed value with validation |

The benefit is concrete: the site improves FrankenSim's reusable numerical
capabilities, and Classic Patents can later reuse radiation, statistical,
or field tools without importing an Einstein-specific UI.

### 12.4 The first concrete exports and the narrow adapter

`fs-wasm` already depends on `fs-rand` and `fs-sparse`, so the first three
exports are small and can land immediately, ahead of the broader owners:

```rust
// crates/fs-wasm/src/lib.rs (additions; feature-gated into the slim artifact)

/// Deterministic 1D random-walk trajectories for `n_particles` over `steps`
/// intervals; step kernel `kernel` (0 = ±1 coin, 1 = uniform, 2 = Gaussian,
/// 3 = Gaussian with the exact D so that <x^2> = 2 D t). fs-rand Philox
/// streams keyed by (seed, particle index) so any particle can be
/// regenerated independently. Returns [n_particles * (steps + 1)] positions.
/// No std::time on wasm32.
pub fn brownian_frames(n_particles: usize, steps: usize, kernel: u32, seed: u64, diffusion: f64, dt: f64) -> Vec<f64>;

/// Philox-stream standard-normal samples for the configuration counter and
/// the inference laboratory's synthetic generator; stream (seed, index).
pub fn philox_normals(seed: u64, index: u64, count: usize) -> Vec<f64>;

/// Explicit (FTCS) 1D diffusion on `n` cells with spacing `dx`, coefficient
/// `diffusion`, time step `dt`, initial profile (0 = spike, 1 = step,
/// 2 = two spikes), zero-flux boundaries, via the fs-sparse three-point
/// Laplacian. Returns `frames * n` values. If diffusion*dt/dx^2 > 0.5 the
/// scheme is unstable and the function returns a typed refusal (empty
/// buffer plus code), never a blown-up field.
pub fn diffusion1d_frames(n: usize, frames: usize, steps_per_frame: usize, diffusion: f64, dx: f64, dt: f64, profile: u32) -> Vec<f64>;
```

The existing `heat_frames` is not used (§2.2). All three compile natively
(rlib) and to wasm (cdylib), get tests in `crates/fs-wasm/tests/`, and are
shipped through a **narrow adapter** rather than the whole `fs-wasm`
dependency graph: a feature-selected small bundle per capability (radiation,
diffusion, relativity) built the way the donor builds its slim
`fs-generic` artifact. A composition and transport boundary such as
`fs-annus-wasm` may expose versioned experiment operations and serialize
results and refusals; it must not contain a second copy of the laws owned
by the generic crates. Begin with a single-threaded browser target; threads,
shared memory, SIMD specialization, and GPU compute are optimizations that
earn their complexity through measurements. Rendering can use the GPU
while scientific computation remains deterministic CPU/WASM.

Establish one native test target and one single-threaded browser target
for the Brownian slice, with exact upstream revisions and sibling
dependencies (the native workspace uses sibling dependencies and
constellation checks; a fresh build establishes those prerequisites). Add
another capability only when a named instrument uses it. The site does not
wait for unrelated FrankenSim crates to compile for the browser.

Rust policy: safe Rust for new numerical code with `forbid(unsafe_code)`
where compatible; no C/C++ physics libraries, hidden FFI solvers, or a
competing numerical ecosystem; reuse asupersync and the owner's Franken
libraries where they fit; the browser package's target-specific
`wasm-bindgen` and `getrandom` dependencies are an observed packaging fact,
not permission to expand runtime dependencies freely. Scientific random
draws use the recorded logical seed; ambient browser entropy may choose a
new seed only through an explicit "new trial" action and is then recorded.
Pin the Rust nightly, upstream commits, constellation revisions, generated
glue, and lockfiles.

### 12.5 One accepted snapshot per experiment

Every laboratory instance has a unique instance id even when two instances
show the same experiment. A single owner advances or evaluates that
instance. All plots, equations, scene geometry, tables, and accessibility
summaries consume the same accepted snapshot. React components never
independently recompute diffusion, transformed coordinates, or emitted
energy from slightly different parameter copies; they format quantities
and project accepted coordinates into pixels. Numerical truth has one
owner.

The runtime distinguishes:

| Field | Meaning |
|---|---|
| `instanceId` | This mounted laboratory, independent of other copies |
| `runId` | This experiment realization or parameterized run |
| `inputRevision` | Latest requested physical input set |
| `acceptedInputRevision` | Inputs that actually produced the displayed result |
| `stepIndex` | Accepted logical solver or sample step, not a UI event count |
| `simulatedTime` | Physical or model time of the accepted state |
| `snapshotVersion` | Monotone publication identity of an immutable result |
| `renderTime` | Display or interpolation time; never a hidden physical input |
| `modelVersion` / `artifactDigest` | Mathematical implementation and exact executable identity |
| `seed` / `streamVersion` | Stochastic realization and random-stream semantics |

This replaces the donor's control-change tick, which is not physical time.

### 12.6 A change of description is not a change of world

The control classification is executable:

| Command class | What changes | What must remain stable |
|---|---|---|
| `setup-change` | Initial physical conditions or governing model | The old run stays identifiable; the new accepted run is explicit |
| `physical-intervention` | Conditions after a specified model time | Earlier accepted history |
| `observer-change` | Coordinate frame, origin, orientation, observer description | Physical worldlines, events, trial identity |
| `measurement-change` | Sampling, projection, exposure, calibration under an admitted observation model | The identified latent trajectory; the measurement result gets a new revision |
| `estimator-change` | Statistic, fitted model, inference assumptions | Selected observation data and their provenance |
| `presentation-change` | Camera, labels, layout, colors, explanation selection | Every scientific state and data identity |

Some controls need a clarifying choice: changing a camera's physical
exposure is a measurement change; moving the viewpoint of the rendered
microscope is presentation; a moving detector is a physical component, not
a frame choice. Name these in ordinary language and test their effects.
This prevents a serious conceptual bug (changing the frame speed in a
relativity explanation generating new events or restarting clocks) and
enables a strong teaching interaction: hold the world fixed and compare two
descriptions or measurements side by side. Observation cadence subsamples
an existing fixed logical path; it never consumes a different random stream
because the plot interval changed. For the initial Brownian implementation
use a declared replay grid and supported observation intervals on it; a
later hierarchical Brownian-bridge construction can permit path-consistent
refinement with its own tests and stream-version semantics. Equal seeds
alone do not guarantee a pathwise-consistent comparison between arbitrary
discretizations.

### 12.7 Request and response contract, worker behavior, memory

A request carries protocol version, experiment id, instance and run ids,
input revision, canonical SI parameters, model selection, constant-set
identity, seed policy, requested operation, and a finite work budget. An
accepted response carries the matching identities, accepted parameters,
simulated time or evaluation point, numerical outputs with dimensions,
semantic kinds, and statuses, model-domain information, and provenance. A
refusal carries a typed code, the affected inputs or capability, a readable
reason, and possible repairs. Large arrays use versioned typed-buffer
layouts with explicit dimensions and ownership; scalar summaries use
structured JSON. The decoder rejects nonfinite numbers in value fields,
wrong lengths, mismatched units, stale run ids, unsupported schema
versions, and unrecognized provenance; valid nonnumeric states use the
tagged forms of §11.4, never `NaN`, infinity, or zero. Use a typed shared
schema rather than concatenated untrusted JSON.

Load the numerical module in a dedicated Worker after the laboratory is
requested or about to become useful. Bound every work chunk; a
cancellation message cannot preempt an indefinitely running synchronous
WASM call, so long work yields between bounded chunks or uses a supported
interruption mechanism. Coalesce rapid slider requests; a new input
revision supersedes older pending evaluations; an old result never
overwrites the newest accepted run; a refused update preserves the previous
accepted snapshot while clearly distinguishing it from the requested
settings. Never display old numbers beneath new labels as if freshly
computed. Terminate and recreate a worker only as a bounded recovery path;
switching between 2D and 3D must not restart physics, duplicate the owner,
or consume new randomness.

Keep large particle buffers out of React state; reuse geometry and
buffers, use instancing where appropriate, and publish UI summaries at a
bounded rate; scientific stepping and display interpolation have separate
schedules. Handle WASM memory growth explicitly: a JavaScript view into
linear memory can become invalid after growth, so never retain such a view
across untracked reallocations; use copied or transferred immutable
snapshots or a versioned buffer-lifetime contract. Dispose of Three.js
materials, geometry, textures, subscriptions, and workers when their owners
end; pause invisible laboratories; limit concurrent heavy laboratories
while preserving replayable state. A depleted performance budget reduces
visual detail or pauses with an explanation; it never changes a model's
diffusivity or skips scientific time.

### 12.8 Snapshot publication and resource ownership

Use an instance-scoped external store per experiment with cached immutable
snapshots and a server snapshot consistent with the initial HTML;
`useSyncExternalStore` requires stable snapshot behavior, and manufacturing
a new object from the same state on every call is not acceptable. Treat
mount/unmount probes, repeated subscriptions, and route transitions as
normal: they must not create duplicate stepping owners, leak workers, or
advance randomness; mounting a second view subscribes to an existing
instance. Transferred buffers change ownership: never detach a buffer that
a published snapshot still promises to expose, and never reuse a mutable
buffer behind an "immutable" snapshot. A crash, context loss, or artifact
mismatch pauses the laboratory while the book remains usable; recovery
validates a checkpoint's model, schema, parameters, seed, and stream
semantics before continuation, otherwise begins a visibly new run. A
checksum is evidence of byte identity, not of compatible meaning.

### 12.9 Determinism, stated precisely, and fallbacks that do not lie

The required baseline is reproducibility for the same admitted model,
executable, parameters, constant set, seed, stream semantics, and logical
actions; rendering cadence and worker scheduling never change the
scientific state. The site does not promise bitwise identity across all
architectures, compilers, browsers, and fast-math modes merely because the
source is Rust. Specifically: the integer output of the Philox4x32-10
counter is reproduced bit for bit by a TypeScript port cross-checked
against vectors emitted by `fs-rand` (same `StreamKey` derivation); the
floating-point normal transform is compared native-versus-WASM and
WASM-versus-TypeScript at a stated tolerance, because elementary-function
implementations differ. Replay metadata records whether a comparison is
bitwise or tolerance-based. Fixed random goldens test stream semantics;
distribution tests test statistical properties; neither alone proves the
physical model.

The static reader and worked examples always remain available. A small
audited TypeScript reference evaluator provides an explicitly labeled
fallback for selected algebraic cases and for the walk and the 1D stepper
(the same FTCS scheme with the same stability refusal). A running
stochastic experiment is never switched between engines without a new
identified run and compatible replay semantics. Public wording is simple
(§10.1); detailed artifact and validation information sits in an
expandable model note. Never require SharedArrayBuffer or cross-origin
isolation for the first version.

### 12.10 Integer identity must survive JavaScript, JSON, and URLs

The upstream stream contract has 64-bit seeds and draw indices; JavaScript's
safe-integer range stops at $2^{53} - 1$. Encode unsigned 64-bit identities
as canonical decimal strings at JSON and URL boundaries, validate range and
syntax, decode with `BigInt` before the WASM boundary, and keep a documented
typed representation inside each runtime. Do not serialize `BigInt` through
ordinary JSON without explicit conversion, and never hash a rounded decimal
display of a seed. Tests cover $2^{53}$ and its neighbors, zero, $2^{64} - 1$,
invalid signs, whitespace, overlong input, and overflow; seeds copied
through the URL identify the same stream after reload. Define logical
stream allocations for latent motion, measurement errors, and independent
trials; a display-only subsample or a new plot never consumes draws from
the physical path; extending an ensemble preserves existing particle
identities under the declared allocation or explicitly identifies a new
experiment.

### 12.11 Tapes and teaching sequences

The donor's control tape is reused with the identities of §12.5: model
identity, seed and stream version, quantized control events classified by
command class, `prediction` events, and checkpoints with a digest (`host:`
until `fs-blake3` is bound, then `blake3:`). Authored teaching tapes:
"Einstein's 0.8 micron," "Perrin's count," "the boost to 0.6c," "the two
pulses," "the locked positions." A permalink carries a compact valid tape;
the scrubber restores it.

### 12.12 Layout of the kernels and reference evaluators

```
src/experiments/                 # instance controller, accepted snapshot, command classes, worker protocol
src/physics/reference/           # audited TypeScript reference evaluators (host calculation), one file per capability
├── radiation.ts                 # planck, wien, rayleighJeans, band integrals with Jacobian, wienEntropy with C(ν), lnW
├── photoelectric.ts             # kMax, stoppingPotentialMagnitude, threshold, count model; cited metal cards
├── diffusion.ts                 # stokesEinsteinD, mobility, gaussianPropagator, radialPropagator2d, moments, ftcs1d with refusal
├── inference.ts                 # independentIncrementEstimator, chiSquareInterval, inverseBias, driftCentered, exposureCovariance
├── philox.ts                    # Philox4x32-10 port, StreamKey derivation, cross-check vectors
├── kinematics.ts                # boost matrix, gamma, rapidity, compose (with rotation for non-collinear), contraction, dilation, desync, velocity transform
├── events.ts                    # event ledger, synchronization procedure, simultaneity classification, rod measurement with frame-simultaneous endpoints
├── fields.ts                    # E/B transforms, invariants, dipole field, EMF in either frame, four-current
├── waves.ts                     # phase transform, doppler, aberration, light-complex factors q^2 and 1/q, mirror with interception domain
├── electron.ts                  # prescribed-field work and deflection, both force conventions, frame-tagged forces
└── massEnergy.ts                # two-frame ledger with symbolic offsets, stable gamma-1, proxy vs limit, system boundary, cited cards
```

React never re-derives a number the owner emits; host-fed time through the
tick scheduler; no `Math.random` in any frame loop; a refusal is a museum
label and the last legal state is kept.

---

## 13. Numerical and Physical Verification

### 13.1 Verification is quantity-specific

For each numerical output, record the model, assumptions, dimensions,
independent reference, tested domain, error criterion, and relevant
evidence. An engine-wide "validated" badge cannot stand in for those
records. Separate mathematical identity checks, numerical convergence,
statistical calibration, comparison with observations, and historical
source fidelity; they answer different questions, and a failure names the
layer that needs repair.

### 13.2 Test lists by paper

**Radiation.** Dimensional consistency and the frequency/wavelength
Jacobian by matching integrated band energies; stable evaluation at small
and large arguments; the classical and Wien limits in their domains with
explicit relative-error criteria; band integration against an
independently implemented high-precision reference, not a second call to
the same routine; photoelectric threshold, frequency slope, power/count
separation, and complete channel accounting under the idealized model;
$\nu$ versus $\omega$; the entropy derivation retaining $C(\nu)$ and
checking the cancellation; Avogadro from Planck's printed constants.

**Diffusion.** Exact free-diffusion moments, normalization, unit
conversions, and $D \propto T/(\eta a)$; one-dimensional marginals and the
$2dDt$ total second moment separately; the radial law's normalization and
moments; the point distribution at $t = 0$; no manufactured time-step
convergence claim for an exact transition sampler, and real convergence
tests for the FTCS stepper and any drift approximation; reproducible
statistical test sets with prespecified tolerances and adequate sample
sizes (no rerunning a flaky test until it passes); unbiased and
intentionally biased inference fixtures; independent versus correlated
sampling; drift handling; the $2\sigma^2$ and $-\sigma^2$ localization
effects; radius and viscosity uncertainty; reflecting-box versus unbounded
comparisons kept distinct.

**Relativity.** Identity at zero boost; inverse round trips; composition
including the non-collinear rotation; null propagation; interval
preservation in the modern verification layer; low-speed limits; nonfinite
and superluminal refusals; active transformations, passive frame changes,
and sign conventions kept distinct; events that expose a simultaneity
mistake rather than only events at the origin; transverse fields; neutral
current-carrying configurations; ray directions near geometric boundaries;
field invariants $E^2 - c^2B^2$ and $\mathbf{E}\cdot\mathbf{B}$ as independent
checks; the mirror's stationary limit, admissible interception geometry,
transformed frequency and direction, and specified energy/momentum
exchange with the boundary type stated; electron analytic special cases and
work/energy balance with the frame of each force tagged.

**Mass–energy.** Opposite-pulse symmetry for arbitrary emission angle; both
frame balances; cancellation of direction dependence in the sum; the
quadratic low-speed coefficient; stable $\gamma - 1$; the distinction
between body-only and closed-system ledgers; the four-momentum extension on
a single massless pulse, two collinear pulses, and two opposite pulses,
with the invariant mass belonging to the system.

### 13.3 Historical fixtures and modern golden scenarios (kept distinct)

| Fixture | Input | Expected | Kind |
|---|---|---|---|
| Avogadro from Planck | Planck's $\alpha$, $\beta$, and $L$ as printed | $6.17\times10^{23}$ within rounding | Historical (paper 1 §2) |
| Stopping potential magnitude | $\nu = 1.03\times10^{15}$ Hz, $P = 0$ | about 4.3 V | Historical (paper 1 §8) |
| Mean displacement | $a = 0.5\,\mu$m, $\eta = 1.35\times10^{-3}$ Pa·s, $T = 290.15$ K, $t = 1$ s and $60$ s | $0.79\,\mu$m and $6.1\,\mu$m | Historical (paper 2 §5) |
| Molecular dimensions | Einstein's sugar data with $1 + \varphi$ and $1 + 2.5\varphi$ | $2.1\times10^{23}$ and $6.6\times10^{23}$ | Historical (dissertation 1905 / 1911) |
| Photoelectric neutral | $\Phi = 2$ eV (hypothetical), 600 THz | $K_{\max} \approx 0.4814$ eV; threshold $\approx 483.6$ THz | Modern golden |
| Brownian baseline | $T = 293.15$ K, $\eta = 1.000$ mPa·s, $a = 0.500\,\mu$m | $D \approx 0.42944\,\mu$m²/s; RMS $0.92676\,\mu$m at 1 s, $2.93066\,\mu$m at 10 s | Modern golden |
| Boost | $v/c = 0.6$ | $\gamma = 1.25$; $\det = 1$; eigenvalues 2 and 0.5; events 10 ls apart, simultaneous, map to $\Delta t' = -7.5$ s, $\Delta x' = 12.5$ ls | Modern golden |
| Composition | $0.6c$ then $0.6c$ collinear | $15/17\,c \approx 0.8824c$ | Modern golden |
| Dilation second order | $v/c = 10^{-4}$ | $\tfrac{1}{2}v^2/c^2 = 5\times10^{-9}$ | Modern golden (printed form) |
| Doppler | $\beta = 0.6$, along and against the boost | factors 0.5 and 2 | Modern golden |
| Mirror | $\beta = 0.6$ normal incidence | reflected frequency 0.25 of incident; intercepted power $IA_m(1 - \beta)$ | Modern golden |
| Transverse coefficients | $\beta = 0.6$ | $1.5625m$ (source convention) and $1.25m$ (laboratory) | Modern golden |
| Energy ratio vs Doppler ratio | any $v$, $\varphi$ | equal within $10^{-12}$ | Identity |
| Mass–energy | $v = 0.6c$ | exact $0.25L$; quadratic $0.18L$; the proxy exceeds $L/c^2$ by about $\tfrac{3}{4}(v/c)^2$ at small $v$ | Modern golden |
| Apparent speed | $\tau \to \tau/4$ | doubles | Identity |

Historical fixtures test that the site reproduces what Einstein printed
from his stated inputs; golden scenarios test calculations and plumbing
from modern constant sets; both are labeled separately from historical
measurements in data and UI. Each scenario specifies constants, units,
equations, owner, and tolerance.

### 13.4 Precision and uncertainty display

Choose precision from the question and the inputs; do not show twelve
decimals from a model whose viscosity is a rough estimate. Separate the
stored full-precision value, the formatted value, the input precision, the
statistical interval, and the numerical error estimate. Unit conversions
apply to sensitivities as well as values (a derivative per meter is not a
derivative per micrometer). Quantities that share dimensions can differ
semantically. When using upstream interval or evidence machinery, preserve
its actual assumptions: a probability confidence interval is not an
interval-arithmetic enclosure, and a simulation's numerical error bar is
not a measurement uncertainty. Choose tolerances per quantity and regime: a
relative tolerance alone is unsuitable near a true zero; an absolute
tolerance alone is unsuitable across orders of magnitude; null-interval
classification near cancellation may legitimately return an indeterminate
boundary classification. Any constant set carries its era, provenance,
precision, and dependency relations; in the modern set $R = N_Ak_B$, so
these are not three independent uncertain inputs.

### 13.5 Adversarial scientific fixtures

A small set of deliberately plausible wrong results, each of which must
fail for the intended reason:

| Plausible mistake | Fixture that exposes it |
|---|---|
| Half the diffusivity means half the displacement | Compare diffusivity and RMS scaling separately |
| A radial distribution is an ordinary Gaussian | Check normalization and mean/radial second moment with the correct measure |
| Camera noise leaves neighboring increments independent | Check the off-diagonal displacement covariance |
| An unbiased estimate stays unbiased after inversion | Check the ideal chi-square inverse moment and the asymmetric transformed interval |
| An arbitrary entropy-density constant cancels | Retain $C(\nu)$ while varying volume at fixed energy |
| A spectral-axis relabeling preserves density | Match integrated frequency and wavelength bands using the Jacobian |
| A light complex contracts like material volume | Test a transverse ray, where the packet-volume factor differs from $1/\gamma$ |
| Forces have equal numerical components in different frames | Compare source-convention and laboratory transverse coefficients at nonzero speed |
| Changing observer means starting a new experiment | Assert unchanged event, worldline, and run identities after a frame change |
| A moving mirror receives the fixed-surface incident power | Check intercepted power, reflected energy, and mechanical work together |
| The low-speed proxy is the exact mass coefficient at every speed | Compare the proxy with its limit and a deliberately non-small speed |
| A large seed can be carried as a JSON number | Round-trip adjacent identities above the safe-integer boundary |
| Radius = 1 $\mu$m reproduces Einstein's 0.8 $\mu$m | Check that only the 0.5 $\mu$m radius does |
| The locked-position probability is $f^n$ | Check that it is $f$ |
| A neutral conductor with current violates $|J/\rho| < c$ | Accept the case |

These are targeted tests of likely implementation and explanatory errors,
not a claim that the suite can prove all physics.

---

## 14. The Material Around the Papers: Learning How to Find an Idea

The explanatory material is substantial enough to stand as an original
book, but every excursion earns its place by helping the reader understand
an actual move in the papers. No ever-growing collection of loosely
related physics articles.

### 14.1 Methodological essays

Eight carefully authored chapters with links to exact argument steps and
instruments. They are contemporary methodological interpretations, labeled
as such, never a checklist attributed to Einstein; their value is transfer,
so that the reader recognizes the same moves in programming, measurement,
engineering, or another scientific argument without being told that all
discovery follows one algorithm.

| Essay | Concrete lesson | Anchors |
|---|---|---|
| What does a measurement really mean? | Replace an apparently obvious quantity with an operational procedure; distinguish recorded events from inferred descriptions | Clock synchronization; displacement observations |
| Change what you hold fixed | A new question often comes from comparing the same system under a different controlled variation | Radiation entropy at fixed energy and band; ensemble displacement at fixed elapsed time |
| Make two independent routes meet | Derive the same quantity from different premises and learn from their agreement | Osmotic pressure and drag versus spreading distributions |
| The useful part of an analogy | An analogy can identify a shared mathematical structure without equating two mechanisms | Dilute radiation and an ideal gas |
| Subtract away what you do not know | A difference can eliminate inaccessible internal quantities and arbitrary offsets | The two-frame light-emission argument |
| Ask what must stay unchanged | Track an invariant while changing a description; distinguish a symmetry requirement from a fitted coincidence | Light propagation, event transformations, phase |
| Take a limit without losing the claim | Know which conclusion survives an approximation and which does not | Wien regime; diffusion time scales; the low-speed kinetic-energy coefficient |
| Find the place your model stops working | A useful model has a context of use; a failed extension need not invalidate its legitimate predictions | Brownian short-time limit; ideal photoelectric assumptions; prescribed mirrors |

### 14.2 Connections among the papers (`/connections`)

A small, readable argument map, not a force-directed graph of every noun.
Links carry explicit meanings: "uses this result," "shares this
mathematical pattern," "offers a contrasting inference," "later modern
synthesis." Threads on the page:

1. **Boltzmann's principle, twice.** $S = k\ln W$ carries paper 1 (§§5–6)
   and underlies paper 2 (§2's free-energy argument).
2. **Counting atoms three ways: the Avogadro lab.** One instrument with
   three panels driven by three owners, one shared readout of $N$, the
   modern exact value drawn as a line (labeled defined, not measured), and
   a control for each panel's dominant uncertainty: Planck's $\alpha$; the
   measured $\lambda_x$ with its interval and the radius identifiability;
   the viscosity factor $1 + \varphi$ versus $1 + 2.5\varphi$ with
   Bancelin's data. The point: an unseen quantity became measurable from
   three unrelated directions within one year, and two of the three were
   at first wrong by known amounts.
3. **Light as the instrument: the light thread.** One light pulse examined
   by paper 1 (quantum energy), paper 3 (frequency and energy transform
   together), paper 4 (its energy has inertia). The thread says explicitly
   that the September paper does not need quanta and the quantum paper
   does not establish relativity.
4. **The one formula that leaves paper 3.** The §8 energy transformation
   is paper 4's only input; the equation genealogy crosses the paper
   boundary here.
5. **Einstein's own toolkit.** His 1902–1904 papers on the foundations of
   statistical mechanics as the private preparation for papers 1 and 2;
   summarized and cited, not reproduced.
6. **The Olympia Academy shelf.** Mach, Hume, Poincaré's *Science and
   Hypothesis*, Pearson, Mill, Spinoza, Dedekind, Clifford: what each
   contributed to the 1905 way of asking questions, with the caveat that
   influence is argued, not measured.
7. **What he got wrong or left open.** Transverse mass; the equator clock;
   the additive constant; the viscosity factor; the heuristic status of
   the quantum; the $\tau$ assumption. Collected from the margins so the
   reader sees that the year's papers were produced by a person.

### 14.3 Five shared instruments for reasoning

Shared modes around the core instruments, implemented first in the
Brownian slice and expanded only after observing their usefulness. None
requires a computer algebra system, an autonomous scientist, or a chat
service.

**The missing-step explorer.** A reader selects an unfamiliar transition
between equations or claims; the site shows the changed part, the rule
used, the physical premise if any, and one smaller worked case, using
authored transformations and exact subexpression ids. First acceptance
example: the variance-of-a-sum step in Brownian motion.

**The hold-something-fixed comparison.** Pin a baseline and vary exactly
one declared input; the comparison states what remained fixed, what
changed physically, and what was merely re-described, with a visibly
shared or independent seed policy for stochastic cases and preserved
events for observer changes.

**The countermodel workbench.** A small set of coherent candidate models
and explicit constraints; the reader discovers what each explains, where it
fails, or why the available information cannot distinguish them. A
Galilean map passes low-speed tests and fails the invariant-light-speed
condition; correlated points need not obey the independent-counting law;
Lorentz's ether kinematics reproduces the formulas.

**The what-can-you-infer workbench.** Hold the admitted observations fixed
and reveal families of compatible parameters; the Brownian radius and
molecular-number ambiguity is the first case; ask which independent
measurement would reduce it. A model can fit a curve without identifying
the world, and uncertainty from inadequate information is not repaired by
extra decimals.

**The explanation replay.** The local notebook stores an optional
prediction, a named comparison, the accepted model and input identities,
and the reader's revised explanation, so the reader can revisit the
evidence and assumptions behind a changed view. It stores no score and
never claims a free-text answer is correct because it contains expected
keywords.

### 14.4 Timeline (`/timeline`)

Two interleaved tracks, every card dated, typed, and sourced:

- **1905, week by week.** 17 March (paper 1 dated), 18 March (received),
  30 April (dissertation dated), mid-May (letter to Habicht), 11 May
  (paper 2 received), 9 June (paper 1 published), 30 June (paper 3
  received), 18 July (paper 2 published), 20 July (dissertation
  submitted), 26 September (paper 3 published), 27 September (paper 4
  received), 21 November (paper 4 published); the 1906 patent-office
  promotion and the habilitation attempts as context cards.
- **The long arc, 1729–1926.** Bradley, Brown, Fizeau, Maxwell, Hertz,
  Michelson–Morley, Lorentz, Poincaré, Planck, Lenard, Sutherland
  (Dunedin 1904; *Phil. Mag.* 1905), Bachelier, Smoluchowski, Perrin,
  Laue, Bucherer, Millikan, Compton, the 1921 Nobel citation (for the
  photoelectric law, not relativity), Perrin's 1926 Nobel; later
  confirmations (Ives–Stilwell 1938, Cockcroft–Walton 1932, ballistic
  Brownian motion 2010) on a clearly later shelf.

### 14.5 Predict, perturb, explain, and teach back

Each major chapter ends with a small task answerable in prose, by
arranging a construction, or by inspecting a counterexample, with feedback
that addresses the model of the situation rather than a right/wrong mark.
Examples: two microscope traces look equally restless; what additional
comparison distinguishes different diffusion coefficients, and why is one
trace insufficient? A lamp gets brighter but its frequency stays below the
threshold; which output should not increase merely because the animation
contains more incident packets? Two transformed events have a larger
spatial separation; why is that alone not a rod measurement? A body's
unknown internal energy appears in both ledgers; which subtraction removes
it, and which premise makes the subtraction useful? Guessing the next
equation is never a condition for continuing; "show me the reasoning"
remains available; the earlier prediction is preserved locally so the
changed understanding is visible without scoring.

Optional teach-back prompts ("Explain why the signed average can vanish,"
"What did we assume about the clocks?", "What observation would change your
mind?") let readers answer privately, reveal a worked explanation
immediately, and compare their reasoning against a few concrete criteria.
Chi and colleagues observed useful differences in how learners explained
worked examples; that finding motivates testing these activities, not an
automatic correctness judgment of free text. Optional later revisit cards
built from studied examples with a changed number, geometry, or assumption
draw on Roediger and Karpicke's delayed-retention findings for voluntary
recall, without streaks or an assumed effect size. A printable paired-
learning sheet assigns rotating roles (propose a prediction, operate the
experiment, question the explanation) and also works alone.

### 14.6 The Bern bridge (`/bern`)

Einstein examined electromechanical patents at the Federal Office for
Intellectual Property from June 1902 (provisional), permanently from 1904,
promoted to technical expert second class in 1906, leaving in 1909. This
page describes the job with sources (the CPAE editorial notes; Galison's
argument about clock-coordination patents and the simultaneity definition,
presented as an argument, not a fact); links to the era's machines on
`classic-patents.com` (Marconi US 586,193 of 1897, Fessenden US 706,737 of
1902, Tesla's transformer US 593,138 of 1897, the Wright Flyer filed
March 1903, and the Einstein–Szilárd refrigerator US 1,781,541 of 1930 as
the one patent with Einstein's name in that catalogue); and receives a
reciprocal link from the Einstein–Szilárd page and the About page there,
scheduled as a separate reviewed change to the donor.

---

## 15. Routes, Source Layout, Typography, and Reader Interaction

### 15.1 Routes (App Router only; one `src/app`; no `src/pages`, ever)

| Route | Page |
|---|---|
| `/` | Four invitations as questions ("How would you count what you cannot see?", "What could a spectrum tell you about the structure of light?", "How would you synchronize distant clocks?", "What does a body lose when it emits light?"; original interface copy, not quotations), a concise explanation of the project, "Show me with an example" and "Take me to the paper," the count note |
| `/papers` | The four documents, their scope, chronology, and the companion |
| `/papers/[paper]` | The reader shell with `?view=` faces and `?detail=` |
| `/papers/[paper]/[section]` | Shareable section-first entry without losing paper context |
| `/discover/[paper]` | The discovery journey (one canonical URL) |
| `/lab/[experiment]` | Standalone workbench with source and explanation links |
| `/embed/lab/[experiment]` | A single instrument with attribution, for embedding |
| `/foundations` and `/foundations/[concept]` | The foundation library, also usable in a local drawer |
| `/1904` | The historically bounded workspace and premise catalogue |
| `/connections` | The argument map, the Avogadro lab, the light thread |
| `/tours` and `/tours/[id]` | The three attention-budget tours with local progress |
| `/kitchen` | The home Brownian protocol (a friendly alias into BM-07 real-data mode) |
| `/timeline` | Two-track timeline |
| `/bern` | The patent office bridge |
| `/notation` | The full notation concordance, searchable |
| `/sources` | Edition policy, bibliographic records, rights, corrections, provenance receipts |
| `/about` | Purpose, authorship, scope, editorial method, translation policy, how to cite, contribution guidance, the clarity-signal summary |
| `opengraph-image`, `twitter-image` per paper and lab | Generated cards with the German title and a static rendering of the signature equation |

Search and companion state may use URL parameters where appropriate;
canonical document URLs never multiply into an index of slider positions.

### 15.2 Source layout

```text
content/
  papers/  source-blocks/  translations/  glosses/  annotations/  arguments/
  foundations/  misconceptions/  historical-premises/  equations/  quantities/
  experiments/  scenarios/  datasets/  tours/  bibliography/
src/
  app/                     # the only App Router root
  content/                 # schemas, compiler, validators, route projections
  reader/                  # reading shell, return stack, source alignment, faces
  equations/               # expression tree, notation forms, rendering, term and operation interaction
  experiments/             # instance controller, accepted snapshot, command classes
  workers/                 # versioned worker protocol and loaders
  physics/reference/       # audited TypeScript reference evaluators (§12.12)
  visuals/                 # SVG, Canvas, Three.js views consuming snapshots
  units/                   # display adapters to canonical quantities
  search/                  # build-time index and client query layer
  testing/                 # source, numerical-boundary, and browser scenarios
public/
  papers/pdfs/  papers/transcripts/   # only assets admitted for redistribution
  wasm/                    # content-addressed generated artifacts
  figures/                 # authored diagrams and reviewed source crops
docs/
  provenance/  DONOR_AUDIT.md  FRANKENSIM_BINDING.md
scripts/
  build-content.ts  verify-content.ts  verify-wasm-artifacts.ts
  extract-kernel-source.ts  build-search-index.ts  digitize-datasets/
  e2e-paper-vertical-slices.ts  verified-production-deploy.ts
  app/                     # app edition export, native payloads, Apple gate, app release
ios/                       # the iPhone app (§18.6)
```

A proposed structure, not a claim that these files exist. Keep independent
content records small enough for precise review and parallel work.

### 15.3 Visual direction and themes

The site should look like an unusually beautiful scientific book that
happens to be alive: a bright, warm paper background, dark readable body
text, generous margins, fine rules, restrained archival accents, vivid but
controlled scientific color. One excellent reading serif (Newsreader), one
compact interface sans (Plus Jakarta Sans), JetBrains Mono for telemetry
and code, and KaTeX's own fonts for mathematics; test German diacritics,
Greek letters, subscripts, primes, old notation, and long equations before
committing; self-host and subset without omitting needed mathematical
glyphs.

Three themes, switchable like the donor's: **Annalen** (default light:
journal cream, black ink, red only for emphasis and the move step, the
running-head feel of a 1905 journal page, the German masthead set to match
the facsimile as closely as the fonts allow and no more); **Kramgasse
Night** (dark, deep slate with lamplight amber accents); **Slate** (a
chalkboard theme for derivation chains and discovery journeys, the role
colors as chalk tints, the move boxed in chalk, instrument canvases
inverted; chosen automatically on `/discover` unless the reader has set a
theme). Dark modes are optional; they are not the primary identity.
Contrast is checked at AA for every color pair used for text.

The placeholder page served at `annus-mirabilis.com` during preparation
realized this direction (journal cream `#eee7d7`, ink `#1a1916`, red
`#ae2119` for emphasis only, Newsreader with its optical-size axis, a
running head, the frontispiece with its credit, and one mark per printed
journal page grouped 17, 12, 31, and 3). The owner asked to keep that
design for the site, so `docs/design/placeholder/` is the reference
implementation of the Annalen theme and departures from it carry a
recorded reason.

### 15.4 Page anatomy

Desktop reading has a main text column and an optional companion column
showing the original, an explanation, a selected equation, or a laboratory;
a narrow section outline remains available without consuming a third full
column. On phones, one primary column and a bottom-sheet or full-width
companion; switching context preserves the paragraph and selected term;
German, English, commentary, equations, and a 3D scene are never squeezed
into simultaneous narrow columns. The reader can pin an equation while
scrolling its derivation. A laboratory may stay visible within a bounded
sticky region that never traps the scroll or hides text behind fixed
controls. Long equations get authored line breaks or a local horizontal
scroll region, never page-wide overflow. Sticky controls relinquish space
before they obscure content; at high zoom companions move below the
passage. The first encounter uses a single question, one useful
interaction, and a clear next step; the full paper can be long and
demanding; keeping these two scales connected matters more than making
every screen equally dense.

### 15.5 Semantic color

A small role palette: energy-related quantities, time and rates, space and
geometry, material response, statistical quantities, fields, and quanta,
inherited from the donor's nine-color palette and treated as a contextual
convention with an explicit legend, not a physical ontology. Red never
always means "bad"; a negative value is not an error. A quantity's color is
consistent across its equation, legend, graph, scene, and kernel source in
the current argument; selecting it highlights all instances; identity also
appears through labels, shapes, outlines, or patterns; color-vision
alternatives and monochrome print remain intelligible. Color attaches to
the canonical quantity id and its declared role, never to a letter: $E$ is
not permanently one color.

### 15.6 The equation interaction ladder

A selected expression offers, in increasing depth: **Read it aloud** (an
authored natural-language rendering, including which quantities change and
which are held fixed); **What each part does** (a role explanation for
terms and operations, not merely the names of letters); **Try a value**
(a live substitution with units and an explanation of what is independent
versus derived); **Show the next step** (a justified transformation with
the changed subexpression highlighted); **Why is that allowed?** (the
algebra, calculus, physical premise, or approximation); **Show a concrete
example** (a small numerical or geometric instance). The key affordance is
selecting an operation as well as a symbol: readers may know what $T$
means but not why it appears in a denominator or why a logarithm appears
at all. The notation strip and the "Show the derivation" disclosure with
the move highlighted sit on every equation card; `usedBy` edges draw the
equation genealogy on the results face (for paper 3: the two postulates at
the root, the transformation in the middle, the field, Doppler, energy, and
electron results as leaves, and one edge leaving the paper to paper 4).

**A worked micro-interaction.** For $D = k_BT/(6\pi\eta a)$, selecting the
denominator explains the combined resistance to motion, then separates the
roles of viscosity, radius, and geometry. Doubling $a$ at fixed $T$ and
$\eta$ halves $D$; the one-dimensional RMS displacement at fixed time
decreases by $1/\sqrt{2}$, not by half. The colorized equation connects the
parameter change to the actual observable, not only to the intermediate
coefficient, and a comparison view shows both runs on the same axes with
an explicit seed policy.

---

## 16. Search, Accessibility, Performance, Security, and Privacy

### 16.1 Search

Indexes both everyday language and technical terms: "how far does it
wander" leads to RMS displacement; "clocks disagree" finds simultaneity and
synchronization; `βν` finds the quantum energy; `0.8 μ` finds paper 2 §5;
`Besso` finds the closing line of paper 3. Sections, sentences (German and
English), equations by symbol and printed number, results, argument nodes,
instruments, foundations, misconceptions, glossary terms, timeline cards,
and people are indexed at build time into a client-side index (MiniSearch
or FlexSearch), so ⌘K works offline and without a server. The default
reader does not need the index to find the four papers or their outlines;
browser text search must still find the full section, so paragraphs are
not virtualized out of the DOM.

### 16.2 Accessibility as the ability to reason

Target WCAG 2.2 AA with manual verification of mathematics, keyboard-
operated instruments, focus restoration, contrast, zoom, screen readers,
touch, and reduced motion; automated checks alone are insufficient. W3C's
supplemental cognitive guidance (clear wording, manageable presentation,
alternatives that do not depend on numerical fluency) is followed as
guidance, not claimed as conformance. Acceptance asks whether the visitor
can perform the intended reasoning: compare event times, choose a
displacement statistic, change a parameter, inspect a conservation balance,
explain an equation step. Test those actions with disabled readers using
their own tools during the reference slice, before the visual language
hardens. PhET's inclusive-design work is a design reference for alternative
input, interactive descriptions, and sound, not proof that adding them makes
these instruments effective.

- KaTeX HTML plus MathML for visual and assistive presentation, tested on
  real assistive-technology combinations; no duplicate announcements from
  a visual formula and a redundant spoken label; complex mathematics also
  exposes a structured textual explanation and step list.
- Each equation carries an **authored spoken form** (in the style of
  ClearSpeak) as its accessible name, because auto-generated speech is
  often wrong for physics notation ("beta" versus "the stretch factor");
  the colorized sentence is the fallback. Not every glyph is a tab stop: a
  formula is readable as a whole, with an optional term-and-operation
  explorer and a clear way out.
- Every canvas or 3D view has a meaningful textual description and an
  inspectable table of selected quantities and events. A graph has three
  layers of accessible information: a concise statement of what is being
  compared; the current relation or change after an intentional action;
  optional detailed points, intervals, or event records. A 60 Hz
  animation never produces a 60 Hz live-region stream; announce committed
  comparisons or requested summaries and let the reader pause and inspect.
- All core controls have keyboard and typed-input equivalents (typed value
  and step buttons beside custom sliders; the W3C slider pattern's warning
  about touch assistive technology is heeded and tested on devices).
  Tooltip-only explanations are prohibited. No-JavaScript readers get real
  links to explanations, not hydration-dependent buttons.
- Animations are pausable; sound starts muted; reduced-motion mode pauses
  random walks and boosts, shows the current state, and does not delete
  the lesson.
- Optional **sonification** may encode position, spread, rate, or a
  selected relation with an inspectable, consistent mapping; it is not a
  recording of photons, molecules, or time; quiet default, volume control,
  captions or transcripts for speech, no essential task depending on
  hearing.
- **Reviewed narration** (later phase): a careful human or reviewed
  synthetic reading of the English face with authored pronunciation and
  grouping for ambiguous expressions, synchronized to stable argument ids;
  a raw text-to-speech reading of LaTeX is not an accessible mathematics
  edition.
- A persistent **reading-only** setting suppresses autoplay, expensive
  scene loads, and decorative motion while retaining every explanation and
  static worked case. Line length, type size, contrast, and paragraph
  spacing are adjustable within tested layouts; no unproven "special
  reading font" is imposed and no learning-style classification is stored.
- Deep links address a meaningful passage or action even without WebGL.

### 16.3 Print, offline, and low bandwidth

Print produces a coherent chapter with equations, source references,
visible explanations, and representative figures with captions for
interactive states; hidden drawers have a deliberate print policy (essential
explanations expanded, collapsed headings never printed alone). Offer an
explicit **"save this chapter for offline reading"** path (a self-contained
HTML chapter with permitted figures and source references, with its size
stated) before a service worker exists. A later installable mode caches a
coherent edition manifest, its required assets, and optionally the
selected laboratory packages, claiming offline numerical operation only
when the exact bundle and initialization path have been tested without a
network; prior cached editions stay readable during an update; storage
eviction never corrupts the online reader; private notes are never cached
into shareable URLs or exports by default. Pages stay light: no hero
video, no web fonts beyond the three families and KaTeX, and no forced
large download on a mobile connection.

### 16.4 Performance budgets

Provisional budgets set before the reference slice and adjusted only with
recorded measurements naming hardware, browser, viewport, network profile,
and cache state:

| Surface | Initial target | Measurement boundary |
|---|---|---|
| Initial reading route | No Three.js, PDF viewer, or WASM in the initial dependency graph; at most 200 KiB compressed first-route JavaScript | Cold production build, transferred script bytes |
| Reading-face HTML with all readings | 250 kB gzipped for the largest paper, else JSON fragments (§6.2) | Static output size in CI |
| Visible text and math | Main content in initial HTML; locally hosted subset fonts with stable fallback metrics | JavaScript disabled; cold font cache |
| Reader responsiveness | 200 ms or better interaction latency at the 75th percentile on the agreed profile | Real interactions including a detail drawer |
| Layout stability | Cumulative layout shift at most 0.1 | Initial load and deferred math activation |
| A simple analytical instrument | Parameter feedback within 100 ms once loaded | Input to accepted visible snapshot, not to pending-state paint |
| Animated instruments | 60 Hz on capable desktops; a stable 30 Hz mobile tier | Rendering measured separately from solver accuracy |
| Resource lifecycle | No growing count of workers, GPU contexts, listeners, or particle buffers across repeated route changes | Open/close and experiment-switch stress run |

Report total transfer separately from JavaScript. Under load, reduce
visual detail, displayed particle count, resolution, or rendering
frequency; never enlarge the integration step, change the model, or reduce
the statistical sample behind an inference; rendering a subset of
particles never changes the ensemble used for results.

### 16.5 Security

Imported text, bibliographic data, URL state, and reader notes are
untrusted input. Closed content schema and sanitized rendering; no
evaluation of user expressions as JavaScript (the exercise checker of
§17.3 parses a tiny arithmetic grammar, never `eval`); KaTeX trust kept
narrowly scoped with allowed token markup tested; a source record cannot
inject HTML, CSS, links, or image loads through a mathematical expression;
generated classes and data attributes validated; macro expansion and size
capped; raw error strings never displayed. Bound URL-state size, particle
counts, iteration counts, and numeric input ranges; keep heavy calculations
cancellable so a malicious or accidental preset cannot freeze the page.
Content-addressed WASM still requires trusted build provenance. Serve
`application/wasm` for streaming instantiation; verify the actual
Content-Security-Policy with the chosen loading path; no broad
`unsafe-eval`; test CSP and worker loading in the supported browsers.

### 16.6 Privacy and the one analytic

No third-party scripts, fingerprinting, advertising, accounts, or cookie
banner full of unnecessary choices. Local reading progress, tours, notes,
and predictions stay in `localStorage`, exportable and clearable. The one
analytic the site keeps is the **clarity signal**: under every paragraph a
one-click "this was clear / this was not" control records the detail
level and anchor, aggregated without cookies, identifiers, or IP
retention, because it tells editors exactly where an explanation fails;
its weekly summary is published on the About page. Free-text answers are
never sent anywhere.

---

## 17. Editorial Pipeline, Tests, Quality Gates, and Definition of Done

### 17.1 Five independent questions

A release answers five questions separately, and no single artifact
answers them all:

1. Is the historical text complete and accurately represented?
2. Is the explanation mathematically and physically sound?
3. Does the instrument calculate and display the stated model correctly?
4. Can a visitor operate and understand the actual page?
5. Does the explanation help a reader overcome the intended obstacle?

A unit-test count cannot answer all five. Neither can a historian's
approval of a transcription, a screenshot of a beautiful page, or a
learner saying the animation was enjoyable.

### 17.2 Editorial review

Review at the level of a complete argument, not isolated sentences. For
each section a reviewer can follow the facsimile, transcription,
translation, explanation, notation map, and instruments without guessing
how they correspond. Require a physics or mathematics review of each
complete derivation and a German source review of the translation;
contributors may fill more than one role where qualified; machine-generated
drafts never self-certify. Record corrections against stable source and
argument ids; a source correction identifies affected translations and
explanatory claims without marking unrelated visual work obsolete, and a
visual change does not imply a re-reviewed translation. The short
mass–energy paper is reviewed with the same seriousness as the long ones.

### 17.3 Pipeline scripts and tests

```
scripts/
├── download-facsimiles.ts       # fetch and pin the Annalen scans; refuse to replace a pinned file
├── ocr-ledgers.ts               # orchestrate bounded cloud jobs only; never local OCR
├── segment-ledger.ts            # block and sentence ids for the reviewed German ledger
├── align-editions.ts            # build and check the many-to-many alignment
├── build-content.ts             # the content compiler (§11.7); static KaTeX; route projections
├── verify-content.ts            # every compiler rejection of §11.7 plus Rules 0–2
├── audit-readings.ts            # R0–R3 present; heuristic R2-length gate with recorded overrides
├── audit-shelf.ts               # no premise after 1904 in a discovery step unless flagged
├── audit-misconceptions.ts      # at least five per paper; anchors and instruments resolve
├── audit-dimensions.ts          # rational-exponent dimensional consistency of every equation
├── audit-instruments.ts         # registry entry, probes, notModeled, tape identity, kernel test, action contract, predict mode or exemption
├── extract-kernel-source.ts     # pins each instrument to its kernel function's source hash for "Show the code"
├── build-search-index.ts        # static client-side index
├── digitize-datasets/           # CSV plus citation for every HistoricalDataset, with a validation test
├── verify-wasm-artifacts.ts     # pins fs-generic digests; steps the three exports; Philox cross-check; refusal checks
├── e2e-paper-vertical-slices.ts # Playwright: every face, every detail, 320 px, keyboard, reduced motion, no-JS, print, WebKit lane
└── verified-production-deploy.ts# inherited release workflow with the release manifest of §18.3
```

Tests, by layer:

- **Editions.** SHA-256 pinned to the facsimile bytes; the German edition
  text is contained in the ledger; no page markers in the edition; the
  alignment covers every sentence; equation blocks byte-identical across
  languages; term definitions longer than 80 characters; the hero quote
  resolves.
- **Papers and arguments.** Results read from the edition, never retyped;
  readings at all levels; every equation anchor resolves; dispute entries
  carry primary text; shelf dates; proof routes acyclic; historical versus
  oracle edge types.
- **Reference evaluators and owners.** The fixtures and adversarial
  fixtures of §13, plus invariants (determinant 1, $U < c$,
  $E'/E = \nu'/\nu$, $\lambda_x \propto \sqrt{t}$, histogram variance
  within tolerance of $2Dt$ for a fixed seed, field invariants, both frame
  balances).
- **WASM artifacts.** Digests; instantiation; the three exports; the
  seeded trajectory digest against the TypeScript Philox port (integer
  output bitwise; normal transform within tolerance, both recorded);
  malformed-output rejection; the stability refusal; the fallback label
  never `wasm`; 64-bit identity round trips.
- **Dispatcher.** Every experiment id has an explicit case; no fallback to
  another paper's instrument; unknown ids fail explicitly.
- **Architecture.** Fails on `src/pages` or a second app root.
- **Exercises.** Expression answers are checked by numerical equivalence
  (the reader's expression and the reference evaluated at a fixed set of
  random points, compared within tolerance, through a tiny parsed grammar,
  never `eval`); numeric answers by the kernel with a stated tolerance; no
  answer stored as a string.

### 17.4 Real browser acceptance

Adapt the donor's vertical-slice harness (complete visitor journey,
semantic readiness checks, multiple viewports, retained failure evidence)
rather than replacing it. Each paper has at least one continuous test that
enters through a deep source passage, switches face, opens a foundation,
returns to the exact argument, operates an instrument, selects a linked
term, and returns to the source; every instrument's parameter and refusal
contract is tested, including direct numeric entry and shared-state URLs.
The matrix: desktop, tablet, a 320-pixel touch viewport; an actual
WebKit/Safari lane; keyboard-only; reduced motion; high zoom; no-WebGL;
JavaScript-disabled reading against the rendered document; at least a
small real-device check. Acceptance includes: identical accepted snapshot
ids across numerical, graphical, equation, and tabular views of one
experiment; two independent instances of the same experiment whose
controls do not interfere; face changes that do not restart a running
experiment or mount a second owner; worker refusal, unavailable WASM, stale
responses, context loss, and restart without false results; reachable
footnotes and locators, meaningful MathML, focus restoration, no page-level
horizontal overflow; print output with complete prose, uncut equations,
expanded essential explanations, and static representations of the chosen
state. A failed test retains enough evidence to diagnose; the
failure-reporting path is itself tested.

### 17.5 Comprehension testing

Recruit readers across different starting points: no algebra or graph
fluency; rusty preparation; non-native English; technically trained but
physics-unfamiliar; strong mathematical preparation; disabled readers with
their own assistive setups; people on low-cost phones. Participation is
voluntary, accessible, and compensated where feasible; no diagnosis,
credential, or placement score is collected. A practical round is five to
eight participants per contrasting route; this is a problem-discovery
design, not a statistically powered claim.

For each tested lesson, state the targeted change in understanding before
the session; use a brief pre-explanation question; observe the
interaction; ask for an explanation afterward; present a different case;
offer a delayed revisit where separately consented. Ask readers to explain
what a formula predicts before and after interacting with it, to identify
which assumptions support a conclusion, and to distinguish a simulation
result from an observation. The rubric:

| Dimension | What to observe |
|---|---|
| Meaning | Can the reader say what is measured or compared? |
| Mechanism or argument | Can the reader explain the connection rather than describe the animation? |
| Prediction | Can the reader handle a changed value, geometry, or direction? |
| Assumptions | Can the reader name a condition under which the inference would need revision? |
| Evidence | Can the reader distinguish an observed dataset from a simulated consequence? |
| Navigation | Can the reader locate the source and obtain the missing explanation unaided? |

Record the precise stumbling point (undefined symbol, omitted inference,
misleading visual cue, inaccessible control, too much at once) and the
passage or action id; prioritize fixes that remove recurrent barriers;
improve the relevant explanation before adding a feature. Satisfaction,
confidence, time on page, and completion are not substitutes for
understanding (Deslauriers and colleagues found perceived and measured
learning can diverge). Any comparative product experiment states its
outcome, assignment, exclusions, analysis, and uncertainty in advance;
with small traffic, report descriptive observations. Publish the scope of
tested routes and known barriers; never claim the site has proved it can
teach every person.

### 17.6 A full acceptance scenario for someone outside the presumed audience

Before freezing the shared reader and equation architecture, run this with
a reader unfamiliar with algebra and a separate nonvisual-access check:

1. Enter Brownian motion without knowing its name; explain the difference
   between zero signed average and no movement using the four-entry
   example.
2. Ask why the square is useful; read the smaller worked case; return to
   the original question without losing place.
3. Predict how a more viscous liquid changes spread at the same time;
   inspect the admitted comparison with units or the plain-language
   relation.
4. Identify which scene is simulated and which data, if present, were
   observed; explain that programmed motion does not independently prove
   molecules exist.
5. Open the source passage and identify the next mathematical bridge
   without being forced to complete it.

Run the equivalent actions with keyboard and assistive controls and an
unavailable-graphics path, and run the advanced derivation route so that
helping the new reader has not removed mathematical completeness. A
failure leads to an improved explanation or interaction, not a badge
claiming "beginner support."

### 17.7 Definition of done (per paper)

1. Provenance receipt complete (§4.3), typed dates, page map, comparison
   witnesses, translation credits.
2. Pinned facsimile, reviewed diplomatic ledger, German edition, English
   edition, gloss units for the required sections, and the many-to-many
   alignment share one SHA-256 and pass the edition tests; the source
   manifest reports every block covered.
3. Every paragraph has R0–R3. Every displayed equation has an `Equation`
   record with a semantic tree, concordance entries, a spoken form, a
   passing dimensional check, and, where the paper derives it, a
   derivation chain with the move marked.
4. Every result in §3 has a results-face card, a decoder, and, where the
   table says so, a live probe; the misconception ledger has at least
   five entries with instruments.
5. Every core instrument for the paper (§10.2) exists, has an explicit
   dispatcher case, an instance-scoped owner, a tape identity, passing
   fixtures, an honest execution label, `notModeled`, predict mode or a
   recorded exemption, show-the-code, an action contract, an embed route,
   a 320 px layout, keyboard operation, and reduced motion.
6. The discovery journey has the front door and at least one side door,
   the no-algebra first encounter, every shelf card dated and sourced,
   every fork with at least one worked non-paper branch that fails on a
   stated constraint or is honestly marked equivalent, and every
   check-step computing live from the accepted snapshot.
7. The required historian's-margin entries of §3.9 are present with
   primary sources; parallel work, reception, confirmations, and disputes
   carry what was actually written.
8. The fifteen-minute tour exists and has been completed by a reader with
   no physics background who can then state the paper's claim in one
   sentence; the full acceptance scenario of §17.6 has been run for the
   Brownian paper.
9. `verify-content`, typecheck, lint, format, build, `ubs --diff`, the
   WASM artifact test, and the Playwright vertical slice are green; the
   editorial acceptance (German fidelity, translation accuracy, R2
   readability by a non-physicist reviewer, the physics review of every
   derivation) is recorded in the receipt with reviewer names.

### 17.8 AGENTS.md for the new repository

Copy the donor file. Keep Rules 0, 1, 2, git safety, branch policy, the
cloud-OCR-only chapter, the FrankenSim honesty chapter, the Three.js
chapter, the Vercel chapter, Beads, Agent Mail, code quality, and "landing
the plane." Replace the mission and the "how to add a patent" chapter
with: how to add or revise a paper section (source block, alignment, four
readings, equation record, anchors, tests); how to add an instrument
(owner first, registry, dispatcher, probes, `notModeled`, tape identity,
fixtures, action contract, 320 px, reduced motion, predict mode); how to add
a discovery step (shelf date rule, fork rule, worked-branch rule, check
step computes live, "a route you could take" labeling); the epistemic
rules (four kinds of meaning, typed results, no circular explanations, no
manufactured historical data); the editorial voice (§7.12) including the
R2 test; and the command-class rule (an observer change never restarts an
experiment).

---

## 18. Deployment, Domain, and Release

### 18.1 Hosting

Cloudflare for the registered domain and authoritative DNS; Vercel for the
Next.js deployment via the inherited `verified-production-deploy.ts`
workflow, pointed at `annus-mirabilis.com`, `www.annus-mirabilis.com`, and
a stable `annus-mirabilis-seven.vercel.app` alias (Vercel assigned it because
`annus-mirabilis.vercel.app` belongs to another account); `vercel.json` keeps
`{"git": {"deploymentEnabled": false}}`. Registration at Cloudflare does
not require hosting on Cloudflare. This document does not authorize
changing DNS, connecting a domain, or deploying; it specifies the intended
path.

### 18.2 Cloudflare zone configuration

- Apex `A` and `www` `CNAME` per Vercel's current domain instructions,
  **DNS-only (grey cloud)** for both at launch, so Vercel manages
  certificates and edge caching without a second proxy layer (Vercel's
  guidance warns that an extra proxy complicates caching, routing, and
  request visibility). Proxied mode can be enabled later with SSL Full
  (strict) and the documented caveats reviewed. Use the exact records
  supplied for the project, not addresses copied from a plan.
- CAA records permitting Vercel's certificate authority if any CAA records
  exist on the zone.
- DNSSEC on once records are stable.
- Email: none, or a null `MX` plus `v=spf1 -all` and a DMARC reject policy
  so the domain cannot be spoofed.
- `https://annus-mirabilis.com` canonical; `www` redirects consistently.

### 18.3 Atomic release and rollback

Build a complete candidate, validate it under an unpromoted deployment
URL, and only then promote the public domain. A **release manifest** binds
the site source revision, content edition version, source-asset hashes,
WASM artifact hashes, generated schema version, and test results. Candidate
checks load all four complete paper texts, representative foundation
pages, and every instrument bundle, and include one no-JavaScript
source-text check, one real accepted WASM result per numerical capability,
and one deliberate typed refusal; they verify the exact deployed assets,
not the build directory. After promotion, run a short live smoke test
(the mass–energy paper, because it is quick, plus its German edition
endpoint). Keep the previous verified deployment and its immutable assets
available; a rollback restores a coherent site, content, and kernel set and
never points old HTML at incompatible new WASM. Long-lived cache for
immutable content-addressed figures and WASM; a policy for manifests and
HTML that never references a removed artifact. Do not make unreviewed
changes to Classic Patents as part of this site's release; the two sites
fail and recover independently. Do not require SharedArrayBuffer or
cross-origin isolation; a single dedicated worker per active heavy
experiment suffices.

### 18.4 Cloudflare-hosted alternative

Worth testing only with a concrete cost, operational, or product reason,
after a bounded compatibility experiment covering the framework version,
static generation, source assets, workers, WASM, and preview releases. The
release script, its lock, its prebuilt-artifact validation, and the smoke
test are Vercel-shaped; re-validating them is not free, and editorial and
instrument work never blocks on a hosting comparison.

### 18.5 Repository

`gh repo create Dicklesworthstone/annus-mirabilis.com --public`, the
chosen license with rider and per-asset exceptions, README modeled on the
donor's (TL;DR, the four papers table, architecture box, getting started,
verification, license), and this plan committed as the master document.

### 18.6 The iPhone app

An iPhone and iPad app ships from this repository under `ios/`, specified by
`COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_IPHONE_APP.md` and built by the
`am-ep-app-m247` epic. It is a native SwiftUI shell around the same static
edition, bundled in the app and rendered by WKWebView from a local
first-party origin, so a reader reads offline while every displayed number
still comes from the edition's own runtime and its registered owners. The
app never reimplements the reader, the equations, the instruments, or the
physics, and the reading path never loads remote content.

The app follows the website and never leads it: its edition is built from
the same commit and release profile, each build is bound to the website's
`releaseId` and determinism digest, TestFlight carries the preview edition,
and the App Store release follows the website's launch with the same
release id. No web bead depends on an app bead, and app work never delays a
website batch.

---

## 19. Delivery Plan: Complete Vertical Slices, Then Systematic Coverage

The objective is not to accumulate scaffolding. Each batch leaves a
visibly better, source-grounded reader experience with a closure test.
Durations are rough estimates for a small team and are not commitments.

### 19.1 Start the source inventory immediately (Batch A, 2 weeks)

Before any visual polish, inventory all four original documents, including
every equation and footnote; freeze stable ids; identify translation and
notation difficulties; resolve the facsimile sources and rights; create the
repository and copy the kernel modules of §2.3; get `typecheck`, `lint`,
`build`, and the architecture test green with an empty corpus; write
`AGENTS.md`, `README.md`, `DONOR_AUDIT.md` with pinned commit hashes, and
`FRANKENSIM_BINDING.md`; add the three exports to `fs-wasm` with tests,
include them in the slim artifact, port Philox to TypeScript with
cross-check vectors, rebuild and pin digests. Transcription, translation,
and scientific review for all four papers proceed in parallel with
implementation from here on, using the same ids. **Exit evidence:** every
original source unit has a destination; drafts are visibly distinguished
from reviewed translations; the empty site deploys to the Vercel alias.

### 19.2 The first reference slice: Brownian §§4–5 (Batch B, 4 weeks)

Build **the distribution argument and the measurable displacement**, with
the required explanation of the diffusion coefficient and links back to
§§1–3, as the first end-to-end slice. It exercises almost everything the
architecture must prove: German and English alignment, probability and
calculus drill-downs, semantic equations, a real seeded numerical owner, a
graph and a microscope view of one accepted state, units across
microscopic scales, model limits, inference, mobile operation, the
no-algebra entrance, the equivalent nonvisual actions, the return stack,
typed results, and a discovery path. **Exit demonstration:** a reader
opens the original passage about displacement, understands why the mean
displacement can vanish while its square grows, predicts the effect of
changing viscosity, sees the same accepted state in the trace and the
distribution, opens the derivation of the square-root time dependence, and
returns to the source without losing position; the page remains
intelligible when the simulation is unavailable; an assistive-technology
user runs the same comparison; the full derivation and the analytical and
stochastic checks pass. Do not generalize the framework until this slice
exposes which abstractions help.

### 19.3 Batches and dependencies

| Batch | Work that changes the product | Required exit evidence | Rough duration |
|---|---|---|---|
| **C. Complete Brownian paper** | Osmotic pressure, force balance, diffusion coefficient, the full §2 argument, the independent inference route, measurement bias, the kitchen mode, complete source review | All five sections and surrounding text covered; no modern-constant circularity in the historical inference exercise; the §17.6 scenario passes | 3 weeks |
| **D. Mass–energy in full** | Original three-page edition, opposite-pulse experiment, two-frame ledgers, low-speed coefficient, system boundaries, gloss face, both doors, the required margin | Noncircular derivation; exact/Taylor/proxy comparison; full prose and all qualifications present; the first complete paper proves the complete-paper contract cheaply | 2 weeks |
| **E. Relativity foundations and kinematics** | Clock network and event ledger; candidate transformation construction; simultaneity, lengths, clock rates, velocity composition; the Galilean shelf step | Reader distinguishes event separation from a rod measurement; inverse, composition, null-path tests; original notation mapping | 4 weeks |
| **F. Light paper in full** | Wave successes, spectrum with honest coordinates, cutoff allocation, the entropy workbench with $C(\nu)$, independent configurations, coefficient matching, fluorescence, photoelectric, ionization | All nine sections covered; Wien limitation visible; energy-versus-rate controls demonstrably distinct; the Planck branch worked fairly | 4 weeks |
| **G. Relativity electrodynamics in full** | Field transformations component by component, wave phase, Doppler and aberration, the light complex, moving mirrors, charge and current, electron dynamics with both conventions | All ten sections covered; sign and frame checks; the difficult final sections receive the same depth as the opening | 4 weeks |
| **H. Discovery book and connections** | Four complete journeys, methodological essays, the 1904 desk, foundations and the zero-algebra layer, capstones, connections, the Avogadro lab, the companion record, timeline, Bern bridge | Knowledge-boundary review; prerequisite graph has no dead ends; transfer tasks reviewed | 4 weeks |
| **I. Publication finish** | Typography and accessibility regression, tours, embeds, offline chapters, clarity signal, mobile and print, source corrections, performance, candidate release, domain configuration | All launch criteria of §21 met against the actual candidate deployment | 3 weeks |

Batches overlap where contracts permit. Source work for all four papers
starts in A. D needs paper 3's §8 result only as an admitted import with
provenance, so it does not wait for E or G. H begins with the first slice
and matures alongside the physics rather than being prose pasted over
finished animations. Accessibility exists in every batch, not in I.

### 19.4 Concrete high-value work items

| Work item | Deliverable | Closure condition |
|---|---|---|
| Source manifest compiler | Canonical source units, alignment graph, locator validator | Missing or duplicate original units produce an actionable failure |
| Reader shell | Source, English, gloss, explanation, and companion faces with stable navigation and the return stack | A deep-linked passage survives face switching and foundation return |
| Semantic equation component | Expression tree, exact term and operation ids, unit and value bindings, spoken form, keyboard and touch interaction | Selecting a term highlights exactly its authored meaning in all linked views |
| Diffusion owner | Upstream coefficient, propagator, seeded trajectory, moments, FTCS stepper | Independent analytical and statistical tests; admitted WASM export in the slim artifact |
| Experiment controller | Instance-scoped state, versioned worker requests, accepted snapshots, command classes | Stale response rejected; two instances independent; an observer change preserves the run |
| Brownian explanation unit | Mean, mean-square displacement, square-root time dependence, at every reading | Reviewer follows every step; the transfer example works without animation |
| Notation concordance | Original-to-modern mapping with scope and semantic distinctions | Original $\beta$, $\tau$, $V$, $k$, $P$ cannot silently acquire modern meanings |
| Relativity event engine | Events, inertial frames, exact boosts, inverse and composition with rotation, light rays | Frame-sign fixtures and rod and clock measurement cases pass |
| Radiation entropy instrument | Wien-domain entropy comparison with the ideal-gas analogue and $C(\nu)$ | Correct dependence and explicit domain; the analogy never presented as a universal proof |
| Two-frame energy ledger | Independently computed before/after radiation and body-energy differences with symbolic offsets | The September reasoning works without assuming its conclusion |
| Inference laboratory | Estimator, chi-square interval, inversion, identifiability, noise and exposure models, real-data loading | Fixtures of §13 pass; the kitchen protocol yields an interval from a test video |

Avoid work items whose only completion criterion is "add a module,"
"create a manifest," or "write tests"; each states the reader capability
or scientific boundary it delivers.

### 19.5 Parallel contributors without content drift

Give each paper a responsible editorial owner and each shared numerical
capability a responsible implementation owner. Centralize the symbol
registry, source ids, and browser protocol early; let prose and visual
composition vary where it improves understanding. Keep changes small and
integrate frequently; do not repeatedly rename ids or reformat unrelated
papers; pin upstream numerical revisions and rerun dependent fixtures
when a capability changes; improvements to generic physics land in
FrankenSim with an explicit downstream adoption change. Human source and
translation review, scientific review, accessibility co-design, and
editorial writing are first-class work tracked alongside programming
tasks, not final polish around completed code.

### 19.6 What a preview may show, and what launch means

A public preview may contain the complete Brownian and mass–energy papers
while the others are clearly marked in preparation; it must not advertise
four complete interactive editions before they exist. The launch is the
complete four-paper site. A preview is a way to learn from a real reading
experience, not permission to redefine the project as four landing pages
and four famous equations.

### 19.7 The innovation sequence and its stop rules

| Priority | First concrete delivery | Expand only after |
|---|---|---|
| P0 | The no-algebra Brownian entrance plus a complete advanced explanation of the same step | Both lead back to the same source passage without contradictory claims |
| P0 | Equivalent nonvisual actions and the reading-only path | Readers can perform the comparison, not merely hear a description of it |
| P0 | Typed results, exact identities, command classes, and safe snapshot ownership | A changed observer preserves the world; stale results and rounded seeds cannot corrupt it |
| P1 | The missing-step explorer on the variance argument | Observed readers resolve the obstacle and return |
| P1 | Baseline/variant comparison plus a fair countermodel case | The interface distinguishes changed premises from changed representation |
| P1 | Identifiability and the observation-error comparison | Unknown information is visible and the uncertainty calculation remains valid |
| P1 | Predict mode, show-the-code, the misconception ledger, the gloss face for paper 4 | Each resolves an observed misunderstanding in testing |
| P2 | Explanation replay, revisit cards, paired worksheets, capstones, tours, embeds | They help explanation and transfer without becoming required navigation |
| P2 | Offline chapters, the kitchen real-data mode with a licensed sequence, reviewed narration, additional languages | The access need is tested and the publication and revision path is reliable |

P0 and P1 are not a license to postpone the remaining papers. Time-box
the first prototype of each shared innovation to a bounded lesson and defer
it when it has no observable advantage over a well-written example.

Later, unscheduled: the 1906 Brownian follow-up and the 1907 review article
as further companion records; a printable broadside per paper; community
translations of the readings against the same alignment.

---

## 20. Principal Risks and Decisions

| Risk | Failure mode | Design response |
|---|---|---|
| Hindsight disguised as discovery | The conclusion is handed over in the premise, or a post-1905 formalism is presented as available in 1904 | Knowledge cards with `latestYear`; the four historical statements; historical versus oracle edge types; derivation dependency review |
| Beautiful summaries replacing the papers | Familiar headlines covered while difficult original sections disappear | Source manifest; section-specific completeness obligations; both halves of paper 3 |
| Recursive explanation becomes a maze | Each definition opens undefined terms and the reader loses the argument | Finite foundation graph, authored stopping points, return stack, "show me one example first" |
| Animation implies false physics | Rendered impacts or flashes mistaken for a quantitative model | Display/model distinction; shared accepted snapshots; `notModeled`; four kinds of meaning |
| A simulator mistaken for evidence | A threshold programmed into the photoelectric bench read as proof of a threshold in nature | The no-circularity rule; synthetic versus real-data activities; typed historical datasets |
| WASM branding replaces integration | A package loads but values come from unrelated JavaScript | Execution provenance on the accepted quantity; the label is earned per snapshot |
| Missing upstream capability expands into a research platform | A short instrument waits for a general quantum or relativistic engine | Narrow analytic and stochastic capabilities; admitted domains; the three small exports first |
| Translation errors propagate | An ambiguous German phrase becomes an unquestioned premise | Reviewed alignment; correction graph; visible alternate readings; modality preserved |
| Modern constants spoil historical inference | An unknown is built into synthetic data through a hidden modern equivalent | Separate historical inference parameters and modern demonstration mode; compiler flag |
| Rich UI compromises the book | Large bundles, tiny panes, endless controls, slow hydration | Static-first text; restrained companions; lazy labs; the budgets of §16.4; real narrow-screen testing |
| Overengineering delays learning | Schemas and receipts grow while no one can understand a passage | Brownian reference slice first; every batch closes a reader-visible capability; stop rules |
| Generated explanations | Model-drafted prose ships unreviewed, or a chatbot answers in the reading path | Every explanation has a named reviewer in the receipt; no live language-model generation at launch |
| Reproducing a textbook myth | "The photoelectric effect proves photons"; "Michelson–Morley made Einstein do it" | The required margin entries and the misconception ledger are audited per paper |
| Home experiment expectations | A reader gets $N = 2\times10^{23}$ and concludes the physics is wrong, or buys the wrong microscope | The protocol states optics requirements and uncertainty up front; the result is an interval with the dominant uncertainty named |
| Reading-face weight from four rendered readings | HTML bloat on mobile | 250 kB gzipped budget with JSON fragment fallback |
| Letters reproduced | Letters quoted at length from an editorial edition | Letters paraphrased; photographs come from public-domain sources and carry a credit |
| Bit-identity overclaimed | "Deterministic" promised across libm implementations | The guarantee is stated precisely (§12.9) and recorded per comparison |

**Decisions made by this plan.** The content unit is an argument linked to
a source passage. The default is a guided English reader with optional
deeper detail. The source remains directly accessible. The 1904 perspective
is an authored constraint. Three.js is a presentation tool. Numerical
capabilities belong upstream. The core product is static-first and needs
no login or hosted model. Four papers are flagship; the dissertation is a
companion. A new translation is made from the German. DNS-only records at
launch. Brownian §§4–5 is the reference slice; mass–energy is the first
complete paper.

**Decisions to resolve during implementation.** The final license and
rider for new code and content; the distribution basis for each scan; the
reviewers for the English editions; framework and package versions after a
compatibility and security review; the exact upstream ownership of the
missing capabilities; the device profiles for performance budgets; whether
the companion record ships at launch or after. These are made at the point
where they affect work; they do not justify deferring source inventory,
content writing, or the first slice.

---

## 21. Definition of a Successful Launch

The site may call itself a complete edition when the following hold
together.

**The corpus is complete.** All four documents are represented in full,
including the sections and qualifications that popular accounts omit.
Every source unit has a stable locator, a reviewed English rendering, and
an appropriate explanation. The site distinguishes original wording,
translation, interpretation, and later mathematics.

**The entry paths are real.** Each paper has a tested first encounter
requiring no algebra, an explicit bridge to its core argument, targeted
help for different obstacles, and equivalent essential actions without
sight or dragging. No examination, account, payment, or inferred ability
profile controls access. Full English publication does not imply that
every language edition is reviewed.

**The arguments are reconstructible.** A reader can follow each main
result without a circular premise, an unexplained change of variables, an
invisible assumption, or a missing prerequisite. The four journeys present
genuine problems and reasonable alternatives, labeled as routes one could
take.

**The instruments answer questions.** All core instruments have their
specified coverage, usable controls, linked outputs, visible assumptions,
`notModeled` lines, and accessible alternatives; an instrument may be a
mode of a shared workbench rather than a separate page.

**The computation is real and bounded.** Reusable numerical owners live in
FrankenSim; the browser calls admitted exports where specified; displayed
results come from accepted, versioned snapshots; numerical and stochastic
checks pass; fallback behavior is truthful; a model consequence is never
mislabeled as historical evidence.

**The book works as a book.** Beautiful and readable on a narrow phone and
a large screen; text, equations, source references, and essential
explanations survive disabled JavaScript, reduced motion, unavailable
WebGL, print, and slow loading; keyboard and assistive paths are
first-class.

**The publication is maintainable.** Corrections propagate through
explicit source relationships; dependencies and artifacts are pinned; the
candidate passed the release checks; rollback restores a coherent version;
no source, translation, image, or code license was assumed from
availability online.

**The final product test.** Invite readers with different starting points
to choose a question from a paper and an accomplishment they care about
(appreciate, explain, predict, derive, or critique), then ask them to
communicate their understanding to another person, starting from the
problem rather than the famous equation. Can they state what is being
measured, why the old assumptions are inadequate, what new move is made,
what mathematics connects the steps, and where the conclusion stops
applying? A successful route lets a reader do this at the chosen level,
find the original passage, and see the next bridge rather than a locked
door. Test the no-algebra, nonvisual, and full-derivation routes
independently. The project succeeds by repeatedly removing documented
barriers while preserving the intellectual substance.

---

## 22. Appendices

### 22.1 Primary sources

- A. Einstein, *Annalen der Physik* (4) 17 (1905) 132–148; 549–560;
  891–921; (4) 18 (1905) 639–641; (4) 19 (1906) 289–306; (4) 34 (1911)
  591–592; (4) 20 (1906) 627 (the center-of-mass argument, crediting
  Poincaré 1900).
- *The Collected Papers of Albert Einstein*, Vol. 2 (Princeton, 1989),
  documents 14, 15, 16, 23, 24 with editorial notes; Vol. 5 (the Habicht
  letter); the English translation supplement (Beck) as a witness only.
- H. A. Lorentz, *Versuch einer Theorie der electrischen und optischen
  Erscheinungen in bewegten Körpern* (1895); Proc. Royal Netherlands Acad.
  6 (1904) 809.
- H. Poincaré, "La mesure du temps," Revue de métaphysique et de morale
  (1898); "La théorie de Lorentz et le principe de réaction," Archives
  néerlandaises 5 (1900) 252; the St. Louis address (1904); Comptes rendus
  140 (5 June 1905) 1504; Rendiconti del Circolo Matematico di Palermo 21
  (1906) 129.
- M. Planck, Verh. Dtsch. Phys. Ges. 2 (1900), the October and December
  papers; *Annalen* 4 (1901) 553; Verh. Dtsch. Phys. Ges. 8 (1906) 136.
- P. Lenard, *Annalen* 8 (1902) 149. W. Sutherland, Phil. Mag. (6) 9
  (June 1905) 781. L. Bachelier, Ann. Sci. École Norm. Sup. 17 (1900) 21.
  M. von Smoluchowski, *Annalen* 21 (1906) 756. F. Exner, *Annalen* 2 (1900)
  843. G. Gouy, J. Phys. 7 (1888) 561. P. Langevin, Comptes rendus 146
  (1908) 530.
- J. Perrin, *Annales de chimie et de physique* 18 (1909) 5; Nobel lecture
  (1926). J. Bancelin, Comptes rendus 152 (1911) 1382.
- R. A. Millikan, Phys. Rev. 7 (1916) 355. A. H. Compton, Phys. Rev. 21
  (1923) 483. W. E. Lamb and M. O. Scully, in *Polarisation, Matière et
  Rayonnement* (PUF, 1969). H. J. Kimble, M. Dagenais, L. Mandel, Phys. Rev.
  Lett. 39 (1977) 691.
- W. Kaufmann, *Annalen* 19 (1906) 487. A. H. Bucherer, Phys. Z. 9 (1908)
  755. M. von Laue, *Annalen* 23 (1907) 989. H. E. Ives and G. R. Stilwell,
  J. Opt. Soc. Am. 28 (1938) 215. J. C. Hafele, Nature 227 (1970) 270.
- H. E. Ives, J. Opt. Soc. Am. 42 (1952) 540; J. Stachel and R. Torretti,
  Am. J. Phys. 50 (1982) 760.
- J. D. Cockcroft and E. T. S. Walton, Proc. R. Soc. A 137 (1932) 229;
  K. T. Bainbridge, Phys. Rev. 44 (1933) 123.
- T. Li et al., *Science* 328 (2010) 1673; R. Huang et al., *Nature
  Physics* 7 (2011) 576. E. Cunningham, Proc. R. Soc. A 83 (1910) 357.
  A. J. Berglund, Phys. Rev. E 82 (2010) 011917.

### 22.2 Secondary sources the historian's margin may cite

A. Pais, *Subtle Is the Lord* (1982); J. Stachel (ed.), *Einstein's
Miraculous Year* (1998); P. Galison, *Einstein's Clocks, Poincaré's Maps*
(2003); J. Rigden, *Einstein 1905* (2005); J. Renn (ed.), *Einstein's
Annalen Papers* (2005); A. I. Miller, *Albert Einstein's Special Theory of
Relativity* (1981); T. S. Kuhn, *Black-Body Theory and the Quantum
Discontinuity* (1978); M. Nye, *Molecular Reality* (1972); R. W. Home on
Sutherland (2005).

### 22.3 Education, accessibility, and technical references

D. Klahr and M. Nigam, Psychological Science 15 (2004) (direct instruction
in a children's science task); D. L. Schwartz and T. Martin, Cognition and
Instruction 22 (2004) (invention as preparation for future learning);
M. T. H. Chi et al., Cognitive Science 13 (1989) (self-explanation);
H. L. Roediger and J. D. Karpicke, Psychological Science 17 (2006)
(retrieval and retention); L. Deslauriers et al., PNAS 116 (2019)
(perceived versus measured learning). Each is bounded to its studied
population and task; the site's designs inspired by them remain proposals
to test. W3C WCAG 2.2 and the supplemental cognitive guidance; the
WAI-ARIA slider pattern; PhET's inclusive-design statement; KaTeX options
and security guidance; MDN on `WebAssembly.instantiateStreaming` and
`Number.MAX_SAFE_INTEGER`; React `useSyncExternalStore`; BIPM SI defining
constants and NIST constants; Vercel's guidance on Cloudflare in front of
Vercel and Cloudflare's proxy-status documentation; U.S. Copyright Office
Title 17 on translations as derivative works.

### 22.4 The 1905 letter, paraphrased for the timeline

In May 1905 Einstein wrote to his friend Conrad Habicht that he would send
him four papers: one on radiation and the energy properties of light,
which he called very revolutionary; one determining the true sizes of atoms
from diffusion and viscosity of dilute solutions (the dissertation); one
showing that particles of about a thousandth of a millimeter suspended in a
liquid must perform a visible random motion caused by heat; and one, still
a rough draft, on the electrodynamics of moving bodies using a modified
theory of space and time. The mass–energy paper is absent from the letter;
it was written in September.

### 22.5 Naming conventions

- Route slugs: `light-quanta`, `brownian-motion`, `special-relativity`,
  `mass-energy`, `molecular-dimensions` (companion). Bibliographic keys:
  `ap-<volume>-<first page>`.
- Instrument ids: `lq-01` … `me-03`; modes as `lq-08:count-model`.
- Anchors: `#s<n>`, `#s<n>-p<m>`, `#s<n>-p<m>-s<k>`, `#eq-<printed>` or
  `#eq-s<n>-d<j>`, `#result-<slug>`, `#arg-<id>`, `#lab-<id>`; paper 4 uses
  `s0`.
- Canonical quantity ids: lower camel case, semantic, frame-tagged where
  needed (`frequencyEnergyDensity`, `stoppingPotentialMagnitude`,
  `transverseForceComoving`).
- Files: `public/papers/pdfs/<key>.pdf`,
  `public/papers/transcripts/<key>-reviewed.txt`,
  `content/source-blocks/<slug>/…`, `content/translations/<slug>/…`,
  `content/equations/<slug>/…`, `content/experiments/<id>.yaml`,
  `content/scenarios/<id>.yaml`, `docs/provenance/<key>.md`.

### 22.6 Instrument-to-result cross-reference

| Paper | Instruments | Results probed |
|---|---|---|
| 1 | LQ-01 … LQ-09 | wave successes; the unbounded classical total; $N$ from Planck; Wien entropy with $C(\nu)$; independent configurations; the coefficient match; Stokes's rule; the photoelectric equation; the ionization bound |
| 2 | BM-01 … BM-08 | the observable; osmotic pressure; the configuration integral; force balance; the diffusion equation; the Gaussian and radial laws; $\lambda_x$; the inversion to $N$ with its interval; measurement bias |
| 3 | SR-01 … SR-13 | synchronization; simultaneity and rods; the constructed map; clocks; velocity composition; the transformed field equations; the frame change; Doppler and aberration; the light complex; the mirror; charge and current; electron dynamics |
| 4 | ME-01 … ME-03 | the two ledgers; the coefficient; the system boundary and the cards |
| connections | the Avogadro lab; the light thread; the five reasoning instruments | three determinations of $N$; one pulse through three papers |

### 22.7 Revision history

**Version 1.0** established the architecture inherited from Classic
Patents, the corpus identity, the bilingual edition, the four readings,
the instruments, the discovery paths with dated shelves, the FrankenSim
exports, and the phased plan.

**Version 1.1** (second-pass review) corrected the page count (63, not
38), the printed Brownian example (1 $\mu$m diameter, radius 0.5 $\mu$m),
the two-pulse tolerance ($\tfrac{3}{4}(v/c)^2$), the Sutherland date (June
1905; Dunedin January 1904), the train-and-embankment date (1917), the
misuse of the fixed `heat_frames` demo, the "Philox-compatible LCG"
mislabel, the cookie-based depth persistence, the duplicate discovery URL,
and the inconsistent sentence-id scheme; it added the required
historian's-margin entries, the misconception ledger, tours, predict mode,
show-the-code, the kitchen experiment, the interlinear gloss, build-time
KaTeX, spoken forms, the dimensional gate, numeric exercise checking,
offline support, the clarity signal, and the rights caution on letters,
photographs, and likeness.

**Version 2.0** (comparative review and hybrid rewrite) reorganized the
plan around an argument as the content unit and the five accomplishments,
replaced the single ability-tiered dial with three orthogonal reader
choices plus the "what is getting in the way?" menu while keeping the four
authored readings, added the zero-assumed-algebra layer and the four
no-algebra first encounters, the four historical statements and the
anachronism controls, the minimum explanation unit, the no-circularity
rule, the meaning-survives-representation contract, the returnable reader,
the foundation library, the preserved calculations of §8 (the entropy
integration constant, the spectral-coordinate traps, the photoelectric
sign conventions, the two Brownian routes, the specified inference model
with its chi-square interval, inversion bias, identifiability, observation
noise, exposure, censoring, and radial law, the constructed Lorentz map
with its scale factor and transverse step, the covariant comparison rule,
the light-complex volume factor, the moving-mirror intercepted power, the
historical force conventions, the two ledgers with symbolic offsets and
the finite-speed proxy), the 33-instrument catalogue with action
contracts and typed non-numeric results, the typed content model with a
semantic expression tree and stable ids, the four kinds of meaning, the
instance-scoped runtime with command classes and 64-bit identity
transport, the precisely stated determinism guarantee, the adversarial
fixtures, the methodological essays, the 1904 desk, the five shared
reasoning instruments, the capstones, the comprehension-testing protocol
and rubric, the full acceptance scenario, the release manifest, the
batch-based delivery plan with the Brownian §§4–5 reference slice, the
innovation sequence with stop rules, and the definition of a successful
launch. It kept Einstein's printed numbers as historical fixtures beside
modern golden scenarios, the companion record and the Avogadro lab, the
concrete FrankenSim audit and the three first exports, the misconception
ledger, the required margin entries, the gloss face, the kitchen
experiment (now on the specified inference model), show-the-code, tours,
embeds, the clarity signal, the Bern bridge, the DNS zone hygiene, and the
dated shelves.

---

*End of plan. This document is the source of truth until superseded by a
numbered revision committed to the repository.*
