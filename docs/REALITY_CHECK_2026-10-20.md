# Reality check, 2026-10-20

Measured on 2026-10-20 and the small hours of 10-21 by a Claude Opus 5 session the owner invoked
directly (`/reality-check-for-project`). Seven read-only investigators, plus my own measurements of
git, the live site, the built `out/`, and the gates. Code measured at HEAD `803cc7fe6`. Live
measured at `annus-mirabilis.com`.

The measuring stick is the same as last time: `COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md`
v2.0, `AGENTS.md`, `README.md`, and the owner's rulings in `docs/DECISIONS.md`. The predecessor is
[`docs/REALITY_CHECK_2026-10-01.md`](./REALITY_CHECK_2026-10-01.md) and its 92-row checklist; this
document reports the **delta** and does not restate rows that did not move.

Every claim names the command, file:line, or URL that produced it. Where a measurement was not
made, it says so. This decays. Re-measure before relying on a clause.

---

## 1. The answer, in five sentences

1. **The code got substantially better and the readers got nothing.** 1,442 commits landed since the
   last check; live is a build from on or about **2026-09-29**, which is the same build the previous
   reality check was looking at, three weeks ago.
2. **The dominant defect class of the last check has been attacked structurally and largely beaten.**
   Of its 14 vacuous-gate rows, 9 are repaired, 4 survive but now **print their own zero**, and a
   gate census (`scripts/gate-census.ts`) covers **59 of 65** registered steps — the "Track G"
   mechanism the last check asked for exists.
3. **Two output valves are shut, and one missing actor explains both.** Nothing has deployed in 21
   days and **no bead has been closed in 18 days** (last closure 2026-10-03T04:50), while 1,386
   commits landed. Closure is orchestrator-only by design; no orchestrator has run.
4. **The one deploy that was attempted did the right thing and nobody followed up.** The 2026-10-02
   candidate was `outcome: "refused"` on 2 of 9 checks; both failures were fixed the same day
   (`a1adbe30`, `2f3cf093`, both on `main`); no candidate has been run since.
5. **The content corpus is close to done and the remaining gaps are nameable**: 41 of 52
   definition-of-done cells are met, and what is left is 21 margin entries (blocked on 8 named
   bibliography records), one journey-skeleton part per paper, readings on 26 headings and 9
   closings, semantic trees on 0 of 200 printed displays, and human review that no human exists for.

---

## 2. The deployment valve: the single highest-value finding

### Live has not moved since before the last reality check

Two independent probes, neither relying on a header:

- The print fix `3adc3ce5a` (2026-09-29 14:54:58) added `.term-annotation { display: contents
  !important }` inside `@media print`. All 18 live stylesheets were fetched (263,663 B): **0 hits**.
  `git log -S` shows the rule was added once and never removed, so live predates that commit.
- `/accessibility/` serves text byte-identical to `git show bb252b92f^:src/app/accessibility/page.tsx`,
  and `bb252b92f` (2026-10-02 16:06) replaced it.

`git rev-list --count 3adc3ce5a..HEAD` → **1,442**. The previous reality check named `1ec891a0`
(2026-09-29 03:56) as the likely build commit; that falls inside the same window. **Live is the
build the last reality check measured.**

Corroborated by route bisection: `/capstones/special-relativity/` (added 09-28) returns 200;
`/search/results/` and `/lab/bm-08/compare/` (added after 10-02) return **404**; the three tours of
10-13 return 404.

### Why it has not moved is not what one would guess

