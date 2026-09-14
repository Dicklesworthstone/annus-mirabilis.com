# AGENTS.md: Annus Mirabilis

Guidelines for AI coding agents working in this repository.

---

## RULE 0: THE FUNDAMENTAL OVERRIDE PREROGATIVE

If I tell you to do something, even if it goes against what follows below, YOU MUST LISTEN TO ME. I AM IN CHARGE, NOT YOU.

---

## RULE NUMBER 1: NO FILE DELETION

**YOU ARE NEVER ALLOWED TO DELETE A FILE WITHOUT EXPRESS PERMISSION.** Even a new file that you yourself created, such as a test code file. You have a horrible track record of deleting critically important files or otherwise throwing away tons of expensive work. As a result, you have permanently lost any and all rights to determine that a file or folder should be deleted.

**YOU MUST ALWAYS ASK AND RECEIVE CLEAR, WRITTEN PERMISSION BEFORE EVER DELETING A FILE OR FOLDER OF ANY KIND.**

This explicitly includes pinned facsimile PDFs, reviewed ledgers, content records, provenance receipts, generated WASM artifacts, retained test evidence, `.next`, and caches.

---

## RULE NUMBER 2: ZERO TOLERANCE FOR LEGACY PAGES ROUTER (`src/pages`) OR ROGUE ROOT FILES

**UNDER NO CIRCUMSTANCES IS ANY AGENT EVER PERMITTED TO CREATE A `src/pages` DIRECTORY, RECREATE LEGACY PAGES-ROUTER FILES (`_error.tsx`, `_app.tsx`, `_document.tsx`, `index.tsx` under `src/pages`), CREATE A SECOND APP ROUTER ROOT, OR SCATTER UNAPPROVED ROOT SCRATCH FILES IN THIS REPOSITORY.**

**VIOLATION OF THIS RULE CARRIES IMMEDIATE INSTANCE TERMINATION AND PERMANENT BANISHMENT FROM THIS PROJECT FOREVER WITH ZERO EXCEPTIONS.**

1. **Pure Next.js App Router architecture only.** Every route lives in the single `src/app/` root. Next.js activates legacy Pages Router dual resolution when `src/pages` exists (even empty, even holding a single `.keep` file), which corrupts static page data collection, route manifests, Open Graph metadata routes, and pre-rendering.
2. **Never create `src/pages` for any reason.** Error boundaries belong in `src/app/error.tsx` and `src/app/global-error.tsx`. The 404 handler belongs in `src/app/not-found.tsx`.
3. **No rogue root scratch files.** Do not generate temporary Python, JavaScript, TypeScript, or shell scripts in the repository root or the source tree. Use your session scratch directory or proper typed test fixtures.
4. **Permanent enforcement gate.** The architecture test and `scripts/verify-content.ts` (both specified in the task graph) fail every build and pipeline run on `src/pages`, a second app root, or unapproved root files. Until those gates exist, this rule binds you exactly the same way.

---

## Irreversible Git & Filesystem Actions: DO NOT EVER BREAK GLASS

1. **Absolutely forbidden commands:** `git reset --hard`, `git clean -fd`, `rm -rf`, or any command that can delete or overwrite code or data must never be run unless the user explicitly provides the exact command and states, in the same message, that they understand and want the irreversible consequences.
2. **No guessing:** If there is any uncertainty about what a command might delete or overwrite, stop immediately and ask the user for specific approval. "I think it's safe" is never acceptable.
3. **Safer alternatives first:** When cleanup or rollbacks are needed, request permission to use non-destructive options (`git status`, `git diff`, `git stash`, copying to backups) before ever considering a destructive command.
4. **Mandatory explicit plan:** Even after explicit user authorization, restate the command verbatim, list exactly what will be affected, and wait for a confirmation that your understanding is correct. Only then may you execute it.
5. **Document the confirmation:** When running any approved destructive command, record (in the session notes or final response) the exact user text that authorized it, the command actually run, and the execution time.

---

## Branch Policy

- The primary branch is `main`.
- Work happens on `main`. Do not create feature branches unless the user explicitly asks for one.
- Do not reference `master` in docs or scripts.

---

## Project Status: Read This First

This repository is at the planning stage. It contains:

- the master plan, [`COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md`](./COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md) (version 2.0);
- the task graph in `.beads/`, managed with `br` and analyzed with `bv`;
- this file, the README, the license, and repository configuration.

No application code, content record, facsimile, WASM artifact, or deployment exists yet. Paths, scripts, routes, and tests named below describe the **planned** layout. Never claim that a file, script, test, route, or deployment exists until you have created it and verified it. When a bead names a planned script, create it as specified instead of assuming it is already there.

Superseded local plan drafts (`COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_ASTRA*.md`, `COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_FABLE*.md`) may sit beside the master plan. They are ignored by git and are never a source of requirements.

**Sources of truth.** The master plan records intent and reasoning. The beads are the executable work queue, and each is written to stand on its own. Several beads record corrections to the plan found while converting it (numerical claims that failed a check, fixtures that would not expose the bug they were meant to catch). If a bead and the plan disagree, do not silently pick one: record the evidence with `br comments add <id> "..."` and raise it with the user.

---

## Project Mission

**Annus Mirabilis** (`annus-mirabilis.com`) is an interactive critical edition and discovery laboratory for the four papers Albert Einstein sent to *Annalen der Physik* in 1905, plus his doctoral dissertation as a companion record:

| Slug | Paper (as printed) | Locator | Bibliographic key |
|---|---|---|---|
| `light-quanta` | *Über einen die Erzeugung und Verwandlung des Lichtes betreffenden heuristischen Gesichtspunkt* | Ann. Phys. (4) 17, 132–148 (received 18 March, published 9 June 1905) | `ap-17-132` |
| `brownian-motion` | *Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in ruhenden Flüssigkeiten suspendierten Teilchen* | Ann. Phys. (4) 17, 549–560 (received 11 May, published 18 July 1905) | `ap-17-549` |
| `special-relativity` | *Zur Elektrodynamik bewegter Körper* | Ann. Phys. (4) 17, 891–921 (received 30 June, published 26 September 1905) | `ap-17-891` |
| `mass-energy` | *Ist die Trägheit eines Körpers von seinem Energieinhalt abhängig?* | Ann. Phys. (4) 18, 639–641 (received 27 September, published 21 November 1905) | `ap-18-639` |
| `molecular-dimensions` (companion) | *Eine neue Bestimmung der Moleküldimensionen* | Ann. Phys. (4) 19, 289–306 (1906); Einstein's correction (4) 34, 591–592 (1911) | `ap-19-289` |

It is not an Einstein biography, a physics encyclopedia, or four illustrated summaries. The visitor moves continuously between five projections of one content model: the exact German passage, a faithful English translation, an explanation at the depth the reader asks for, an instrument that interrogates the claim, and a reconstruction of the problem before its solution was known.

Classic Patents organizes its exhibits around a patented mechanism and asks "How does this mechanism work?" Annus Mirabilis organizes around an **argument** and additionally asks: "What would make a reasonable person suspect this idea, and what distinguishes that suspicion from a derivation or a test?"

> You encounter a real difficulty. You try a plausible response. You find out precisely what it preserves and what it breaks. You acquire one more mathematical tool. Then you make a small, consequential move yourself. Only afterward do you see where that move appears in the paper.

This must never become a disguised multiple-choice quiz in which every alternative is foolish, and it must never pretend that Einstein's conclusions followed inevitably from everything known in 1904.

### Non-negotiable product outcomes

1. **Complete papers.** Every original paragraph, displayed equation, substantive inline equation, footnote, qualification, date-line, acknowledgment, and reference has a place in the edition. The difficult closing sections (paper 3, §§6–10; paper 1, §9) never disappear behind the familiar headlines.
2. **No prerequisite dead ends.** Unfamiliar mathematics opens into an explanation with a worked example, a picture or manipulable construction, and a route back to the exact interrupted argument.
3. **Equations are readable instruments.** Symbols, operations, units, assumptions, frames, and live quantities are linked explicitly. Color helps identify meaning and never carries meaning alone.
4. **Discovery is a first-class editorial product,** with reasonable alternatives, evidence limits, and chances to predict before seeing results. The full explanation is available regardless of the prediction.
5. **FrankenSim owns the reusable computational physics.** The website owns presentation and teaching sequences. Missing generic capabilities are developed upstream, not duplicated in page components.
6. **The reading experience is excellent without a GPU, without running a simulation, and without JavaScript.** Expensive features enhance the book; they never hold it hostage.
7. **The no-algebra route is not a lesser website.** It reaches the same source passages, the same instruments, and the same scientific claims, and its bridges are authored with the same care as the derivations.

### Non-goals for the first release

- Not a biography. Bern, Mileva Marić, the Olympia Academy, and the patent office appear only where they explain the physics or its reception.
- Not a general relativity site, a history of quantum mechanics, or a Schrödinger laboratory. Where a 1905 remark is only understood with later physics (the equator-clock note, the transverse mass), the historian's margin says so and stops.
- Not a popular-science paraphrase. The German is the source face; the translation is checked against it line by line; explanations retain units, limits, and uncertainty.
- Not a social network, payment system, account system, or open-ended automated tutor. **No hosted language model sits in the reading path at launch.**
- Not a port of the renderer to Rust, not a 3D scene for every diagram, and not a new numerical library adopted because it is fashionable.

### The governing design test

When proposing a feature, name a reader obstacle, show the simplest working interaction that addresses it, and specify an observable sign of improved understanding. Novelty alone is not a reason to ship. A new color theme, camera preset, or duplicated wrapper is not another scientific instrument. The most valuable innovations here are semantic links between representations, explanations that diagnose a specific missing step, fair comparisons between alternative models, and scientific participation without assumed mathematical or sensory abilities.

### The audience

Anyone who wants to understand: readers with no algebra, rusty or strong mathematical preparation, different first languages, disabilities, limited time, or modest devices. **A reader never declares a profession, passes a placement test, or is assigned a level.** Readers choose an **activity** (Read, Discover, Experiment), a **detail** (Overview, Full explanation, Show every step), and a **perspective** (Paper and contemporary context, or an explicit modern lens). The five accomplishments (appreciate, explain, predict, derive, critique) overlap and are not a ladder of worth. The site never hides the source, disables advanced material, or silently simplifies future pages because of an earlier choice.

---

## Product Shape & Tech Stack

