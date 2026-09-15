# COMPREHENSIVE PLAN FOR ANNUS MIRABILIS (annus-mirabilis.com)

**Working Name:** Annus Mirabilis (`annus-mirabilis.com`)
**Public Hostname:** `annus-mirabilis.com` (Cloudflare registrar and DNS; Next.js 15 App Router on Vercel via the verified prebuilt workflow)
**Open Source Repository:** `github.com/Dicklesworthstone/annus-mirabilis.com` (to be created)
**License:** MIT License (with OpenAI/Anthropic Rider), matching `classic-patents.com`
**Sibling Project:** `classic-patents.com` (architecture donor; the Bern patent office is the historical bridge)
**Document Status:** Version 1.0 (Master Architecture and Editorial Blueprint)
**Prepared:** 2026-09-14

---

## 0. How to read this document

This is the single source of truth for the new site in the same sense that
`COMPREHENSIVE_PLAN_FOR_CLASSIC_PATENTS.md` is for the patent museum. It is
written for the people and agents who will build it, and it inherits the
Classic Patents engineering doctrine wholesale (dual-projection parity, never
dumb down, visuals are instruments not decoration, kernels own the law,
honest WASM labeling, deterministic replay, no theater metrics, no file
deletion without written permission, App Router only, cloud OCR only).
Where the doctrine needs to change because a physics paper is not a patent,
this document says so explicitly in §3 and §11.

Sections 1 through 6 define the product. Sections 7 through 9 are the
intellectual core: the paper-by-paper physics inventory and the "you could
have found this in 1904" discovery paths. Sections 10 through 16 are the
engineering spec. Sections 17 through 20 are execution, risks, and
appendices.

---

## 1. Executive Summary and Mission

### 1.1 The corpus

In 1905, working six days a week as a technical expert (third class) at the
Swiss Federal Office for Intellectual Property in Bern, the 26-year-old
Albert Einstein sent four papers to *Annalen der Physik*:

| # | German title (as printed) | Working English title | Annalen citation | Received | Published |
|---|---|---|---|---|---|
| 1 | *Über einen die Erzeugung und Verwandlung des Lichtes betreffenden heuristischen Gesichtspunkt* | On a Heuristic Point of View Concerning the Production and Transformation of Light | Ann. Phys. (4) **17**, 132–148 | 18 Mar 1905 | 9 Jun 1905 |
| 2 | *Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in ruhenden Flüssigkeiten suspendierten Teilchen* | On the Motion of Small Particles Suspended in Liquids at Rest, as Required by the Molecular-Kinetic Theory of Heat | Ann. Phys. (4) **17**, 549–560 | 11 May 1905 | 18 Jul 1905 |
| 3 | *Zur Elektrodynamik bewegter Körper* | On the Electrodynamics of Moving Bodies | Ann. Phys. (4) **17**, 891–921 | 30 Jun 1905 | 26 Sep 1905 |
| 4 | *Ist die Trägheit eines Körpers von seinem Energieinhalt abhängig?* | Does the Inertia of a Body Depend on Its Energy Content? | Ann. Phys. (4) **18**, 639–641 | 27 Sep 1905 | 21 Nov 1905 |

A fifth document belongs to the same year and is handled as a **companion
record** (see §3.5): the doctoral dissertation *Eine neue Bestimmung der
Moleküldimensionen* (A New Determination of Molecular Dimensions), dated
30 April 1905, submitted to the University of Zurich on 20 July 1905 (degree
awarded January 1906), published in
Ann. Phys. (4) **19**, 289–306 (1906), with Einstein's own correction in
Ann. Phys. (4) **34**, 591–592 (1911). It shares its mathematics with paper 2
and its Avogadro-number thread with paper 1, and it contains the single best
"Einstein made an arithmetic mistake and here is how it was caught" story in
the whole corpus.

Together the papers introduced light quanta and the photoelectric equation,
predicted and quantified Brownian motion as a way to count atoms, rebuilt
the kinematics of space and time from two postulates, and derived the
equivalence of mass and energy. Sixty-three pages of the journal in all
(17, 12, 31, and 3).

### 1.2 The problem the site solves

These are among the most famous documents in science and almost nobody has
read them. The barriers are specific:

1. **Language and access.** The originals are in German, in a journal that
   is now behind a publisher paywall. The standard English translations are
   either a century old (Perrett and Jeffery 1923, Cowper 1926), in a
   university-press edition that is not freely reusable (Beck 1989), or
   scattered across journal articles (Arons and Peppard 1965). None of them
   sits next to the German text, sentence by sentence.
2. **Notation.** Einstein writes the speed of light as $V$ (in papers 3 and
   4; paper 1 uses $L$ for it), emitted energy as $L$ (paper 4),
   viscosity as $k$, particle radius as $P$, uses $R/N$ where we write
   $k_B$, and never writes the symbol $h$ (he writes $R\beta/N$). A modern
   reader with a physics degree stumbles; a programmer or physician gives
   up on page one.
3. **Missing scaffolding.** The papers assume the 1904 physics curriculum:
   kinetic theory, entropy, Maxwell's equations, Wien's law, Boltzmann's
   principle, Stokes drag, van 't Hoff osmotic pressure, Lorentz's
   electron theory. The papers are short because that scaffolding is
   assumed, not because the ideas are simple.
4. **Static equations.** A reader cannot turn the dial on $T$ in Wien's
   law, cannot watch $\langle x^2\rangle$ grow linearly with $t$, cannot
   slide $v$ toward $c$ and watch simultaneity slip. Every result in these
   papers is a relationship between quantities, and relationships are
   learned by moving one thing and watching another.
5. **Hindsight.** Most popular accounts explain the *results*. They do not
   put the reader in 1904 with the same facts Einstein had and ask what a
   careful person could have done with them. That reconstruction is the
   most powerful teaching device available and it is almost never done
   honestly.

### 1.3 The solution: Annus Mirabilis

A single-purpose, open-source, museum-grade reading and simulation
environment for the 1905 papers, built on the Classic Patents architecture:

1. **Pinned facsimiles and reviewed German ledgers** of each paper from the
   *Annalen der Physik* scans, with SHA-256 provenance receipts exactly as
   the patent museum does for USPTO PDFs.
2. **A new, sentence-aligned English translation** authored for this site
   from the public-domain German text, presented as a bilingual archival
   edition with term annotations and a **notation bridge** (Einstein's 1905
   symbols beside modern ones on every equation).
3. **Tiered Plain English** for every paragraph: a one-line gloss, a
   working-reader explanation (undergraduate calculus and linear algebra),
   a from-the-ground-up explanation (every symbol, every step, for
   programmers and physicians willing to work), and a historian's margin
   (what Einstein actually wrote, what he got subtly wrong, what the later
   literature says). The reader picks the depth with a single **Depth
   Dial** and the choice persists across the site.
4. **Colorized, live equations.** Every numbered equation in the four
   papers rendered in KaTeX, dual-coded by color to a plain-English
   sentence, each variable bound to live telemetry from the instrument on
   the same page. Derivations are shown as **chains**: step, reason for the
   step, and the mathematical tool used, with the tool linked to a
   prerequisite capsule.
5. **Interactive instruments for everything.** Blackbody spectra, entropy
   of radiation, photoelectric stopping potentials, random walks that
   converge to a Gaussian, the Stokes–Einstein dial, Perrin's microscope,
   light-signal clock synchronization, the Lorentz boost as a hyperbolic
   rotation, the magnet-and-conductor field mixing, Doppler and aberration,
   the two-pulse emission bookkeeping behind $E = mc^2$, and more. Every
   instrument runs on one shared physics bus with typed SI telemetry,
   deterministic control tapes, and FrankenSim WASM where a crate owns the
   law (`fs-rand` Philox streams for Brownian trajectories, the `fs-wasm`
   heat kernel for the diffusion equation, `fs-blake3` for digests).
6. **Discovery paths ("You could have found this").** For each paper, a
   guided reconstruction that starts from the 1904 shelf of known facts,
   poses the questions in the order a careful person might have asked
   them, lets the reader choose at the forks, shows what happens on each
   branch, and lands on the paper's actual result with a numerical check
   against the world. This is the site's signature and the section that
   justifies its existence beyond a translation.
7. **Threads.** The cross-paper connective tissue: Boltzmann's principle
   in papers 1 and 2; Avogadro's number determined three separate ways in
   one year; light as the measuring instrument in papers 3 and 4; the
   §8 energy-transformation formula of paper 3 as the sole input to
   paper 4.
8. **The Bern bridge.** Einstein examined patents for a living while he
   wrote these papers. The site links to `classic-patents.com` where the
   era's machines live (Marconi 1897, Fessenden 1902, Tesla's coil, the
   Einstein–Szilárd refrigerator of 1930), and Classic Patents links back.

### 1.4 What the site is not

- Not a biography. Bern, Mileva Marić, the Olympia Academy, and the patent
  office appear only where they explain the physics or its reception.
- Not a general relativity site. The 1905 papers end at special
  relativity; where a 1905 remark is only understood with later physics
  (the equator-clock note, the longitudinal/transverse mass), the site
  says so in the historian's margin and stops.
- Not a popular-science paraphrase. The German is the source face. The
  translation is checked against it line by line. Explanations retain the
  units, the limits, and the uncertainty.

---

## 2. Inheritance from classic-patents.com

The donor repository is large (103 records, ~1,000 TypeScript modules,
~350 React components, 288 Three.js files, 14 shipped WASM packages). The new site
takes the **kernel** and leaves the **catalogue**. Do not fork the repo;
create a fresh repository and copy the modules named below, then rename.

### 2.1 What carries over unchanged (copy, rename ids)

| Donor module | Role in Annus Mirabilis |
|---|---|
| `src/components/ui/LatexRenderer.tsx`, `TextWithLatex`, `HudText` | KaTeX rendering; the same "never leave raw `$LaTeX$` visible" rule |
| `src/components/ui/ColorizedEquation.tsx`, `colorPalette.ts`, `equationValueFormatting.ts` | Dual-coded equations with live telemetry, color-blind mode, keyboard variable navigation. Extended in §10 for derivation chains and the notation bridge |
| `src/types/equation.ts` (`ColorizedEquation`, `EquationVariable`, `SentenceFragment`, `ColorVariant`) | Base equation model |
| `src/physics/usePatentPhysics.ts` → `usePaperPhysics.ts` | The shared parameter bus keyed by catalogue id |
| `src/physics/tickScheduler.ts`, `transport.ts`, `controlTape.ts`, `paramAliases.ts`, `claimConstraints.ts` → `resultConstraints.ts` | Host-fed time, deterministic tape, aliasing, result-linked probes |
| `src/physics/genericWasm.ts`, `useGenericWasmSource.ts`, `useWasmKernelSource.ts`, `wasmArtifacts` tests | Generic `fs-wasm` loader with honest `wasm` / `ts-fallback` / `unloaded` labeling |
| `src/physics/qty.ts`, `intervals.ts`, `lie.ts`, `energyLedger.ts` | Units, intervals, honest fallback naming, energy bookkeeping |
| `src/components/patents/visuals/three/ThreeStudioScene.ts`, `StudioKernelChips` | Three.js studio scaffold for the spatial instruments (spacetime diagrams, the sphere-to-ellipsoid, the photon box) |
| `src/components/patents/PhysicsTelemetryBadge*.tsx`, `SensitivitySlider.tsx`, `ControlTapeScrubber.tsx`, `ClaimConstraintToggle.tsx` | Telemetry HUD, sliders, tape scrubbing, probe toggles |
| `src/components/patents/CuratedSpecificationEdition.tsx` and `src/types/patent.ts` block/inline model | The archival edition renderer, generalized to bilingual blocks (§11) |
| `src/components/patents/PinnedPdfFacsimile.tsx`, `usePinnedPdfFacsimile.ts`, `public/pdfjs` | Facsimile viewer for the Annalen scans |
| `src/components/patents/ArchaicGlossaryModal.tsx`, `esotericPatentTerms.ts` → `notationAndTerms.ts` | Glossary, repurposed for 1905 notation and period vocabulary |
| `src/components/layout/*` (Header, Footer, ThemeToggle, SearchPalette, EraFilterBar → PaperFilterBar) | Chrome, ⌘K search, themes |
| `src/app/layout.tsx`, `globals.css`, `tailwind.config.ts`, fonts (Newsreader, Plus Jakarta Sans, JetBrains Mono) | Base typography and theme tokens; new palette added in §14 |
| `src/app/opengraph-image.tsx`, `twitter-image.tsx`, `robots.ts`, `sitemap.ts`, `error.tsx`, `global-error.tsx`, `not-found.tsx` | Metadata and error boundaries |
| `scripts/verified-production-deploy.ts`, `deployment-target.ts`, `deployment-verification.ts`, `smoke-test-deployment.ts`, `app-router-architecture.ts` | The lock-taking, gate-running, `--skip-domain`-then-alias release workflow |
| `scripts/verify-data.ts` (pattern) | Rewritten as `verify-corpus.ts` with the paper-specific invariants of §16 |
| `biome.json`, `tsconfig.json`, `vercel.json` (`git.deploymentEnabled: false`), `.vercelignore`, `bun` test isolation | Tooling |
| `AGENTS.md` | Copied and edited: same Rules 0–2, same git safety, same cloud-OCR-only rule, same "landing the plane"; the "How to add a patent" chapter becomes "How to add a paper section / instrument / discovery path" (§16.4) |

### 2.2 What is generalized (same idea, different nouns)