| Hypothesis | Measured |
|---|---|
| A human gate blocks deploys | **No.** `docs/DECISIONS.md` D-2026-09-23, owner verbatim: *"stop asking me if you can deploy. YOU CAN ALWAYS DEPLOY. JUST DO IT."* |
| `main` is stranded off a branch (the last check's emergency) | **Fixed.** `main`, `origin/main` and `master` all at `803cc7fe6`, 0 ahead / 0 behind; all five `rescue/*` tags are ancestors |
| The Vercel build is broken | **Fixed.** `am-t84m` has been re-verified 9 times since; `build` is now a registered gate step, `requiredInCi`, in all three profiles |
| The tree is dirty | **No.** `git status --porcelain` is empty |
| The candidate checks refuse | **They did once, correctly, and the cause was repaired.** |

The only release record on file is `docs/releases/63dc6e43…-20261002T203425Z-3ef5ac64.json`:
`profile: scaffold`, `candidateChecksPassed: false`, **`outcome: "refused"`**, summary
*"7 passed …; 2 failed (every-instrument-bundle, deliberate-typed-refusal); 0 not run"*. The release
pipeline worked: it refused a bad candidate and moved no alias. Both failures were fixed within
hours of that refusal. **Then nobody pressed the button again, for 18 days.**

### What readers cannot see

Between the live build and HEAD: **521 content files changed (+23,798 lines)** and **79 files under
`src/app` and `src/components` changed (+4,231 lines)**, including 166 new scenario records, 22
lesson formulas, 17 bibliography records, 8 editorial notes, 4 journey records and 3 tours.

Concrete reader-facing consequences, each measured:

- `/accessibility/` serves a **false claim** — that spoken forms "have been read against screen
  readers in automated runs" — which was repaired in the repo 18 days ago (`bb252b92f`) and never
  shipped. `docs/accessibility/runs/` does not exist.
- The print fix (annotated words becoming buttons, which print hides) is on `main` and not live.
- WASM immutable caching is in `vercel.json` (`3ac3e9e6f`) and live still serves
  `cache-control: public, max-age=0, must-revalidate`.
- Six laboratories gained a working Play button today; no reader can reach one.

### Nothing in the process notices

There is no gate step measuring deployment lag. The 65 registered steps contain no
`release-freshness` or `live-behind-head` check, and live names no commit: `/release.json`,
`/build-manifest.json` and `/version.json` all 404 (the route exists at HEAD; it has never shipped).
`artifacts/deploy-logs/` holds **0 files**.

---

## 3. What genuinely improved

### 3.1 The vacuous-gate class was attacked structurally, not row by row

The last check's section 5 listed 14 rows / 20 checks of one defect: *a check that cannot see what
it checks*. Re-measured:

| Outcome | Count | Examples |
|---|---|---|
| **REPAIRED** | 9 | the structural pass (now 456 source blocks, 821 translation units, 4 alignments, with a floor); `checkJourney` (4 real journeys, 40 cards); `cardRules` (46 cards, date bug fixed with a two-direction test); the shelf audit (`{cards: []}` → 46 real cards); the live-term check (3 of 33 → **33 of 33**); acceptance cases; the readings audit (captions only → 6 populations, 556 targets); manifest unit status; the compiler shelf-date check |
| **STILL VACUOUS, now declared at run time** | 4 | proof-cycle and oracle edges (0 proof records — printed every run); `ubs-diff` (0 files on a clean release tree, declared `populationMayBeEmpty`); the agent-review guard (families now **measured and printed**, still id-only in the schema); `hero-quote-unresolved` |
| **SPLIT** | 1 | perf first-route JS: population repaired, basis still build-time rather than transferred, and the gate's own note says so |

**The single biggest change in the repository** is `scripts/gate-census.ts`: every registered gate
step declares its population noun, how it is read, whether it refuses a vacuous run, and its planted
negatives. It covers **59 of 65** steps; the 6 without a record are all `apple/*`.

Its own residual, measured directly from `scripts/gate-census/records.ts`: of 59 records, **13
declare `gateRefusesVacuous: false`** (would pass on an empty population) and **20 declare
`plants: []`** (no planted negative proves they can go red). The census is deliberately **not
registered in a gate family**, so nothing currently fails when a step loses its denominator.

Five new instances of the same class were found *because* the census grammar was adopted —
`hero-quote-unresolved` (0 quotes), `span-digest-mismatch`'s alignment half (0 edge ranges), two
world-check refusals that cannot fire, `kernel-trace-values` (7 of 23 rows compared), and
`audit-misconceptions` (60 prose citations unjudged). That is the mechanism working.

### 3.2 The acceptance-case gate went from the worst row to clean

Prior: *13 of 119 refs resolve, 9 reach a passing scenario, **0 of 33 instruments have a resolvable
refusal case**, and the check counts a `not-available` scenario as resolved.*

Today, `bun scripts/check-acceptance-cases.ts` (verified independently of the investigator):

```
184 of 184 refs resolved (184 to a scenario, 0 to a declared fixture), 0 dangling;
33 instruments, 226 scenarios loaded, 135 presets declared;
33 instruments have a resolvable refusal case, 32 a non-numeric one
```

180 of the 184 reach a **passing** scenario. The residue is 4 refs, all the same historical-fixture
gap as row 42 — one cause the prior table presented as two unrelated findings.

### 3.3 Content and editorial rows that closed

| Row | Prior | Today |
|---|---|---|
| 11 source-manifest status | all 544 units `unspecified` | **1,200 units, status derived from the tree**; 77/77, 334/334, 237/237, 552/552 covered |
| 18 display R3 | 71 of 200 | **200 of 200**, shortest 173 chars |
| 8 equation identity | byte-identical by measurement, **vacuous gate** | real audit over 200 blocks, planted in both directions; a new inline-math comparison found **7 real differences** |
| 25 margin entries | about 6.5 of 26 | **15 of 29 satisfied**, 2 partial, with the 8 missing bibliography records named |
| 26 result weave | UNWIRED | **wired on bm-01 and bm-06**, confirmed in built HTML (`data-weave-lit`) |
| 17 display R2 ≥ R1 | shorter in 122 of 199 | shorter in **96 of 200** |
| 43 adversarial fixtures | 2 of 16 as scenarios | **101 adversarial scenario rows, all passing, across all 33 instruments** |
| 50 journey epistemics | VACUOUS | 4 journeys, 46 cards, 40 shelf refs judged; Nägeli date bug fixed |
| 28 anachronism controls | editorial only | **11 coded rules**, 7,161 strings examined, 0 unlabelled |
| 32 `notModeled` | 27 of 33 served; two labs hand-wrote their own | **33 of 33**, 210 items, 0 hand-written arrays |
| 34 show-the-code | live-term check on 3 of 33; 15 of 109 kernels unpinned | **33 of 33**; **0 unpinned**; the hidden 67 errors are now 71 ceilinged, named debts |
| 88 browser lanes | keyboard, no-WebGL, WebKit wired to nothing | **three are registered gate steps in all three profiles**, each writing a retained commit-bound artifact |

### 3.4 The computed definition of done

`bun scripts/definition-of-done.ts` now exists and prints 52 cells, 48 measured:

```
                              light-quanta  brownian  relativity  mass-energy
manifest-units-covered          334 of 334  237/237    552/552       77/77
english-units-present           135 of 135    91/91    223/223       28/28
paragraphs-bound                  50 of 50    32/32      94/94       12/12
displays-bound                    52 of 52    43/43      98/98         7/7
results-cards-printed               9 of 9      6/6      16/16         7/7
misconceptions-at-least-five        5 of 5      5/5        5/5         5/5
readings-r0-to-r3                 11 of 11    24/24      17/17         4/4
r2-covers-r1                      11 of 11    24/24      17/17         4/4
margin-entries                      2 of 5      2/8        3/9         8/8
lab-contract-cells              126 of 126  112/112    182/182       42/42
journey-skeleton-parts              8 of 9      8/9        8/9         8/9
tour-present                        1 of 1      1/1        1/1         1/1
reviews-with-names              unmeasured  unmeasured unmeasured  unmeasured
```

**41 of 52 met** (10, 10, 10, 11). It prints no percentage, by design, and an `unmeasured` cell is
not counted as met. This is the best steering instrument the project has acquired.

---

## 4. What did not move, and should

### 4.1 The facsimile text layer is still read, by a gate, every run

`scripts/verify-facsimile-pins.ts:718` still spawns `pdftotext -layout`. Its callers are real
(`:991`, `:1017`), it is used for **folio coverage verification** (reading page numbers off the
parent volume scan to prove an extract was cut from the right pages), and the registry entry
`facsimile-pins` is `family: "fast"`, `cadence: "every-run"`, required in `preview` and `launch`.
It executed during this session's window: `artifacts/test-logs/facsimile-pins/20261021T002042Z-e85bd6c5.jsonl`
records "Anchor, content identity and folio coverage all agree" for all six pins, which can only be
produced by reading the embedded text layer.

`docs/DECISIONS.md` D-2026-09-21 is explicit that the layer is forbidden **"by any route"**.
`scripts/ocr-guard-denylist.json:91` names `pdftotext` with the reason *"text-layer extraction is
forbidden in source-layer pipelines"*.

**Being fair about it:** this is **declared, not hidden**. `bun scripts/ocr-guard.ts` scans 4,370
files and reports *"1 violation(s), 1 of them the pinned open question, 0 undeclared"*, then PASSES.
The purpose is defensible — provenance verification, not ledger drafting — and that is precisely why
it needs an owner ruling rather than a silent fix. Bead `am-rc1001-bridge-plan-pcjk.7` has been open
19 days.

### 4.2 Rows unchanged, and they are the content-engineering floor

- **0 reviewed German ledgers.** 4 `*-machine-draft.txt`, 0 `*-reviewed.txt`. The relativity
  ledger's text-layer seeding is still not recorded in its receipt (`pcjk.36`, open).
- **0 of 200 printed displays carry a semantic tree.** The 154 records under `content/equations/`
  all have a `tree`, and all 154 ids are `eq-model-*`: the intersection with the 200 printed display
  ids is **empty**.
- **0 readings on 26 headings and 9 closings.**
- **Inline spoken forms: authored 0 of 714.** The shape changed usefully — `MathInline` now has a
  `spoken` field and all 231 distinct expressions reach a reader as words via a repaired lexicon —
  but no form is authored.
- **Derivation chains: five exist and all verify, with zero production importers.** They live in
  `src/equations/derivations/fixtures.ts`; `<DerivationChain` appears 0 times outside tests and
  `data-derivation-chain` in 0 built pages. The only reader-facing proofs remain the two mass-energy
  explorers, on two built pages.
- **`/essays/`, `/1904/`, `/timeline/`, `/bern/`: all still 404**, no route at HEAD.
- **Machine-readable exports still 404 while every paper page advertises four of them** in
  `<link rel="alternate">`. A machine client asking for `application/json` receives a 60,107-byte
  HTML 404 page.
- **A clean checkout still cannot build.** The named 2026-10-01 defect was repaired (a static walk
  from the six `prepare:content` steps now reaches 0 generated-JSON imports), but the chain fails at
  a **new** site in the same class: `prepare:content` step 2 of 47 needs `src/generated/not-modeled.ts`,
  written by the **first step of the later `prepare:lab`**. Exit 9, named step.
- **The node lane gates nothing.** `unit-tests` is `bun run test`, the bun lane only. No registry
  step runs `test:node` or `test:node:content`. That lane holds the YAML parser differential which,
  on 2026-10-19, caught **all four journey records being silently dropped** by the site's own parser
  (`cda842215`).
- **`launch` and `preview` are still identical**: 50 steps each, `in launch not preview: []`. A paper
  still cannot be marked complete (`reading.ts:428` permits only `explanation-preview`).
- **The iPhone app is still unbound.** `edition-manifest.json` has `site.binding: "unbound"`, its
  `edition-source.txt` points at a deleted scratchpad, and the exported edition still carries the
  **154-byte placeholder WASM** rather than the pinned 92,751-byte module. The export guard that
  would refuse this landed (`a0b305dcd`); the edition was never regenerated. 1 `ios/` commit since
  2026-09-24. 40 app beads, 0 closed.
- **0 human reviews.** `docs/OWNERS.md` still names one person and 54 open slots; all six receipts'
  acceptance block reads `Status: pending`.

### 4.3 Four corrections to the previous reality check

Found by re-measuring with the same instruments:

1. **Row 42 reads as improved and is not.** `run-scenarios` reports `historical-fixture: passed 3`,
   up from 1. Two of the three are `self-test-historical-rounds-to` and `self-test-historical-misprint`
   — fixtures of the scenario runner, not of anything Einstein printed. The real count is **1 of 6**,
   unchanged.
2. **Row 47's floor is `> 0`, not 769.** `noPhysicsInComponents.test.ts:123` asserts
   `expect(files.length).toBeGreaterThan(0)`. The prior check called it "an AST gate over about 769
   files", which is a measurement rather than what the gate defends. If the walk collapsed to one
   file it would stay green — the exact shape the prior check's own section 5 is about, in a row it
   marked WORKING.
3. **Row 46's keyboard lane gained a gate without gaining coverage.** It is now `requiredInCi: true`
   in all three profiles while still navigating to exactly one page, `/lab/bm-01/`. A required gate
   over 1 of 33 laboratories is a stronger-looking signal over the same evidence.
4. **Row 68's no-JS defect is smaller than the wording suggested.** Of 701 buttons on relativity
   parallel, **698 are `visually-hidden-focusable` alignment helpers** that would be dead without JS,
   so hiding them is correct; on the paper page 116 of 140 are `disabled` term chips the rule does
   not hide. The German face carries 639 real `<a href="/notation/…">` links.

---

## 5. Software integrity at HEAD

| Check | Result |
|---|---|
| `bun run check:types` | ok, 2 of 2 |
| `bun scripts/verify-content.ts` | `{"ok":true,"flags":1339,"skipped":[]}`, 1,680 records compiled |
| `bun test --isolate` (full bun lane) | **17,866 pass, 1 skip, 0 fail**, 1,903 files, 587 s (measured this session at `a3170522f`) |
| `bun run test:refusals` | 107 pass, 0 fail; census `src: 2375 coded in 1852 files, 32 untested` |
| `bun scripts/verify-wasm-artifacts.ts` | 12 of 12 |
| `bun scripts/publication-contract.ts` | 8 of 8 |
| `bun scripts/lint-voice.ts` | 84,083 strings, **0 errors** |
| `bun scripts/lint-anachronism.ts` | 7,161 strings, 0 unlabelled |
| `bun scripts/ocr-guard.ts` | 4,370 files, 1 violation, 1 declared, 0 undeclared |
| Perf budgets | **2 of 8 rows measured**; `initial-route-js` 196,812 / 204,800 and `reading-face-html` 239,638 / 250,000 both pass; 6 rows `not-available`; **overall `outcome: "pass"`** |
| Clean checkout | **BROKEN**, exit 9, `prepare:content` step 2 of 47 |

A dedicated software-integrity investigator was still running the lanes at HEAD when this document
was written; the lane figure above is my own measurement from earlier in the same session, three
commits behind HEAD, with the affected suites re-run green at HEAD.

**Reading-face weight, measured over the built `out/`:** 257 reader paper pages, **6 over the 250 kB
gzipped budget**, worst `papers/special-relativity/view/parallel/index.html` at **700,799 B** (2.8×).
All six are carried as recorded exceptions in `perf/readingFaceRecords.json`, and the gate's note
says so. (The 28 offline chapters over 250 kB are a different product with a different purpose and
are not budget breaches.) D-2026-10-02 chose islands; `pcjk.52` is in progress.

---

## 6. The task graph: it can no longer retire work

| Status | 2026-10-01 | today |
|---|---|---|
| open | 491 | **547** |
| in_progress | 24 | 27 |
| in_review | — | **17** (new status in use) |
| closed | 168 | **181** |
| deferred | 2 | 9 |
| **total** | 691 | **787** |

**No bead has been closed since 2026-10-03T04:50** — verified directly from `.beads/issues.jsonl`
`closed_at` fields. Over the same 18 days, 1,386 commits landed, 749 of them delivery-prefixed.

- **221 non-closed beads are named by a delivery commit** (189 of them `open`); seven were checked
  by hand and their artifact exists on disk or in `out/`.
- All **33** "Build XX-NN" instrument beads are open, and all 33 are still blocked by twelve beads
  that each describe behaviour the live site already has.
- **58 of 439 batch-labelled beads are closed** (13%). Batch A is 62%; every batch after it is ≤10%,
  while the tree implements through roughly Batch G.
- `br ready`'s top 40 still offers **one** reader-visible bead, and 28 of the 40 are epics minted on
  2026-09-14. `br ready` applies no ranking, so "the top 40" is essentially the 40 oldest.
- All 10 of `bv --robot-priority`'s recommendations say **decrease** (the tool caps at 10).
- 24 of 27 `in_progress` beads are stale past 72 h, 8 unassigned, the oldest 26.5 days. The 17
  `in_review` beads have accumulated for six days against zero closures.

**One repair is real and deserves credit.** The obsolete OCR gate
`am-src-ocr-dispatch-interface-m1ur` went from blocking **166 of 523** non-closed beads to **5**, all
five themselves deferred — a deliberate, evidenced cut on 2026-10-19 with the removed edges recorded
for restoration.

**One mislabel is doing enormous damage.** `am-read-anchors-navigation-a6o` ("Keep stable anchors
across faces with alias redirects, outline, and scroll restoration", P0, open) carries the
`human-gate` label and alone has **182** non-closed beads downstream. Its description and 22 comments
are engineering work with E2E criteria and a code fix that landed on 2026-10-10. Strip it and the
human-gate reach falls from 211 of 606 (35%) to **110 of 606 (18%)**.

**The cost of not closing is measurable.** `am-t84m` has been independently re-measured on 09-22,
10-05, 10-06, 10-09 (×3), 10-10 (×2) and 10-11, every time concluding all five acceptance criteria
are met. Its own last comment declines a ninth: *"Re-measuring it again would be the ninth run of a
green gate, which earns no capability credit and costs the swarm an agent each time it surfaces in
`br ready`."*

---

## 7. Would finishing every open bead close the gap?

**No**, for four reasons, in order of size.

1. **Nothing closes, so "finishing" is unobservable.** 18 days, 749 delivery commits, 0 closures. The
   graph is drifting further from the tree with every commit.
2. **Nothing ships.** Every bead could be finished and no reader would see any of it until somebody
   runs the release script. There is no bead and no gate for "live is N commits behind HEAD".
3. **The routing is still wrong**, though less so. One mislabelled `human-gate` bead gates 182
   others; twelve platform beads describing shipped behaviour gate all 33 instrument beads.
4. **Genuine vision gaps remain with no covering bead** (section 8).

---

## 8. Vision goals with no covering bead

Carried forward where still true, and new ones found today:

- **Deployment lag has no owner.** No gate measures it; no bead names it. The closest,
  `pcjk.51`, is post-promotion verification, which presupposes a promotion. **NEW**
- **`/your-data/` tells readers a withdrawn feature is pending.** At HEAD, not just live:
  `src/app/your-data/page.tsx:113-120` describes `am:clarity:v1` as "reserved for a one-click 'this
  was clear / this was not' answer … the control is not written". The owner withdrew the feature on
  2026-10-02. **NEW**
- **The MERGED plan still demands the clarity signal** in four places including §16.6 and the Batch I
  row, although the owner's selected option text was verbatim "remove the clarity signal **from the
  plan** and AGENTS.md". AGENTS.md was updated; the plan was not. **NEW**
- **Two laboratories have a converted, carryable walkthrough and no Play button**: `me-02`
  (`CoefficientLab.tsx`) and `sr-02` (`MagnetConductorLab.tsx`). Both have full `_TAPE` bindings.
  They were missed today because they live directly in `src/components/lab/` rather than in a
  per-lab subdirectory. **NEW**
- **The sitemap omits five of seven faces.** All 244 `<loc>` entries cover only `german` and
  `english`; `parallel`, `gloss`, `results`, `split` and `facsimile` appear 0 times, though every
  paper page links to them. **NEW**
- **22 `dangling-independent-reference` debts resolve into `content/verification/`, a directory that
  does not exist at all.** **NEW**
- **Seven labs have a published tape and no control**; five of them (bm-01, bm-05, bm-07, bm-08,
  sr-03) are worker laboratories whose shared links "load settings only", so this needs the
  architectural ruling in section 9, not a mount. **NEW**

---

## 9. Decisions only the owner can make

| Id | Decision | Recommendation |
|---|---|---|
| **E-A** | **Deploy.** Nothing blocks it: standing authorization exists, `main` is clean and pushed, the build works, the two 10-02 check failures are fixed. Three weeks of work is invisible | **Run `bun scripts/verified-production-deploy.ts` now**, and add a gate that reddens when live falls more than N commits behind `origin/main` |
| **E-B** | **Closure.** Either run the orchestrator, or change the rule. 18 days at zero closures with 221 beads named by delivery commits is not a backlog, it is a broken instrument | Run a closure pass over the 17 `in_review` and the 221 named-by-delivery beads; if no orchestrator is coming, let a second agent close with cited evidence |
| **E-C** | **`pdftotext` in `verify-facsimile-pins`.** Its purpose is provenance verification, not drafting; D-2026-09-21 forbids the layer "by any route". Either carve out verification explicitly, or replace folio coverage with a method that does not read the layer | **Carve it out in writing**, since the guard already declares it and the alternative loses a real provenance check |
| **E-D** | **Worker-lab walkthroughs.** Five labs have a carryable tape and a `DraftTapeBinding` that deliberately starts nothing. Give them a `_TAPE` binding (a host replay then stands behind a worker lab's link) or accept no Play button there | Owner's call; the reader-facing cost is five of AGENTS.md's named teaching tapes being unplayable, three of them by id |

---

## 10. The bridge plan

Ordered so each track makes the next meaningful.

### Track V: open the valves (hours, and it is the whole point)

1. Deploy HEAD. Record the release. (E-A)
2. Add a gate step that measures live against `origin/main` and reddens past a threshold, so this
   cannot recur silently.
3. Ship `/release.json` so "which commit is live" is a `curl`.
4. Run a closure pass: the 17 `in_review`, then the 221 non-closed beads named by a delivery commit,
   closing with cited evidence or rescoping. (E-B)
5. Remove the `human-gate` label from `am-read-anchors-navigation-a6o`, unblocking 182 beads.

### Track C: finish the census the repository started

6. Register `gate-census` in a family once the 6 `apple/*` records exist, so a gate that loses its
   denominator fails.
7. Give the 13 `gateRefusesVacuous: false` steps a floor, and the 20 with `plants: []` a planted
   negative.
8. Put `test:node:content` into the registry — the lane that caught four silently-dropped journey
   records gates nothing.
9. Fix the clean-checkout cycle at its new site, and add a fresh-clone bootstrap step.

### Track E: the editorial floor

10. The 8 bibliography records that block the 21 absent margin entries.
11. Readings on 26 headings and 9 closings.
12. Semantic trees for the 200 printed displays (the single largest remaining content obligation).
13. Wire the five existing derivation chains into a reader-facing route.

### Track H: honesty repairs

14. `/your-data/` and the MERGED plan: carry the clarity-signal withdrawal through.
15. Either ship `/exports/v1/` or stop advertising it in `<head>`.
16. Put the five missing faces into the sitemap.
17. Mount `WalkthroughControl` in `me-02` and `sr-02`.

---

## 11. Corrections to the standing documents

- **AGENTS.md is accurate** where spot-checked: 41 lab directories, 48 argument passages, 6 pinned
  facsimiles, 6,264 lines of Swift, 200 printed displays bound (43 + 52 + 7 + 98). The clauses the
  2026-10-01 check flagged (nine candidate checks, three FrankenSim capabilities bound) have been
  corrected.
- **README.md** carries a status block re-measured 2026-10-03/10-09; four claims spot-checked exact
  (821 of 821 reviewed translation units, 542 gloss units, 6 PDFs, 292 concordance entries). It is
  11 days old and decaying, and it does not say that live is three weeks behind it.
- **`COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md` §16.6** still requires the clarity
  signal the owner withdrew on 2026-10-02.
- **`src/components/lab/WalkthroughControl.tsx`** says "me-02 and me-03's records do not convert";
  all 22 records convert as of today.