1. **Web frontend.** Next.js App Router, React, and strict TypeScript. Select current supported, mutually compatible versions at kickoff after a compatibility and security review, then lock them. A framework migration is never part of the scientific critical path.
2. **Styling and typography.** Restrained Tailwind. One reading serif (Newsreader), one interface sans (Plus Jakarta Sans), JetBrains Mono for telemetry and code, and KaTeX's own fonts for mathematics, all self-hosted and subset without dropping needed glyphs (German diacritics, Greek letters, subscripts, primes, old notation). Three themes: **Annalen** (default light: journal cream, black ink, red only for emphasis and the move step), **Kramgasse Night** (dark slate with lamplight amber), and **Slate** (chalkboard, chosen automatically on `/discover` unless the reader has set a theme). Text contrast is checked at WCAG AA for every color pair.
3. **Mathematics.** KaTeX HTML plus MathML rendered at build time from a semantic expression tree. Only term and operation interaction hydrates. Malformed mathematics fails publication; raw `$LaTeX$` is never visible to a reader.
4. **Instruments.** SVG and Canvas by default; direct Three.js only where 2D loses spatial information. Three.js, the PDF viewer, and WASM never enter the initial reading route's dependency graph.
5. **Numerical owners.** FrankenSim (`~/projects/frankensim`, Rust nightly) compiled to a slim, feature-selected WASM artifact loaded in a dedicated Worker, plus audited TypeScript reference evaluators under `src/physics/reference/` that run as labeled host calculations and fallbacks.
6. **Content.** Declarative records (JSON or YAML, plus constrained Markdown for long prose) under `content/`, validated and joined by a build-time compiler into route-local payloads. Executable MDX, functions, runtime objects, and untrusted JavaScript never live in content files.
7. **Tooling.** Bun for tests and scripts, Biome for lint and format, `tsc --noEmit` for types, `ubs` for bug scanning.
8. **Hosting.** Vercel through the verified prebuilt candidate-then-promote release script; Cloudflare as registrar and authoritative DNS with DNS-only records at launch. `vercel.json` keeps `{"git": {"deploymentEnabled": false}}`.
9. **Privacy.** No accounts, no third-party scripts, no fingerprinting, no advertising, no hosted model. Reading progress, notes, tours, and predictions stay in local storage. The single analytic is the cookieless clarity signal.

---

## Relationship to the Donor Projects

Classic Patents is the architecture donor and FrankenSim is the numerical owner. **Do not fork Classic Patents and delete most of it.** Start from a small, attributable extraction of proven components and contracts, and preserve the license notices (including the rider language) on every extracted file. A shared package is extracted only after a second concrete use establishes its interface; never invent a "museum framework" before the Einstein reader works.

The planning audit inspected classic-patents.com at `da11ff475902728fd8dd1d9db9f3af37c16ec8a5` (2026-09-05) and frankensim at `5bbbfae6f7de614422f6f97f5798a3e00f8ad813` (2026-09-13). That was source and document inspection, not an execution audit. `docs/DONOR_AUDIT.md` pins the exact revisions actually used at kickoff, and every claim about donor code is a claim about a pinned revision. Trust the donor's manifest, lockfile, and executing code over its prose: its `package.json` declares `next`, `react`, `three`, `katex`, `pdfjs-dist`, and `zod`, and does not declare React Three Fiber even though some prose mentions it.

| Donor seam (classic-patents.com) | Decision | Adaptation here |
|---|---|---|
| Pinned PDF + reviewed ledger + authored edition + provenance receipt | Reuse the architecture | Bilingual editions, many-to-many alignment, notation concordance, separately attributed editorial notes |
| `src/components/ui/LatexRenderer.tsx`, `TextWithLatex`, `HudText` | Adapt | Build-time static KaTeX (HTML + MathML); hydrate term interaction only; malformed math fails publication |
| `src/components/ui/ColorizedEquation.tsx`, `colorPalette.ts`, `equationValueFormatting.ts`, `src/types/equation.ts` | Refactor | Exact canonical quantity ids (never lookup by human label, never `variableId.startsWith("var_" + id)` token matching), operation-level explanations, derivation chains, notation forms generated from an expression tree |
| `src/components/patents/DualProjectionViewer.tsx`, `patentViewMode.ts` | Reuse the interaction ideas, not the monolith | A reader shell with independently loaded source, translation, explanation, discovery, and laboratory panels; `?view=` deep links kept |
| `src/data/editions/parallelReadings.ts` (keyed by block index) | Replace the addressing model | Stable content ids and many-to-many alignment; inserting a paragraph never shifts annotations |
| `src/physics/usePatentPhysics.ts` (module-global maps keyed by id, a control-change tick) | Replace the ownership layer | Instance-scoped experiments; one accepted immutable snapshot; input revision separate from solver step |
| `src/physics/controlTape.ts`, `tickScheduler.ts`, `transport.ts`, `paramAliases.ts` | Reuse with the new identities | Deterministic tapes, host-fed time, aliasing across instruments and papers |
| `src/physics/genericWasm.ts`, `useGenericWasmSource.ts`, the WASM artifact tests, `lie.ts`, `qty.ts`, `intervals.ts`, `energyLedger.ts` | Reuse | Honest `wasm` / `ts-fallback` / `unloaded` labeling; units; intervals; energy bookkeeping |
| `src/physics/coverageManifest.ts` | Extend | Source, translation, argument, instrument, accessibility, and numerical coverage stay separate dimensions |
| `src/physics/specClauses.ts` (the spec-clause weave) | Generalize | Light the exact premise or conclusion an instrument currently demonstrates, as a pointer and never as a decorative truth glow |
| `src/components/patents/visuals/three/ThreeStudioScene.ts`, `StudioKernelChips`, linked 2D/3D | Selectively adapt | 2D first for event geometry and distributions; 3D only where spatial relations need it |
| `src/components/patents/ArchaicGlossaryModal.tsx`, `src/data/esotericPatentTerms.ts` | Refactor | A section-scoped notation concordance and period vocabulary, never a global dictionary keyed by spelling |
| Telemetry badge, sensitivity slider, control tape scrubber, claim constraint toggle | Adapt | Typed-value entry beside every slider; probe toggles keyed to results |
| `src/components/patents/PinnedPdfFacsimile.tsx`, `usePinnedPdfFacsimile.ts`, `public/pdfjs` | Reuse | Facsimile viewer with a page map to sections and equations |
| Layout chrome, theme toggle, search palette, Open Graph image routes, error boundaries, `robots`, `sitemap` | Reuse | New themes; build-time search index |
| `scripts/verified-production-deploy.ts`, `deployment-target.ts`, `deployment-verification.ts`, `smoke-test-deployment.ts`, `app-router-architecture.ts` | Reuse | Candidate-then-promote release with a release manifest |
| `scripts/verify-data.ts` (pattern), `scripts/e2e-patent-vertical-slices.ts`, `patent-e2e-contract.ts`, `docs/PATENT_E2E_HARNESS.md` | Adapt | The content compiler and paper vertical-slice browser acceptance |
| Patent claims, disputes, categories, lineages, era filters, broadside printing, the audio narration player, the iOS app, wizard reports, generic or Wright-default visual dispatch | **Do not port** | Replaced by argument steps, historical alternatives, evidence, and connections. Unknown experiment ids fail explicitly instead of showing a plausible wrong model |

---

## The Annus Mirabilis Engineering Doctrine

Inherited from Classic Patents and changed where a physics paper is not a patent and an audience of "anyone" is not an audience of working engineers.

1. **Separate source layers.** The pinned facsimile scan; the reviewed German ledger (a diplomatic transcription with page markers, kept as comparison evidence); the German edition (the continuous visitor-facing source face); the English translation (sentence-aligned and attributed); the interlinear gloss; and the explanation layers (four readings, results, discovery, instruments). A later layer never substitutes for an earlier one. Explanations may reorganize ideas, modernize notation, and add derivations; they may never masquerade as source text.
2. **Never dumb down, never gatekeep.** "Show every step" means every step. The no-algebra first encounter leads to the same source passage and the same scientific claim as the full derivation.
3. **Instruments answer questions.** Each instrument carries a coverage obligation: the question it answers, its observable response, its mathematical owner, and its accessible nonvisual equivalent. It is accepted for the relationship it demonstrates, never because something moves.
4. **Kernels own the law.** A reusable physical or numerical law belongs in FrankenSim. A source passage, teaching prompt, historical annotation, visual metaphor, or discovery sequence belongs here. React components format quantities and project accepted coordinates into pixels. They never independently recompute diffusion, transformed coordinates, or emitted energy.
5. **Honest execution labels, earned per snapshot.** "Ideal model, computed with FrankenSim" appears only when an accepted call to the registered owner produced this snapshot. "Ideal model, host calculation" names the audited TypeScript reference evaluator; closed-form physics is not a deficiency, because the papers are closed-form. "Static worked example" and "This experiment is unavailable on this device" complete the public set. A loaded WASM file does not earn the FrankenSim label. Detailed artifact identity sits in an expandable model note.
6. **One accepted snapshot per experiment instance.** Plots, equations, scenes, tables, and accessibility summaries consume the same immutable snapshot. A change of description is not a change of world: an observer change never restarts an experiment, generates new events, or consumes new randomness.
7. **Deterministic replay, stated precisely.** The same admitted model, executable, parameters, constant set, seed, stream semantics, and logical actions give the same scientific state; rendering cadence and worker scheduling never change it. Bitwise identity across all architectures, compilers, and browsers is not promised; every recorded comparison says whether it is bitwise or tolerance-based.
8. **A scientific result is not always a number.** Symbolic, analytic-limit, underdetermined, not-applicable, and outside-domain results are typed states with readable explanations and a useful next action, never `NaN`, infinity, zero, or a silent clamp.
9. **Four kinds of meaning stay separate** (see Epistemic Rules).
10. **No circular explanations and no manufactured historical data** (see Epistemic Rules).
11. **The 1904 boundary is an authored constraint** (see Epistemic Rules).
12. **The book works as a book.** Text, equations, source references, and essential explanations survive disabled JavaScript, reduced motion, unavailable WebGL, print, and slow networks.
13. **No theater.** No invented impact scores, streaks, timers, punitive red crosses, gamified badges, engine-wide "validated" stamps, downloadable "receipts," QR codes, or a single flattering completeness percentage that aggregates translation, instruments, review, and validation.

---

## Epistemic Rules (Build Gates, Not Style Advice)

### Four historical statements are not interchangeable

1. A result was **publicly available** by a given date.
2. There is **evidence Einstein knew or used** it.
3. The **paper itself cites or asserts** it.
4. The **site uses it** in a plausible reconstruction.

