# Reality check, 2026-10-01

Measured on 2026-10-01 by a Claude Opus 5.5 session that the owner invoked directly
(`/reality-check-for-project`). The session used eight read-only investigators, plus my own checks
of the live site and the git history. Code and records were measured at HEAD `19ee33db`. The live
site was measured at `annus-mirabilis.com`.

Every claim names the command, file and line, or live URL that produced it. Where I could not make
a measurement, the claim says so. Where an earlier document (`AGENTS.md`, `README.md`,
`docs/REALITY_CHECK_2026-09-27.md`) is now contradicted, the contradiction is named. Investigator
evidence (probes, downloaded pages, matrices) is in this session's scratchpad. It is not
committed. The numbers here are what it measured.

This decays. Re-measure before relying on a clause.

---

## 1. The answer, in five sentences

1. **The product is real.** A live, fast, carefully written bilingual critical edition of all four
   papers. It has:
   - complete source alignment;
   - an English translation, final under the owner's ruling on agent review;
   - an explanation of every paragraph;
   - 33 working laboratories with honest execution labels;
   - four discovery journeys whose forks are fair.

   It is much further along than the bead count (168 of 691 closed) suggests.
2. **Production is running code that exists on no branch.** `main` was reset on 2026-09-29 at
   01:02. The 27 commits the live site was built from now exist only under a local tag. If anyone
   deploys `main` the way the deploy script normally does, readers lose content (section 2).
3. **`main` is red, and a clean checkout cannot build it.** Two tests in the bun lane and six in the
   node lane fail for real. The prepare chain also imports files that it generates and git ignores,
   so a fresh clone stops at step 3 of 44 (section 6).
4. **The rules most likely to stay true are the ones nobody can check.** These are the 1904
   boundary, equation byte-identity, circularity, and the acceptance cases. Each has a gate that is
   well written, persuasive, and pointed at an empty population or a fixture. That is now 20
   checks in 14 rows, all one defect class (section 5).
5. **The task graph has stopped describing the product, so it cannot steer the swarm.** When the
   swarm restarts, about 2026-10-02 according to the last credit note, it will draw from a ready
   queue that holds no new reader-visible work (section 8).

---

## 2. Operational emergency: the live site is not built from `main`

### What happened

`git reflog show main` gives this sequence:

- **2026-09-29 01:02:56.** `reset: moving to origin/main`. That dropped 18 unpushed commits
  (`16001f32` and its ancestors back to `4a3f676c`).
- **Afterwards.** The orchestrator treated `main` as the owner's and committed **detached**. It
  tagged the line five times, ending with `rescue/2026-09-29-1500-four-landed` (`413470b7`). The tag
  message reads: "main is the owner's and is untouched".
- **Today.** `git rev-list --count main..rescue/2026-09-29-1500-four-landed` gives **27**.
  `git ls-remote origin` lists `main`, `master` and `HEAD`, all at `19ee33db`. It lists **no tags**,
  so those 27 commits exist in this one checkout and nowhere else.

### Live is the stranded line

The live-site investigator probed live against both lines:

- The 8 historian's-margin notes from `551c50d4`, `089cfc6b` and `51a0e86f` are **served**. Their
  content files do not exist at HEAD.
- The `e8615175` overflow-script guard is **served**. `main`'s `formulaOverflow.inline.ts` has 0
  matches for it.
- `6d5e5625` and `3adc3ce5` are **not** served. The most likely build commit is `1ec891a0`,
  09-29 03:56.
- No release record survives. `artifacts/releases/` does not exist, and 0 files under `artifacts/`
  are tracked. The deploy time is therefore unverifiable.

### What a routine deploy of `main` would remove

- The 8 margin notes.
- The section-parallel scoping from `341d07f6`. Live relativity §3 parallel is 184,149 B gzipped;
  `main`'s own record is 427,342 B.
- The bm-01 hydration guard from `e8615175`.
- The candidate-probe retry and redirect handling from `c6d590dd` and `43e283bb`. The absence of
  those is what caused an earlier refusal, per `am-qsm9`.

Four further fixes are on neither live nor `main`: print words (`3adc3ce5`), margin titles
(`6d5e5625`), lab placeholders (`413470b7`), and the duplicate of the a11y live regions.

### What restoring `main` costs

- `git cherry rescue/2026-09-29-1500-four-landed main`: of `main`'s 3 extra commits, 2 are
  equivalent to tag commits (`175b6e17`, `19ee33db`). One is unique: `3c84fc5c`, the candidate-probe
  wait.
- `git merge-tree --write-tree main <tag>` reports **one conflict**, in
  `scripts/candidate-checks.test.ts`, a test file.
- The tag line also contains the fixes for two of today's red tests: `b6f43f40` for `usedLater` and
  `420ea441` for the bare-throw ratchet.

**This is the owner's decision (D-A in section 11).** Until it is made, nobody should deploy, and
the restarted swarm should not commit on top of `main` without knowing that `main` is not live.

### Who reset `main`: unidentified

- **The orchestrator noticed and froze git.** It noticed within four minutes and sent dispatch 505,
  "ALL PANES - STOP WRITING TO GIT. The branch lost 17 commits and I will not repair it without the
  owner", at 01:06. It stated it had not run the reset: its last git write was the commit at
  00:57:54.
- **The reflog shape.** `HEAD@{01:02:56}: checkout: moving from main to main` is immediately
  followed by `reset: moving to origin/main` in the same second. That is the shape of a
  `checkout -B main origin/main`-style sync, not of a hand-typed `git reset --hard`.
- **No Claude Code session ran it.** No Claude Code transcript for this project contains a git
  command that moves `main` between 04:40Z and 05:15Z.
- **Not searched.** The cass index is degraded ("checkpoint_incomplete"), so cross-agent search was
  not available. Codex sessions for that date have no matching file.
- **Two consequences.**
  - Whatever did it can do it again. AGENTS.md's ban on `git reset --hard` binds agents that read
    it, not tools that do not.
  - **Dispatch 505's freeze on git writes is presumably still in force for every pane.** Resolving
    D-A should lift it explicitly.

---

## 3. The vision checklist

The measuring stick is `COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md` v2.0 (read in full
for this check), `AGENTS.md`, and `README.md`. The owner's later rulings in `docs/DECISIONS.md`
override them where they apply. The ones that matter here:

- D-2026-09-25-agent-reviewed-translations
- D-2026-09-25-no-review-status-banners
- D-2026-09-25-one-best-translation
- D-2026-09-24-explanation-grain
- D-2026-09-22-one-sun-moon-theme-toggle

Status vocabulary:

| Status | Meaning |
|---|---|
| WORKING | Measured working, on the live site where that applies |
| PARTIAL | Some of it is there |
| UNWIRED | Built and tested, but nothing in production uses it |
| VACUOUS | A gate that exists but examines nothing real |
| NOT STARTED | Absent |
| REGRESSED | Worse than on 09-27 |
| NO_BEAD | No bead covers it |

### 3.1 Is the historical text complete and accurately represented?