| Donor concept | Annus Mirabilis concept |
|---|---|
| Patent (`Patent`) | Paper (`Paper`) |
| Patent number `US 821,393` | Annalen citation `Ann. Phys. 17, 891` |
| Catalogue id `us-821393-wright-flyer` | Catalogue id `ap-17-891-electrodynamics` (`ap-<volume>-<first page>-<slug>`) |
| Claims (`PatentClaim`) with plain-English decoders | Results (`PaperResult`): the numbered equations and stated propositions, each with a decoder, a modern form, and a probe |
| Claims Decoder panel | Results Decoder panel ("What this paper actually asserts") |
| Drawings and callouts | Figures (papers 1–4 have essentially none; the site's own diagrams are labeled as editorial, never as source figures) |
| Reviewed ledger (page-marked English transcript) | Reviewed ledger (page-marked **German** transcript) |
| Archival edition (English, continuous) | Bilingual archival edition (German source face + aligned English translation face) |
| Parallel readings (one per paragraph) | Tiered readings (four per paragraph, see §6) |
| Historical context: prior art, patent wars, aftermath | Historical context: the 1904 shelf, prior and parallel work (Lorentz, Poincaré, Planck, Sutherland, Hasenöhrl), reception, confirmation, priority disputes, aftermath |
| Spec-clause weave (kernel predicates light phrases on the spec face) | Result weave: the same mechanism lights the sentence of the paper that a live instrument is currently demonstrating |
| `PATENT_PHYSICS_REGISTRY` | `PAPER_PHYSICS_REGISTRY`, one entry per **instrument** (a paper has many), plus a paper-level index |
| Coupled Teaching Labs (`/labs`) | Threads (`/threads`) and the cross-paper Avogadro lab |

### 2.3 What is dropped

- The 103-record catalogue, all per-patent editions, kernels, visuals,
  provenance receipts, PDFs, transcripts, figures, WASM packages except
  `fs-generic`, the iOS app, the wizard reports, the `.beads` history.
- Patent-specific components: `ClaimsDecoder` (replaced), `PatentLineageView`
  (replaced by Threads), `MuseumBroadsidePlaque`/`PrintBroadsideModal`
  (revisit after launch), `AudioNarrationPlayer` (revisit; sound is not a
  transducer of anything in these papers except the Doppler instrument).
- Era filters. There is one year. The filter bar becomes a paper/section/
  instrument switcher.

### 2.4 What is new

- The bilingual, sentence-aligned edition model and renderer (§11).
- The Depth Dial and tiered readings (§6).
- Prerequisite capsules and the notation bridge (§6.3, §6.4).
- Derivation chains on equations (§10).
- Discovery paths with forks (§9).
- Threads (§13).
- The 1905 timeline and the 1729–1926 confirmation arc (§13.3).
- Three small FrankenSim exports: Brownian trajectories, Philox normal
  streams, and a parameterized one-dimensional diffusion stepper (§12.4).
- The misconception ledger, tours, predict mode, show-the-code, the
  kitchen experiment, and the interlinear gloss face (§6.6–§6.11).
- Digitized historical datasets as typed, cited records (§8.6, §11).

---

## 3. The Corpus: Identity, Structure, and Editorial Boundaries

Each record below lists the facts that go in its provenance receipt, the
structure of the paper as printed, and the results that become
`PaperResult` entries. Section headings are given in English; the German
headings are stored on the edition blocks.

### 3.1 `ap-17-132-light-quanta` (Paper 1)

- **Printed title:** *Über einen die Erzeugung und Verwandlung des Lichtes betreffenden heuristischen Gesichtspunkt*
- **Author line:** von A. Einstein
- **Dated / received / published:** Bern, 17 March 1905 / 18 March 1905 / 9 June 1905
- **Citation:** Annalen der Physik, vierte Folge, Band 17, Heft 6, pp. 132–148. Wiley records this volume as vol. 322, DOI `10.1002/andp.19053220607` (verify at pinning time).
- **Length:** 17 pages, 9 numbered sections, no figures.
- **Structure as printed:**
  - Introduction (the asymmetry between a continuous field theory of light and the discrete theory of matter; the heuristic)
  - §1. On a difficulty concerning the theory of "black-body radiation" (Maxwell plus equipartition gives $\rho_\nu = \frac{R}{N}\frac{8\pi\nu^2}{L^3}T$; its integral diverges)
  - §2. On Planck's determination of the elementary quanta (from the long-wavelength limit of Planck's law, $N = 6.17\times10^{23}$)
  - §3. On the entropy of radiation
  - §4. Limiting law for the entropy of monochromatic radiation at low radiation density (Wien regime; $S - S_0 = \frac{E}{\beta\nu}\ln\frac{V}{V_0}$)
  - §5. Molecular-theoretic investigation of the dependence of the entropy of gases and dilute solutions on volume (Boltzmann's principle, $S - S_0 = \frac{R}{N}\ln W$)
  - §6. Interpretation of the expression for the volume dependence of the entropy of monochromatic radiation according to Boltzmann's principle (the light-quantum hypothesis: energy $R\beta\nu/N$ per quantum)
  - §7. On Stokes' rule (fluorescence)
  - §8. On the generation of cathode rays by illumination of solid bodies (the photoelectric equation $\Pi\varepsilon = \frac{R}{N}\beta\nu - P$; the numerical check against Lenard)
  - §9. On the ionization of gases by ultraviolet light
- **Results to decode (minimum):** the Rayleigh–Jeans form and its divergence; the Avogadro determination from Planck's law; the Wien-regime entropy of radiation; the volume-fluctuation probability $W = (V/V_0)^{NE/(R\beta\nu)}$; the light-quantum energy; Stokes' rule as an inequality; the photoelectric equation with the stopping-potential prediction (order 4 volts for the far-ultraviolet solar limit); the ionization energy bound.
- **Notation bridge entries:** $R/N \to k_B$; $R\beta/N \to h$; $\beta \to h/k_B$; $L \to c$ (this paper uses $L$ for the speed of light); $\Pi \to$ stopping potential $V_s$; $\varepsilon \to e$; $P \to$ work function $\phi$; $\rho_\nu \to u(\nu,T)$.
- **Editorial boundary:** the paper argues from Wien's law, not from Planck's law, and calls the result "heuristic". The site must not present §6 as a derivation of Planck's law or as a theory of the photon; it is an inference that radiation in the Wien regime *behaves thermodynamically as if* it were made of independent energy quanta. That restraint is Einstein's and the site keeps it.

### 3.2 `ap-17-549-brownian-motion` (Paper 2)

- **Printed title:** *Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in ruhenden Flüssigkeiten suspendierten Teilchen*
- **Dated / received / published:** Bern, May 1905 / 11 May 1905 / 18 July 1905
- **Citation:** Ann. Phys. (4) 17, Heft 8, pp. 549–560. Wiley DOI `10.1002/andp.19053220806` (verify).
- **Length:** 12 pages, 5 numbered sections, no figures.
- **Structure as printed:**
  - Introduction (it is possible that the motion to be discussed is identical with "Brownian molecular motion"; the author's data are too imprecise to say; if the motion exists, classical thermodynamics is not exactly valid at microscopic scale, and atoms become countable)
  - §1. On the osmotic pressure to be ascribed to suspended particles (van 't Hoff's law extended from dissolved molecules to visible particles)
  - §2. Osmotic pressure from the standpoint of the molecular-kinetic theory of heat (the free-energy argument; $p = \frac{RT}{N}\nu$)
  - §3. Theory of diffusion of small spheres in suspension (dynamic equilibrium between the osmotic force and Stokes drag $K = 6\pi k P v$; $D = \frac{RT}{N}\frac{1}{6\pi k P}$)
  - §4. On the irregular motion of particles suspended in a liquid and its relation to diffusion (the displacement distribution $\varphi(\Delta)$; expansion to second order; $\partial f/\partial t = D\,\partial^2 f/\partial x^2$; the Gaussian solution)
  - §5. Formula for the mean displacement of suspended particles. A new method for determining the true size of atoms ($\lambda_x = \sqrt{2Dt}$; numerical example: about $0.8\,\mu\text{m}$ in one second for particles of $1\,\mu$m diameter ($P = 0.5\,\mu$m) in water at $17^\circ$C; the closing hope that an experimenter will test it)
- **Results to decode:** van 't Hoff applied to suspensions; the osmotic pressure formula; the force balance; the diffusion coefficient (Stokes–Einstein, also Sutherland's); the diffusion equation derived from a step distribution (the first Fokker–Planck-type derivation); the Gaussian propagator; $\lambda_x = \sqrt{2Dt}$; the inversion $N = \frac{t}{\lambda_x^2}\frac{RT}{3\pi k P}$.
- **Notation bridge:** $k \to \eta$ (viscosity); $P \to a$ or $r$ (radius); $\nu \to n$ (number density); $\lambda_x \to \sqrt{\langle x^2\rangle}$; $R/N \to k_B$; $\varphi(\Delta) \to$ the transition kernel.
- **Editorial boundary:** Einstein predicts a *diffusive* mean displacement, not a velocity. He explicitly warns that the observable is not a mean velocity (the trajectory has no tangent at the resolution of a microscope). The site must resist every instrument that shows a "Brownian speed"; it shows displacement versus $\sqrt{t}$.

### 3.3 `ap-17-891-electrodynamics` (Paper 3)

- **Printed title:** *Zur Elektrodynamik bewegter Körper*
- **Dated / received / published:** Bern, June 1905 / 30 June 1905 / 26 September 1905
- **Citation:** Ann. Phys. (4) 17, Heft 10, pp. 891–921. Wiley DOI `10.1002/andp.19053221004` (confirmed 2026-09-14 against secondary bibliographic records; confirm against the Wiley landing page at pinning).
- **Length:** 31 pages, 10 numbered sections in two parts, no figures, no references, a closing acknowledgment to M. Besso.
- **Structure as printed:**
  - Introduction (the magnet and the conductor; the failed attempts to detect the Earth's motion relative to the "light medium"; the two postulates; "the introduction of a 'luminiferous ether' will prove to be superfluous")
  - I. Kinematical Part
    - §1. Definition of simultaneity (the operational definition with light signals; the synchronization convention $t_B - t_A = t'_A - t_B$)
    - §2. On the relativity of lengths and times (the moving rod measured two ways; observers moving with the rod would find its clocks unsynchronized)
    - §3. Theory of the transformation of coordinates and times from the stationary system to another system in uniform translation relative to it (the derivation: $\tau = \beta(t - vx/V^2)$, $\xi = \beta(x - vt)$, $\eta = y$, $\zeta = z$, $\beta = 1/\sqrt{1 - v^2/V^2}$)
    - §4. Physical meaning of the equations obtained in respect to moving rigid bodies and moving clocks (sphere becomes ellipsoid; moving clock loses $\tfrac{1}{2}v^2/V^2$ per second; the equator-clock remark)
    - §5. The composition of velocities ($U = (v+w)/(1 + vw/V^2)$; the group property; nothing exceeds $V$)
  - II. Electrodynamical Part
    - §6. Transformation of the Maxwell–Hertz equations for empty space. On the nature of the electromotive forces occurring in a magnetic field during motion (the field transformation; the magnet-conductor asymmetry dissolves)
    - §7. Theory of Doppler's principle and of aberration
    - §8. Transformation of the energy of light rays. Theory of the pressure of radiation exerted on perfect reflectors ("it is remarkable that the energy and the frequency of a light complex vary with the observer's state of motion according to the same law")
    - §9. Transformation of the Maxwell–Hertz equations when convection currents are taken into account
    - §10. Dynamics of the (slowly accelerated) electron (longitudinal mass $m\beta^3$, transverse mass $m\beta^2$, kinetic energy $W = mV^2(\beta - 1)$; three experimental predictions)
- **Results to decode:** the simultaneity convention; the relativity of simultaneity; the Lorentz transformation and its derivation from the postulates; length contraction; time dilation; velocity composition and the group property; the $E$/$B$ mixing rules; relativistic Doppler and aberration; the energy transformation of a light complex; radiation pressure on a moving mirror; the electron's equations of motion and kinetic energy.
- **Notation bridge:** $V \to c$; $\beta \to \gamma$ (the modern $\beta$ means $v/c$; this collision must be flagged everywhere); $(\xi,\eta,\zeta,\tau) \to (x',y',z',t')$; $(X,Y,Z) \to \mathbf{E}$; $(L,M,N) \to \mathbf{B}$; $\varphi \to$ the angle between the ray and the boost; the "light complex" $\to$ a wave packet / photon energy.
- **Editorial boundary:** §10's transverse mass $m\beta^2$ depends on Einstein's choice of force definition and was superseded (Planck 1906 gives $m\beta$ with the modern force definition). The site presents §10 as printed, marks the definitional dependence in the historian's margin, and does not "correct" the source face. Same for the equator-clock remark: as stated it ignores the gravitational potential difference that, on the rotating geoid, cancels the effect; that understanding needed general relativity. The site says exactly that and nothing more.

### 3.4 `ap-18-639-mass-energy` (Paper 4)

- **Printed title:** *Ist die Trägheit eines Körpers von seinem Energieinhalt abhängig?*
- **Dated / received / published:** Bern, September 1905 / 27 September 1905 / 21 November 1905
- **Citation:** Ann. Phys. (4) 18, Heft 13, pp. 639–641. Wiley DOI `10.1002/andp.19053231314` (a later Wiley reissue DOI `10.1002/andp.200590007` also exists; the receipt records the original).
- **Length:** 3 pages, no sections, no figures.
- **Argument as printed:** a body at rest in $(x,y,z)$ with energy $E_0$ emits two plane light waves of energy $\tfrac{1}{2}L$ each in opposite directions. In a frame moving at $v$ the same emission carries energy $L\beta$ by §8 of paper 3. Comparing the energy differences in the two frames, the kinetic energy of the body drops by $L(\beta - 1)$, which to second order is $\tfrac{1}{2}\frac{L}{V^2}v^2$. Hence the mass has dropped by $L/V^2$. The closing paragraph proposes radium salts as a test.
- **Results to decode:** the two-frame energy bookkeeping; the binomial expansion; $\Delta m = L/V^2$; the generalization "the mass of a body is a measure of its energy content"; the radium proposal.
- **Notation bridge:** $L \to E$ (emitted energy); $V \to c$; $\beta \to \gamma$; $H, E \to$ total energies in the moving and rest frames; $K \to$ kinetic energy.
- **Editorial boundary:** the argument has a known subtlety (the additive constant $C$ and the assumption that kinetic energy has its Newtonian form to the order considered; Ives 1952 called it circular, Stachel and Torretti 1982 answered). The historian's margin presents both and Einstein's later derivations (1906 center-of-mass argument with a light-carrying box; 1935 elementary derivation; 1946). The site does not pretend the 1905 argument is the last word, and does not pretend it is wrong.

### 3.5 `ap-19-289-molecular-dimensions` (Companion: the dissertation)

- **Printed title:** *Eine neue Bestimmung der Moleküldimensionen* (Inaugural-Dissertation, Zurich, 1905; printed by K. J. Wyss, Bern; then Ann. Phys. (4) 19, 289–306, 1906; correction Ann. Phys. (4) 34, 591–592, 1911).
- **Why it is here:** it supplies the viscosity relation $\eta^* = \eta(1 + \varphi)$ for a dilute suspension (corrected in 1911 to $\eta(1 + 2.5\varphi)$), combines it with the diffusion coefficient of paper 2 applied to sugar in water, and extracts both the molecular radius and $N$. Einstein's 1905 value was $N \approx 2.1\times10^{23}$; after Jacques Bancelin's 1910 viscosity measurements in Perrin's laboratory disagreed, Einstein and his assistant Ludwig Hopf found the algebra error and the corrected 1911 value was $N \approx 6.6\times10^{23}$. For decades this was Einstein's most-cited paper because the viscosity relation is used in colloid science.
- **Status in the catalogue:** companion record. It is not one of "the four", it is not on the hero, and it is fully built only in Phase 5. But the Threads page and the Avogadro lab depend on it from the start (§13.2).

### 3.6 The count: four or five

Einstein's own letter to Conrad Habicht in May 1905 promises four papers:
light quanta, the molecular-dimensions dissertation, Brownian motion, and
the electrodynamics draft. Mass–energy was not yet written. The modern
canon of "the four 1905 papers" swaps the dissertation for $E = mc^2$.
The site names this explicitly on the About page and in the timeline. The
hero shows four papers; the catalogue shows five records with the fifth
labeled "companion".

### 3.7 Required historian's-margin entries

These are not optional color. Each is a `whatEinsteinGotWrongOrLeftOpen`,
`disputes`, or `sideNotes` record with a primary source, and a paper is not
done until its list is present.

- **Paper 1.** (a) The photoelectric equation is not, by itself, proof that
  light is made of photons: a semiclassical theory with quantized matter
  and a classical field reproduces it (Lamb and Scully 1969); the decisive
  evidence came with Compton scattering (1923) and, for single photons,
  photon anti-bunching (Kimble, Dagenais, and Mandel 1977). Textbooks that
  say "the photoelectric effect proves photons" are repeating a
  simplification, and the site does not. (b) Millikan verified the equation
  to better than one percent (1916) while rejecting the light-quantum
  hypothesis it came from. (c) Planck's 1913 recommendation of Einstein to
  the Prussian Academy excuses the light quanta as an overreach
  (paraphrased). (d) Einstein's own lifelong unease, in his 1951 letter to
  Besso, that fifty years of brooding had brought him no closer to
  answering what light quanta are (paraphrased). (e) The §1 derivation of
  the equipartition spectrum is independent of, and contemporary with,
  Jeans's 1905 correction of Rayleigh's constant.
- **Paper 2.** (a) Sutherland's independent derivation and its history
  (Dunedin 1904, misprinted proceedings, *Phil. Mag.* June 1905). (b)
  Smoluchowski's independent kinetic derivation (1906) with a different
  numerical factor. (c) Bachelier's 1900 random-walk mathematics for stock
  prices. (d) Einstein's assumption that the interval $\tau$ is long
  compared with the momentum relaxation time: for shorter intervals the
  motion is ballistic, $\langle x^2\rangle \propto t^2$, and that regime
  was first measured only in 2010 (Li et al., *Science*) and 2011 (Huang et
  al., *Nature Physics*). (e) The 1911 viscosity correction and Bancelin's
  measurement. (f) Perrin's 1926 Nobel Prize.
- **Paper 3.** (a) The paper has no references and closes by thanking
  Besso. (b) The 1905 manuscript was discarded; Einstein wrote out a copy
  by hand in 1943 for a war-bond auction, and that copy is in the Library
  of Congress. (c) Einstein's later statement to Shankland that Fizeau's
  experiment and stellar aberration weighed more with him than
  Michelson–Morley. (d) Lorentz 1904 and Poincaré 1905 (the 5 June note and
  the Palermo paper), stated from what they wrote, with the difference in
  interpretation and the ether. (e) The transverse mass and Planck 1906.
  (f) The equator-clock remark and the geoid. (g) The footnote conceding
  the imprecision of the rigid-body concept. (h) The notation $V$ and
  $\beta$.
- **Paper 4.** (a) The formula $E = mc^2$ does not appear; the paper says
  the mass falls by $L/V^2$, and the familiar form belongs to 1907 and
  later. (b) The additive constant and the Newtonian kinetic-energy
  assumption (Ives 1952; Stachel and Torretti 1982). (c) Einstein's 1906
  paper credits Poincaré 1900 for the formal content of the
  center-of-mass argument. (d) Hasenöhrl 1904–1905 and the later priority
  claims, each with what was actually written. (e) The radium proposal
  and the first quantitative nuclear check (Cockcroft and Walton 1932;
  Bainbridge 1933).

---

## 4. Sources, Rights, and Provenance

### 4.1 Rights basis

- The German texts were published in 1905 and 1906. Einstein died in 1955.
  In the United States, works published before 1929 are public domain; in
  life-plus-70 jurisdictions the author's term has expired. The German
  source text may be transcribed, reproduced, and translated freely.
- **Scans are not the text.** A particular scan file may carry the terms of
  the scanning institution. The provenance receipt must record where each
  pinned PDF came from and what its stated terms are. Prefer library scans
  that state open terms; record the URL, retrieval date, and SHA-256; do
  not pin publisher PDFs that are served under a subscription license.
- **Existing English translations are not free to reuse.** The Perrett and
  Jeffery translation (Methuen, 1923; Dover reprint) and the A. D. Cowper
  translation of the Brownian papers (Methuen, 1926, ed. R. Fürth) are
  public domain in the United States by publication date; their status in
  other jurisdictions depends on the translators' death dates and the site
  is served worldwide. The Beck translations (Princeton, 1989) and the
  Arons–Peppard translation of paper 1 (Am. J. Phys., 1965) are in
  copyright. **Policy: the site publishes its own translation, made from
  the German, and cites the historical translations as reference evidence
  in the receipt only.** This is not a legal opinion; it is the
  conservative editorial choice and it produces a better product because a
  sentence-aligned translation must be built from the German anyway.
- Quotations from secondary literature (Pais, Stachel, Galison, Rigden,
  Renn) are limited to short attributed phrases; everything else is
  paraphrased with citation. The site's own prose is MIT-licensed like the
  code.
- **Letters, photographs, name and likeness.** The Habicht letter and other
  1905 correspondence are paraphrased, not reproduced; the CPAE
  transcriptions and translations are Princeton's editorial work. The site
  uses no photographs of Einstein unless a specific image has cleared
  terms recorded in the receipt. The Hebrew University of Jerusalem asserts
  rights in the Einstein name and likeness for commercial and branding
  uses; the domain and the site's branding deliberately use the year, not
  the name, and no logo, merchandise, or product uses his name or face.

### 4.2 Pinned facsimile sources (to be resolved in Phase 1)

Candidate sources for each paper, in order of preference. The receipt
records which one was used and why.

1. A library or archive scan of the bound *Annalen der Physik* volumes 17
   and 18 (1905) and 19 (1906) with stated open terms (Internet Archive,
   HathiTrust full view, a university digital library, or the Einstein
   Archives Online). Whole-issue scans are preferred over article
   extracts because they show the running heads, page numbers, and the
   editorial context (the volume's other authors), which the timeline uses.
2. The Princeton *Collected Papers of Albert Einstein*, Vol. 2, documents
   14, 15, 16, 23, 24 (open online reading at einsteinpapers.press.princeton.edu)
   as a **comparison edition** for the German transcription, not as the
   pinned facsimile. Its editorial notes are cited in the historian's margin.
3. German Wikisource transcriptions as a second comparison source for the
   ledger. Never as the source face.

The facsimile is immutable once pinned. The catalogue id, PDF filename,
ledger filename, edition file, and provenance receipt must all match, as in
Classic Patents.

### 4.3 Provenance receipt (`docs/provenance/<id>.md`)

Same template as `docs/provenance/us-821393-wright-flyer.md`, with these
fields replacing the patent-specific ones:

- Catalogue id, printed title, author line, dateline ("Bern, ..."), received
  date, published date, journal, series, volume, issue, pages, Wiley DOI as
  currently resolvable.
- Scan source URL, scan rights statement, retrieval date, SHA-256, page
  count, and a page map (PDF page → Annalen page → section boundaries and
  numbered equations on that page).
- Comparison editions consulted for the ledger (Princeton CPAE Vol. 2
  document number; Wikisource revision id).
- Translation credits: translator (human or model, named), review dates,
  and the reviewer who checked each section against the German.
- Editorial boundaries: which file is the source face, which is the
  ledger, which is the English face, which files are research evidence
  only.

### 4.4 The German ledger (cloud OCR only)

The Classic Patents rule is inherited without change: **no OCR on the
development host.** German-language recognition of 1905 typesetting
(as the facsimile shows: roman body, italic mathematics, Greek, fractions,
and letter-spaced emphasis) is delegated to bounded, checkpointed cloud jobs with page ranges,
then every line is corrected by hand against the facsimile. Mathematics is
retyped as LaTeX by the editor, never accepted from OCR. The ledger file is
`public/papers/transcripts/<id>-reviewed.txt` with the same
`--- REVIEWED TRANSCRIPTION PAGE k OF N ---` markers and page anchors.

### 4.5 The translation workflow

1. **Segment** the reviewed German ledger into paragraphs and sentences.
   Sentence ids are stable (`s3-p2-s1`: section, paragraph, sentence; paper 4
   has no sections and uses `s0`) and become the alignment keys.
2. **Draft** the English sentence by sentence. Preserve Einstein's sentence
   boundaries where English allows it; where a German sentence must be
   split, both English sentences carry the same source id with a suffix.
3. **Notation is not translated.** Every symbol is kept as printed on the
   source face and on the English face; the notation bridge (§6.4) is a
   separate annotation layer. Never silently replace $V$ with $c$ inside
   the translation.
4. **Review** against the German with the comparison editions open. Record
   disagreements with the historical translations in the receipt when they
   are substantive (the site may be right and Perrett–Jeffery wrong, or the
   reverse; either is worth a note).
5. **Term annotations** for period words and phrases: *Lichtkomplex*,
   *molekularkinetische Theorie der Wärme*, *ruhendes System*,
   *Elementarquantum*, *Kathodenstrahlen*, *Lichtäther*, *Beobachter*.
6. The English face is a `manual-react-edition` block list aligned block
   for block with the German edition, validated by a test that walks both
   block arrays and checks the alignment map (§16.2).

---

## 5. The Reading Engine (from Diptych to Polyptych)

A patent page has two faces. A paper page has more, because the source is
in another language and the explanation has depth levels. The reading
engine keeps the Classic Patents `view` query parameter model
(`?view=...`) so every face is a deep link and the browser back button
works.

### 5.1 Faces

| `view` | Face | Content |
|---|---|---|
| `german` | Source face | The bilingual archival edition showing German only; term annotations; numbered equations as printed; page-locator-free continuous reading |
| `english` | Translation face | The aligned English; hovering or focusing a sentence highlights its German source on the other face |
| `gloss` | Interlinear face | Each German sentence with a word-by-word English gloss beneath it (§6.11); paper 4 and the key sections of the others at launch |
| `parallel` | Bilingual face | German and English side by side (or stacked at narrow widths), sentence-aligned, with the tiered reading for the current paragraph in a third column that follows scroll |
| `reading` | Plain English face (default for first-time visitors) | The paper section by section in the site's own voice at the Depth Dial's level, with colorized equations, derivation chains, and the instrument for that section embedded in place |
| `results` | Results Decoder | The paper's numbered results as cards: as printed, in modern notation, in one sentence, with the live probe and the "where this is used later" links |
| `instruments` | Instrument face | All of the paper's interactive instruments on one page, sharing the physics bus, with the control tape scrubber |
| `discover` | Discovery path | The "you could have found this" reconstruction (§9), a guided sequence with forks; it links back into `reading` and `instruments` at every step. Its canonical URL is the route `/papers/[id]/discover`; `?view=discover` redirects there so each path has exactly one URL |
| `facsimile` | Pinned scan | The Annalen pages via pdf.js with a page map to sections and equations |
| `split` | Split view | Any two faces side by side; the default split is `parallel` left and `reading` right |

The header shows the paper's identity block (title in German and English,
citation, received and published dates, page count, the two or three
sentence summary), the Depth Dial, the face switcher, and quick actions
(download the facsimile, open the receipt, share the current face and
anchor).

### 5.2 Anchors

Every section, paragraph, sentence, equation, result, and instrument has a
stable anchor id derived from the printed structure: `#s3` (section),
`#s3-p2` (paragraph), `#s3-p2-s1` (sentence), `#eq-7` (the paper's own
equation numbering where it exists; unnumbered display equations get
`#eq-s3-d2`), `#result-lorentz-transformation`, `#instrument-clock-sync`.
Anchors are identical across faces, so switching faces keeps the reader's
place.

### 5.3 Result weave

The Classic Patents spec-clause weave lights phrases on the specification
face when the kernel satisfies a predicate. Here the same mechanism lights
the German and English sentences that state what an instrument is
currently demonstrating. Examples: dragging the boost velocity past 0.5$c$
lights the §4 sentence about the clock running slow; dropping the radiation
density into the Wien regime lights the §4 limiting-law sentence of
paper 1; making the two Brownian histograms overlap lights the §5 formula
for $\lambda_x$.

---

## 6. The Depth Dial and the Pedagogical Contract

### 6.1 Audience personas (used in every editorial review)

- **The programmer.** Comfortable with loops, arrays, probability as
  simulation, and matrices as transformations. Uncomfortable with
  partial derivatives used casually and with "obviously". Wants to see the
  algorithm. The Brownian random walk and the Lorentz boost as a 2×2
  matrix are written for this reader first.
- **The physician.** Comfortable with diffusion (Fick), osmosis, exponential
  decay, dose-response curves, and log scales. Uncomfortable with vector
  fields and with unexplained constants. Paper 2 is a gift for this
  reader: van 't Hoff's osmotic pressure is medical-school material and
  Einstein's §1 begins exactly there.
- **The engineer.** Wants units, orders of magnitude, and the numerical
  check. Gets impatient with philosophy of simultaneity until the clock
  synchronization instrument makes it concrete.
- **The student.** Has a physics or math course in progress and wants the
  derivation to be complete, with no skipped steps.
- **The historian or general reader.** Wants to know what was known, what
  was new, who else was close, how it was received, and what Einstein got
  wrong. Reads the historian's margin first.

### 6.2 The four levels

The Depth Dial is a single global control with four positions. Every
paragraph of the paper has a reading at each level; every equation has an
explanation at each level; every instrument has a caption at each level.

**Persistence and rendering.** The site is statically generated, so the
dial is not a server-read cookie (that would make every page dynamic).
Instead all four levels are rendered into the static HTML of every
paragraph, with L1 visible and the others carrying `data-depth` and
`hidden`; a two-line inline script in `<head>` reads `localStorage` and the
`?depth=` parameter and sets `data-depth` on `<html>` before first paint,
the same trick the theme toggle uses to avoid a flash; CSS shows the
matching level. Consequences: the dial works with JavaScript disabled (L1),
search engines index all four levels, switching depth is instant and
offline, and a permalink with `?depth=2` opens at that depth
(`rel=canonical` omits the parameter). Cost: the reading face's HTML grows
roughly three to four times; the budget is 250 kB gzipped for the largest
paper's reading face, checked in CI, and if a paper exceeds it the L2 and
L3 readings for a section are fetched from a static JSON fragment on first
expansion.

| Level | Name | Assumes | Style |
|---|---|---|---|
| L0 | **In one breath** | Nothing | One or two sentences. What this paragraph says and why it is here. |
| L1 | **Working reader** (default) | Single-variable and multivariable calculus, basic linear algebra, basic probability, the ideal gas law | The site's main explanatory voice. Equations are shown and explained; standard results (Taylor expansion, Gaussian integral, Maxwell's equations in words) are used with a link to their capsule. |
| L2 | **From the ground up** | High-school algebra and the willingness to read slowly | Every symbol is defined the first time it appears in the section. Every step of every derivation is shown, including the algebra. Every "it follows that" is expanded. Analogies come *after* the mechanism, never instead of it. Where a tool is needed (a partial derivative, an integral of $e^{-x^2}$, a determinant), the capsule is embedded inline rather than linked. |
| L3 | **Historian's margin** | L1 | What Einstein actually wrote and in what notation; where the argument is heuristic; where later physics changed the reading; who had the same result earlier or at the same time; what the primary literature says. Cited. |

Rules:

- L2 is the hardest level to write and the one the user's brief singles
  out. The test of an L2 reading is that a physician who has not used a
  derivative since 1998 can follow it with effort and without shame.
- L0 is not a teaser. It must be true and complete at its resolution.
- Levels do not contradict each other. L0 is a compression of L1; L2 is an
  expansion of L1; L3 annotates L1. An editor changing one must reread the
  others.
- The reader can expand a single paragraph to a deeper level without
  changing the global dial ("show me L2 for this one").

### 6.3 Prerequisite capsules (`/toolkit`)

Self-contained mini-lessons, each with a live instrument, that the readings
link to and that L2 embeds inline. First release set:

1. Functions of several variables and the partial derivative (a surface
   and two slopes)
2. The Taylor expansion and why "to second order" is a decision, not a
   truth (with the binomial series $(1-x)^{-1/2}$ used in papers 3 and 4)
3. The Gaussian, its integral, and its width (used in paper 2)
4. Random walks and why spread grows as $\sqrt{t}$ (used in paper 2)
5. Counting arrangements: $W$, $\ln W$, and why entropy is a logarithm
   (used in paper 1)
6. The ideal gas law and osmotic pressure (used in papers 1 and 2)
7. Viscosity and Stokes drag (used in paper 2 and the dissertation)
8. Waves: frequency, wavelength, phase, the Doppler effect for sound
   (used in paper 3; the wave vocabulary of paper 1)
9. Maxwell's equations in words and pictures (used in paper 3)
10. Coordinates, linear maps, matrices, determinants, eigenvectors (used
    in paper 3)
11. Hyperbolic functions and rapidity (used in paper 3)
12. Momentum and energy of light in classical electromagnetism
    (used in papers 3 and 4)
13. The 1905 unit system and how to convert Einstein's numbers to SI
14. How to read a German physics sentence (word order, the Konjunktiv in
    hypotheses, *sei*, *es gilt*, *man erhält*)
15. Entropy and temperature: why $dS = dQ/T$, why $\partial S/\partial E = 1/T$,
    and why that lets paper 1 get entropy from a spectrum (used in paper 1)
16. Orders of magnitude: a table of sizes, speeds, energies, and counts the
    papers rely on (a water molecule vs a $1\,\mu$m grain; $v/c$ for a bullet,
    a jet, the Earth's orbit, Kaufmann's electrons; $h\nu$ for red, green,
    ultraviolet; how many molecular kicks per second a grain receives)

Each capsule is a `Capsule` record (§11) with its own tiered readings and
instrument, so it uses the same renderer and tests.

### 6.4 The notation bridge

A persistent, dismissible strip above every equation and a full table at
`/toolkit/notation`. For each paper: the printed symbol, its meaning, the
modern symbol, and the collision warnings. The two dangerous collisions
are called out in red on first use: Einstein's $\beta$ is the modern
$\gamma$ (and the modern $\beta = v/c$ appears nowhere in these papers),
and Einstein's $k$ in paper 2 is viscosity, not Boltzmann's constant
(which he writes $R/N$).

Rendering rule: the source face and the translation face show the printed
notation. The reading face shows the printed notation by default with a
toggle to modern notation; the toggle re-renders every equation on the page
through a symbol map and updates the colorized sentence, so a reader can
learn to read Einstein's own symbols and then switch.

### 6.5 Editorial voice

Inherited from the Classic Patents de-slopify rule and tightened:

- No em dashes. No "seminal", "pivotal", "groundbreaking", "revolutionary"
  (except when quoting Einstein's "sehr revolutionär" to Habicht, with
  attribution). No "it's not X, it's Y". No "unlock". No listicles of vibes.
- Prefer Einstein's nouns. Prefer dates, page numbers, equation numbers,
  units, and named people.
- Never say "obviously", "clearly", or "it is easy to see". If it were, the
  reader would not be at L2.
- Analogies after mechanisms. A programmer's loop is a mechanism; "imagine
  a drunk sailor" is an analogy.
- Every numerical claim traces to the paper, to a named experiment, or to
  a live kernel. Einstein's own numbers ($0.8\,\mu$m, $4.3$ V,
  $6.17\times10^{23}$, $2.1\times10^{23}$ then $6.6\times10^{23}$) are
  regression tests, not decoration.

### 6.6 The misconception ledger

The fastest way to help someone understand a famous result is to name the
wrong version they already carry. Each paper ships a typed
`Misconception` list (§11), surfaced inline as a "common wrong turn"
callout at the anchor where it usually arises, and collected on
`/papers/[id]?view=results` under the result it concerns. Each entry has
the tempting claim in the words people actually use, why it is tempting,
what is true at every depth level, the instrument that shows it, and
sources. The launch ledger, at minimum:

- Paper 1: "Planck discovered the photon in 1900" (he introduced energy
  elements for oscillators and resisted light quanta for years); "the
  photoelectric effect proves light is particles" (see §3.7); "brighter
  light means faster electrons"; "Einstein derived Planck's law here" (he
  argued from Wien's law and called it heuristic); "the quantum energy is
  $h\nu$ because of $E = mc^2$" (unrelated).
- Paper 2: "Brownian motion is caused by single molecular hits" (Nägeli's
  objection; it is the imbalance of $10^{20}$ kicks per second); "the
  particles have a speed you can measure" (§3.2's editorial boundary);
  "Einstein explained an experiment" (he predicted one; he was not sure
  the observed motion was the same phenomenon); "diffusion is a different
  thing from random walking" (they are one equation); "larger particles
  jiggle more because they get hit more" (they jiggle less).
- Paper 3: "length contraction is an optical illusion" and its opposite
  "the rod is physically squashed" (it is a statement about measurements
  in two frames, and the instrument shows both); "time dilation is
  symmetric, so it cannot be real"; "the light-speed limit is only about
  needing infinite energy" (the paper gives two independent reasons:
  velocity composition never reaches $V$ in §5, and the kinetic energy
  grows without bound in §10); "Michelson–Morley made Einstein do it"
  (§3.7); "mass increases with speed" (a language the 1905 paper uses,
  with two different velocity-dependent masses, that modern physics
  replaces with invariant mass plus energy and momentum; the instrument
  shows both languages side by side); "Einstein's $\beta$ is $v/c$".
