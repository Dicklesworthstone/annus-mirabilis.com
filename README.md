# Annus Mirabilis

<div align="center">

[![License: MIT + Rider](https://img.shields.io/badge/License-MIT_+_OpenAI/Anthropic_Rider-blue.svg)](./LICENSE)
[![Status: Planning](https://img.shields.io/badge/Status-Planning_(pre--implementation)-orange.svg)](./COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md)
[![Framework: Next.js App Router](https://img.shields.io/badge/Framework-Next.js_App_Router-black.svg)](https://nextjs.org/)
[![Physics: FrankenSim Rust/WASM](https://img.shields.io/badge/Physics-FrankenSim_Rust%2FWASM-b7410e.svg)](https://github.com/Dicklesworthstone/frankensim)
[![Math: KaTeX + MathML](https://img.shields.io/badge/Math-KaTeX_+_MathML-329894.svg)](https://katex.org/)
[![TypeScript: Strict](https://img.shields.io/badge/TypeScript-Strict-3178c6.svg)](https://www.typescriptlang.org/)
[![Deployment: Vercel](https://img.shields.io/badge/Deployment-Vercel_(prebuilt)-000000.svg)](https://vercel.com/)

**An interactive critical edition and discovery laboratory for Albert Einstein's four 1905 papers in *Annalen der Physik*: pinned facsimiles, reviewed German text, a new sentence-aligned English translation, explanations at the depth each reader asks for, live semantic equations, and physics instruments whose every number has a named, testable owner.**

[**Master Plan**](./COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md) · [**Agent Guidelines**](./AGENTS.md) · [**Task Graph**](./.beads/) · [**Sibling Museum: classic-patents.com**](https://classic-patents.com)

</div>

> **Status: planning.** This repository holds the master plan (version 2.0), the iPhone app plan, and the dependency-ordered task graph derived from them. No application code exists yet. `annus-mirabilis.com` currently serves a static in-preparation placeholder page, not the edition. Everything below describes the product the plans specify, not a finished website.

---

## TL;DR

**The problem.** In 1905 a 26-year-old technical expert (third class) at the Swiss patent office in Bern sent four papers to *Annalen der Physik*. Together they introduced light quanta and the photoelectric equation, predicted Brownian motion as a way to count atoms, rebuilt the kinematics of space and time from two postulates, and derived the equivalence of mass and energy. They are among the most famous documents in science, and almost nobody has read them. The barriers are specific:

1. **Language and access.** The originals are in German, in a journal now behind a publisher paywall. The standard English translations are a century old, not freely reusable, or scattered across journal articles. None sits beside the German, sentence by sentence.
2. **Notation.** Einstein writes the speed of light as $V$ (and as $L$ in the light paper), viscosity as $k$, particle radius as $P$, never writes $h$, and his $\beta$ is the modern $\gamma$.
3. **Missing scaffolding.** The papers assume the 1904 curriculum: kinetic theory, entropy, Maxwell's equations, Wien's law, Boltzmann's principle, Stokes drag, osmotic pressure, Lorentz's electron theory. Their brevity comes from that assumed background.
4. **Static equations.** Every result in these papers is a relationship between quantities, and relationships are learned by moving one thing and watching another.
5. **Hindsight.** Popular accounts explain the results. They rarely put the reader in 1904 with the facts Einstein had, and when they try, they hand over the conclusion inside the premise.
6. **Gatekeeping by prerequisite.** Almost every existing explanation either assumes a physics degree or abandons the mathematics entirely.

**The solution.** Annus Mirabilis rebuilds the four papers as one content model with several ways through it:

1. **Pinned facsimiles and reviewed German ledgers** with SHA-256 provenance receipts and a source manifest that measures completeness block by block.
2. **A new English translation made from the public-domain German**, sentence-aligned many-to-many, with an interlinear gloss face and a **notation concordance** scoped to the section where each symbol has its meaning.
3. **Explanations at the reader's chosen detail**: an overview, a full explanation, a show-every-step reading, and a historian's margin for every paragraph, plus a first encounter per paper that assumes no algebra.
4. **Colorized semantic equations** generated from expression trees. Each term binds to a canonical quantity with dimension, frame, and live value. Derivations are chains of step, reason, and tool, with the non-obvious move marked.
5. **Thirty-three core instruments**, each answering a stated question, all running on one accepted snapshot per experiment with deterministic control tapes and FrankenSim ownership of the reusable laws.
6. **Discovery journeys** that start from a dated 1904 shelf, offer the real alternatives at each fork, and are labeled "a route you could take," never "what Einstein thought."
7. **The material around the papers**: methodological essays, the 1904 desk, connections among the papers, a three-ways-to-count-atoms laboratory, capstones, and the Bern bridge to `classic-patents.com`.
8. **Scientific honesty that survives interactivity.** A rendered animation, a computed model consequence, a verified numerical method, and an empirical observation stay distinguishable everywhere. A result that is not a number (underdetermined, outside the model, a valid limiting state) is shown as such.

---

## The Corpus

| # | Slug | German title (as printed) | Working English title | *Annalen* locator | Received | Published |
|---|---|---|---|---|---|---|
| 1 | `light-quanta` | *Über einen die Erzeugung und Verwandlung des Lichtes betreffenden heuristischen Gesichtspunkt* | On a Heuristic Point of View Concerning the Production and Transformation of Light | (4) **17**, 132–148 | 18 Mar 1905 | 9 Jun 1905 |
| 2 | `brownian-motion` | *Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in ruhenden Flüssigkeiten suspendierten Teilchen* | On the Motion of Small Particles Suspended in Liquids at Rest, as Required by the Molecular-Kinetic Theory of Heat | (4) **17**, 549–560 | 11 May 1905 | 18 Jul 1905 |
| 3 | `special-relativity` | *Zur Elektrodynamik bewegter Körper* | On the Electrodynamics of Moving Bodies | (4) **17**, 891–921 | 30 Jun 1905 | 26 Sep 1905 |
| 4 | `mass-energy` | *Ist die Trägheit eines Körpers von seinem Energieinhalt abhängig?* | Does the Inertia of a Body Depend on Its Energy Content? | (4) **18**, 639–641 | 27 Sep 1905 | 21 Nov 1905 |
| Companion | `molecular-dimensions` | *Eine neue Bestimmung der Moleküldimensionen* (doctoral dissertation) | A New Determination of Molecular Dimensions | (4) **19**, 289–306 (1906); correction (4) **34**, 591–592 (1911) | Submitted to Zurich 20 Jul 1905 | 1906 |

Sixty-three journal pages carry the four arguments: 17, 12, 31, and 3. Publication dates follow the Einstein Papers Project and are verified against the pinned facsimiles before any day-specific timeline is shown. Working English titles are editorial; the site publishes its own translation.

---

## What a Reader Will Be Able to Do

Move continuously between five projections of one underlying content model: the exact historical passage in German, a faithful English translation, an explanation at the depth the reader asks for, an instrument that interrogates the claim, and a reconstruction of the problem before its solution was known.

> You encounter a real difficulty. You try a plausible response. You find out precisely what it preserves and what it breaks. You acquire one more mathematical tool. Then you make a small, consequential move yourself. Only afterward do you see where that move appears in the paper.

Three independent reader choices shape the page, and none of them is an ability tier:

| Choice | Options | What changes |
|---|---|---|
| **Activity** | Read · Discover · Experiment | The narrative organization and the immediate task |
| **Detail** | Overview · Full explanation · Show every step | The amount of scaffolding, never the truth conditions |
| **Perspective** | Paper and contemporary context · Explicit modern lens | Which knowledge, notation, and later interpretations may be used |

A reader never declares a profession, passes a placement test, or is assigned a level. The site welcomes readers who want to **appreciate**, **explain**, **predict**, **derive**, or **critique**, and it never hides the source or disables advanced material because of an earlier choice.

---

## Architecture (Planned)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          annus-mirabilis.com                            │
│      Next.js App Router · static-first HTML · Vercel prebuilt release   │
├─────────────────────────────────────────────────────────────────────────┤
│  READER SHELL                                                           │
│  ?view=  german · english · gloss · parallel · reading · results ·      │
│          facsimile · split          ?detail=  overview · full · steps   │
│  return stack · notation toggle · result weave · works without JS       │
├─────────────────────────────────────────────────────────────────────────┤
│  CONTENT COMPILER (build time)                                          │
│  source blocks · translation units · many-to-many alignment ·           │
│  notation concordance · argument nodes · semantic equations ·           │
│  foundations · knowledge cards · misconceptions · experiments ·         │
│  scenarios · historical datasets · rejects what fails the contracts     │
├─────────────────────────────────────────────────────────────────────────┤
│  EXPERIMENT RUNTIME                                                     │
│  instance-scoped owners · one accepted immutable snapshot ·             │
│  command classes (an observer change never restarts the world) ·        │
│  versioned worker protocol · typed results · deterministic tapes        │
├─────────────────────────────────────────────────────────────────────────┤
│  NUMERICAL OWNERS                                                       │
│  FrankenSim Rust compiled to WASM (slim artifact, pinned digests)       │
│  audited TypeScript reference evaluators, labeled "host calculation"    │
└─────────────────────────────────────────────────────────────────────────┘
```

The reading experience must be excellent without a GPU, without running a simulation, and without JavaScript. Expensive features enhance the book; they never hold it hostage.

---

## The iPhone App (Planned)

An iPhone and iPad app lives in the same repository under `ios/`, specified by [the app plan](./COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_IPHONE_APP.md). It is a native SwiftUI shell around the **same edition**: the compiled papers, bundled in the app and rendered by WebKit from a local origin, so the whole edition reads offline. The shell adds what a phone does well, including a library, native search, Spotlight, Handoff to and from Safari, universal links, the share sheet, find in page, printing a chapter, Dynamic Type, and VoiceOver across native and edition surfaces.

Nothing is recomputed natively, nothing is downloaded at runtime except facsimile PDFs a reader asks for, and no data is collected. Each app build carries the same release id as the website edition it ships.

---

## The Instrument Catalogue (33 Core Instruments)

| Paper | Instruments |
|---|---|
| Light quanta | **LQ-01** wave description and energy spreading · **LQ-02** classical mode-energy allocation · **LQ-03** radiation spectrum and regime comparison · **LQ-04** radiation entropy workbench · **LQ-05** independent configurations · **LQ-06** match the entropy coefficients · **LQ-07** fluorescence energy budget · **LQ-08** photoelectric apparatus · **LQ-09** ionization bounds and counts |
| Brownian motion | **BM-01** tracer ensemble and observable selection · **BM-02** osmotic partition · **BM-03** configuration integral · **BM-04** drift–diffusion balance · **BM-05** random steps to diffusion · **BM-06** Gaussian spread · **BM-07** infer the molecular number · **BM-08** measurement bias |
| Special relativity | **SR-01** clock synchronization · **SR-02** magnet/conductor descriptions · **SR-03** rod measurement and simultaneity · **SR-04** construct the Lorentz map · **SR-05** light clock and moving clocks · **SR-06** velocity composition · **SR-07** transform the field equations · **SR-08** electric/magnetic frame change · **SR-09** Doppler and aberration · **SR-10** finite light complex · **SR-11** moving mirror · **SR-12** charge/current density · **SR-13** electron work and deflection |
| Mass–energy | **ME-01** opposite pulses and two ledgers · **ME-02** inertia from the small-speed coefficient · **ME-03** system-boundary energy ledger |

Every instrument declares what it does not model, offers a predict-first mode, shows the code that produced its numbers, has an equivalent action that needs no dragging, color, sound, or canvas, and runs at 320 px.

## Four Discovery Journeys

1. **Why suspect that light comes in energy quanta?** From Wien's law to the volume dependence of radiation entropy, the counting of independent configurations, and the photoelectric prediction.
2. **How can visible wandering reveal invisible molecules?** Two routes to one diffusion coefficient, the velocity trap that misled Exner, and an honest statistical inversion that counts atoms.
3. **How could you stop assuming that everyone shares the same time?** A measurement procedure for distant clocks, a transformation constructed rather than handed over, and electrodynamics that no longer cares which body moves.
4. **Can emitting light change inertia?** Two energy ledgers, one subtraction, and one small-speed coefficient.

---

## Scientific Honesty Rules (Selected)

- **Four kinds of meaning stay separate**: logical role, historical status, model status, and execution status are never compressed into one color.
- **Execution labels are earned per snapshot.** "Ideal model, computed with FrankenSim" appears only when an accepted call to the registered owner produced the displayed state. A loaded WASM file does not earn the label.
- **Einstein's printed numbers are regression fixtures.** $N = 6.17\times10^{23}$ from Planck's constants; about 4.3 volts for $\nu = 1.03\times10^{15}\,\mathrm{s^{-1}}$; about $0.8\,\mu\mathrm{m}$ of Brownian displacement in one second and about $6\,\mu\mathrm{m}$ in a minute.
- **A simulator shows the consequences of assumptions.** It is never presented as evidence that nature obeys them.
- **No circular explanations.** The mass–energy ledger never initializes a body's energy with $Mc^2$; the atom-counting exercise never hides a modern Boltzmann constant inside its data.
- **An observer change never restarts an experiment.** Changing a frame or a camera re-describes the same world.

---

## Delivery Plan

| Batch | Work that changes the product | Exit evidence | Rough duration |
|---|---|---|---|
| **A** | Inventory all four documents including every equation and footnote; freeze stable ids; resolve facsimile sources and rights; repository, donor audit, first FrankenSim exports | Every original source unit has a destination; drafts are visibly distinct from reviewed translations; the empty site deploys to the Vercel alias | 2 weeks |
| **B** | **Reference slice**: Brownian motion §§4–5, end to end | A reader moves from the original displacement passage through the instruments and the derivation and back without losing place, with and without the simulation, with assistive technology | 4 weeks |
| **C** | Complete Brownian paper | All five sections covered; no modern-constant circularity; the full acceptance scenario passes | 3 weeks |
| **D** | Mass–energy paper in full | Noncircular derivation; exact, Taylor, and proxy comparison; every qualification present | 2 weeks |
| **E** | Relativity foundations and kinematics | Event separation distinguished from rod measurement; inverse, composition, and null-path tests | 4 weeks |
| **F** | Light paper in full | All nine sections covered; the Wien limitation visible; energy and rate demonstrably distinct | 4 weeks |
| **G** | Relativity electrodynamics in full | All ten sections covered; the difficult final sections receive the depth of the opening | 4 weeks |
| **H** | Discovery book and connections | Knowledge-boundary review; no prerequisite dead ends | 4 weeks |
| **I** | Publication finish | Every launch criterion met against the actual candidate deployment | 3 weeks |

Durations are rough estimates for a small team, not commitments. Accessibility work lives in every batch.

---

## Working on This Repository

The task graph lives in `.beads/` and is managed with [`br`](https://github.com/Dicklesworthstone/beads_rust) and analyzed with `bv`. Every bead is written to be self-contained: background, exact scientific requirements, acceptance criteria, and the unit and end-to-end tests that prove it.

```bash
git clone https://github.com/Dicklesworthstone/annus-mirabilis.com.git
cd annus-mirabilis.com

br ready --json            # unblocked, actionable work
bv --robot-triage          # graph-aware triage (never run bare `bv` in automation)
br show <id> --json        # the complete specification for one task
```

Read [`AGENTS.md`](./AGENTS.md) before changing anything. Once the application scaffold lands, the standard commands will be:

```bash
bun install
bun run dev          # local development server
bun run test         # unit and integration tests
bun run typecheck    # strict TypeScript
bun run lint         # Biome
bun run build        # production build, including the content compiler
```

---

## Sources, Rights, and Licensing Layers

- **The German texts are public domain.** They were published in 1905 and 1906, and Einstein died in 1955.
- **Scans are not the text.** A particular scan can carry its scanning institution's terms. Each pinned facsimile's origin, terms, retrieval date, and SHA-256 are recorded in its provenance receipt.
- **Existing English translations are not republished.** The site makes its own translation from the German and cites historical translations only as attributed comparison witnesses.
- **Letters and photographs.** Letters are paraphrased rather than reproduced. Public-domain photographs of Einstein appear with a source credit.
- **The [LICENSE](./LICENSE) covers code and new prose.** It grants no rights to embedded scans, historical datasets, fonts, or other third-party material, each of which carries its own recorded rights status.

## Related Projects

- [**classic-patents.com**](https://github.com/Dicklesworthstone/classic-patents.com): the architecture donor. Its source-edition system, equation interaction, provenance discipline, browser acceptance harness, and verified release workflow are adapted here. The Bern patent office, where Einstein examined electromechanical patents from 1902 to 1909, is the historical bridge between the two sites.
- [**FrankenSim**](https://github.com/Dicklesworthstone/frankensim): the numerical owner. Reusable physical laws (diffusion, radiation spectra, flat-spacetime kinematics) are developed upstream there, not duplicated in page components.

## License

MIT License with the OpenAI/Anthropic Rider. See [LICENSE](./LICENSE).