| # | Goal (source) | Status | Evidence |
|---|---|---|---|
| 1 | Pinned facsimiles with SHA-256 receipts (§4.2–4.3) | WORKING | 6 of 6 recomputed digests match their receipts |
| 2 | Receipts carry the §4.3 fields | PARTIAL | Identity fields 4/4. Editorial acceptance is empty in 6/6. Wikisource revid in 1/4. `authorLine` is "A. Einstein" where the masthead prints "von A. Einstein." (BM, SR). `ap-17-891.md:697` breaks standard YAML |
| 3 | Reviewed diplomatic German ledger (§4.4) | PARTIAL | 4 `*-machine-draft.txt` files, 0 `*-reviewed.txt`. Marker sequences 17/12/31/3 are complete. The relativity ledger's text-layer seeding (commits `30ab1df0`, `febcda2d`, `6d7eb45f`, `a7d334ea`) is **not recorded in its receipt** (NO_BEAD) |
| 4 | German edition face | WORKING | 4/4 live. Relativity carries 101,057 characters of text in `<main>` |
| 5 | English translation (§4.5, D-09-25) | WORKING by the owner's rule | 821/821 units are final. **Caveat:** in 821/821, the reviewer's `modelId` equals the translator's model. `validateAgentReview` (`source.ts:2046-2112`) compares ids, never models (NO_BEAD) |
| 6 | Many-to-many alignment | WORKING | 821 edges. 453/453 blocks and 821/821 units are reached. 0 dangling |
| 7 | Interlinear gloss (§7.11) | WORKING (coverage) | 542/542 sentence spans, all `machine-draft` |
| 8 | Equation blocks byte-identical German↔English | WORKING by measurement, **VACUOUS gate** | 200/200 identical. But `checkEquationNotIdentical` needs `kind === "source-block"` (`src/content/checks/structural/structural.ts:1194`), and verify-content's compiler receives no source block or translation unit at all (§5 row 1). **An in-memory plant was not caught** (NO_BEAD) |
| 9 | Notation concordance (§4.7) | WORKING | 272 entries over 186 glyphs. Both danger collisions are present. Rename, unit conversion and modernization are kept as separate operations |
| 10 | Modern-notation toggle redrawn from the tree | PARTIAL | `render.ts:78-108` uses the tree. The toggle is on 2 of 4 papers. It redraws BM 1/18 and SR 12/40 |
| 11 | Source manifest as the completeness authority (§3.2) | PARTIAL | Layers are fixed (`bf684073`). **All 544 manifest units report `status: unspecified`**, so §17.7(2) "every block covered" cannot pass (NO_BEAD) |
| 12 | Misprints kept as printed, with retractions kept (§4.3) | WORKING | 25 typo records, 3 retracted and kept. 0 retracted ids are served live |
| 13 | The facsimile text layer is never read (D-2026-09-21) | **VIOLATED** | `scripts/verify-facsimile-pins.ts:717` spawns `pdftotext`. It runs in the `facsimile-pins` gate (family `fast`, every run). The repo's own OCR guard flags it, and `ocr-guard.test.ts` pins it as a known unresolved violation |
| 14 | Companion dissertation (§3.7) | NOT STARTED | 2 PDFs, 2 receipts and 11 concordance entries only. Its faces return 404. The plan schedules it after the four papers, so this is not urgent |

### 3.2 Is the explanation sound and complete?

| # | Goal | Status | Evidence |
|---|---|---|---|
| 15 | R0 for every paragraph, reachable without JS | WORKING | 210/210. The no-script style shows `[data-reading="0"]` (`fd4ddf81`). **Fixed since 09-27** |
| 16 | R1–R3 for every paragraph (at passage grain, per D-09-24) | WORKING | 208/210. The two exceptions are declared `unexplained` with reasons. 48/48 passages carry all four readings |
| 17 | R2 shows every step | WORKING for passages, PARTIAL for displays | Passage R2 is longer than R1 in 48/48 (median ratio 3.28). **Display R2 is shorter than R1 in 122 of 199**. 6 displays have a one-line R2 (NO_BEAD) |
| 18 | Four readings on every equation | PARTIAL | Display r0/r1/r2 are on 200/200. **r3 is on 71/200** (LQ 11/52, BM 12/43, SR 41/98, ME 7/7), unchanged since 09-27 |
| 19 | Readings on headings and closings | NOT STARTED | 0/26 headings, 0/9 closings |
| 20 | Each printed display is an `Equation` with a semantic tree (§11.4, §17.7(3)) | **NOT STARTED** | **0 of 200 printed displays have a tree.** The 154 model equations have trees. So: 0/200 dimension-checked, 0 operation references, and the §15.6 ladder labels have 0 hits in `src` |
| 21 | Authored spoken forms (§16.2) | PARTIAL | Displays 200/200, models 154/154. **Inline math 0 of 714**: `MathInline` (`inlines.ts:22-32`) has no `spoken` field. On live relativity German, 407 of 505 `<math>` elements rely on generated MathML (NO_BEAD) |
| 22 | Derivation chains: step, reason, tool, the move marked | PARTIAL | ME: 2 rendered proofs. BM: 1 pedagogical chain. **LQ 0, SR 0** |
| 23 | Results face (§6.9) | WORKING | 38 cards with decoders and probes. 31 of the plan's 34 result rows are carded |
| 24 | Misconception ledger, at least 5 per paper (§7.6) | WORKING | 28 records (LQ 5, BM 7, SR 8, ME 8). The audit now reads real records (`5ac9c3ca`) |
| 25 | Required historian's-margin entries (§3.9) | PARTIAL | About 6.5 of 26 at HEAD: ME 6/6, LQ 0/5, BM 0/7, SR about 1/8. The stranded tag adds notation-collision notes, which are mostly not the §3.9 entries |
| 26 | Result weave (§6.9) | **UNWIRED** | `WeaveHighlighter.tsx`, `faceLookup.ts`, `createWeaveEvaluator` and `announce.ts` are imported only by tests. Predicates are coded for 3 labs; 28 manifests declare them |
| 27 | No circular explanations (§6.5, §11.6) | PARTIAL / **VACUOUS** | The premise-cycle check over the 48 real arguments is real (`compile.ts:396-424`). The proof-cycle and oracle-edge checks run over 0 records: 0 `kind: proof`, 0 historical or oracle edges. `isArgumentNodeRecord` matches 0/48 (NO_BEAD) |
| 28 | Anachronism controls (§5.3) | WORKING | 13/13. `cit-ehrenfest-1911` and `cit-einstein-1917-popular` landed (`2dac63a2`) |
| 29 | Editorial voice (§7.12) | WORKING | 0 em dashes and 0 banned words across explanatory content (2,587 files scanned) |

### 3.3 Does each instrument calculate and display its model correctly?