- Paper 4: "$E = mc^2$ is about nuclear bombs" (the 1905 argument concerns
  any body that radiates; a candle flame loses mass); "mass converts into
  energy" (the mass of a closed system is conserved; the body's rest mass
  falls because energy left it); "the formula is in the paper" (it is
  not); "Einstein was first" (the site presents the priority record).

### 6.7 Tours: three attention budgets

Most visitors will not read a 31-page paper. The same content is offered
through three curated, ordered anchor lists, each with progress kept in
`localStorage` (no accounts):

- **Fifteen minutes.** One paper: the L0 readings of its introduction and
  key result, four instruments in predict mode (§6.8), and the L0 line of
  the discovery path's move. Entirely without equations, and still true.
- **One evening.** One paper at L1, all instruments, the front-door
  discovery path, the misconception ledger, the historian's margin for the
  editorial boundaries of §3.
- **The full course.** All four papers and the companion, both discovery
  doors, every capsule, the Threads, the exercises with instrumented
  answers. A printable syllabus lists prerequisites per session using the
  capsule graph.

The "no-math tour" is a first-class deliverable, not a fallback: a reader
who never opens an equation must still leave knowing what each paper
claimed, why it was hard, and what it changed.

### 6.8 Predict, then slide

Every instrument has a **predict mode**, on by default for first-time
visitors. Before the reader's first drag, the response plot is hidden and
the reader is asked to choose or sketch what will happen (three candidate
curves, or a freehand line on the empty axes). On release, the kernel
draws the real curve over the prediction and the two are kept side by
side. The prediction is recorded on the control tape as a `prediction`
event, so a shared permalink carries it and a teacher can see what a
class expected. Rationale: predict–observe–explain confronts the
misconception before the instrument can paper over it; a slider that
answers before the reader asked teaches little.

### 6.9 Show me the code

Every instrument and every derivation chain has a "Show the code"
disclosure that renders the kernel's actual TypeScript, extracted at build
time from `src/physics/kernels/` with the function's source hash pinned to
the instrument. Identifiers that correspond to equation variables are
colorized with the same colors as the equation and the sentence, so
`gamma` in the code, $\gamma$ in the formula, and "the stretch factor" in
the sentence share a color. A test asserts that every
`EquationVariable.telemetryKey` appears as an identifier in the kernel it
is bound to. For programmers the code is the derivation; for everyone else
it is proof that the number on the screen came from a function anyone can
read, and the repository link is one click away.

### 6.10 Count atoms in your kitchen

Paper 2 is the one 1905 result a reader can reproduce at home, and the
site provides the protocol and the instrument to do it:

- A real compound microscope with a 40× objective (a student microscope,
  with a phone or USB eyepiece camera to record) and a slide and cover
  slip. Cheap "USB microscopes" that are really macro cameras do not
  resolve micron-scale particles, and the protocol says so. Whole milk
  diluted in water works: the fat globules are a few micrometers across
  and their Brownian motion is visible at 400×. Diluted ink or toner
  particles also work. No blood, no chemicals.
- Record about one minute of video. In the Perrin's Microscope instrument,
  load the video locally (nothing is uploaded; frames are read with
  `HTMLVideoElement` and a canvas), calibrate the scale against a stage micrometer if one exists, or
  against a known object such as a human hair (roughly 50 to 100 $\mu$m
  wide, which is why the instrument treats it as a coarse calibration and
  carries that uncertainty through), then click the same particle once
  per second.
- The instrument computes $\langle x^2\rangle$, propagates the
  uncertainties honestly (particle radius is the dominant one for
  polydisperse milk; the instrument asks the reader to estimate it from the
  image and shows how $N$ moves with it), and reports an estimate of $N$
  with error bars next to Perrin's 1909 values and the modern exact value.
- A classroom variant prints a worksheet and accepts a CSV of clicks.

A reader who does this has counted atoms with a microscope and a clock,
which is the sentence Einstein ends §5 with.

### 6.11 Interlinear German

A `gloss` face renders each German sentence with a word-by-word English
gloss beneath it (interlinear glossing, the standard tool of classicists
and linguists), authored at word level for paper 4 first and for the
introductions and key sections of the other papers next. It serves three
audiences at once: readers who want to read Einstein in his own language
with support, German learners for whom a three-page physics paper is a
perfect first text, and readers whose first language is neither German nor
English, for whom the gloss plus the L0 reading is the most direct route.
The same alignment infrastructure later admits community translations of
the *readings* into other languages (§18, later work).

---

## 7. Physics Inventory: What Each Paper Asserts and What the Site Must Compute

This section is the editorial checklist for the Results Decoder and the
regression-test list for the kernels. Notation is Einstein's on the left of
each arrow and modern on the right. Numbers Einstein printed are marked
**[printed]** and become tests.

### 7.1 Paper 1: light quanta

| Result | As printed (1905 notation) | Modern form | Test / probe |
|---|---|---|---|
| Equipartition spectrum and its divergence | $\rho_\nu = \frac{R}{N}\frac{8\pi\nu^2}{L^3}T$; $\int_0^\infty \rho_\nu\,d\nu = \infty$ | Rayleigh–Jeans $u = \frac{8\pi\nu^2}{c^3}k_BT$ | Instrument shows the integral has no finite value; the label is a refusal, not a clamp |
| Planck's law used only at low $\nu/T$ | $\rho_\nu \to \frac{\alpha}{\beta}\nu^2 T$ | $u \to \frac{8\pi\nu^2}{c^3}k_BT$ | Matching gives $N = \frac{\beta}{\alpha}\frac{8\pi R}{L^3}$ **[printed $N = 6.17\times10^{23}$]** |
| Entropy of radiation from the spectrum | $\frac{\partial\varphi}{\partial\rho} = \frac{1}{T}$ | same | Capsule 15; the thermodynamic identity is derived, not assumed |
| Wien-regime entropy | $S = -\frac{E}{\beta\nu}\left[\ln\frac{E}{V\alpha\nu^3\,d\nu} - 1\right]$ (with the $d\nu$ as printed); $S - S_0 = \frac{E}{\beta\nu}\ln\frac{V}{V_0}$ | $S - S_0 = \frac{E}{h\nu}k_B\ln\frac{V}{V_0}$ | Instrument I1.2 |
| Boltzmann's principle | $S - S_0 = \frac{R}{N}\ln W$ | $S = k_B\ln W$ | Instrument I1.3 |
| Ideal gas volume entropy | $S - S_0 = \frac{R}{N}\,n\ln\frac{V}{V_0}$ ($n$ molecules) | same | I1.2 overlay |
| The light-quantum inference | $W = (V/V_0)^{NE/(R\beta\nu)}$; radiation behaves as $NE/(R\beta\nu)$ independent quanta of energy $R\beta\nu/N$ | $n = E/h\nu$; $\epsilon = h\nu$ | Probe: the two entropy curves coincide iff $n = E/h\nu$ |
| Stokes' rule | emitted frequency $\le$ absorbed frequency (with a thermal-energy caveat) | $h\nu_{em} \le h\nu_{abs}$ | I1.5 |
| Photoelectric equation | $\Pi\varepsilon = \frac{R}{N}\beta\nu - P$ | $eV_s = h\nu - \phi$ | I1.4; **[printed: for $\nu = 1.03\times10^{15}$ s$^{-1}$, $\Pi \approx 4.3$ V]**; Millikan 1916 overlay |
| Ionization energy bound | energy per ion $\le R\beta\nu/N$ | $E_{ion} \le h\nu$ | Results card only |

