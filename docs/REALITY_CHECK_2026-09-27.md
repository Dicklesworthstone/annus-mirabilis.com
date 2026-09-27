# Reality check, 2026-09-27

Measured by TanElk with five parallel investigations, on HEAD `440aebdc`. **Every claim below names
the command or the file and line that produced it.** Where a measurement could not be made, it says
so rather than guessing, and where an earlier claim in `AGENTS.md` or `README.md` is contradicted, the
contradiction is named.

This decays. Re-measure before relying on a clause.

---

## The one-sentence answer

**The site is a real, working critical edition whose reading, explanation and instrument surfaces are
far more complete than the bead count suggests — and whose verification layer has drifted out from
under it, so that six of the gates the plan relies on now run over empty or fictional populations and
report green.**

157 of 664 beads are closed (24%), and that number badly understates the product: four papers are
inventoried to the last footnote, 821 translation units and 542 gloss units cover every sentence, all
200 printed displays are coloured and explained, 33 instruments have manifests and pages, four
discovery journeys are written with fair forks and a real arithmetic grammar. It also badly overstates
the *assurance*: the artifact `AGENTS.md` names as the completeness authority reports every layer of
every paper "not started", and the validator written to enforce the discovery epistemics has never
been run on a real journey.

---

## 1. What is genuinely working

### Source layer — the strongest part of the repository