| # | Goal | Status | Evidence |
|---|---|---|---|
| 30 | 33 core instruments live, with embeds (§10.2, §10.7) | WORKING | 66/66 `/lab/<id>/` and `/embed/lab/<id>/` pages return 200 |
| 31 | Honest execution labels, earned per snapshot | WORKING | 33/33. `executionState.ts:62-69` grants FrankenSim only for an accepted primary owner |
| 32 | `notModeled` shown | PARTIAL | 33/33 manifests. Served in full on 27/33. **lq-01 renders none. sr-03 and lq-06 hand-write their own lists** (two sources for one thing) (NO_BEAD) |
| 33 | Predict mode or exemption | WORKING | 28 enabled + 5 exempt |
| 34 | Show the code (§7.8) | PARTIAL | 33/33 labs mount listings. 15 of 109 declared kernel functions are unpinned. The live-term check covers **3 of 33** by default; `--all-instruments` gives **67 errors** |
| 35 | Action contracts (§10.5) | WORKING | Rendered-DOM audit: 151/151 affordances found, with plants. **Fixed since 09-27** |
| 36 | One accepted snapshot per instance, instance-scoped owner (§12.5, §12.8) | PARTIAL / UNWIRED | 31/33 labs build per-mount session stores. `store/registry.ts` and `useExperimentSnapshot` have **0/33** production consumers |
| 37 | Versioned worker protocol decoder (§12.7) | UNWIRED | `workers/protocol/decode.ts`, `genericWasm.ts`, `useGenericWasmSource.ts` and `wasmWorker.ts` have 0 production importers. The live codec path does reject non-finite values (`results/codec.ts:23`) |
| 38 | `renderTime` and a display clock separate from stepping | NOT STARTED | 0 occurrences in `src`/`scripts` |
| 39 | Tapes, permalink and scrubber (§12.11) | PARTIAL | `?tape=` restore works in 27/33 (unit tests only). Play exists for 7 of 22 tapes. 10/22 carry placeholder digests. **No scrubber.** Of the 5 tapes the plan names, 2 replay |
| 40 | FrankenSim owns the reusable laws (§12.1, §21) | PARTIAL | 3/33 labs (bm-01, bm-05, bm-06), diffusion only. About 12,000 lines of radiation, photoelectric, kinematics, fields, waves, electron, mass-energy and inference laws exist only in TypeScript. 0 of 33 owner bindings say `frankensim` |
| 41 | WASM artifact verification (§17.3) | WORKING | `verify-wasm-artifacts.ts`: 12/12 pass, gated |
| 42 | Printed numbers as regression fixtures (§13.3) | WORKING (unit) / PARTIAL (scenario) | N = 6.1705e23, 4.3385 V and λx = 0.7948/6.156 µm are asserted in unit tests. As scenario records, 1 of 6 historical fixtures passes; the rest are `not-available` |
| 43 | Adversarial fixtures (§13.5) | WORKING (unit) / PARTIAL (scenario) | 15/15 as unit tests. 2/16 as scenario records |
| 44 | Acceptance cases, including refusals and non-numeric results (§10.6) | **VACUOUS** | 13 of 119 refs resolve. **9 reach a passing scenario. 0 of 33 instruments have a resolvable refusal case.** The check counts a `not-available` scenario as resolved |
| 45 | Historical datasets, typed and cited (§10.7 launch set of 8) | PARTIAL | Millikan 1916 rev 2 is digitized from Fig. 6 (rev 1, which was computed, has been withdrawn). **Perrin 1909 is absent** |
| 46 | 320 px, keyboard and reduced motion per lab (§17.7(5)) | UNPROVEN | The keyboard lane covers 1/33 (`/lab/bm-01`), ungated. The phone-overflow sweep is ungated. Reduced motion is vacuously true because no lab animates. `VisibilityCoordinator` is UNWIRED (NO_BEAD) |
| 47 | Components never compute physics (§12.5) | WORKING | `noPhysicsInComponents` is an AST gate over about 769 files, with a plant |

### 3.4 Discovery and the material around the papers

| # | Goal | Status | Evidence |
|---|---|---|---|
| 48 | Four journeys following the §9.1 skeleton, labelled "A route you could take" | WORKING | 4/4 live. Shelf, nagging fact, question, move, doors, exercises (no `eval`). 8 fair forks over 17 branches. The `/discover/brownian-motion/investigate/` page lacks the label (NO_BEAD) |
| 49 | Check against the world: computed live and compared with a **dated measurement** | PARTIAL | Live from the accepted snapshot: 4/4. Compared with a measurement: **0/4** (`comparisonKind: printed-prediction` ×4) (NO_BEAD) |
| 50 | Journey epistemics enforced by gates (§11.7, AGENTS "How to Add a Discovery Step") | **VACUOUS** | `checkJourney` has 0 non-test callers and `JOURNEY_MAP` holds only the fixture. The compiler's shelf-date check sees 0 journeys. `cardRules` has 0 callers, **and has a date-string bug that fails the correct Nägeli card**. `shelfPublication.ts` counts unverified cards but never fails. `verify-content.ts:411` passes `{cards: []}` to the shelf audit |
| 51 | Knowledge cards (§5.2) | WORKING by hand | 46 cards. The 2 dated after 1904 are both flagged. 0 of 46 have a complete verification record |
| 52 | No-algebra first encounters (§7.2, §7.4) | WORKING | 4/4. 0 KaTeX in any live entrance |
| 53 | Foundation library (§7.5) | PARTIAL | 45 lessons. Prerequisite graph has 0 proof cycles and 0 dangling links. **20 operable constructions, 20 figures only, 5 with nothing.** No `instrument` field in the schema (NO_BEAD). The German-sentence lesson is unwritten |
| 54 | Tours: three budgets (§7.3) | PARTIAL | 1 of 9 timed tours (fifteen-minutes mass-energy) |
| 55 | Capstones (§7.10) | PARTIAL | 4 read-and-print pages live. **No editable worksheet, no index** |
| 56 | Connections, the Avogadro lab, the light thread (§14.2) | PARTIAL | Avogadro and light-thread labs are live. Connections has 5 of 7 threads |
| 57 | Five shared reasoning instruments (§14.3) | WORKING | All five are live (the missing-step explorer on BM only, as the plan starts it) |
| 58 | Methodological essays (§14.1) | NOT STARTED | 0 files. Search still declares an `essay` type |
| 59 | `/1904` desk (§5.5) | NOT STARTED | 404 |
| 60 | `/timeline` (§14.4) | NOT STARTED | 404 |
| 61 | `/bern` bridge (§14.6) | NOT STARTED | 404. 0 of 82 fetched live pages link to classic-patents.com |
| 62 | Kitchen real-data mode (§7.9) | PARTIAL | Video and CSV machinery is live. **No home protocol** (0 hits for milk, objective or stage micrometer). No licensed real sequence |
| 63 | Predict, perturb, explain, teach back (§14.5) | PARTIAL | Static prompts on the 4 journeys only. No stored prediction, no per-chapter task. The journey notebook (`storedNotebook.ts`) is UNWIRED (NO_BEAD) |

### 3.5 Can a visitor operate and understand the actual page?