### 7.2 Paper 2: Brownian motion

| Result | As printed | Modern form | Test / probe |
|---|---|---|---|
| Osmotic pressure of suspended particles | $p = \frac{RT}{N}\nu$ | $p = n k_B T$ | Capsule 6 |
| Force balance (dynamic equilibrium) | $K\nu = \frac{RT}{N}\frac{\partial\nu}{\partial x}$ with $K = 6\pi k P v$ | $F n = k_BT\,\partial n/\partial x$; $F = 6\pi\eta a v$ | I2.4 |
| Diffusion coefficient | $D = \frac{RT}{N}\frac{1}{6\pi k P}$ | $D = \frac{k_BT}{6\pi\eta a}$ (Stokes–Einstein; also Sutherland 1905) | I2.3 |
| Displacement kernel and the diffusion equation | $f(x,t+\tau) = \int f(x+\Delta,t)\varphi(\Delta)d\Delta$ $\Rightarrow$ $\frac{\partial f}{\partial t} = D\frac{\partial^2 f}{\partial x^2}$, $D = \frac{1}{\tau}\int\frac{\Delta^2}{2}\varphi(\Delta)d\Delta$ | Fokker–Planck / Chapman–Kolmogorov to second order | I2.1 and I2.2 side by side |
| Gaussian propagator | $f = \frac{n}{\sqrt{4\pi D}}\frac{e^{-x^2/4Dt}}{\sqrt{t}}$ | same | I2.1 histogram overlay |
| Mean displacement | $\lambda_x = \sqrt{2Dt} = \sqrt{t}\sqrt{\frac{RT}{N}\frac{1}{3\pi k P}}$ | $\sqrt{\langle x^2\rangle} = \sqrt{2Dt}$ | **[printed: $\approx 0.8\,\mu$m in 1 s and $\approx 6\,\mu$m in 1 min for 1 $\mu$m-diameter particles in water at 17°C with $k = 1.35\times10^{-2}$ CGS]** |
| Inversion to count atoms | $N = \frac{t}{\lambda_x^2}\frac{RT}{3\pi k P}$ | same | I2.5; Perrin 1909 overlay |
| The observable is not a velocity | (stated in §4–5) | apparent speed $\lambda_x/\tau \propto \tau^{-1/2}$ | I2.6 |

Kernel regression: with Einstein's own printed viscosity ($1.35\times10^{-3}$
Pa·s), $T = 290.15$ K, $a = 0.5\,\mu$m, the kernel must return
$\lambda_x = 0.79\,\mu$m at $t = 1$ s and $6.1\,\mu$m at $t = 60$ s. With the
modern viscosity of water at 17°C ($\approx 1.08\times10^{-3}$ Pa·s) it
returns $0.89\,\mu$m; the instrument shows both and the historian's margin
says why.

### 7.3 Paper 3: electrodynamics of moving bodies

| Result | As printed | Modern form | Test / probe |
|---|---|---|---|
| Synchronization convention | $t_B - t_A = t'_A - t_B$ | Einstein synchronization | I3.1 |
| Relativity of simultaneity | (§2 argument) | $\Delta t' = -\gamma v\Delta x/c^2$ at $\Delta t = 0$ | I3.1, I3.2 |
| Lorentz transformation | $\tau = \beta(t - vx/V^2)$, $\xi = \beta(x - vt)$, $\eta = y$, $\zeta = z$, $\beta = (1 - v^2/V^2)^{-1/2}$ | $t' = \gamma(t - vx/c^2)$, $x' = \gamma(x - vt)$ | I3.3; determinant 1; inverse is the same map with $-v$ |
| Length contraction | a sphere of radius $R$ becomes an ellipsoid with axes $R\sqrt{1 - v^2/V^2}, R, R$ | $L' = L/\gamma$ | I3.4 |
| Time dilation | a moving clock loses $\left(1 - \sqrt{1 - v^2/V^2}\right)$ s per second $\approx \frac{1}{2}v^2/V^2$ | $\Delta t' = \Delta t/\gamma$ | I3.4 **[printed second-order form]** |
| Velocity composition | $U = \frac{v + w}{1 + vw/V^2}$; two boosts compose to a boost | $u = \frac{v+w}{1+vw/c^2}$; rapidities add | I3.5; probe: $U < V$ always |
| Field transformation | $X' = X$, $Y' = \beta(Y - \frac{v}{V}N)$, $Z' = \beta(Z + \frac{v}{V}M)$; $L' = L$, $M' = \beta(M + \frac{v}{V}Z)$, $N' = \beta(N - \frac{v}{V}Y)$ | $\mathbf{E}'_\parallel = \mathbf{E}_\parallel$, $\mathbf{E}'_\perp = \gamma(\mathbf{E} + \mathbf{v}\times\mathbf{B})_\perp$, etc. | I3.6 |
| Doppler | $\nu' = \nu\beta(1 - \frac{v}{V}\cos\varphi)$ | same with $\gamma$ | I3.7 |
| Aberration | $\cos\varphi' = \frac{\cos\varphi - v/V}{1 - \frac{v}{V}\cos\varphi}$ | same | I3.7 |
| Energy of a light complex | $E'/E = \beta(1 - \frac{v}{V}\cos\varphi) = \nu'/\nu$ | $E'/E = \nu'/\nu$ (Planck relation shadow) | I3.8; this is paper 4's only input |
| Radiation pressure on a moving mirror | pressure proportional to $\frac{(\cos\varphi - v/V)^2}{1 - v^2/V^2}$ in the printed Gaussian units (prefactor taken from the edition, not retyped here) | same | I3.8 |
| Electron dynamics | longitudinal mass $m\beta^3$, transverse mass $m\beta^2$; $W = mV^2(\beta - 1)$ | $E_k = mc^2(\gamma - 1)$; transverse mass $m\gamma$ with the modern force definition (Planck 1906) | I3.9; historian's margin required |

### 7.4 Paper 4: mass–energy

| Result | As printed | Modern form | Test / probe |
|---|---|---|---|
| Emission bookkeeping in two frames | rest: $E_0 - E_1 = L$; moving: $H_0 - H_1 = L\beta$ | $\Delta E' = \gamma\,\Delta E$ | I4.1 |
| Kinetic-energy difference | $K_0 - K_1 = L(\beta - 1) = \frac{1}{2}\frac{L}{V^2}v^2 + \ldots$ | $\Delta K = E(\gamma - 1)$ | I4.3 |
| Mass change | the mass diminishes by $L/V^2$ | $\Delta m = E/c^2$ | I4.1 probe |
| Radium proposal | bodies whose energy content varies greatly (radium salts) could test this | Ra-226 $\alpha$ decay, $Q \approx 4.87$ MeV | I4.4 card with provenance |

---

## 8. Interactive Instruments

Every instrument is a pedagogical instrument in the Classic Patents sense:
real controls in real units, an SI step in a kernel module, typed
telemetry, a result probe tied to a numbered result of the paper, an
honest kernel-source label, a reduced-motion path, keyboard operation, and
a 320 px layout. Decorative particles that ignore the result are a failed
instrument.

Instruments share one physics bus per paper (`usePaperPhysics("ap-17-891-electrodynamics")`),
so a control that means the same thing in two instruments is one parameter.
For paper 3 the boost velocity `vOverC` is shared by every instrument on the
page: dragging it on the spacetime diagram tilts the simultaneity lines,
slows the clock in the rod-and-clock studio, shifts the Doppler readout, and
changes the $\gamma$ chip in the header on the same frame.

Kernel source labels are `closed-form host`, `wasm (fs-generic)`, or
`ts-fallback`. A HUD never says WASM unless a module stepped this tick.

### 8.1 Paper 1 instruments

| Id | Instrument | Controls (unit, range) | Telemetry | Kernel | Probe (result) |
|---|---|---|---|---|---|
| I1.1 | **Blackbody Spectrum Explorer** | $T$ (K, 300–10 000); law: Wien / Rayleigh–Jeans / Planck; axis: linear or log; a "Wien regime" shading threshold $h\nu/k_BT$ | peak $\nu$ (Wien displacement), total $u(T)$ (Stefan–Boltzmann), relative Wien error at the cursor frequency, RJ integral: "no finite value" | closed-form host | §1 divergence; §4 the regime where Wien holds |
| I1.2 | **Entropy of Radiation vs Volume** | $E$ (J), $\nu$ (Hz), $V/V_0$ (0.05–1), gas particle count $n$ | $S - S_0$ for Wien radiation; $S - S_0$ for an $n$-particle ideal gas; the value of $n$ at which they coincide | closed-form host | §6: coincidence iff $n = E/h\nu$ |
| I1.3 | **Microstate Counter** (capsule 5) | $n$ particles (1–60), sub-volume fraction (0.05–1), trials | measured probability that all $n$ land in the sub-volume vs $(V/V_0)^n$; $\ln W$ | `wasm (fs-generic)` via the `fs-rand` stream export of §12.4, `ts-fallback` otherwise; seeded, replayable | §5–6 |
| I1.4 | **Photoelectric Bench** | $\nu$ or $\lambda$ (200–800 nm), intensity (relative), metal card (work function with provenance), retarding voltage (V) | $K_{max}$ (eV), stopping potential, threshold frequency, current vs voltage sketch, Millikan 1916 sodium line overlay (slope $h/e$) | closed-form host; metal cards are typed data with citations | §8: intensity changes current, not $K_{max}$; below threshold no emission at any intensity **[printed 4.3 V check]** |
| I1.5 | **Stokes' Rule** | absorbed $\nu$, emitted $\nu$, temperature | allowed region; anti-Stokes band explained by thermal energy | closed-form host | §7 inequality |
| I1.6 | **Avogadro from Radiation** | Planck's $\alpha$, $\beta$ as printed (editable), $L$ | $N$ | closed-form host | §2 **[printed $6.17\times10^{23}$]** |

### 8.2 Paper 2 instruments

| Id | Instrument | Controls | Telemetry | Kernel | Probe |
|---|---|---|---|---|---|
| I2.1 | **Random Walk to Gaussian** | particles (1–10 000), steps, step kernel $\varphi(\Delta)$: coin / uniform / Gaussian / "molecular kicks", $\tau$ | histogram vs Gaussian overlay, $\langle x^2\rangle$ vs $t$ (a straight line), $D$ estimated from the slope, tape digest | `wasm (fs-generic)` `brownian_frames` (§12.4) with `ts-fallback`; deterministic Philox stream | §4: the histogram is the PDE solution |
| I2.2 | **Diffusion Equation Face** | initial profile (spike / step / two spikes), $D$, $\Delta x$, $\Delta t$, time | density $f(x,t)$ frames; width vs $\sqrt{t}$; the explicit-scheme stability number $D\Delta t/\Delta x^2$ with a typed refusal above $1/2$ | `wasm (fs-generic)` `diffusion1d_frames` (§12.4; the existing `heat_frames` is a fixed two-blob 2D demo with no parameters and is not used) | §4 |
| I2.3 | **Stokes–Einstein Dial** | radius $a$ (nm–$\mu$m, log), viscosity $\eta$ with fluid cards (water at 17°C modern; Einstein's printed $1.35\times10^{-2}$ CGS; glycerol; ethanol; a gas card that refuses, because Stokes drag without the Cunningham slip correction is invalid when the mean free path is comparable to the radius), $T$, $t$ | $D$, $\lambda_x$, the printed values as reference marks | closed-form host | §5 **[printed 0.8 $\mu$m / 6 $\mu$m]** |
| I2.4 | **Osmotic Balance** | concentration gradient, particle radius, kicks on/off | osmotic "force" per particle, Stokes drag, net flux, relaxation | closed-form host | §3; Nägeli's objection as a probe: kicks off, nothing relaxes |
| I2.5 | **Perrin's Microscope** | field of particles (seeded), observation interval $\tau$, number of marks | reader-clicked displacements, $\langle x^2\rangle$, $N$ estimate with error bars; Perrin 1909 published range overlay; the modern exact value | `wasm (fs-generic)` `brownian_frames` | §5 inversion |
| I2.6 | **The Velocity Trap** | observation interval $\tau$ (log scale) | apparent speed $\lambda_x/\tau$ growing as $\tau^{-1/2}$ | closed-form host | §4–5: why Exner 1900 failed |
| I2.7 | **Langevin's Loop** (programmer's door; labeled 1908) | mass, radius, viscosity, noise strength | ballistic-to-diffusive crossover at $m/(6\pi\eta a)$ | `ts-fallback` first; `fs-rand` when bound | Threads page |

### 8.3 Paper 3 instruments

| Id | Instrument | Controls | Telemetry | Kernel | Probe |
|---|---|---|---|---|---|
| I3.1 | **Clock Synchronization** | separation $L$, boost $v/c$ (shared), signal launch | round-trip times, the convention applied, the platform-frame desynchronization $vL/c^2$ | closed-form host | §1–2 |
| I3.2 | **Train and Platform** (labeled "Einstein's 1917 popular-book illustration of §1–2") | $v/c$ (shared), flash position | arrival-time difference in each frame | closed-form host | §2 |
| I3.3 | **The Boost as a Matrix** (spacetime diagram) | $v/c$ (shared), rapidity $\phi$ (linked), draggable events | the $2\times2$ matrix with live entries, its determinant, eigenvectors (the light lines) and eigenvalues (the Doppler factors $\sqrt{(1\mp v/c)/(1\pm v/c)}$), invariant hyperbolae, tilted simultaneity lines | closed-form host; matrix via a tiny `la` helper, no library | §3; probe: inverse equals the map with $-v$ |
| I3.4 | **Moving Rod and Moving Clock** (Three.js studio) | $v/c$ (shared), sphere radius | ellipsoid axes, clock rate, printed second-order form vs exact; equator-clock note toggle with caveat | closed-form host | §4 |
| I3.5 | **Velocity Composition** | $v/c$, $w/c$ | $U/c$, rapidity sum | closed-form host | §5; probe: $U < c$ for all inputs |
| I3.6 | **Magnet and Conductor** | frame: magnet moving / conductor moving; $v/c$ (shared); dipole strength; loop size | $\mathbf{E}$ and $\mathbf{B}$ in each frame, the induced EMF (identical in both), field-line picture | closed-form dipole field, host; optional later binding of `fs-feec` if a meshed field is wanted | §6 and the introduction |
| I3.7 | **Doppler and Aberration** | $v/c$ (shared), ray angle $\varphi$, rest frequency | $\nu'/\nu$, $\varphi'$, classical vs relativistic, transverse Doppler; Ives–Stilwell 1938 note | closed-form host | §7 |
| I3.8 | **Light Complex and the Moving Mirror** | $v/c$ (shared), $\varphi$, amplitude, mirror velocity | $E'/E$ and $\nu'/\nu$ shown as the same number; reflected frequency; pressure on the mirror | closed-form host | §8; probe: the two ratios are equal to machine precision |
| I3.9 | **Electron Dynamics** | $v/c$ (shared), force definition toggle (1905 / Planck 1906) | longitudinal and transverse mass as printed vs modern, $W = mc^2(\gamma - 1)$ vs $\tfrac{1}{2}mv^2$, Kaufmann-era note | closed-form host | §10 with mandatory historian's margin |
| I3.10 | **Michelson–Morley** (discovery-path shelf instrument) | arm length, ether wind $v$, contraction on/off | expected fringe shift with and without contraction; the 1887 null | closed-form host | Introduction |
| I3.11 | **Fizeau's Water** (shelf instrument) | water speed, refractive index | Fresnel drag coefficient vs the velocity-composition prediction | closed-form host | §5 (Laue 1907 connection, labeled) |

### 8.4 Paper 4 instruments