| Claim | Measurement |
|---|---|
| 6 pinned facsimiles, each matching its receipt | `shasum -a 256` recomputed for all 6 and compared to `docs/provenance/<key>.md`: **6 of 6 match, 0 mismatches.** Each receipt also records the parent volume's digest, a second legitimate identity |
| Every printed page has a home | 453 source blocks. Union of `printedPage:` locators: LQ 132–148 = **17/17**, BM 549–560 = **12/12**, SR 891–921 = **31/31**, ME 639–641 = **3/3** |
| Every printed section exists | LQ `s1`–`s9`, BM `s1`–`s5`, SR `s1`–`s10` plus `part-1`/`part-2`, ME none (correct: paper 4 has no sections). Missing-vs-expected set empty in all four |
| All 200 printed displays are records | 200 equation blocks, matching the 200 in `content/display-terms/` |
| Ledger page counts are exact | Header claim vs marker count vs printed count: 17/17/17, 12/12/12, 31/31/31, 3/3/3, no gaps in any sequence |
| Alignment is genuinely many-to-many and complete | 821 edges, **453 of 453 blocks** with at least one edge, **821 of 821 translation units** reached, **0 dangling refs in either direction**. 59 German sentences split into two English units; the 65 sentences with no sentence-level edge are all single-sentence mastheads, headings, footnotes and closings aligned at block level |
| The gloss is complete | **542 of 542** source sentence spans have a gloss, id for id, in all four papers. All 542 stamped `machine-draft` |
| The notation concordance is real work | 271 entries over 184 distinct glyphs; **all 17 scoped symbols `AGENTS.md` names are present**, including both danger collisions (Einstein's β = modern γ; his `k` = viscosity) and the paper-3 Galilean auxiliary `x'` held distinct from ξ. 16 collisions flagged. rename / unitConversion / modernization kept as three separate operation kinds |

### Explanation layer

- **210 of 210 printed paragraphs are bound and own their own R0.** Zero silently unbound. The two
  exceptions in special relativity (`s1-fn1`, `s5-p8`) carry `status: unexplained` with a written
  reason.
- **200 of 200 printed displays have an explanation record**, r0/r1/r2 on 200 of 200, each with an
  `inWords` quantity-tagged plain-English rendering. The build's own census: `mass-energy 7 of 7,
  light-quanta 52 of 52, brownian-motion 43 of 43, special-relativity 98 of 98 explained, 0 refused,
  0 missing`.
- **106 model equations on the explanation pages all carry a panel**, 71 from the bound display's
  record and 35 from the record's own words, 0 gaps.
- **R2 is real step-by-step arithmetic, not a summary.** Six passages read at random all work the
  algebra in the open, reconcile Einstein's printed symbols with the explanation's, and label their own
  limits ("That checks the arithmetic of the inversion and nothing else").
- **All 26 misconception ledgers** carry all four readings; no paper is under the required five
  (LQ 5, BM 5, ME 8, SR 8). The 9 without an instrument carry a written `staticTreatment` reason.
- **All 63 instrument captions have all four readings** — the only population where the four-reading
  promise is 100%.
- **All four first encounters exist, render, and genuinely assume no algebra**: 0 `latex` blocks in any
  of the four entrance records, enforced for the bridge lessons by `foundZeroAlgebra.shared.ts`.

### Instruments

- **33 of 33 core ids have a manifest**, and every contract field is non-empty on all 33 except
  `argumentIds` (29 of 33; bm-02, lq-03, lq-04, sr-04 lack it). `notModeled` is schema-enforced.
- **Predict mode is fully accounted for**: 28 labs have a predict affordance, 5 have recorded
  exemptions naming `am-inst-predict-mode-ti7m`, 28 + 5 = 33.
- **All six typed result statuses are produced** in real code, `symbolic` and `analytic-limit` thinly
  (10 and 7 sites) but really.
- **The refusal machinery is the best-built thing in the runtime**: 22 codes each with a reader message
  and a repair; `defineRefusalRegistry` refuses at module load a definition with empty reader language,
  or one whose text makes a physical claim (`/\b(impossible|nature|forbidden)\b/`). All 33 labs reach
  one.
- **The six command classes are real, not prose**: a discriminated union with 31 branch sites in 10
  non-test files, a six-case invariant switch, and all six used across the manifests (293 uses).
  `presentation-change` bumps no revision, never reaches the worker, and is excluded from the
  scientific digest.
- **FrankenSim now reaches three labs, not one.** `brownian_frames` → bm-01, `philox_normals` → bm-05
  (`365eec42`), `diffusion1d_frames` → bm-06 (`b4419970`). **`AGENTS.md`'s status line is stale by two
  labs.**

### Discovery

- **40 knowledge cards** with `sources`, `latestYear`, `proposition`, `status`, `admittedStages` and
  `sourceChecks` on 40 of 40. The `sourceChecks` name the agent, the date, the archive.org leaf read as
  a page image, what matched verbatim in German, and a `differs` list of corrections — one card records
  that it used to say Brown called the motion "irregular" and that he never did.
- **The 1904 boundary holds.** Exactly 2 cards have `latestYear > 1904` and **both are correctly
  flagged**: `sutherland-1905-phil-mag` as `parallel-work`, and
  `einstein-1905-light-complex-transformation` with an `admittedImport` block and a limits line reading
  "This is a 1905 result, not a 1904 one … the only step here that is not available to a reader
  standing at the end of 1904." **No unflagged anachronism.**
- **The forks are fair, which is the hardest thing in the spec.** 8 forks, 17 branches, typed outcomes:
  4 dead-end-on-constraint, 2 empirically-equivalent-not-refuted, 2 undecided, 1 correct-but-weaker, 8
  papers-route. Lorentz gets "Nothing on the shelf separates it from the paper's route, and this route
  does not call it refuted." Planck gets "Every thermodynamic result stands … it explains less, and
  what it does explain it gets right." Six branches name a real figure. Nobody is mocked.
- **The exercise checker is delivered to spec.** 418-line tokenizer plus recursive-descent parser,
  `ALLOWED_FUNCTIONS` of six, **zero `eval`, zero `new Function`, zero stored-string answer
  comparison**, equivalence at boundary plus 64 Halton plus 64 Philox points requiring ≥12 accepted per
  family, and it refuses rather than passes on a domain mismatch ("dropping points where only the
  reader's expression fails would let x/x pass for 1 on a range containing zero").
- **12 of the 13 anachronism controls are handled**, with reader-facing evidence, including Jeans's
  July 1905 constant explicitly kept off the shelf.

---

## 2. The finding that matters: six validators cannot see what they validate

This is one defect wearing six costumes, and it is the reason the bead count and the product have
drifted apart. In each case a gate exists, is well written, often has a persuasive refusal message —
and runs over a population that is empty, fictional, or made of its own fixtures.

| # | Gate | What it examines | Bead |
|---|---|---|---|
| 1 | The source manifest, which `AGENTS.md` names as **the** completeness authority | `getAbsentSourceLayers()` (`src/content/manifest/report.ts:25`) returns `state: "absent"` for all four layers **unconditionally**; it is the default argument of `generateManifestReport`, and `scripts/source-manifest-report.ts:96` calls that with one argument. `grep -rn 'state: "present"' src scripts` excluding tests matches **one line: a type literal**. The authority would print the same zeros on a finished edition | `am-4cpx` |
| 2 | `journeyChecks.ts`, 600+ lines of discovery epistemics | `rg 'checkJourney\('` → **38 call sites, all in test files**, all passing the fixture. `JOURNEY_MAP` holds one entry and it is the fixture. **No `content/journeys/`** | `am-4k0m` |
| 3 | Instrument acceptance cases | **107 of 118 refs resolve to no scenario file**; 37 appear nowhere in the repo. **All 11 refusal cases dangle**, so 0 of 33 instruments have a resolvable refusal case — the one thing the contract makes mandatory | `am-nxbq` |
| 4 | The action-contract audit | `contractAudit.ts:17` matches affordance **prose** against a modality regex. me-01's manifest and two of its actions promise readers a table; its component has **0 tables in 444 lines**. It passes | `am-jioj` |
| 5 | Show-the-code | 6 of 33 labs show any code; **85 of 105 declared kernel functions have no pin**; sr-11 mounts the panel with an empty array, so it renders nothing | `am-f3e4` |
| 6 | The readings and misconception audits | `audit-readings.ts` and `audit-misconceptions.ts` take `--fixture` and are in no gate, no npm script, no workflow — and evade `scriptReachability.test.ts` *because* the fixture argument makes them read as invoked | `am-8gbg` |

Two more of the same shape, already fixed today: `check-lab-explanations.ts` and
`check-lesson-formulas.ts` could both fail and nothing invoked either (`f0219011`), and the
mass-energy payload check compared an enriched payload against a bare render and went red on all 24
records for a reason that was not a regression (`440aebdc`).

The project's own doctrine predicted all of this, in `AGENTS.md` under **"A Tool's Exit Code Is Not
Evidence Until You Know What It Examined"** and **"A Gate's Own Test Must Not Live Only In The Lane
That Gate Controls"**. The rule was written after four instances in one session. There are now ten.

**The practical consequence, stated plainly: nobody currently knows whether the discovery epistemics
hold, whether a reader can trigger a refusal, or how complete any source layer is — not because the
answer is bad, but because the instruments that would answer are pointed at nothing.** On the evidence
of the populations I did measure by hand, the answers are mostly good, which makes this cheap to fix
and expensive to leave.

---

## 3. What is not built

Measured absent, as opposed to unverified:

- **Methodological essays**: 0 matches for `methodolog` in `src` and `content`; no `src/app/essays/`;
  0 matches for any of the 8 planned titles. `src/search/core.ts:20-36` declares `essay` as a
  `SearchType` nothing emits and `core.ts:209` allowlists an `essays` route that does not exist.
- **Capstones**: `find src content -iname '*capstone*'` → empty. Same phantom `SearchType`.
- **The Bern bridge to classic-patents.com**: **zero outbound links to classic-patents.com from any
  route.** "Bern" appears only as a photo caption on `/about/`.
- **The 1904 desk** as a place: the four per-paper shelves are real and so are three shelf labs, but
  there is no `/1904` route, and `cardRules.ts:227` emits an error naming `page: "desk-1904"`, a page
  that does not exist.
- **The tape scrubber**: 0 real matches for `scrub`; `ControlTapeRecorder` and `ControlTapeReplayer`
  have **zero non-test consumers**; the **21 authored teaching tapes** in `content/experiments/tapes/`
  are schema-valid and **replayed by nothing**.
- **`renderTime`**: 0 occurrences in `src/`. Its only occurrence in the repository is `AGENTS.md`
  itself. There is no display clock, so "scientific stepping and display interpolation on separate
  schedules" is unimplemented.
- **The instance registry**: `store/registry.ts` and `store/useExperimentSnapshot.ts` implement and test
  exactly the no-duplicate-owner and reattach guarantees the runtime contract demands, and **0 of 31
  production lab components import them.**
- **The companion dissertation**: 2 pinned PDFs, 2 matching receipts, 11 concordance entries, and
  nothing else — no ledger, no source blocks, no translation, no gloss, no alignment.
- **Typed historian's-margin records for three of four papers**: 6 editorial notes exist, all
  mass-energy. Light quanta, Brownian motion and special relativity ship no margin section at all.
- **r3 on printed displays**: 71 of 200 (ME 7/7, SR 41/98, BM 12/43, **LQ 11/52**).
- **Derivation step `reason` and `tool` pairs, and the marked non-obvious move**: the keys do not exist
  in any argument record. `grep -rloE '"(theMove|nonObvious|move)"\s*:' content/` → **0 files.** One
  renderable derivation chain exists, with one `isMove: true`; the other five live in a fixture that
  `scripts/audit-derivation-tools.ts:32` itself calls "which no page renders".
- **Foundation instruments**: the `Foundation` entity requires one. **0 of 45 lessons declare any.**
- **"Check it against the world" against a dated measurement**: all four journeys compare a live number
  to Einstein's **printed prediction** (`comparisonKind: printed-prediction` ×4, `measured-fact` ×0).
  The dated measurements — Millikan 1916, Perrin 1909, Ives–Stilwell 1938 — are present and correctly
  labelled "Measured later, in {year}", but beside the check rather than in it.
- **The 13th anachronism control** (the 1917 train-and-embankment picture) and the attribution in the
  first (Ehrenfest 1911) both fail for one shared reason: `content/bibliography/` holds 18–19 records
  and contains **neither Ehrenfest 1911 nor Einstein 1917**. Both misconception records say so in the
  reader's face rather than inventing a citation, which is the right behaviour and a cheap fix.

---

## 4. Where the shipped site differs from its own stated budgets

Measured on live with `curl -H 'Accept-Encoding: gzip'`, against the 250 kB gzipped reading-face budget
in `AGENTS.md`:

| face | live gzipped | recorded in `perf/readingFaceRecords.json` | budget |
|---|---|---|---|
| special-relativity German | **442,611** | 397,583 | 250,000 |
| special-relativity English | **396,209** | 351,788 | 250,000 |
| special-relativity parallel | not measured | **699,923** | 250,000 |
| special-relativity results | not measured | 286,080 | 250,000 |
| `/notation/` | **258,364** | — | — |
| special-relativity reading page | 231,757 | — | 250,000 |
| light-quanta English | 158,514 | — | 250,000 |
| brownian-motion English | 129,918 | — | 250,000 |

Live is heavier than the records because the records already include `dd7bd466`, which moved the
explanation panel out of the page; deploying will cut about 45 kB from each. **Relativity's faces will
still be 1.4× to 2.8× the stated budget.** The prescribed fallback in `AGENTS.md` — "Over budget, a
section's R2 and R3 texts load from a static JSON fragment on first expansion, with real links for
no-script readers" — has not been applied to these faces. The budget has in practice been replaced by
a record-what-it-is ratchet with prose reasons. That is a defensible engineering choice and it is not
the document's stated budget; one of the two should change.

---

## 5. Two honest-signal questions for the owner

Neither is a defect. Both are places where a field says more than the mechanism behind it does, and
only the owner can decide whether that matters.

1. **`reviewState: "reviewed"` on 821 of 821 translation units.** The schema permits it with no editor
   provided an `agentReview` block carries two rounds by reviewers whose `id` differs from the
   translator's. Every one of the 821 has exactly two rounds, and in **821 of 821 cases every
   reviewer's `modelId` is the translator's own model** (`claude-opus-5-5`), passing the guard because
   translators are recorded under pane names and reviewers under other pane names of the same model.
   The guard checks a different **id**, never a different **model**. The prose receipts are scrupulous
   and repeatedly say "machine draft", "no person has reviewed the translation" — I found no fabricated
   human reviewer anywhere. The machine-readable field is what oversells.
2. **`README.md`'s status block is dated 2026-09-24 and is now wrong in the site's favour.** It says
   special relativity's German face is not published (3 of 4), that no English translation exists, and
   that mass-energy has 43 machine-drafted passages. Measured today: all four German and English faces
   answer 200, and there are 821 translation units. A visitor reading the README underestimates the
   site.

---

## 6. Would finishing every open bead close the gap?

**No, for one structural reason and one measurement reason.**

- **47 open beads carry `human-gate`**, and `docs/OWNERS.md` has **one named human and 55 slots marked
  `open: recruiting`**. Agents may prepare materials and may never close these. Among them: the German
  source review of every ledger and gloss, the physics review of every derivation, the R2 readability
  review by a non-physicist, assistive-technology sessions with disabled readers, the comprehension
  rounds, the real-device check, and `am-decision-how-review-happens-sepc`, which is the owner's own
  decision and which blocks the entire review layer. **No amount of agent work closes these.** The
  review layer is not behind schedule; it has no personnel.
- The six gates in section 2 mean the bead graph is measuring the wrong thing in six places. Closing
  beads against a vacuous gate produces closures, not assurance. The six beads filed today
  (`am-4cpx`, `am-4k0m`, `am-nxbq`, `am-jioj`, `am-f3e4`, `am-8gbg`) are the prerequisite for the rest
  of the graph meaning what it says.

Priority spread of the 507 open and in-progress beads: **112 at P0**, 306 at P1, 61 at P2, 25 at P3, 3
at P4. A 112-item P0 set is not a critical path; that is worth a triage pass of its own.

---

## 7. Corrections to the standing documents

Found while measuring. Each should be applied to the document named.

- `AGENTS.md`: FrankenSim reaches **three** labs (bm-01, bm-05, bm-06), not one, and
  `diffusion1d_frames` and `philox_normals` **are** bound. Verified in the working tree; not verified
  on the deployed site.
- `AGENTS.md`: printed displays bound for colour are **200 of 200**, not "199 of 200". The two
  `display-terms` entries with an empty `terms` list are legitimately termless word-formulas
  (`Geschwindigkeit = Lichtweg / Zeitdauer`; `Massenzahl × Beschleunigungszahl = Kraftzahl`).
- `AGENTS.md`: the anachronism table has **13** rows, not 14; `grep -c "^| "` counts the header.
- `README.md`: the whole status block, per section 5 item 2.
- Bead `am-vw1o` claims "8,339 Tailwind class names across 61 components resolve to no CSS rule". The
  semantic-CSS migration is **effectively complete**: `declaredClassesBaseline.json` sums to **380
  across 152 files, of which 151 are at zero and all 380 are in `src/equations/legacy/
  ColorizedEquation.tsx`**, a file imported by nothing but two boundary tests. The bead's premise is
  stale by an order of magnitude and should be rewritten or closed.
- `content/equation-explanations/special-relativity/eq-s3-d12.yaml:26` contains `\;` inside a
  double-quoted YAML scalar, which PyYAML and js-yaml both reject. It is the only one of 2,261
  `content/**/*.yaml` files that standard YAML cannot parse. The site is unaffected because
  `src/content/provenance/yaml.ts` is hand-rolled and documents that it keeps unknown escapes as
  written. It is a latent trap for any standard tool, worth fixing at the source.

---

## 8. The non-functional promises, measured

### Without JavaScript: the book survives, the controls vanish rather than link

What works, measured on the live site over 105 fetched pages ≥1 kB:

- **The text and the mathematics are in the initial HTML.** Visible `<main>` text with scripts, styles
  and `<noscript>` stripped: relativity German **109,378** characters, English **101,278**, parallel
  **206,907**. Relativity's German face carries **505 `<math>` elements and 1,242 KaTeX roots.**
- **Find-in-page reaches the whole paper.** 209 unique `data-block-id` and 223 unique
  `data-sentence-id` against 213 source blocks: **98%.** Nothing is virtualised out of the DOM.
- **Real links are plentiful**: 115 unique hrefs on `/papers/mass-energy/`, **272** on
  `/papers/special-relativity/`, 53 on `/lab/bm-01/`.
- **The explanation panel's no-JS route is the promise done right.** `EquationExplainer.tsx:203` is a
  real `<a href={explainerHref(explanation)}>` resolving to `/equations/<paper>/<display>/`, one
  statically generated page per display over all 200 records.

What does not:

- **4,380 of 8,820 buttons across the live site disappear with JavaScript off** (50%), because
  `noScriptControls.ts` ships `button:enabled{display:none!important}`. Relativity's German face loses
  **320 of 320**, and **317 of those are `visually-hidden-focusable` sentence-alignment affordances** —
  so the loss falls hardest on keyboard and screen-reader users. Hiding a dead control is more honest
  than leaving it dead, and it is not the promised "real links, never hydration-dependent buttons". The
  explainer's anchor proves the link was always achievable.
- **R0 is unreachable without JavaScript.** `<html>` as served carries no `data-detail` and `?detail=0`
  cannot change it in a static export, so the 8 `<div data-reading="0" hidden>` per page stay hidden.
  R1 is the CSS default and works; R2 and R3 are native `<details>` a reader can open. **3 of 4
  readings survive, and the one that survives least is the one written for the reader with no algebra.**

### Accessibility

- **Authored spoken forms: 200 of 200 printed displays, 154 of 154 model equations**, and
  `argument.ts:1587` refuses an empty one. **But `MathInline` has no `spoken` field at all**, and the
  corpus holds **914 inline math nodes** in the German blocks and 914 in the translation units. On
  relativity's German face, **98 of 505 `<math>` elements carry an authored `aria-label` and 407 rely on
  KaTeX-generated MathML** — against a plan that says generated speech "is often wrong for physics
  notation".
- 42 of 42 live lab pages have an SVG; **38 of 42 have a table.** The four without: `me-01` (whose
  manifest promises one — see `am-jioj`), `me-03`, `bm-07/kitchen`, `brownian-data`.
  `bm-07/kitchen` is the **only** page with a `<canvas>` and it has 0 tables, 0 `aria-describedby`, 0
  `figcaption`, and 3 SVGs with no `aria-label`.
- `AccessibleGraphView.tsx` is **imported by exactly one file: itself.** `DataTable.tsx` is referenced
  only from inside its own module. The three-layer accessible description machinery is built and unused.
- **No tooltip-only explanation exists** (0 `title=` in the live relativity German face; all 20
  `title=` sites in src have another route). **0 of 42 lab pages have a range input without a number
  input beside it.** Reading-only is real, applied pre-paint, and genuinely gates worker autoload.
- **No sonification exists** (0 `new Audio(`/`AudioContext` in src), so "sound starts muted" is
  vacuously true.
- `/accessibility/` says, in the reader's face: "it aims at WCAG 2.2 level AA. It does not yet claim to
  meet it… No round of testing with disabled readers, using their own tools, has been recorded yet."
  **No false conformance claim anywhere.** This is the most creditable page measured.

### Performance: two of eight budgets have ever been measured

Newest artifact `artifacts/budgets/perf-20260926T182511Z-6590b21f.json`, `outcome: "fail"`,
`calibrationState: "provisional"`, `buildRevision: "uncommitted"`:

| budget | recorded | status |
|---|---|---|
| initial-route-js ≤ 204,800 B | **198,280 B brotli** | **pass**, 3.2% headroom |
| reading-face-html ≤ 250,000 B gzip | 181,066 largest held to budget | pass **only by exemption** |
| visible-text-math | true | not-available: "an inline sample, not a built page" |
| interaction-latency p75 ≤ 200 ms | 86 | not-available: "20 synthetic interactions; no browser was driven" |
| layout-shift ≤ 0.1 | 0.03 | not-available: "synthetic shift list; no page was rendered" |
| instrument-feedback ≤ 100 ms | 65 | not-available: "synthetic marks; no instrument was operated" |
| animation-frame-rate | 16.6 | **fail**: "intervals are synthetic, no frames were rendered" |
| resource-lifecycle | not-measured | not-available |

**Five of the eight have never been measured once.** The numbers beside them are synthetic values
produced without driving a browser, rendering a page, operating an instrument or drawing a frame — and
each artifact says so in its own notes. So "60 Hz desktop, 30 Hz mobile" and "CLS at most 0.1" are
aspirations with a placeholder beside them. The initial-route graph guard is real and reports 0
violations: no `.wasm`, no `pdfjs-dist`, no `three` in the initial graph.

**The reading-face budget is exceeded on the deployed site, and the measured population has a hole.**
Five live faces are over 250 kB gzipped: relativity parallel **672,870 (2.7×)**, German 383,954,
English 338,331, results 278,490, light-quanta parallel 266,241. Worse, `scripts/perf/readingFaces.ts`
walks only the paper index, the `view/<face>` pages and the per-section gloss — so
**`/papers/brownian-motion/s4/` at 283,879 B gzip is over budget, in no record, and in no population.**

### Privacy: isolation kept cleanly, the one promised analytic absent

- **0 external `<script src>`, 0 external stylesheets, 0 external images or iframes, no `Set-Cookie`**
  across 105 live pages. All 11 external hosts are citation hrefs (doi.org 150, github.com 121,
  fourmilab 29, dlmf.nist.gov 4, …). This promise is kept without qualification.
- **The clarity signal does not exist.** Its only trace is a registered storage namespace
  (`keys.ts:355`), showing **0 B** on `/your-data/`. No control renders, nothing aggregates, no weekly
  summary is published. And `/about/` now says the site **"runs no analytics"** — so the public copy
  contradicts the plan rather than the plan being met. One of the two should change; the bead
  `am-plat-clarity-signal-nlwr` is open.

### Security

Live CSP is tight: `default-src 'self'`, **no broad `unsafe-eval`** (only the narrow
`wasm-unsafe-eval`), `object-src 'none'`, `frame-ancestors 'self'`, plus `referrer-policy: no-referrer`
and HSTS `max-age=63072000`. `'unsafe-inline'` is present for scripts, required by the three pre-paint
inline scripts; weaker than a nonce, and not forbidden by the promise. **0 `eval(` or `new Function(`
in src.** KaTeX `trust: false` at 5 sites with one narrowly scoped exception. URL state is bounded
(256 tape events, 2,048 URL chars, 32 KiB decompressed).

`application/wasm` **is** served, `content-length: 92751`, and the served bytes' SHA-256 is
**byte-identical to `wasmDigest` in `/wasm/manifest.json`**. But `cache-control: public, max-age=0,
must-revalidate` on a content-addressed artifact: the "long-lived caching for immutable WASM" promise
is not met.

### The iPhone app cannot currently be built

54 Swift files, **6,264 lines**, plus 30 TypeScript files in `scripts/app/`. The WKWebView shell is the
strongest part: `EditionSchemeHandler.swift` serves `am-edition://edition/`, manifest-listed paths only,
fixed `nosniff`/`no-referrer` headers, never `Set-Cookie`, with a TypeScript twin and shared origin
vectors.

Of the 12 promised shell features: **7 real** (library, outlines, Discover and Lab catalogues, Handoff,
share, print), **1 partial** (Dynamic Type mapping without a Settings screen), **3 absent at zero
bytes** (native search: 0 of 54 files match `searchable|UISearchController`; Spotlight: 0 hits for
`CoreSpotlight`; facsimile downloads: 0 hits for "facsimile", while the edition manifest already
excludes 9 PDFs and 16.2 MB **on the promise of that downloader**), and **1 built but inert**: universal
links have handling, policy, vectors, Swift and UI tests and an AASA generator — and
`AnnusMirabilis.entitlements` is an empty `<dict/>`, no `apple-app-site-association` file exists, and
the generator is imported by nothing but its own test, so **the OS would never route a link to the app.**

**The blocker:** the edition manifest describes 1,073 files and 91,835,885 bytes, and
`generated/app-edition/edition-source.txt` points at a **deleted agent scratchpad** that the Xcode
bundling phase `cd`s into. `site.binding: "unbound"`, `commit: null`, no `release` key — the app has
**never been bound to a web `releaseId`**, which is its central rule. `scripts/app/verified-app-release.ts`
**does not exist**; `release-absence.ts` does, and is a good DEBUG-marker gate, not a release script.
Simulator-only is confirmed (283 runs on "AM iPhone 17", 7 on "AM iPad", **0 device runs**). Newest
evidence of any kind: **2026-09-24**, and the latest `apple-ui-tests` record is **FAILED — 24 passed, 7
failed, 1 skipped**, with two `signal kill` crashes and unfixed contrast findings on the native Contents
screen. 38 app beads: 36 open, 2 deferred, **0 closed**.

### Launch: the profile the plan names cannot currently succeed

Measured directly against the registry, not from prose:

- **`launch` is not a distinct profile.** 47 steps registered; scaffold 10, preview 31, launch 31, and
  **`launch minus preview: []`, `preview minus launch: []`**. The only launch-specific behaviour is
  hostname breadth.
- **"All four complete papers closed and verified" is not representable.** All four
  `content/papers/*.json` carry `status: "explanation-preview"`, and
  `src/content/schemas/reading.ts:310-311` permits **only** `explanation-preview` and
  `in-preparation`. **No value means complete.** 0 of 4.
- **3 of 7 candidate checks are permanently `not-available`.** `four-complete-paper-texts`,
  `accepted-wasm-result-per-capability` and `deliberate-typed-refusal` all call `notRun(…)` because
  "these checks are HTTP only". `allCandidateChecksPassed` requires every check to have passed, so
  `candidateChecksPassed` is **permanently false** and `validatePromotePreconditions` always throws on
  `--promote`. **The exact command `am-launch-public-release-5nkq` specifies cannot succeed today.**
- **0 release records and 0 authorization files are tracked.** `artifacts/releases` does not exist;
  `git ls-files 'artifacts/releases*'` returns nothing.

### `docs/DECISIONS.md`: 26 decisions, four stale, one never ratified

Holding: the stack pins (no `^` or `~`), no-Tailwind (0 hits anywhere), fonts-ship-whole, and the
facsimile-text-layer prohibition (2 non-test hits, both comments citing the denylist, **0 call sites**).

Stale or contradicted: `D-2026-09-15-stack-versions` allowlists a root `tailwind.config.ts` that no
longer exists; `D-2026-09-17-remove-task-to-epic-dependency-edges` claimed all task-to-epic edges were
removed while `.beads/issues.jsonl` still holds **15** (all `parent-child`, not blockers);
`D-2026-09-22-dsr-is-the-ci` holds in the guard while `quality-gates/registry.ts:6,574` still names
`.github/workflows/*.yml` as its consumer; and **`D-2026-09-17-tailwind-styling-resolution` is itself
still marked PROPOSED and was never ratified**, though `AGENTS.md` treats it as binding and the
migration it describes is now essentially complete.