| # | Goal | Status | Evidence |
|---|---|---|---|
| 64 | Reader faces through `?view=` (§6.9) | WORKING | German, English, gloss, parallel, reading, results and facsimile are live. A headless Chromium check of 7 pages: 200, 0 console errors, 0 px horizontal overflow at 1280 and 390 |
| 65 | Return stack and recursive clarification (§6.4, §6.8) | PARTIAL | The obstacle menu and "one example first" exist (`src/reader/actions/`). Reader-stack view loaders exist for 1/33 labs |
| 66 | Search, build-time, working without JS (§16.1) | WORKING | `/search/` lists 581 entries as real links. Phantom `essay`/`timeline`/`capstone` types remain |
| 67 | Machine-readable exports (§11.8) | **BROKEN (new)** | `docs/EXPORTS.md` says the site "publishes" `/exports/v1/`. **Every paper and section page advertises 4 `<link rel="alternate">` export URLs, and all return 404 live.** `src/content/exports/emitter.ts` is never invoked by the build (bead `am-cm-machine-readable-exports-xgy` is open but does not name the dead links) |
| 68 | The book works without JavaScript (§1.5(6)) | WORKING for text, PARTIAL for controls | Text and math are in the initial HTML (505 `<math>` on relativity German). **5,963 of 9,430 buttons on 114 paper pages are hidden** by `button:enabled{display:none!important}`, 4,831 of them alignment controls |
| 69 | Accessible graph views and data tables (§16.2) | UNWIRED | `AccessibleGraphView` is reached only from an e2e fixture app. `DataTable` only from tests |
| 70 | `/accessibility/` makes no false claims | **REGRESSED** | Revised in `c00b0430`. It claims every equation's spoken form is hand-written (false for 407/505 on relativity German) and that spoken forms were "read against screen readers in automated runs" (no screen-reader automation exists) (NO_BEAD) |
| 71 | Print (§16.3) | PARTIAL | `print.css` is live, but annotated words become buttons and print hides buttons. The fix `3adc3ce5` is stranded on the tag |
| 72 | Offline chapters | WORKING | 28 chapters. Mass-energy is 709,929 B, self-contained |
| 73 | Reading-face HTML ≤ 250 kB gzipped (§6.2, §16.4) | **REGRESSED** | 9 of 115 live pages are over. Relativity parallel is **806,184 B** (was 672,870). `perf/readingFaceRecords.json` attributes about 64% to the React hydration payload and calls it "a design question for the owner". No DECISIONS entry exists |
| 74 | First-route JS ≤ 200 KiB compressed | **OVER as served** | Relativity serves 18 chunks, **226,736 B brotli** as transferred. The perf gate passes on its build-time basis (170,315) (NO_BEAD for the basis mismatch) |
| 75 | The other six perf budgets measured on recorded hardware | NOT STARTED | Across 1,777 artifacts, latency, CLS, instrument feedback and frame rate are the same synthetic values. Resource lifecycle has never been measured |
| 76 | Security: CSP, HSTS, no `eval` | WORKING | Unchanged since 09-27. 0 `eval(`/`new Function(` |
| 77 | Privacy: no third parties, no cookies | WORKING | 41 pages, 0 external resources, 0 `Set-Cookie` |
| 78 | The clarity signal, the one analytic (§16.6) | NOT STARTED | Only a reserved storage key exists. `/about/` says the site "runs no analytics", which contradicts the plan (bead `am-plat-clarity-signal-nlwr`, untouched since 09-17) |
| 79 | Two themes, one toggle (D-09-22) | WORKING | Moon/sun icon in the header (screenshot) |

### 3.6 Is the publication maintainable, and can it launch?

| # | Goal | Status | Evidence |
|---|---|---|---|
| 80 | Live is a known commit on `main`/`origin` | **REGRESSED** | Section 2 |
| 81 | Verified deploy with real candidate checks (§18.3) | PARTIAL | 9 checks registered, 0 declared not-runnable (**fixed since 09-27**). But the direct path promotes when checks are `not-available` (`verified-production-deploy.ts:980-995`) (NO_BEAD). There is no release manifest. The smoke test loads only `/` (`smoke-test-deployment.ts:108`) |
| 82 | Release records retained | NOT STARTED | 0 exist anywhere. Every record was written into a scratch worktree that is now gone |
| 83 | A paper can be marked complete, and `launch` differs from `preview` | NOT STARTED | `reading.ts:310` permits only `explanation-preview`. Launch and preview are both 31 steps, 0 different |
| 84 | Long-lived caching for content-addressed WASM | NOT STARTED | `cache-control: max-age=0, must-revalidate` |
| 85 | HEAD's test lanes are green | **REGRESSED** | Bun lane: 15,687 tests, 4 fail, 2 real (`usedLater.test.ts:45` exact-count assertion; bare-throw ratchet, 4 unbaselined lane scripts). I re-ran `usedLater` in the main checkout and got rc=1. Node lane: 434 tests, 6 real failures, including a parameter property at `inlines.ts:330` that `--experimental-strip-types` cannot load |
| 86 | A clean checkout builds | **BROKEN** | `bun run typecheck` in a fresh worktree stops with "PREPARE FAILED step 3 of 44": `build-equations.ts` → `printedExplanations.ts:7` imports the gitignored `src/generated/equation-explanations.json` it writes. Then step 6 needs `predict-prompts.ts` from the later `prepare:lab` (NO_BEAD) |
| 87 | The node lane gates something | VACUOUS | The registry's `unit-tests` step is the bun lane only. The node lane, where the am-4cpx and am-f3e4 proofs live, is in no gate step (`am-7bkr`) |
| 88 | Browser acceptance matrix (§17.4) | PARTIAL | One retained paper-journey run (desktop, 29/29). The keyboard, no-WebGL, WebKit, embed and "84 steps" lanes write no file and are wired to nothing; their only evidence is commit messages (NO_BEAD). The gated `browser-acceptance` step drives fixture apps only |
| 89 | Editorial review by named people (§17.2, §17.7(9)) | NOT STARTED | 0 human reviews anywhere. `docs/OWNERS.md` names 1 person and lists 54 open slots |
| 90 | Comprehension testing, the §17.6 scenario, AT sessions, real device | NOT STARTED | `docs/accessibility/runs/` is absent. 0 device runs |
| 91 | The iPhone app builds and is bound to a web release (§18.6) | **BROKEN** | `generated/app-edition/edition-source.txt` points at a deleted scratchpad. The manifest is `site.binding: unbound`. **The last exported edition carries the 154-byte placeholder WASM, not the 92,751-byte module.** 0 `ios/` commits since 09-24, 0 device runs, 37 open app beads, 0 closed |
| 92 | `README.md`/`AGENTS.md` status is accurate | STALE | README's status block (dated 09-24) understates the site in several places and overstates it in others (section 12) (NO_BEAD for README) |

### 3.7 Plan §21, the launch definition, condition by condition