| Id | Instrument | Controls | Telemetry | Kernel | Probe |
|---|---|---|---|---|---|
| I4.1 | **Two-Pulse Emission Ledger** | $L$ (J), $v/c$ (shared with paper 3's bus via a cross-paper alias), rest mass | energy ledger in both frames, $L(\gamma - 1)$, the mass drop $L/c^2$ | closed-form host | the paper's central result; probe: $v \to 0$ leaves $\Delta m$ unchanged |
| I4.2 | **Photon in a Box** (labeled 1906) | box length, pulse energy, box mass | recoil, transit time, displacement, the center-of-mass argument | closed-form host | Threads: the second derivation |
| I4.3 | **Binomial Expansion Viewer** (capsule 2) | $v/c$ | $\gamma - 1$, $\tfrac{1}{2}v^2/c^2$, $\tfrac{3}{8}v^4/c^4$, where second order is 1% off | closed-form host | the "to second order" step |
| I4.4 | **Mass Budget** | energy-source card (typed, with provenance): Ra-226 decay, U-235 fission, D–T fusion, He-4 binding, coal combustion, an AA cell, the Sun's luminosity | $\Delta m$, fraction of rest mass | closed-form host; refuses a card without a citation | the radium proposal |

### 8.5 Companion and Threads instruments

| Id | Instrument | Purpose |
|---|---|---|
| I5.1 | **Viscosity of a Suspension** | $\eta^*/\eta$ vs $\varphi$ with $1+\varphi$ (1905) and $1+2.5\varphi$ (1911); Bancelin's data overlay; the corrected $N$ |
| IT.1 | **The Avogadro Lab** | three live determinations of $N$ from one year: radiation (I1.6), Brownian displacement (I2.5), sugar viscosity and diffusion (I5.1); the modern exact value as a horizontal line |
| IT.2 | **The Light Thread** | one light pulse examined by paper 1 (quantum energy), paper 3 (frequency and energy transform together), paper 4 (its energy has inertia) |

### 8.6 Instrument contract additions

Beyond the inherited Classic Patents contract, every instrument also:

- **Declares what it does not model** (`notModeled`, shown on the
  instrument as a plain line). The photoelectric bench ignores the thermal
  smearing of the metal's Fermi edge and surface effects; the random walk
  is one-dimensional; the dipole field is static; the mass budget ignores
  neutrino energy where relevant. An instrument with an empty
  `notModeled` fails the audit.
- **Has predict mode** (§6.8) unless the audit records why prediction is
  meaningless for it (the Avogadro readout, for instance).
- **Shows its code** (§6.9).
- **Is shareable by permalink.** The control tape's current state is
  serialized into the URL (`?tape=`), so "look at exactly this" is one
  link. The tape scrubber restores it.
- **Is embeddable.** `/embed/instrument/[id]` renders the instrument alone
  with attribution and a link back, for teachers, encyclopedias, and
  blogs. Embeds respect the depth, theme, and reduced-motion preferences
  passed as parameters.
- **Overlays historical data honestly.** Digitized datasets (`HistoricalDataset`,
  §11) carry the table or figure number, the digitizer, and the
  uncertainty; the launch set is Millikan 1916 (sodium), Perrin 1909,
  Bucherer 1908, Bancelin 1911, Lummer–Pringsheim and Rubens–Kurlbaum
  1899–1900, Kaufmann 1902–1906, Ives–Stilwell 1938, and Fizeau 1851.
- **Can run at true scale.** Instruments with a natural physical rate offer
  a "real time" toggle with a scale bar (the walk at $0.8\,\mu$m per
  second beside the sped-up version), using the donor's two-clocks strip.

### 8.7 Three.js scope

Spatial instruments only: I3.4 (sphere to ellipsoid with the clock), I3.6
(field lines in two frames), I4.2 (the box), and a spacetime "block" view
for I3.3 (optional, Phase 6). Everything else is SVG or Canvas. Do not build
a 3D scene for a 1D random walk.

---

## 9. Discovery Paths: "You Could Have Found This in 1904"

This is the site's signature content. Each path is a guided reconstruction
with the same fixed skeleton so the reader learns the moves, not just the
results.

### 9.1 The skeleton

1. **The shelf.** A dated list of results that a careful reader of the
   physics literature had in 1904, each one a card with the source, the
   one-line statement, and (where useful) a shelf instrument. Nothing from
   after 1904 is on the shelf. Nothing is invented to make the path
   smoother.
2. **The nagging fact.** The observation or contradiction that does not fit.
3. **The first honest question.** Stated in one sentence, in the second
   person.
4. **The chain.** A sequence of questions. Each step shows what the reader
   can compute from the shelf, with the instrument for that step embedded.
5. **The forks.** At two or three points the path stops and offers the
   real alternatives that were on the table in 1904. The reader picks one.
   Each branch is worked far enough to show where it leads (a dead end, a
   correct but weaker result, or the paper's route). The branch that
   Lorentz or Planck or Poincaré took is labeled with their name. Nobody
   is mocked for a reasonable branch.
6. **The move.** The one non-obvious step, named as such.
7. **Check it against the world.** A numerical prediction, computed live,
   compared with a dated measurement.
8. **What Einstein actually wrote.** A jump into the reading face at the
   section where the paper makes the same move, with the result weave lit.
9. **Exercises.** Two to five problems with instrumented answers (the
   reader's answer is checked by the kernel, not by a stored string).

Each path has two doors where the material allows it: **the front door**
(Einstein's own argument) and **the side door** (a route that starts from
something a programmer or physician already owns: a loop, a matrix, Fick's
law). Both arrive at the same equation and the site says so.

### 9.2 Path 1: from Wien's law to light quanta

**The shelf (1904).**
- Maxwell (1865), Hertz (1888): light is an electromagnetic wave whose
  energy is continuously divisible.
- Hertz (1887), Hallwachs (1888): ultraviolet light discharges negatively
  charged metal. J. J. Thomson (1899): what leaves the metal is electrons.
- Lenard (1902): the energy of the emitted electrons does not depend on the
  light's intensity, and it depends on the light's frequency.
- Kirchhoff (1860), Stefan (1879), Boltzmann (1884), Wien (1893, 1896): the
  black-body problem and Wien's law $\rho = \alpha\nu^3 e^{-\beta\nu/T}$,
  which fits at high frequency.
- Lummer and Pringsheim, Rubens and Kurlbaum (1899–1900): Wien's law fails
  at long wavelength.
- Rayleigh (June 1900): equipartition gives a formula that works at long
  wavelength and cannot possibly be right everywhere.
- Planck (October and December 1900): an interpolation formula that fits
  all the data, derived with energy elements $\varepsilon = h\nu$ as a
  computational device; the constants $h$ and $k$, and $N = 6.17\times10^{23}$.
- Boltzmann (1877), Planck (1900): $S = k\ln W$.
- The ideal gas: $S - S_0 = nk\ln(V/V_0)$ for $n$ molecules expanding at
  constant temperature.
- Stokes (1852): fluorescent light is never bluer than the light that
  excites it.

**The nagging fact.** Turn up the lamp and the electrons come out in greater
numbers but not with greater energy. A wave that is twice as strong should
push twice as hard.

**The first honest question.** Is there any regime of light where I can
do honest thermodynamics without knowing what light is made of?

**The chain.**
1. Thermodynamics gives entropy from the spectrum alone
   ($\partial\varphi/\partial\rho = 1/T$). Compute it in the regime where the
   spectrum is simplest and best measured: Wien's law. (Instrument I1.1 with
   the Wien shading.)
2. Hold the energy fixed and change the volume. The entropy changes by
   $\frac{E}{\beta\nu}\ln\frac{V}{V_0}$. (I1.2.)
3. **Fork A.** Where have you seen $\ln(V/V_0)$? (a) It is a coincidence of
   the mathematics. (b) It is the ideal-gas volume law with
   $n = E/(\beta\nu)$ particles. Branch (a) is Planck's position for years afterward
   and the site works it: you can keep the continuum and treat $h$ as a
   property of oscillators in the walls; you then have no account of
   Lenard's result. Branch (b) is the move.
4. **The move.** Take Boltzmann's principle literally for radiation. The
   probability that all the radiation energy is in a sub-volume is
   $(V/V_0)^{E/h\nu}$, exactly the probability for $E/h\nu$ independent
   particles. In the Wien regime, monochromatic radiation *behaves* as if it
   were made of independent quanta of energy $h\nu$. Einstein's word for
   this is heuristic, and the site keeps it.
5. **Fork B.** If light arrives in lumps of $h\nu$, what happens when one
   lump is absorbed by one electron? (a) The energy spreads through the
   metal (the wave picture again). (b) One electron gets the whole lump,
   pays the exit cost $P$, and leaves with at most $h\nu - P$. Branch (b)
   predicts a stopping potential that is linear in frequency, with slope
   $h/e$, independent of intensity. (I1.4.)
6. **Check it against the world.** Einstein computes about 4.3 volts for the
   ultraviolet limit of the solar spectrum and notes it agrees with Lenard
   in order of magnitude. The instrument overlays Millikan's 1916 sodium
   line (which he had expected to refute) with slope
   $h/e$ to better than one percent.
7. Bonus from the same lump: a fluorescing molecule cannot emit a lump
   bigger than the one it absorbed. Stokes' rule falls out as an
   inequality, with an honest caveat about thermal energy. (I1.5.)

**The side door (programmer).** Write the microstate counter. Put $n$
labeled particles in a box at random; the chance that all of them are in
the left fraction $f$ of the box is $f^n$. Now be told that the entropy of
Wien radiation changes with volume like $\frac{E}{h\nu}\ln f$. Invert: the
radiation is behaving like $n = E/h\nu$ particles. The loop is the argument.
(I1.3.)

**What Einstein actually wrote.** Jump to §5 and §6 of the reading face.

**Exercises.** Compute $h$ from a given stopping-potential line; find the
threshold wavelength for a metal card; compute how many quanta per second a
one-watt green source emits; explain in two sentences why intensity does
not change $K_{max}$.

### 9.3 Path 2: from a microscope slide to Avogadro's number

**The shelf (1904).**
- Brown (1827): pollen fragments jiggle. Gouy (1888): the jiggling is
  intrinsic; it is faster for smaller particles, in warmer and less viscous
  liquids; it is not caused by light, convection, or vibration; Gouy
  proposed thermal molecular agitation.
- Nägeli (1879): a single molecular impact cannot move a visible particle,
  so molecular agitation cannot be the cause. (A wrong argument, and a
  fork.)
- Exner (1900): measured the "speed" of the particles and found it far too
  small for kinetic theory. (A wrong observable, and a fork.)
- Maxwell (1860), Boltzmann: kinetic theory; equipartition; a particle in
  thermal equilibrium has mean kinetic energy $\tfrac{3}{2}kT$ whatever its
  mass.
- van 't Hoff (1887), Pfeffer (1877): dissolved molecules exert an osmotic
  pressure that obeys the gas law.
- Stokes (1851): a sphere moving slowly through a viscous fluid feels a drag
  $6\pi\eta a v$.
- Fick (1855): diffusion follows $\partial c/\partial t = D\,\partial^2 c/\partial x^2$.
- Siedentopf and Zsigmondy (1902): the ultramicroscope makes sub-micron
  particles visible.
- Loschmidt (1865), Planck (1900): estimates of $N$ from gas theory and
  from radiation.
- Sutherland: the same diffusion formula (with a slip correction), derived
  for large molecules such as albumin; presented at Dunedin in January
  1904, printed with a misprint in the congress proceedings in early 1905,
  and published in *Philosophical Magazine* in June 1905, between
  Einstein's submission and publication. On the timeline as parallel work,
  and the Dunedin talk is a legitimate 1904 shelf card.
- Bachelier (1900): the random-walk-to-diffusion-equation mathematics,
  worked out for stock prices in a Paris thesis under Poincaré and unknown
  to physicists. A shelf card because it shows the mathematics was in the
  air; a favorite for programmers.

**The nagging fact.** If Gouy is right and the jiggling is thermal, then a
one-micron particle is just a very large molecule, and everything we know
about molecules in solution should apply to it. Does it?

**The first honest question.** Does a visible particle in water exert an
osmotic pressure?

**The chain.**
1. Van 't Hoff's law says $p = nk_BT$ for dissolved molecules. There is no
   term in the derivation that knows how big the molecule is. Einstein's §2
   shows the kinetic theory gives the same law for particles of any size.
   (Capsule 6.)
2. A concentration gradient therefore pushes each particle with a force
   $-(k_BT/n)\,\partial n/\partial x$. What resists? Stokes drag. Balance
   them and the flux that results is a diffusion current with
   $D = k_BT/(6\pi\eta a)$. (I2.4, I2.3.)
3. **Fork A (Nägeli).** (a) A particle in still water does not move, because
   no single molecular kick is big enough. (b) The particle is kicked
   constantly from all sides, and the *imbalance* of the kicks is what we
   see. Branch (a) is worked: turn the kicks off in I2.4 and the gradient
   never relaxes, contradicting Fick. Branch (b) is the move.
4. **The move (side door first, because it is the clearest).** Simulate it.
   Each interval $\tau$ the particle moves by a random $\Delta$ drawn from
   some symmetric distribution. After many intervals the histogram of
   positions is a Gaussian whose variance grows linearly with time. Now do
   Einstein's calculation: write the density at the next instant as an
   average over the step distribution, expand to second order, and the
   diffusion equation appears with $D = \langle\Delta^2\rangle/2\tau$. The
   histogram *is* the solution of Fick's equation. (I2.1 beside I2.2.)
5. So the two $D$'s are the same $D$, and
   $\langle x^2\rangle = 2Dt = \frac{k_BT}{3\pi\eta a}\,t$.
6. **Fork B (Exner).** What do you measure? (a) The speed. (b) The
   displacement over a fixed interval. Branch (a) is worked: the apparent
   speed depends on how often you look, growing without bound as the
   interval shrinks; Exner's number meant nothing. Branch (b) is the
   observable. (I2.6.)
7. **Check it against the world.** Water at 17°C, one-micron particles:
   about $0.8\,\mu$m in a second, about $6\,\mu$m in a minute. Visible in an
   ordinary microscope. (I2.3.)
8. **The inversion.** Everything in $\langle x^2\rangle = \frac{k_BT}{3\pi\eta a}t$
   is measurable with a microscope, a thermometer, a viscometer, and a
   stopwatch, except $N$. So measure the jiggling and count the atoms.
   Perrin did (1908–1909) and got values between roughly $6$ and
   $7.5\times10^{23}$ across his methods, with the 1909 sedimentation-
   equilibrium value near $7\times10^{23}$. (I2.5.)

**The physician's door.** You already know Fick's law and osmotic pressure.
This paper is the bridge between them, and the bridge is Stokes drag. The
whole argument is: osmotic force per particle equals drag; therefore
diffusion coefficient equals thermal energy over drag coefficient.

**What Einstein actually wrote.** Jump to §3 and §4 of the reading face,
then the closing sentence of §5.

**Exercises.** Estimate $N$ from a given set of displacements; predict the
displacement of a $0.1\,\mu$m particle in glycerol; explain why a warmer
liquid gives a larger $\lambda_x$ twice over (through $T$ and through
$\eta$); explain what Exner measured.

### 9.4 Path 3: from a magnet and a coil to the Lorentz transformation

**The shelf (1904).**
- Galileo: the laws of mechanics look the same below decks whether the ship
  moves or not.
- Maxwell (1865): the equations; light moves at $c$ *relative to the ether*.
  The equations do not keep their form under the Galilean change of
  coordinates $x' = x - vt$. (Shelf instrument: substitute and watch a term
  appear.)
- Faraday, and every dynamo patent on a Bern examiner's desk: move the
  magnet or move the coil, the same current flows, but the ether theory
  explains the two cases with two different mechanisms.
- Bradley (1729): stellar aberration, about $20.5''$.
- Fizeau (1851): light in moving water is dragged by $(1 - 1/n^2)$ of the
  water's speed, not all of it.
- Michelson (1881), Michelson and Morley (1887): no ether wind to second
  order. (I3.10.)
- FitzGerald (1889), Lorentz (1892): bodies moving through the ether
  contract by $\sqrt{1 - v^2/c^2}$, which would hide the wind.
- Lorentz (1895): a fictitious "local time" $t' = t - vx/c^2$ makes the
  equations work to first order.
- Poincaré (1898): simultaneity of distant events is a convention; the
  natural convention is to synchronize clocks with light signals assuming
  equal travel time each way. Poincaré (1900): Lorentz's local time is
  exactly what moving observers get from that convention.
- Lorentz (1904): the full transformation, with the contraction, applied to
  a contractile electron; the ether kept.
- Poincaré (September 1904, St. Louis): "the principle of relativity" named
  as a general law of nature.
- Kaufmann (1901–1903): electron mass rises with speed; Abraham's rigid
  electron and Lorentz's contractile electron compete to explain it.

**The nagging fact.** Nature does not care whether the magnet or the coil
moves; the theory does.

**The first honest question.** What if the principle of relativity is
exactly true for electrodynamics too, and the speed of light is the same
for every observer, and I simply follow both of those wherever they lead?

**The chain.**
1. Two postulates and nothing else. No ether, no electron model, no
   contraction hypothesis.
2. What does "at the same time" mean for two clocks a kilometer apart? Only
   light can carry the comparison. Adopt the convention Poincaré had
   stated in 1898 (Einstein's paper cites no one): bounce a signal and
   assume equal travel times.
   Now you have a definition of time in each frame. (I3.1.)
3. Watch two events that are simultaneous in one frame. In another frame
   they are not, by an amount proportional to their separation and to $v$.
   Simultaneity is relative. (I3.2.) This is the step that Lorentz had the
   mathematics for and did not take physically: he kept a true time and
   called the other one local. Poincaré came closer (1900, 1904) but kept
   the ether and a preferred frame.
4. **Fork A.** (a) Keep the ether and the true time; the transformation is a
   calculational device (Lorentz 1904). (b) There is no privileged frame;
   every frame's clocks are as real as every other's (Einstein). Branch (a)
   is worked honestly: it produces the same formulas and the site says so;
   what it cannot do is explain why the ether is undetectable in principle.
5. **The move (side door, linear algebra).** Find the transformation from
   the postulates alone. Demand: it is linear (space and time are
   homogeneous); it sends $x = ct$ to $x' = ct'$ and $x = -ct$ to $x' = -ct'$
   (light is light in both frames); the origin of the moving frame is at
   $x = vt$; its inverse is the same map with $-v$; $y$ and $z$ are
   untouched. Those conditions fix a $2\times2$ matrix up to nothing: $\begin{pmatrix}\gamma & -\gamma v\\ -\gamma v/c^2 & \gamma\end{pmatrix}$
   with $\gamma = 1/\sqrt{1 - v^2/c^2}$. Its determinant is $1$. Its
   eigenvectors are the light lines. Its eigenvalues are
   $\sqrt{(1 \mp v/c)/(1 \pm v/c)}$, which the reader will meet again as the
   Doppler factors. Write $\gamma = \cosh\phi$ and $\gamma v/c = \sinh\phi$
   and the boost is a hyperbolic rotation by the rapidity $\phi$; two boosts
   compose by adding rapidities, so the velocity-addition law is
   $\tanh(\phi_1 + \phi_2)$. (I3.3, I3.5.)
6. **The front door.** Einstein's §3 does the same thing with a functional
   equation for $\tau(x', y, z, t)$ and the synchronization condition; the
   reading face walks it with every step shown at L2.
7. Read the consequences off the matrix: moving rods are shorter by
   $1/\gamma$; moving clocks run slower by $1/\gamma$; nothing is faster
   than $c$. (I3.4, I3.5.)
8. **Fork B.** Now the electrodynamics. (a) Maxwell's equations are true only
   in the ether frame and merely *look* true elsewhere. (b) They keep their
   exact form in every frame provided $\mathbf{E}$ and $\mathbf{B}$ mix under a
   boost. Branch (b) makes the magnet-and-coil asymmetry disappear: the
   "electromotive force" in the coil's frame is an electric field in the
   magnet's. (I3.6.)
9. Transform a plane wave's phase and you get Doppler and aberration
   (I3.7). Transform its energy and it changes by the same factor as its
   frequency (I3.8). File that away.
10. **Check it against the world.** Aberration: right. Fizeau's coefficient:
    it is the low-speed limit of velocity addition (Laue pointed this out in
    1907). Kaufmann's electron data: ambiguous in 1905, and the site says
    so; Bucherer (1908) favored the Lorentz–Einstein prediction; the modern
    confirmations (Ives–Stilwell 1938, muon lifetimes 1941, flown clocks
    1971, satellite clocks) are dated on the timeline, not claimed for 1905.

**What Einstein actually wrote.** Jump to the introduction and §1–§3.

**Exercises.** Verify the determinant and eigenvectors by hand; show that
two boosts give a boost; derive the desynchronization $vL/c^2$; compute the
speed at which a clock loses one second per day; explain the magnet-and-coil
asymmetry in three sentences without the word ether.

### 9.5 Path 4: from radiation pressure to $E = mc^2$

**The shelf (1904, plus paper 3).**
- Maxwell, Poynting (1884): light carries momentum $E/c$; radiation pressure
  exists. Lebedev (1901), Nichols and Hull (1901–1903): measured.
- J. J. Thomson (1881), Abraham (1902–1903): a charged body's field adds to
  its inertia; the electromagnetic mass of the electron.
- Poincaré (1900): to save the center-of-mass theorem when a body emits
  light, treat the radiation as a "fictitious fluid" with mass $E/c^2$.
- Hasenöhrl (1904–1905): the radiation inside a moving cavity adds to the
  cavity's mass (with a factor he later corrected, and which was still not
  the final story).
- Paper 3, §8: a light complex's energy transforms exactly like its
  frequency.

**The nagging fact.** A body that emits light in one direction recoils. If
it emits equal pulses in opposite directions it does not recoil, and yet
something about its motion has changed, because the two pulses carry
different energies to a moving observer.

**The first honest question.** If I already know how the energy of a light
pulse changes between frames, what does energy conservation force me to say
about the body that emitted it?

**The chain (the front door).**
1. Rest frame: the body's energy drops by $L$. Moving frame at $v$: the same
   emission carries away $L\gamma$ (add the two §8 factors; the
   $\cos\varphi$ terms cancel). (I4.1.)
2. The difference between the two frames' energy drops, $L(\gamma - 1)$, can
   only have come from the body's kinetic energy, because the body's
   velocity did not change.
3. Expand: $L(\gamma - 1) = \tfrac{1}{2}\frac{L}{c^2}v^2 + \ldots$ (Capsule 2,
   I4.3.) Compare with $\tfrac{1}{2}mv^2$. The body's mass has fallen by
   $L/c^2$.
4. **The move.** Say the general thing: the mass of a body is a measure of
   its energy content.
5. **Check it against the world.** Einstein proposes radium. The instrument
   uses modern data with provenance: one radium-226 decay releases about
   $4.87$ MeV, so a mole of radium loses about $5$ mg in that one step; the Sun
   converts about four million tonnes of mass to light every second; burning
   a kilogram of coal loses less than a nanogram. (I4.4.)

**The side door (the 1906 box, for programmers).** A closed box of mass $M$
and length $\ell$ emits a light pulse of energy $E$ from its left wall and
absorbs it at its right wall. Momentum conservation gives the box a recoil
$v = E/(Mc)$ for a time $\ell/c$, so it shifts left by $E\ell/(Mc^2)$. If the
center of mass of a closed system cannot move on its own, mass
$m = E/c^2$ must have moved right with the light. Simulate the box and the
shift appears. (I4.2, labeled as Einstein's 1906 argument.)

**Historian's margin (required).** The 1905 argument's additive constant and
its reliance on the Newtonian form of kinetic energy at second order (Ives
1952; the reply by Stachel and Torretti 1982). Poincaré's fictitious fluid,
Hasenöhrl's factor, and the later claims for priority, each stated with what
the person actually wrote. Einstein's own later derivations (1906, 1907,
1935, 1946), noting that the 1906 paper itself credits Poincaré's 1900
work for the formal content of the center-of-mass argument. The formula
$E = mc^2$ never appears in the 1905 paper; it says the mass falls by
$L/V^2$. The first direct nuclear check was the 1932 Cockcroft–Walton
lithium disintegration, with Bainbridge's 1933 mass-spectrograph values.

**Exercises.** Compute the mass lost by a 100 W bulb in a year; show the
$\cos\varphi$ cancellation; compute the recoil of the box; explain why the
equal-and-opposite emission was chosen.

### 9.6 Cross-path exercises (Threads)

- Determine $N$ three ways from the year's papers and compare.
- Show that the Doppler factor and the boost eigenvalue are the same number.
- Use paper 1's quantum energy and paper 4's mass–energy relation to give
  a photon an "effective mass" $h\nu/c^2$, then explain in the historian's
  margin why that phrase is discouraged today.

---

## 10. Colorized Equations and Derivation Chains

### 10.1 What carries over

The `ColorizedEquation` model (`rawLatex`, `colorizedLatex`,
`plainEnglishSentence` fragments bound to `variables`, each variable with a
`color`, `role`, `unit`, `dimension`, `explanation`, and optional
`telemetryKey`) is used unchanged. So is the nine-color palette and the
rule that a color means the same thing across a page (crimson for costs and
losses, sapphire for velocities and fields, emerald for outputs, amber for
constants and geometry, amethyst for energies and states, cyan for flux
and quanta, coral for currents and accelerations, rose for time and rates,
teal for material properties). The KaTeX `\textcolor` colorization,
keyboard navigation of variables, the color-blind mode, and the live
telemetry readout are inherited.

### 10.2 Extensions

```ts
// src/types/equation.ts (additions)

export interface NotationBridgeEntry {
  printedSymbol: string;      // "V", "\\beta", "k", "P", "R/N", "R\\beta/N"
  modernSymbol: string;       // "c", "\\gamma", "\\eta", "a", "k_B", "h"
  meaning: string;
  collisionWarning?: string;  // "Einstein's \\beta is the modern \\gamma; the modern \\beta = v/c never appears in this paper."
}

export interface DerivationStep {
  id: string;                  // "s3-d4"
  latex: string;               // printed notation
  modernLatex?: string;        // rendered when the notation toggle is on
  reason: string;              // why this step follows (L1 voice)
  reasonGroundUp?: string;     // the same, expanded (L2 voice)
  tool?: string;               // capsule id, e.g. "taylor-expansion"
  isTheMove?: boolean;         // the one non-obvious step, highlighted
  sourceAnchor?: string;       // "#s3-p7" where the paper does this
}

export interface PaperEquation extends Omit<ColorizedEquation, "patentId"> {
  paperId: PaperId;            // replaces patentId
  printedNumber?: string;      // the paper's own equation number, if any
  sourceAnchor: string;        // anchor of the block in the edition
  notationBridge: NotationBridgeEntry[];
  derivation?: DerivationStep[];
  usedBy?: string[];           // ids of later equations that depend on this one
  resultId?: string;           // the PaperResult this equation states
  readings: TieredReadings;    // L0..L3 for the equation itself
}
```

### 10.3 Rendering rules

- An equation card shows: the printed form; the colorized sentence; the
  variable chips with live values; the notation strip; a "Show derivation"
  disclosure that renders the chain with the "move" step highlighted and
  each `tool` linking to its capsule (inline at L2).
- The notation toggle re-renders `latex` as `modernLatex` for every
  equation on the page and swaps the sentence fragments' symbols. It never
  changes the source or translation faces.
- `usedBy` draws the **equation genealogy**: a small graph on the Results
  face showing which equations feed which. For paper 3 the graph has the
  two postulates at the root, the transformation in the middle, and the
  field, Doppler, energy, and electron results as leaves; the §8 energy
  result has one edge leaving the paper, to paper 4.
- A test asserts every numbered equation in the German ledger has a
  `PaperEquation` with a matching `printedNumber` and `sourceAnchor`, and
  every `usedBy` id exists.

---

## 11. Data Model

The canonical types live in `src/types/paper.ts`. They are deliberately
parallel to `src/types/patent.ts` so the renderer, tests, and mental model
transfer.

```ts
export type PaperId =
  | "ap-17-132-light-quanta"
  | "ap-17-549-brownian-motion"
  | "ap-17-891-electrodynamics"
  | "ap-18-639-mass-energy"
  | "ap-19-289-molecular-dimensions";

export type DepthLevel = 0 | 1 | 2 | 3;

export interface TieredReadings {
  l0: string;          // in one breath
  l1: string;          // working reader (calculus, linear algebra)
  l2: string;          // from the ground up
  l3: string;          // historian's margin, cited
}

/** Inline kinds inherited from CuratedSpecificationInline, plus math. */
export type EditionInline =
  | { kind: "text"; text: string }
  | { kind: "math"; latex: string; display?: false }         // inline math as printed
  | { kind: "term"; text: string; definition: string; label?: string }
  | { kind: "reference"; text: string; href: string; referenceType: "equation" | "section" | "paper" | "footnote"; label: string }
  | { kind: "emphasis"; text: string }         // gesperrt (letter-spaced) emphasis in the original
  | { kind: "footnote-mark"; number: number };

export type EditionBlock =
  | { kind: "masthead"; lines: string[] }                       // title, author line, dateline
  | { kind: "heading"; level: 2 | 3; number?: string; text: string }   // "§ 3." headings
  | { kind: "paragraph"; id: string; inlines: EditionInline[]; sentences: SentenceSpan[] }
  | { kind: "equation"; id: string; latex: string; printedNumber?: string; description?: string }
  | { kind: "footnote"; number: number; inlines: EditionInline[] }
  | { kind: "table"; caption?: string; headers: EditionInline[][]; rows: EditionInline[][][] }
  | { kind: "closing"; inlines: EditionInline[] };              // dateline and acknowledgment

export interface SentenceSpan {
  id: string;             // "s3-p2-s1"
  start: number;          // inline index
  end: number;
}

export interface ArchivalEdition {
  kind: "manual-react-edition";
  language: "de" | "en";
  sourcePdfSha256: string;
  preparedBy: string;
  preparedAt: string;
  completeFacsimileReviewed: true;
  blocks: EditionBlock[];
}

export interface AlignmentMap {
  /** German sentence id -> English sentence ids (1..n) */
  sentences: Record<string, string[]>;
  /** German block index -> English block index (must be a bijection on paragraphs) */
  blocks: Record<number, number>;
}

export interface PaperResult {
  id: string;                        // "lorentz-transformation"
  title: string;
  printedStatement: EditionInline[]; // as printed, from the edition (never retyped)
  modernStatement: string;           // LaTeX + prose
  decoder: TieredReadings;           // what this asserts and why it matters
  equationIds: string[];
  probe?: { instrumentId: string; controlId: string; expectation: string };
  laterUse: { paperId?: PaperId; externalLabel?: string; note: string }[];
  historianNote?: string;            // L3-only caveats (transverse mass, equator clock, constant C)
}

export interface ShelfItem {
  id: string;
  year: string;                      // as displayed: "1851", "1632", "1899–1900"
  latestYear: number;                // the audit uses this: must be <= 1904 unless parallelWork
  who: string;
  statement: string;                 // one line
  source: string;                    // citation
  instrumentId?: string;             // shelf instrument
  parallelWork?: true;               // Sutherland 1905, Poincaré June 1905: shown, but flagged
}

export interface DiscoveryFork {
  id: string;
  question: string;
  branches: {
    label: string;                   // "(a) The energy spreads through the metal"
    attributedTo?: string;           // "Planck (for years afterward)", "Lorentz 1904", "Nägeli 1879"
    worked: TieredReadings;          // where this branch leads
    isPaperRoute: boolean;
  }[];
}

export interface DiscoveryStep {
  id: string;
  kind: "shelf" | "nagging-fact" | "question" | "compute" | "fork" | "move" | "check" | "source-jump" | "exercise";
  body: TieredReadings;
  instrumentId?: string;
  fork?: DiscoveryFork;
  sourceAnchor?: string;
  exercise?: { prompt: string; check: { kernel: string; tolerance: number } };
}

export interface DiscoveryPath {
  paperId: PaperId;
  door: "front" | "side-programmer" | "side-physician" | "side-other";
  doorLabel: string;                 // "Einstein's argument" / "The programmer's loop" / "Fick's law first"
  shelf: ShelfItem[];
  steps: DiscoveryStep[];
}

export interface Paper {
  id: PaperId;
  printedTitle: string;
  englishTitle: string;
  authorLine: string;                // "von A. Einstein"
  dateline: string;                  // "Bern, 17. März 1905"
  receivedDate: string;              // ISO
  publishedDate: string;
  journal: { name: "Annalen der Physik"; series: 4; volume: number; issue: number; pages: [number, number]; wileyVolume?: number; doi?: string };
  pageCount: number;
  isCompanion: boolean;
  summary: string;
  heroQuote: { de: string; en: string; anchor: string };   // a sentence from the paper, never invented
  facsimileUrl: string;              // /papers/pdfs/<id>.pdf
  ledger: OriginalTextAsset;         // reviewed German transcription
  germanEdition: ArchivalEdition;
  englishEdition: ArchivalEdition;
  alignment: AlignmentMap;
  readings: Record<string, TieredReadings>;   // keyed by paragraph id
  equations: PaperEquation[];
  results: PaperResult[];
  discoveryPaths: DiscoveryPath[];
  instrumentIds: string[];
  historicalContext: PaperHistoricalContext;
  notationBridge: NotationBridgeEntry[];
  threads: string[];                 // thread ids this paper participates in
}

export interface Capsule {
  id: string;                        // "taylor-expansion"
  title: string;
  usedBy: PaperId[];
  readings: TieredReadings;
  instrumentId?: string;
  prerequisites: string[];           // other capsule ids; the toolkit draws the graph
}

export interface Misconception {
  id: string;
  paperId: PaperId;
  claim: string;                     // the tempting wrong statement, verbatim as people say it
  whyTempting: string;
  whatIsTrue: TieredReadings;
  instrumentId?: string;             // the instrument that shows it
  anchors: string[];                 // where in the reading it tends to arise
  sources: string[];
}

export interface InstrumentSpec {
  id: string;                        // "brownian-random-walk"
  paperId: PaperId;
  title: string;
  captions: TieredReadings;          // L0..L3 caption
  controls: PhysicsControl[];        // donor type; ids are paper-bus parameter ids
  kernelModule: string;              // "src/physics/kernels/brownianKernel.ts#meanDisplacement"
  kernelSourceLabels: ("closed-form host" | "wasm (fs-generic)" | "ts-fallback")[];
  frankenSimCrates: string[];        // ["fs-rand", "fs-sparse"] or []
  probes: { resultId: string; controlId: string; expectation: string }[];
  notModeled: string[];              // shown on the instrument as "what this does not model"
  tapeModelIdentity: string;         // for controlTape.ts
  historicalDatasets?: string[];     // ids of typed datasets overlaid (Millikan 1916, Perrin 1909)
  predictMode: boolean;              // §6.8
  embeddable: boolean;               // §8.7
}

export interface HistoricalDataset {
  id: string;                        // "millikan-1916-sodium"
  title: string;
  source: string;                    // full citation with table or figure number
  digitizedBy: string;
  digitizedAt: string;
  columns: { name: string; unit: string }[];
  rows: number[][];
  uncertainty?: string;
  notes?: string;
}

export interface PaperHistoricalContext {
  problemIn1904: string;
  shelf: ShelfItem[];                // the same list the discovery path uses
  parallelWork: { who: string; when: string; what: string; relation: "prior" | "simultaneous" | "later-independent"; source: string }[];
  reception: { who: string; when: string; what: string; source: string }[];   // Planck, Lenard, Kaufmann, Perrin, Millikan, Bucherer
  confirmations: { what: string; who: string; when: string; source: string }[];
  disputes: { claim: string; claimant: string; whatTheyActuallyWrote: string; assessment: string; sources: string[] }[];
  aftermath: string;
  sideNotes: string[];
  whatEinsteinGotWrongOrLeftOpen: { where: string; what: string; laterUnderstanding: string; source: string }[];
}
```

Invariants enforced by `verify-corpus.ts` and the edition tests:

- `germanEdition` and `englishEdition` have the same number of paragraph
  blocks; `alignment.blocks` is a bijection on them; every German sentence
  id maps to at least one English sentence id.
- `readings` has an entry for every paragraph id with all four levels
  non-empty; as a heuristic gate, L2 is at least twice the length of L1
  for any paragraph that contains an equation, overridable per paragraph
  with a recorded reason.
- Every `equation` block in the German edition has a `PaperEquation`;
  every `PaperEquation.sourceAnchor` resolves.
- `heroQuote.anchor` resolves and the German string is a substring of the
  edition text at that anchor.
- `results[].printedStatement` is read from the edition (a helper like
  `manualClaimText`); no literal source text is retyped in `results`.
- `PaperHistoricalContext.disputes[].whatTheyActuallyWrote` is non-empty
  for every dispute (no dispute is listed without the primary text).
- Every `ShelfItem.latestYear` is $\le 1904$, except items carrying
  `parallelWork: true`.
- Every `equation` block in the English edition is byte-identical in
  `latex` to its aligned German block: the translation never alters the
  mathematics.
- Every `InstrumentSpec.notModeled` is non-empty (an instrument that models
  everything is lying), every `probes` entry names an existing result, and
  every `historicalDatasets` id resolves to a `HistoricalDataset` with a
  citation.
- Every `Misconception.anchors` entry resolves, and every paper has at
  least five misconceptions in the ledger (§6.6).
- Every `PaperEquation` passes the build-time dimensional-consistency check
  (§15): the units declared on its variables combine to the same dimension
  on both sides of the equals sign.

---

## 12. Physics Architecture

### 12.1 One bus per paper

`usePaperPhysics(paperId)` is the renamed `usePatentPhysics`. Controls are
registered per instrument in `PAPER_PHYSICS_REGISTRY[instrumentId]`, but
parameters live in the paper's bus, so a control id that appears in two
instruments is one number. Cross-paper sharing (paper 3's `vOverC` used by
paper 4's I4.1) goes through `paramAliases.ts` exactly as Classic Patents
aliases a HUD slider to a registry control; the alias declares which paper
owns the parameter.

### 12.2 Kernels own the law

Each instrument has a pure step in `src/physics/kernels/`:

```
src/physics/kernels/
├── blackbodyKernel.ts          # planck, wien, rayleighJeans, wienDisplacement, stefanBoltzmann, wienEntropy
├── boltzmannCountingKernel.ts  # microstate probabilities, lnW
├── photoelectricKernel.ts      # kMax, stoppingPotential, thresholdFrequency, currentSketch; metal cards
├── brownianKernel.ts           # stokesEinsteinD, meanDisplacement, apparentSpeed, osmoticBalance, langevinStep
├── diffusionKernel.ts          # gaussian propagator; wraps the fs-generic diffusion1d_frames export; TS FTCS fallback with the same stability refusal
├── randomWalkKernel.ts         # wraps fs-generic brownian_frames; TS fallback is a bit-identical Philox4x32-10 port (see §12.4), never an LCG
├── philox.ts                   # Philox4x32-10 in TypeScript, cross-checked against fs-rand vectors in a test
├── lorentzKernel.ts            # boost matrix, gamma, rapidity, compose, contraction, dilation, desync
├── simultaneityKernel.ts       # clock sync round trips, train-and-platform arrivals
├── fieldTransformKernel.ts     # E/B mixing, dipole field, EMF in either frame
├── lightComplexKernel.ts       # doppler, aberration, energy ratio, mirror pressure
├── electronDynamicsKernel.ts   # longitudinal/transverse mass under either force definition, W
├── massEnergyKernel.ts         # two-pulse ledger, binomial terms, box recoil, mass budget cards
└── suspensionViscosityKernel.ts# 1+phi vs 1+2.5phi, N from sugar data
```

Rules inherited verbatim: React never re-derives a number the kernel
emits; host-fed time through `TickScheduler`; no `Math.random` in any frame
loop (the walk uses the seeded stream); refusal is a museum label (the RJ
integral, a metal card without provenance, a mass-budget card without a
citation, $v \ge c$ on a boost slider) and the last legal state is kept.

### 12.3 Determinism and tapes

`controlTape.ts` is reused. Every instrument with state (the random walk,
Perrin's microscope, the Langevin loop, the box) records a tape with model
identity, seed, quantized control events, and checkpoints with a digest
(`host:` until `fs-blake3` is bound, then `blake3:`). Authored teaching
tapes replace the Wright and Lamarr sequences: "Einstein's 0.8 micron",
"Perrin's count", "the boost to 0.6c", "the two pulses".

### 12.4 FrankenSim binding

Compose the generic crates that own the law; do not wait for a packaged
`fs-einstein` module. `fs-wasm` already depends on `fs-rand` (Philox
streams, `StreamKey`, `next_normal`) and `fs-sparse` (CSR Laplacians), so
three small exports are added to it and shipped in `/wasm/fs-generic/`
alongside the existing `poisson2d`, `fft_power_spectrum`, `qmc_vs_mc`, and
friends. The existing `heat_frames` export was checked and is **not** used:
it is a fixed 2D two-blob demonstration with a hard-coded initial field and
a dimensionless time step, with no diffusion coefficient, grid spacing, or
profile parameter, so it cannot honestly stand behind an instrument whose
sliders are $D$, $\Delta x$, $\Delta t$, and an initial profile.

```rust
// crates/fs-wasm/src/lib.rs (additions)

/// Deterministic 1D random-walk trajectories for `n_particles` over `steps`
/// intervals, step kernel selected by `kernel` (0 = ±1 coin, 1 = uniform,
/// 2 = Gaussian, 3 = Gaussian with the exact D so that <x^2> = 2 D t).
/// Uses fs-rand Philox streams keyed by (seed, particle index) so any
/// particle can be regenerated independently. Returns a flat f64 buffer
/// [n_particles * (steps + 1)] of positions. No std::time on wasm32.
pub fn brownian_frames(n_particles: usize, steps: usize, kernel: u32, seed: u32, diffusion: f64, dt: f64) -> Vec<f64>;

/// Philox-stream standard-normal samples for the microstate counter and
/// Perrin's microscope. Returns `count` samples for stream (seed, index).
pub fn philox_normals(seed: u32, index: u32, count: usize) -> Vec<f64>;

/// Explicit (FTCS) 1D diffusion on `n` cells with spacing `dx`, coefficient
/// `diffusion`, time step `dt`, initial profile `profile` (0 = spike,
/// 1 = step, 2 = two spikes), zero-flux boundaries. Uses the fs-sparse
/// three-point Laplacian. Returns `frames * n` values. If
/// `diffusion * dt / dx^2 > 0.5` the scheme is unstable and the function
/// returns an empty buffer as a typed refusal; the host shows the refusal
/// instead of a blown-up field.
pub fn diffusion1d_frames(n: usize, frames: usize, steps_per_frame: usize, diffusion: f64, dx: f64, dt: f64, profile: u32) -> Vec<f64>;
```

All three compile natively (rlib) and to wasm (cdylib) like the existing
exports, get tests in `crates/fs-wasm/tests/`, are included in the slim
`fs-generic` artifact (the donor never copies the full `fs-wasm` package),
and are digest-pinned in the site's `wasmArtifacts.test.ts`.

**Bit-identical fallback.** The TypeScript fallback for the walk is not an
LCG "in the spirit of" Philox; it is a port of Philox4x32-10 with the same
`StreamKey` derivation as `fs-rand`, cross-checked in a test against
vectors emitted by the Rust crate. When the port passes, a trajectory has
the same digest whether WASM loaded or not, and the HUD says
`ts-fallback (Philox, bit-identical)`. If the cross-check ever fails, the
label falls back to `ts-fallback (Philox port unverified)` and the digest
is prefixed `host:`. The diffusion fallback is the same FTCS scheme in
TypeScript with the same stability refusal.

`fs-blake3` is used for tape digests through the generic surface once it is
exported. Nothing else in the corpus needs WASM: every other instrument is
closed-form and is labeled `closed-form host`. That label is not a
deficiency; the papers are closed-form.

The crate map is documented in `docs/FRANKENSIM_BINDING.md` in the new
repository, mirroring `docs/FRANKENSIM_WASM_INTEGRATION_TODO.md`.

### 12.5 Regression numbers (kernel tests)

| Kernel | Input | Expected | Source |
|---|---|---|---|
| `wienEntropy` | $E$, $\nu$, $V/V_0 = 0.5$ | $S - S_0 = (E/h\nu)k_B\ln 0.5$ | paper 1 §4 |
| `avogadroFromPlanck` | Planck's $\alpha$, $\beta$, $L$ as printed | $6.17\times10^{23}$ within rounding | paper 1 §2 |
| `stoppingPotential` | $\nu = 1.03\times10^{15}$ Hz, $P = 0$ | $\approx 4.3$ V | paper 1 §8 |
| `meanDisplacement` | $a = 0.5\,\mu$m, $\eta = 1.35\times10^{-3}$, $T = 290.15$ K, $t = 1$ s / $60$ s | $0.79\,\mu$m / $6.1\,\mu$m | paper 2 §5 |
| `apparentSpeed` | $\tau \to \tau/4$ | doubles | paper 2 §4–5 |
| `boost` | $v/c = 0.6$ | $\gamma = 1.25$; $\det = 1$; eigenvalues $2$ and $0.5$ | paper 3 §3 |
| `compose` | $0.6c$ then $0.6c$ | $0.8824c$ (= $15/17$) | paper 3 §5 |
| `dilationSecondOrder` | $v/c = 10^{-4}$ | $\tfrac{1}{2}v^2/c^2 = 5\times10^{-9}$ | paper 3 §4 |
| `energyRatio` vs `dopplerRatio` | any $v$, $\varphi$ | equal to $10^{-12}$ | paper 3 §8 |
| `twoPulseMassDrop` | $L$, any $v < 0.1c$ | the mass inferred from $\tfrac{1}{2}\Delta m\,v^2 = L(\gamma - 1)$ equals $L/c^2$ within $\tfrac{3}{4}(v/c)^2$ relative (from $2(\gamma-1)/x = 1 + \tfrac{3}{4}x + \ldots$, $x = v^2/c^2$) | paper 4 |
| `molecularDimensionsN` | Einstein's sugar data with $1+\varphi$ / $1+2.5\varphi$ | $2.1\times10^{23}$ / $6.6\times10^{23}$ | dissertation 1905 / 1911 |

---

## 13. Threads, Timeline, and the Bern Bridge

### 13.1 Threads (`/threads`)

Cross-paper pages with their own tiered readings and instruments:

1. **Boltzmann's principle, twice.** $S = k\ln W$ carries paper 1 (§5–6)
   and underlies paper 2 (§2's free-energy argument). One capsule, two
   papers.
2. **Counting atoms three ways.** Radiation (paper 1 §2), Brownian
   displacement (paper 2 §5), and sugar viscosity plus diffusion (the
   dissertation). The Avogadro Lab (IT.1).
3. **Light as the instrument.** Paper 3 defines time with light signals,
   paper 4 weighs energy with light pulses, paper 1 says light comes in
   quanta. The Light Thread (IT.2).
4. **The one formula that leaves paper 3.** The §8 energy transformation is
   paper 4's only input. The equation genealogy graph crosses the paper
   boundary here.
5. **Einstein's own toolkit.** His 1902–1904 papers on the foundations of
   statistical mechanics (energy fluctuations, the meaning of temperature)
   are the private preparation for papers 1 and 2. Summarized, cited, not
   reproduced.
6. **The Olympia Academy shelf.** Mach, Hume's *Treatise*, Poincaré's
   *Science and Hypothesis*, Pearson's *Grammar of Science*, Mill, Spinoza,
   Dedekind, Clifford. What each contributed to the 1905 way of asking
   questions (with the caveat that influence is argued, not measured).
7. **What he got wrong or left open.** Transverse mass; the equator clock;
   the additive constant; the viscosity factor; the heuristic status of the
   quantum. Collected from the historian's margins so a reader can see
   that the year's papers were produced by a person.

### 13.2 The Avogadro Lab

One instrument with three panels driven by three kernels, one shared
readout of $N$, the modern exact value $6.02214076\times10^{23}$ drawn as a
line, and a slider for each panel's dominant uncertainty (Planck's $\alpha$,
the measured $\lambda_x$, the viscosity factor). The lab's point is that an
unseen quantity became measurable from three unrelated directions within
one year, and that two of the three were wrong at first by known amounts.

### 13.3 Timeline (`/timeline`)

Two interleaved tracks:

- **1905, week by week.** 17 March (paper 1 dated), 18 March (received),
  30 April (dissertation dated), mid-May (letter to Habicht promising four
  papers), 11 May (paper 2 received), 9 June (paper 1 published), 30 June
  (paper 3 received), 18 July (paper 2 published), 20 July (dissertation
  submitted to the University of Zurich), 26 September (paper 3 published), 27 September (paper 4
  received), 21 November (paper 4 published). Plus the patent office
  promotion of 1906 and the habilitation attempts, as context cards.
- **The long arc, 1729–1926.** Bradley, Brown, Fizeau, Maxwell, Hertz,
  Michelson–Morley, Lorentz, Poincaré, Planck, Lenard, Sutherland, Perrin,
  Millikan, Bucherer, Ives–Stilwell, the 1921 Nobel citation (for the
  photoelectric law, not relativity), Perrin's 1926 Nobel. Each card is
  dated and sourced; nothing after 1904 appears on a discovery-path shelf.

### 13.4 The Bern bridge (`/bern`)

Einstein examined electromechanical patents at the Federal Office for
Intellectual Property from June 1902 (provisional), permanently from 1904,
promoted to Technical Expert II class in 1906, leaving in 1909. This page:

- Describes the job with sources (the CPAE editorial notes; Galison's
  argument about clock-coordination patents and the simultaneity
  definition, presented as an argument, not a fact).
- Links to the era's machines on `classic-patents.com`: Marconi
  (US 586,193, 1897), Fessenden (US 706,737, 1902), Tesla's transformer
  (US 593,138, 1897), the Wright Flyer (filed March 1903), and the
  Einstein–Szilárd refrigerator (US 1,781,541, 1930) as the one patent
  Einstein's name is on in that catalogue.
- Receives a reciprocal link from the Classic Patents Einstein–Szilárd page
  and About page.

---

## 14. Routes, Layout, and Visual Design

### 14.1 Routes (App Router only; no `src/pages`, ever)

| Route | Page |
|---|---|
| `/` | Hero: the four papers as four broadsides with German title, English title, citation, one sentence, and a live micro-instrument each (a Wien curve, a random walk, a tilting simultaneity line, the two pulses). Depth Dial introduction. The count note (four or five). |
| `/papers/[id]` | The reading engine (§5) with `?view=` and `?depth=` |
| `/papers/[id]/discover` | The discovery path (also reachable as `?view=discover`) |
| `/papers/[id]/instruments` | All instruments for the paper on one page with the tape scrubber |
| `/tours` and `/tours/[id]` | The three attention-budget tours (§6.7) with local progress |
| `/embed/instrument/[id]` | A single instrument with attribution, for embedding (§8.6) |
| `/kitchen` | The home Brownian-motion protocol and the video-loading Perrin instrument (§6.10) |
| `/toolkit` and `/toolkit/[capsule]` | Prerequisite capsules; `/toolkit/notation` is the full bridge |
| `/threads` and `/threads/[id]` | Cross-paper pages and the Avogadro Lab |
| `/timeline` | Two-track timeline |
| `/bern` | The patent office bridge |
| `/glossary` | Period vocabulary and notation, searchable |
| `/about` | Mission, editorial method, translation policy, rights, repository, how to cite |
| `/papers/[id]/opengraph-image`, `twitter-image` | Generated cards with the German title and a static rendering of the paper's signature equation |
| `sitemap.ts`, `robots.ts`, `error.tsx`, `global-error.tsx`, `not-found.tsx` | Inherited |

Static generation for all paper routes via `generateStaticParams`; the
edition and readings are server-rendered; instruments are client components
loaded with `dynamic(..., { ssr: false })` and an honest loading state.
First-load JavaScript budget: home under 200 kB, paper detail under 700 kB,
matching the Classic Patents post-optimization figures; the editions are
delivered as server-rendered HTML, not as a client bundle.

### 14.2 Themes

Three, switchable like Parchment / Blueprint / Obsidian:

1. **Annalen** (default light). Journal cream, black ink, red only for
   emphasis and the "move" step, generous margins, the running-head feel of
   a 1905 journal page. Fonts: Newsreader for body prose and the
   translation, JetBrains Mono for telemetry, KaTeX's own fonts for
   mathematics. The German masthead is set to match the facsimile's
   typography as closely as the fonts allow, and no more.
2. **Kramgasse Night** (dark). Deep slate with warm lamplight amber for
   accents and equation highlights; the reading theme for evening.
3. **Slate** (derivation mode). A chalkboard theme for the derivation chains
   and discovery paths: the nine equation colors become chalk tints, the
   move step is boxed in chalk, and the instrument canvases invert. Chosen
   automatically on the `discover` face unless the reader has set a theme.

Tailwind tokens extend the donor's `parchment`, `ink`, and `canvas` with
`annalen-*` (cream scale), `lamp-*` (amber scale), and `chalk-*` (chalk
tints for the nine equation colors). Contrast is checked at AA for every
color pair used for text.

### 14.3 Layout of a paper page (reading face)

Desktop: a three-column page. Left rail: the paper's outline (sections,
results, instruments) with the reader's position. Center: the reading at
the current depth with equations and instruments in place. Right rail: the
source sentence for the current paragraph (German, then English) that
follows scroll, the notation strip, and the Depth Dial. At 320 px: the rails
collapse to a bottom sheet and a top bar; instruments stack; the Depth Dial
becomes a segmented control in the header.

---

## 15. Search, Accessibility, Performance, SEO

- **Search (⌘K).** Indexes sections, sentences (German and English),
  equations by symbol and by printed number, results, instruments,
  capsules, glossary terms, timeline cards, and people. A query of `βν`
  finds the quantum energy; `0.8 μ` finds §5 of paper 2; `Besso` finds the
  closing line of paper 3.
- **Accessibility.** KaTeX renders MathML alongside HTML; every equation
  card has a plain-text alternative built from the colorized sentence;
  every instrument has a keyboard-operable textual relationship readout
  (inherited pattern); `prefers-reduced-motion` pauses random walks and
  boosts and shows the current state; color is never the only carrier of
  meaning (the color-blind mode adds symbols).
- **Performance.** Server-rendered editions; instruments code-split per
  paper; the `fs-generic` WASM fetched once and only when an instrument
  that uses it mounts; capability probe for `crossOriginIsolated` with a
  visible compatibility line, never a hard requirement.
- **SEO.** Each paper route has metadata in both languages, `hreflang`
  alternates for the `german` and `english` faces, JSON-LD
  `ScholarlyArticle` with the Annalen citation and DOI, and a citation
  block ("How to cite this edition") on the About page and each paper.
- **Mathematics rendered at build time.** Every equation in the editions
  and readings is rendered with `katex.renderToString` (HTML plus MathML)
  during static generation, so the reading faces need no client-side
  KaTeX to display; only the live colorized equation cards hydrate. This
  cuts first-load JavaScript and makes the editions readable with
  JavaScript off.
- **Equation speech text.** Each `PaperEquation` carries an authored
  spoken form (in the style of ClearSpeak) as its accessible name, because
  auto-generated MathML speech is often wrong for physics notation
  ("beta" vs "the stretch factor"). The colorized sentence is the
  fallback.
- **Dimensional-consistency gate.** A build-time check evaluates the
  declared `dimension` of every variable in every `PaperEquation` and
  fails if the two sides of the equation do not agree (using the donor's
  `qty.ts` conventions). It catches editorial errors and doubles as a
  teaching tool: the reader can hover any term to see its units.
- **Exercise checking without a CAS.** Exercises that ask for an
  expression are checked by numerical equivalence: the reader's expression
  and the reference are evaluated at a fixed set of random points and
  compared within tolerance (the technique expression checkers use).
  Exercises that ask for a number are checked by the kernel with a stated
  tolerance. No answer is stored as a string.
- **Search index.** Built at static-generation time as a client-side index
  (MiniSearch or FlexSearch over the segmented sentences, equations by
  symbol and printed number, results, instruments, capsules, glossary,
  timeline), so ⌘K works offline and without a server.
- **Offline.** A service worker caches the reading faces, editions,
  instruments, and the `fs-generic` WASM after first visit, so the site
  works on a train, in a classroom without reliable connectivity, and in
  places where bandwidth is expensive. Pages stay light: no hero video, no
  web fonts beyond the three families and KaTeX.
- **Clarity signal.** Under every paragraph a one-click "this was clear /
  this was not" control records the depth level and anchor, aggregated
  without cookies, identifiers, or IP retention. It is the one analytic the
  site keeps, because it tells editors exactly where L2 fails, and its
  weekly summary is published on the About page.
- **Privacy.** No third-party scripts, no fingerprinting, no advertising,
  no accounts. Local progress, tours, and predictions stay in
  `localStorage` and can be exported or cleared.

---

## 16. Editorial Pipeline, Tests, and Definition of Done

### 16.1 Pipeline scripts

```
scripts/
├── download-facsimiles.ts       # fetch and pin the Annalen scans; refuse to replace a pinned file
├── ocr-ledgers.ts               # orchestrate bounded cloud jobs only; never local OCR
├── segment-ledger.ts            # sentence ids for the reviewed German ledger
├── align-editions.ts            # build and check the alignment map
├── verify-corpus.ts             # the invariants of §11 plus Rules 0–2
├── audit-depth.ts               # readings present at all four levels; L2 length rule
├── audit-equations.ts           # every printed equation has a PaperEquation with a resolving anchor
├── audit-instruments.ts         # every instrument has a registry entry, a probe, a tape identity, a kernel test
├── audit-shelf.ts               # no shelf item after 1904 unless flagged parallel
├── audit-misconceptions.ts      # at least five per paper; every anchor and instrument resolves
├── audit-dimensions.ts          # dimensional consistency of every PaperEquation
├── extract-kernel-source.ts     # pins each instrument to its kernel function's source hash for "Show the code"
├── build-search-index.ts        # static client-side search index
├── digitize-datasets/           # CSV plus citation for every HistoricalDataset, with a validation test
├── e2e-paper-vertical-slices.ts # Playwright: every face, every depth, 320 px, keyboard, reduced motion
└── verified-production-deploy.ts# inherited release workflow, pointed at annus-mirabilis.com
```

### 16.2 Tests

- `src/data/editions/<paper>Edition.test.ts`: SHA-256 pinned to the
  facsimile bytes; the German edition text is contained in the ledger; the
  edition contains no page markers; the alignment map is a bijection on
  paragraphs; every sentence maps; term definitions are longer than 80
  characters; the hero quote resolves.
- `src/data/papers/<paper>.test.ts`: results read from the edition;
  readings at all levels; every equation anchor resolves; dispute entries
  have primary text; shelf years.
- `src/physics/kernels/*.test.ts`: the regression table of §12.5 plus
  invariants (determinant 1, $U < c$, $E'/E = \nu'/\nu$, $\lambda_x \propto \sqrt{t}$,
  histogram variance within tolerance of $2Dt$ for a fixed seed).
- `src/physics/wasmArtifacts.test.ts`: pins the `fs-generic` digests,
  instantiates the module, steps `brownian_frames`, `philox_normals`, and
  `diffusion1d_frames`, checks the seeded trajectory digest against the
  TypeScript Philox port (they must be bit-identical), checks the
  malformed-output rejection and the stability refusal, and checks that the
  fallback label is never `wasm`.
- `src/components/.../dispatcher.test.ts`: every instrument id has an
  explicit case; no fallback to another paper's instrument.
- `scripts/app-router-architecture.test.ts`: inherited; fails on
  `src/pages`.

### 16.3 Definition of done (per paper)

A paper is publishable only when all of the following hold:

1. Provenance receipt with scan source, rights statement, SHA-256, page
   count, page map to sections and numbered equations, comparison editions,
   and translation credits.
2. Pinned facsimile, reviewed German ledger with page markers and anchors,
   German edition, English edition, and alignment map share one SHA-256 and
   pass the edition test.
3. Every paragraph has readings at L0, L1, L2, L3. Every equation printed in
   the paper has a `PaperEquation` with a notation bridge and, where the
   paper derives it, a derivation chain with the move marked.
4. Every result in §7 has a `PaperResult` with a decoder and, where the
   table says so, a live probe.
5. Every instrument in §8 for that paper exists, has an explicit dispatcher
   case, shares the paper's bus, records a tape, passes its kernel
   regression, labels its kernel source honestly, works at 320 px, by
   keyboard, and with reduced motion.
6. Both discovery-path doors exist (or the receipt explains why only one is
   possible), every shelf item is dated and sourced, every fork has at
   least one worked non-paper branch, every check step computes live.
7. Historical context includes parallel work, reception, confirmations
   with dates, and the "what he got wrong or left open" entries required
   by §3's editorial boundaries.
8. The misconception ledger has at least five entries with instruments;
   every instrument declares `notModeled`, has predict mode or a recorded
   exemption, shows its code, and is embeddable; every historical dataset
   it overlays has a citation; every equation has speech text and passes
   the dimensional gate.
9. `verify-corpus`, typecheck, lint, format, build, `ubs --diff`, and the
   Playwright vertical slice are green; the editorial acceptance (German
   fidelity, translation accuracy, L2 readability by a non-physicist
   reviewer, the fifteen-minute tour completed by a reader with no physics
   background who can then state the paper's claim in one sentence) is
   recorded separately in the receipt.

### 16.4 AGENTS.md for the new repository

Copy the donor file. Keep Rules 0, 1, 2, the git safety chapter, the branch
policy, the cloud-OCR-only chapter, the FrankenSim honesty chapter (§5b of
the donor), the Three.js chapter, the Vercel chapter, Beads, Agent Mail,
code quality, and "landing the plane". Replace the mission and the "How to
add a new patent" chapter with:

- "How to add or revise a paper section" (edition block, alignment,
  four readings, equations, anchors, tests).
- "How to add an instrument" (kernel first, registry, dispatcher case,
  probe, tape identity, regression number, 320 px, reduced motion).
- "How to add a discovery-path step" (shelf date rule, fork rule, worked
  branch rule, check-step must compute live).
- "Editorial voice" (§6.5 of this plan), including the L2 test: a
  physician who has not used a derivative since 1998 can follow it.

---

## 17. Deployment and Domain

### 17.1 Hosting

Vercel, via the inherited `verified-production-deploy.ts` workflow, pointed
at `annus-mirabilis.com`, `www.annus-mirabilis.com`, and a stable
`annus-mirabilis.vercel.app` alias. `vercel.json` keeps
`{"git": {"deploymentEnabled": false}}`. The smoke test exercises
`/papers/ap-18-639-mass-energy` (the shortest paper, so the check is fast)
and its German edition endpoint before aliasing.

### 17.2 Cloudflare

The domain is registered at Cloudflare and Cloudflare is the DNS host.
Recommended configuration for launch:

- Apex `A` record and `www` `CNAME` per Vercel's current domain
  instructions, **DNS-only (grey cloud)** for both. This lets Vercel manage
  certificates and edge caching without a second proxy layer in front of
  it. Proxied mode (orange cloud) can be enabled later if Cloudflare's WAF
  or analytics are wanted, with SSL mode set to Full (strict) and Vercel's
  documented caveats reviewed at that time.
- CAA records permitting Vercel's certificate authority if any CAA records
  exist on the zone.
- DNSSEC on (Cloudflare registrar supports it) once the records are stable.
- Email: none, or a null `MX` plus SPF `v=spf1 -all` and a DMARC reject
  policy so the domain cannot be spoofed.

Cloudflare Pages or Workers hosting through an OpenNext adapter is a
possible future move but is out of scope for launch: the release script,
its lock, its prebuilt-artifact validation, and the smoke test are all
Vercel-shaped, and re-validating them is not free.

### 17.3 Repository

`gh repo create Dicklesworthstone/annus-mirabilis.com --public`, MIT with
the same rider, README modeled on the donor's (TL;DR, the four papers table,
architecture box, getting started, verification, license), and this plan
committed as the master document.

---

## 18. Phased Execution Plan

The build order is chosen so that the shortest paper exercises the whole
vertical slice first, the paper with the best simulations comes second, and
the largest paper last.

- **Phase 0: Decisions and seed (1 week).**
  - Confirm the count (four on the hero, five in the catalogue; §3.6).
  - Confirm the translation policy (§4.1).
  - Create the repository; copy the kernel modules of §2.1; rename ids;
    strip the catalogue; get `bun run typecheck`, `lint`, `build`, and the
    architecture test green with an empty corpus.
  - Write `AGENTS.md` (§16.4), `README.md`, this plan, `LICENSE`.
  - Add `brownian_frames`, `philox_normals`, and `diffusion1d_frames` to
    `fs-wasm` in the FrankenSim repository with tests; include them in the
    slim `fs-generic` artifact build; port Philox4x32-10 to TypeScript and
    pin cross-check vectors; rebuild `/wasm/fs-generic/`; pin digests.

- **Phase 1: Paper 4, the pilot (2 weeks).** Three pages, no sections, one
  central result. Pin the facsimile, produce the German ledger (cloud OCR,
  hand-corrected), author the German and English editions and the
  alignment map, write all four reading levels for every paragraph, the
  equation cards with the derivation chain, the four instruments (I4.1–I4.4
  with the Threads-side I4.2) with predict mode and show-the-code, both
  discovery doors, the misconception ledger, the interlinear gloss face,
  the fifteen-minute tour, the historian's margin on the constant $C$ and
  the priority claims, the receipt, the tests.
  Deploy to the Vercel alias only. This phase proves the model end to end
  and produces the first editorial acceptance review with a non-physicist
  reader.

- **Phase 2: Paper 2, Brownian motion (4 weeks).** The WASM-backed
  instruments (I2.1, I2.2, I2.5), the Stokes–Einstein dial with Einstein's
  printed viscosity, the velocity trap, the physician's door, the
  programmer's door (Langevin, labeled 1908), Perrin's overlay with sources,
  the kitchen experiment and its video-loading instrument. The Avogadro Lab
  stub. Public launch candidate: two papers live.

- **Phase 3: Paper 1, light quanta (4 weeks).** The blackbody explorer, the
  entropy-volume instrument, the microstate counter, the photoelectric
  bench with metal cards and the Millikan overlay, Stokes' rule, the
  Avogadro-from-radiation readout. The Planck-branch fork worked with care.

- **Phase 4: Paper 3, electrodynamics (6 weeks).** The largest text (31
  pages, two parts). Kinematical part first (I3.1–I3.5, the matrix side
  door), then the electrodynamical part (I3.6–I3.9), then the shelf
  instruments (I3.10, I3.11). The equation genealogy graph. The equator-
  clock and transverse-mass margins. Cross-paper alias to paper 4's bus.

- **Phase 5: Companion and Threads (3 weeks).** The dissertation record,
  I5.1 with Bancelin's data, the full Avogadro Lab, the seven Threads, the
  timeline, the Bern bridge with the reciprocal link from Classic Patents,
  the glossary.

- **Phase 6: Depth and polish (3 weeks).** L2 rewrite pass on every
  paragraph with an outside reader per persona; capsule instruments; the
  gloss face extended to every paper's introduction and key sections; the
  one-evening and full-course tours; embeds and tape permalinks; offline
  support; the clarity signal; the optional Three.js spacetime block; OG
  images; performance budget audit; full Playwright matrix; the "how to
  cite" block.

- **Phase 7: Launch.** Verified production deploy to the apex; announce;
  open issues for translation corrections with the sentence id as the
  required field.

Later (not scheduled): audio reading of the English face; a printable
"broadside" per paper; the 1906 Brownian follow-up and the 1907 review
article as further companion records; other-language faces contributed by
the community against the same alignment map.

---

## 19. Risks and Open Decisions

| Risk or decision | Position in this plan | Owner call needed |
|---|---|---|
| Four or five papers | Four on the hero, five in the catalogue, the count explained | Confirm |
| Reusing a historical English translation | Not reused; new translation from the German; historical translations as receipt evidence | Confirm (or supply counsel's view) |
| Scan rights for the pinned facsimile | Prefer scans with stated open terms; record the statement; the text itself is public domain | Confirm the chosen scan source per paper |
| Translation authorship | Model-drafted, human-reviewed sentence by sentence against the German, with the reviewer named in the receipt | Decide who reviews |
| L2 quality | The hardest deliverable; reviewed by a non-physicist reader per persona before a paper is marked done | Recruit readers |
| Scope creep into biography or general relativity | Excluded by §1.4; the historian's margin stops where 1905 stops | Hold the line |
| Presenting superseded results (transverse mass, equator clock) | Shown as printed on the source face; caveated at L3; never silently corrected | Confirm |
| Priority disputes | Presented with primary text only, no scorekeeping | Confirm tone |
| Instruments that are "just formulas" | Labeled `closed-form host`; that is the honest label for closed-form physics; WASM only where a crate owns the law (random streams, diffusion frames) | Accept |
| Hosting on Vercel with Cloudflare DNS | DNS-only records at launch; proxied later if wanted | Confirm |
| Cloud OCR of German mathematical typesetting | Bounded jobs, hand correction, mathematics retyped by the editor | Accept the cost |
| Cross-site links with Classic Patents | Bern page here, Einstein–Szilárd and About there | Schedule the donor-side change |
| Generated explanations | Model-drafted prose is reviewed before it ships; there is no live language-model generation on the site at launch, no chatbot, and every explanation has a named reviewer in the receipt | Confirm |
| Reproducing a textbook myth | The required historian's-margin entries of §3.7 and the misconception ledger of §6.6 are audited per paper | Accept |
| Home experiment safety and expectations | Milk, ink, water only; the protocol states the uncertainty up front so a reader who gets $N = 2\times10^{23}$ learns about polydispersity rather than concluding the physics is wrong | Accept |
| Reading-face HTML weight from four rendered depths | 250 kB gzipped budget with JSON fragment fallback (§6.2) | Accept |
| Photographs and likeness | None without cleared terms; branding uses the year, not the name (§4.1) | Confirm |

---

## 20. Appendices

### 20.1 Primary sources

- A. Einstein, *Annalen der Physik* (4) 17 (1905) 132–148; 549–560;
  891–921. *Annalen der Physik* (4) 18 (1905) 639–641. *Annalen der Physik*
  (4) 19 (1906) 289–306 and 34 (1911) 591–592.
- *The Collected Papers of Albert Einstein*, Vol. 2, *The Swiss Years:
  Writings, 1900–1909* (Princeton, 1989), documents 14, 15, 16, 23, 24, with
  editorial notes; the English translation supplement (A. Beck) for
  comparison only.
- Letter to Conrad Habicht, May 1905 (CPAE Vol. 5), promising four papers
  and calling the first "very revolutionary".
- H. A. Lorentz, *Versuch einer Theorie der electrischen und optischen
  Erscheinungen in bewegten Körpern* (1895); "Electromagnetic phenomena in
  a system moving with any velocity smaller than that of light", Proc.
  Royal Netherlands Acad. (1904).
- H. Poincaré, "La mesure du temps", Revue de métaphysique et de morale
  (1898); "La théorie de Lorentz et le principe de réaction", Archives
  néerlandaises (1900); the St. Louis address (1904); "Sur la dynamique de
  l'électron", Comptes rendus (5 June 1905) and Rendiconti del Circolo
  Matematico di Palermo (1906).
- M. Planck, Verhandlungen der Deutschen Physikalischen Gesellschaft (1900),
  the October and December papers; *Annalen* 4 (1901) 553.
- P. Lenard, *Annalen* 8 (1902) 149.
- W. Sutherland, Phil. Mag. 9 (1905) 781.
- J. Perrin, *Annales de chimie et de physique* 18 (1909) 5 ("Mouvement
  brownien et réalité moléculaire"); Nobel lecture 1926.
- R. A. Millikan, Phys. Rev. 7 (1916) 355.
- A. H. Bucherer, Phys. Z. 9 (1908) 755. H. E. Ives and G. R. Stilwell,
  J. Opt. Soc. Am. 28 (1938) 215.
- P. Langevin, Comptes rendus 146 (1908) 530.
- H. E. Ives, J. Opt. Soc. Am. 42 (1952) 540; J. Stachel and R. Torretti,
  Am. J. Phys. 50 (1982) 760.
- A. Einstein, *Annalen* 20 (1906) 627 (the center-of-mass argument,
  crediting Poincaré 1900); M. Planck, Verh. Dtsch. Phys. Ges. 8 (1906) 136
  (transverse mass); M. von Laue, *Annalen* 23 (1907) 989 (Fizeau from
  velocity addition).
- L. Bachelier, Ann. Sci. École Norm. Sup. 17 (1900) 21; M. von
  Smoluchowski, *Annalen* 21 (1906) 756; F. Exner, *Annalen* 2 (1900) 843;
  G. Gouy, J. Phys. 7 (1888) 561.
- A. H. Compton, Phys. Rev. 21 (1923) 483; W. E. Lamb and M. O. Scully, in
  *Polarisation, Matière et Rayonnement* (Presses Universitaires de France,
  1969); H. J. Kimble, M. Dagenais, and L. Mandel, Phys. Rev. Lett. 39
  (1977) 691.
- T. Li et al., *Science* 328 (2010) 1673; R. Huang et al., *Nature Physics*
  7 (2011) 576 (ballistic Brownian motion).
- J. D. Cockcroft and E. T. S. Walton, Proc. R. Soc. A 137 (1932) 229;
  K. T. Bainbridge, Phys. Rev. 44 (1933) 123.
- W. Kaufmann, *Annalen* 19 (1906) 487; E. Cunningham, Proc. R. Soc. A 83
  (1910) 357 (slip correction, for the gas-card refusal).

### 20.2 Secondary sources the historian's margin may cite

A. Pais, *Subtle Is the Lord* (1982); J. Stachel (ed.), *Einstein's
Miraculous Year* (1998); P. Galison, *Einstein's Clocks, Poincaré's Maps*
(2003); J. Rigden, *Einstein 1905* (2005); J. Renn (ed.), *Einstein's
Annalen Papers* (2005); A. I. Miller, *Albert Einstein's Special Theory of
Relativity* (1981); T. S. Kuhn, *Black-Body Theory and the Quantum
Discontinuity* (1978); M. Nye, *Molecular Reality* (1972).

### 20.3 The 1905 letter, paraphrased for the timeline

In May 1905 Einstein wrote to his friend Conrad Habicht that he would send
him four papers: one on radiation and the energy properties of light, which
he called very revolutionary; one determining the true sizes of atoms from
diffusion and viscosity of dilute solutions (the dissertation); one showing
that particles of about a thousandth of a millimeter suspended in a liquid
must perform a visible random motion caused by heat; and one, still a rough
draft, on the electrodynamics of moving bodies using a modified theory of
space and time. The mass–energy paper is absent from the letter; it was
written in September.

### 20.4 Instrument-to-result cross-reference

| Paper | Instruments | Results probed |
|---|---|---|
| 1 | I1.1–I1.6 | RJ divergence; $N$ from Planck; Wien entropy; quantum inference; Stokes' rule; photoelectric equation |
| 2 | I2.1–I2.7 | osmotic pressure; force balance; $D$; diffusion equation; $\lambda_x$; inversion to $N$; the velocity trap |
| 3 | I3.1–I3.11 | synchronization; relativity of simultaneity; Lorentz transformation; contraction; dilation; velocity composition; field mixing; Doppler; aberration; energy of a light complex; mirror pressure; electron dynamics |
| 4 | I4.1–I4.4 | two-frame ledger; expansion; $\Delta m = L/V^2$; radium proposal |
| companion | I5.1 | viscosity relation; corrected $N$ |
| threads | IT.1, IT.2 | three determinations of $N$; the light thread |

### 20.5 Naming conventions

- Catalogue ids: `ap-<volume>-<first page>-<slug>`.
- Instrument ids: `<paperShort>-<slug>` (`brownian-random-walk`,
  `electrodynamics-boost-matrix`).
- Kernel functions: `step<Instrument>Si` or a pure named function
  (`stokesEinsteinD`), exported from `src/physics/kernels/`.
- Anchors: `#s<n>`, `#s<n>-p<m>`, `#s<n>-p<m>-s<k>`, `#eq-<printed>` or
  `#eq-s<n>-d<j>`, `#result-<slug>`, `#instrument-<slug>`.
- Files: `public/papers/pdfs/<id>.pdf`,
  `public/papers/transcripts/<id>-reviewed.txt`,
  `src/data/editions/<name>GermanEdition.ts`,
  `src/data/editions/<name>EnglishEdition.ts`,
  `src/data/editions/<name>Alignment.ts`,
  `src/data/papers/<name>.ts`, `src/data/readings/<name>Readings.ts`,
  `src/data/equations/<name>Equations.ts`,
  `src/data/discovery/<name>Path.ts`, `docs/provenance/<id>.md`.

---

### 20.6 Revision 1.1 change log (second-pass review, 2026-09-14)

Corrections to the 1.0 draft, recorded so a reader of the repository
history can see what was wrong and why:

1. Page count of the four papers corrected from 38 to 63.
2. Cross-reference to the companion record corrected (§3.5, not §3.4).
3. Einstein's printed Brownian example corrected: particles of $1\,\mu$m
   *diameter* ($P = 0.5\,\mu$m), which is what reproduces his $0.8\,\mu$m.
4. The `heat_frames` FrankenSim export was checked and found to be a fixed
   2D two-blob demo with no parameters; the diffusion face now specifies a
   new parameterized `diffusion1d_frames` export with a stability refusal.
   The count of new exports is three, not two.
5. The TypeScript random-walk fallback is a bit-identical Philox4x32-10
   port with cross-check vectors, not an "LCG"; the label reflects it.
6. Sutherland's *Phil. Mag.* date corrected to June 1905 (Dunedin January
   1904; misprinted proceedings early 1905). Bachelier 1900 added to the
   shelf.
7. Perrin's published range restated conservatively.
8. The regression tolerance for the two-pulse mass drop corrected from
   $\tfrac{3}{8}(v/c)^2$ to $\tfrac{3}{4}(v/c)^2$.
9. The train-and-platform illustration re-dated to Einstein's 1917 popular
   book.
10. The Depth Dial is no longer a server-read cookie; all four levels are
    statically rendered with a pre-paint switch, keeping the site static,
    indexable, and usable without JavaScript.
11. The discovery path has one canonical URL.
12. Sentence-id scheme unified as `s<n>-p<m>-s<k>`; paper 4 uses `s0`.
13. `PaperEquation` now omits the donor's `patentId` rather than inheriting
    it; `Capsule`, `InstrumentSpec`, `Misconception`, and
    `HistoricalDataset` types added; `ShelfItem` gained `latestYear` and
    `parallelWork`; the equation-identity, `notModeled`, and dimensional
    invariants added.
14. Rights section extended to letters, photographs, and the name and
    likeness.
15. Required historian's-margin entries (§3.7) added, including the point
    that the photoelectric equation alone does not establish photons.
16. The "gas" fluid card now refuses (Cunningham slip).
17. Poincaré's role in the simultaneity convention restated as fact about
    dates, not as a claim about what Einstein read.
18. The boost-matrix derivation lists the missing condition (the moving
    origin is at $x = vt$).

Additions in 1.1: the misconception ledger (§6.6), tours (§6.7), predict
mode (§6.8), show-the-code (§6.9), the kitchen experiment (§6.10),
interlinear German (§6.11), the instrument contract additions (§8.6),
build-time KaTeX, equation speech text, the dimensional-consistency gate,
numeric exercise checking, offline support, and the clarity signal (§15),
and the corresponding risks and sources.

---

*End of plan. This document is the source of truth until superseded by a
numbered revision committed to the repository.*
