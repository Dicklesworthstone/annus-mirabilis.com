# Annus Mirabilis
## Comprehensive plan for annus-mirabilis.com
### Four papers. One year. A laboratory for learning how to discover.

**Prepared for:** Jeffrey Emanuel  
**Plan date:** September 14, 2026  
**Revision:** 2.0 — full fresh-eyes scientific, technical, and universal-access review  
**Requested filename:** `COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_ASTRA.md`  
**Status:** Research-grounded product, editorial, mathematical, visualization, and engineering specification. This document proposes work; it does not represent an implemented or deployed website. The revision preserves the original 25-section architecture and all 33 core instruments, corrects underspecified scientific and runtime contracts in their relevant sections, and adds concrete entry paths for readers with no assumed algebra background.

---

## Contents

1. [The central recommendation](#section-01)
2. [What the Classic Patents study establishes](#section-02)
3. [The four-paper corpus and the scope of completeness](#section-03)
4. [The editorial architecture: one corpus, several ways through it](#section-04)
5. [The 1904 knowledge boundary](#section-05)
6. [Foundation library: explain the exact obstacle, then return](#section-06)
7. [Discovery journey I: why suspect that light comes in energy quanta?](#section-07)
8. [Discovery journey II: how can visible wandering reveal invisible molecules?](#section-08)
9. [Discovery journey III: how could you stop assuming that everyone shares the same time?](#section-09)
10. [Discovery journey IV: can emitting light change inertia?](#section-10)
11. [The instrument catalogue and its acceptance contract](#section-11)
12. [The content model and compiler](#section-12)
13. [Translation, source fidelity, and editorial production](#section-13)
14. [Typography, equations, and reader interaction](#section-14)
15. [FrankenSim integration: reusable physics, not an Einstein-shaped fork](#section-15)
16. [Runtime protocol, ownership, and reproducibility](#section-16)
17. [Numerical and physical verification](#section-17)
18. [Application architecture and implementation layout](#section-18)
19. [The material around the papers: learning how to find an idea](#section-19)
20. [Quality gates that protect the actual reading experience](#section-20)
21. [Hosting, domain, and release design](#section-21)
22. [Delivery plan: complete vertical slices, then systematic coverage](#section-22)
23. [Principal risks and decisions](#section-23)
24. [Definition of a successful launch](#section-24)
25. [Source register and evidence boundaries](#section-25)

---

<a id="section-01"></a>

## 1. The central recommendation

Build **an interactive critical edition and discovery laboratory**, not an Einstein biography, a physics encyclopedia, or four illustrated summaries.

The visitor should be able to move continuously between five things: the exact historical passage; a faithful English translation; an explanation that makes every inferential step intelligible; an instrument that lets the visitor interrogate the claim; and a reconstruction of the problem before its solution was known. These are projections of the same underlying content, not separately maintained versions of the website.

Classic Patents supplies the right foundation: serious primary-source presentation, parallel explanations, colorized mathematics, and physical instruments whose outputs have identifiable owners. Annus Mirabilis should retain those strengths while changing the organizing unit from **a patented mechanism** to **an argument**. A patent exhibit asks, “How does this mechanism work?” This site must additionally ask, “What would make a reasonable person suspect this idea, and what distinguishes that suspicion from a derivation or a test?” ([CP-01]–[CP-09])

The defining experience should be:

> You encounter a real difficulty. You try a plausible response. You find out precisely what it preserves and what it breaks. You acquire one more mathematical tool. Then you make a small, consequential move yourself. Only afterward do you see where that move appears in the paper.

This must not become a disguised multiple-choice quiz in which every alternative is foolish. Nor should it pretend that Einstein's conclusions followed inevitably from everything known in 1904. The distinction between a logically sufficient reconstruction and a documented account of Einstein's actual thinking is foundational.

### 1.1 Non-negotiable product outcomes

1. **Complete papers:** every original paragraph, displayed equation, substantive inline equation, footnote, qualification, acknowledgment, and bibliographic reference has a place in the edition. Difficult closing sections cannot disappear behind the familiar headlines.
2. **No prerequisite dead ends:** unfamiliar mathematics opens into an explanation with a worked example, a picture or manipulable construction, and a route back to the exact interrupted argument.
3. **Equations are readable instruments:** symbols, mathematical operations, units, assumptions, and live quantities are linked explicitly. Color helps identify meaning but never carries meaning alone.
4. **Discovery is a first-class editorial product:** each paper gets a substantial, independently authored discovery journey, including reasonable alternatives, evidence limits, and opportunities to make predictions before seeing results.
5. **Scientific honesty survives interactivity:** a rendered animation, a computed model consequence, a verified numerical method, and an empirical observation remain distinguishable.
6. **FrankenSim owns the reusable computational physics:** the website owns presentation and teaching sequences. Missing generic capabilities are developed upstream rather than duplicated in page components.
7. **The reading experience is excellent without a GPU, without running a simulation, and with JavaScript unavailable:** expensive features enhance the book; they do not hold the book hostage.

### 1.2 What “interactive visualizations of everything” should mean

It should mean **coverage of every substantive conceptual and mathematical obstacle**, not a slider attached to every sentence or a 3D scene for every noun. The appropriate instrument can be a manipulable experiment, an event table, an equation transformation, a counterexample, a probability distribution, an annotated source diagram, or a linked geometric construction.

Create a coverage obligation for each argument step. That obligation names the question a visual must answer, its observable response, its mathematical owner, and its accessible nonvisual equivalent. A beautifully explained static detail is acceptable where motion would add no information; an unexplained central inference is not. Multiple related steps may share one instrument, provided the correspondence is explicit.

### 1.3 The intended audience

The site welcomes anyone who wants to understand: readers with no algebra, rusty or strong mathematical preparation, different first languages, disabilities, limited time, or modest devices. The sustained English critical edition remains available to technically fluent readers; it is no longer the only front door. Basic calculus and linear algebra support one route, not admission to the project. Readers choose a question and a kind of help, not a profession, diagnosis, intelligence category, or permanent ability tier.

Programmers should find event logs, transformations, invariants, distributions, units, and debugging analogies useful. Doctors and other scientifically literate readers should find measurement, inference, rates, uncertainty, and scale familiar. These are optional bridges, not separate stereotypes of the audience. A reader should never have to declare a profession or pass a placement test.

Do not promise effortless comprehension or identical outcomes for every person. Promise meaningful ways to appreciate, explain, predict, derive, and question the ideas, with honest bridges between those accomplishments. A reader who grasps the scientific insight without completing every derivation has achieved something worthwhile; the full derivation is always available.

### 1.4 Five legitimate accomplishments, one open body of knowledge

Let visitors choose what they are trying to do **today**, with ordinary-language invitations rather than a test that assigns them a level:

| Accomplishment | A meaningful outcome | What must remain within reach |
|---|---|---|
| Appreciate | Explain why the question mattered and what was surprising about the answer | A concrete example and the original passage |
| Explain | Reconstruct the main reasoning in words, pictures, or a small table | Definitions, assumptions, and a bridge to symbols |
| Predict | Anticipate how a specified change affects an observable and explain why | Units, numerical examples, and the applicable model |
| Derive | Reproduce the mathematical steps and identify each premise | Every intermediate step, alternative derivations, and source notation |
| Critique | Separate what follows, what is suggested, what has been measured, and what remains undetermined | Countermodels, uncertainty, primary sources, and later qualifications |

These are overlapping activities, not a ladder of human worth. A mathematician may want a quick appreciation route; a reader who begins without algebra may eventually want the full derivation. Never hide the source, disable advanced material, or silently simplify future pages because of an earlier answer.

The first screen should ask a scientific question and offer **“Show me with an example”** and **“Take me to the paper.”** It should not ask visitors whether they are clever enough to enter. The site should not promise that four difficult papers can be mastered in minutes; it should make the first worthwhile insight available quickly and the subsequent path dependable.

### 1.5 A concrete universal-access promise

For each paper, ship a short first encounter that assumes no algebra, no graph-reading fluency, and no previous physics terminology. Follow it with a visible bridge to the actual argument. Every bridge explains what new skill it introduces, why that skill is useful here, and how to continue with more or less guidance.

The promise is **multiple viable routes toward the same scientific questions**, not identical presentation for everyone. Someone unable to operate a 3D scene should still be able to choose observations, change conditions, compare outcomes, and reason about the same relationship. Someone not ready for calculus should still be able to appreciate what the derivative means, then learn its calculation when desired.

### 1.6 The revision's governing design test

When proposing a feature, name a reader obstacle, show the simplest working interaction that addresses it, and specify an observable sign of improved understanding. Novelty alone is not a reason to ship. The most valuable innovations here are semantic links between representations, explanations that diagnose a specific missing step, fair comparisons between alternative models, and genuine scientific participation without assumed mathematical or sensory abilities. They need not require a large framework or an open-ended tutor.

---

<a id="section-02"></a>

## 2. What the Classic Patents study establishes

### 2.1 Audit identity and limitations

The repository inspection used the following pinned revisions:

| Repository | Revision inspected | Role in this plan |
|---|---|---|
| `Dicklesworthstone/classic-patents.com` | `da11ff475902728fd8dd1d9db9f3af37c16ec8a5` | Source-edition architecture, equation interaction, physics ownership, publication coverage, browser acceptance, and deployment approach |
| `Dicklesworthstone/frankensim` | `88a4819abe7a361d278759aabec962604f87a00c` | Computational substrate, units, random streams, browser boundaries, dependency structure, and capability-claim discipline |

The supplied FrankenSim URL ran together the repository name and the word “project.” The repository inspected is `Dicklesworthstone/frankensim`.

The study read the Classic Patents README, substantial portions of its comprehensive plan and agent guidance, the package manifest, the equation schema and renderer, portions of the equation and dual-projection components, the shared parameter hook, the executable coverage schema, the integration roadmap, and the browser acceptance specification. It also inspected the deployed catalogue and Wright exhibit through their public page content. ([CP-13]; [CP-14]) FrankenSim inspection covered the README and workspace manifest, the units and random-stream implementations, and existing WASM package/boundary examples. The source register at the end identifies the specific files. ([CP-01]–[CP-12]; [FS-01]–[FS-06])

This was **source and document inspection, not an execution audit**. No production slider behavior, screenshot comparison, complete test suite, native build, or WASM build was independently exercised here. A source revision also does not establish which revision produced the current deployment. Reported repository counts below are documentation facts at the inspected snapshot, not newly measured completion certificates.

### 2.2 Important concrete findings

**The project has a genuine source-edition system.** It separates the pinned facsimile, reviewed transcription ledger, visitor-facing authored edition, and editorial explanation. Its guidance explicitly rejects treating editorial prose as a substitute for the historical document. This separation should become even stronger for a multilingual scientific edition. ([CP-01]; [CP-03])

**Coverage is multidimensional, not a single “done” flag.** The inspected documentation reports 103 catalogue records, 100 reviewed ledgers, and 89 accepted archival editions. The integration inventory distinguishes 3 patent-specific WASM surfaces, 35 generic-WASM consumers, and 65 typed-host-only records. Those categories are not equivalent to the number of packaged artifacts or the number of numerical owners. Annus Mirabilis should preserve this precision rather than repeat a broad claim that every visualization already runs in WASM. ([CP-01]; [CP-08])

**The code has useful equation interaction already.** The equation schema links symbols, explanations, sentence fragments, colors, units, and telemetry. The component supports selecting terms and keyboard navigation. KaTeX produces HTML plus MathML and uses a restricted trust callback rather than blanket trusted HTML. Those are valuable foundations. ([CP-04]–[CP-06])

**There are also seams that should be redesigned.** The inspected equation component contains human-label telemetry matching and permissive token matching. The shared parameter hook uses module-global maps and increments a control-change tick. That tick is not necessarily a physical solver step. These mechanisms are manageable in an existing museum, but they are the wrong unmodified substrate for multiple simultaneous scientific experiments, historical/modern notation, and reproducible stochastic trajectories. ([CP-05]–[CP-07])

**The project already understands bundle boundaries.** `DualProjectionViewer.tsx` accepts server-resolved, per-patent equation data rather than importing the large all-patent equation registry. Its comments identify the aggregate registry as approximately 976 KB. The new site should extend that discipline to source editions, prerequisite lessons, search, and simulation packages. [CP-09]

**Provenance is tied to ownership, not branding.** `coverageManifest.ts` distinguishes packaged surfaces, loaded artifacts, typed refusal boundaries, and accepted steps that actually own the shared bus. `HONEST_PLACEHOLDER`, `TS_FALLBACK`, and `WASM` are distinct. Retain the underlying truth even if the public wording becomes less technical. [CP-10]

**The browser acceptance design is reusable.** It checks source identities, exact routes, source assets, URL-restored views, actual controls, telemetry and refusal behavior, narrow screens, keyboard/touch input, reduced motion, and retained failure evidence. It does not pretend that browser checks replace numerical or editorial review. [CP-11]

### 2.3 Reuse, refactor, and leave behind

| Existing seam | Decision | Adaptation for Annus Mirabilis |
|---|---|---|
| Pinned PDF + reviewed ledger + authored edition | Reuse the architecture | Add German/English alignment, original/modern notation, and separately attributed editorial notes |
| `LatexRenderer.tsx` | Adapt | Build/server-render static mathematics; hydrate term interaction only; fail publication on malformed mathematics |
| `ColorizedEquation.tsx` and equation schema | Refactor | Exact semantic IDs, operation-level explanations, derivation steps, typed quantity bindings, accessible controls |
| `DualProjectionViewer.tsx` | Reuse interaction ideas, not the monolith | A reader shell with independently loaded source, explanation, discovery, and laboratory panels |
| `parallelReadings.ts` block-index association | Replace the addressing model | Stable content IDs and many-to-many translation alignment; inserting a paragraph must not shift all annotations |
| `usePatentPhysics.ts` | Replace runtime ownership layer | Instance-scoped experiments; one accepted immutable snapshot; separate input revision and simulation step |
| `coverageManifest.ts` | Extend | Source, translation, argument, instrument, accessibility, and numerical coverage remain separate dimensions |
| `specClauses.ts` / weave concept | Generalize | Highlight the exact premise or conclusion affected by a parameter, without treating truth as a decorative glow |
| Three.js studio and linked 2D/3D views | Selectively adapt | 2D first for event geometry and distributions; 3D for apparatus and spatial relations that genuinely require it |
| Historical glossary | Refactor | Context-sensitive scientific language and notation, not a single global dictionary keyed only by spelling |
| Browser acceptance harness | Adapt | Four complete paper scenarios plus source/derivation/laboratory paths, modern/historical boundaries, stochastic replay |
| Verified candidate-deployment approach | Reuse | Test a candidate build before production aliases change; release source, JavaScript, and WASM coherently |
| Patent claims, legal disputes, patent categories | Do not port | Replace with argument steps, historical alternatives, experimental evidence, and conceptual connections |
| Generic or Wright-default visual dispatch | Do not port | Exhaustive experiment registry; unknown IDs fail explicitly rather than showing a plausible wrong model |

Do not fork the entire catalogue and delete most of it. Start a new repository with a small, attributable extraction of proven components and contracts. Preserve license notices. Changes useful to both sites should become an explicitly versioned shared package only after a second concrete use establishes the correct interface; avoid inventing a broad “museum framework” before the Einstein reader works.

### 2.4 Stack recommendation

Retain the successful division of labor: Next.js App Router, React, TypeScript, restrained Tailwind styling, KaTeX, direct Three.js where needed, and Rust/WASM numerical owners. The inspected package declares Next 15 and React 19; it does **not** declare React Three Fiber despite references to it in architectural prose. Treat manifest, lockfile, and executing code as stronger evidence than aspirational documentation. ([CP-02]; [CP-03])

At implementation kickoff, select current supported compatible versions and lock them. Do not make a major framework migration part of the scientific content critical path. New physics code should follow the FrankenSim nightly Rust, safe-code, and dependency policies; the web UI is not an excuse to introduce a separate numerical stack.

---

<a id="section-03"></a>

## 3. The four-paper corpus and the scope of completeness

### 3.1 Canonical documents

The bibliographic convention below uses the journal's fourth-series volumes. Preserve the corresponding whole-series volume numbers in machine-readable metadata to avoid apparent DOI/catalogue disagreements. English titles are editorial working titles, not a declaration that any particular existing translation will be republished. ([P-01]–[P-08])

| Paper ID | German title | Working English title | Original journal locator | Received |
|---|---|---|---|---|
| `light-quanta` | Über einen die Erzeugung und Verwandlung des Lichtes betreffenden heuristischen Gesichtspunkt | On a heuristic viewpoint concerning the production and transformation of light | *Annalen der Physik* 17, 132–148; whole-series 322 | March 18, 1905 |
| `brownian-motion` | Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in ruhenden Flüssigkeiten suspendierten Teilchen | On the motion of particles suspended in liquids at rest required by the molecular-kinetic theory of heat | *Annalen der Physik* 17, 549–560; whole-series 322 | May 11, 1905 |
| `special-relativity` | Zur Elektrodynamik bewegter Körper | On the electrodynamics of moving bodies | *Annalen der Physik* 17, 891–921; whole-series 322 | June 30, 1905 |
| `mass-energy` | Ist die Trägheit eines Körpers von seinem Energieinhalt abhängig? | Does the inertia of a body depend on its energy content? | *Annalen der Physik* 18, 639–641; whole-series 323 | September 27, 1905 |

The four original page ranges total **63 journal pages**: 17 + 12 + 31 + 3. PDF file page counts can differ when covers, editorial matter, or later translations are included. Page provenance must therefore distinguish PDF page index, printed journal page, and translation page.

Do not label received dates as publication dates. Store composition/date-line, receipt, issue publication, and later edition dates separately. Verify exact publication dates against issue-level records before displaying a day-specific publication timeline.

Einstein's dissertation and other nearby work belong in a short contextual note and selected prerequisite references, not a silently added fifth flagship paper. The site's four-paper scope is a product choice, not a claim that Einstein wrote only four important works that year.

### 3.2 Completeness is measured against a source manifest

Before writing explanations, inventory each document into stable blocks:

- Title, author line, introduction, numbered sections, paragraphs, displayed and inline mathematics, footnotes, references, date line, acknowledgments, and any source figures.
- Source locators and page-region references for every block.
- Original equation labels where present; editorial labels in a distinct namespace where absent.
- Translation status, mathematical transcription status, reviewer status, and unresolved alternatives.

The manifest, not a manually maintained percentage, determines whether a source edition is complete. A block cannot be “covered” by linking to a whole paper. Every substantive argument step additionally requires an explanation, dependencies, at least one worked or visual treatment where useful, and a statement of its assumptions.

### 3.3 Light-quanta paper: complete treatment map

Section descriptions below identify coverage; exact displayed English headings will be set by the reviewed translation. The nine numbered sections, not merely the photoelectric application, form the product scope. ([P-01]; [P-02])

| Original part | Reader's central question | Required treatment |
|---|---|---|
| Introduction | Why might a successful wave description be incomplete? | Contrast continuous field descriptions and discrete matter without asserting that optical wave phenomena disappear |
| §1: difficulty in blackbody theory | What goes wrong when classical energy sharing is applied to radiation? | Mode counting and energy allocation with explicit assumptions and a finite cutoff instrument |
| §2: Planck's elementary quantities | What had Planck determined, and what is Einstein changing? | Historical constants and units; distinguish quantized oscillator energy from a hypothesis about radiation itself |
| §3: radiation entropy | How can a measured spectrum tell us something about entropy? | Explain the thermodynamic derivative linking entropy and temperature; show what is held fixed |
| §4: low-density monochromatic radiation | Why does the Wien regime simplify the problem? | Derive the volume-dependent entropy difference without skipping the logarithm or integration |
| §5: gases and dilute solutions | How does counting independent possibilities produce an entropy law? | Volume probability, independence, logarithms, and the gas/solution analogy |
| §6: interpreting radiation entropy | Why does the same functional form suggest independent quanta? | Let the reader compare coefficients and infer an energy scale; mark the heuristic leap and its domain |
| §7: Stokes's rule | What restrictions follow when light changes frequency? | Energy-budget instrument for fluorescence; reproduce qualifications rather than declaring a universal prohibition |
| §8: photoelectric emission | What changes electron energy, and what changes electron count? | Frequency, intensity, work function, stopping potential, losses, and the distinction between predictions and later confirmation |
| §9: gas ionization | What does the hypothesis predict about ionization energy and yield? | Threshold/upper-bound and counting arguments; separate one-quantum assumptions from real gas cross-sections |

### 3.4 Brownian-motion paper: complete treatment map

The statistical-mechanical foundation is not an optional omission merely because the paper allows a reader to proceed without it. Provide both the direct route and the full derivation. ([P-03]; [P-04])

| Original part | Reader's central question | Required treatment |
|---|---|---|
| Introduction | Could molecular motion create visible, testable motion of suspended objects? | Einstein's conditional claim and his stated uncertainty about the observational reports, preserved faithfully |
| §1: osmotic pressure of suspended particles | Why should visible particles share a law with dissolved molecules? | Semipermeable partition, dilution, number density, pressure, and the force/area distinction |
| §2: statistical-mechanical justification | How can a vast microscopic problem yield a simple volume dependence? | Configuration counting, the volume factor, free energy, and pressure as a derivative; original notation unpacked |
| §3: diffusion of small spheres | How can drag and equilibrium determine diffusion? | Stokes mobility and the cancellation between drift and diffusion flux; all limiting assumptions visible |
| §4: irregular motion and diffusion | How do random displacements produce a deterministic equation? | Transition kernel, symmetry, Taylor expansion, diffusion equation, Gaussian displacement law, and RMS |
| §5: molecular scale from visible motion | How could observations determine the molecular number? | Estimating diffusion from displacement, propagating uncertainty, and distinguishing a synthetic exercise from historical data |

### 3.5 Special-relativity paper: complete treatment map

Allocate serious editorial and implementation effort to **both halves** of this paper. A train animation plus a Lorentz matrix is not a complete treatment. ([P-05]; [P-06])

| Original part | Reader's central question | Required treatment |
|---|---|---|
| Introduction | Why does moving the magnet instead of the conductor create an explanatory asymmetry? | Apparatus, frame descriptions, measurable agreement, and carefully scoped electrodynamics |
| §1: simultaneity | How can distant clocks acquire an operational common time? | Signal exchange, synchronization convention, event records, and the difference between an event and its reception |
| §2: lengths and times | What do measurements of a moving rod actually compare? | Endpoint events and simultaneity; constraints on a light-based measurement procedure |
| §3: coordinate/time transformation | What map reconciles the postulates? | A full derivation, including linearity assumptions, remaining scale factor, reciprocity/symmetry, and inverse |
| §4: physical meaning | What do clocks and rods report in different frames? | Time dilation, contraction, simultaneity, clock comparisons, and careful treatment of accelerated comparisons |
| §5: velocity addition | Why doesn't adding ordinary speeds preserve light speed? | Differentiate the coordinate map, include transverse components, and explore limits |
| §6: Maxwell–Hertz transformation | How do electric and magnetic descriptions change together? | Chain rule, field components, unit conventions, transformed equations, and the magnet/conductor reconciliation |
| §7: Doppler effect and aberration | How do frequency and propagation direction transform? | Wavefront phase and linked angular/frequency instruments, not sound-based analogies treated as proof |
| §8: light energy and moving mirrors | Why do amplitude and enclosed volume both matter? | Transform a finite light complex; derive energy transformation; reflected direction, frequency, and pressure |
| §9: convection currents | How do charge density and moving charge fit the transformation? | Charge/current density, continuity, frame changes, and the assumptions of the source |
| §10: electron dynamics | What force, work, energy, and deflection relations follow? | Slowly accelerated electron argument, historical force/mass conventions, work integral, and electric/magnetic deflection tests |
| Closing material | Who and what does the paper acknowledge? | Preserve the Besso acknowledgment, date line, and source notes |

Do not silently replace original longitudinal/transverse-mass expressions with modern formulas. Explain which frame's force and acceleration are being compared, inspect the source and editorial history, and offer a clearly identified modern momentum treatment alongside the faithful edition.

### 3.6 Mass–energy paper: complete treatment map

This paper has three printed pages rather than a long numbered section structure. Its shortness makes exhaustive treatment especially feasible. ([P-07]; [P-08])

| Argument block | Required treatment |
|---|---|
| Imported result from the relativity paper | Trace the radiation-energy transformation to §8; do not use the desired mass–energy result as an input |
| Two equal opposite emissions | Explain the choice of symmetry and why the body remains at rest in its original frame |
| Energy balances in two frames | Track all before/after quantities with separate frame and event identifiers |
| Subtraction and kinetic energy | Show cancellation, the role of additive energy constants, and the identification of the kinetic-energy difference |
| Low-speed expansion | Derive the quadratic term and expose the approximation error rather than replacing it with an unexplained Taylor series |
| Inertia change and generalization | Separate the specific radiation argument, the broader inference, and the subsequent modern formulation |
| Empirical closing remarks | Preserve the conditional experimental suggestion without turning it into a nuclear-history digression |

---

<a id="section-04"></a>

## 4. The editorial architecture: one corpus, several ways through it

### 4.1 Three orthogonal choices, not a wall of switches

There are three genuinely different user needs:

| Axis | Choices | What changes |
|---|---|---|
| Activity | Read / Discover / Experiment | Narrative organization and immediate task |
| Detail | Overview / Full explanation / Show every step | Amount of scaffolding, not truth conditions |
| Historical perspective | Paper and contemporary context / Explicit modern lens | Which knowledge, notation, and later interpretations may be used |

The source/translation comparison is a panel within reading, not a fourth independent curriculum. Avoid exposing the full Cartesian product as dozens of modes. A good default is **Read → Full explanation**, with local “Why?”, “Show the missing step,” “Try it,” and “Read the original” actions.

“Modern notation” and “modern knowledge” are different choices. Renaming Einstein's speed-of-light symbol does not authorize importing a later proof. Model these independently in the data even if the interface combines them into a sensible preset.

### 4.2 The minimum explanation unit

Every substantial explanation must answer:

1. What question are we trying to resolve?
2. What is already assumed or known here?
3. What does this expression say in ordinary language?
4. Why is this move allowed?
5. What changes when a parameter changes, and what remains unchanged?
6. What would invalidate the argument or require a different model?

Use these as authoring tests, not six identical boxes under every paragraph. The prose should feel like a well-written book, not an exported database form.

### 4.3 Recursive clarification without recursive confusion

A selected term opens a compact explanation in context. From there, a reader can descend to a worked example, a prerequisite, and ultimately ordinary arithmetic or a concrete counting/measuring operation. The return stack retains the original paragraph, selected expression, laboratory state, and scroll position.

The prerequisite graph must be finite and curated. Every basic node has a stated stopping point: for example, multiplication as repeated scaling, a graph as a record of paired quantities, and a rate as change per unit of something. Do not generate an infinite cascade of definitions or require a foundational philosophy of mathematics before teaching a derivative.

Expose **“Show me one example first”** beside abstract derivations. Concrete numerical examples often resolve confusion more efficiently than another layer of terminology.

### 4.4 No circular explanations

Each derivation has an explicit dependency graph. The source-order route and the discovery route can traverse it differently, but neither may rely on its own conclusion.

Examples of prohibited circles:

- Inferring a molecular count from diffusion while silently using that same count to construct the supposedly independent data.
- Deriving mass–energy equivalence using a body-energy formula that already assumes it.
- “Discovering” Lorentz transformations by initially requiring the Minkowski interval as an unexplained axiom in the historical route.
- Treating a photoelectric simulator programmed with a threshold as experimental proof that nature has a threshold.

A simulator can make the **consequences** of assumptions legible. Independent observations are required to test whether those assumptions describe the world.

### 4.5 Assistance is not the same thing as depth

The earlier three-axis design remains useful, but a short explanation, a symbolic explanation, and an unguided explanation are not the same thing. Represent three additional properties explicitly in authoring: **formalism**, **guidance**, and **representation**. Keep them behind a few tested presets rather than exposing another combinatorial wall of switches.

A full account can use little notation while carefully stating every premise. Conversely, one line of symbols can be extremely demanding. A worked example can contain advanced mathematics while giving extensive guidance. The reader should be able to ask for any of these without changing the scientific claim.

Use a compact **“What is getting in the way?”** action with concrete choices: an unfamiliar word or symbol; an algebraic move; the physical reason for a step; the connection to the picture; the purpose of the calculation; or simply too much at once. A selection opens an authored response for this exact argument. Do not ask the reader to diagnose a learning disability or reveal a personal history.

### 4.6 Meaning must survive a change of representation

Give each explanatory treatment a small authoring contract: question, premises retained, conclusion supported, approximations introduced, omissions acknowledged, and bridge to the fuller treatment. This is an editorial record, not a card displayed under every sentence.

A concrete analogy must say where the analogy stops. A simplified account must not quietly turn “approximately,” “in this idealized case,” or “suggests” into “always” or “proves.” Replacing an exact expression with a low-speed approximation is a change in mathematical claim, not just a change of reading level. The compiler can check referenced premises and approximation labels; a reviewer must still judge whether the prose preserves meaning.

**Example:** “A more viscous liquid makes the tracer spread less over the same time” is a legitimate introductory consequence of the admitted model. “Doubling viscosity halves the typical displacement” is not: it halves diffusivity and changes RMS displacement by a factor of `1/√2`. Both the low-notation and detailed treatments must preserve that distinction.

### 4.7 Guided discovery, not compulsory rediscovery

The invitation to discover is central, but the reader is never required to independently invent a difficult concept before receiving instruction. Offer a sequence with adjustable support: a fully worked example; a partly completed comparison; an optional prediction; an explanation of the result; and a new case that tests transfer. A reader may move directly to the explanation at every point.

There is no defensible universal rule that minimal guidance is best. Klahr and Nigam's study of elementary science instruction favored direct instruction for initial acquisition in its tested task. Schwartz and Martin's statistics study found value in an invention activity as preparation for subsequent learning. These are different populations and designs, not rival slogans that settle this site's pedagogy. Their practical implication here is to test **productive exploration followed by sufficient explanation**, and provide direct worked instruction when exploration is not helping. ([ED-01]; [ED-02])

Before a consequential reveal, show a fair puzzle with enough information to reason about it. Afterward, make the full explanation available regardless of the prediction. Do not equate being surprised with having learned, and do not use an animation to conceal an omitted inference.

### 4.8 A returnable, interruptible reader

The explanation stack must have a persistent, unobtrusive compass: **the question we were answering**, **the idea we just opened**, and **return to the exact step**. It should support back/forward history, a direct link to the current clarification, and a single action to close all side explanations without losing the main passage.

Keep a small local “reading notebook” containing optional pinned questions, selected examples, and the next suggested step. Saving may fail when storage is blocked or full; reading must continue, and important notes need an explicit local export rather than an assumption of permanent browser storage. Do not automatically upload free-text responses or infer competence from the notebook.

An interrupted reader should be able to resume with a short authored recap of the current argument, not a demand to redo a quiz. Avoid timers, streaks, punitive red crosses, surprise audio, and forced full-screen experiences. Scientific difficulty should come from the ideas, not from navigating the site.

---

<a id="section-05"></a>

## 5. The 1904 knowledge boundary

### 5.1 A historically disciplined discovery workspace

The opening workspace is explicitly set at **the end of 1904**. It contains problems, measurements, mathematical techniques, and competing interpretations available by that cutoff. A separate chronological progression then admits results from the 1905 papers as they are developed. The September mass–energy journey may use the earlier relativity paper, but its provenance must say so.

Distinguish four historical statements:

- A result was publicly available by a given date.
- There is evidence Einstein knew or used it.
- The paper itself cites or asserts it.
- The site uses it in a plausible reconstruction.

These are not interchangeable. The final category should be labeled **“A route you could take”**, not “What Einstein thought.”

### 5.2 Knowledge cards

Each historical premise gets a card containing a source, date or date interval, precise proposition, relevant limits, availability status, and the discovery steps permitted to use it. A later experiment can be excellent evidence while being unavailable in the historical workspace.

The initial research queue should cover classical mechanics, Maxwellian electrodynamics, thermodynamic relations, kinetic/statistical approaches, osmotic pressure, Stokes drag, radiation spectra, Planck's work, Lenard's photoelectric investigations, and pre-1905 discussions of transformations and time. The four papers themselves provide starting references. Publication of those cards requires checking their original sources rather than promoting this queue into a completed historical catalogue. ([P-01]–[P-08])

### 5.3 Anachronism controls

| Temptation | Required editorial treatment |
|---|---|
| Start with the familiar phrase “ultraviolet catastrophe” | Identify later terminology as later; distinguish pre-1905 radiation difficulties from the exact later textbook narrative |
| Put the full Rayleigh–Jeans history in the 1904 drawer | Audit dates and forms individually; do not silently import the 1905 Jeans contribution |
| Say Planck had already proposed Einstein's light quanta | Distinguish oscillator-energy assumptions from radiation behaving as independent quanta |
| Start with photons, wavefunctions, or Bose statistics | Modern vocabulary and theory must be labeled and may not supply hidden historical premises |
| Describe Einstein as proving that light is not a wave | Preserve the wave description's successes and the restricted inference of the light paper |
| Say everyone rejected atoms | Represent real contemporary disagreement and existing molecular reasoning rather than inventing a unanimous consensus |
| Say Einstein simply explained observations he had studied in detail | Preserve the Brownian paper's introductory uncertainty about the reports |
| Use Langevin equations or Wiener-process notation as Einstein's derivation | Offer them as modern computational or mathematical lenses, not as the source argument |
| Use spacetime diagrams as though they were the paper's own presentation | Identify them as a later geometric aid; derive the source result without requiring them |
| Make Michelson–Morley the sole documented cause of the relativity paper | Separate the paper's references to failed ether-drift detection from claims about Einstein's personal path |
| Conflate contraction with what a camera sees | Separate simultaneous-coordinate measurement from received light and optical appearance |
| Treat modern SI constants as measurements available in 1904 | Use separate historical and modern constant sets, with explicit precision and evidential status |

The dates and attributions behind later developments must be attached to checked source cards before publication. The crucial engineering requirement is that unavailable premises cannot enter a historical derivation invisibly.

### 5.4 Reasonable alternatives deserve a fair hearing

A “wrong turn” should specify a coherent hypothesis and the circumstances in which it works. Galilean transformations remain useful at low speeds; wave models retain enormous explanatory value; deterministic microscopic mechanics can underlie stochastic coarse-grained predictions. The website should teach model selection, not retrospective ridicule.

A failed alternative must fail on a stated constraint or observation. An alternative empirically equivalent within the chosen scope should not be declared refuted merely because the site prefers a more economical interpretation.

---

<a id="section-06"></a>

## 6. Foundation library: explain the exact obstacle, then return

Build the first foundation lessons in response to the actual paper dependency graphs. Do not spend months authoring an independent undergraduate textbook.

| Foundation | Concrete entry point | What the reader must be able to do afterward |
|---|---|---|
| Quantities and units | Is a number in meters comparable with one in seconds? | Distinguish a quantity from its numerical representation and check an equation's dimensions |
| Ratios and scaling | Double a length; compare area, volume, and a plotted effect | Predict proportional, inverse, and squared dependence |
| Functions and graphs | A table of paired measurements | Read axes, inputs, outputs, slope, and a parameterized family |
| Derivatives | Move one control a little and compare the output | Interpret local sensitivity with units |
| Partial derivatives | Change temperature while holding volume fixed | State what is held fixed and why it matters |
| Integration | Add narrow strips or accumulated contributions | Interpret an integral as a limit of sums, including a normalization integral |
| Taylor expansion | Compare a curve with its local polynomial | Explain a retained term, a neglected term, and a range of usefulness |
| Exponentials | Repeated proportional changes | Read growth, decay, and dimensionless exponents |
| Logarithms | Turn repeated multiplication into addition | Understand why independent probability products produce additive entropy |
| Probability and independence | Place independent points into subregions | Calculate a product probability and identify when independence fails |
| Distributions | Many repeated outcomes instead of one trajectory | Distinguish a density, a bin probability, and a single observation |
| Mean, variance, and RMS | A balanced set of positive and negative displacements | Explain why the mean can vanish while the spread grows |
| Gaussian distributions | Accumulate many small symmetric displacements | Connect width, normalization, and second moment without assuming the central limit theorem as magic |
| Flux and continuity | Count crossings of the boundary of a small interval | Derive a conservation equation and distinguish density from flux |
| Diffusion equation | More arrivals than departures at a local dip | Interpret curvature-driven change and boundary conditions |
| Work and energy | Force through distance; accounting before and after | Distinguish force, work, power, and reference choices |
| Temperature and thermal energy | A distribution of microscopic motion | Use absolute temperature without equating it to an individual particle's energy |
| Entropy and multiplicity | More accessible configurations at fixed constraints | Understand a relative entropy change without relying on the slogan “disorder” |
| Free energy and osmotic pressure | Move a selective partition | Connect a volume-dependent free energy to a mechanical force |
| Viscosity and Stokes drag | Slow motion of a sphere through a liquid | Understand mobility and why geometry/regime qualifications matter |
| Vectors and components | Describe one arrow in two coordinate systems | Change components without confusing that with changing the physical object |
| Matrices and linear maps | Transform a grid and an event table together | Read a matrix as a rule for combining inputs |
| Frames and events | Several clocks record local occurrences | Distinguish coordinate description, measurement procedure, and optical reception |
| Dot and cross products | Projection and oriented area | Follow field transformations and magnetic-force directions |
| Fields and waves | Values assigned across space, sampled at successive times | Understand phase, frequency, amplitude, propagation direction, and local field quantities |
| Electromagnetism needed here | A charge, current, field, and detector | Follow the paper's claims without requiring a complete prior E&M course |
| Conservation and symmetry | Relabel an experiment or change frame | Identify a quantity or relation that should remain unchanged |
| Error and inference | Several noisy estimates of the same parameter | Separate sampling uncertainty, measurement uncertainty, model error, and numerical error |

Each foundation has a compact explanation, one worked example, one instrument or manipulable construction where useful, a textual equivalent, prerequisites, and backlinks to every place it is needed. Foundation text must itself render correctly in print and without JavaScript.

### 6.1 The missing foundation beneath “basic mathematics”

Add a **zero-assumed-algebra** layer beneath the existing foundation table. These lessons are generated by genuine obstacles in the papers, not a semester-long prerequisite course that delays entry.

| Small obstacle | Concrete bridge | Readiness demonstrated without a formal test |
|---|---|---|
| A letter stands for a quantity | Replace a labeled blank in a measurement sentence with several numbers | Explain what changes and what the letter continues to mean |
| An equals sign describes a relationship | Balance two explicit counts or measurements | Distinguish a statement of equality from an instruction to calculate |
| Negative numbers and direction | Mark steps to the left and right of a starting point | Explain why opposite signed displacements cancel |
| Fractions and ratios | Share a fixed total among different numbers of items | Compare “per item” with the total |
| Squaring and square roots | Compare a length with the area of its square, then undo that operation | Understand why quadrupling a mean square doubles its square root |
| Scientific notation and units | Zoom from a meter ruler to a micrometer scale, with each conversion shown | Compare magnitudes without counting a string of zeros |
| A graph | Build a two-column table first, then place its paired values on labeled axes | Identify a point without assuming familiarity with axes or slope |
| A sum and an average | Combine four values, then share the total equally | Distinguish total, average, and the number of observations |
| Mathematical punctuation | Compare a finite change `Δx`, a derivative, a primed frame label, and an exponent | Recognize that similar-looking marks have different jobs |
| Probability notation | Count a selected outcome within a finite set of possibilities | Distinguish a single outcome, a frequency of outcomes, and a model probability |

“Explain from the beginning” should land on one of these concrete operations when needed, not on another paragraph full of words such as *linear*, *differential*, *distribution*, and *invariant*.

### 6.2 A fully specified first encounter: zero average is not no movement

Use the four **authored arithmetic examples** `−3, −1, +1, +3` displacement units. They are not a measured Brownian dataset. Initially describe them as three steps left, one left, one right, and three right; symbols can appear afterward.

Ask whether the observations show no movement. Add the signed displacements: the result is zero. Then ask how to preserve the information about how far the observations are from the start. Accept **both** “ignore the direction” and “square each value” as sensible proposals. The mean absolute displacement is 2 units; the mean-square displacement is 5 squared units. Doubling every displacement gives 4 units and 20 squared units respectively.

Only then explain why Einstein's route favors the mean square: under the stated independence and zero-mean assumptions, the cross terms in the square of a sum vanish on averaging, which makes the growth law especially tractable. Mean absolute displacement is not a wrong answer; it answers a related question and also scales with the spread in the ideal Gaussian model.

The visual action, keyboard action, and screen-reader action all manipulate the same four entries and expose the same totals. A nonvisual reader should not receive a different, weaker question. The link to BM-01 and the original displacement passage makes the arithmetic exercise a real entrance to the paper.

### 6.3 Contextual completeness without prerequisite explosion

Each foundation node offers a compact example, the mathematical account, and an explanation of why it is needed **at the calling passage**. The same derivative lesson may return to a temperature derivative, a concentration gradient, or a time-rate measurement; its return caption must name the right quantity and what is fixed.

A selected proof must have an acyclic dependency route to its stated entry assumptions. The broader concept map may contain cross-links and alternative routes; those are not automatically logical circles. Permit a reader to use an already understood result while marking its deeper derivation as available rather than requiring everyone to reach the same elementary leaf.

<a id="section-07"></a>

## 7. Discovery journey I: why suspect that light comes in energy quanta?

### 7.1 The opening puzzle

Begin with a tension, not with `E = hν`.

The reader has two extraordinarily useful descriptions: matter represented through discrete constituents, and light represented by continuous electromagnetic fields. Show a wave spreading across a surface and ask what happens to the energy associated with a smaller and smaller patch. Then contrast that with distributing a finite collection of independent objects among compartments. Neither picture is labeled “the answer.”

The task is to find a measurable property that might distinguish how energy is organized. Radiation entropy provides that bridge in Einstein's paper. The source-grounded journey should make that bridge the centerpiece; photoelectric emission becomes a compelling consequence rather than a replacement for the main argument. ([P-01]; [P-02])

### 7.2 Sequence of discoveries

**Stage A: trust the successes before inspecting the failure.** Give the wave picture a serious demonstration: propagation, interference of a simple prescribed field, and time-averaged intensity. State which effects this reduced model represents. Do not use a particle visualization to deny interference or suggest the 1905 paper supplied complete quantum optics.

**Stage B: examine a radiation spectrum.** Plot spectral energy density against frequency at adjustable temperature. Keep empirical points, historical fitted laws, and theoretical curves visibly distinct. The site must not manufacture a convincing-looking “1904 measurement” by sampling a modern formula and adding noise.

Introduce mode counting and classical energy sharing with a finite maximum frequency. Let the reader increase the cutoff and observe what the implied total energy does. Label the exact formula's historical status. This makes a consistency problem visible without compressing the history into a slogan.

**Stage C: choose a regime in which the empirical law is simple.** Enter the high-frequency/low-occupation Wien regime. Use the dimensionless quantity `x = hν/(k_B T)` in the modern notation layer, but in discovery narration initially expose the historical spectral constants rather than introducing `hν` as already established light-packet energy.

For a modern comparison instrument:

$$
 u_\nu(T)=\frac{8\pi h\nu^3}{c^3}\frac{1}{e^{h\nu/(k_B T)}-1},
 \qquad
 u_\nu^{\mathrm{Wien}}(T)=\frac{8\pi h\nu^3}{c^3}e^{-h\nu/(k_B T)}.
$$
These curves are a way to inspect regimes. They are not presented as an independent experimental validation of themselves. The interface must identify `u_ν` as energy per volume per frequency, not radiance. Switching to wavelength density includes the Jacobian; it is not merely relabeling the horizontal axis.

**Stage D: recover the volume dependence of entropy.** Walk through the thermodynamic relation, the inversion of the Wien law, the zero-radiation entropy boundary condition, and the integration at fixed narrow frequency band. Compare constrained states at fixed total energy, frequency, and band width; do not animate a literal adiabatically compressed cavity, which would change the energy and frequencies. Both comparison states must remain in the admitted Wien regime. Section 7.6 specifies the complete calculation and why the integration constant matters.

The modernized endpoint is:

$$
 \Delta S_{\mathrm{rad}}
 = k_B\frac{E}{h\nu}\ln\!\left(\frac{V}{V_0}\right).
$$
Do not initially interpret `E/(hν)` as a particle count. Present it as a coefficient that has emerged from an entropy calculation. The source-notation path retains the original constants and then shows their mapping. Each derivative, logarithm, normalization condition, and genuinely canceling term has a drill-down. An arbitrary additive entropy-density constant cannot simply be discarded when the volume changes.

**Stage E: solve a simpler counting problem.** Put `n` independent points into a volume `V₀`. Ask for the probability that all happen to lie in a subvolume `V`:

$$
 W=\left(\frac{V}{V_0}\right)^n,
 \qquad
 \Delta S=k_B\ln W=nk_B\ln\!\left(\frac{V}{V_0}\right).
$$
The partition can be dragged. For small `n`, show individual configurations and exact counting/probability. For large `n`, show logarithmic probability rather than an endless animation waiting for an astronomically rare event. Distinguish a probability of spontaneous concentration from the thermodynamic comparison between constrained states.

**Stage F: let the reader compare the two expressions.** Place the gas and radiation entropy laws beside one another, initially without the interpretive label. Ask what would play the role of “number of independent things” in the radiation expression. Then reveal the proposed correspondence and the implied energy per thing.

The important conclusion is not “we drew dots, therefore light is made of dots.” It is that, within the stated regime, the radiation's entropy has a dependence associated with independent energy elements. The extension to emission and transformation processes is a further physical hypothesis, not algebra alone.

**Stage G: demand consequences.** Only now open fluorescence, photoelectric emission, and gas ionization. Let the reader predict what changes when intensity doubles, when frequency increases, or when a material's escape-energy parameter changes.

### 7.3 Photoelectric instrument contract

Inputs include frequency, incident optical power, an explicitly modeled work function, collector potential, and a declared collection/yield model. The central relation is:

$$
 K_{\max}=h\nu-\Phi,\qquad eV_s=K_{\max}
$$
when emission is allowed under the modeled single-quantum assumptions. Below threshold, the physical output is **no emitted electron in this model**, not a negative kinetic energy. The signed energy budget may still be displayed as an explanatory deficit.

Separate maximum electron energy from electron count. An optional idealized counting model can use a declared efficiency `η_q` and incident quantum rate `P/(hν)`. At fixed frequency, changing power changes rate, not `K_max`; at fixed power, increasing frequency also reduces the number of incident quanta per second. Do not imply a universal real-material photocurrent curve from these simple assumptions.

A neutral numerical fixture uses a **hypothetical** work function of 2 eV. At 600 THz, the ideal maximum energy is about 0.4814 eV; the threshold frequency is about 483.6 THz. These are calculations from modern constants, not measurements of a named metal. Named material presets require cited, condition-specific data. [T-07]

The moving marks in the apparatus are a teaching representation. Their size, visibility, and frame cadence are not a literal picture of photons. Ultraviolet and infrared frequencies must not be shown as physically visible colors without a clear false-color legend.

### 7.4 Fluorescence and ionization are real deliverables

The fluorescence instrument tracks incident energy, emitted light, and other energy channels. Readers can ask why a lower emitted frequency is natural under a one-input-quantum, no-extra-energy assumption. Relaxing assumptions must update the model explanation, not quietly break conservation. The source's qualifications remain visible.

The ionization instrument relates absorbed energy, ionization thresholds, and event counts under an explicit one-quantum hypothesis. It is not a first-principles gas discharge simulator. Do not invent cross-sections or efficiencies to make a scene busy.

### 7.5 What the reader should leave able to explain

The success condition is not merely recalling a threshold-frequency formula. The reader should be able to explain why entropy was an unexpectedly powerful diagnostic, how a volume dependence suggested an effective count, which step was heuristic, and why the wave theory's successes did not disappear.

### 7.6 The entropy workbench must preserve the actual calculation

This is a scientific correction to an underspecified part of the original plan, not a change in the central result. Introduce editorial names `A` and `B` for positive spectral constants, with an explicit mapping to Einstein's original notation. In the admitted Wien approximation,

$$
\rho_\nu=A\nu^3 e^{-B\nu/T},\qquad
\left(\frac{\partial s_\nu}{\partial\rho_\nu}\right)_\nu=\frac1T
=-\frac{1}{B\nu}\ln\frac{\rho_\nu}{A\nu^3}.
$$

Here `ρ_ν` and `s_ν` are spectral energy and entropy densities per unit frequency. Integrating the derivative alone leaves an additive term `C(ν)`. The source fixes it by requiring the radiation entropy density to vanish at zero radiation density. Thus, within the approximation,

$$
s_\nu=-\frac{\rho_\nu}{B\nu}
\left[\ln\frac{\rho_\nu}{A\nu^3}-1\right].
$$

Now use a narrow, fixed frequency interval `Δν`, total energy `E = V Δν ρ_ν`, and `S = V Δν s_ν`. Comparing the two specified states gives

$$
S(V)-S(V_0)=\frac{E}{B\nu}\ln\frac{V}{V_0}.
$$

Only after this calculation should the modern concordance identify `B = h/k_B`. An unfixed entropy-density constant would contribute `Δν C(ν)(V−V₀)` and would **not** cancel. This boundary condition is visible on original journal page 139. [P-01]

The visual compares **states with the same energy and narrow frequency band**. A literal moving-mirror compression generally changes both, so do not make that movie stand in for this comparison. Show the constrained quantities beside the control. Changing volume changes density; the admitted dilute/Wien regime must hold at both endpoints. The reading mode remains available when a proposed state leaves that regime.

A modern spectrum comparison may display `(u_Planck−u_Wien)/u_Planck = e^{-x}`, where `x=hν/(k_B T)`. This is a pointwise spectral-density comparison, not automatically an error certificate for the integrated entropy argument. The effective coefficient `E/(hν)` is not rounded to an integer to manufacture a particle count.

### 7.7 Two spectral-coordinate traps to prevent

The frequency-to-wavelength conversion is

$$
\nu=c/\lambda,\qquad
u_\lambda(\lambda)=u_\nu(c/\lambda)\frac{c}{\lambda^2},
$$

Here `u_λ` is energy per volume per wavelength, not frequency. Use distinct semantic IDs such as `frequencyEnergyDensity` and `wavelengthEnergyDensity`; a similar-looking glyph is not a binding key. The energy in matching physical bands agrees; the density peaks need not correspond by simply substituting `λ=c/ν`.

For a distribution **per logarithmic interval**, the plotted density is `νu_ν` or `λu_λ` for natural-log coordinates, with an additional `ln(10)` factor for base-10 logarithmic intervals. Merely using a logarithmic horizontal axis does not redefine what the vertical density means. Axis labels, units, integrals, and captions must agree.

These are valuable teaching moments: changing coordinates changes how much spectrum is represented by a unit-width bin, not the energy in a specified physical band. LQ-03 should let the reader preserve a selected band while switching representations.

### 7.8 What the photoelectric experiment does and does not establish

Define the collector-potential sign, electron charge sign, and positive stopping-potential **magnitude** separately. At the threshold, zero maximum kinetic energy does not guarantee a nonzero measurable current. A collector sweep needs a declared distribution/collection model; the maximum-energy formula alone does not specify the full current–voltage curve.

Keep a small, clearly later-context note distinguishing Einstein's historically consequential light-quantum hypothesis from a claim that the photoelectric relation uniquely proves every feature of modern quantized radiation. Lamb and Scully's later semiclassical treatment is an example of why such a uniqueness claim would be too strong. This note belongs outside the 1904 workspace and is not a replacement for the source argument. [R-01]

LQ-05 also needs a useful counterexample: if `n` positions are perfectly locked together and uniformly located, the probability that all lie in a subvolume fraction `f` is `f`, not `f^n`. Independence is doing work in the gas analogy. Show this as an authored mathematical comparison, not as an alternative model of actual radiation asserted without evidence.

---

<a id="section-08"></a>

## 8. Discovery journey II: how can visible wandering reveal invisible molecules?

### 8.1 Begin with the observable, not a microscopic cartoon

Open on a calibrated microscopic field containing suspended tracer particles. Offer a real, licensed observation sequence when available, with acquisition and calibration information. Until such a sequence exists, use a conspicuously labeled synthetic observation and do not treat it as historical evidence.

Ask three questions: Is there a net drift? Does a longer observation produce proportionally more displacement? Which statistic remains stable when individual paths do not?

The first discovery is that signed displacements can average to approximately zero while their squares reveal a growing spread. The reader must choose an observable before being given the final law.

### 8.2 Two routes that meet at the diffusion coefficient

There are two complementary arguments:

- A thermodynamic and mechanical route obtains the diffusion coefficient from osmotic pressure and drag.
- A statistical route relates that coefficient to the distribution of displacement.

The journey should let the reader understand both routes and then experience their convergence. That is more powerful than starting with `⟨x²⟩ = 2Dt` and attaching random motion to it. ([P-03]; [P-04])

### 8.3 Route A: pressure, drag, and equilibrium

**First, a selective partition.** Show solvent passing through a membrane while suspended particles cannot. Vary particle number and accessible volume. The dilute model's osmotic pressure is:

$$
 \Pi=n k_B T,
$$
where `n` is number per volume. A symbol card must distinguish `n` from total particle count `N_p` and from the molar constant `N_A`.

**Second, justify the volume dependence.** Build the many-particle position integral from a one-particle volume factor. Under the relevant independence/dilution assumptions, the position contribution scales as `V^{N_p}`. Its logarithm contributes a term proportional to `N_p ln V`, and differentiating free energy with respect to volume yields pressure.

This is an ideal place for a “How did you avoid solving every molecular motion?” explanation. The answer is that the required volume dependence can be obtained without evaluating all microscopic details. The source's statistical-mechanical section deserves a complete guided reading, including its assumptions.

**Third, apply a weak external force.** For a slowly moving sphere of radius `a` in a Newtonian fluid with viscosity `η`, the admitted Stokes mobility is:

$$
 \mu=\frac{1}{6\pi\eta a},\qquad u=\mu F.
$$
The force creates a drift flux `nμF`; a concentration gradient creates a diffusion flux `-D ∂n/∂x`. At equilibrium:

$$
 J=n\mu F-D\frac{\partial n}{\partial x}=0.
$$
The osmotic balance supplies:

$$
 nF=k_B T\frac{\partial n}{\partial x}.
$$
Compare the two balances and obtain:

$$
 D=\mu k_B T=\frac{k_B T}{6\pi\eta a}
   =\frac{RT}{6\pi\eta a N_A}.
$$
The force is a device for relating two descriptions of equilibrium; its particular magnitude drops out. Make that cancellation visible. At zero force and zero gradient, do not pretend division of zero by zero proves the relation; explain the nontrivial equilibrium construction and its limiting use.

### 8.4 Route B: from irregular steps to a deterministic distribution

Start with an explicit pedagogical random walk: independent steps `±ℓ` separated by time `τ`. Expand the square of the sum. The cross terms average away under the assumptions, leaving variance proportional to step count. This is a mathematical bridge, not a claim that a liquid makes a tracer execute literal fixed-length jumps.

Then generalize to a symmetric transition density `φ(Δ)`:

$$
 p(x,t+\tau)=\int p(x-\Delta,t)\phi(\Delta)\,d\Delta.
$$
Expand the left side in `τ` and the right side in `Δ`. Let the reader cancel the zeroth-order terms and observe why the first spatial moment vanishes. Identify:

$$
 D=\frac{\langle\Delta^2\rangle}{2\tau},
 \qquad
 \frac{\partial p}{\partial t}=D\frac{\partial^2 p}{\partial x^2}.
$$
State the scaling and coarse-graining assumptions. Independence is not asserted down to arbitrarily small physical times.

For an initially localized ensemble on an unbounded line:

$$
 p(x,t)=\frac{1}{\sqrt{4\pi Dt}}e^{-x^2/(4Dt)},
 \qquad \langle x\rangle=0,
 \qquad \langle x^2\rangle=2Dt.
$$
The foundation panel explains how a probability density differs from a probability. Selecting an interval shades its probability mass, and the displayed integral updates from the same numerical state.

### 8.5 The inference laboratory

Now invert the relation:

$$
 N_A=\frac{RT}{6\pi\eta aD}.
$$
The discovery instrument must keep the unknown quantity genuinely unknown. In this mode, `R`, temperature, viscosity, radius, and measured displacements form the inputs; a modern exact `k_B` must not quietly enter the data-generation or inference path as independent historical evidence.

Provide two explicitly different activities:

**Synthetic inverse exercise:** a labeled generator creates observations with a hidden parameter. The reader estimates it. Success checks inference machinery and understanding, not the existence of molecules.

**Historical or real-data inference:** source-pinned observations with independently established calibration and measurement conditions support a physical estimate. Show the data's actual acquisition date; later observations do not become available in the 1904 workspace merely because they test a 1905 prediction.

The basic estimator begins with independent, equally spaced increments under known zero drift and negligible measurement error, with its dimension and sample count explicit. Sections 8.9–8.10 specify the estimator, confidence interval, inverse-parameter bias, and the separate measurement model. Adjacent measured increments can be correlated even when the underlying physical increments are independent, because they share a noisy endpoint. An error slider must change the likelihood and uncertainty contract, not just add visual jitter. Overlapping displacement windows do not create independent samples.

### 8.6 The core linked visualization

One accepted experiment snapshot drives a tracer view, a displacement histogram, an analytic Gaussian overlay, a mean-squared-displacement plot, a live equation, and the parameter estimate. A marker selected in one panel is selected in the others. A displayed microscope boundary is a camera viewport, not a reflecting physical wall unless a wall model has explicitly been chosen.

A useful modern illustrative baseline is:

- `T = 293.15 K`, `η = 1.000 mPa·s`, sphere radius `a = 0.500 µm`.
- `D ≈ 0.42944 µm²/s` using the stated modern constant set.
- One-dimensional RMS displacement is approximately `0.92676 µm` after 1 s and `2.93066 µm` after 10 s.

This is an idealized fluid specification, not a claim that the chosen viscosity exactly describes water under every condition. The arithmetic values are derived fixtures, not experimental observations. [T-07]

### 8.7 Physical and numerical boundaries

The primary physical model is dilute, approximately spherical tracers in a homogeneous Newtonian fluid, in an admitted low-Reynolds-number, long-enough-time regime, with the stated boundary conditions. Near-wall hydrodynamic corrections, anomalous diffusion, active motion, non-Newtonian effects, and microscopic collision dynamics are not silently included.

A modern overdamped Gaussian-step representation may be used computationally, with its provenance explicit. A later underdamped/Langevin extension can illustrate the crossover between ballistic and diffusive descriptions, but it is not Einstein's original derivation and is not required before the core paper ships.

Changing the render frame rate must not change the stochastic experiment. Comparing parameter choices using common random numbers is useful for isolating effects, but the interface must not call those runs independent trials.

### 8.8 Probability laws, radial plots, and legitimate limiting states

The displayed Gaussian density applies for `D>0` and `t>0`. At zero elapsed time, an initially localized particle has a **point distribution**. Represent that with a tagged analytical state and interval probabilities, not an infinite-height numerical bar, `NaN`, or an unexplained error. A mathematical `D=0` limit can be shown separately without claiming that every zero-diffusivity parameter combination belongs to the physical fluid model.

A two-dimensional radial distance is not a signed Gaussian coordinate. In free isotropic diffusion,

$$
p_r(r,t)=\frac{r}{2Dt}e^{-r^2/(4Dt)}\quad(r\geq0),\qquad
\langle r^2\rangle=4Dt,\qquad
\langle r\rangle=\sqrt{\pi Dt}.
$$

Thus mean radius and RMS radius differ. The extra factor of `r` counts the increasing circumference of available positions. This deserves a picture, a table, and a nonvisual counting explanation, not an unexplained switch of histogram shape. Three-dimensional radial distributions likewise require their own geometric factor.

Keep four distinctions visible: a single trajectory versus an ensemble; position versus displacement over a chosen interval; a signed coordinate versus a radius; and mean square versus square of the mean. An ensemble histogram at one time must not silently become a time-average of positions along one nonstationary free-diffusion path.

### 8.9 A specified inference model, not an unspecified straight-line fit

For `M` independent displacement vectors in `d` measured coordinates, equally separated by `Δt`, with known zero drift, isotropic free diffusion, and negligible measurement error, use

$$
\widehat D=\frac{\sum_{i=1}^{M}\|\Delta\mathbf r_i\|^2}{2dM\Delta t}.
$$

The squared, standardized Gaussian coordinates give the exact model pivot `q D̂/D ~ χ²_q`, with `q=dM`. A two-sided confidence interval with nominal coverage `1−α` is

$$
\left[\frac{q\widehat D}{\chi^2_{q,1-\alpha/2}},
      \frac{q\widehat D}{\chi^2_{q,\alpha/2}}\right].
$$

The foundation route explains the interval through repeated hypothetical experiments before introducing the chi-square name. It must not describe the interval as a posterior probability for a fixed unknown parameter without a Bayesian model.

When a constant unknown drift is estimated from the same data, center the increments and use `M−1` in the unbiased diffusivity estimator, with `q=d(M−1)`; require `M>1`. A maximum-likelihood version using `M` instead has a different finite-sample bias. The schema names which estimator is used. Neither formula is admitted unchanged for arbitrary blurred, correlated, irregularly timed, or censored tracks.

For `C=RT/(6πηa)`, the transformed molecular-number estimate is `C/D̂`. Inverting an unbiased diffusivity estimate is not generally unbiased: in this ideal model and for `q>2`, its expectation is `N_A q/(q−2)`. Keep that as an optional statistical explanation, not a demand that an introductory reader learn estimator theory first. Transform the interval by reversing its endpoints: `[C/D_high, C/D_low]` when `C` is treated as known. Uncertainty in `C` requires an additional, stated procedure.

The instrument should reveal **identifiability** with an elementary example: multiplying `a` by two and dividing `N_A` by two leaves the predicted diffusivity unchanged at fixed `R,T,η`. Displacements alone cannot determine both independently. Show the family of compatible inputs before offering a narrow interval conditional on a known radius. In the modern SI, `N_A` is defined exactly; distinguish a historical estimate or modern consistency experiment from “measuring an unknown current SI constant.” [T-07]

### 8.10 Observation noise changes statistical dependence

For instantaneous measured positions `y_i=x_i+ε_i` with independent, zero-mean position errors of variance `σ²`, the measured increment contains `ε_{i+1}−ε_i`. Neighboring increments share a noise sample with opposite signs. Consequently their noise covariance is `−σ²`, even though physical free-diffusion increments are independent.

A separately admitted **uniform-exposure** model with exposure duration `T_e≤Δt`, repeated equal frame spacing, independent localization errors, and zero drift has

$$
\operatorname{Var}(\Delta y_i)=2D(\Delta t-T_e/3)+2\sigma^2,\qquad
\operatorname{Cov}(\Delta y_i,\Delta y_{i+1})=DT_e/3-\sigma^2.
$$

These follow from the camera-averaged Brownian covariance; Berglund gives the general shutter-function formulation. They specify a later measurement model, not Einstein's derivation. The ideal independent-increment interval must be disabled or explicitly shown as an intentionally invalid comparison when its assumptions fail. [R-02]

Physical-path randomness and observation-error randomness use separate logical streams. Changing a camera setting re-observes the same identified path where supported; it must not secretly replace the underlying trial. Do not attribute every broadened displacement histogram to increased physical diffusion.

### 8.11 The rendering must not change the observed population

A free-diffusion path leaving the viewport remains part of the physical ensemble. Do not wrap it to the opposite edge, reflect it, replace it with a fresh particle, or exclude it from the inference merely to keep the screen populated. Each of those choices changes the experiment or its selection mechanism.

A real camera's finite field of view can cause track loss. Treat that as censoring with a declared observation/selection rule, not a silent data cleanup. The introductory inference route uses complete admitted samples; a later track-loss exercise can demonstrate bias without pretending to correct every tracking artifact.

Smooth lines between sampled positions are a rendering convention. They do not supply an instantaneous physical velocity for an ideal Brownian path. A visually dramatic collision bath may illustrate a proposed mechanism, but it is not the accepted owner of measured displacement unless an actual, appropriately validated microscopic model is running.

A model-validity check must distinguish an explicitly assumed regime from one quantitatively checked using supplied properties. Without the needed fluid/particle properties and time-scale information, do not certify a low-Reynolds or overdamped regime numerically. In particular, do not estimate a “physical Brownian speed” from an arbitrarily fine line-segment rendering and use it to gate Stokes drag. Missing inputs yield an assumption-qualified example or an unavailable quantitative check, not invented material data.

---

<a id="section-09"></a>

## 9. Discovery journey III: how could you stop assuming that everyone shares the same time?

### 9.1 Begin by making a measurement procedure

The opening task is not “accept that time is relative.” It is: **You have separated stations, clocks, rulers, and light signals. How will you assign a time to an event that happens elsewhere?**

A programmer-friendly analogy is a distributed event log, but the explanation must state its limit: relativistic synchronization is not merely a software bug or variable network latency. Signals and clocks are physical systems, and changing inertial frames changes the operational coordinate assignment.

The apparatus has two views: an event ledger and a spatial scene. The ledger is primary. It records emission, reflection, and reception at named clocks. The scene makes the procedure concrete without implying that what a distant camera sees equals simultaneous coordinate measurement.

### 9.2 Make the ordinary assumption explicit

Offer the Galilean map:

$$
 x'=x-vt,\qquad t'=t.
$$
Let the reader test it on low-speed objects. It works in the familiar regime. Then apply it to light trajectories `x=±ct`. Ask what speed the new coordinates assign.

The point is not that algebra has disproved classical mechanics by itself. The point is that the map does not jointly preserve the light-speed postulate and absolute time. The conflict is between stated commitments. The reader must decide what to reconsider.

### 9.3 Build a candidate map instead of being handed the answer

In a reconstruction using accessible linear algebra, begin with:

$$
 x'=a(v)(x-vt),\qquad t'=b(v)t+d(v)x.
$$
Explain why uniform motion, homogeneity, the chosen origins, and inertial coordinate systems motivate an affine map, and why the origin convention removes the offset terms. Do not present linearity as a law that requires no assumptions.

Require the two light directions to remain `x'=±ct'`. This gives:

$$
 b(v)=a(v),\qquad d(v)=-\frac{a(v)v}{c^2}.
$$
There is still a scale factor. Make its existence visible; many superficial explanations lose it. Applying the inverse gives `a(v)a(-v)(1-v²/c²)=1`; spatial isotropy supplies `a(v)=a(-v)`. The positive branch continuously connected to the identity then gives:

$$
 a(v)=\gamma=\frac{1}{\sqrt{1-v^2/c^2}}.
$$
The resulting transformation is:

$$
 x'=\gamma(x-vt),\qquad
 t'=\gamma\left(t-\frac{vx}{c^2}\right),\qquad y'=y,\quad z'=z.
$$
The longitudinal derivation alone has not established the transverse equations. Complete the transverse step using the chosen axis normalization, spatial symmetry, and light propagation in transverse as well as longitudinal directions; do not silently copy `y′ = y` and `z′ = z` from the desired answer. This is **a pedagogical reconstruction**. The source-reading path separately walks through Einstein's synchronization-based derivation and its notation. Neither route is advertised as a transcript of his private thought process. ([P-05]; [P-06])

### 9.4 Interpret each new term before moving on

The subtraction `vx/c²` is not a correction to a defective clock. It tells us that a new frame's assignment of time depends on position as well as on the old time. Let the reader select two distant events and inspect whether they remain simultaneous.

At `v = 0.6c`, `γ = 1.25`. Two events separated by 10 light-seconds in space and simultaneous in the unprimed frame have `Δt' = -7.5 s` and `Δx' = 12.5 light-seconds`. That spatial separation is **not automatically a rod-length measurement** in the primed frame: the events are not simultaneous there. A separate control must select the appropriate pair of endpoint events for each measurement question.

The light-clock construction is a powerful supplemental derivation of time dilation. Use it after the measurement definitions, not as a complete substitute for the source's coordinate transformation. Show the diagonal light path and the calculation that relates a clock's proper interval to a frame's coordinate interval.

### 9.5 Derive consequences by changing the question, not the engine

The same event/frame model must support:

- Clock comparisons along specified worldlines.
- Rod measurements using frame-specific simultaneous endpoints.
- Velocity addition, derived as a ratio of transformed differentials.
- Null propagation and causal ordering.
- A modern geometric view using spacetime diagrams, explicitly labeled as a later representation.

For a boost in the x direction:

$$
 u'_x=\frac{u_x-v}{1-u_xv/c^2},\qquad
 u'_y=\frac{u_y}{\gamma(1-u_xv/c^2)}.
$$
The sign convention is fixed by the frame definition. A UI toggle must not silently reverse it. The inverse transform is a real operation with tests, not a second handwritten set of ad hoc display rules.

Spacetime diagrams must use coherent axis scaling when showing a 45-degree light cone. A camera zoom or aesthetic stretch must never imply changed physics. Use units such as light-seconds where they simplify the geometry; never conceal the unit conversion.

### 9.6 Do not abandon electrodynamics after §5

The second half deserves a second major act: **the same physics in different electric and magnetic descriptions**.

Start with vectors and a concrete prescribed field, then show what a moving test charge experiences. In a clearly labeled modern SI layer, for the stated boost convention:

$$
 \mathbf E'_{\parallel}=\mathbf E_{\parallel},\qquad
 \mathbf B'_{\parallel}=\mathbf B_{\parallel},
$$
$$
 \mathbf E'_{\perp}=\gamma(\mathbf E+\mathbf v\times\mathbf B)_{\perp},\qquad
 \mathbf B'_{\perp}=\gamma\left(\mathbf B-\frac{\mathbf v\times\mathbf E}{c^2}\right)_{\perp}.
$$
The original equations use historical conventions; the conversion is a derivation with an explicit mapping, not a typographic substitution. The reader can open the chain-rule transformation of derivatives and follow the transformed Maxwell equations component by component.

For the magnet/conductor introduction, distinguish a qualitative apparatus reconstruction from a quantitatively solved electromagnetic model. A narrow analytic field/charge example can establish frame consistency without falsely claiming that a generic circuit or flux routine solves an arbitrary moving magnet, conductor, and induced-current field.

### 9.7 Wave phase, Doppler shift, and moving mirrors

Use one plane-wave phase model to drive wavefront geometry, detector events, frequency, and direction. For a ray making angle `θ` with the positive boost axis in the unprimed frame:

$$
 \nu'=\gamma\nu(1-\beta\cos\theta),\qquad \beta=v/c,
$$
$$
 \cos\theta'=\frac{\cos\theta-\beta}{1-\beta\cos\theta}.
$$
At `β = 0.6`, a ray along the boost direction is reduced to half its original frequency; the opposite ray doubles in frequency. These are analytic fixtures, not observational evidence.

The finite light-complex instrument must show both amplitude transformation and the change of enclosed volume before explaining the total-energy result. The moving-mirror instrument should transform into the mirror frame, apply the specified reflection law, and transform back. It needs incidence-domain checks: a mirror receding faster than the normal component of the incident ray does not intercept that ray in the assumed geometry.

### 9.8 Charge/current and electron dynamics

Give charge density and current density their own linked vector/continuity view. A modern four-current representation can help, but must be labeled. Do not impose the invalid general condition `|J/ρ| < c` on net charge/current density: a neutral conductor can have zero net charge and nonzero current.

For electron dynamics, begin with force and acceleration in the appropriate frame, derive work as an integral, and compare the resulting energy/deflection relations with the low-speed limit. Explain the historical language of longitudinal and transverse mass rather than forcing it into a modern scalar-mass slogan. The original section and a modern momentum-based explanation must both be complete.

A tested analytic or narrowly integrated charged-particle model in prescribed fields is sufficient for this treatment. A general plasma or radiation-reaction solver is not.

### 9.9 Preserve the historical force conventions, not just the word “mass”

The original §10 prints a transverse inertial coefficient corresponding to `mγ²` in modern factor notation, not simply the modern laboratory-force coefficient `mγ`. Its stated convention combines force components in the instantaneously comoving frame with acceleration components in the original frame. Preserve and explain that convention instead of silently “repairing” the source. [P-05]

At an instant when the particle moves along the laboratory x-axis, a modern comparison can write

$$
F'_y=m\gamma^2 a_y,\qquad F_y=F'_y/\gamma=m\gamma a_y,
\qquad F_x=F'_x=m\gamma^3 a_x.
$$

Every force and acceleration must carry a frame identity. At `β=0.6`, the transverse coefficients in the two displayed conventions are respectively `1.5625m` and `1.25m`. These are not competing values of one scalar rest mass. The instrument must make the changed definition visible before comparing them.

Likewise, transforming Maxwell's differential equations into the same form is not, by itself, a uniqueness proof for every possible physical identification of the transformed fields. The full explanation of §6 must expose the field-transformation ansatz, common-factor argument, and normalization/symmetry conditions used in the source. The modern verification layer may use additional structure, but it must be identified as such. [P-05]

### 9.10 Compare covariant descriptions, not numerically identical components

A passive frame change describes the same events differently. Electric fields, magnetic fields, force components, coordinate time intervals, and charge density can change numerically. An acceptance test must compare the correct transformation law, the same event, and the same measurement procedure; demanding equal raw force values in two frames would be a bug.

Select an observer separately from the physical source and detector. “A detector moves differently” changes the experiment; “describe this detector in another coordinate frame” does not. This distinction must be present in the UI language and in the runtime command type.

Keep the initial kinematic core's scope explicit: aligned-axis boosts with the supported origins and orientations. A later arbitrary-frame implementation composes full frame maps, including translations where used. Non-collinear boost composition generally includes a spatial rotation; do not implement it by forcing the result into a pure boost with parallel axes. A modern extension can demonstrate this with a frame triad, but no such extension is required to follow the original aligned-axis derivation. The claim follows from composing the Lorentz matrices, and its software acceptance must test the full matrix rather than only an inferred speed.

### 9.11 A light packet is not a material rod; a moving mirror is not a fixed detector

For the finite plane-wave light complex in §8, define `q=γ(1−β cosθ)`. The source calculation gives the energy-density factor `q²` and the bounding-volume factor `1/q`, so that the total-energy factor is `q`. The volume refers to the same moving light complex on each frame's simultaneous slice. Substituting ordinary material-volume contraction `1/γ` generally gives the wrong result. The relevant original calculation is on journal pages 912–913. [P-05]

A useful narrow moving-mirror fixture is normal incidence in the laboratory, with signed mirror speed `βc` along the incident ray and a prescribed infinite-mass boundary. Then

$$
\frac{\nu_{\rm reflected}}{\nu_{\rm incident}}=\frac{1-\beta}{1+\beta}.
$$

At `β=0.6`, the reflected frequency is one quarter of the incident frequency. With incident laboratory intensity `I` and transverse mirror area `A_m`, the incident energy reaching the moving surface per unit laboratory time is `IA_m(1−β)`, not `IA_m`. The laboratory force is

$$
F=\frac{2IA_m}{c}\frac{1-\beta}{1+\beta},
$$

and the radiation energy lost per unit laboratory time equals `Fv` under these assumptions. This is a derived, source-compatible analytical fixture, not a real-material mirror calibration. Oblique incidence requires its separately implemented geometry and interception conditions; a finite-mass mirror requires recoil dynamics. Do not expand either scope by relabeling the same routine.

### 9.12 Clocks on curved paths and the Earth's surface require an editorial note

The full edition must include §4's discussion of transported clocks, its extension to curved paths, and its equator-versus-pole remark. An ideal-clock interpretation along a prescribed worldline is not a license to claim a complete model of arbitrary accelerated clock mechanisms. The source passage remains visible with these assumptions explained. [P-05]

Do not present the equator/pole remark as an accurate quantitative comparison of real clocks on the Earth's geoid using special relativity alone. A later treatment must account for gravitational as well as kinematic effects; Hafele's analysis explains the approximate cancellation in the idealized terrestrial comparison. This is a short limit-of-model note, not a new general-relativity prerequisite. [R-03]

For reciprocal clock-rate questions, compare complete specified worldlines and reunion events. A modern proper-time aid can explain why different elapsed times do not contradict reciprocal inertial descriptions. Do not add an unexplained “acceleration penalty” or solve a round-trip clock problem by splicing incompatible simultaneity conventions without saying so.

---

<a id="section-10"></a>

## 10. Discovery journey IV: can emitting light change inertia?

### 10.1 The deliberately minimal experiment

A body at rest emits two equal light pulses in opposite directions. In its own frame, the emission is symmetric. Ask why this is a clever arrangement: it removes recoil from the initial rest-frame bookkeeping and isolates an energy change.

Do not begin by asserting that each pulse is “mass converted to energy.” The purpose of the argument is to investigate the relation, not to assume it. The needed imported result is the transformation of light energy from the earlier relativity paper. ([P-07]; [P-08])

### 10.2 Keep two ledgers and four body-energy quantities

Let `L` be the total emitted energy in the body's initial rest frame. Use `E₀`, `E₁` for the body's before/after energies there, and `H₀`, `H₁` for its before/after energies in a frame moving at speed `v`.

The two pulses have moving-frame energies:

$$
 \frac{L}{2}\gamma(1-\beta\cos\phi),\qquad
 \frac{L}{2}\gamma(1+\beta\cos\phi).
$$
Their sum is `γL`. Let the reader rotate the emission axis: the individual transformed energies change, but their sum remains the same.

Write the balances:

$$
 E_0-E_1=L,\qquad H_0-H_1=\gamma L.
$$
Subtract:

$$
 (H_0-E_0)-(H_1-E_1)=L(\gamma-1).
$$
Make every cancellation a selectable operation. The next step explains the identification of each frame-energy difference with kinetic energy plus the same additive constant before and after emission. The source explicitly asserts that unchanged constant; the cancellation is not an independent derivation of the assertion. Preserve this premise and the source argument's scope rather than declaring the three-page argument a premise-free modern theorem for arbitrary systems. Section 10.6 supplies the implementation boundary.

### 10.3 Extract the low-speed coefficient

The source route compares the small-velocity expression with the classical kinetic-energy form:

$$
 K_0-K_1=L(\gamma-1)
 \approx \frac12\frac{L}{c^2}v^2.
$$
The reader should vary `v`, compare the exact curve and its quadratic approximation, and infer the change in the coefficient of `v²/2`. Identification of the limiting quadratic coefficient yields a mass loss of `L/c²` within the admitted premises. A finite-speed estimate `2(K₀-K₁)/v²` is generally not that limiting coefficient and must not be labeled the exact mass loss. Distinguish a positive **mass lost** from a signed mass change:

$$
 M_{\mathrm{before}}-M_{\mathrm{after}}=L/c^2,
 \qquad \Delta M=-L/c^2.
$$
Near zero velocity, use a cancellation-resistant evaluation of `γ-1`, for example `γ²β²/(γ+1)`, rather than losing the signal to floating-point subtraction. At exactly zero, evaluate relevant limiting ratios explicitly instead of dividing by zero.

At `v = 0.6c`, the exact kinetic-energy difference is `0.25L`, while the quadratic approximation is `0.18L`. That deliberate large discrepancy makes the approximation's domain visible. The reader then moves toward the low-speed regime and watches the coefficient stabilize.

### 10.4 Make the system boundary visible

A second instrument follows energy through three boundaries: the body alone, the emitted radiation, and the combined isolated system. Energy leaving the body does not disappear from the larger system. The UI must not imply that an isolated system loses total mass-energy when energy merely moves internally.

A modern extension can introduce total four-momentum and invariant system mass. Two equal opposite light pulses have nonzero invariant mass as a **system**, despite each pulse's massless constituents. This resolves a common confusion, but it is a later formal explanation and not a hidden premise of the 1905 derivation.

A “heated sealed box” example should specify how energy entered and what is inside the system. It is an energy/inertia ledger, not a general-relativistic weighing experiment. Do not smuggle in unmodeled external work or wall stresses while claiming a fully simulated apparatus.

### 10.5 Closing the four-paper experience

The conclusion should connect techniques rather than claim a single finished unified theory: infer hidden structure from constraints; choose observables that survive complexity; examine operational definitions; compare the same process in two descriptions; and exploit symmetry to cancel what you do not need to know.

The reader has not merely learned four famous formulas. They have practiced four ways of making a hard scientific problem tractable.

### 10.6 Do not bake the desired answer into the energy ledger

The discovery ledger's independent input is the emitted rest-frame energy `L`, together with the observer transformation and the stated source premises. Its immediate predictions concern **energy differences**. It does not know the body's absolute rest energy merely because the interface has room for a number.

Keep undetermined `E₀`, `E₁`, `H₀`, and `H₁` symbolic where appropriate, or show explicitly arbitrary reference offsets that cancel. Do not initialize them with `Mc²` or `γMc²` and then use the resulting animation to claim that the original argument derived those inputs. A modern four-momentum mode can use those relations, with a distinct model identity and an explicit dependency on later formalism.

The original's unchanged additive constant is a premise of its identification of the before/after kinetic-energy differences. Reproduce that reasoning, show what the subtraction establishes conditional on it, and distinguish the source's broader conclusion from a complete modern treatment of arbitrary stressed or open systems. This is not a reason to dismiss the argument; it is an opportunity to teach the difference between a productive physical argument and a theorem with fully specified hypotheses. [P-07]

### 10.7 Teach the coefficient before the slogan

An introductory entry can present two before/after accounting sheets in words and small numbers, with unknown internal quantities represented by covered boxes. The reader subtracts the sheets and discovers that some inaccessible details are not needed. Only afterward introduce the frame transformation and the small-speed coefficient.

The quantitative view should distinguish three outputs: the exact model difference `L(γ−1)`; the finite-speed proxy `2L(γ−1)/v²`; and the limiting coefficient `L/c²`. The proxy approaches the coefficient as `v→0`. At zero, the limiting output is well-defined even though its unreduced expression looks like `0/0`.

For system-boundary lessons, show where energy crosses the chosen boundary and who supplies any external work. The system consisting of body plus retained radiation is not the same as the body alone after radiation has escaped. A local energy-transfer cartoon must not be labeled a solved prediction about gravitational weighing, vessel stresses, or arbitrary material heating.

<a id="section-11"></a>

## 11. The instrument catalogue and its acceptance contract

### 11.1 Every instrument needs an answerable question

An instrument is not accepted because something moves. Its specification must contain an explanatory question, linked source/argument IDs, independent parameters, derived quantities, model assumptions, an admitted domain, a computational owner, a representation mapping, accessible equivalents, and tests that demonstrate the intended relationship.

All core instruments below are part of complete-paper scope. They can share engines, renderers, and layouts; the table is not a demand for one bespoke component or WASM binary per row.

| ID | Instrument | Principal controls or actions | Required observable / acceptance |
|---|---|---|---|
| LQ-01 | Wave description and energy spreading | Amplitude, phase, observation region | Intensity/energy behavior follows the declared field model; a continuous representation is not misrepresented as a particle proof |
| LQ-02 | Classical mode-energy allocation | Temperature, frequency cutoff, mode bands | Integrated energy responds to the cutoff; dimensions and historical status of the model are explicit |
| LQ-03 | Radiation spectrum and regime comparison | Temperature, frequency/wavelength axis, selected band | Band energy is invariant under correctly transformed spectral coordinates; limits and approximation error are visible |
| LQ-04 | Radiation entropy workbench | Accessible volume ratio, fixed energy, frequency band | The derived logarithmic volume dependence changes coherently across formula and graph |
| LQ-05 | Independent configurations | Particle count, subvolume fraction, enumeration/sample view | Exact small-case probabilities match the formula; rare events use honest logarithmic scales |
| LQ-06 | Match the entropy coefficients | Compare expressions; propose a correspondence | The reader identifies the effective count and can inspect the heuristic step separately from the algebra |
| LQ-07 | Fluorescence energy budget | Incident frequency, allowed output channel, extra-energy assumption | No hidden energy creation; assumptions behind Stokes-type restrictions are inspectable |
| LQ-08 | Photoelectric apparatus | Frequency, power, work function, collector potential | Energy and count respond differently; below-threshold states do not display emitted negative-energy electrons |
| LQ-09 | Ionization bounds and counts | Incident energy/frequency, idealized threshold, absorbed fraction | Correct energy bounds and counts under the stated idealization; no invented material-specific rates |
| BM-01 | Tracer ensemble and observable selection | Seed, observation interval, ensemble size, statistic | A vanishing signed mean is visibly compatible with growing spread |
| BM-02 | Osmotic partition | Particle count, volume, temperature | Number-density pressure and mechanical interpretation agree; dilution assumptions visible |
| BM-03 | Configuration integral | Number of independent coordinates, accessible volume | The volume factor and logarithmic free-energy term emerge stepwise without brute-force molecular dynamics |
| BM-04 | Drift–diffusion balance | Weak force, gradient, mobility, temperature | Drift and diffusive flux cancel at admitted equilibrium and determine the same diffusion coefficient |
| BM-05 | Random steps to diffusion | Step distribution, scale, observation interval | Symmetry removes the first moment; second moment sets diffusivity; invalid limiting assumptions are explained |
| BM-06 | Gaussian spread | Diffusivity, time, integration interval, dimension | Normalization and `2dDt` second moment hold; density and probability are not confused |
| BM-07 | Infer the molecular number | Observation set, calibration, radius, viscosity | A dimensionally correct estimate with stated uncertainty and noncircular data provenance |
| BM-08 | Measurement bias | Drift and independent localization error in the admitted basic model | Bias changes an estimator in the predicted direction; complex exposure/correlation models are not faked |
| SR-01 | Clock synchronization | Clock separation, offsets, signal events | The event ledger implements the specified synchronization procedure; reception and remote-event time remain distinct |
| SR-02 | Magnet/conductor descriptions | Frame selection, prescribed motion, declared field case | Equivalent modeled observables with different field descriptions; qualitative apparatus detail is not mistaken for a solved field |
| SR-03 | Rod measurement | Frame speed, endpoint-event selection | Only frame-simultaneous endpoint pairs are credited as length measurements in that frame |
| SR-04 | Construct the Lorentz map | Candidate coefficients, light trajectories, inverse test | Constraints reveal the remaining freedom and the admissible map; no answer is silently preinstalled as a constraint |
| SR-05 | Light clock and moving clocks | Relative speed, clock geometry, chosen worldline | Proper and coordinate intervals agree with the model; clock histories are retained across view switches |
| SR-06 | Velocity composition | Frame speed, particle velocity vector | Inverse/low-speed checks pass; null velocity remains null under admissible boosts |
| SR-07 | Transform the field equations | Select derivative/component; reveal algebraic step | Every chain-rule and substitution step has a reason, with validated signs and unit conventions |
| SR-08 | Electric/magnetic frame change | Field components, boost, test-charge state | Field invariants and compatible force descriptions agree within declared numerical tolerance |
| SR-09 | Doppler and aberration | Boost speed, propagation angle, frequency | Wavefronts, detector count rate, angle, and formula consume the same state |
| SR-10 | Finite light complex | Boost, propagation direction, selected bounding surface | Energy-density and volume factors combine to give the light-energy transformation |
| SR-11 | Moving mirror | Mirror speed, incidence direction, intensity | Reflection and energy/momentum accounting respect interception geometry and the chosen infinite/prescribed mirror idealization |
| SR-12 | Charge/current density | Density, current components, boost, integration view | Continuity and transformations are consistent; neutral current-carrying cases are accepted correctly |
| SR-13 | Electron work and deflection | Prescribed electric/magnetic field, initial state, interval | Work/energy and deflection relations match the specified model; force conventions and excluded effects are explicit |
| ME-01 | Opposite pulses and two ledgers | Emitted energy, boost, emission-axis angle | Individual pulse energies vary; the sum and both before/after balances remain consistent |
| ME-02 | Inertia from the small-speed coefficient | Boost range, exact/approximate view | Quadratic approximation converges in its domain; limiting evaluation is stable near zero |
| ME-03 | System-boundary energy ledger | Include/exclude body/radiation; retain/release energy | Internal transfer and escape are distinguished; the larger closed-system accounting remains coherent |

Optional modern deep dives follow the core: an underdamped Brownian comparison; finite-exposure inference; optical appearance versus coordinate geometry; rapidity and boost composition; four-momentum; and later experimental confirmations. They must not substitute for any missing core row.

### 11.2 Parameter design and constraint handling

Each control declares physical dimension, display unit, valid model domain, numerical domain, pedagogical default, step or logarithmic mapping, and whether it is independent or derived. The same schema generates controls, URL-state validation, unit formatting, and test cases.

Suggested initial **teaching ranges**, to be admitted by the owners rather than blindly accepted:

| Family | Initial range or choice | Important restriction |
|---|---|---|
| Radiation temperature | 500–10,000 K, with logarithmic frequency controls | A plotting range is not a claim that every approximation is valid everywhere |
| Radiation frequency | 10¹¹–10¹⁶ Hz | Evaluate scaled forms safely; report invisible spectral regions honestly |
| Photoelectric work function | Hypothetical 1–6 eV | Named materials require separate sourced presets and conditions |
| Photoelectric frequency | 100–2,000 THz | Threshold and collector behavior use the same accepted energy state |
| Brownian radius | 0.1–5 µm in the core dilute-sphere model | Continuum, boundary, and time-scale assumptions must be checked for the chosen fluid |
| Brownian viscosity | 0.5–20 mPa·s as an explicit fluid parameter | Changing temperature does not silently supply an unmodeled viscosity law |
| Brownian temperature | 273–330 K for initial examples | A generic fluid card is not a water phase diagram |
| Brownian dimension | 1D marginal / 2D projection / 3D model | The corresponding second moment is `2dDt`; projection does not change the underlying physics |
| Relativistic frame speed | Core signed `v/c` within ±0.95 | Advanced values require numerical admission; no `abs(v) ≥ c` inertial observer |
| Propagation direction | Full angular range with a documented convention | Mirror-interception and other geometric domains are checked separately |
| Emitted energy | A pedagogically useful positive range, plus normalized ratios | The body's initial energy/state must admit the emission in any fully specified modern model |
| Sample count and time horizon | Explicit finite choices | Memory/time budget failure is distinct from physical invalidity |

Users may type exact values as well as drag. Out-of-domain inputs explain the problem and offer an admissible boundary or model change. They are not silently clamped while the label continues to display the requested value. A control's visual range may be narrower than the mathematical domain; these are separately documented decisions.

### 11.3 Multiple ways to interact

Sliders are appropriate for continuous parameters. They are not appropriate for everything. Use event selection for simultaneity, interval selection for integrals, draggable partitions for volume, coefficient manipulation for transformations, channel selection for energy balances, and expression-level actions for derivations.

A scene should begin with a useful question and a stable default, not a dense control panel. Advanced controls appear in an “Experiment settings” drawer. Every reset restores both parameters and the relevant experiment history, with the distinction between “same seed” and “new trial” explicit.

### 11.4 An executable visual-coverage ledger

For every source argument node, record its explanation, instrument or static treatment, numerical binding where applicable, accessibility equivalent, and acceptance scenario. An omitted treatment needs a written reason, not a blank cell.

Do not aggregate translation completeness, instrument availability, review approval, and empirical validation into a flattering single score. A paper can be fully transcribed while a simulation is unavailable; a simulation can execute correctly while its historical annotation is still under review.

### 11.5 The same scientific action through different interfaces

Every core instrument must expose an **action contract**, not just a screenshot and alternative text. An action names its inputs, the question it changes, the accepted result, and the equivalent operation without dragging, color discrimination, sound, or a visual canvas.

| Instrument family | Visual action | Equivalent scientific action |
|---|---|---|
| Probability and diffusion | Drag a selected histogram interval | Enter lower/upper limits, inspect interval probability, and compare two named intervals |
| Clock and event geometry | Select points on a diagram | Choose named events from a table and ask which frame regards them as simultaneous |
| Radiation entropy | Resize the constrained-state volume | Enter a ratio or choose half/same/double, with fixed energy and band stated explicitly |
| Fields and boosts | Rotate an arrow or move an observer | Select an axis/component and signed magnitude, then inspect transformed components at the same event |
| Energy accounting | Drag a boundary around objects | Select the objects included in the system and inspect energy crossing that boundary |
| Derivations | Highlight and transform part of an equation | Select a named subexpression, read its role, and advance a justified step |

A long prose description alone is not equivalent to being able to investigate. Conversely, do not force a screen-reader user through every particle coordinate: provide summaries, selectable comparisons, and optional detailed data at the scale of the question.

### 11.6 A scientific result is not always a number

Add acceptance cases for **not enough information**, **outside this model**, **a valid limiting state**, and **two hypotheses indistinguishable under this observation**. These are legitimate scientific outcomes, not failures to make an impressive animation.

For example, BM-07 should explain that a diffusion measurement cannot separately identify an unknown radius and molecular number without more information. ME-01 can know the change in body energy without knowing an absolute energy zero. LQ-04 may decline a dense-radiation state while preserving the readable explanation of why the approximation fails. Each result should offer a useful next action without inventing a value.

### 11.7 Keep the catalogue finite while deepening the instruments

The 33 core rows remain the launch coverage obligations. No-algebra entrances, nonvisual actions, guided prediction, side-by-side comparisons, and assumption inspection are **cross-cutting capabilities of those rows**, not 33 additional laboratories each. A single accepted scientific state should support several legitimate routes through its meaning.

Additional implementation work earns priority by resolving an observed misunderstanding or enabling a missing source argument. Do not inflate completion metrics by counting a new color theme, camera preset, or duplicated wrapper as another scientific instrument.

---

<a id="section-12"></a>

## 12. The content model and compiler

### 12.1 Use typed content, not hand-assembled page blobs

The source corpus should be declarative and reviewable. Store structured source blocks, translation units, notation mappings, argument nodes, foundation lessons, experiment manifests, and citations in text files with schemas. Long prose can use constrained Markdown, but executable MDX is not the default content interchange format.

A build-time compiler joins those records into route-local payloads. It validates structure and renders static mathematics. Client components receive the smallest serializable subset needed for the current activity. Functions, runtime objects, and untrusted JavaScript do not belong in content files.

The fundamental entities are:

| Entity | Required identity and semantics |
|---|---|
| `Paper` | Stable paper ID, German and English titles, bibliography, dates by type, ordered source blocks |
| `SourceAsset` | Origin, acquisition date, digest, MIME type, page mapping, rights status, local publication decision |
| `SourceBlock` | Immutable block ID, kind, transcription, source locator, original labels, review state |
| `TranslationUnit` | Stable ID, one or more source-block references, English text, translator/editor attribution, revision, unresolved alternatives |
| `Alignment` | Explicit many-to-many relation between source and translated spans; no reliance on matching paragraph counts |
| `EditorialNote` | Author, claim, source support, note kind, affected blocks, review state |
| `HistoricalPremise` | Proposition, availability date/range, original evidence, Einstein-knowledge evidence when claimed, admitted discovery stages |
| `ArgumentNode` | Question, premises, conclusion, logical role, derivation steps, source support, limitations, prerequisites |
| `Equation` | Semantic expression tree, source/modern notation forms, term/operation IDs, units, derivation links, numerical bindings |
| `Quantity` | Canonical ID, dimension, mathematical kind, frame, reference conditions, permitted units, formatting |
| `Foundation` | Learning objective, compact/full explanations, worked example, prerequisites, backlinks |
| `Experiment` | Parameter schema, owner capability, model domain, outputs, views, default scenario, provenance, acceptance cases |
| `Scenario` | Exact initial conditions, seed policy, actions, expected invariants/results/refusals, model and schema versions |

### 12.2 Stable IDs are not array positions

Once published, source-block IDs must not change merely because a paragraph is inserted into an explanation or split for translation. Allocate permanent IDs and maintain explicit aliases for retired or split editorial nodes. A revised claim gets a revision and lineage, not a new meaning hidden behind an old hash.

A source locator might identify printed page 895, a rectangle on a particular facsimile, and a block ID. A translated paragraph can map to multiple source regions. Highlighting and deep links must tolerate those relationships.

Separate `contentRevision`, `sourceAssetDigest`, `translationRevision`, `modelVersion`, and `artifactDigest`. A changed annotation does not necessarily change the physics; a changed physics model does not silently change which historical passage was translated.

### 12.3 Equations need an expression model and authored bindings

Maintain a semantic representation of mathematical structure: symbols, operations, relations, powers, fractions, integrals, derivatives, sums, vectors, matrices, and piecewise conditions. Generate plain and colorized LaTeX from it where practical. For source-faithful exceptional typography, allow an explicitly authored LaTeX form with validated semantic term bindings.

Do not attempt to infer meaning by replacing every occurrence of a letter in raw LaTeX. The same symbol may have different meanings in different sections; a symbol can also appear in a command name, exponent, subscript, or textual annotation.

The compiler checks that every live term references an exact quantity ID, every explanation references an existing term, and every computed displayed output has an admitted owner. Symbolic, underdetermined, and analytic-limit outputs have explicit statuses rather than fabricated finite values. Source-faithful mathematical expressions are preserved even when a separate scientific review identifies a historical problem; computational admission applies to the model that is actually executed. Human labels such as “energy” are not API keys.

The site does not need a general computer algebra system at launch. An authored derivation graph with a small, tested set of transformation rules is more tractable and more auditable. Numerical spot checks are useful but cannot prove arbitrary symbolic equivalence.

### 12.4 Four kinds of meaning must remain separate

**Logical role:** definition, assumption, derivation, heuristic inference, empirical observation, or qualification.

**Historical status:** available before the cutoff, introduced in the current paper, later development, or pedagogical reconstruction.

**Model status:** exact within the stated mathematical model, approximation, idealized representation, calibrated empirical model, or unsupported outside the domain.

**Execution status:** static illustration, host calculation, accepted FrankenSim/WASM result, or unavailable/refused.

Do not compress these into one color. An exactly evaluated formula can belong to a speculative historical hypothesis; a faithful translation can contain an argument the modern explanation qualifies. The data model must express both truths simultaneously.

### 12.5 Compiler checks that are worth building

The first compiler should reject duplicate IDs, missing blocks, broken alignments, unresolved equation symbols, dimension mismatches in supported expressions, invalid parameter dependencies, cycles in a selected proof's required prerequisites, dangling citations, impossible date ordering, missing accessibility alternatives, unsupported math commands, and experiment references without an owner or explicit static status.

It should flag rather than automatically “resolve” translation ambiguity, historical influence claims, approximation claims, and source disagreements. Passing a schema is not evidence of a correct translation or good teaching.

### 12.6 Useful machine-readable access without a new product

Generate compact, stable JSON and Markdown representations of each paper, section, argument, and experiment manifest. This supports indexing, agent-assisted review, citation, and future integrations. The HTML remains canonical for people. An enormous public API platform, authentication system, or database is not required to serve a four-paper corpus.

### 12.7 Typed uncertainty, limits, and unavailable knowledge

Extend the result schema before implementing the reference slice. Distinguish an execution envelope from the scientific status of each quantity:

| Status | Meaning | Example |
|---|---|---|
| `value` | A finite result with units, semantic kind, owner, and uncertainty metadata where applicable | An admitted diffusion coefficient |
| `symbolic` | A source or derived relation whose unspecified symbols remain explicit | An absolute internal energy in the historical ledger |
| `analytic-limit` | A defined mathematical limit with a dedicated representation | A point distribution at `t=0`; the mass coefficient at `v=0` |
| `underdetermined` | The admitted information does not select a unique value | Radius and molecular number inferred from diffusivity alone |
| `not-applicable` | The requested quantity is not defined for this model/question | A stopping potential for a configuration with no emitted electrons in the chosen model |
| `outside-domain` | The model does not support the requested conditions | A Wien-only entropy comparison outside its admitted dilute regime |

Transport errors, allocation limits, worker cancellation, and missing artifacts are separate **execution outcomes**. A model refusal is not a numerical zero; a budget refusal is not a physical impossibility. A snapshot can contain valid outputs plus honestly unknown ones if its declared model permits partial results. It must not mix quantities from different input revisions to fill the gaps.

Each lesson chooses how to explain these statuses in ordinary language. Internal enum names should not leak into the reader as cryptic warnings.

### 12.8 Equations need scoped semantics beyond integer units

The inspected `fs-qty` represents base-dimension exponents as integers. This is useful for admitted runtime quantities, but the expression compiler must handle operations such as square roots deliberately. For example, `sqrt(Dt)` has length dimension because the radicand has squared-length dimension. Do not truncate or round a fractional exponent during dimension checking. [FS-04]

Use exact rational dimension arithmetic in the **authoring validator** where needed, or return an explicit unsupported-check status. Map an expression to the upstream runtime quantity model only after its dimensions and supported operations are resolved. This is a validator for mathematical expressions, not permission to create a competing physics units library. A source expression that exceeds validator capability still requires review; it does not automatically become dimensionally correct or get removed from the historical text.

Track semantic distinctions that dimensions cannot settle: a frequency in cycles versus angular frequency; a spectral density versus a total; a coordinate time versus a proper interval; a laboratory force versus a comoving force; a mean square versus a variance; and measured versus latent positions. Frame and observation identities belong on quantities, not only in captions.

### 12.9 Explicit proof routes and rendering routes

An argument can have several valid proofs. Give each proof an ordered dependency graph, stated entry assumptions, logical move types, and a mapping to source passages where appropriate. Require that graph to be acyclic. The broader network of conceptual cross-references can have cycles; a glossary link is not automatically a logical premise.

Separate **historical derivation dependencies** from **modern verification oracles**. A Lorentz-transform test may use interval preservation without making Minkowski geometry a secret premise in the 1904 discovery route. The compiler should detect that distinction from edge types rather than infer it from prose.

A rendering route selects authored representations and guidance around a proof. It cannot silently change the proof's assumptions. Record when an explanatory shortcut changes the scope of a conclusion, and provide the bridge to the stronger claim. This small, explicit structure is preferable to a general symbolic theorem prover or a large adaptive-learning ontology before one complete paper works.

---

<a id="section-13"></a>

## 13. Translation, source fidelity, and editorial production

### 13.1 Publish a fresh reviewed English edition

The safest and most coherent editorial strategy is to produce a new English translation from the German originals, using existing translations as attributed comparison witnesses where permitted. Do not assume that a recent English translation is free to republish because the underlying paper is old. A translation can be separately protected. [T-06]

The 1965 light-paper translation and the later collected-papers translations are valuable research witnesses, not automatic publication licenses. The Brownian PDF inspected includes a Dover notice identifying a 1956 republication of a 1926 translation. Fourmilab identifies its relativity translations as derived from the 1923 collection and notes notation changes. Those distinctions belong in the source register. ([P-02]; [P-04]; [P-06]; [P-08])

### 13.2 Source pipeline

1. Acquire a preferred original facsimile and at least one independent comparison witness when possible. Record hashes, locators, provenance, and rights decisions.
2. Produce a diplomatic German transcription: preserve mathematical content, meaningful punctuation, paragraph order, and original notation. Normalize only declared typography such as line-break hyphenation.
3. Inventory every equation and nontrivial symbol. Compare mathematical transcription directly with page images; parsed PDF text is frequently unreliable for these sources.
4. Draft a close English translation that preserves modality and qualifications. “Suggests,” “must,” “under these assumptions,” and “to this approximation” are not interchangeable.
5. Review German/English alignment and mathematical meaning independently. Resolve disagreements by returning to the facsimile and context, not by majority vote among paraphrases.
6. Write the explanatory layer separately. It may reorganize ideas, modernize notation, and add derivations, but cannot masquerade as source text.
7. Publish only after the full source manifest and review criteria pass. Keep unresolved readings visible in internal review and, where intellectually important, in public editorial notes.

OCR may assist a missing text layer, but its output is not an accepted transcription. Use it only where direct text and visual inspection are insufficient; equations and unusual typography need particular attention.

### 13.3 Preserve uncertainty and corrections

A suspected historical typographical error should produce a note with the original reading, the proposed correction, reasoning, and evidence. The source view retains the original. A corrected reading can be offered with an explicit marker.

Likewise, an error in a later translation belongs to that translation witness, not automatically to Einstein. The source and translation layers need separate correction histories.

### 13.4 A notation concordance is a central feature

The original relativity and inertia papers use `V` for the speed of light. The familiar electronic translation uses `c`. The relativity paper's factor convention also differs from the common modern use of `β = v/c`; the original transformation factor corresponds to what is usually written `γ` today. The moving-frame time symbol must not be automatically interpreted as the modern proper-time symbol merely because both can be written `τ`. ([P-05]–[P-08])

Create a contextual concordance with: original glyph, source scope, definition, modern symbol, dimension, frame, and transformation rule. Distinguish a symbol rename from a unit-system conversion and from a substantive modernization of the argument.

The light paper's spectral constants, the Brownian paper's viscosity and particle-radius symbols, and the multiple uses of letters such as `N`, `E`, and `β` need the same treatment. A global find-and-replace is unacceptable.

### 13.5 Attribution and rights layers

Maintain separate policies for original historical text, facsimile scans, new translation, new explanatory prose, interactive code, numerical libraries, fonts, images, and historical datasets. Preserve inherited notices from Classic Patents and FrankenSim. Their inspected metadata includes rider language and differing manifest descriptions; do not erase that complexity by calling everything plain MIT. ([CP-01]; [FS-01]; [FS-02])

Recommended decision: make the new explanatory corpus and code openly reusable under licenses explicitly selected by the owner, while carrying source-specific exceptions. Decide the exact license and any rider intentionally before publication. Do not imply that a license for code grants rights to every embedded scan or translation.

### 13.6 Durable source availability

Pin permitted publication assets locally. A live third-party URL is a citation target, not a runtime dependency for the core reader. During research, the older Princeton translated-volume URL redirected to a new Einstein database/portal page. That is a concrete reason not to make the reading experience depend on an external archive's current routing. [H-03]

If a particular facsimile cannot be redistributed, use an authorized alternative or link out with a transparent explanation. Do not use an unauthorized proxy to conceal the issue, and do not claim a fully self-contained facsimile edition until the asset rights and availability are settled.

### 13.7 International reach without unreviewed translation masquerading as an edition

Design content IDs, citation locators, number formatting, and layout for multiple languages from the beginning. Publish the English scientific edition and original German first; add other languages as reviewed editions with their own translators, scientific reviewers, revision status, and correspondence to the source and explanation records.

Keep interface localization separate from scientific translation. A translated navigation menu does not establish that a paper, its mathematical commentary, or its captions have been reviewed in that language. Machine-produced drafts may help editorial work, but must not silently replace the default scientific explanation.

Use explicit language and direction metadata, readable mixed left-to-right mathematics within right-to-left prose, and locale-aware **display** with a strict canonical numerical transport format. Test decimal separators, minus signs, scientific notation, and micro-unit glyphs without allowing input text to become executable code. A reader can change display language without changing a seed, unit meaning, source passage, or physical experiment.

Translation should preserve not just words but epistemic force: a heuristic remains a heuristic; an approximation remains approximate; an assumed independent measurement does not become a derived fact. Corrections must identify which language editions and narration scripts require review rather than treating all translations as automatically synchronized.

---

<a id="section-14"></a>

## 14. Typography, equations, and reader interaction

### 14.1 Visual direction

The site should look like an unusually beautiful scientific book that happens to be alive. Use a bright, warm paper background, dark readable body text, generous margins, fine rules, restrained archival accents, and vivid but controlled scientific color. A dark mode is optional; it is not the primary identity.

Use one excellent reading serif, one compact interface sans, and a compatible mathematical font system. Avoid combining numerous display faces simply because each looks good alone. Test German diacritics, Greek letters, subscripts, primes, old notation, and long equations before committing to fonts. Self-host appropriately licensed fonts and subset carefully without omitting needed mathematical glyphs.

The hero should pose a question, not bury the reader under a full-screen portrait and animated starfield. Four invitations could read: “How would you count what you cannot see?”, “What could a spectrum tell you about the structure of light?”, “How would you synchronize distant clocks?”, and “What does a body lose when it emits light?” These are original proposed interface copy, not historical quotations.

### 14.2 Page anatomy

Desktop reading has a main text column and an optional companion column. The companion can show the original, an explanation, a selected equation, or a laboratory. A narrow section outline remains available without consuming a third full column.

On phones, use one primary column and a bottom-sheet or full-width companion view. Switching context preserves the paragraph and selected term. Do not squeeze German, English, commentary, equations, and a 3D scene into simultaneous narrow columns.

The reader can pin an equation while scrolling through its derivation. A laboratory can stay visible within a bounded sticky region, but it must not trap the scroll or hide text behind fixed controls. Long equations get authored line breaks or a local horizontal scroll region, never page-wide overflow.

### 14.3 Semantic color, not decorative syntax highlighting

Start with a small role palette: energy-related quantities, time/rates, space/geometry, material response, and statistical quantities. Treat the palette as a contextual convention with an explicit legend, not a universal physical ontology. Red must not always mean “bad”; a negative value is not automatically an error.

A quantity's color is consistent across its equation, legend, graph, and scene in the current argument. Selecting it highlights all corresponding instances. Identity also appears through labels, shapes, outlines, or patterns. Color-vision alternatives and monochrome print remain fully intelligible.

Do not assign a permanent global color to the letter `E`. It could denote different things in different source contexts. Color is attached to the canonical quantity identity and declared role.

### 14.4 The equation interaction ladder

A selected expression offers, in increasing depth:

**Read it aloud:** a careful natural-language rendering, including which quantities are changing or held fixed.

**What each part does:** a role explanation for terms and operations, not merely the names of letters.

**Try a value:** a live substitution with units and an explanation of what is independent versus derived.

**Show the next step:** a justified transformation with the changed subexpression highlighted.

**Why is that allowed?:** the relevant algebra, calculus, physical premise, or approximation.

**Show a concrete example:** a small numerical or geometric instance that does not require absorbing the entire formal derivation first.

The key affordance is selecting an operation as well as a symbol. Readers may know what `T` means but not why it appears in a denominator or why a logarithm appears at all.

### 14.5 A worked equation micro-interaction

For `D = k_B T/(6πηa)`, selecting the denominator should explain the **combined resistance to motion**, then separate the roles of viscosity, radius, and geometry. Doubling `a` at fixed `T` and `η` halves `D`; the one-dimensional RMS displacement at fixed time decreases by `1/√2`, not by one half.

That final distinction is essential: the colorized equation should connect the parameter change to the actual observable, not stop at the intermediate coefficient. A comparison view shows both runs with the same axes and an explicit shared-seed or independent-seed policy.

### 14.6 Accessibility is part of the scientific representation

Target WCAG 2.2 AA, with manual verification of mathematics, keyboard-operated instruments, focus restoration, contrast, zoom, screen readers, touch, and reduced motion. Passing automated checks alone is insufficient. [T-03]

Use KaTeX HTML plus MathML for visual and assistive presentation, but test real assistive-technology combinations. Avoid duplicate announcements from a visual formula and a redundant spoken label. Complex mathematics can additionally expose a structured textual explanation and step list. [T-01]

Every canvas or 3D view has a meaningful textual description and an inspectable table of selected quantities/events. All core controls have keyboard and typed-input equivalents. Tooltip-only explanations are prohibited. Animations are pausable, sound starts muted, and reduced-motion mode does not delete the underlying lesson.

Static math rendering should happen at build/server time. Hydration attaches interactivity to known terms. Preserve the existing restricted KaTeX trust principle, validate generated classes/data attributes, cap macro expansion and size, and never display raw unescaped error strings. ([CP-04]; [T-01]; [T-02])

### 14.7 Print, search, and return

Print produces a coherent chapter with equations, source references, visible explanations, and representative figures/captions for interactive states. Hidden drawers must have a deliberate print policy; do not print only the collapsed headings. Browser text search must still find the full section, so avoid virtualizing individual paragraphs out of the DOM.

Search indexes both everyday language and technical terms: “how far does it wander” should lead to RMS displacement, and “clocks disagree” should find simultaneity and synchronization. Indexing and ranking can be local/build-time; a hosted search service is not necessary for four papers.

A copied link identifies the paper, argument or source block, perspective, and a compact valid experiment state when requested. The ordinary “copy passage link” action should not unexpectedly disclose the reader's notes or interaction history.

### 14.8 Accessibility as the ability to reason, not merely reach the page

WCAG conformance is a baseline, not the whole educational objective. W3C's supplemental cognitive guidance recommends clear wording, manageable presentation, and alternatives that do not depend on numerical fluency. It is supplemental guidance, not an additional claim of formal WCAG conformance. [AX-01]

For this site, accessibility acceptance asks whether the visitor can perform the intended reasoning: compare event times, choose a displacement statistic, change a parameter, inspect a conservation balance, or explain an equation step. Test those actions with disabled readers using their own tools during the reference slice, before the visual language hardens.

Use ordinary labeled controls where possible. Provide typed-value and step-button alternatives to custom sliders, and test touch-based assistive technology explicitly; the W3C slider pattern warns that its expected event handling is not universally available on those setups. [AX-02]

Do not turn every mathematical glyph into a separate tab stop. A formula should be readable as a whole, with an optional structured term/operation explorer and a clear way out. Test that visual HTML and MathML do not produce duplicate or contradictory announcements. No-JavaScript readers need real links to explanations, not buttons whose only behavior depends on hydration.

### 14.9 Descriptions and sound must carry the right information

A graph has three layers of accessible information: a concise statement of what is being compared; the current relation or change after an intentional action; and optional detailed points, intervals, or event records. A 60 Hz animation must not generate a 60 Hz live-region stream. Announce committed comparisons or requested summaries, and let the reader pause and inspect.

Use written descriptions and controls as the baseline. Optional sonification may encode position, spread, rate, or a selected relation, but its mapping must be inspectable and consistent. It is not a recording of photons, molecules, or time itself. Provide a quiet default, volume control, captions/transcripts for speech, and no essential task that depends on hearing or producing sound.

Reviewed narration can help readers who prefer listening, but a raw text-to-speech reading of LaTeX is not an accessible mathematics edition. Author pronunciation and grouping for ambiguous expressions, synchronize narration to stable argument IDs, and preserve the text. No microphone, live tutoring service, or account is required.

PhET's inclusive-design work offers a concrete precedent for integrating alternative input, interactive descriptions, and sound into scientific simulations. Treat it as a design reference, not proof that adding those features automatically makes our own instruments effective. [AX-03]

### 14.10 A calm book on a modest device

Offer a persistent **reading-only** setting that suppresses autoplay, expensive scene loads, and decorative motion while retaining the entire explanation and static worked cases. Keep line length, type size, contrast, and paragraph spacing adjustable within tested layouts. Preserve readable defaults; do not impose an unproven “special reading font” or a permanent learning-style classification.

At high zoom or on a narrow display, companions should move below the passage or open as navigable sections. Sticky controls must relinquish space before they obscure content. Equations can use authored multiple lines and a local, keyboard-reachable overflow region when unavoidable, without shrinking the entire chapter to fit one formula.

The first encounter should use a single question, one useful interaction, and a clear next step. The full paper can be long and demanding. Keeping these two scales connected is more important than making every screen look equally dense or equally simple.

<a id="section-15"></a>

## 15. FrankenSim integration: reusable physics, not an Einstein-shaped fork

### 15.1 The ownership rule

A reusable physical or numerical law belongs in FrankenSim. A source passage, teaching prompt, historical annotation, visual metaphor, or sequence of discoveries belongs in Annus Mirabilis. The browser boundary composes generic capabilities into bounded educational experiments.

Do not create four independent physics engines named after the papers. Brownian diffusion should be useful to other projects; Lorentz transformations should be reusable beyond this site; radiation spectra and idealized energy-transfer laws should not be buried in a React component.

### 15.2 What was actually observed upstream

| Observed surface | Evidence from inspected code | Safe conclusion for this plan |
|---|---|---|
| `fs-rand` | Counter-based Philox streams keyed by logical identity; indexed access; versioned stream/checkpoint semantics; deterministic distribution paths | Strong candidate substrate for replayable stochastic experiments, subject to target build and numerical tests |
| `fs-qty` | Compile-time and runtime dimensions, SI parsing, six admitted base dimensions `[m, kg, s, K, A, mol]` | Reuse units rather than invent a parallel physics-unit system; luminous intensity is not currently included |
| `fs-wasm` | Standalone workspace, pure-leaf and upper-stack dependencies, browser-mode asupersync, target-specific binding dependencies | Existing browser packaging pattern, not proof that each proposed Einstein capability is exported or ready |
| `fs-demo-physics-wasm` | Versioned, pure analytic evaluators with accepted/refusal JSON envelopes and explicit no-claims | Useful boundary pattern; its wing/bridge teaching formulas are not Einstein kernels |
| Workspace/capability documentation | Explicit capability maturity and warning that crate/test counts do not establish integration or validation | Require execution evidence for the exact capability used; do not promote a crate name into a scientific claim |

The `fs-rand` design is especially valuable: logical stream identity rather than thread scheduling determines the draws. Preserve its stream-semantics version in experiment replays. Its documentation distinguishes strict distribution paths from a faster path awaiting stronger admission; the new site must choose deliberately rather than assume every random sampler has identical reproducibility guarantees. ([FS-01]–[FS-06])

Repository searches did not establish a ready Brownian-paper or special-relativity product API. A search result's absence is not proof that all relevant work is absent; nevertheless, no such integrated capability is assumed in this plan.

### 15.3 Capability audit before naming new crates

The first physics task is a bounded audit and build probe. Identify existing owners for the precise mathematical functions, examine their contracts and tests, compile the needed dependency slice for native and browser targets, and record the actual exports.

Names such as `fs-frame`, `fs-flux`, `fs-lattice`, or `fs-spectral` do not establish that they implement spacetime frames, full moving-conductor electromagnetism, molecular Brownian dynamics, or Planck spectra. Inspect semantics before reuse. Equally, do not create a new crate merely because a suitable existing owner uses a less obvious name.

### 15.4 Proposed generic capabilities

The following names describe **new or extended capabilities to implement**, not existing callable APIs. Final crate/module placement follows the ownership audit.

| Capability family | Minimum useful surface | Likely composition / owner decision |
|---|---|---|
| Radiation spectra | Frequency/wavelength spectral densities; band integrals; Wien/classical limits; stable scaled evaluation | Extend an appropriate radiation/thermal owner, or propose a narrowly scoped `fs-radiation` crate |
| Idealized quantum energy transfer | Single-quantum energy budget, threshold emission, fluorescence/ionization bounds, declared yield models | Modules owned with radiation/interactions; not a claim of a complete quantum-material solver |
| Diffusion and stochastic transport | Constant-coefficient free diffusion, Gaussian transition, seeded ensembles, moments, drift–diffusion, Stokes–Einstein relation | Extend an existing transport owner or propose a focused `fs-diffusion`/`fs-stochastic` owner |
| Diffusion inference | Explicit independent-increment estimators, uncertainty under admitted assumptions, labeled observation-error models | Reuse audited statistical/numerical primitives; no automatic promotion of arbitrary correlated data into a valid estimate |
| Flat-spacetime kinematics | Inertial frames, event transforms, interval classification, velocity composition, worldline sampling, clock/rod measurements | Propose a generic relativity owner if no appropriate one exists; do not assume a structural-frame crate is suitable |
| Relativistic electrodynamics | Prescribed-field transforms, plane-wave phase, light-energy transforms, ideal mirror interaction, charge/current transforms | Reuse the relativity core and audited field primitives; a full Maxwell solver is not required for analytic source cases |
| Prescribed-field particle dynamics | Well-scoped work/energy and electric/magnetic deflection calculations | Reuse tested integration primitives with explicit excluded radiation reaction and self-fields |
| Relativistic energy accounting | Symmetric radiation emission, two-frame ledgers, stable low-speed expansion, modern four-momentum extension | Generic energy/momentum operations in the relativity owner, not a duplicate mass–energy page engine |
| Evidence and uncertainty | Quantity-specific provenance, numerical verification, input uncertainty, refusal reports | Adapt upstream evidence semantics; never equate a computed point value with an experimental validation |

The benefit of this approach is concrete: the new site improves FrankenSim's reusable numerical capabilities, while Classic Patents can later reuse relevant radiation, statistical, or field tools without importing an Einstein-specific UI.

### 15.5 A narrow browser adapter

A proposed adapter such as `fs-annus-wasm` may be appropriate as a **composition and transport boundary**. It should expose versioned experiment operations and serialize results/refusals; it should not contain a second copy of the laws owned by the generic crates.

Prefer feature-selected or separate small bundles for radiation, diffusion, and relativity over shipping the entire existing generic WASM dependency graph to every reader. The inspected `fs-wasm` manifest has a broad dependency surface. Copying that manifest wholesale would undermine route-local loading and couple the site to unrelated experiments. [FS-05]

Begin with a single-threaded browser target. Threads, shared memory, SIMD-specialized execution, and GPU computation are optimizations that must earn their complexity through measurements. Rendering can use the GPU while scientific computation remains deterministic CPU/WASM.

### 15.6 Rust and dependency policy

Use safe Rust for new numerical code, with `forbid(unsafe_code)` where compatible with the repository's conventions. Do not add C/C++ physics libraries, hidden FFI solvers, or a competing numerical dependency ecosystem. Reuse asupersync and the owner's Franken libraries where they provide the right capability.

The inspected existing browser package includes target-specific `wasm-bindgen` and `getrandom` dependencies. That is an observed packaging fact, not permission to expand runtime dependencies freely. Reuse the approved browser boundary policy or make any exception explicit. Scientific random draws must use the recorded logical seed; ambient browser entropy may choose a new seed only through an explicit “new trial” action and must then be recorded. [FS-05]

Pin the Rust nightly, upstream commits, sibling constellation revisions, generated glue, and lockfiles. The native workspace uses sibling dependencies and constellation checks; a fresh build must establish those prerequisites rather than assume a lone repository checkout is sufficient. [FS-02]

### 15.7 The important distinction between fidelity and expense

Do not substitute an elaborate low-confidence particle collision movie for a precise diffusion model. More computational work does not automatically produce more scientifically appropriate output.

For each effect, choose an owner at the right level: exact analytic relation, verified numerical approximation, pedagogical discrete model, or experimentally calibrated model. Alternative fidelities form a context-of-use graph, not a ladder where a visually richer model is always “better.” Their input assumptions and admissible claims may differ.

A body can be rendered with detailed materials while its governing experiment remains a simple analytic energy ledger. Rendering detail and physical model fidelity are independent settings.

### 15.8 Keep the browser slice small and independently buildable

Before broadening the numerical dependency graph, establish one native test target and one single-threaded browser target for the Brownian slice, with exact upstream revisions and the needed sibling dependencies. Add another capability only when a named instrument uses it. Do not make the site wait for all unrelated FrankenSim crates to pass or compile for the browser.

A narrow adapter may expose a verified analytical evaluation, a seeded transition sampler, and bounded batch statistics without offering a general solver service. When a generic owner is missing, implement the smallest reusable law with its explicit domain upstream, then adopt a pinned artifact downstream. Capability names in this plan remain proposals until that owner, export, and deployed call are tested.

A temporary reference implementation used for independent numerical comparison belongs in review/test support and is not a second production physics engine. Language differences alone do not make two copies independent: compare against a distinct derivation, exact special case, or separately implemented numerical method where possible.

---

<a id="section-16"></a>

## 16. Runtime protocol, ownership, and reproducibility

### 16.1 One accepted snapshot per experiment

Every laboratory instance has a unique instance ID, even when two instances show the same paper or experiment. A single owner advances or evaluates that instance. All plots, equations, scene geometry, tables, and accessibility summaries consume the same accepted snapshot.

React components must not independently recompute diffusion, transformed coordinates, or emitted energy from slightly different parameter copies. They may format quantities and project accepted coordinates into pixels. Numerical truth has one owner.

### 16.2 Separate clocks and revisions

The runtime must distinguish:

| Field | Meaning |
|---|---|
| `instanceId` | This mounted laboratory, independent of other copies |
| `runId` | This experiment realization or parameterized run |
| `inputRevision` | Latest requested physical input set |
| `acceptedInputRevision` | Inputs that actually produced the displayed result |
| `stepIndex` | Accepted logical solver/sample step, not a UI event count |
| `simulatedTime` | Physical/model time represented by the accepted state |
| `snapshotVersion` | Monotone publication identity for an immutable result |
| `renderTime` | Display/interpolation time; never a hidden physical input |
| `modelVersion` / `artifactDigest` | Mathematical implementation and exact executable identity |
| `seed` / `streamVersion` | Stochastic realization and random-stream semantics |

This explicitly improves on reusing the Classic Patents control-change tick as though it were physical time. [CP-07]

### 16.3 Request and response contract

A request carries protocol version, experiment ID, instance/run IDs, input revision, canonical SI parameters, model selection, constant-set identity, seed policy, requested operation, and a finite work budget.

An accepted response carries the matching identities, accepted parameters, simulated time or evaluation point, numerical outputs with dimensions and semantic kinds, model-domain information, and provenance. A refusal carries a typed code, the affected inputs or capability, a readable reason, and possible repairs.

Large arrays use versioned typed-buffer layouts with explicit dimensions and ownership. Scalar summaries can use structured JSON. The decoder rejects nonfinite numbers in numerical-value fields, wrong lengths, mismatched units, stale run IDs, unsupported schema versions, and unrecognized provenance. Valid nonnumeric scientific states, such as a point distribution at zero elapsed time or an undetermined absolute body energy, use the tagged result forms in §12.7; they are not encoded as `NaN`, infinity, or zero.

Use the accepted/refusal pattern observed in FrankenSim, but design a typed shared schema rather than manually concatenating untrusted JSON. [FS-06]

### 16.4 Worker behavior and cancellation

Load the numerical module in a dedicated Worker after the laboratory is requested or is about to become useful. Bound every work chunk. A cancellation message cannot preempt an indefinitely running synchronous WASM call in the same worker, so long work must yield between bounded chunks or use an explicitly supported interruption mechanism.

Coalesce rapid slider requests. A new input revision supersedes older pending evaluations; an old result can never overwrite the newest accepted run. A refused update preserves the previous accepted snapshot but clearly distinguishes it from the requested settings. Never display old numbers beneath new parameter labels as if they were freshly computed.

Use asupersync's available cancellation/lifetime mechanisms where appropriate inside the Rust execution boundary, and explicit Worker lifecycle ownership in the browser. Verify the concrete browser integration rather than assuming a native executor's behavior transfers unchanged.

Terminate and recreate a worker only as a bounded recovery path. Switching between 2D and 3D representations should not restart physics, duplicate the owner, or consume new randomness.

### 16.5 Parameter changes have experimental meaning

Default behavior for a changed **physical setup** is a new run from declared initial conditions, with the seed policy visible. An **observer-frame change** re-describes the same events and worldlines; it never restarts the physical experiment. Measurement settings re-observe an identified trajectory where the observation model permits, estimator settings recompute inference, and camera/style changes affect only presentation. A separate “change conditions during the run” mode applies a time-stamped physical intervention. Section 16.9 makes these control types part of the protocol.

Camera movement, color palette, highlighted terms, and panel layout do not alter the experiment. Observation cadence can subsample an existing fixed logical path. It must not consume a different random stream merely because the visitor changes the plot sampling interval.

For the initial Brownian implementation, use a declared replay grid and supported observation intervals on that grid. A later hierarchical Brownian-bridge construction can permit path-consistent refinement, but it requires its own tests and stream-version semantics. Equal seeds alone do not guarantee a pathwise-consistent comparison between arbitrary discretizations.

### 16.6 Determinism: state the guarantee precisely

The required baseline is reproducibility for the same admitted model, executable, parameters, constant set, seed, stream semantics, and logical actions. Rendering cadence and worker scheduling must not change the scientific state.

Do not promise bitwise identity across all architectures, compiler versions, browsers, and fast-math modes merely because the source is Rust. Use upstream deterministic math paths where admitted, test native/WASM agreement, and record whether a comparison is bitwise or tolerance-based. Preserve those distinctions in replay metadata. [FS-03]

Fixed random goldens test stream semantics. Distribution tests test statistical properties. Neither alone proves the physical model.

### 16.7 Memory, rendering, and resource lifetime

Keep large particle buffers out of React state. Reuse geometry/buffers, use instancing where appropriate, and publish UI summaries at a bounded rate. Scientific stepping and display interpolation have separate schedules.

Handle WASM memory growth explicitly: a JavaScript view into linear memory can become invalid after growth. Do not retain such views across untracked reallocations. Use copied or transferred immutable snapshots, or a rigorously versioned buffer-lifetime contract.

Dispose of Three.js materials, geometry, textures, subscriptions, and workers when their owners end. Pause invisible laboratories. Limit concurrent heavy laboratories while preserving their replayable state. A depleted performance budget should reduce visual detail or pause with an explanation, not silently change a model's diffusivity or skip scientific time.

### 16.8 Fallbacks that do not lie

The static reader and worked examples always remain available. A small audited host-reference evaluator may provide an explicitly labeled fallback for selected algebraic cases. Do not switch a running stochastic experiment between engines without a new identified run and compatible replay semantics.

Public wording can be simple: “Ideal diffusion model · computed with FrankenSim,” “Static worked example,” or “This experiment is unavailable on this device.” Detailed artifact and validation information belongs in an expandable model note, not an alarming dashboard of colored badges.

A loaded WASM file does not earn the label “computed with FrankenSim.” The displayed result must come from an accepted call to the registered owner. [CP-10]

### 16.9 A change of description is not a change of world

Make the control classification executable:

| Command class | What changes | What must remain stable |
|---|---|---|
| `setup-change` | Initial physical conditions or governing model | Old run remains identifiable; new accepted run is explicit |
| `physical-intervention` | Conditions after a specified model time | Earlier accepted history is preserved |
| `observer-change` | Coordinate frame, origin, orientation, or observer description | Physical worldlines, events, and trial identity |
| `measurement-change` | Sampling, projection, exposure, or calibration under an admitted observation model | Identified latent trajectory; measurement result gets a new revision |
| `estimator-change` | Statistic, fitted model, or inference assumptions | Selected observation data and their provenance |
| `presentation-change` | Camera, labels, layout, colors, or explanation selection | Every scientific state and data identity |

Some user-facing controls need a clarifying choice. Changing a camera's physical exposure is a measurement-model change; moving the viewpoint of the rendered microscope is presentation. A moving detector is a physical component, not merely a frame choice. Name these distinctions in ordinary language and test their effects.

This classification prevents a serious conceptual bug: changing the frame speed in a relativity explanation must not generate a new set of events or restart clocks. It also permits a strong teaching interaction: hold the world fixed and compare two descriptions or measurements side by side.

### 16.10 Integer identity must survive JavaScript, JSON, and URLs

The inspected random-stream contract has 64-bit seeds and draw indices. JavaScript's safe integer range stops at `2^53−1`; distinct larger integers can collapse into the same `Number`. A JSON number is therefore not an adequate transport contract for every supported seed or index. ([FS-03]; [T-10])

Encode unsigned 64-bit identities as canonical decimal strings at JSON and URL boundaries, validate range and syntax, and decode with `BigInt` or an equivalent exact representation before calling the WASM boundary. Keep a documented typed representation inside each runtime. Do not serialize `BigInt` through ordinary JSON without an explicit conversion, and do not hash a rounded decimal display of a seed.

Require tests around `2^53`, adjacent values above it, zero, and `2^64−1`, plus invalid signs, whitespace policy, overlong input, and overflow. Seeds copied through the URL must identify the same stream after reload. Human-formatted scientific parameters and exact identity fields are different types.

Define logical stream allocations for latent motion, measurement errors, and independent trials. A display-only subsample or a new plot must not consume random draws from the physical path. Extending an ensemble should preserve existing particle identities under the declared allocation scheme, or explicitly identify a new experiment.

### 16.11 Snapshot publication and resource ownership

Use an instance-scoped external store for each experiment, with cached immutable snapshots and a server snapshot consistent with the initial HTML. React's `useSyncExternalStore` contract requires stable snapshot behavior; repeatedly manufacturing a new object from the same state is not an acceptable subscription implementation. [T-11]

Treat React mount/unmount probes, repeated subscriptions, and route transitions as normal lifecycle events. They must not create duplicate stepping owners, leak workers, or advance randomness. The owner lifecycle is explicit and idempotent; mounting a second view subscribes to an existing instance rather than beginning another simulation.

Transferred array buffers change ownership. Never detach a buffer that an already published snapshot still promises to expose, and never reuse a mutable buffer behind an “immutable” snapshot. Use versioned buffer slots, copies at a justified boundary, or another reviewed ownership strategy. Label which data are sampled for rendering and which form the complete accepted statistics.

A crash, context loss, or artifact mismatch can pause the laboratory while the book remains usable. Recovery must validate a checkpoint's model, schema, parameters, seed, and stream semantics before continuation; otherwise begin a visibly new run. A checksum is evidence of byte identity, not evidence that the checkpoint's scientific meaning is compatible.

---

<a id="section-17"></a>

## 17. Numerical and physical verification

### 17.1 Verification is quantity-specific

For each numerical output, record the model, assumptions, dimensions, independent reference, tested domain, error criterion, and relevant evidence. An engine-wide “validated” badge cannot stand in for those records.

Separate mathematical identity checks, numerical convergence, statistical calibration, comparison with observations, and historical source fidelity. They answer different questions.

### 17.2 Radiation tests

- Check dimensional consistency and the frequency/wavelength Jacobian by matching integrated band energies.
- Evaluate small and large dimensionless arguments with stable forms (`expm1`, scaled exponentials, or admitted equivalent primitives) rather than naive overflow/underflow-prone expressions.
- Test the classical and Wien limits in their respective domains, with an explicit relative-error criterion.
- Compare band integration against an independently implemented high-precision reference, not only a second call to the same routine.
- Test photoelectric threshold, frequency slope, power/count separation, and complete energy-channel accounting under the idealized model.
- Distinguish frequency `ν` from angular frequency `ω`; dimensional analysis alone will not catch a missing factor of `2π`.

A finite plot range does not justify integrating a divergent model to infinity or silently truncating an energy ledger.

### 17.3 Diffusion tests

Verify the exact free-diffusion moments, normalization, unit conversions, and scaling `D ∝ T/(ηa)` within the model. Test one-dimensional marginals and the `2dDt` total second moment separately.

A free Gaussian transition at a specified time has an analytic distribution; do not manufacture a time-step convergence claim for an exact transition sampler. Finite-domain PDE solvers, drift approximations, or other numerical extensions do need their own convergence tests.

Use reproducible statistical test sets with prespecified tolerances and adequate sample sizes. A single unusually large residual should not cause a flaky test to be rerun until it passes. Fixed-stream goldens and broader distribution checks serve different purposes.

For inference, test unbiased and intentionally biased fixtures, independent versus correlated sampling, drift handling, localization-noise effects, and radius/viscosity uncertainty. Independent instantaneous **position errors** add `2σ_loc²` per coordinate to a displacement second moment, but neighboring displacement errors have covariance `-σ_loc²` because they share a position sample. Do not reuse the independent-increment confidence interval after adding that noise. Finite exposure and other correlations require their own covariance model; see §8.10.

Check boundary conditions explicitly. A reflecting simulation box must not be compared with an unbounded Gaussian as though the models were identical after boundaries matter.

### 17.4 Relativity tests

Test identity at zero boost, inverse round trips, composition, null propagation, interval preservation in a modern geometric verification layer, low-speed limits, and nonfinite/superluminal input refusals. Keep active transformations, passive frame changes, and sign conventions distinct.

Use events that expose a simultaneity mistake rather than only events at the origin. Include non-collinear velocities, transverse fields, neutral current-carrying configurations, and ray directions near geometric boundaries.

Field invariants such as `E² - c²B²` and `E·B` provide useful independent checks in the modern SI layer. Agreement of these invariants does not alone prove every displayed force or source equation is correct; component-wise fixtures and source review remain necessary.

For moving mirrors, verify the stationary limit, admissible interception geometry, transformed frequency/direction, and the specified energy/momentum exchange. State whether the mirror is an externally maintained boundary or a finite-mass body. The latter requires dynamics not supplied by the former.

For electron dynamics, compare analytic special cases and work/energy balance, admit field/time domains explicitly, and exclude self-force/radiative losses unless implemented. A prescribed-field integrator is not a complete electromagnetic simulation.

### 17.5 Mass–energy tests

Test opposite-pulse symmetry for arbitrary emission-axis angle, both frame-energy balances, cancellation of direction dependence in the sum, the quadratic low-speed coefficient, stable `γ-1`, and the distinction between body-only and closed-system ledgers.

The modern four-momentum extension should test a single massless pulse, two collinear pulses, and two opposite pulses. The invariant mass belongs to the entire specified system; it is not the arithmetic sum of constituent rest masses.

### 17.6 Precision and uncertainty display

Choose precision from the question and inputs. Do not show twelve decimals from a model whose viscosity is a rough estimate. Separate the stored full-precision value, formatted value, input precision, statistical interval, and numerical error estimate.

Unit conversions apply to sensitivities as well as values. A derivative per meter is not the same displayed number as a derivative per micrometer. Quantities that share dimensions can still differ semantically, such as angular and cyclic frequency or energy density and total energy.

When using upstream interval/evidence machinery, preserve its actual assumptions and claim limits. A probability confidence interval is not an interval-arithmetic enclosure, and a simulation's numerical error bar is not a measurement uncertainty. ([FS-01]; [FS-04])

### 17.7 Golden scenarios

Keep a small human-readable reference set with independently derived expected values. At minimum include the Brownian baseline in §8, the hypothetical photoelectric threshold in §7, `v = 0.6c` event and frequency transformations in §9, and the emission-energy comparison in §10.

Each scenario specifies constants, units, equations, owner, and tolerance. These fixtures test calculations and plumbing. They must be labeled separately from historical measurements in both source data and the UI.

### 17.8 Adversarial scientific fixtures

Add a small set of deliberately plausible wrong results to the verification suite. Each mutation must fail for the intended reason, not simply because a field is absent.

| Plausible mistake | Fixture that exposes it |
|---|---|
| Half the diffusivity means half the displacement | Compare diffusivity and RMS scaling separately |
| A radial distribution is an ordinary Gaussian | Check normalization and mean/radial second moment with the correct geometric measure |
| Camera noise leaves neighboring increments independent | Check the off-diagonal displacement covariance |
| An unbiased estimate remains unbiased after inversion | Check the ideal chi-square inverse moment and asymmetric transformed interval |
| An arbitrary entropy-density constant cancels | Retain `C(ν)` while varying volume at fixed energy |
| A spectral-axis relabeling preserves density | Match integrated frequency/wavelength bands using the Jacobian |
| A light complex contracts like material volume | Test a transverse ray, where the source's packet-volume factor differs from the material shortcut |
| Forces must have equal numerical components in different frames | Compare source-convention and laboratory transverse coefficients at nonzero speed |
| Changing observer means starting a new experiment | Assert unchanged event/worldline/run identities after a frame change |
| A moving mirror receives the fixed-surface incident power | Check intercepted power, reflected energy, and mechanical work together |
| A low-speed proxy is the exact mass coefficient at every speed | Compare the proxy with its limit and a deliberately non-small speed |
| A large seed can be carried as a JSON number | Round-trip adjacent identities above the safe-integer boundary |

These are targeted tests of likely implementation and explanatory errors, not a claim that the suite can prove all physics. Keep source-fidelity, mathematical-model, numerical, transport, and browser tests distinct so that a failure names the layer that actually needs repair.

### 17.9 Numerical precision and verification scope

Choose tolerances per quantity and regime. A relative tolerance alone is unsuitable near a true zero; a fixed absolute tolerance alone is unsuitable across many orders of magnitude. Null-interval classification near cancellation needs a documented precision policy and may legitimately return an indeterminate boundary classification rather than a confident sign.

Use stable expressions and nondimensionalized reference cases where useful. Higher precision in a verification script does not automatically make the browser implementation correct. Test its actual admitted domain, including boundary inputs, signed conventions, and unit conversions. Any physical constant set must carry its era, provenance, precision, and dependency relations; in the modern set `R=N_A k_B`, so these are not three independent uncertain inputs. [T-07]

During this plan revision, 42 local symbolic/high-precision and exact-integer checks were run on selected formulas and illustrative fixtures, including the original numerical baselines, Wien entropy normalization, spectral Jacobian, radial diffusion moments, camera covariance, inverse-estimator bias, Doppler/mirror cases, and the mass-energy limit. The final check set passes with the stated numerical tolerances. These are **checks of this plan's selected mathematics**, not execution of FrankenSim, browser acceptance, review of all translations, or evidence of educational effectiveness. The separately retained revision record states that boundary explicitly.

---

<a id="section-18"></a>

## 18. Application architecture and implementation layout

### 18.1 Static-first, progressively interactive

The main reader should be statically generated or server-rendered with complete source/explanation text and mathematical markup. A page does not need a running physics worker to expose its argument, references, or definitions.

Hydrate small interaction islands: term selection, detail drawers, local reading state, and an activated laboratory. Load source PDF viewing, Three.js, and WASM only when needed. Do not ship all four papers' content and every simulation package in the home-page bundle.

No account, subscription, payment, hosted LLM, or server-side simulation service is necessary for the core site. A future optional tutor could use the curated corpus, but the site must not depend on an unbounded chat response for accurate explanations or access to deeper steps.

### 18.2 Proposed routes

| Route | Purpose |
|---|---|
| `/` | Four invitations, a concise explanation of the project, and a clear starting point |
| `/papers` | The four canonical documents, their scope, and chronology |
| `/papers/[paper]` | Default guided reader with full source access and section navigation |
| `/papers/[paper]/[section]` | Shareable section-first entry without losing paper context |
| `/discover/[paper]` | Curated discovery journey using the same argument and experiment records |
| `/lab/[experiment]` | Standalone workbench with source and explanation links |
| `/foundations/[concept]` | Full prerequisite lesson, also usable in a local drawer |
| `/1904` | Historically bounded workspace and premise catalogue |
| `/connections` | Carefully authored links among the papers and recurring methods |
| `/sources` | Edition policy, bibliographic records, rights, corrections, and provenance |
| `/about` | Purpose, authorship, scope, and contribution guidance |

Search/filter state and selected companions can use URL parameters where appropriate. Canonical document URLs must not multiply into an uncontrolled index of every slider position.

### 18.3 Proposed source layout

```text
content/
  papers/
  source-blocks/
  translations/
  annotations/
  arguments/
  foundations/
  historical-premises/
  equations/
  experiments/
  scenarios/
  bibliography/
src/
  app/                     # The only App Router root; no competing root app/
    page.tsx
    papers/[paper]/page.tsx
    papers/[paper]/[section]/page.tsx
    discover/[paper]/page.tsx
    lab/[experiment]/page.tsx
    foundations/[concept]/page.tsx
    1904/page.tsx
    sources/page.tsx
  content/                 # Schemas, compiler, validators, route projections
  reader/                  # Reading shell, return stack, source alignment
  equations/               # Semantic bindings, rendering, term interaction
  experiments/             # Instance controller, accepted snapshot, UI contracts
  workers/                 # Versioned worker protocol and loaders
  visuals/                 # SVG/Canvas/Three.js views consuming snapshots
  units/                   # Display adapters to canonical upstream quantities
  search/                  # Build-time index and small client query layer
  testing/                 # Source, numerical-boundary, and browser scenarios
public/
  sources/                 # Only assets admitted for redistribution
  wasm/                    # Content-addressed generated artifacts
  figures/                 # Authored diagrams and reviewed source crops
scripts/
  build-content.ts
  verify-content.ts
  verify-wasm-artifacts.ts
  e2e-paper-vertical-slices.ts
  verified-production-deploy.ts
```

This is a proposed structure, not a statement that these files already exist. Root-level `app/` is also a valid Next.js convention; choosing `src/app/` here is a consistency decision, not a claim that root-level routing is broken. Do not create both. Keep independent content records small enough for precise review and parallel work. Avoid a giant `allEinsteinContent.ts` imported into client components.

### 18.4 State boundaries

Server/build state contains immutable content and manifests. Per-reader client state contains preferences, return stack, and optional local notes. Per-experiment state belongs to an instance controller/worker. Shared application state should not become a home for every particle coordinate.

Restore deep-linked views without an incorrect initial projection flashing on screen. Preserve deterministic initial rendering and resolve URL-controlled content at the appropriate server boundary where possible.

### 18.5 Shared improvements back to Classic Patents

The most useful upstream UI improvements are exact equation binding IDs, server-rendered math with interaction islands, stable cross-projection anchors, instance-scoped experiment ownership, and stronger source/argument coverage checks. Extract these after the Brownian reference slice demonstrates the contracts.

Do not require Classic Patents to migrate immediately or make its production release depend on Annus Mirabilis. Publish compatible, opt-in shared improvements with focused tests.


### 18.6 Progressive enhancement includes the explanations

The no-JavaScript route must expose the actual prerequisite text or a real link to it, not an inert help control. Generated pages for equations, argument steps, and foundations provide a durable fallback behind richer drawers. The default reader should not require a client-side search index to find the four papers or their section outlines.

Build-time math validation applies to all published representations, including captions, explanations, source notation, and print. Interactive spans must be generated from trusted semantic IDs rather than arbitrary HTML supplied in a content record. Deep links should address a meaningful passage or action even when the reader lacks WebGL.

Use route-local manifests and split payloads. Loading a concise explanation must not download every historical facsimile, all narration, and the entire numerical corpus. A science-first browser feature does not justify a megabyte of unrelated registry data on the first screen.

### 18.7 Durable low-bandwidth and offline reading

Offer an explicit **save this chapter for offline reading** path after the ordinary online reader works. A self-contained text/HTML chapter with permitted figures and source references is useful even before a service worker exists. State the asset size and included scope; do not force a large offline download on a mobile connection.

A later installable/offline mode must cache a coherent edition manifest, its required assets, and optionally the selected laboratory packages. Offline numerical operation is claimed only when the exact bundle and initialization path have actually been tested without a network. Merely caching a page does not make its deferred WASM, fonts, or figures available.

Keep prior cached editions readable during an update, validate new assets before promotion, and explain when a shared preset needs a model version not present offline. Storage eviction or private-browsing restrictions must not corrupt the online reader or erase unsaved notes without a warning. Do not cache private free-text responses into publicly shareable URLs or exports by default.

---

<a id="section-19"></a>

## 19. The material around the papers: learning how to find an idea

The explanatory material should be substantial enough to stand as an original book, but every excursion should earn its place by helping the reader understand an actual move in the papers. Avoid an ever-growing collection of loosely related physics articles.

### 19.1 The 1904 desk

Make `/1904` an inviting workspace rather than a chronological wall of famous names. Offer a few concrete objects: a radiation spectrum, a microscope observation, a pair of clocks, a conductor and magnet, and an energy ledger. Selecting an object opens the relevant established results, unresolved questions, and mathematical tools.

Each object should expose three different questions:

- What could you actually measure?
- What interpretation would you be tempted to put on that measurement?
- Which further measurement or argument would distinguish that interpretation from another?

The workspace is a pedagogical reconstruction, not a claim to reproduce Einstein's desk, daily schedule, or private mental process. Historical photographs and biographical details may enrich it, but should never be the primary navigation or a substitute for scientific context.

### 19.2 A small collection of methodological essays

Commission these as carefully authored chapters with links to exact argument steps and instruments:

| Essay | Concrete lesson | Anchors |
|---|---|---|
| **What does a measurement really mean?** | Replace an apparently obvious quantity with an operational procedure; distinguish recorded events from inferred descriptions | Clock synchronization; displacement observations |
| **Change what you hold fixed** | A new question often comes from comparing the same system under a different controlled variation | Radiation entropy at fixed energy and frequency; ensemble displacement at fixed elapsed time |
| **Make two independent routes meet** | Derive the same quantity from different premises and learn from their agreement | Osmotic pressure/drag versus spreading distributions |
| **The useful part of an analogy** | An analogy can identify a shared mathematical structure without equating two physical mechanisms | Dilute radiation and an ideal gas |
| **Subtract away what you do not know** | A difference can eliminate inaccessible internal quantities and arbitrary energy offsets | The two-frame light-emission argument |
| **Ask what must stay unchanged** | Track an invariant while changing a description; distinguish a symmetry requirement from a fitted coincidence | Light propagation, event transformations, phase |
| **Take a limit without losing the claim** | Know which conclusion survives an approximation and which does not | Wien regime; diffusion timescales; the low-speed kinetic-energy coefficient |
| **Find the place your model stops working** | A useful model has a context of use; a failed extension need not invalidate its legitimate predictions | Brownian short-time limit; ideal photoelectric assumptions; prescribed mirrors |

These are contemporary methodological interpretations. Label them as such rather than attributing a modern checklist to Einstein. Their value is transfer: the reader should recognize the same moves in programming, measurement, engineering, or another scientific argument without being told that all discovery follows one algorithm.

### 19.3 Connections among the four papers

The connections page should use a small, readable argument map, not a force-directed graph containing every noun. Show links with explicit meanings: “uses this result,” “shares this mathematical pattern,” “offers a contrasting inference,” or “later modern synthesis.” These are different kinds of connection.

The two statistical papers provide especially fruitful comparisons: macroscopic observations constrain microscopic descriptions, but the premises and conclusions are not identical. The relativity paper supplies the radiation transformation needed in the September argument. The site's modern synthesis can discuss energy, probability, measurement, and invariance across the collection without inventing a single master theory claimed by the four papers. ([P-01]–[P-08])

Do not require quantum light packets to understand the September paper. Its two light pulses can be treated using the radiation-energy transformation used in the original argument; a pulse need not be a single quantum. Conversely, the quantum paper's inference does not establish special relativity.

### 19.4 Predict, perturb, explain

End each major chapter with a small task that the reader can answer in prose, by arranging a construction, or by inspecting a counterexample. The feedback should address the model of the situation, not merely indicate a correct answer.

Examples:

- Two microscope traces look equally restless. What additional comparison would help distinguish different diffusion coefficients, and why is one trace insufficient?
- A lamp gets brighter but its frequency stays below the admitted ideal threshold. Which output should not increase merely because the animation contains more incident energy packets?
- Two transformed events have a larger spatial separation. Why is that alone not a measurement of a moving rod's length?
- A body's unknown internal energy appears in both ledgers. Which subtraction removes it, and which physical premise makes that subtraction useful?

Never make guessing the next equation a condition for continuing. “Show me the reasoning” remains available. Preserve the reader's earlier prediction locally so that the changed understanding is visible without punitive scoring.

### 19.5 Capstone: design a convincing explanation yourself

Offer four optional capstones, one per paper. A capstone consists of an ordered set of source-linked claims, an experiment preset, a small number of annotated equations, and a statement of assumptions. The reader can use a prepared template to explain the result to another person, using words, a table, a drawing, or equations as appropriate to that explanation.

This is not a social network or a new authoring platform. Initially, it can be an editable local worksheet with an ordinary print view. Its purpose is to reveal whether the reader can reconstruct the dependency chain without relying on the animation to imply missing logic.

### 19.6 Four welcoming entrances that still lead to the papers

Build the entrances as real editorial deliverables, with the same care as the advanced derivations. Their purpose is to produce one sound insight and a next step, not to claim that a two-minute interaction exhausts a paper.

| Paper | First encounter without algebra | Bridge to the actual argument | Intellectual trap to avoid |
|---|---|---|---|
| Light quanta | Compare how one independently placed object versus several independent objects can all end up in half a space; enumerate small cases before naming a probability law | Explain why a matching volume-dependence in radiation entropy would be surprising, then derive where that dependence comes from | Drawing dots is not evidence that radiation literally consists of those dots |
| Brownian motion | Use the signed-displacement exercise in §6.2; compare cancellation with spread | Show why the mean square is tractable, then connect diffusion to osmotic pressure and drag | Squaring is not the only valid way to notice movement |
| Relativity | Record a signal leaving a clock at 0 and returning at 10; discuss assigning the remote reflection a midpoint time | Build the operational meaning of synchronized clocks, then ask whether another moving set of clocks uses the same simultaneity | The midpoint assignment is a stated synchronization procedure, not a direct measurement of an unknowable one-way time without conventions |
| Mass–energy | Compare two accounting sheets and remove a shared unknown by subtraction | Connect the second description to the radiation transformation, then the kinetic-energy coefficient | Do not put `Mc²` inside the covered box and pretend the comparison discovered it |

Each entrance has a word-only/table route, an optional visual manipulation, and the exact source destination. The no-algebra route may introduce arithmetic gradually; the reader can also inspect the reasoning in ordinary language. It is not an abridged “lesser” website detached from the primary papers.

### 19.7 Five distinctive shared instruments for reasoning

**The missing-step explorer.** A reader selects an unfamiliar transition between equations or claims. The site shows the changed part, the rule used, the physical premise if any, and one smaller worked case. From there the reader can ask about the symbol, operation, physical assumption, or representation. Use authored transformations and exact subexpression IDs, not a runtime system that guesses the meaning of arbitrary LaTeX. Its first acceptance example is the variance-of-a-sum step in Brownian motion.

**The hold-something-fixed comparison.** Pin a baseline and vary exactly one declared input. The comparison states what remained fixed, what changed physically, and what was merely re-described. For Brownian motion, use a visibly shared or independent seed policy; for relativity, preserve the physical events while changing observer. A pair of synchronized graphs is useful only when the comparison's semantics are correct.

**The countermodel workbench.** Offer a small set of coherent candidate models and explicit constraints. Let a reader discover what each explains, where it fails, or why the available information cannot distinguish them. A Galilean map can pass low-speed tests yet fail the stated invariant-light-speed condition; correlated points need not obey the independent-counting law. Do not make a rival fail by programming every test with the favored conclusion, and do not claim to have searched all conceivable alternatives.

**The what-can-you-infer workbench.** Hold the admitted observations fixed and reveal families of compatible parameters. The Brownian radius/molecular-number ambiguity is the initial case. Ask which independent measurement would reduce the ambiguity. This teaches that a model can fit a curve without uniquely identifying the underlying world; uncertainty from inadequate information is not repaired by displaying extra decimal places.

**The explanation replay.** A local notebook stores an optional prediction, a named experiment comparison, the accepted model/input identities, and the reader's revised explanation. A reader can revisit the precise evidence and assumptions behind a changed view. The replay stores no inferred intelligence score and does not claim a free-text answer is correct merely because it contains expected keywords.

These are shared modes around the 33 core instruments. Implement the smallest examples in the Brownian slice and expand only after observing their usefulness. None requires a general CAS, autonomous scientist, or open-ended chat service.

### 19.8 Teach-back, memory, and learning together

Offer optional prompts such as “Explain why the signed average can vanish,” “What did we assume about the clocks?”, or “What observation would change your mind?” Let readers answer privately, reveal a worked explanation immediately, and compare their reasoning against a few concrete criteria. A request for help must never cause a loss of access or a penalty.

Self-explanation research provides a reason to test these activities: Chi and colleagues observed useful differences in how learners explained worked mechanics examples. That finding does not justify an automatic correctness judgment about this site's free-text answers. [ED-03]

Offer optional later revisit cards built from previously studied examples, with a changed number, geometry, or assumption. Roediger and Karpicke found delayed retention benefits from retrieval in their prose-learning experiments; this supports trying voluntary recall, not imposing streaks or assuming the same effect size for mathematical discovery. [ED-04]

A printable paired-learning sheet can assign rotating roles: propose a prediction, operate the experiment, and question the explanation. It should also work alone and without a teacher. Do not build a social network or require public posting to obtain the benefits of discussing an idea.

---

<a id="section-20"></a>

## 20. Quality gates that protect the actual reading experience

### 20.1 Five independent questions

A release should answer five questions separately:

1. Is the historical text complete and accurately represented?
2. Is the explanation mathematically and physically sound?
3. Does the instrument calculate and display the stated model correctly?
4. Can a visitor operate and understand the actual page?
5. Does the explanation help a reader overcome the intended obstacle?

A unit-test count cannot answer all five. Neither can a historian's approval of a transcription, a screenshot of a beautiful page, or a learner saying that the animation was enjoyable.

### 20.2 Editorial review

Review at the level of a complete argument, not isolated sentences. For each section, a reviewer should be able to follow the facsimile, transcription, translation, explanation, notation map, and instruments without guessing how they correspond.

Require a physics/mathematics review of each complete derivation and a German/source review of the translation. Contributors may fill more than one role where qualified, but machine-generated drafts must not self-certify. Review the short mass–energy paper with the same seriousness as the longer documents; brevity makes a missing premise easier to hide.

Record corrections against stable source and argument IDs. A source correction should identify affected translations and explanatory claims. It should not automatically mark unrelated visual work obsolete, and a visual change should not imply that a translation was re-reviewed.

### 20.3 Content-compiler and numerical gates

The build must reject unresolved source locators, broken alignment edges, dangling symbols, duplicate IDs, invalid units, unsupported historical labels, unrenderable mathematical notation, and experiments with undefined model boundaries. It should reject “complete” publication status when required source blocks or explanation obligations are absent.

Use the domain tests in §17, plus malformed-request and malformed-result tests at the browser boundary. Test direct user numeric entry and shared-state URLs, not only slider-generated values. A result must not become accepted merely because its fields happen to be finite; dimensions, identities, model version, domain, and internal relationships also matter.

Do not attempt to write a general symbolic theorem prover before publishing an equation. The deliverable is a reviewed equation registry with targeted identities, limiting cases, independent fixtures, and explicit derivation dependencies.

### 20.4 Real browser acceptance

Adapt the existing Classic Patents vertical-slice harness rather than replacing it with an unrelated test framework. Its useful pattern is a complete visitor journey, semantic readiness checks, multiple viewports, and retained failure evidence. [CP-11]

Each paper needs at least one continuous test that enters through a deep source passage, switches projection, opens a prerequisite, returns to the exact argument, operates an instrument, selects a linked symbol, and returns to the source. In addition, test every instrument's own parameter and refusal contract.

The browser matrix should include desktop, tablet, and a 320-pixel-wide touch viewport; an actual WebKit/Safari lane for the Apple devices likely to be used; keyboard-only interaction; reduced motion; high zoom; and a no-WebGL path. Include JavaScript-disabled reading checks against the rendered document. Browser emulation alone is not a substitute for at least a small real-device check.

Acceptance must include:

- Identical accepted snapshot IDs across visible numerical, graphical, equation, and tabular views of one experiment.
- Two independent instances of the same experiment, demonstrating that their controls do not interfere.
- Projection changes that do not restart a running experiment or mount a second owner.
- Worker refusal, unavailable WASM, stale responses, context loss, and restart without false results.
- Reachable footnotes and source locators, meaningful MathML, focus restoration, and no page-level horizontal overflow.
- Print output with complete prose, uncut equations, expanded essential explanations, and static representations of the chosen experiment state.

A failed test should retain enough evidence to diagnose the failure, not silently retry until it happens to pass. Test the failure-reporting path itself.

### 20.5 Comprehension testing

Recruit readers across genuinely different starting points: no algebra or graph fluency; rusty mathematical preparation; non-native English; technically trained but physics-unfamiliar; and strong mathematical preparation. Include disabled readers using their own assistive setups and people on low-cost phones. Observe obstacles in the no-algebra path as well as the full derivation. Participation is voluntary, accessible, and compensated where feasible; no diagnosis, professional credential, or placement score is required. Section 20.8 defines the research protocol. Do not infer usability from the authors' fluency.

Ask readers to explain what a formula predicts before and after interacting with it, identify which assumptions support a conclusion, and distinguish a simulation result from an observation. Use a transfer example with different numbers or geometry to check that they learned the relation rather than a particular animation.

Record the precise stumbling point: an undefined symbol, an omitted inference, a misleading visual cue, an inaccessible control, or too much information at once. Improve the relevant explanation before adding a new feature. These sessions establish local evidence about the tested material, not a universal claim that the site teaches everyone successfully.

### 20.6 Performance budgets

Set provisional budgets before building the reference slice and adjust them only with recorded measurements. These are engineering targets, not claims about current performance.

| Surface | Initial target | Measurement boundary |
|---|---|---|
| Initial reading route | No Three.js, PDF viewer, or WASM in the initial dependency graph; at most 200 KiB compressed first-route JavaScript as a starting budget | Cold production build, measured transferred script bytes |
| Visible text and math | Main reading content available in initial HTML; locally hosted subset fonts with stable fallback metrics | JavaScript disabled; cold font cache |
| Reader responsiveness | Target 200 ms or better interaction latency at the 75th percentile on the agreed test profile | Real interactions, including a detailed explanation drawer |
| Layout stability | Target cumulative layout shift no greater than 0.1 | Initial load and deferred math/figure activation |
| A simple analytical instrument | Parameter feedback within 100 ms on the agreed device profile once loaded | Input to accepted visible snapshot, not input to pending-state paint |
| Animated instruments | Aim for 60 Hz on capable desktop hardware and a stable 30 Hz mobile tier | Rendering measured separately from solver accuracy |
| Resource lifecycle | No growing count of workers, GPU contexts, event listeners, or retained particle buffers across repeated route changes | Repeated open/close and experiment-switch stress run |

Name the hardware, browser, viewport, network profile, and cold/warm cache conditions in retained measurements. Report total transfer separately from JavaScript. A smaller bundle is not necessarily a faster page if fonts or enormous source images dominate.

Reduce visual detail, particle display count, resolution, or rendering frequency under load. Do not silently enlarge the physical integration step, change the scientific model, or reduce the statistical sample behind an inference. Rendering a subset of particles must not change the ensemble used for numerical results.

### 20.7 Accessibility, security, and privacy

Use WCAG 2.2 AA as the accessibility target, with manual checks for scientific content that automated tooling cannot settle. Color contrast and keyboard support are necessary but not sufficient: meaningful descriptions of changing plots, equation structure, and access to numerical alternatives matter equally. [T-03]

Treat imported text, bibliographic data, URL state, and future reader notes as untrusted input. Use a closed content schema and sanitized rendering; do not evaluate user expressions as JavaScript or compile uploaded code. Keep KaTeX trust narrowly scoped and test allowed token markup. Do not let a source record inject arbitrary HTML, CSS, links, or image loads through a mathematical expression. ([CP-04]; [T-01]; [T-02])

Bound URL-state size, particle counts, iteration counts, and numeric input ranges. Keep heavy calculations cancellable so a malicious or accidental preset cannot freeze the page. Content-addressed WASM still requires trusted build provenance: a hash detects mismatched bytes but does not establish that the code is safe or scientifically correct.

Use local reading progress by default. Analytics, if added, should collect only what answers a specific product question. Do not send private notes, free-text answers, or fine-grained behavior to a third party by default. A public source edition does not need an account system or a cookie banner full of unnecessary tracking choices.

### 20.8 Test the learning promises, not just the animations

Begin formative observation with small, deliberately varied groups rather than one aggregate “user success” percentage. A practical starting round is several participants for each contrasting access/starting-point route, for example five to eight where recruitment permits. That is a problem-discovery design, not a statistically powered claim of universal effectiveness. Some participants can cover multiple routes; do not collect diagnoses merely to fill a quota.

For each tested lesson, state the targeted change in understanding before the session. Use a brief pre-explanation question, observe the interaction, ask for an explanation afterward, and present a different case. When feasible and separately consented, offer a delayed revisit. Keep the participant's ability to stop, skip, read the answer, or use assistive tools intact.

Use a compact rubric tied to the scientific question:

| Dimension | What to observe |
|---|---|
| Meaning | Can the reader say what is measured or compared? |
| Mechanism or argument | Can the reader explain the relevant connection rather than describe the animation? |
| Prediction | Can the reader handle a changed value, geometry, or direction? |
| Assumptions | Can the reader name a condition under which the inference would need revision? |
| Evidence | Can the reader distinguish an observed dataset from a simulated consequence? |
| Navigation | Can the reader locate the source and obtain the missing explanation without assistance from the author? |

Record the actual obstacle and relevant passage/action ID. Prioritize fixes that remove recurrent barriers across several lessons. A reader's incorrect prediction may be a productive starting point; do not count it as a usability failure before the explanation or as proof of personal inability.

Satisfaction, confidence, time-on-page, and completion are not substitutes for understanding. Deslauriers and colleagues found that perceived learning and measured learning could diverge in their physics classroom study. Measure both where useful, but do not make a more entertaining interface the automatic winner. [ED-05]

Any comparative product experiment must state its outcome, assignment method, exclusions, analysis, and uncertainty in advance. With small traffic, report descriptive observations rather than repeatedly testing until a favorable significance threshold appears. Publish the scope of the tested routes and known barriers; do not claim that the site has proved it can teach every person.

### 20.9 A full acceptance scenario for someone outside the presumed audience

Before freezing the shared reader/equation architecture, run this sequence with a reader unfamiliar with algebra and a separate nonvisual-access check:

1. Enter Brownian motion without knowing its name; explain the difference between zero signed average and no movement using the four-entry example.
2. Ask why the square is useful; read the smaller worked case, then return to the original question without losing place.
3. Predict how a more viscous liquid changes spread at the same time; inspect the admitted comparison with units or the corresponding plain-language relation.
4. Identify which scene is simulated and which data, if present, were observed; explain that programmed motion does not independently prove molecules exist.
5. Open the source passage and identify the next mathematical bridge, without being forced to complete it during the session.

Run the equivalent scientific actions using keyboard/assistive controls and an unavailable-graphics path. Also run the advanced derivation route so that helping the new reader has not removed mathematical completeness. A failure should lead to an improved explanation or interaction in the reference slice, not a new badge claiming “beginner support.”

---

<a id="section-21"></a>

## 21. Hosting, domain, and release design

### 21.1 Recommended initial deployment

Use **Cloudflare for the registered domain and authoritative DNS**, with **Vercel for the initial Next.js deployment**, following the proven broad pattern of Classic Patents. Registration at Cloudflare does not require that the application be hosted on Cloudflare.

For this arrangement, start with the application records in **DNS-only** mode rather than placing Cloudflare's reverse proxy in front of Vercel. Vercel's current guidance warns that an extra proxy can complicate caching, routing, and request visibility; Cloudflare documents the distinction between proxied and DNS-only records. Recheck the provider instructions during implementation and use the exact records supplied for the project, not IP addresses copied from a plan. ([T-04]; [T-05])

This document does not authorize changing DNS, connecting a domain to an existing project, or deploying anything. It specifies the intended implementation path.

### 21.2 Domain and asset policy

Make `https://annus-mirabilis.com` canonical. Redirect the `www` variant consistently if it is configured. Provide canonical URLs, a sitemap, social metadata, and descriptive titles for the four papers, their sections, foundation lessons, and standalone experiments.

Serve readable HTML and source assets from controlled origins where redistribution is authorized. Long-lived cache immutable, content-addressed figures and WASM artifacts. Keep manifests and HTML on a policy that does not cause a new page to reference a removed artifact. An old page must retain access to the exact versioned assets it names.

Use the correct `application/wasm` response type for streaming instantiation, and verify the actual content security policy with the chosen loading path. Avoid a broad `unsafe-eval` allowance as a convenience fix. Test CSP behavior and worker loading in the supported browsers. [T-08]

Do not require SharedArrayBuffer or cross-origin isolation for the first version. A single dedicated worker per active heavy experiment, bounded work chunks, and ordinary transferable data should be enough for the planned core instruments. More elaborate parallelism should earn its complexity through measured need.

### 21.3 Atomic release and rollback

Adapt the verified production release idea from Classic Patents: build a complete candidate, validate it under an unpromoted deployment URL, and only then promote the public domain. The existing project explicitly distinguishes a candidate deployment from domain promotion. ([CP-01]; [CP-11])

A release manifest should bind the site source revision, content edition version, source-asset hashes, WASM artifact hashes, generated API schema version, and test results. This is engineering metadata, not a decorative badge on every paragraph.

The candidate checks must load all four complete paper texts, representative foundation pages, and every instrument bundle. Include one no-JavaScript source-text check, one real accepted WASM result per numerical capability, and one deliberate typed refusal. Verify the exact deployed assets, not merely the files in the build directory.

After promotion, run a short live smoke test. Keep the previous verified deployment and its immutable assets available for rollback. A rollback must restore a coherent site/content/kernel set; it must not point old HTML at incompatible new WASM.

Do not make unreviewed changes to Classic Patents as part of this site's release. The two websites should fail and recover independently.

### 21.4 Cloudflare-hosted alternative

A Cloudflare-hosted application is an alternative worth testing only if there is a concrete cost, operational, or product reason. First perform a bounded compatibility experiment covering the intended framework version, static generation, source assets, workers, WASM, and preview releases.

Do not block the editorial and instrument work on a hosting comparison. The core design is static-first and browser-computational, which keeps migration practical without promising that every framework adapter is interchangeable.

---

<a id="section-22"></a>

## 22. Delivery plan: complete vertical slices, then systematic coverage

The objective is not to accumulate framework scaffolding. Each implementation batch should leave a visibly better, source-grounded reader experience. Use a small set of dependency-aware work items with concrete outputs and closure tests.

### 22.1 Start the source inventory immediately

Before the visual polish phase, inventory all four original documents, including every equation and footnote. Freeze stable IDs and identify translation/notation difficulties. This prevents the familiar parts of the papers from consuming the entire project while the harder sections remain undefined.

Proceed with transcription, translation, and scientific review in parallel with the reference implementation, using the same stable source and argument IDs from the outset.

### 22.2 The first reference slice

Build **Brownian motion, especially the distribution argument and measurable displacement in §§4–5**, as the first end-to-end slice. Include the required explanation of the diffusion coefficient and the links back to §§1–3; do not present a decontextualized stochastic toy as a complete treatment of the paper.

This slice exercises almost everything the architecture must prove: original German and English alignment, probability and calculus drilldowns, semantically linked formulas, a real seeded numerical owner, a graph and microscope view of the same state, units spanning microscopic scales, model limits, inference, mobile operation, and a discovery path.

The exit demonstration should be concrete:

> A reader opens the original passage about displacement, understands why the mean displacement can vanish while its square grows, predicts the effect of changing viscosity, sees the same accepted state in the trace and distribution, opens the derivation of the square-root time dependence, and returns to the source without losing position. The page remains intelligible when the simulation is unavailable.

Do not generalize the framework until this slice exposes which abstractions actually help.

### 22.3 Delivery batches and dependencies

| Batch | Work that changes the product | Required exit evidence |
|---|---|---|
| **A. Corpus and edition skeleton** | Four source manifests, stable passage/equation IDs, rights inventory, route skeleton, readable German/English draft projections | Every original source unit has a destination; drafts are visibly distinguished from reviewed translations |
| **B. Brownian golden slice** | Source/English/explanation alignment; no-algebra entry; equivalent nonvisual experiment; return stack; semantic equations; seeded diffusion; linked trace/distribution; typed results | A new reader can explain cancellation versus spread without algebra; an assistive-technology user can run the same comparison; full derivation and analytical/stochastic checks also pass |
| **C. Complete Brownian paper** | Osmotic pressure, force balance, diffusion coefficient, the full historical argument, independent inference route, complete source review | All five sections and surrounding text covered; no modern-constant circularity in the historical inference exercise |
| **D. Relativity foundations and kinematics** | Clock network; event records; candidate transformation construction; simultaneity, lengths, clock rates, velocity composition | Reader can distinguish event separation from a rod measurement; inverse/composition/null-path tests; original notation mapping |
| **E. Light paper in full** | Radiation spectrum; entropy/volume comparison; gas analogy; discrete-energy inference; fluorescence, photoelectric effect, ionization | All nine sections covered; Wien limitation visible; energy-versus-rate controls demonstrably distinct |
| **F. Relativity electrodynamics in full** | Field transformations, wave phase, Doppler/aberration, moving mirrors, charge/current, electron dynamics | All ten sections covered; numerical sign/frame checks; difficult final sections receive the same explanatory depth as the opening |
| **G. Mass–energy in full** | Original three-page edition; opposite-pulse experiment; two-frame ledgers; low-speed coefficient; system boundaries | Noncircular derivation; exact/Taylor comparison; full prose and all qualifications present |
| **H. Discovery book and connections** | Four complete discovery journeys, methodological essays, 1904 workspace, foundations and capstones | Knowledge-boundary review; prerequisite graph has no explanatory dead ends; transfer tasks reviewed |
| **I. Publication finish** | Final typography and accessibility regression checks, mobile/print, source corrections, performance, candidate release and domain configuration; accessibility already exists in each prior batch | All launch criteria in §24 met against the actual candidate deployment |

Batches overlap where their contracts permit. Source work for all four papers starts in A, not when the corresponding instrument batch begins. G needs the radiation-energy transformation from the relativity work, but it does not need the light-quantum paper to be completed first. H begins with the first slice and matures alongside the physics, rather than being prose pasted over finished animations.

### 22.4 Concrete high-value work items

The first implementation backlog should contain tasks such as these, each with a narrow deliverable:

| Work item | Deliverable | Closure condition |
|---|---|---|
| Source manifest compiler | Canonical source units, alignment graph, locator validator | Missing or duplicate original units produce an actionable failure |
| Reader projection shell | Source, English, explanation, and companion view with stable navigation | A deep-linked passage survives mode switching and prerequisite return |
| Semantic equation component | Explicit symbol/operation IDs, unit/value bindings, keyboard/touch interaction | Selecting a term highlights exactly its authored meaning in all linked views |
| Diffusion owner | Reusable upstream coefficient, propagator, seeded trajectory, and moment functions | Independent analytical/statistical tests and admitted WASM export |
| Experiment controller | Instance-scoped state, versioned worker requests, accepted snapshots | Stale response rejected; same-experiment instances remain independent |
| Brownian explanation unit | Complete explanation of mean, mean-square displacement, and square-root time dependence | Reviewer can follow every step; transfer example works without animation |
| Notation concordance | Original-to-modern mapping with scope and semantic distinctions | Original β/τ/V cannot silently acquire modern meanings |
| Relativity event engine | Events, inertial frames, exact boosts, inverse/composition and light rays | Frame-sign fixtures and rod/clock measurement cases pass |
| Radiation entropy instrument | Wien-domain entropy comparison with ideal-gas analogue | Correct dependence and explicit domain; analogy never presented as a universal proof |
| Two-frame energy ledger | Independently computed before/after radiation and body-energy differences | September reasoning works without assuming its conclusion |

Avoid work items whose only completion criterion is “add a module,” “create a manifest,” or “write tests.” Each should state the reader capability or scientific boundary it delivers.

### 22.5 Parallel contributors without content drift

Give each paper a responsible editorial owner and each shared numerical capability a responsible implementation owner. Centralize the symbol registry, source IDs, and browser protocol early; let prose and visual composition vary where it improves understanding.

Keep changes small enough to review and integrate frequently. Do not repeatedly rename content IDs or reformat unrelated papers. Pin upstream numerical revisions and re-run the dependent fixtures when a capability changes. Improvements to generic physics belong in FrankenSim, with an explicit downstream adoption change in the site.

The plan does not require a separate governance system, a new package registry, or a bespoke project-management UI. Existing repository practices can track the work.

### 22.6 What a preview may show, and what launch means

A public preview may contain a complete Brownian slice while the other papers are clearly marked in preparation. It must not advertise four complete interactive editions before they exist.

The intended launch is the complete four-paper site. A preview is a way to learn from a real reading experience, not permission to redefine the project as four landing pages and four famous equations.

### 22.7 The innovation sequence and its stop rules

Protect the critical path by implementing the new ideas in an order that yields useful reader capabilities:

| Priority | First concrete delivery | Expand only after |
|---|---|---|
| P0 | No-algebra Brownian entrance plus a complete advanced explanation of the same step | Both can lead back to the same source passage without contradictory claims |
| P0 | Equivalent nonvisual actions and a calm reading-only path | Readers can perform the comparison, not merely hear a description of it |
| P0 | Typed results, exact identities, control classification, and safe snapshot ownership | A changed observer preserves the world; stale results and rounded seeds cannot corrupt it |
| P1 | Missing-step explorer on the variance argument | Observed readers can resolve a specific obstacle and return |
| P1 | Baseline/variant comparison plus a fair countermodel case | The interface distinguishes changed premises from changed representation |
| P1 | Molecular-number identifiability and observation-error comparison | Unknown information is visible and the uncertainty calculation remains valid |
| P2 | Optional explanation replay, revisits, and paired worksheets | They help explanation/transfer without becoming required navigation |
| P2 | Offline chapters, reviewed narration, and additional languages | The corresponding access need is tested and the publication/revision path is reliable |

P0 and P1 are not a license to postpone the remaining papers indefinitely. Reuse the proven forms rather than repeatedly redesigning the learning platform. Time-box the first prototype of each shared innovation to a bounded lesson; defer it when it has no observable advantage over a simpler, well-written example.

Human source/translation review, scientific review, accessibility co-design, and editorial writing are first-class work, not final polish around completed code. Track their actual availability alongside programming tasks. Do not label machine-authored material “reviewed” because the renderer, schema, or model producing it passed a test.

---

<a id="section-23"></a>

## 23. Principal risks and decisions

| Risk | Failure mode | Design response |
|---|---|---|
| Hindsight disguised as discovery | The reader is handed the conclusion in the premise or a post-1905 formalism is presented as available in 1904 | Explicit knowledge cards; separate historical and modern routes; derivation dependency review |
| Beautiful summaries replacing the papers | Familiar headlines are covered while difficult original sections disappear | Full source manifest and section-specific completeness obligations |
| Recursive explanation becomes a maze | Each definition opens several undefined terms and the reader loses the argument | Finite foundation graph, authored stopping points, local return stack, worked examples |
| Animation implies false physics | Rendered particle impacts or visual flashes are mistaken for a quantitative model | Display/model distinction, shared accepted snapshots, explicit experiment boundaries |
| WASM branding replaces integration | A package loads but displayed values still come from unrelated JavaScript | Execution provenance attached to the accepted quantity, not package presence |
| Missing upstream capability expands into a research platform | A short educational instrument waits for a general quantum or relativistic simulation engine | Narrow analytic/stochastic capabilities, admitted domains, generic upstream ownership |
| Translation errors propagate | An ambiguous German phrase becomes an unquestioned premise in the explanation | Reviewed alignment, correction graph, visible alternate readings where warranted |
| Modern constants spoil historical inference | An unknown is built into synthetic data through a hidden modern equivalent | Separate historical inference parameters and modern demonstration mode |
| Rich UI compromises the book | Large bundles, tiny panes, endless controls, and slow hydration obscure reading | Static-first text, restrained companions, lazy labs, real narrow-screen testing |
| Overengineering delays actual learning | Schemas and receipts grow while no one can understand a complete passage | Brownian reference slice first; every batch closes a reader-visible capability |

### 23.1 Decisions made by this plan

The content unit is an argument linked to a source passage. The default is a guided English reader with optional deeper detail. The source remains directly accessible. The 1904 perspective is an authored constraint, not a decorative theme. Three.js is a presentation tool, not a scientific authority. Numerical capabilities belong upstream. The core product is static-first and requires no login or hosted model.

### 23.2 Decisions to resolve during implementation

Resolve the final license for new code/content; the distribution basis for each source scan; the reviewers for the English editions; the framework and package versions after a compatibility/security review; the exact upstream ownership of missing capabilities; and the actual device profiles used for performance budgets.

These decisions should be made at the point where they affect work. They do not justify deferring source inventory, content writing, or the first vertical slice.

### 23.3 Explicit non-goals for the first complete release

Do not add general relativity, a complete history of quantum mechanics, a Schrödinger-equation laboratory, an Einstein biography archive, a social network, a payment system, or an open-ended automated tutoring service. Later-context notes may refer to subsequent developments, clearly labeled, without turning them into prerequisite chapters.

Do not port the entire renderer to Rust, require every diagram to be 3D, or adopt a new numerical library solely because it appears fashionable. The project's differentiator is unusually complete understanding of four papers, not the novelty of its web framework.

---

<a id="section-24"></a>

## 24. Definition of a successful launch

The site is ready to call itself a complete edition when the following conditions hold together.

**The corpus is complete.** All four documents are represented in full, including the sections and qualifications that are frequently omitted from popular accounts. Every source unit has a stable locator, reviewed English rendering, and an appropriate explanation. The site distinguishes original wording, translation, interpretation, and later mathematics.

**The entry paths are real.** Each paper has a tested first encounter requiring no algebra, an explicit bridge to its core argument, targeted help for different obstacles, and equivalent essential actions without sight or dragging. No examination, account, payment, or inferred ability profile controls access. Full English publication does not falsely imply that every language edition is already reviewed.

**The arguments are reconstructible.** A reader can follow each main result without a circular premise, unexplained change of variables, invisible assumption, or missing prerequisite. The four discovery journeys present genuine problems and reasonable alternatives, not just the finished theory in a theatrical sequence.

**The instruments answer questions.** All 33 core instruments have their specified conceptual coverage, usable controls, linked outputs, visible assumptions, and accessible alternatives. An instrument may be a view or mode of a shared workbench rather than a separate page. Full coverage does not require 33 independent engines.

**The computation is real and appropriately bounded.** Reusable numerical owners live in FrankenSim; the browser calls admitted exports where specified; displayed results come from accepted, versioned snapshots; numerical and stochastic checks pass; and fallback behavior is truthful. A model consequence is never mislabeled as historical evidence or a newly validated experiment.

**The book works as a book.** The default presentation is beautiful and readable on a narrow phone as well as a large screen. Text, equations, source references, and essential explanations survive disabled JavaScript, reduced motion, unavailable WebGL, print, and slow loading. Keyboard and assistive-technology paths are first-class.

**The publication is maintainable.** Corrections propagate through explicit source relationships; dependencies and artifacts are pinned; the deployed candidate has passed the release checks; and rollback restores a coherent version. No source, translation, image, or code license has been assumed merely from its availability online.

### The final product test

Invite readers with different starting points to choose a question from a paper and an accomplishment they care about: appreciate, explain, predict, derive, or critique. Then ask them to communicate their understanding to another person, starting from the problem rather than the famous equation. Can they state what is being measured, why the old assumptions are inadequate or incomplete, what new move is made, what mathematics connects the steps, and where the conclusion stops applying?

A successful route lets a reader do this at the chosen level, find the relevant original passage, and see the next bridge rather than a locked door. Test the no-algebra, nonvisual, and full-derivation routes independently. Success with one group is not evidence that every route works for every reader. The project succeeds by repeatedly removing documented barriers while preserving the intellectual substance.

---

<a id="section-25"></a>

## 25. Source register and evidence boundaries

The references below identify the materials used for this plan. Repository references are pinned to the inspected revisions; live documentation and websites were consulted for this plan on September 14, 2026. A linked file establishes its visible contents, not that its tests were executed or that its claims were independently reproduced.

For the historical papers, the **German facsimiles establish original scope and wording**. Existing English translations are comparison sources, not a blanket license to republish them. A host's possession of a scan is also not itself a rights determination. The implementation should retain its own reviewed bibliographic and rights records.

### 25.1 Classic Patents

[CP-01]: https://github.com/Dicklesworthstone/classic-patents.com/blob/da11ff475902728fd8dd1d9db9f3af37c16ec8a5/README.md
[CP-02]: https://github.com/Dicklesworthstone/classic-patents.com/blob/da11ff475902728fd8dd1d9db9f3af37c16ec8a5/package.json
[CP-03]: https://github.com/Dicklesworthstone/classic-patents.com/blob/da11ff475902728fd8dd1d9db9f3af37c16ec8a5/AGENTS.md
[CP-04]: https://github.com/Dicklesworthstone/classic-patents.com/blob/da11ff475902728fd8dd1d9db9f3af37c16ec8a5/src/components/ui/LatexRenderer.tsx
[CP-05]: https://github.com/Dicklesworthstone/classic-patents.com/blob/da11ff475902728fd8dd1d9db9f3af37c16ec8a5/src/components/ui/ColorizedEquation.tsx
[CP-06]: https://github.com/Dicklesworthstone/classic-patents.com/blob/da11ff475902728fd8dd1d9db9f3af37c16ec8a5/src/types/equation.ts
[CP-07]: https://github.com/Dicklesworthstone/classic-patents.com/blob/da11ff475902728fd8dd1d9db9f3af37c16ec8a5/src/physics/usePatentPhysics.ts
[CP-08]: https://github.com/Dicklesworthstone/classic-patents.com/blob/da11ff475902728fd8dd1d9db9f3af37c16ec8a5/docs/FRANKENSIM_WASM_INTEGRATION_TODO.md
[CP-09]: https://github.com/Dicklesworthstone/classic-patents.com/blob/da11ff475902728fd8dd1d9db9f3af37c16ec8a5/src/components/patents/DualProjectionViewer.tsx
[CP-10]: https://github.com/Dicklesworthstone/classic-patents.com/blob/da11ff475902728fd8dd1d9db9f3af37c16ec8a5/src/physics/coverageManifest.ts
[CP-11]: https://github.com/Dicklesworthstone/classic-patents.com/blob/da11ff475902728fd8dd1d9db9f3af37c16ec8a5/docs/PATENT_E2E_HARNESS.md
[CP-12]: https://github.com/Dicklesworthstone/classic-patents.com/blob/da11ff475902728fd8dd1d9db9f3af37c16ec8a5/COMPREHENSIVE_PLAN_FOR_CLASSIC_PATENTS.md
[CP-13]: https://classic-patents.com/
[CP-14]: https://classic-patents.com/patents/us-821393-wright-flyer

| ID | Material | What it supports |
|---|---|---|
| [CP-01] | README | Source-edition layers, reported coverage, runtime categories, release approach, license qualification |
| [CP-02] | Package manifest | Actual declared frontend dependencies rather than aspirational stack prose |
| [CP-03] | Agent guidance, inspected portions | Source integrity, full vertical-slice expectations, shared physics ownership, reference implementation map |
| [CP-04] | `LatexRenderer.tsx` | KaTeX output, restricted trust, error handling, mixed text/math rendering |
| [CP-05] | `ColorizedEquation.tsx`, inspected portion | Term interaction, telemetry lookup, keyboard navigation, areas to refactor |
| [CP-06] | Equation types | Symbols, roles, units, sentence fragments, serializable formatting |
| [CP-07] | `usePatentPhysics.ts` | Shared parameter maps, control-change ticks, constraints, subscription mechanism |
| [CP-08] | Integration roadmap, inspected portion | Distinction between capability inventory, runtime provenance, and demonstrated integration |
| [CP-09] | `DualProjectionViewer.tsx`, inspected portion | Per-paper server-resolved data, source fallback, projection state, component boundaries |
| [CP-10] | Coverage manifest, inspected portion | Artifact identity, ownership fields, source coverage, admitted provenance |
| [CP-11] | Browser acceptance specification | Whole-route acceptance, viewport coverage, semantic readiness, failure artifacts |
| [CP-12] | Comprehensive plan, inspected portions | Product mission, dual-projection design, original visual and pedagogical direction |
| [CP-13] | Deployed catalogue, public page content | Visitor-facing scope and navigation at consultation time |
| [CP-14] | Deployed Wright exhibit, public page content | Reference exhibit's presented source/explanation/instrument structure; not a runtime test |

### 25.2 FrankenSim

[FS-01]: https://github.com/Dicklesworthstone/frankensim/blob/88a4819abe7a361d278759aabec962604f87a00c/README.md
[FS-02]: https://github.com/Dicklesworthstone/frankensim/blob/88a4819abe7a361d278759aabec962604f87a00c/Cargo.toml
[FS-03]: https://github.com/Dicklesworthstone/frankensim/blob/88a4819abe7a361d278759aabec962604f87a00c/crates/fs-rand/src/lib.rs
[FS-04]: https://github.com/Dicklesworthstone/frankensim/blob/88a4819abe7a361d278759aabec962604f87a00c/crates/fs-qty/src/lib.rs
[FS-05]: https://github.com/Dicklesworthstone/frankensim/blob/88a4819abe7a361d278759aabec962604f87a00c/crates/fs-wasm/Cargo.toml
[FS-06]: https://github.com/Dicklesworthstone/frankensim/blob/88a4819abe7a361d278759aabec962604f87a00c/crates/fs-demo-physics-wasm/src/lib.rs

| ID | Material | What it supports |
|---|---|---|
| [FS-01] | README, inspected portions | Capability boundaries, numerical substrate, distinction between inventory and demonstrated maturity |
| [FS-02] | Root Cargo manifest, inspected portion | Workspace layout, nightly/Rust policy, sibling dependencies, default unsafe-code policy |
| [FS-03] | Random-stream implementation, inspected portion | Logical stream identity, random access, deterministic distribution paths, versioned checkpoints |
| [FS-04] | Quantity implementation, inspected portion | Dimensional representation, checked operations, semantic/units boundary |
| [FS-05] | Browser crate manifest | Standalone WASM workspace, large dependency graph, target-specific bindings and runtime dependencies |
| [FS-06] | Existing analytical demo boundary, inspected portion | Typed success/refusal envelope, version identity, teaching-model limitations; not Einstein physics |

### 25.3 The four primary papers and comparison translations

[P-01]: https://myweb.rz.uni-augsburg.de/~eckern/adp/history/einstein-papers/1905_17_132-148.pdf
[P-02]: https://inters.org/files/einstein1905_photoeff.pdf
[P-03]: https://pages.uoregon.edu/torrence/391/labs/lab3/einstein_orig.pdf
[P-04]: https://pages.uoregon.edu/torrence/391/labs/lab3/eins_brownian.pdf
[P-05]: https://myweb.rz.uni-augsburg.de/~eckern/adp/history/einstein-papers/1905_17_891-921.pdf
[P-06]: https://www.fourmilab.ch/etexts/einstein/specrel/www/
[P-07]: https://myweb.rz.uni-augsburg.de/~eckern/adp/history/einstein-papers/1905_18_639-641.pdf
[P-08]: https://www.fourmilab.ch/etexts/einstein/E_mc2/www/

| ID | Material | Use and qualification |
|---|---|---|
| [P-01] | Einstein, *Über einen die Erzeugung und Verwandlung des Lichtes betreffenden heuristischen Gesichtspunkt*, Annalen der Physik 17 (1905), 132–148; German facsimile | Original scope, equations, nine sections, historical wording; received March 18 |
| [P-02] | English light-paper translation hosted by INTERS, associated with the 1965 American Journal of Physics edition | Comparison reading for the argument and section structure; translation rights must be handled separately |
| [P-03] | Einstein, *Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in ruhenden Flüssigkeiten suspendierten Teilchen*, Annalen der Physik 17 (1905), 549–560; German facsimile hosted by the University of Oregon | Original five-section argument and received May 11 dateline |
| [P-04] | Brownian-motion translation in *Investigations on the Theory of the Brownian Movement*, translated by A. D. Cowper, edited by R. Fürth; hosted by the University of Oregon | Comparison reading; later volume pagination and front matter are not original journal pagination |
| [P-05] | Einstein, *Zur Elektrodynamik bewegter Körper*, Annalen der Physik 17 (1905), 891–921; German facsimile | Original ten-section kinematic and electrodynamic scope; received June 30 |
| [P-06] | *On the Electrodynamics of Moving Bodies*, English text hosted by Fourmilab from the 1923 English collection | Comparison reading, original-style notation, complete electrodynamic tail; edition/transcription policy still requires review |
| [P-07] | Einstein, *Ist die Trägheit eines Körpers von seinem Energieinhalt abhängig?*, Annalen der Physik 18 (1905), 639–641; German facsimile | Complete three-page emission argument and received September 27 dateline |
| [P-08] | *Does the Inertia of a Body Depend Upon Its Energy-Content?*, English text hosted by Fourmilab from the 1923 English collection | Comparison reading of the two-frame subtraction and low-speed conclusion |

Volume numbers here use the journal's fourth-series convention. Original facsimile pages, rather than the PDF viewer's zero-based index or a later translation's page number, govern published source locators.

### 25.4 Historical reference and archive discovery

[H-01]: https://myweb.rz.uni-augsburg.de/~eckern/adp/history/Einstein-in-AdP.htm
[H-02]: https://guides.loc.gov/einstein-annus-mirabilis/1905-papers
[H-03]: https://einsteinpapers.press.princeton.edu/einstein-database/

| ID | Material | Use and qualification |
|---|---|---|
| [H-01] | University of Augsburg's Einstein-in-Annalen bibliography | Bibliographic cross-check and original-paper discovery |
| [H-02] | Library of Congress guide to Einstein's 1905 papers | Canonical corpus/context cross-check; not a source for mathematical derivations |
| [H-03] | Princeton Einstein database page reached from older collected-papers links | Demonstrates that archive entry points can redirect or change; implementation must pin bibliographic identities and admitted local assets rather than depend on old deep links |

The proposed 1904 premise cards require their own claim-level primary references during editorial production. This plan identifies the necessary boundaries; it does not pretend to have assembled a complete documentary history of every result known before 1905.

### 25.5 Technical, accessibility, constants, and rights references

[T-01]: https://katex.org/docs/options
[T-02]: https://katex.org/docs/security
[T-03]: https://www.w3.org/TR/WCAG22/
[T-04]: https://vercel.com/kb/guide/cloudflare-with-vercel
[T-05]: https://developers.cloudflare.com/dns/proxy-status/
[T-06]: https://www.copyright.gov/title17/92chap1.html
[T-07]: https://www.bipm.org/en/measurement-units/si-defining-constants
[T-08]: https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/instantiateStreaming_static
[T-09]: https://physics.nist.gov/cuu/Constants/index.html

| ID | Material | What it supports |
|---|---|---|
| [T-01] | KaTeX rendering options | MathML/HTML output, error behavior, and trust controls |
| [T-02] | KaTeX security guidance | Limits and responsibilities when rendering untrusted expressions |
| [T-03] | W3C WCAG 2.2 recommendation | Accessibility target and testable success criteria |
| [T-04] | Vercel guidance on Cloudflare in front of Vercel | Initial recommendation to avoid an unnecessary proxy layer |
| [T-05] | Cloudflare DNS proxy-status documentation | DNS-only versus proxied behavior |
| [T-06] | U.S. Copyright Office, Title 17, Chapter 1 | Translation/derivative-work distinction; not a global rights determination for individual assets |
| [T-07] | BIPM, SI defining constants | Modern exact constants used in explicitly modern numerical fixtures |
| [T-08] | MDN, `WebAssembly.instantiateStreaming()` | WASM streaming response type and content-security-policy considerations |
| [T-09] | NIST reference on constants, units, and uncertainty | Companion reference for numerical constants and uncertainty treatment |

All proposed budgets, schedules of work, schemas, route names, package names, instruments, and editorial structures are **design decisions in this document**, not assertions that the corresponding software or content already exists.

### 25.6 Additional sources consulted for the fresh-eyes revision

The additional references below support specific corrections or design motivations. The educational findings are bounded to their studied populations and tasks; the site designs inspired by them remain proposals to test. The original German facsimiles were revisited at the critical entropy, field-transformation, light-complex, electron-dynamics, and mass–energy passages, using page images where parsed mathematics was insufficient. This is targeted source checking, not a newly completed scholarly edition of all four papers.

[R-01]: https://ntrs.nasa.gov/citations/19690054849
[R-02]: https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=905460
[R-03]: https://www.nature.com/articles/227270a0
[ED-01]: https://journals.sagepub.com/doi/10.1111/j.0956-7976.2004.00737.x
[ED-02]: https://www.tandfonline.com/doi/abs/10.1207/s1532690xci2202_1
[ED-03]: https://onlinelibrary.wiley.com/doi/10.1207/s15516709cog1302_1
[ED-04]: https://doi.org/10.1111/j.1467-9280.2006.01693.x
[ED-05]: https://doi.org/10.1073/pnas.1821936116
[AX-01]: https://www.w3.org/WAI/WCAG2/supplemental/objectives/o3-clear-content/
[AX-02]: https://www.w3.org/WAI/ARIA/apg/patterns/slider/
[AX-03]: https://phet.colorado.edu/en/inclusive-design/accessibility-statement
[T-10]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER
[T-11]: https://react.dev/reference/react/useSyncExternalStore

| ID | Source | Specific support and boundary |
|---|---|---|
| [R-01] | W. E. Lamb Jr. and M. O. Scully, *The Photoelectric Effect Without Photons* (1969), NASA bibliographic/abstract record | Later semiclassical treatment cautions against claiming that the photoelectric relation alone uniquely establishes fully quantized light; not a 1904 premise |
| [R-02] | A. J. Berglund, *Statistics of Camera-Based Single-Particle Tracking*, Physical Review E 82, 011917 (2010), NIST-hosted manuscript | Explicit covariance of camera-averaged displacement with localization errors and motion blur; does not validate arbitrary real tracks or the website's inference implementation |
| [R-03] | J. C. Hafele, *Relativistic Behaviour of Moving Terrestrial Clocks*, Nature 227, 270–271 (1970) | Gravitational and kinematic effects in terrestrial clock comparisons; source's equator/pole remark cannot be used as a complete real-Earth prediction |
| [ED-01] | D. Klahr and M. Nigam, *The Equivalence of Learning Paths in Early Science Instruction*, Psychological Science 15 (2004) | Study of direct/discovery instruction and control-of-variables learning in children; motivates not forcing unsupported discovery, not a universal adult-learning result |
| [ED-02] | D. L. Schwartz and T. Martin, *Inventing to Prepare for Future Learning: The Hidden Efficiency of Encouraging Original Student Production in Statistics Instruction*, Cognition and Instruction 22 (2004) | Study of invention activities and subsequent learning in statistics; motivates carefully supported exploration, not unguided discovery as a universal rule |
| [ED-03] | M. T. H. Chi and colleagues, *Self-Explanations: How Students Study and Use Examples in Learning to Solve Problems*, Cognitive Science 13 (1989) | Observed differences in worked-example self-explanation; motivation for testing explain-back activities, not automated free-text grading |
| [ED-04] | H. L. Roediger III and J. D. Karpicke, *Test-Enhanced Learning: Taking Memory Tests Improves Long-Term Retention*, Psychological Science 17 (2006) | Retrieval and delayed retention in prose-learning experiments; optional recall activities require their own evaluation here |
| [ED-05] | L. Deslauriers and colleagues, *Measuring Actual Learning Versus Feeling of Learning in Response to Being Actively Engaged in the Classroom*, PNAS 116 (2019) | Distinguishes perceived from measured learning in the studied physics instruction; not a measured effect for this website |
| [AX-01] | W3C WAI supplemental cognitive-accessibility guidance | Clear language and alternatives to numerical demands; explicitly supplemental, not a substitute for WCAG testing |
| [AX-02] | W3C WAI-ARIA Authoring Practices, Slider Pattern | Keyboard/semantic expectations and warning about touch-assistive input; actual-device testing remains required |
| [AX-03] | PhET inclusive-design accessibility statement | A primary design precedent for accessible scientific interactions, descriptions, and alternative input; no claim of automatic transfer of effectiveness |
| [T-10] | MDN, `Number.MAX_SAFE_INTEGER` | The safe-integer boundary motivating exact 64-bit identity transport |
| [T-11] | React, `useSyncExternalStore` | Immutable/cached snapshots and server-snapshot requirements; the proposed instance controller is not yet implemented |

The added mathematical checks use independent local symbolic manipulations and high-precision calculations. Their passing result does not close the plan's source-review, numerical-owner, browser, accessibility, or learner-testing obligations. Those remain concrete implementation deliverables.