| §21 condition | Holds? | Why not |
|---|---|---|
| The corpus is complete | Partial | Text, alignment and translation: yes. Headings and closings have no readings. 0 human review (the owner's rule covers the English only) |
| The entry paths are real | Partial | 4/4 entrances. Never tested with a reader |
| The arguments are reconstructible | Partial | Journeys: yes. LQ and SR have no marked derivation chains. 0 semantic trees on printed displays |
| The instruments answer questions | Partial | 33/33 live and honest. Acceptance cases are vacuous, with 0 refusal cases |
| The computation is real and bounded | Partial | FrankenSim reaches only diffusion. The other laws are TypeScript only |
| The book works as a book | Partial | Text without JS: yes. Controls are hidden rather than linked. Print drops words. Reading faces are up to 3.2× the budget |
| The publication is maintainable | **No** | Live is not on any branch. No release records. No release manifest. Clean checkout cannot build |
| The final product test | Not run | No reader has been tested |

**0 of 8 hold. 6 are partial, 1 fails, 1 has not been run.** On 09-24 the count was 0 of 8 as well.
The difference is that the partial ones are now much closer.

---

## 4. What changed since 2026-09-27 (390 commits on `main`, plus 27 off it)

**Fixed and verified by measurement:**
- The source manifest layers (`am-4cpx`).
- The action contracts are now audited against the rendered DOM (`am-jioj`).
- Show-the-code covers 33 of 33 labs, up from 6.
- The misconceptions audit reads real records.
- R0 is reachable without JS.
- Passage R2 is longer than R1 in 48 of 48 passages.
- The Ehrenfest 1911 and Einstein 1917 citations exist.
- Candidate checks are real, 9 of 9.
- The me-01 table exists.
- The Millikan dataset is digitized.
- Reading-face section scoping on the stranded line.
- Four paper-journey scenarios exist.
- Two misconception and tape surfaces are now visible to readers.

**Still open from 09-27:**
- `JOURNEY_MAP` holds only the fixture.
- Acceptance cases still dangle.
- `renderTime` does not exist.
- The registry has 0 consumers.
- The scrubber does not exist.
- Display r3 is still 71/200.
- Inline spoken forms do not exist.
- The essays, `/1904`, `/timeline` and `/bern` are absent.
- The clarity signal is absent.
- WASM caching is still `max-age=0`.
- `launch` equals `preview`.
- No paper can be marked complete.
- Five budgets have never been measured.
- The app is unbuildable.
- README is stale.
- `eq-s3-d12.yaml` still breaks standard YAML.

**Regressed:**
- Live is no longer built from `main`.
- HEAD's lanes are red.
- A clean checkout no longer builds.
- Reading-face weight on live went up by about 3% to 20% per face.
- `/accessibility/` overstates two things.

**Corrections to 09-27 itself:**
- "0 call sites" for the text layer was wrong: one gate spawns `pdftotext`.
- It said "55 slots"; there are 54.
- `am-decision-how-review-happens-sepc` "blocks the entire review layer": in the graph it blocks
  nothing, with 0 edges.

---

## 5. One defect class, now fourteen rows and twenty checks: the check that cannot see what it checks

`AGENTS.md` names this class three times: "A Tool's Exit Code Is Not Evidence…", "A Check Inherits
The Silence Of Whatever It Reads", and "A gate that forbids a construct must read code, not text".
On 09-27 there were six instances. Today:

| # | Gate | What it actually examines | Status |
|---|---|---|---|
| 1 | The structural pass: duplicate block ids, missing source block, broken alignment, equation identity, complete-while-missing, ledger marker in edition, span digest (`src/content/checks/structural/structural.ts:159,422,702,1194,1321,1487,1526`) | **0 source blocks, 0 translation units, 0 alignments.** verify-content feeds the compiler through `loadReadingFiles`, which skips YAML: 323 files, 2 of them YAML. Source blocks travel only as an id index (am-as1w). A planted equation mismatch was not caught. These are seven of AGENTS.md's "What the content compiler rejects" items | NEW (found in refinement round 3, by measurement) |
| 2 | Proof-cycle and oracle-edge checks (`src/content/checks/epistemic/`) | 0 `kind: proof` records, 0 typed edges | NEW |
| 3 | `checkJourney` (600+ lines) | The fixture | Open since 09-27 (`am-4k0m`) |
| 4 | Compiler shelf-date check | 0 journey records | NEW |
| 5 | `cardRules` (1904 boundary on cards) | 0 callers. Would fail a correct card on a date-string compare | NEW |
| 6 | Shelf publication gate | Counts unverified cards, never fails (46/46 unverified pass) | NEW |
| 7 | `verify-content` shelf audit | `{cards: []}` (`verify-content.ts:411`) | NEW |
| 8 | `verify-content` live-term check | 3 of 33 manifests by default; 67 errors hidden | Open (`am-1nnj`) |
| 9 | Acceptance cases | Counts `not-available` as resolved; 0 refusal cases | Open (`am-nxbq`) |
| 10 | Readings audit | Captions only (41 owner files), which is the population already at 100% | Partly open (`am-8gbg`) |
| 11 | Source manifest units | 544/544 `unspecified` | NEW |
| 12 | Perf first-route JS | Build-time basis; 22% under what is transferred | NEW |
| 13 | `ubs-diff` before deploy | The deploy requires a clean tree, so it scans 0 files | NEW |
| 14 | Agent-review guard | Distinct ids, never distinct models | NEW |

The direct deploy path's handling of `not-available`, and the node lane missing from the registry,
are close relatives of this class.

**Why patching them one at a time has not converged:** the doctrine is written as prose for agents
to remember, so each new gate is a fresh chance to forget it. Nothing in the repository mechanically
asks every gate "how many things did you examine, and does your planted negative turn you red?" The
bridge plan's Track G makes that question executable (section 9).

---

## 6. Software integrity at HEAD

Measured in a detached worktree. Single-file failures were re-run in the main checkout before being
called real.

- `bun run typecheck` rc=0 (44 generators). `check:types` 2/2. `check:architecture` 0 violations
  over 8,439 entries. Repo-wide Biome is 0 errors over 4,308 files, so AGENTS.md's "currently red"
  is stale.
- Bun lane: **15,687 tests, 15,682 pass, 4 fail.** 2 are artifacts of the worktree (perf tests need
  `.next/`) and 2 are real. Both real ones are fixed on the stranded tag.
- Node lane: **434 tests, 378 pass, 47 fail, 9 skip.** 39 need a built `out/` and say so
  ("not-available, not a pass"). **6 are real:**
  - the `inlines.ts:330` parameter property, which takes three e2e files with it;
  - 2 `formatterExclusions` tests;
  - the `prepare-lane` step-order test.
- `verify-wasm-artifacts` 12/12. `run-scenarios` 54 pass, 0 fail, 6 `not-available`.
- No commit since `440aebdc` removes more test assertions than it adds.
- `bareThrowsBaseline` went from 1,414 to 1,429. Two raises and three lowers, each recorded.

---

## 7. The swarm stopped

- **Timing.** The last commit was 2026-09-29 14:45. Commits by day: 58 on 09-27, 329 on 09-28,
  3 on 09-29.
- **No sessions.** There are no tmux sockets.
- **Claims.** All 24 of 24 in-progress claims are more than 48 hours old, and 5 have no assignee.
- **Cause.** The only recorded reason is a comment on `am-qsm9` at 09-28 00:32: "out of weekly
  credit until Oct 2". 329 commits landed after it, so the cause of the final stop is
  **unverified**.
- **Unexported comments.** Three bead comments from 09-29 exist only in `beads.db`, not in the
  tracked JSONL.

When it restarts:
- It will start on a `main` that is not live (section 2).
- It will work in a red tree (section 6).
- It will draw from the queue described in section 8.

---

## 8. The task graph can no longer steer

**Counts** (`br stats`, `br list --all --json`, read-only): 691 beads, of which:

| Status | Count |
|---|---|
| Closed | 168 |
| Open | 491 |
| In progress | 24 |
| Deferred | 2 |
| Blocked | 6 |

**An obsolete gate blocks a quarter of the graph.**
- `am-src-ocr-dispatch-interface-m1ur` ("Obtain and document the cloud OCR dispatch interface from
  the user", human gate) sits upstream of **166 of 523 non-closed beads**. It is the only human gate
  on the path of 93 of them.
- Its chain runs OCR adapter → OCR beads → ledger beads → German-edition beads.
- The ledgers were drafted another way long ago, under D-2026-09-24-text-layer-ledgers and the plate
  re-reads.

**Overall, 206 of 523 (39%)** sit downstream of a human gate.

**Finished content is still open.** At least 67 authoring beads stay open for content that ships:
- 33 "Build XX-NN" instrument beads;
- 7 translation beads;
- 13 readings beads;
- 7 equation-record beads;
- 7 foundation beads.

Every one has a live platform blocker. `am-inst-permalink-tape-s677` and
`am-inst-predict-mode-ti7m` block all 33 instrument beads, and show-the-code (`4brv`) blocks 30.

**Priorities are noise.** P0 holds 114 beads, 87 of them inherited from the plan conversion on
09-14 and 16 of them epics. 34 P0 beads are ready.

**The queue offers no reader-visible work.** The top 40 of `br ready`:
- 21 are epics;
- the other 19 are gates, decisions, OCR, harness or release beads;
- the three source-inventory beads among them have deliverables that already exist.

`bv --robot-triage`'s top picks are stale.

**Some closed beads overstate.**
- `am-rt-snapshot-store-aft` is closed, but the store has 0 consumers.
- `am-2rl9` is closed, but 15 of 22 tapes still cannot be replayed.
- `am-eq-expression-tree-8kl` is closed, but it covered infrastructure, not the 200 displays.

**Closures cannot be attributed.** `br audit log` records actor `jemanuel` on all 11 recent
closures, so the orchestrator-only closure audit that AGENTS.md describes has nothing to read.

**The repair bead is dormant.** `am-graph-unblock-authoring-7j4g` exists for exactly this problem.
It is in progress, has no assignee, and has not been updated since 2026-09-24.

---

## 9. Would finishing every open bead close the gap?

**No.** Five reasons, in order of size:

1. **Graph structure.** The obsolete OCR gate, the platform edges in front of finished authoring,
   and an inflated P0 set mean "finish the ready beads" drives effort into stale and process work.
2. **The NO_BEAD gaps.** Each one below was found today with no covering bead (the full list is in
   the "NO_BEAD" marks above):
   - the stranded live line;
   - the clean-checkout cycle;
   - the vacuous equation-identity gate;
   - the vacuous proof/oracle checks;
   - the `cardRules` date bug;
   - the publication gate that never refuses;
   - inline spoken forms;
   - display R2 shorter than R1;
   - the measured world checks;
   - dead export links;
   - the direct-promote hole;
   - the transferred-bytes basis;
   - the `/accessibility/` overclaims;
   - `notModeled` drift;
   - the placeholder WASM in the app;
   - the facsimile-pins text-layer read;
   - unrecorded relativity seeding;
   - manifest unit status;
   - unretained lane evidence;
   - README.
3. **Closures against vacuous gates produce closures, not assurance.** Section 5's fourteen rows (twenty checks)
   would turn every bead in their area green regardless of the product.
4. **Human gates without people.** 47 open human-gate beads, and 1 named human. The owner's
   agent-review ruling covers only the English translation. For the German ledgers, the physics
   review of derivations, R2 readability, disabled-reader sessions, comprehension rounds and the
   real-device check, no agent work closes the bead, and no decision yet says whether agents may.
5. **Beads closed while not done.** At least 3, listed in section 8. The graph believes these
   capabilities exist.

---

## 10. The bridge plan

The plan is ordered so that each track makes the next one meaningful. Durations are agent-swarm
estimates, not commitments.

### Track 0: stop the bleeding (one day, needs decision D-A)

1. Restore `main` to the live line: merge `rescue/2026-09-29-1500-four-landed`, resolve the one
   test conflict, run both lanes, push.
2. Retain release records somewhere tracked and durable. Expose the live build's commit at a
   static `/release.json` so "which commit is live" is a `curl`.
3. Make both lanes green at the new `main`. Most failures are fixed on the tag; the node-lane six
   (`inlines.ts:330`, `formatterExclusions`, `prepare-lane`) need fixes.
4. Break the prepare-chain cycle, so a clean checkout runs `typecheck`, `test` and `build`. Add a
   fresh-worktree bootstrap step to the gates.
5. Put the node lane into the gate registry.
6. Close the direct-promote hole: a `not-available` candidate check refuses promotion on every path.
7. Remove `pdftotext` from `verify-facsimile-pins.ts` (D-2026-09-21). Use `pdfinfo` page counts and
   digests only.
8. Either ship `/exports/v1/` (the emitter exists) or stop advertising it in `<head>`. Shipping is
   preferred.

### Track G: make every gate prove it can see (one week)

This is the structural fix for section 5.

1. **A gate census.** Every registered gate step and validator declares:
   - its population (what it reads, and how many it read this run, printed beside the verdict);
   - a minimum population, so a run over 0 fails;
   - at least one registered planted negative.

   A meta-gate runs each plant in a lane different from the one the gate controls, and fails when a
   plant stays green or a population is under its floor. This is the AGENTS.md doctrine turned into
   code, and it would have caught at least 12 of the 14 rows.
2. Fix the fourteen rows individually (twenty checks), each proven by its census entry:
   - equation identity reads real blocks;
   - real journeys go into `JOURNEY_MAP`, and the compiler sees journeys;
   - `cardRules` is wired in and its date compare fixed;
   - the publication gate enforces;
   - the shelf audit reads real cards;
   - `verify-content` compiles 33 of 33 and the 67 errors are fixed;
   - acceptance "resolved" means passing, with at least one refusal case per instrument;
   - argument premises get typed edges, so the proof and oracle checks see data;
   - the readings audit covers bindings, displays, headings and closings;
   - manifest unit status is derived from the tree;
   - perf measures transferred bytes;
   - `ubs` scans the release diff range;
   - the review guard records model identity (see D-B).
3. Browser lanes write retained JSONL evidence and are wired into the `browser` family. The
   `browser-acceptance` step drives the built site, not fixtures.

### Track R: re-cut the task graph (one orchestrator day, before the swarm restarts)

1. Remove the OCR-dispatch chain's edges (`m1ur` → `7wa1` → `am-src-ocr-*` → `am-src-ledger-*`).
   Re-point the ledger beads at "plate re-read and review" work, recording every removed edge in a
   comment so it can be restored.
2. Reconcile the 67 or more done-content beads: measure each deliverable on live. The orchestrator
   closes with evidence, or rescopes to what remains. Take platform edges out from in front of
   authoring, as `am-graph-unblock-authoring-7j4g` already argues.
3. Triage P0 to at most 15 beads on one written critical path. Release the 24 stale claims. Rescope
   the three over-closed beads.
4. Give `br` real actor identity on closures (`--actor`), so the closure audit has something to
   read.

### Track W: wire what is built (one to two weeks)

1. Result weave into the reading faces and the journeys (predicates for every lab that declares
   them).
2. Instance registry where a view must share an instance (reader stack plus lab), or a recorded
   decision to retire it. Generic decoder on the WASM path. `VisibilityCoordinator` pausing.
   `AccessibleGraphView` and `DataTable` in the labs.
3. Tape scrubber, Play for all 22 tapes, and the 10 placeholder digests replaced.
4. Reader-stack view loaders for all 33 labs.
5. One source for `notModeled` (lq-01, lq-06, sr-03). Journey notebook and explanation replay.

### Track E: equation depth, the largest content-engineering gap (two to three weeks)

1. A semantic tree, or an authored LaTeX form with validated term bindings (the §11.4 exception),
   for all 200 printed displays. That brings dimension checks, operation selection, and the
   modern-notation toggle on all four papers.
2. A `spoken` field on `MathInline`, plus authored forms for the 714 inline expressions.
3. Derivation chains with step, reason, tool and the move for:
   - LQ §4 and §6;
   - SR §3, §6, §8 and §10;
   - BM §§3–4 as printed, beside the pedagogical chain.
4. The 129 missing display R3s. Display R2 at least R1 wherever R1 has a step R2 skips. Readings for
   the 35 headings and closings.
5. The §15.6 equation ladder (read it aloud, what each part does, try a value, the next step, why it
   is allowed, a concrete example) built on the trees.

### Track C: editorial and surrounding material (two to four weeks, parallel)

1. The §3.9 margin entries: LQ 5, BM 7, SR 8, with primary sources.
2. World checks against dated measurements:
   - Millikan 1916 (LQ);
   - Perrin 1909 (BM, dataset needed);
   - aberration, Fizeau and Bucherer 1908 (SR);
   - Cockcroft–Walton 1932 (ME).

   Plus the remaining `HistoricalDataset` launch set.
3. The eight methodological essays. `/1904` with its shelf instruments. `/timeline`. `/bern`, plus
   the donor's reciprocal link as a separately reviewed change.
4. Tours: three more fifteen-minute tours, four one-evening tours, one full course. Capstone
   worksheets and an index. The kitchen protocol. The three missing connections threads. Teach-back
   and per-chapter predict-perturb-explain. A foundation `instrument` field and constructions for
   the 25 lessons without one. The German-sentence lesson.

### Track F: FrankenSim ownership beyond diffusion (two to four weeks, upstream)

Move radiation spectra, photoelectric bounds, flat-spacetime kinematics, field and wave transforms,
energy accounting and inference primitives into FrankenSim, per §12.3. The TypeScript evaluators
become audited fallbacks, cross-checked against WASM by differential tests. Per-capability slim
artifacts. Immutable caching for content-addressed WASM.

### Track L: release and launch readiness

1. A release manifest with a determinism digest, rollback that restores a coherent site, and the
   §18.3 smoke test (mass-energy plus its German endpoint).
2. A `complete` paper status, the §17.7 scorecard computed from the built site
   (`am-definition-of-done-as-code-8w1c`), and a `launch` profile that differs from `preview`.
3. The reading-face budget decision (D-C) and its implementation. A transferred-bytes first-route
   budget. No-JS controls as real links. The print fix. The clarity-signal decision (D-D).
   `/accessibility/` corrected.

### Track H: the human layer (owner, parallel, cannot be simulated)

Disabled-reader sessions with their own tools, comprehension rounds (§17.5), the §17.6 scenario, and
a real-device check. Plus whatever review D-B keeps human.

### Track A: the iPhone app (after Track 0's release record exists)

1. Re-export the edition from the deployed commit with `--release`.
2. Add a `determinismDigest` check, and keep the edition outside a scratchpad.
3. Add the site CSP, including `wasm-unsafe-eval`, to the scheme handler.
4. Get `gates:apple` green on iPhone and iPad.
5. Owner-only Apple identity steps.
6. Write `verified-app-release.ts`.
7. One device run.
8. `/privacy/` and `/support/` pages.

### Track D: documents

- README's status block.
- AGENTS.md status and command corrections.
- `FRANKENSIM_BINDING.md`'s pin.
- `EXPORTS.md`.
- Receipt frontmatter.
- Stale docblocks (`owners.ts`, `executionState.ts`).

### Track X: second-order fixes, so the same defects stop coming back

The tracks above fix instances. The history says instances recur:
- the defect class of §5 was written into AGENTS.md after 4 instances, grew to 6 by 09-27, and is
  14 today;
- the live/`main` split is the second time work was lost to a ref moving under the swarm (the
  first is D-2026-09-24-sweeper);
- three closures overstated their capability.

A plan that only lists instances gets re-run in a week with a new list. These items change the
conditions that produce them.

1. **Release from a fresh clone of `origin` at the release commit**, never from the shared tree or
   a worktree. This removes three failure modes at once:
   - a commit that is not on `origin` cannot ship;
   - stale gitignored generated files cannot hide the bootstrap defect;
   - a peer's uncommitted or swept edits cannot enter the bundle.

   Cost: one clone and a lockfile install per release.
2. **`main` only moves forward.** A `reference-transaction` git hook refuses any update of
   `refs/heads/main` whose old value is not an ancestor of the new one, and logs the process and
   time of every attempt. A push-cadence alarm in the orchestrator tick fires when local `main` is
   more than N commits ahead of `origin` for more than M minutes; the 09-29 loss was 18 unpushed
   commits. Installing a hook changes every pane's environment, so the owner approves it.
3. **Acceptance probes.** Every new bead's acceptance ends in a probe: a command plus a predicate on
   its output. Closure runs the probe on the candidate or live site and pastes the output. The tick
   reopens a closure without a passing probe. Recent close reasons already cite evidence (11 of 11);
   this makes the evidence something a machine re-checks, which the three over-closed beads lacked.
4. **Mutation testing for the content gates.** This generalizes the census's hand-written plants. A
   mutator generates systematic corpus mutants:
   - drop an alignment edge;
   - swap two dates;
   - perturb one LaTeX token;
   - move a card's `latestYear` past 1904;
   - delete a reading;
   - unbind a term.

   Each gate's mutation score (mutants killed over mutants applicable to its population) is
   recorded, and falls only with a recorded reason. Mutation analysis (DeMillo, Lipton and Sayward,
   1978) is the established way to measure whether a check can detect faults, which is the question
   §5 keeps answering by accident.
5. **Equation trees proven by round trip.**
   1. Parse each printed display's LaTeX (a restricted KaTeX subset) into the model-equation tree
      grammar.
   2. Regenerate the LaTeX.
   3. Compare the bytes.

   Where the round trip holds, the tree is mechanically validated against the ledger with no hand
   authoring; only the failures need the §11.4 authored exception. With the glyph-to-quantity
   bindings already in `content/display-terms/`, the rational-dimension check then covers all 200
   displays.
6. **Model-diverse review.** If D-B allows agent review, run rounds across model families (the ntm
   swarm can host Codex and Gemini panes). Bind typed findings to unit ids, and add a third round
   where the families disagree. Record agreement per paper only to route review effort, never as a
   published score.
7. **Property-based physics tests driven by the project's own Philox stream.** Metamorphic relations
   over seeded random inputs:
   - two collinear boosts compose to the boost of the composed velocity, with determinant 1;
   - the Doppler factor equals the boost eigenvalue;
   - the light-energy ratio equals the frequency ratio at every angle;
   - D scales as T/(ηa), and RMS displacement as its square root;
   - the two pulses' moving-frame energies sum to γL whatever the emission angle.

   As FrankenSim owners land, add TypeScript-versus-WASM differential tests at stated tolerances.
   Seeds are logged, so a failing case replays exactly.
8. **A live reality probe after every promotion.** It re-measures the checklist rows a reader can
   observe:
   - faces and labs return 200;
   - reading-face bytes;
   - `/release.json` equals the promoted commit;
   - every `rel=alternate` link resolves;
   - a sitemap sample has no 404;
   - CSP and cache headers.

   It fails the smoke test on any regression. Its consumer is the release script, and it replaces
   the expedition this report needed with a diff.
9. **If D-C chooses islands.** Reading faces become server-rendered static HTML, with term chips,
   the equation explorer and the passage actions hydrated as separate islands. Measure each face
   before and after. Most of the no-JS controls problem then disappears, because static links
   replace buttons that only work after hydration.

### Ordering

The tracks run in this order:

1. **0**.
2. **R and G**, in parallel.
3. **W, E, C and F**, in parallel.
4. **L**.

Alongside that sequence:
- H runs throughout.
- A follows L's release record.
- D rides along with each track.
- X1 and X2 belong with Track 0, because they stop the next stranding.
- X3 and X8 belong with Track L.
- X4 follows G1.
- X5 is how Track E1 should be done.
- X6 follows D-B.
- X7 runs with Track F.

Nothing in E, C or F should be closed against a gate that G has not yet given a census entry.

---

## 11. Decisions only the owner can make

| Id | Decision | Recommendation |
|---|---|---|
| **D-A** | Restore `main` from `rescue/2026-09-29-1500-four-landed` (merge; 1 test-file conflict), or keep `main` as reset and accept that the next deploy removes the 27 commits' work | **Merge**, push, then deploy only from `main` |
| **D-B** | Extend D-2026-09-25-agent-reviewed-translations to the German ledgers, the physics review of derivations, and R2 readability, or keep those human gates. If extended: require reviewers of a **different model family** from the author, and record the model in the guard | **Extend, with model diversity.** Keep disabled-reader sessions, comprehension rounds and the real device as human-only, because those cannot be simulated honestly |
| **D-C** | The reading-face budget: about 64% of the bytes are React's hydration payload. Either accept a measured budget per face, or make the reading faces static, with hydration only for interactive islands | **Islands.** It also helps first-route JS and the no-JS controls |
| **D-D** | The clarity signal: build it (the plan's one analytic) or withdraw it (`/about/` already says "no analytics") | Owner's preference. Either way, `/about/` and the plan must agree |

---

## 12. Corrections to the standing documents

- **README.md, status block (lines 19–27, dated 09-24).**
  - Wrong against the site, understating it:
    - relativity's German face is "not published" (it is);
    - "no English translation" (821 units exist);
    - "43 machine-drafted passages";
    - "190 entries" in the concordance (272);
    - "no FrankenSim result reaches a reader" (3 labs);
    - "55 slots" (54).
  - Overstating it:
    - line 13, "reviewed German text";
    - line 50, essays, the 1904 desk and the Bern bridge as present;
    - lines 122–124, the app's native search, Spotlight and release binding.
  - Line 195: `gates` runs fast **and** browser.
- **AGENTS.md.**
  - The status says "seven are registered … three not-available"; there are 9 checks, 0 not
    runnable.
  - FrankenSim: "one lab … bound to no lab yet" is wrong. It is three labs, and bm-05 and bm-06 are
    bound.
  - "199 of 200" displays; it is 200 of 200.
  - "about 5,900 lines of Swift"; it is 6,264.
  - `bun run test` is the bun lane only, not "bun + node".
  - Repo-wide lint is 0 errors, not red.
  - "34 generators"; there are 44.
  - The OCR section says "No implementation followed the withdrawn approval" and "the method that
    has produced four ledgers" (plate images). Both are contradicted by D-2026-09-24-text-layer-ledgers
    and by the relativity commits.
  - It does not mention the `facsimile-pins` `pdftotext` call.
  - It says nothing about which commit is live.
- **`docs/EXPORTS.md`** describes in the present tense endpoints that all return 404.
- **`docs/FRANKENSIM_BINDING.md`** headlines pin `5bbbfae6`, not `01824653`, and names TypeScript
  owners that do not exist.
- **Receipts.**
  - "The English face says so" appears in 3 receipts.
  - All 4 receipts' editorial boundaries mention a draft notice the faces no longer carry (D-09-25).
- **`/accessibility/`**: the two overclaims in row 70.
- **Code docblocks.**
  - `src/experiments/owners.ts:5-9` and `src/experiments/provenance/executionState.ts:12` say "No FrankenSim WASM artifact is
    used anywhere".
  - `noScriptControls.ts` says lab R3 is unreachable without script.
  - `publicationGate.ts` and the four `*Shelf.ts` files claim enforcement that never runs.

---

## 13. Side effects of this check, recorded honestly

- **Investigators.** All eight were instructed to be read-only on the repository.
  - The gates investigator created a detached worktree at
    `<session scratchpad>/gates/wt`, registered in `.git/worktrees`, and deliberately not removed.
  - The gates investigator also wrote gitignored files into the main checkout: `artifacts/test-logs/*`
    and eight `artifacts/budgets/perf-20261001T2042*.json`. These were written by single-file test
    re-runs. Nothing was deleted.
  - My own re-run of `usedLater.test.ts` also wrote gitignored test logs.
- **`git status`.** It was clean before and after every investigator.
- **Beads.** The beads created from this check carry the label `reality-check-2026-10-01` and the
  actor `claude-reality-check-2026-10-01`. One existing bead gained a blocker:
  `am-plat-clarity-signal-nlwr` now waits on decision D-D. 25 existing beads received comments
  with re-measured evidence. No bead was closed, reopened, deleted or reassigned.

## 14. Bead index

Epic: **`am-rc1001-bridge-plan-pcjk`**. Children are `.N` below.

| Track | Beads |
|---|---|
| Owner decisions | `.1` D-A restore `main` · `.38` D-B agent review beyond English · `.39` D-C reading-face hydration · `.40` D-D clarity signal |
| 0, stop the bleeding | `.2` merge the live line · `.3` `/release.json` plus origin guard plus durable records · `.4` node-lane six · `.5` clean-checkout bootstrap · `.6` direct-promote hole · `.7` `pdftotext` in `facsimile-pins` · `.8` dead export links |
| G, gates that see | `.9` gate census and meta-gate · `.10` equation identity · `.11` proof and oracle edges · `.12` shelf card gates · `.13` manifest units · `.14` readings-audit population · `.15` transferred first-route JS · `.16` `ubs-diff` on a clean tree · `.17` review guard and models · `.18` browser lanes' evidence |
| R, graph re-cut | `.19` OCR chain · `.20` reconcile shipped authoring · `.21` P0 triage and stale claims · `.22` three over-closed beads · `.23` closure actor |
| W, wire what is built | `.24` instance ownership · `.25` visibility pause · `.26` `notModeled` single source · `.27` journey notebook (weave, graph views, tapes and loaders are existing beads, commented) |
| E, equation depth | `.28` printed-display trees · `.29` inline spoken forms · `.30` display R3 and R2 · `.31` LQ and SR derivation chains |
| C, editorial | `.32` measured world checks · `.33` foundation instrument field · `.34` investigate-page label · `.35` `/accessibility/` overclaims · `.36` relativity seeding provenance · `.37` receipt and YAML hygiene |
| A, app | `.41` placeholder WASM in the edition |
| D, documents | `.42` README · `.43` AGENTS.md corrections · `.44` EXPORTS, FRANKENSIM_BINDING and docblocks |
| X, second-order | `.45` release from a fresh clone · `.46` `main` only moves forward, plus reset forensics · `.47` acceptance probes · `.48` corpus mutation testing · `.49` cross-model review rounds · `.50` Philox-driven property tests · `.51` post-promotion live probe · `.52` static faces with islands |