The fourth category is always labeled **"A route you could take,"** never "What Einstein thought." A discovery step may use only category-1 items dated on or before the end of 1904, or an explicitly admitted 1905 result whose provenance is shown (the September mass–energy journey may import the relativity paper's §8 light-energy transformation). Every such item is a knowledge card with a source, a date or interval with the `latestYear` the audit uses, the precise proposition, its limits, its availability status (available, parallel work, later confirmation), any Einstein-knowledge evidence when claimed, and the discovery steps permitted to use it. A later experiment (Millikan 1916, Perrin 1909, Ives–Stilwell 1938) can be excellent evidence while being unavailable on the shelf; it appears on the timeline and in "check it against the world."

### Four kinds of meaning

Every argument node, equation, and displayed quantity carries all four, and they are never compressed into one color:

- **Logical role:** definition, assumption, derivation, heuristic inference, empirical observation, qualification.
- **Historical status:** available before the cutoff, introduced in the current paper, later development, pedagogical reconstruction.
- **Model status:** exact within the stated model, approximation, idealized representation, calibrated empirical model, unsupported outside the domain.
- **Execution status:** static illustration, host calculation, accepted FrankenSim/WASM result, unavailable or refused.

### Typed results

| Status | Meaning | Example |
|---|---|---|
| `value` | A finite result with units, semantic kind, owner, and uncertainty metadata where applicable | An admitted diffusion coefficient |
| `symbolic` | A relation whose unspecified symbols remain explicit | An absolute internal energy in the historical ledger |
| `analytic-limit` | A defined limit with its own representation | The point distribution at $t = 0$; the mass coefficient at $v = 0$ |
| `underdetermined` | The admitted information does not select a unique value | Radius and molecular number from diffusivity alone |
| `not-applicable` | The quantity is not defined for this model and question | A stopping potential when no electron is emitted |
| `outside-domain` | The model does not support the requested conditions | A Wien-only entropy comparison in a dense state |

Transport errors, allocation limits, worker cancellation, and missing artifacts are separate **execution outcomes**. A model refusal is not a numerical zero, and a budget refusal is not a physical impossibility. A snapshot may hold valid outputs beside honestly unknown ones if its model permits partial results, but it never mixes quantities from different input revisions to fill gaps. Status names never leak to readers as cryptic warnings; each lesson explains them in ordinary language.

### No circular explanations

Each derivation has an explicit, acyclic dependency graph. The source-order route and the discovery route may traverse it differently; neither may rely on its own conclusion. Prohibited circles, each with a compiler or review check:

- Inferring a molecular count from diffusion while silently using that same count (or a modern exact $k_B$) to construct the supposedly independent data.
- Deriving mass–energy equivalence with a body-energy formula that already assumes it (initializing $E_0 = Mc^2$ or $\gamma Mc^2$).
- "Discovering" the Lorentz transformation by requiring the Minkowski interval as an unexplained axiom in the historical route.
- Treating a photoelectric simulator programmed with a threshold as experimental proof that nature has a threshold.

A simulator makes the **consequences** of assumptions legible. Independent observations are required to test whether those assumptions describe the world. Every instrument says which it is doing. Historical derivation dependencies and modern verification oracles are different edge types: a Lorentz-transform test may use interval preservation without making Minkowski geometry a premise of the 1904 route.

### Meaning must survive a change of representation

Each explanatory treatment carries an authoring contract in the editorial record: the question, the premises retained, the conclusion supported, the approximations introduced, the omissions acknowledged, and the bridge to the fuller treatment. A concrete analogy says where it stops. A simplified account never turns "approximately," "in this idealized case," or "suggests" into "always" or "proves." Replacing an exact expression with a low-speed approximation is a change in mathematical claim, not a change of reading level.

Example: "A more viscous liquid makes the tracer spread less over the same time" is a legitimate introductory consequence. "Doubling the viscosity halves the typical displacement" is false: doubling viscosity halves the diffusivity and changes the RMS displacement by $1/\sqrt{2}$. Every reading preserves that distinction, and an adversarial fixture checks that the site's own numbers do.

### Historical constants, modern constants, synthetic data, real data

- Modern constants are the exact 2019 SI values. Historical constants carry their era, provenance, and precision. The two sets are never mixed in one calculation without saying so. In the modern set $R = N_A k_B$ and $N_A$ is exact by definition, so these are not three independent uncertain inputs.
- Never manufacture a convincing "1904 measurement" by sampling a modern formula and adding noise. Digitized historical measurements are typed `HistoricalDataset` records with table or figure citations, digitizer, and uncertainty, or they are absent.
- A **synthetic inverse exercise** (a labeled generator with a hidden parameter) checks inference machinery, not the existence of molecules. A **historical or real-data inference** uses source-pinned observations with independently established calibration. Demonstration data is conspicuously labeled synthetic until a reviewed, licensed real sequence exists.

### Anachronism controls

| Temptation | Required editorial treatment |
|---|---|
| Open with "ultraviolet catastrophe" | Identify the phrase as Ehrenfest's (1911); distinguish the pre-1905 radiation difficulty from the later textbook narrative |
| Put the full Rayleigh–Jeans history in the 1904 drawer | Audit dates and forms individually: Rayleigh's June 1900 form is on the shelf; Jeans's 1905 correction is not |
| Say Planck had already proposed Einstein's light quanta | Distinguish oscillator-energy elements from radiation behaving as independent quanta |
| Start with photons, wavefunctions, or Bose statistics | Label modern vocabulary and theory; they may not supply hidden historical premises |
| Describe Einstein as proving that light is not a wave | Preserve the wave description's successes and the restricted inference of the light paper |
| Say everyone rejected atoms | Represent real contemporary disagreement and existing molecular reasoning, not an invented consensus |
| Say Einstein explained observations he had studied in detail | Preserve the Brownian paper's stated uncertainty about the reports |
| Use Langevin equations or Wiener-process notation as Einstein's derivation | Offer them as modern computational or mathematical lenses dated 1908 and later |
| Use spacetime diagrams as though they were the paper's presentation | Identify them as a later geometric aid (Minkowski 1908); derive the source result without requiring them |
| Make Michelson–Morley the sole documented cause of the relativity paper | Separate the paper's reference to failed ether-drift detection from claims about Einstein's personal path |
| Conflate contraction with what a camera sees | Separate simultaneous-coordinate measurement from received light and optical appearance |
| Treat modern SI constants as measurements available in 1904 | Use separate historical and modern constant sets with precision and evidential status |
| Use the train-and-embankment lightning picture as the 1905 argument | Label it as Einstein's 1917 popular illustration of §§1–2 |

### Reasonable alternatives deserve a fair hearing

A "wrong turn" specifies a coherent hypothesis and the circumstances in which it works. Galilean transformations remain useful at low speeds; wave models retain enormous explanatory value; deterministic microscopic mechanics can underlie stochastic coarse-grained predictions; Lorentz's ether plus local time produces the same formulas as Einstein's kinematics. A failed alternative must fail on a stated constraint or observation. An alternative that is empirically equivalent within the chosen scope is never declared refuted merely because the site prefers a more economical interpretation. No rival is made to fail by programming every test with the favored conclusion, nobody is mocked, and the site never claims to have searched all conceivable alternatives.

---

## The Content Model

### Typed records, not hand-assembled page blobs

The corpus is declarative and reviewable: structured source blocks, translation units, alignment, notation mappings, argument nodes, foundation lessons, experiment manifests, scenarios, historical premises, datasets, and citations live in text files with schemas (JSON or YAML, plus constrained Markdown for long prose). A build-time compiler joins those records into route-local payloads, validates structure, renders static mathematics, and emits the smallest serializable subset a client component needs. Never create a giant aggregate module (an `allEinsteinContent.ts`) imported into client components. Keep independent records small enough for precise review and parallel work.

### Entities

| Entity | Required identity and semantics |
|---|---|
| `Paper` | Slug, bibliographic key, German and English titles, author line ("von A. Einstein"), dates by type (date-line, receipt, issue publication, later editions), journal record (series, volume, whole-series volume, issue, pages, DOI), ordered source block ids, companion flag |
| `SourceAsset` | Origin URL, acquisition date, SHA-256, MIME type, page mapping, rights status and statement, local publication decision |
| `SourceBlock` | Immutable id, kind (masthead, heading, paragraph, equation, footnote, closing), diplomatic transcription, source locator (PDF page, printed page, region), original label, editorial label namespace, review state, sentence spans |
| `TranslationUnit` | Stable id, one or more source-block references, English text, translator and editor attribution, revision, unresolved alternatives |
| `Alignment` | Explicit many-to-many relation between source spans and translated spans; never relies on matching paragraph counts |
| `GlossUnit` | Word-level German-to-English gloss for a sentence, attributed |
| `EditorialNote` | Author, claim, source support, kind (historian's margin, correction, typographical, dispute, side note), affected blocks, review state |
| `HistoricalPremise` | Proposition, availability date or range with `latestYear`, original evidence, Einstein-knowledge evidence when claimed, status (available, parallel-work, later), admitted discovery stages |
| `ArgumentNode` | Question, premises with edge types, conclusion, logical role, derivation steps, source support, limitations, prerequisites, coverage obligation |
| `Equation` | Semantic expression tree; source and modern notation forms; term and operation ids; canonical quantity bindings; derivation links; numerical bindings; printed number; authored spoken form; readings R0–R3 |
| `Quantity` | Canonical id, dimension with rational exponents, mathematical kind (scalar, vector, density, total, angular or cyclic, coordinate or proper, laboratory or comoving, measured or latent), frame, reference conditions, permitted units, formatting |
| `Foundation` | Learning objective, compact and full explanations, worked example, instrument, prerequisites, stopping point, backlinks |
| `Misconception` | Tempting claim, why it is tempting, what is true at every reading, instrument, anchors, sources |
| `Experiment` | Parameter schema, owner capability, model domain, outputs with statuses, views, default scenario, provenance, `notModeled`, acceptance cases, tape model identity, embeddable flag, predict-mode flag |
| `Scenario` | Exact initial conditions, seed policy, actions, expected invariants, results, or refusals, model and schema versions; golden and adversarial |
| `HistoricalDataset` | Title, full citation with table or figure number, digitizer, date, columns with units, rows, uncertainty, notes |
| `Tour` | Ordered anchors with a budget label and a completion statement |
| `Citation` | Bibliographic record with role (primary, comparison witness, secondary, technical) |

The TypeScript types behind these entities extend the donor's `CuratedSpecificationInline` and `CuratedSpecificationBlock` with `math`, `footnote`, `footnote-mark`, and `closing` kinds. The donor's `ColorizedEquation` data becomes an `Equation` whose LaTeX forms are generated from the expression tree. The donor's `PhysicsControl` is reused as the control schema with the domain fields described under "How to Add an Instrument."

### Stable ids, anchors, and revisions

- Once published, a source-block id never changes because a paragraph is inserted into an explanation or split for translation. Allocate permanent ids and keep explicit aliases for retired or split nodes. A revised claim gets a revision and lineage, never a new meaning hidden behind an old id.
- Anchors are content ids, never array positions, and they are identical across every face, so switching faces keeps the reader's place.
- Keep `contentRevision`, `sourceAssetDigest`, `translationRevision`, `modelVersion`, and `artifactDigest` separate. A changed annotation does not change the physics; a changed physics model does not change which passage was translated.

### Naming conventions

- **Route slugs:** `light-quanta`, `brownian-motion`, `special-relativity`, `mass-energy`, `molecular-dimensions` (companion).
- **Bibliographic keys:** `ap-<volume>-<first page>` (`ap-17-132`, `ap-17-549`, `ap-17-891`, `ap-18-639`, `ap-19-289`). Keys name files and citations and never appear in URLs.
- **Sentence ids:** `s3-p2-s1` is section 3, paragraph 2, sentence 1. Paper 4 has no sections and uses `s0`; the unnumbered introductions of papers 1–3 also use `s0`. A German sentence split into two English sentences keeps the source id with a letter suffix (`s3-p2-s1a`, `s3-p2-s1b`). Substantive inline equations are `s<n>-p<m>-s<k>-m<i>`; footnotes are `s<n>-fn<k>` with the printed mark kept as a label; closing blocks are `closing-dateline` and `closing-ack`; paper 3's part headings are `part-1` and `part-2`. The full grammar lives in `docs/CONTENT_IDS.md`.
- **Anchors:** `#s<n>`, `#s<n>-p<m>`, `#s<n>-p<m>-s<k>`, `#eq-<printed number>` (or the section-qualified `#eq-s<n>-<printed>` when a printed number repeats within a paper) or `#eq-s<n>-d<j>` for an unnumbered display equation, `#result-<slug>`, `#arg-<id>`, `#lab-<id>`.
- **Instrument ids:** `lq-01` … `lq-09`, `bm-01` … `bm-08`, `sr-01` … `sr-13`, `me-01` … `me-03`; modes as `lq-08:count-model`.
- **Canonical quantity ids:** lower camel case, semantic, and frame-tagged where needed (`frequencyEnergyDensity`, `wavelengthEnergyDensity`, `stoppingPotentialMagnitude`, `transverseForceComoving`). A similar glyph is never a binding key.
- **Files:** `public/papers/pdfs/<key>.pdf`, `public/papers/transcripts/<key>-reviewed.txt`, `content/source-blocks/<slug>/…`, `content/translations/<slug>/…`, `content/equations/<slug>/…`, `content/experiments/<id>.yaml`, `content/scenarios/<id>.yaml`, `docs/provenance/<key>.md`.

### Planned layout

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
  physics/reference/       # audited TypeScript reference evaluators, one file per capability
  visuals/                 # SVG, Canvas, and Three.js views that consume snapshots
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
```

This is a proposed structure. Confirm with the relevant bead before creating a new top-level directory.

### What the content compiler rejects

Duplicate ids; missing source blocks; broken alignment edges; unresolved equation symbols; dimension mismatches in supported expressions; invalid parameter dependencies; cycles in a selected proof's prerequisites; dangling citations; impossible date ordering (received before dated, published before received); a discovery step citing a premise whose `latestYear` exceeds the cutoff without the parallel-work or admitted-1905 flag; missing accessibility alternatives; missing `notModeled`; unsupported math commands; experiment references without an owner or an explicit static status; an English equation block that is not byte-identical to its aligned German block; a paper marked complete while required source blocks or explanation obligations are absent; a misconception ledger with fewer than five entries; a hero quote that does not resolve to the edition text at its anchor; a live term that is not an exact canonical quantity id; an explanation that references a nonexistent term; a computed displayed output without an admitted owner; an instrument whose live terms do not appear as identifiers in its pinned kernel source (this rule is registered by the show-the-code work, which owns kernel-source extraction).

It **flags rather than resolves**: translation ambiguity, historical influence claims, approximation claims, and source disagreements. Passing a schema is not evidence of a correct translation or good teaching.

**Dimensions use exact rational exponents.** $\sqrt{Dt}$ has length dimension because its radicand has squared-length dimension; a fractional exponent is never truncated during a check. An expression beyond the validator's capability returns an explicit unsupported-check status and still requires review. It never becomes dimensionally correct by default and is never removed from the historical text. Track the distinctions dimensions cannot settle: cyclic versus angular frequency, a spectral density versus a total, coordinate time versus a proper interval, laboratory versus comoving force, mean square versus variance, measured versus latent position.

### Proof routes and rendering routes

An argument can have several valid proofs. Each proof has an ordered dependency graph, stated entry assumptions, logical move types, and a mapping to source passages, and the graph must be acyclic. The broader network of cross-references may contain cycles; a glossary link is not a logical premise. A rendering route selects authored representations and guidance around a proof; it never silently changes the proof's assumptions. When an explanatory shortcut changes the scope of a conclusion, the record says so and provides the bridge.

---

## Sources, Rights, and Provenance

### Rights basis

- **The German texts are public domain.** They were published in 1905 and 1906 and Einstein died in 1955. The source text may be transcribed, reproduced, and translated freely.
- **Scans are not the text.** A particular scan can carry the scanning institution's terms. Prefer library scans that state open terms. Record URL, retrieval date, stated terms, and SHA-256. Never pin a publisher PDF served under a subscription license. A host's possession of a scan is not a rights determination.
- **Existing English translations are not reused.** Perrett and Jeffery (Methuen, 1923; the Fourmilab electronic text derives from it and changes notation) and A. D. Cowper's Brownian translation (Methuen, 1926) are public domain in the United States by publication date, but their status elsewhere depends on the translators' death dates and the site is served worldwide. Beck (Princeton, 1989) and Arons and Peppard (Am. J. Phys., 1965) are in copyright. **Policy: the site publishes its own translation, made from the German, and cites historical translations only as attributed comparison witnesses in the provenance receipt.** This is the conservative editorial choice, not a legal opinion.
- **Secondary literature** appears as short attributed phrases; everything else is paraphrased with citation.
- **Letters, photographs, name, and likeness.** The Habicht letter and other correspondence are paraphrased, never reproduced; the Collected Papers transcriptions and translations are Princeton's editorial work. No photograph of Einstein is used unless a specific image has cleared terms recorded in its receipt. The Hebrew University of Jerusalem asserts rights in the Einstein name and likeness for commercial and branding uses, so the domain and branding use the year, never the name, and no logo, merchandise, or product uses his name or face.
- **Rights layers stay separate.** Original historical text, facsimile scans, the new translation, new explanatory prose, interactive code, numerical libraries, fonts, images, and historical datasets each carry their own recorded rights status. The code license never implies rights to an embedded scan, dataset, or translation. Preserve inherited notices from Classic Patents and FrankenSim, including their rider language.

### Pinned facsimile sources, in order of preference

1. A library or archive scan of the bound *Annalen der Physik* volumes 17 and 18 (1905) and 19 (1906) with stated open terms (Internet Archive, HathiTrust full view, a university digital library). Whole-issue scans are preferred because they show running heads, page numbers, and editorial context.
2. The University of Augsburg's Einstein-in-Annalen facsimiles and bibliography, as a comparison witness and cross-check.
3. *The Collected Papers of Albert Einstein*, Vol. 2, documents 14, 15, 16, 23, and 24, as a comparison edition and the cited source of editorial notes, never the pinned facsimile. Its deep links have already redirected once, so pin bibliographic identities, not external routing.
4. German Wikisource transcriptions, as a second comparison source for the ledger, never the source face.

The facsimile is immutable once pinned. The bibliographic key, PDF filename, ledger filename, edition files, and receipt must all match. Never replace a pinned PDF because a reading looks surprising; diagnose the reading or the provenance instead.

### Provenance receipts (`docs/provenance/<key>.md`)

Written **before** editorial copy. Required fields:

- Bibliographic key, printed title, author line, date-line, receipt date, issue publication date, journal, series, volume, whole-series volume, issue, pages, DOI as currently resolvable (verified against the publisher landing page at pinning time). Every date is typed.
- Scan source URL, scan rights statement, retrieval date, lowercase SHA-256, page count, and a page map: PDF page, *Annalen* page, section boundaries, and the numbered and unnumbered display equations on each page. PDF page counts can differ from journal page counts when covers or editorial matter are included.
- Comparison witnesses consulted: the Collected Papers document number, the Augsburg facsimile, the Wikisource revision id, and each historical translation.
- Translation credits: translator (human or model, named), review dates, and the reviewer who checked each section against the German, with substantive disagreements against the witnesses recorded.
- Editorial boundaries: which file is the source face, which is the ledger, which is the English face, and which files are research evidence only.
- Suspected historical typographical errors: original reading, proposed correction, reasoning, evidence. The source view keeps the original; a corrected reading may be offered only with an explicit marker. An error in a later translation belongs to that witness, not to Einstein, and source and translation layers keep separate correction histories.
- Editorial acceptance results with reviewer names and dates.

---

## Cloud OCR Only: Hard Resource Policy

**NEVER RUN OCR ON THIS MACHINE.** Local OCR has already caused severe performance degradation, slowed an entire multi-agent campaign, and wasted substantial time in the donor project. This prohibition is permanent and has no convenience, deadline, fallback, or "small batch" exception.

- Delegate every OCR or machine-transcription job to a cloud **GPT-5.6 Luna worker**. This includes `focr`, Tesseract, OCRmyPDF, vision transcription loops, and any other process whose purpose is to recognize text from page pixels.
- Do not install, invoke, benchmark, resume, or monitor a local OCR engine or daemon in this repository or elsewhere on this host. Do not use local CPU, GPU, NPU, or memory for OCR.
- If a Luna worker or the cloud execution path is unavailable, pause the OCR portion and report the blocker. **Do not fall back to local OCR.**
- Give cloud workers bounded, checkpointed page ranges. Preserve partial results after every chunk; never create one monolithic all-papers or all-pages batch. Limit concurrency so results remain reviewable.
- Local agents may inspect a pinned PDF, review already-produced page renders or OCR drafts, and hand-correct or author the ledger and editions. Those activities never authorize starting a local OCR process.
- Cloud OCR output is research evidence only.

**The 1905 typesetting** (roman body, italic mathematics, Greek, fractions, letter-spaced emphasis) defeats naive recognition. **Mathematics is retyped by the editor and compared directly with page images. Parsed PDF text is frequently unreliable for these sources and is never accepted for an equation.**

The ledger is a **diplomatic transcription**: it preserves mathematical content, meaningful punctuation, paragraph order, original spelling (for example `daß`), and original notation, and it normalizes only declared typography such as line-break hyphenation. The file is `public/papers/transcripts/<key>-reviewed.txt`, begins with `--- REVIEWED TRANSCRIPTION PAGE 1 OF N ---`, and contains the complete ordered marker sequence with page anchors. Forbidden leftovers: mid-word hyphens from line wrapping (unless the facsimile hyphenates the word itself), sentences broken into one-word lines, glued paragraphs, ligature and worn-type misreadings, invented, dropped, or reordered words, equation numbers, or dates, modernized spelling, machine confidence tokens, and running headers inside paragraphs. Scan-page furniture belongs in the ledger and the receipt, never in the continuous edition.

---

## How to Add or Revise a Paper Section

A section is unfinished until a reader can read the German, read a reviewed English rendering aligned to it, open every reading, operate the section's instruments, and return to the exact sentence, with and without JavaScript.

### 1. Source blocks

1. Work from the reviewed ledger, never from a machine draft.
2. Allocate permanent block and sentence ids from the printed structure (`s3-p2-s1`). Inventory every paragraph, displayed equation, substantive inline equation, footnote, date-line, acknowledgment, and reference.
3. Give each block a source locator (PDF page index, printed journal page, region on the facsimile), the original equation label where one exists, an editorial label in a distinct namespace where none does, and separate status fields for transcription, mathematical transcription, translation, and review.
4. The source manifest, not a hand-maintained percentage, determines completeness. A block cannot be "covered" by linking to a whole paper.

### 2. Translation units and alignment

1. Draft a close English translation sentence by sentence that **preserves modality and qualification**. "Suggests," "must," "under these assumptions," and "to this approximation" are not interchangeable. A heuristic stays a heuristic, an approximation stays approximate, and an assumed independent measurement never becomes a derived fact.
2. Preserve Einstein's sentence boundaries where English allows. Where a German sentence must be split, both English sentences carry the source id with a suffix, and the alignment records the many-to-many relation.
3. **Notation is not translated.** Keep every symbol as printed on both faces. Never silently replace $V$ with $c$ inside the translation; the notation concordance is a separate annotation layer.
4. Review the alignment and the mathematical meaning independently with the comparison witnesses open. Resolve disagreements by returning to the facsimile and context, never by majority vote among paraphrases. Record substantive disagreements with historical translations in the receipt.
5. Machine-drafted material is never marked "reviewed" because a schema or renderer accepted it. Unresolved readings stay visible in internal review and, where intellectually important, in a public editorial note.

### 3. Term annotations and gloss

- Annotate period words and phrases (*Lichtkomplex*, *molekularkinetische Theorie der Wärme*, *ruhendes System*, *Elementarquantum*, *Kathodenstrahlen*, *Lichtäther*, *Beobachter*, *Trägheit*, *Energieinhalt*) with a definition authored for that occurrence and longer than 80 characters.
- Gloss units are word-level German-to-English glosses for each sentence: all of paper 4 first, then the introductions and key sections of the other papers.

### 4. The four readings

Every paragraph, every equation, and every instrument caption has four authored texts.

| Reading | Name | Assumes | Style |
|---|---|---|---|
| R0 | **Overview** ("in one breath") | Nothing | One or two sentences: what this paragraph says and why it is here. True and complete at its resolution; not a teaser |
| R1 | **Full explanation** (default) | Single-variable and multivariable calculus, basic linear algebra, basic probability, the ideal gas law | The site's main voice. Equations shown and explained; standard tools used with a link to their foundation lesson |
| R2 | **Show every step** | High-school algebra and the willingness to read slowly; where even that is missing, the zero-assumed-algebra layer is embedded | Every symbol defined on first appearance in the section; every step of every derivation shown, including the algebra; every "it follows that" expanded; analogies after mechanisms; foundation lessons embedded inline |
| R3 | **Historian's margin** (modern lens) | R1 | What Einstein wrote and in what notation; where the argument is heuristic; where later physics changed the reading; who had the same result earlier or at the same time. Cited |

- The readings never contradict one another: R0 compresses R1, R2 expands R1, R3 annotates R1. An editor who changes one rereads the others.
- **The R2 test:** a physician who has not used a derivative since 1998 can follow it with effort and without shame. **The R0 test:** a reader with no physics can state what the paragraph claims.
- A reader can open one paragraph at a deeper reading without changing the global choice.
- **Rendering:** all readings are rendered into the static HTML of every paragraph, R1 visible and the others carrying `data-detail` and `hidden`. A two-line inline script in `<head>` reads `localStorage` and `?detail=` and sets `data-detail` on `<html>` before first paint; CSS shows the matching reading. The Detail axis therefore works without JavaScript (R1), search engines index every reading, switching is instant and offline, and `?detail=2` permalinks open at that reading (`rel=canonical` omits the parameter). Budget: 250 kB gzipped for the largest paper's reading face, checked in CI. Over budget, a section's R2 and R3 texts load from a static JSON fragment on first expansion, with real links for no-script readers.

Every substantial explanation answers, as authoring tests rather than six boxes under every paragraph: What question are we resolving? What is already assumed? What does this expression say in ordinary language? Why is this move allowed? What changes when a parameter changes, and what stays fixed? What would invalidate the argument? The prose reads like a well-written book, not an exported database form.

### 5. Equation records

Every displayed equation gets an `Equation` record: a semantic expression tree; source and modern notation forms generated from the tree (or an explicitly authored LaTeX form with validated semantic term bindings for exceptional source typography); exact term and operation ids; canonical quantity bindings; the printed number; an authored spoken form; R0–R3 readings; derivation links; a passing rational-dimension check. Where the paper derives it, add a derivation chain of step, reason, and tool, with the move marked and the tool linked to a foundation lesson. **Never infer meaning by replacing letters in raw LaTeX.** The same symbol means different things in different sections, and a letter can appear inside a command name, exponent, subscript, or annotation.

### 6. Results, misconceptions, margin, and weave

- Every numbered result gets a results-face card: as printed, in modern notation, in one sentence, with its live probe, the misconceptions that cluster around it, and "where this is used later."
- Each paper's misconception ledger holds at least five typed entries with instruments, anchors, and sources.
- The required historian's-margin entries for the paper are typed records with primary sources.
- Result-weave predicates light the German and English sentences that state what an instrument currently demonstrates. The highlight is a pointer, never a claim that truth has been achieved.

### 7. Tests for a section

- SHA-256 pinned to the facsimile bytes; the German edition text is contained in the ledger; no page markers in the edition; the alignment covers every sentence; equation blocks byte-identical across languages; term definitions longer than 80 characters; the hero quote resolves.
- Results read from the edition, never retyped; readings present at every level; every equation anchor resolves; dispute entries carry primary text; shelf dates checked; proof routes acyclic; historical and oracle edge types distinct.
- The browser vertical slice enters through a deep source passage, switches face, opens a foundation, returns to the exact argument, operates an instrument, selects a linked term, and returns to the source.

### 8. Review gates

Review happens at the level of a complete argument, not isolated sentences. Each section needs a German source review of the translation and a physics or mathematics review of each complete derivation, plus an R2 readability review by a non-physicist reviewer. Contributors may fill more than one role where qualified. **Machine-generated drafts never self-certify.** Record acceptance with reviewer names in the provenance receipt. Record corrections against stable source and argument ids: a source correction identifies affected translations and explanatory claims without marking unrelated visual work obsolete, and a visual change does not imply a re-reviewed translation. The short mass–energy paper is reviewed with the same seriousness as the long ones.

---

## The Notation Concordance

A central feature, not a glossary. For each paper and each scope within it, record the original glyph, the section scope where that meaning holds, the definition, the modern symbol, the dimension, the frame or reference condition, and the transformation rule.

Three different operations must never collapse into one:

1. a **symbol rename** ($V \to c$);
2. a **unit-system conversion** (Gaussian to SI in paper 3);
3. a **substantive modernization of the argument** (the modern transverse mass with a different force convention).

A global find-and-replace is unacceptable.

**The two dangerous collisions are called out in red on first use:** Einstein's $\beta$ is the modern $\gamma$ (papers 3 and 4; in paper 1 $\beta$ is Wien's constant $h/k_B$), and Einstein's $k$ in paper 2 is viscosity, not Boltzmann's constant. Other scoped symbols: $L$ (speed of light in paper 1, emitted energy in paper 4, a magnetic-field component in paper 3 §6), $N$ (Avogadro's number in papers 1 and 2, a magnetic-field component in paper 3), $E$ (energy, an electric field, a body's rest-frame energy), $\tau$ (the moving-frame time in paper 3, never the modern proper time; an observation interval in paper 2), $P$ (work function in paper 1, particle radius in paper 2), $\nu$ (frequency in papers 1 and 3, number density in paper 2), $\varphi$ (spectral entropy density in paper 1, the transition kernel in paper 2, an angle in paper 3, a volume fraction in the dissertation), $K$ (a force in paper 2, the stationary system in paper 3, kinetic energy in paper 4), $V$ and $v$ (volume, velocity, or light speed depending on the paper; verify each printed glyph against the facsimile), and $\alpha$.

In paper 3 §3 Einstein also writes $x' = x - vt$ for a Galilean auxiliary coordinate, which is not the moving-frame coordinate; wherever the moving-frame $x'$ also appears, the modern notation form gives the auxiliary a distinct glyph.

**Rendering rule.** The source and translation faces show printed notation. The explanation faces show printed notation by default with a toggle to modern notation. The toggle re-renders every equation from its semantic expression tree, never by string substitution on LaTeX, and updates the colorized sentence and the legend. **"Modern notation" and "modern knowledge" are different choices, modeled independently:** renaming $V$ to $c$ never authorizes importing a later proof.

---

## How to Add an Instrument

An instrument is not accepted because something moves. It is accepted because it answers a stated question with an observable, owned, tested, accessible response.

### The manifest (`content/experiments/<id>.yaml`)

Every instrument specifies: the explanatory question; linked source and argument ids; independent parameters; derived quantities; model assumptions; the admitted domain; the computational owner; the representation mapping (which views show which snapshot fields); accessible equivalents (its action contract); `notModeled` (shown as a plain line; an empty list fails the audit); acceptance cases including refusals and non-numeric results; a tape model identity; the embeddable flag; and the predict-mode flag or a recorded exemption.

### Order of work

1. **Owner first.** Implement or bind the reference evaluator in `src/physics/reference/` and, where specified, the FrankenSim capability, with historical fixtures, modern golden scenarios, and adversarial fixtures passing before any view exists.
2. **Manifest and parameter schema.**
3. **Registry entry and an explicit dispatcher case.** Unknown ids fail explicitly. There is no fallback to another paper's instrument.
4. **Views that consume the accepted snapshot only.** SVG or Canvas by default. No private `useState` copy of a parameter, no recomputation in a component.
5. **Typed results and refusals** with ordinary-language explanations and a next action.
6. **Action contract**: the same scientific action without dragging, color discrimination, sound, or a visual canvas.
7. **Predict mode, show-the-code, embed route, permalink tape.**
8. **Tests and the browser lane**: 320 px, keyboard, reduced motion, no-WebGL, refusal paths, direct numeric entry, and shared-state URLs.

### Parameter design and constraint handling

Each control declares physical dimension, display unit, valid model domain, numerical domain, pedagogical default, step or logarithmic mapping, and whether it is independent or derived. One schema generates the controls, URL-state validation, unit formatting, and test cases.

- Readers can type exact values as well as drag. A control's visual range may be narrower than its mathematical domain; the two are documented separately.
- **Out-of-domain inputs are never silently clamped while the label shows the requested value.** They explain the problem and offer an admissible boundary or a model change.
- Suggested teaching ranges, admitted by the owners: radiation temperature 500–10 000 K with logarithmic frequency over $10^{11}$–$10^{16}$ Hz; photoelectric work function 1–6 eV (hypothetical unless a cited, condition-specific metal card is chosen); photoelectric frequency 100–2 000 THz; Brownian radius 0.1–5 μm in the dilute-sphere model; Brownian viscosity 0.5–20 mPa·s as an explicit fluid parameter (temperature never silently supplies an unmodeled viscosity law, and a gas card refuses because Stokes drag without the Cunningham slip correction is invalid when the mean free path is comparable to the radius); Brownian temperature 273–330 K; signed frame speed $v/c$ within ±0.95 in the core, with no inertial observer at $|v| \ge c$; emitted energy as a positive pedagogical range plus normalized ratios; sample counts and time horizons explicit and finite, with a memory or time budget failure distinct from physical invalidity.
- Sliders suit continuous parameters and nothing else. Use event selection for simultaneity, interval selection for integrals, draggable partitions for volume, coefficient manipulation for transformations, channel selection for energy balances, and expression-level actions for derivations.
- A scene begins with a useful question and a stable default, not a dense control panel; advanced controls sit in an "Experiment settings" drawer. Every reset restores both parameters and experiment history, with "same seed" and "new trial" explicit.

### Action contracts (the same scientific action through different interfaces)

| Instrument family | Visual action | Equivalent scientific action |
|---|---|---|
| Probability and diffusion | Drag a selected histogram interval | Enter lower and upper limits, inspect the interval probability, compare two named intervals |
| Clock and event geometry | Select points on a diagram | Choose named events from a table and ask which frame regards them as simultaneous |
| Radiation entropy | Resize the constrained-state volume | Enter a ratio or choose half, same, or double, with fixed energy and band stated |
| Fields and boosts | Rotate an arrow or move an observer | Select an axis or component and a signed magnitude, then inspect transformed components at the same event |
| Energy accounting | Drag a boundary around objects | Select the objects included in the system and inspect energy crossing that boundary |
| Derivations | Highlight and transform part of an equation | Select a named subexpression, read its role, and advance a justified step |

A long prose description alone is not equivalent to being able to investigate. Conversely, no screen-reader user is forced through every particle coordinate: provide summaries, selectable comparisons, and optional detailed data at the scale of the question.

### Contract additions

- **Predict mode**, on by default for first-time visitors: before the first change the response plot is hidden and the reader chooses one of three candidate curves or sketches on empty axes. The accepted snapshot then draws the real curve over the prediction. The prediction is a `prediction` event on the control tape. An incorrect prediction is a productive starting point, never a usability failure or a judgment of the person.
- **Show the code**: the kernel's actual source (the TypeScript reference evaluator, and the FrankenSim Rust where it applies), extracted at build time with the function's source hash pinned. Identifiers that correspond to equation terms share the term's color. A test asserts that every live term's canonical quantity id appears as an identifier binding in its kernel.
- **Permalink**: the accepted snapshot's identities and the compact valid control tape serialize into `?tape=`, with a bounded size. Canonical document URLs never multiply into an index of slider positions.
- **Embed** at `/embed/lab/[experiment]` with attribution, a link back, and respect for detail, theme, and reduced-motion parameters.
- **Historical overlays** only as typed, cited `HistoricalDataset` records, visually distinct from theoretical curves.
- **True physical rate** with a scale bar where a natural rate exists (the Brownian walk at about 0.8 μm per second beside the sped-up version).

Keep the catalogue finite. The 33 core rows are the launch coverage obligations; no-algebra entrances, nonvisual actions, guided prediction, comparisons, and assumption inspection are cross-cutting capabilities of those rows, not new laboratories. Optional modern deep dives (underdamped Brownian motion, finite-exposure inference, optical appearance, rapidity and non-collinear composition, four-momentum, later confirmations) follow the core and never substitute for a missing core row.

---

## Experiment Runtime Contract

### One accepted snapshot per instance

Every laboratory instance has a unique instance id even when two instances show the same experiment. A single owner advances or evaluates that instance, and every plot, equation, scene, table, and accessibility summary consumes the same accepted snapshot.

| Field | Meaning |
|---|---|
| `instanceId` | This mounted laboratory, independent of other copies |
| `runId` | This experiment realization or parameterized run |
| `inputRevision` | Latest requested physical input set |
| `acceptedInputRevision` | Inputs that actually produced the displayed result |
| `stepIndex` | Accepted logical solver or sample step, never a UI event count |
| `simulatedTime` | Physical or model time of the accepted state |
| `snapshotVersion` | Monotone publication identity of an immutable result |
| `renderTime` | Display or interpolation time; never a hidden physical input |
| `modelVersion` / `artifactDigest` | Mathematical implementation and exact executable identity |
| `seed` / `streamVersion` | Stochastic realization and random-stream semantics |

This replaces the donor's control-change tick, which counted UI events and was never physical time.

### A change of description is not a change of world

| Command class | What changes | What must remain stable |
|---|---|---|
| `setup-change` | Initial physical conditions or governing model | The old run stays identifiable; the new accepted run is explicit |
| `physical-intervention` | Conditions after a specified model time | Earlier accepted history |
| `observer-change` | Coordinate frame, origin, orientation, observer description | Physical worldlines, events, trial identity |
| `measurement-change` | Sampling, projection, exposure, calibration under an admitted observation model | The identified latent trajectory; the measurement result gets a new revision |
| `estimator-change` | Statistic, fitted model, inference assumptions | Selected observation data and their provenance |
| `presentation-change` | Camera, labels, layout, colors, explanation selection | Every scientific state and data identity |

Name the ambiguous cases in ordinary language and test their effects: a camera's physical exposure is a measurement change; moving the viewpoint of the rendered microscope is presentation; a moving detector is a physical component, not a frame choice. Observation cadence subsamples a fixed logical path on a declared replay grid and never consumes a different random stream because the plot interval changed. Equal seeds alone do not guarantee a pathwise-consistent comparison between arbitrary discretizations.

### Worker protocol

- A **request** carries protocol version, experiment id, instance and run ids, input revision, canonical SI parameters, model selection, constant-set identity, seed policy, requested operation, and a finite work budget.
- An **accepted response** carries the matching identities, accepted parameters, simulated time or evaluation point, outputs with dimensions, semantic kinds, and statuses, model-domain information, and provenance.
- A **refusal** carries a typed code, the affected inputs or capability, a readable reason, and possible repairs.
- Large arrays use versioned typed-buffer layouts with explicit dimensions and ownership; scalar summaries use structured JSON under a typed shared schema.
- The decoder rejects nonfinite numbers in value fields, wrong lengths, mismatched units, stale run ids, unsupported schema versions, and unrecognized provenance. Valid nonnumeric states use the tagged result forms, never `NaN`, infinity, or zero.

### Worker behavior, memory, and lifecycle

- Load the numerical module in a dedicated Worker after the laboratory is requested or about to become useful. Bound every work chunk: a cancellation message cannot preempt a synchronous WASM call, so long work yields between chunks.
- Coalesce rapid slider requests. A newer input revision supersedes pending evaluations, and an old result never overwrites the newest accepted run. A refused update preserves the previous accepted snapshot while clearly distinguishing it from the requested settings. Never display old numbers beneath new labels.
- Terminating and recreating a worker is a bounded recovery path only. Switching between 2D and 3D never restarts physics, duplicates the owner, or consumes new randomness.
- Keep large particle buffers out of React state; reuse geometry and buffers; publish UI summaries at a bounded rate; keep scientific stepping and display interpolation on separate schedules.
- WASM memory growth invalidates JavaScript views into linear memory: never retain such a view across untracked reallocation. Use copied or transferred immutable snapshots or a versioned buffer-lifetime contract. Never detach a buffer that a published snapshot still exposes, and never place a mutable buffer behind an "immutable" snapshot.
- Use an instance-scoped external store with cached immutable snapshots and a server snapshot consistent with the initial HTML. `useSyncExternalStore` requires stable snapshots; manufacturing a new object from the same state on every call is a bug. Mount and unmount probes, repeated subscriptions, and route transitions never create duplicate owners, leak workers, or advance randomness.
- Dispose of Three.js materials, geometry, textures, subscriptions, and workers when their owners end. Pause invisible laboratories and limit concurrent heavy ones while preserving replayable state. A depleted performance budget reduces visual detail or pauses with an explanation; it never changes a model's diffusivity or skips scientific time.
- A crash, context loss, or artifact mismatch pauses the laboratory while the book stays usable. Recovery validates a checkpoint's model, schema, parameters, seed, and stream semantics before continuing; otherwise it begins a visibly new run. A checksum is evidence of byte identity, not of compatible meaning.

### 64-bit identities and random streams

- Seeds and draw indices are unsigned 64-bit values; JavaScript's safe-integer range ends at $2^{53} - 1$. Encode them as canonical decimal strings at JSON and URL boundaries, validate range and syntax, and decode with `BigInt` before the WASM boundary. Never serialize a `BigInt` through ordinary JSON without explicit conversion, and never hash a rounded decimal display of a seed.
- Tests cover $2^{53}$ and its neighbors, zero, $2^{64} - 1$, invalid signs, whitespace, overlong input, overflow, and a URL round trip that identifies the same stream after reload.
- Logical stream allocations separate latent motion, measurement errors, and independent trials. A display-only subsample or a new plot never consumes draws from the physical path. Extending an ensemble preserves existing particle identities or explicitly identifies a new experiment. Common random numbers may isolate an effect but are never called independent trials.
- Scientific draws use the recorded logical seed. Ambient browser entropy may choose a new seed only through an explicit "new trial" action, and that seed is then recorded. No `Math.random` in any frame loop or scientific path.

### Tapes, determinism, and fallbacks

- The donor's control tape is reused with model identity, seed and stream version, quantized control events classified by command class, `prediction` events, and checkpoints with a digest (`host:` until `fs-blake3` is bound, then `blake3:`). Authored teaching tapes include "Einstein's 0.8 micron," "Perrin's count," "the boost to 0.6c," "the two pulses," and "the locked positions." The scrubber restores a permalinked tape. Time is host-fed through the tick scheduler.
- The Philox4x32-10 counter's integer output is reproduced bit for bit by the TypeScript port, cross-checked against vectors emitted by `fs-rand` with the same stream-key derivation. The floating-point normal transform is compared native versus WASM and WASM versus TypeScript at a stated tolerance, because elementary-function implementations differ. Fixed random goldens test stream semantics; distribution tests test statistical properties; neither alone proves the physical model.
- The static reader and worked examples are always available. The audited TypeScript reference evaluator is an explicitly labeled fallback for selected algebraic cases, the random walk, and the 1D diffusion stepper (the same FTCS scheme with the same stability refusal). A running stochastic experiment never switches engines without a new identified run and compatible replay semantics.
- Never require `SharedArrayBuffer` or cross-origin isolation. One dedicated worker per active heavy experiment suffices.
- A refusal is a museum label: freeze the illegal step, show the reason, and keep the last legal state.

---

## FrankenSim Binding and Honesty

### The ownership rule

A reusable physical or numerical law belongs in FrankenSim. A source passage, teaching prompt, historical annotation, visual metaphor, or sequence of discoveries belongs in Annus Mirabilis. The browser boundary composes generic capabilities into bounded educational experiments. **Do not create four physics engines named after the papers.** Brownian diffusion should be useful to other projects, Lorentz transformations should be reusable beyond this site, and radiation spectra should never be buried in a React component. Improvements to generic physics land in FrankenSim with an explicit downstream adoption change here, and this repository pins the upstream revision and reruns dependent fixtures when a capability changes.

### Audit capabilities before naming crates

The first physics task is a bounded audit and build probe: identify existing owners for the precise mathematical functions, examine their contracts and tests, compile the needed dependency slice for native and browser targets, and record the actual exports in `docs/FRANKENSIM_BINDING.md`. **A crate's name does not establish its semantics.** The planning audit found that `fs-lattice` is infill optimization and `fs-flux` is Navier–Stokes. Other findings to re-verify at the pinned revision:

- `fs-wasm` already depends on `fs-rand` and `fs-sparse`.
- `fs-rand` provides counter-based Philox4x32-10 streams keyed by logical identity, with normal sampling and versioned checkpoints. Logical stream identity, not thread scheduling, determines the draws. Preserve its stream-semantics version in replays, and choose deliberately between its strict distribution paths and any faster path awaiting stronger admission.
- `fs-wasm`'s existing `heat_frames` is a fixed two-blob 2D demonstration with a hard-coded initial field and a dimensionless time step. It takes no diffusion coefficient, spacing, or profile, so **it is not an honest owner for any diffusion instrument and is not used.**
- `fs-qty` represents base-dimension exponents as integers over six base dimensions. The authoring validator here uses exact rationals and maps to the upstream runtime model only after dimensions and operations are resolved; it is a validator, not a competing units library.
- `fs-demo-physics-wasm` shows the accepted/refusal JSON envelope pattern with version identity and explicit no-claims.
- No ready Brownian, radiation, or special-relativity product API was found. Absence in a search is not proof of absence, and no such capability is assumed.

### The first exports

These are small, can land ahead of the broader owners, and ship through a feature-selected slim artifact rather than the whole `fs-wasm` dependency graph:

```rust
// crates/fs-wasm/src/lib.rs (additions, feature-gated into the slim artifact)

/// Deterministic 1D random-walk trajectories for `n_particles` over `steps` intervals.
/// kernel: 0 = ±1 coin, 1 = uniform, 2 = Gaussian, 3 = Gaussian with the exact D so <x^2> = 2 D t.
/// fs-rand Philox streams keyed by (seed, particle index) so any particle regenerates independently.
/// Returns n_particles * (steps + 1) positions. No std::time on wasm32.
pub fn brownian_frames(n_particles: usize, steps: usize, kernel: u32, seed: u64, diffusion: f64, dt: f64) -> Vec<f64>;

/// Philox-stream standard-normal samples for the configuration counter and the synthetic inference generator.
pub fn philox_normals(seed: u64, index: u64, count: usize) -> Vec<f64>;

/// Explicit (FTCS) 1D diffusion on `n` cells, spacing `dx`, coefficient `diffusion`, step `dt`,
/// profile 0 = spike, 1 = step, 2 = two spikes, zero-flux boundaries, fs-sparse three-point Laplacian.
/// Returns frames * n values. Refuses (typed) when diffusion * dt / dx^2 > 0.5; never a blown-up field.
pub fn diffusion1d_frames(n: usize, frames: usize, steps_per_frame: usize, diffusion: f64, dx: f64, dt: f64, profile: u32) -> Vec<f64>;
```

Three gaps in these signatures must be resolved in `docs/FRANKENSIM_BINDING.md` before implementation:

1. **Kernel scaling.** Only kernel 3 is stated to be scaled so that $\langle x^2\rangle = 2Dt$. Document the per-step distribution and variance of every kernel explicitly, and test each one.
2. **The refusal channel.** A bare `Vec<f64>` cannot carry a typed refusal code. Return a typed envelope (following the `fs-demo-physics-wasm` accepted/refusal pattern) or a result that maps to a typed JavaScript error. An unexplained empty buffer is not a refusal.
3. **The `philox_normals` stream arguments.** `(seed, index, count)` does not say whether `index` is a stream id or a starting draw index, and `fs-rand` stream keys also carry kernel and tile ids. The recommended form is `(seed, kernel, tile, start_index, count)` with `start_index` counting draws.

All exports compile natively (rlib) and to WASM (cdylib), have tests in `crates/fs-wasm/tests/`, and are verified by `scripts/verify-wasm-artifacts.ts` (pinned digests, instantiation, stepping, the Philox cross-check, refusal checks, malformed-output rejection). A composition and transport boundary such as `fs-annus-wasm` may expose versioned experiment operations and serialize results and refusals, but it must never hold a second copy of a law owned by a generic crate. Begin with one native test target and one single-threaded browser target for the Brownian slice; threads, shared memory, SIMD specialization, and GPU compute are optimizations that must earn their complexity through measurements. Add a capability only when a named instrument uses it; the site never waits for unrelated FrankenSim crates to compile for the browser.

### Rust policy

- Safe Rust for new numerical code, with `forbid(unsafe_code)` where compatible.
- No C or C++ physics libraries, hidden FFI solvers, or competing numerical ecosystem. Reuse asupersync and the owner's Franken libraries where they fit.
- The browser package's target-specific `wasm-bindgen` and `getrandom` dependencies are an observed packaging fact, not permission to expand runtime dependencies.
- Pin the Rust nightly (FrankenSim pinned `nightly-2026-07-06` at the planning audit), upstream commits, constellation revisions, generated glue, and lockfiles.

---

## Three.js Scope

Three.js is a presentation tool, not a scientific authority. Use it only where the mechanism is spatial and 2D genuinely loses information:

- the sphere measured as an ellipsoid, with a clock (the SR-03 and SR-05 studio);
- field lines in two frames (SR-08);
- the 1906 box (the ME-03 extension);
- an optional spacetime block view (later).

Everything else is SVG or Canvas. Never build a 3D scene for a one-dimensional random walk. Rendering detail and model fidelity are independent settings: a body may be rendered richly while its governing experiment is a simple analytic ledger. Geometry is procedural and follows the accepted snapshot; no marketplace model files. Three.js loads lazily, never in the initial reading route, and a no-WebGL device gets the static worked case and the textual equivalents. Reduced motion pauses animation and still shows the current state.

---

## How to Add a Discovery Step

Discovery journeys are the site's signature content. Each is a guided reconstruction with a fixed skeleton, labeled **"A route you could take,"** never a transcript of Einstein's private thinking.

1. **The shelf.** A dated list of results a careful reader had by the end of 1904, each a knowledge card with source, one-line statement, limits, and where useful a shelf instrument on the 1904 desk. Nothing after 1904 is on the shelf unless flagged as parallel work. Nothing is invented to smooth the path.
2. **The nagging fact.** The observation or contradiction that does not fit.
3. **The first honest question.** One sentence, second person.
4. **The chain.** Questions in stages, each showing what the reader can compute from the shelf, with the instrument for that step embedded and "show me the reasoning" available at every point.
5. **The forks.** Two or three points where the path offers the real alternatives on the table in 1904. Each branch is worked far enough to show where it leads: a dead end on a stated constraint, a correct but weaker result, an empirically equivalent alternative that is not declared refuted, or the paper's route. Branches that Lorentz, Planck, Poincaré, Nägeli, or Exner took carry their names. Nobody is mocked.
6. **The move.** The one non-obvious step, named as such and marked in the derivation chain.
7. **Check it against the world.** A numerical prediction **computed live from the accepted snapshot**, compared with a dated measurement that is clearly labeled as later evidence where it is.
8. **What Einstein actually wrote.** A jump into the reading face at the section where the paper makes the same move, with the result weave lit.
9. **Exercises.** Two to five problems checked by the kernel or by numerical equivalence (the reader's expression and the reference evaluated at fixed random points through a tiny parsed arithmetic grammar, never `eval`), never by a stored string, plus a predict-perturb-explain task.

Each journey has a **front door** (Einstein's own argument) and at least one **side door** (a loop, a matrix, Fick's law, two accounting sheets) that arrives at the same equation, and the site says so.

**Guided discovery, never compulsory rediscovery.** Offer a fully worked example, a partly completed comparison, an optional prediction, the explanation, and a transfer case. A reader may move directly to the explanation at every point. Guessing the next equation is never a condition for continuing. Do not equate being surprised with having learned, and never use an animation to conceal an omitted inference. No timers, streaks, punitive red crosses, surprise audio, or forced full screen.

---

## Verification

- **Verification is quantity-specific.** For each numerical output record the model, assumptions, dimensions, independent reference, tested domain, error criterion, and evidence. An engine-wide "validated" badge never stands in for those records. Mathematical identity checks, numerical convergence, statistical calibration, comparison with observations, and historical source fidelity are separate questions, and a failure names the layer that needs repair.
- **Three kinds of fixtures stay distinct in data and UI.** Historical fixtures test that the site reproduces what Einstein printed from his stated inputs (for example $N = 6.17\times10^{23}$ from Planck's printed constants; about 4.3 V for $\nu = 1.03\times10^{15}\,\mathrm{s^{-1}}$; $\lambda_x \approx 0.79\,\mu\mathrm{m}$ at 1 s and $6.15$–$6.16\,\mu\mathrm{m}$ at 60 s, printed as about 6 μm, with the exact value depending on the declared constant set for $a = 0.5\,\mu\mathrm{m}$, $\eta = 1.35\times10^{-3}$ Pa·s, $T = 290.15$ K). Modern golden scenarios test calculations and plumbing from modern constant sets. Identities test invariants. Each scenario specifies constants, units, equations, owner, and tolerance.
- **Adversarial fixtures** are deliberately plausible wrong results that must fail for the intended reason: halving diffusivity halves displacement; a radial distribution is an ordinary Gaussian; camera noise leaves neighboring increments independent; an unbiased estimate stays unbiased after inversion; an arbitrary entropy-density constant cancels; a spectral-axis relabeling preserves density; a light complex contracts like material volume (tested with longitudinal rays and with a ray transverse in the moving frame, because a ray transverse in the unprimed frame gives exactly the material factor and cannot discriminate); forces have equal numerical components in different frames; an observer change starts a new experiment; a moving mirror receives the fixed-surface incident power; the low-speed proxy is the exact mass coefficient at every speed; a large seed survives as a JSON number; a 1 μm radius reproduces Einstein's 0.8 μm; the locked-position probability is $f^n$; a neutral conductor with current violates $|J/\rho| < c$.
- **Statistical tests** use reproducible test sets, prespecified tolerances, and adequate sample sizes. Never rerun a flaky statistical test until it passes.
- **Band integration** is checked against an independently implemented high-precision reference, never a second call to the same routine.
- **Precision and tolerance.** Choose displayed precision from the question and the inputs; never show twelve decimals from a model whose viscosity is a rough estimate. Separate the stored full-precision value, the formatted value, the input precision, the statistical interval, and the numerical error estimate. Unit conversions apply to sensitivities as well as values. A probability confidence interval is not an interval-arithmetic enclosure, and a numerical error bar is not a measurement uncertainty. A relative tolerance alone is unsuitable near a true zero, an absolute tolerance alone is unsuitable across orders of magnitude, and a null-interval classification near cancellation may legitimately return an indeterminate boundary result. One shared module, `src/units/tolerance.ts`, implements tolerance comparison for both display and scenario tests.

---

## Accessibility: The Ability to Reason

Target WCAG 2.2 AA with manual verification of mathematics, keyboard-operated instruments, focus restoration, contrast, zoom, screen readers, touch, and reduced motion. Automated checks alone are insufficient. W3C's supplemental cognitive guidance is followed as guidance, not claimed as conformance. Acceptance asks whether the visitor can **perform the intended reasoning**: compare event times, choose a displacement statistic, change a parameter, inspect a conservation balance, explain an equation step. Test those actions with disabled readers using their own tools during the reference slice, before the visual language hardens.

- KaTeX HTML plus MathML, tested on real assistive-technology combinations, with no duplicate announcements from a visual formula and a redundant label. Complex mathematics also exposes a structured textual explanation and step list.
- Each equation's accessible name is an **authored spoken form** (ClearSpeak style), because generated speech is often wrong for physics notation. Not every glyph is a tab stop: a formula reads as a whole, with an optional term-and-operation explorer and a clear way out.
- Every canvas or 3D view has a meaningful description and an inspectable table of selected quantities and events. A graph offers three layers: a statement of what is compared, the current relation after an intentional action, and optional detailed points or event records. A 60 Hz animation never produces a 60 Hz live-region stream; announce committed comparisons or requested summaries.
- Every core control has keyboard and typed-input equivalents (typed value and step buttons beside custom sliders; heed the WAI-ARIA slider pattern's warning about touch assistive technology and test on devices). Tooltip-only explanations are prohibited. No-JavaScript readers get real links, never hydration-dependent buttons.
- Animations are pausable, sound starts muted, and reduced motion pauses random walks and boosts, shows the current state, and keeps the lesson.
- Optional sonification uses an inspectable, consistent mapping and is never presented as a recording of photons, molecules, or time. No essential task depends on hearing.
- A persistent **reading-only** setting suppresses autoplay, expensive scene loads, and decorative motion while keeping every explanation and static worked case. Line length, type size, contrast, and paragraph spacing are adjustable within tested layouts. No unproven "special reading font" is imposed and no learning-style classification is stored.
- Deep links address a meaningful passage or action even without WebGL.

---

## Performance, Security, and Privacy

### Budgets (provisional until measured on recorded hardware, browser, viewport, network, and cache state)

| Surface | Initial target |
|---|---|
| Initial reading route | No Three.js, PDF viewer, or WASM in the initial dependency graph; at most 200 KiB compressed first-route JavaScript |
| Reading-face HTML with all readings | 250 kB gzipped for the largest paper, otherwise JSON fragments |
| Visible text and math | Main content in initial HTML; locally hosted subset fonts with stable fallback metrics |
| Reader responsiveness | 200 ms or better interaction latency at the 75th percentile on the agreed profile |
| Layout stability | Cumulative layout shift at most 0.1 |
| A simple analytical instrument | Parameter feedback within 100 ms once loaded, measured to the accepted visible snapshot |
| Animated instruments | 60 Hz on capable desktops; a stable 30 Hz mobile tier |
| Resource lifecycle | No growing count of workers, GPU contexts, listeners, or particle buffers across repeated route changes |

Report total transfer separately from JavaScript. Under load reduce visual detail, displayed particle count, resolution, or rendering frequency; never enlarge the integration step, change the model, or reduce the statistical sample behind an inference. Browser text search must find every section, so paragraphs are never virtualized out of the DOM.

### Security

Imported text, bibliographic data, URL state, and reader notes are untrusted input. Use a closed content schema and sanitized rendering. Never evaluate user expressions as JavaScript. Keep KaTeX trust narrowly scoped and tested, so a source record cannot inject HTML, CSS, links, or image loads through a mathematical expression; cap macro expansion and size; never display raw error strings. Bound URL-state size, particle counts, iteration counts, and numeric input ranges, and keep heavy calculations cancellable so a malicious or accidental preset cannot freeze the page. Content-addressed WASM still requires trusted build provenance. Serve `application/wasm` for streaming instantiation, verify the actual Content-Security-Policy with the chosen loading path, allow no broad `unsafe-eval`, and test CSP and worker loading in supported browsers.

### Privacy

No third-party scripts, fingerprinting, advertising, accounts, or cookie banner. Local reading progress, tours, notes, and predictions stay in `localStorage`, exportable and clearable, and reading continues when storage is blocked or full. The one analytic is the **clarity signal**: a one-click "this was clear / this was not" control under each paragraph that records the detail level and anchor, aggregated without cookies, identifiers, or IP retention, with its weekly summary published on the About page. Free-text answers are never sent anywhere.

---

## Editorial Voice

Inherited from the donor's de-slopify rule and tightened. It applies to every visitor-facing string: readings, captions, HUD text, term definitions, button labels, and error messages.

- **No em dashes.** No "seminal," "pivotal," "groundbreaking," or "revolutionary" (except Einstein's own "sehr revolutionär" to Habicht, with attribution). No "it's not X, it's Y." No "unlock." No listicles of vibes.
- Never "obviously," "clearly," or "it is easy to see." If it were, the reader would not be at R2.
- Prefer Einstein's nouns. Prefer dates, page numbers, equation numbers, units, and named people.
- Analogies come after mechanisms. A programmer's loop is a mechanism; "imagine a drunk sailor" is an analogy, and it must say where it stops.
- Every numerical claim traces to the paper, to a named dated experiment, or to a live accepted snapshot. Einstein's printed numbers are regression fixtures, not decoration.
- Never promise effortless comprehension or identical outcomes. Promise meaningful ways to appreciate, explain, predict, derive, and question, with honest bridges between them.

**Personas are editorial review lenses, never shown to readers:** the programmer (loops, arrays, matrices, event logs, invariants; wants the algorithm), the physician (diffusion, osmosis, rates, log scales, uncertainty), the engineer (units, orders of magnitude, the numerical check), the student (no skipped steps), and the reader with no algebra (willing to work, starting from arithmetic). A reader never sees these names or chooses one.

---

## Testing and Logging Standards

- **Unit tests** run with `bun test` beside the code (`*.test.ts`). Test the real numerical owners, the real content compiler, and real records. Do not mock the code under test or substitute a fake kernel; fixtures come from typed scenario files.
- **Browser acceptance** adapts the donor's vertical-slice harness (Playwright). Each paper has a continuous journey test: enter through a deep source passage, switch face, open a foundation, return to the exact argument, operate an instrument, select a linked term, return to the source. The lane matrix covers desktop, tablet, a 320 px touch viewport, a real WebKit/Safari lane, keyboard only, reduced motion, high zoom, no WebGL, JavaScript disabled, print, and a small real-device check.
- **Structured logs.** Every test suite writes JSON lines to `artifacts/test-logs/<suite>/<run-id>.jsonl` with, where applicable: `timestamp`, `suite`, `testId`, `beadId`, `paper`, `anchor`, `instrumentId`, `instanceId`, `runId`, `inputRevision`, `acceptedInputRevision`, `snapshotVersion`, `seed` (decimal string), `streamVersion`, `modelVersion`, `artifactDigest`, `executionLabel`, `resultStatus`, `expected`, `actual`, `tolerance`, `comparisonKind` (`bitwise` or `tolerance`), `outcome`, `durationMs`, `browser`, `viewport`, `reducedMotion`, `jsEnabled`, and a readable `message`. A failing browser test retains a screenshot, trace, DOM snapshot, and console log, and the failure-reporting path is itself tested.
- **Never weaken a gate** to get green: do not delete evidence, loosen a tolerance without a recorded reason, skip a lane, or rerun a flaky statistical test until it passes. A green typecheck or build establishes software integrity only; editorial acceptance is recorded separately.
- **Five independent release questions.** Is the historical text complete and accurate? Is the explanation mathematically and physically sound? Does the instrument calculate and display the stated model correctly? Can a visitor operate and understand the actual page? Does the explanation help a reader overcome the intended obstacle? No single artifact answers all five.

---

## Verification Commands (Available Once the Scaffold Lands)

```bash
bun run typecheck                          # tsc --noEmit, strict
bun run lint                               # Biome
bun run format                             # Biome format
bun run test                               # unit and integration tests
bun run build                              # production build, including the content compiler
bun scripts/verify-content.ts              # every compiler rejection plus Rules 0 to 2
bun scripts/verify-wasm-artifacts.ts       # digests, instantiation, exports, Philox cross-check, refusals
bun scripts/e2e-paper-vertical-slices.ts   # browser acceptance lanes with JSONL logs
ubs --diff
ubs --staged
```

Until a command exists, do not report it as passing.

---

## Vercel Deployment Standards

- Release only through `bun scripts/verified-production-deploy.ts` once it has been adapted from the donor. **Never call `vercel deploy --prebuilt --prod` directly.** The verified entry point takes an exclusive local deployment lock, refuses a dirty worktree or another active build, runs the quality gates, checks that `vercel build` produced a full Build Output API artifact, deploys with `--skip-domain`, validates the unpromoted candidate, and only then aliases `annus-mirabilis.com`, `www.annus-mirabilis.com`, and `annus-mirabilis.vercel.app`. A failed check leaves the public aliases unchanged.
- A **release manifest** binds the site source revision, content edition version, source-asset hashes, WASM artifact hashes, generated schema version, and test results.
- Candidate checks load all four complete paper texts, representative foundation pages, and every instrument bundle, and include one no-JavaScript source-text check, one real accepted WASM result per numerical capability, and one deliberate typed refusal, all against the deployed assets rather than the build directory. After promotion, a short live smoke test loads the mass–energy paper and its German edition endpoint.
- Rollback restores a coherent site, content, and kernel set and never points old HTML at incompatible new WASM. Immutable content-addressed figures and WASM get long-lived caching; manifests and HTML never reference a removed artifact.
- **Changing DNS, connecting a domain, or deploying requires explicit written authorization from the user in the current conversation.** Planning documents do not authorize it. Classic Patents is never changed as part of this site's release; the two sites fail and recover independently.

---

## Beads Issue Tracking

Use `br` (beads_rust) for task tracking. **`br` never runs git.** After changes, sync and stage manually.

```bash
br ready --json                                   # the single work-discovery entrypoint
br show <id> --json                               # full specification for one bead
br update <id> --claim --actor "$AGENT_NAME" --json
br comments add <id> "intended file scope, findings, or evidence"
br close <id> --reason "Completed: <specific proof>" --json
br dep add <issue> <depends-on>
br dep cycles --json                              # must be empty
br sync --flush-only
git add .beads/
```

Use `bv` only with robot flags (`bv --robot-triage`, `bv --robot-next`, `bv --robot-plan`, `bv --robot-insights`). **Never run bare `bv`**; it launches an interactive TUI.

Conventions in this repository:

- The issue prefix is `am`. Epics carry a `## Success Criteria` section; tasks and features carry `## Acceptance Criteria`. `br lint` checks both.
- Labels name the delivery batch (`batch-a` … `batch-i`, `later`), the paper (`paper-light-quanta`, `paper-brownian`, `paper-relativity`, `paper-mass-energy`, `companion-dissertation`, `cross-paper`), and the domain (for example `source`, `translation`, `content-model`, `reader`, `equations`, `runtime`, `physics`, `frankensim`, `instrument`, `discovery`, `foundations`, `a11y`, `testing`, `deploy`, `decision`).
- **`human-gate` beads** need a qualified human: a German source reviewer, a physics reviewer, a non-physicist R2 reader, disabled readers testing with their own tools, comprehension-study participants, or the user's authorization for DNS and deployment. Agents may prepare materials and record evidence, but never close a `human-gate` bead on their own judgment. Close it only with the reviewer's name, the date, and where the record lives.
- `upstream-frankensim` beads change `~/projects/frankensim` under its own conventions and review; `donor-classic-patents` beads change `~/projects/classic-patents.com` only as a separately reviewed change.
- Close reasons state specific proof: the tests and commands run, their results, and the evidence location. "Done" is not a close reason.

---

## MCP Agent Mail: Multi-Agent Coordination

In multi-agent sessions:

- Register: `ensure_project`, then `register_agent`.
- Reserve paths before editing: `file_reservation_paths(..., exclusive=true, reason="<bead id>")`.
- Use the bead id as the thread id (`macro_start_session`, `macro_prepare_thread`, `send_message(..., thread_id="<bead id>")`).
- Release reservations when done. Never revert or clobber unrecognized working-tree changes from peer agents, and never edit a peer's in-progress files.

---

## Code Quality & Verification

After substantial code changes, once the scaffold exists:

```bash
bun run typecheck
bun run lint
bun run format
bun run test
bun run build
ubs --diff
ubs --staged
```

Fix failures at the source. A green result establishes software integrity only; record editorial acceptance, numerical validation, and accessibility results separately.

---

## Session Completion ("Landing the Plane")

Before finishing a work session, you MUST:

1. Ensure all TypeScript types pass (`bun run typecheck`) once the scaffold exists.
2. Verify the production build succeeds (`bun run build`) and relevant tests pass.
3. Run Biome lint and format (`bun run lint`, `bun run format`).
4. Update beads: close finished work with specific proof, comment on anything partial, then `br sync --flush-only` and `git add .beads/`.
5. Summarize changes, verification results, editorial or human-gate status, and next actions.

---

## Web Requests

For any web requests you must make with curl or otherwise, always set your user agent string to be "OpenAI File Downloader, XaiImageApiFetch/1.0"
