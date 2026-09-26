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

## Committing In A Shared Working Tree

Several agents edit this one checkout at the same time. The index is shared, so
a commit is not scoped by who wrote what — it is scoped by what is staged.

1. **A pathspec limits files, not hunks.** `git commit -F msg -- <paths>` is
   still required, and it is still not sufficient. If the file you name is
   already dirty with a peer's uncommitted edits, those edits go into YOUR
   commit under YOUR message. This has happened twice.
2. **Read the file's diff before you stage it.** `git status <file>` and
   `git diff <file>`. If it carries hunks you did not write, you have three
   honest options, in order: commit only your own file(s) and leave that one
   alone; hand your change to the pane that owns the file; or, if the change is
   one or two lines, say so and let them carry it. Never stage a file whose
   diff you have not read.
3. **Do not repair a contaminated commit by reverting it.** Reverting deletes a
   peer's work from HEAD to fix a commit message, which is a deletion-shaped
   action on code that is not yours, and RULE 1 governs. Leave the commit,
   report it to the orchestrator, and tell the owning pane so their next diff
   does not surprise them. Wrong metadata is much cheaper than lost work.
4. **Commit as soon as your unit verifies.** Work left staged or uncommitted in
   a shared tree will eventually be swept into someone else's commit. Speed is
   the mitigation, not care.
5. **When your change and a peer's heavy edit share one file, ask the
   orchestrator to sequence the commits.** Rules 1 and 2 have no good answer
   here on their own: waiting means your verified work is swept into their
   commit, and committing means you carry their work under your message. Both
   branches lose, so do not choose between them silently. The orchestrator polls
   every pane and can tell the peer to commit first and you to follow, which
   costs one tick and yields two clean commits. Say which file and how many
   lines are not yours.
6. **Gate, test, and validator changes commit alone.** A diff that touches a
   ratchet, baseline, validator, or test helper never rides inside a feature
   commit, because bundled gate changes are unreviewable and are the exact
   shape a weakened gate hides in.

---

## A Gate's Own Test Must Not Live Only In The Lane That Gate Controls

If the only test proving a gate works runs in the lane that gate gates, the test
disappears at exactly the moment the gate fails open. The failure is
self-concealing: nothing reports the gate is broken, because the thing that would
report it is downstream of the break.

This is not hypothetical. `bun run test:node` refused to start for 49 commits and
12.5 hours, taking 48 test files with it, because its preflight also refused on a
condition that is permanently true in a shared checkout. It read like diligence
and nobody noticed. When it was repaired, the first pawl written to guard it was
itself vacuous and green.

So: when you write or repair a gate, keep a version of its proof in a DIFFERENT
lane from the one it controls. Where a fixture can only exist in the gated lane —
a real-git fixture for a git-aware preflight, for instance — write the
lane-independent half anyway, however coarse, and say in the comment which half
is watching which.

The same reasoning applies to a gate's refusal text. A well-written refusal is a
reason to check separately that the gate ever reaches a verdict, not a reason to
trust it: persuasive wording is what kept anyone from asking whether this one
still ran.

---

## A Tool's Exit Code Is Not Evidence Until You Know What It Examined

A command exits 0 and gets cited as proof. Nobody asks how many things it looked at.
When the answer is zero, the citation establishes nothing and reads exactly like a
clean result. This rule was treated as understood for weeks and never written down,
which is why the four instances below all happened in one session.

**Zero files checked reads as clean. So does zero tests run, zero sites scanned, and
zero records judged.**

The four, each with the mechanism rather than the moral:

- `bunx biome check $F`, with the paths in a shell variable. **zsh does not
  word-split an unquoted parameter**, so biome received ONE argument naming no file
  and printed `Checked 0 files in 1629µs`. The chain continued and "biome clean on
  all four" went into a commit message. Verify it: in zsh, `F="a b"; set -- $F`
  gives `$# == 1`; in bash it gives 2. The same mechanism cost a second agent
  fifteen planted negatives later the same night, where `bun test $SUITES` ran
  nothing and every plant read as passing.
- `${PIPESTATUS[0]}` read after a pipe, which returned `tail`'s exit code rather
  than the command's. **zsh's array is 1-indexed**, so index 0 names the wrong
  element. Use `${pipestatus[1]}` in zsh, and say which shell you are in.
- A grep cited as three hits, where the three hits were route listings rather than
  call sites. The count was right and the population was not the one being described.
- `cmd | head -1 || echo "(none)"`. **`head` exits 0 on empty input**, so the
  fallback never fires and four blank lines read as four findings.

The direction is the same every time: a vacuous run is indistinguishable from a clean
one, and both are green. Nothing in a passing command says "I examined nothing", so
the absence of an error reads as the presence of a result.

Practically: pass file lists as explicit arguments or an array, never an unquoted
variable; print what the tool says it examined (`Checked N files`, `Ran N tests`)
beside the verdict, and treat `N == 0` as a failed citation rather than a pass; run a
positive control when a sweep comes back clean, because a sweep that cannot fail and
a sweep with nothing to find look identical; and when a plant is the evidence, print
what actually landed in the file before reading the verdict, because an anchor that
did not match produces a green that means nothing.

This is the practice half of the same proposition that `summarize()` got wrong in code
(am-1hst): a result computed over an empty population is not a clean result. The
difference is where it lives. That one was a boolean ignoring an argument and was
fixed in one function; this one is a citation habit with no single site to repair,
which is why it is recorded here instead.

---

## A Count Is For Reporting, Not For Asserting

The section below is about counts offered as **evidence**. This is its boundary, and it was
learned by the rule above doing harm.

`receipt.test.ts` asserted `typos.length === 6` under a comment reading *"Denominator named: six
records on this receipt, three of them retracted"*. That is the anchoring rule, applied
faithfully, to the wrong kind of statement. Naming a denominator makes a **measurement**
auditable. Freezing one into an equality makes a **test** brittle. The receipt's list of
typographical errors grows every time a plate turns up a misprint, so the assertion broke on
correct work within the day: recording `err-typo-p908-1`, a comma the 1905 compositor dropped,
took the file from six records to seven and turned the test red while nothing it protects had
changed.

Worse, the stale census sat **above** the checks that mattered, so it aborted the test before
the retraction property was ever evaluated. A brittle count does not merely fail; it hides what
it was standing in front of. The same shape cost a session earlier when
`assert.equal(units.length, 87)` aborted above the assertion someone was reasoning about.

So:

- **Report** a count: anchor it, name its denominator, say what command produced it.
- **Assert** a property: every record is in exactly one bucket; a retracted correction is never
  served as live; a record with no retraction is always served as live. These hold at any size.
- **Assert identity, not census, when the members are permanent.** A retraction is kept and
  marked, never deleted, so naming `typo-h-for-y-axis-p899`, `err-typo-p899-1` and
  `err-typo-p902-1` by id is stable in a way counting them is not, and it states the historical
  fact the receipt exists to record rather than an arithmetic coincidence.
- **Replace the census with explicit non-vacuity.** A count assertion often guards emptiness by
  accident: drop it and a receipt whose records were all live would iterate the retraction loop
  zero times and pass while proving nothing. Assert `retracted.length > 0` and `live.length > 0`
  on purpose, with the reason written down.

## A Count Used As Evidence Is Anchored, And Names Its Denominator

A number offered as proof carries two obligations, not one. The denominator rule is
stated in the section above. This is its other half: **the pattern that produced the
count must be anchored to the thing being counted.**

Four independent instances in a single session, in four different measurements:

- `grep -ciE "MIT"` matched **`Emit`** in a comment, so a file with no licence header
  read as having one.
- `sort -u -t: -k2` deduped by the COUNT field, silently deleting 14 of 23 files from
  a per-file inventory that was then used to assign work.
- An unanchored `id:` regex reported 40 sentence ids where an anchored one found 37
  distinct and no duplicates — nearly raising a false id collision on frozen ids.
- `blockCoversCode` used `includes`, which cannot tell a string literal in executable
  code from the same literal inside a comment, so a note saying a site was untestable
  credited that site as tested.

The direction is never random. An unanchored pattern fails toward whatever text is
most common near the thing you are measuring, and in a codebase that is usually the
prose ABOUT it — comments, gap-notes, documentation — which correlates with absence.
So the error reliably inflates coverage and deflates debt.

Practically: anchor with `^`, `$`, `\b` and multi-word forms rather than bare tokens;
`sort -u` only on a whole line or dedupe in python by the identifying field; print the
matched tokens, not just the count, so a false positive is visible; and where a tool
already computes the number correctly, use it instead of re-deriving the number with a
grep. A count that will be reported, or used to assign work, is built keyed by its
identity and states its item count beside its total — `23 files / 87 sites` fails
loudly in a way `136` does not.

### A gate that forbids a construct must read code, not text

The sharpest form of the rule above, because it bites the gate's own authors. **Text that
DESCRIBES a forbidden construct is not the construct**, and a scanner over raw source cannot
tell them apart.

Three instances, all found by the gate misfiring rather than by review: the OCR guard's
comment-block exemption; the citation scanner counting prose; and, on 2026-09-22, a gate
asserting an emitter draws on no clock, which went red on the docblock of the validator beside
it — a comment quoting `new Date()` while explaining the plant that had proved the gate worked.
The gate was correct about the bytes and wrong about the question.

The direction matches the section above and is worse here, because the densest prose about a
forbidden construct is the documentation explaining why it is forbidden. A gate written well
enough to explain itself is a gate positioned to fail on its own explanation, so the better the
comment, the likelier the misfire.

Practically: strip comments before matching, blanking their bodies rather than deleting them so
line numbers still report; and prove the stripper in BOTH directions, because one that removed
everything would report a clean surface forever. The four cases worth asserting are a construct
inside a comment (must not match), the same construct in code (must match), a trailing `//` that
must not swallow the code before it, and a block comment that must not swallow the code after
it. Where stripping is not possible, say in the gate's own comment which half of the question it
answers.

---

## Branch Policy

- The primary branch is `main`.
- Work happens on `main`. Do not create feature branches unless the user explicitly asks for one.
- Do not reference `master` in docs or scripts.

---

## Project Status: Read This First

The repository holds a live application, its content records, the plans that specify it (the master plan [`COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md`](./COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md) v2.0 and the iPhone app plan [`COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_IPHONE_APP.md`](./COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_IPHONE_APP.md) v1.0, epic `am-ep-app-m247`), the superseded drafts (ASTRA, ASTRA_V2, FABLE), and the task graph in `.beads/` (`br`, analyzed with `bv`).

**Status, measured 2026-09-24 (TanElk, after the reality check; each clause names its command). This decays; re-measure before relying on a clause.**

- **Deployed.** The application is live at `annus-mirabilis.com`, `www.annus-mirabilis.com` and `annus-mirabilis-seven.vercel.app` since 2026-09-21, released only through `bun scripts/verified-production-deploy.ts` under the standing authorization docs/DECISIONS.md D-2026-09-23-standing-deploy-authorization (DNS changes are not covered). `vercel.json` keeps git deployment disabled. The release record now says "not-implemented" for candidate checks, because none exist yet (am-rel-candidate-checks-kc7y).
- **Facsimiles: 6 pinned** (`find public/papers/pdfs -maxdepth 1 -name '*.pdf' | wc -l`), each SHA-256 matching its receipt in `docs/provenance/`.
- **German ledgers: 4 machine drafts, 0 reviewed** (`ls public/papers/transcripts`; `find public/papers/transcripts -name '*-reviewed.txt' | wc -l`). Relativity's covers all 31 pages since 421d73f3 (2026-09-25). Three receipts record drafting from the text layer (D-2026-09-24-text-layer-ledgers).
- **The German face** renders text for all four papers, from the drafts (measured on live 2026-09-25: relativity's German face holds about 89,700 characters in `<main>`).
- **English translation, measured 2026-09-25 (TanElk): all four papers are FINAL**, 821 units (mass-energy 43, light quanta 235, Brownian 162, relativity 381), each translated and checked by AI agents in two fresh-eye rounds under docs/DECISIONS.md D-2026-09-25-agent-reviewed-translations (`grep -l '^agentReview:' content/translation-units/*/*.yaml | wc -l` gives 821 of 821). No person has reviewed any of it. Under D-2026-09-25-no-review-status-banners the reading pages carry no review banner, chip or credit line; the record lives in the units and `docs/provenance/`. Under D-2026-09-25-one-best-translation no alternative translations are published. Printed misprints are kept as printed, with typo records in the receipts (for example err-typo-p919-1). The interlinear gloss has units for all four papers, measured 2026-09-26 (`git ls-files content/gloss-units/<paper> | wc -l`: mass-energy 34, light quanta 161, Brownian 103, relativity 244). A unit becomes final only with `reviewState: reviewed` plus an `agentReview` record of at least two rounds by agents other than its translator; the schema refuses anything less (`src/content/schemas/source.ts`, end of file).
- **Printed equations, measured 2026-09-25 (TanElk):** 199 of the 200 printed displays are bound for color and interaction on every reading face (`content/display-terms/<paper>.yaml`: mass-energy 7, light quanta 52, Brownian 43, relativity 97 of 98), in the explanation's colors with hover, pin and term chips. Live since c1a09f4e for the displays bound by then.
- **Explanations:** 48 argument passages with R0-R3 across the four papers, all with review `draft` (`content/arguments/*/arg-*.json`). Every printed paragraph is bound to one or more passages and has its own r0 overview (`content/bindings/<paper>.yaml`, D-2026-09-24-explanation-grain). Brownian §3 has no passage of its own; its paragraphs are bound to arg-bm-diffusivity.
- **Instruments:** all 33 core labs are live (`ls -d src/app/lab/*/` lists 41 directories, including the shelf labs). Every number is a labelled host calculation.
- **FrankenSim, measured on live 2026-09-26 (GreenOx, mail 40852): one lab's results are computed by it.** BM-01, after "Apply trial settings", fetches `/wasm/fs-annus-diffusion/80a1f8fda6f69003/fs_annus_diffusion_bg.wasm` (92,751 bytes, sha256 equal to `public/wasm/manifest.json`, FrankenSim 01824653) in a dedicated worker and shows "Ideal model, computed with FrankenSim"; with the request blocked it shows "Ideal model, host calculation". On arrival every lab shows its static worked example and fetches no WASM (0 in 1,497 requests across 38 lab pages), by design. `diffusion1d_frames` and `philox_normals` are built into the artifact and bound to no lab yet (am-frankensim-repin-and-bind-jvhg).
- **People:** `grep -c 'open: recruiting' docs/OWNERS.md` gives 55 lines. The only named human is the owner (`jemanuel`). Nothing is marked reviewed, and no agent may mark it so.
- **`ios/` exists:** the iPhone app, about 5,900 lines of Swift (`find ios -name '*.swift' -print0 | xargs -0 cat | wc -l`). It runs in the simulator only.
- **Tooling:** Biome gates the fast lane (`biome.json`), `bun.lock` is committed, and `perf/profiles.json` is enforced by `scripts/perf/budgets.ts`.

**The standing rule is unchanged.** Paths, scripts, routes and tests named below may describe the planned layout rather than the current tree. Never claim that a file, script, test, route or deployment exists until you have checked it. When a bead names a planned script, check whether it already exists before creating it.

The earlier plan drafts (`COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_ASTRA.md`, `COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_ASTRA_V2.md`, `COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_FABLE.md`) are committed beside the master plan as a public record of how it was developed. They are superseded and are never a source of requirements.

**Sources of truth.** The master plan records intent and reasoning. The beads are the executable work queue, and each is written to stand on its own. Several beads record corrections to the plan found while converting it (numerical claims that failed a check, fixtures that would not expose the bug they were meant to catch). If a bead and the plan disagree, do not silently pick one: record the evidence with `br comments add <id> "..."` and raise it with the user. Decisions taken while converting the plan, including proposals that were considered and declined, are recorded in [`docs/PLAN_MINING_DECISIONS.md`](./docs/PLAN_MINING_DECISIONS.md); a declined proposal leaves no trace in the beads, so check there before re-opening one.

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
2. **Styling and typography.** **Semantic CSS, and deliberately no Tailwind dependency.** This line read "Restrained Tailwind" until 2026-09-22, which `docs/DECISIONS.md` D-2026-09-17-tailwind-styling-resolution had already superseded: the owner chose Option 2, semantic CSS migration with a ratchet gate, on the finding that the 8,339 Tailwind-shaped class names were "artifacts of prototype code ported into a repository that deliberately has no Tailwind dependency". One reading serif (Newsreader), one interface sans (Plus Jakarta Sans), JetBrains Mono for telemetry and code, and KaTeX's own fonts for mathematics, all self-hosted and subset without dropping needed glyphs (German diacritics, Greek letters, subscripts, primes, old notation). Text contrast is checked at WCAG AA for every color pair.

   **Themes: two, and one control (D-2026-09-22-one-sun-moon-theme-toggle).** The site has a light theme (`annalen`) and a dark theme (`kramgasse-night`), switched by ONE icon button in the header: a moon in light, a sun in dark. There is no visible "System" option and no theme menu, and the internal theme names are never shown to readers. Until the reader presses it, the page follows the device. **Until 2026-09-22 this paragraph said the opposite of authority:** it listed three themes (Annalen, Kramgasse Night, Slate), and was then corrected to say the theme set was undecided because the owner's ruling had never been written down (am-x03s). The ruling now exists, verbatim, in docs/DECISIONS.md. Do not restore a third theme, a theme menu, or a "System" choice.
3. **Mathematics.** KaTeX HTML plus MathML rendered at build time from a semantic expression tree. Only term and operation interaction hydrates. Malformed mathematics fails publication; raw `$LaTeX$` is never visible to a reader.
4. **Instruments.** SVG and Canvas by default; direct Three.js only where 2D loses spatial information. Three.js, the PDF viewer, and WASM never enter the initial reading route's dependency graph.
5. **Numerical owners.** FrankenSim (`~/projects/frankensim`, Rust nightly) compiled to a slim, feature-selected WASM artifact loaded in a dedicated Worker, plus audited TypeScript reference evaluators under `src/physics/reference/` that run as labeled host calculations and fallbacks.
6. **Content.** Declarative records (JSON or YAML, plus constrained Markdown for long prose) under `content/`, validated and joined by a build-time compiler into route-local payloads. Executable MDX, functions, runtime objects, and untrusted JavaScript never live in content files.
7. **Tooling.** Bun for tests and scripts, Biome for lint and format, `tsc --noEmit` for types, `ubs` for bug scanning.
8. **Hosting.** Vercel through the verified prebuilt candidate-then-promote release script; Cloudflare as registrar and authoritative DNS with DNS-only records at launch. `vercel.json` keeps `{"git": {"deploymentEnabled": false}}`.
9. **Privacy.** No accounts, no third-party scripts, no fingerprinting, no advertising, no hosted model. Reading progress, notes, tours, and predictions stay in local storage. The single analytic is the cookieless clarity signal.
10. **iPhone app.** A native SwiftUI shell in `ios/` hosting the same static edition, bundled and rendered by WKWebView from a local first-party origin, offline, built from the same commit and release as the website. See the iPhone app chapter below and the app plan.

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
| `ios/` (the FrankenPatents app): `project.yml` with its regenerate-and-diff check, the build-time export of web records, `PatentPDFReader.swift`, `PrivacyInfo.xcprivacy`, DEBUG launch arguments, UI tests that produce store screenshots, `scripts/dsr-apple-quality.sh` | Adapt the patterns, not the code | The iPhone app of `am-ep-app-m247`: a native shell around the bundled edition rendered by WKWebView. Its native TeX parser, SceneKit simulation tab, hand-typed theme, and source-substring parity checks are not ported |
| Patent claims, disputes, categories, lineages, era filters, broadside printing, the audio narration player, wizard reports, generic or Wright-default visual dispatch | **Do not port** | Replaced by argument steps, historical alternatives, evidence, and connections. Unknown experiment ids fail explicitly instead of showing a plausible wrong model |

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
- **Anchors:** `#s<n>`, `#s<n>-p<m>`, `#s<n>-p<m>-s<k>`, `#eq-<printed number>` (or the section-qualified `#eq-s<n>-<printed>` when a printed number repeats within a paper) or `#eq-s<n>-d<j>` for an unnumbered display equation, `#result-<slug>`, `#arg-<id>`, `#lab-<id>`, and `#entry-<paper slug>` for a paper's first-encounter record, whose id is `entrance-<paper slug>` (`#entry-brownian-motion`).
- **Instrument ids:** `lq-01` … `lq-09`, `bm-01` … `bm-08`, `sr-01` … `sr-13`, `me-01` … `me-03`; declared modes as `<instrumentId>:<mode>` (`lq-02:1904`, `sr-02:apparatus`); presets as `<instrumentId>-<slug>` (`sr-03-boost-0.6c`); predict prompts as `<instrumentId>-predict-<slug>`; teaching tapes by their file-name ids (`the-boost-to-0.6c`). A dot appears in an id only between two digits.
- **Canonical quantity ids:** lower camel case, semantic, and frame-tagged where needed (`frequencyEnergyDensity`, `wavelengthEnergyDensity`, `stoppingPotentialMagnitude`, `transverseForceComoving`). A similar glyph is never a binding key. A constant symbol binds a constant quantity whose value comes from the active constant set: the gas constant is `molarGasConstant`, and Einstein's printed $N$ binds `avogadroConstant` under a printed-historical set. Exactness belongs to the constant-set entry, never to the quantity. An inference output binds its own estimate quantity (`avogadroNumberEstimate`).
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
  app/                     # app edition export, native payloads, Apple gate, app release
ios/                       # the iPhone app (see the iPhone app plan)
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
- **Letters and photographs.** The Habicht letter and other correspondence are paraphrased, never reproduced; the Collected Papers transcriptions and translations are Princeton's editorial work. Public-domain photographs of Einstein (for example Lucien Chavan's patent-office portrait of about 1905, ETH-Bibliothek Zürich, Bildarchiv) are welcome anywhere on the site, including the home page and share cards, with an accurate source credit. The owner has decided that name and likeness restrictions do not apply to this free, open-source site; do not add caveats about them.
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

**The rule is about what is EXECUTED on this host, not about what may be READ.** Those two were
written as one sentence until 2026-09-20 and the distinction now carries weight, so it is stated
plainly in both directions below.

- **Never execute an OCR process here.** Delegate every OCR or machine-transcription *run* to a
  cloud **GPT-5.6 Luna worker**. This covers `focr`, Tesseract, OCRmyPDF, EasyOCR, PaddleOCR, and
  any other program invoked in order to recognize text from page pixels, in every call form.
- Do not install, invoke, benchmark, resume, or monitor a local OCR engine or daemon in this repository or elsewhere on this host. Do not use local CPU, GPU, NPU, or memory for OCR.
- If a Luna worker or the cloud execution path is unavailable, pause the OCR portion and report the blocker. **Do not fall back to local OCR.**
- Give cloud workers bounded, checkpointed page ranges. Preserve partial results after every chunk; never create one monolithic all-papers or all-pages batch. Limit concurrency so results remain reviewable.
- Local agents may inspect a pinned PDF, review already-produced page renders or OCR drafts, and hand-correct or author the ledger and editions. Those activities never authorize starting a local OCR process.
- **An agent may read the pinned page IMAGES. An agent may NOT read the embedded text layer.**
  The boundary has three parts and only the middle one changed:
  - pinned page **images**, read visually, and hand-corrected from - **ALLOWED**, and it is the
    method that has produced four ledgers;
  - the facsimile's embedded **text layer** - **FORBIDDEN**, by any route, as a drafting aid or
    otherwise;
  - any **OCR engine**, in any call form - **FORBIDDEN**.
- **This paragraph said the opposite until 2026-09-22 and the permission it described was
  withdrawn a day after it was granted.** The 2026-09-20 ruling ("Both layer and pixels") was
  superseded by `docs/DECISIONS.md` D-2026-09-21-facsimile-text-layer-stays-forbidden, where the
  owner selected verbatim **"Guard stands — withdraw the drafting aid (Recommended)"**. No
  implementation followed the withdrawn approval. The reason is recorded there: the denylist
  forbids the **purpose**, not the tool, so no change of extraction library affects it, and a
  measurement on `ap-18-639` found **86 stray single letters concentrated exactly where the
  inline mathematics is**.
- **Why this correction is worth more than its size.** A page transcribed from the text layer and
  a page transcribed from the plate are indistinguishable in the finished ledger; nothing
  downstream can tell them apart, so no later gate can catch a violation. The boundary holding at
  the moment of transcription is the only control there is. This paragraph is where an agent
  reads its permissions at session start, and while it carried the superseded text it was a
  standing instruction to do the forbidden thing.
- **What has not changed:** the denylisted engines stay denylisted in every call form, and the OCR
  guard's denylist and call-form coverage are untouched by any of this. `pdfinfo` and `pdftoppm`
  are not denylist entries and remain available. Proposing to relax the guard on the strength of
  any paragraph here is out of scope and goes back to the owner.
- Cloud OCR output is research evidence only, and so is any ledger drafted from it. (The clause
  that used to extend this to an embedded text layer is now moot rather than wrong: the layer may
  not be read at all, so no ledger can be drafted from one.) Such a ledger is a **machine draft
  with hand correction**, and a ledger hand-transcribed from the plates is a **hand draft**;
  NEITHER satisfies an acceptance criterion that requires human review. Measured on 2026-09-20,
  `docs/OWNERS.md` holds **one named human (`jemanuel`) and 54 slots marked `open: recruiting`**,
  among them `open-german-source-mass-energy` - so for every paper, the reviewer who would turn
  either kind of draft into a reviewed ledger does not yet exist. A draft says that in its own
  receipt, not only in a commit message.

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
- **Ownership.** Equations beads own displayed-equation and derivation-step readings, instrument beads own caption readings, and readings beads own paragraph, heading, footnote, and closing readings. Each owner declares its targets in its own file, `content/editorial/readings-owners/<bead id>.yaml`, so parallel authors never edit a shared file, and the readings audit reports any target with no owner or two.
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

**The two dangerous collisions are called out in red on first use:** Einstein's $\beta$ is the modern $\gamma$ (paper 3; paper 4 is expected to write the factor out as an explicit radical, which the facsimile must confirm; in paper 1 $\beta$ is Wien's constant $h/k_B$), and Einstein's $k$ in paper 2 and in the dissertation is viscosity, not Boltzmann's constant. The dissertation's coefficient of $\varphi$ in its viscosity law (1 as printed in 1906, 5/2 after the 1911 correction) is therefore never called $k$. Other scoped symbols: $L$ (speed of light in paper 1, emitted energy in paper 4, a magnetic-field component in paper 3 §6), $N$ (Avogadro's number in papers 1 and 2, a magnetic-field component in paper 3), $E$ (energy, an electric field, a body's rest-frame energy), $\tau$ (the moving-frame time in paper 3, never the modern proper time; an observation interval in paper 2), $P$ (work function in paper 1, particle radius in paper 2), $\nu$ (frequency in papers 1 and 3, number density in paper 2), $\varphi$ (spectral entropy density in paper 1, the transition kernel in paper 2, an angle in paper 3, a volume fraction in the dissertation), $K$ (a force in paper 2, the stationary system in paper 3, kinetic energy in paper 4), $V$ and $v$ (volume, velocity, or light speed depending on the paper; verify each printed glyph against the facsimile), and $\alpha$.

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

- The donor's control tape is reused with model identity, seed and stream version, quantized control events classified by command class, `prediction` events, and checkpoints with a digest (`host:` until `fs-blake3` is bound, then `blake3:`). Authored teaching tapes include "Einstein's 0.8 micron," "Perrin's count," "the boost to 0.6c," "the two pulses," and "the locked positions" (tape ids `einstein-0-8-micron`, `perrins-count`, `the-boost-to-0.6c`, `the-two-pulses`, `the-locked-positions`). The scrubber restores a permalinked tape. Time is host-fed through the tick scheduler.
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
- **Adversarial fixtures** are deliberately plausible wrong results that must fail for the intended reason: halving diffusivity halves displacement; a radial distribution is an ordinary Gaussian; camera noise leaves neighboring increments independent; an unbiased estimate stays unbiased after inversion; an arbitrary entropy-density constant cancels; a spectral-axis relabeling preserves density; a light complex contracts like material volume (tested with longitudinal rays and with a ray transverse in the unprimed frame, because a ray transverse in the moving frame gives exactly the material factor and cannot discriminate); forces have equal numerical components in different frames; an observer change starts a new experiment; a moving mirror receives the fixed-surface incident power; the low-speed proxy is the exact mass coefficient at every speed; a large seed survives as a JSON number; a 1 μm radius reproduces Einstein's 0.8 μm; the locked-position probability is $f^n$; a neutral conductor with current violates $|J/\rho| < c$.
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
- **Structured logs.** Every test suite writes JSON lines to `artifacts/test-logs/<suite>/<log-run-id>.jsonl` with, where applicable: `timestamp`, `suite`, `logRunId` (one execution of a test suite, never the experiment run; pipeline and tool executions such as OCR runs, downloads, coverage reports, audits, and review packets name their artifact directories with `<tool-run-id>` in the same timestamp-plus-hex format and are referenced from records and log events as `toolRunId`, and temporary test directories use `<log-run-id>`), `testId`, `beadId`, `paper`, `anchor`, `instrumentId`, `instanceId`, `runId` (the experiment realization, as in the runtime contract), `inputRevision`, `acceptedInputRevision`, `snapshotVersion`, `seed` (decimal string), `streamVersion`, `modelVersion`, `artifactDigest`, `executionLabel`, `resultStatus`, `expected`, `actual`, `tolerance`, `comparisonKind` (`bitwise`, `tolerance`, or `formatted`, where a formatted comparison formats both engines' full-precision values through the same precision rules and compares the strings), `outcome`, `durationMs`, `browser`, `viewport`, `reducedMotion`, `jsEnabled`, and a readable `message`. A failing browser test retains a screenshot, trace, DOM snapshot, and console log, and the failure-reporting path is itself tested.
- **Never weaken a gate** to get green: do not delete evidence, loosen a tolerance without a recorded reason, skip a lane, or rerun a flaky statistical test until it passes. A green typecheck or build establishes software integrity only; editorial acceptance is recorded separately.
- **Five independent release questions.** Is the historical text complete and accurate? Is the explanation mathematically and physically sound? Does the instrument calculate and display the stated model correctly? Can a visitor operate and understand the actual page? Does the explanation help a reader overcome the intended obstacle? No single artifact answers all five.

---

## Verification Commands (Available Once the Scaffold Lands)

### Before you commit: seconds, and yours to run

These are affordable enough that there is no excuse for skipping them, and between them they catch
the two ways this repository has actually broken.

```bash
bun run check:types                        # 2.3s  tsc --noEmit AND the instrument registry, named separately
bun run check:architecture                 # 0.3s  App Router root and root-file allowlist
bunx biome check --write <your files>      #       YOUR changed files, by explicit path, never the repo
bun test <the one test file you changed>   #       one file, not a lane
ubs --diff
ubs --staged
```

`bun run check:types` exists because `bun run typecheck` is **not** `tsc --noEmit`: it is
`prepare:content && prepare:lab && prepare:offline && tsc --noEmit`, 34 generators before the
typechecker, and its exit code cannot tell you which of the two failed. On 2026-09-20 it exited 1
having printed no `error TS` line at all, because a generator threw and `tsc` never ran. The lane
runs the checks separately and says which one broke. Both of that day's outages turn it red.

Biome is run **on the files you changed, by explicit path**. Repo-wide `bun run lint` is currently
red on files nobody in this batch authored, so it cannot be a pre-commit gate, and reformatting a
file you only touched one line of buries your change in a diff nobody can review.

### Central verify: minutes, and the orchestrator's to run

Do not run these to check your own commit. They are expensive, they are shared, and four panes each
running a full lane is four times the cost of the orchestrator running it once.

```bash
bun run gates                              # full local gate chain (bun scripts/quality-gates.ts --fail-fast --family fast)
bun scripts/quality-gates.ts --profile scaffold  # scaffold release profile verification
bun scripts/quality-gates.ts --profile preview   # preview release profile verification
bun scripts/quality-gates.ts --profile launch    # launch release profile verification
bun run typecheck                          # the prepare chain, then tsc --noEmit
bun run lint                               # Biome, repo-wide
bun run format                             # Biome format
bun run test                               # unit and integration tests (bun + node multi-runner)
bun run test:node                          # the node lane, derived from bunfig pathIgnorePatterns
bun run build                              # production build, including the content compiler
bun scripts/verify-content.ts              # every compiler rejection plus Rules 0 to 2
bun scripts/verify-wasm-artifacts.ts       # digests, instantiation, exports, Philox cross-check, refusals
bun scripts/e2e-paper-vertical-slices.ts   # browser acceptance lanes with JSONL logs
```

**Neither test lane typechecks anything.** `bun test` strips types and the node lane runs
`node --experimental-strip-types`, which also strips them, so a green suite says nothing about
whether the repository compiles. That is what `bun run check:types` is for.

Until a command exists, do not report it as passing.

---

## Vercel Deployment Standards

- Release only through `bun scripts/verified-production-deploy.ts` adapted under `am-rel-verified-deploy-qndt`. **Never call `vercel deploy --prebuilt --prod` directly.** The verified entry point takes an exclusive local deployment lock on TCP port `48915` (`127.0.0.1:48915`), refuses a dirty worktree or another active build, runs the profile quality gates, checks that `vercel build` produced a full version 3 Build Output API artifact (fresh mtime, >= 100 files), deploys with `--skip-domain`, validates the unpromoted candidate via the protected-preview adapter, and only then moves aliases (`annus-mirabilis.com`, `www.annus-mirabilis.com`, and `annus-mirabilis-seven.vercel.app`) with automatic rollback on partial failure.
- **Target Hostnames & Platform Hazard:** Target hostnames are `annus-mirabilis.com`, `www.annus-mirabilis.com`, and `annus-mirabilis-seven.vercel.app`. **HAZARD NOTE:** The plain `annus-mirabilis.vercel.app` belongs to ANOTHER Vercel account; never target, link, or alias to `annus-mirabilis.vercel.app`.
- **Publication Profiles:**
  - `scaffold`: targets platform domain `annus-mirabilis-seven.vercel.app` by default; targets custom domains only with `--include-custom-domains` and matching explicit authorization.
  - `preview`: requires publication-contract, candidate checks, and lists only closed papers.
  - `launch`: requires all four complete papers closed and verified.
- **Pipeline Modes:**
  - `--candidate-only`: builds, checks, and saves a candidate release record to `artifacts/releases/<tool-run-id>.json`; never moves aliases.
  - `--promote <deployment-id-or-url>`: verifies recorded candidate checks, manifest digest, and commit against HEAD; promotes without rebuilding.
  - `--dry-run`: executes preflight validation without side effects.
- **User Authorization Files:** Every live deployment or alias move requires `--authorization <path>` referencing a JSON or YAML file matching schema `annus-mirabilis-deploy-authorization.v1`, authorized by `jemanuel` within 24 hours, matching preflight HEAD commit, profile, scope, and target hostnames. A human gate is never self-certified.
- **Release Records & Structured Logging:** Persistent release identity uses `toolRunId`, recording candidates to `artifacts/releases/<tool-run-id>.json`. Each process invocation writes structured JSONL logs to `artifacts/deploy-logs/<log-run-id>.jsonl` with `suite: "verified-production-deploy"`.
- A **release manifest** binds the site source revision, content edition version, source-asset hashes, WASM artifact hashes, generated schema version, and test results.
- Candidate checks load all four complete paper texts, representative foundation pages, and every instrument bundle, and include one no-JavaScript source-text check, one real accepted WASM result per numerical capability, and one deliberate typed refusal, all against the deployed assets rather than the build directory. After promotion, a short live smoke test loads the mass–energy paper and its German edition endpoint.
- Rollback restores a coherent site, content, and kernel set and never points old HTML at incompatible new WASM. Immutable content-addressed figures and WASM get long-lived caching; manifests and HTML never reference a removed artifact.
- **Changing DNS, connecting a domain, or deploying requires explicit written authorization from the user in the current conversation.** Planning documents do not authorize it. Classic Patents is never changed as part of this site's release; the two sites fail and recover independently.

---

## iPhone App (Planned)

The app lives in `ios/` with its scripts in `scripts/app/`. It is specified by [`COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_IPHONE_APP.md`](./COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_IPHONE_APP.md) and built by the `am-ep-app-m247` epic. Nothing under `ios/` exists yet; `am-app-agents-chapter-egpg` replaces this section with verified commands once the Apple gate and release script land.

The shape: a native SwiftUI shell (library, outlines, Discover and Lab catalogues, native search, Spotlight, Handoff, universal links, share, print, settings, facsimile downloads) around the **same static edition**, bundled in the app and rendered by WKWebView from a local first-party origin, with a narrow versioned bridge for storage, settings, sharing, and lifecycle events.

Rules that bind every change under `ios/` and `scripts/app/`:

- Swift never computes, caches, or formats a displayed physical quantity, and never authors reader-facing scientific text. Numbers come from the edition's runtime; words come from compiled records.
- The reader never loads remote web content. The edition is bundled, built from the same commit and release profile as the website, and bound to a web `releaseId`.
- Never reimplement the reader faces, readings, equations, instruments, or physics natively. The donor's native TeX parser and its animation-only simulation tab are the mistakes this app exists to avoid.
- Generated Swift models, design tokens, route tables, and editions are build products; never hand-edit them, and never commit a generated edition.
- No web bead depends on an app bead, and app work never delays a website batch.
- No third-party Swift packages without a recorded reason, a license inventory entry, and a privacy-manifest review.
- Apple account work, external TestFlight distribution, uploads, and App Store submission are human gates that need the user's explicit written authorization in the current conversation. Uploads go only through `scripts/app/verified-app-release.ts`.
- Apple validation runs locally as the `apple` gate family, not in the website's CI. Never delete or erase a simulator, and never delete reader data on a device.

## Swarm Operations and Honest Credit

These rules bind human-directed sessions and agent swarms alike.

**Purpose.** The output of agent work is working, deployable capability delivered
accretively. Process exists to serve that outcome and must never become the product.

**Closure is orchestrator-only, and it is audited.** `br` in this repository has no
workflow-gate configuration surface, so a direct `open` to `closed` transition is not
refused by the tool. It is instead detected: the orchestrator snapshots the closed set
every tick and reopens any closure it did not make, with an incident comment naming the
actor. Do not close a bead, yours or a peer's. Move finished work to a state the
orchestrator can verify and say so in the bead and by Agent Mail.

**The creation gate for process artifacts.** A certificate, ledger, dashboard, matrix,
meta-report, readiness review, or conformance check may exist only if it names, at
creation: its concrete consumer, the gate it enforces, the observed defect class that
justifies it, and its deletion condition. The boundary test is whether running code
branches on the artifact. If only humans and status reports read it, it is process, it
earns zero capability credit, and it should not be created. Writing code solely to
manufacture a consumer does not pass the gate.

**Named reward-hacking patterns.** These are forbidden and are cited by id in incident
comments:

- **RH-1 gate self-weakening**: editing validator, conformance, or test-gate code so a
  failing check passes. Gate-code diffs are reviewed separately, never bundled.
- **RH-2 proof-class inflation**: presenting fixtures, captures, mocks, or hand-inserted
  rows as live proof. The hierarchy is static, unit and planted-red, capture and replay,
  live, field; no lower class substitutes for a higher one.
- **RH-3 golden regeneration reflex**: regenerating goldens to match broken output.
- **RH-4 commit-stream pumping**: trivial or artificially split commits, and placeholder
  scaffolds that pass a syntax gate. Commit rate is a saturation signal, never a metric.
- **RH-5 tautological tests**: tests asserting that the code does what the code does.
  Every feature carries at least one negative a naive wrong implementation would fail.
- **RH-6 easy-bead cherry-picking**: claiming low-risk leaves while critical-path work
  starves. Claim the highest-priority ready bead.
- **RH-7 close-pump abuse**: closing items to flood the ready pool.
- **RH-8 scope-splitting**: splitting one unit into types, implementation, and tests to
  harvest several closures. Code and its tests ship in the same bead.
- **RH-9 follow-up laundering**: moving an in-scope acceptance condition into a new bead
  and closing the original.
- **RH-10 spec-editing as progress**: weakening a plan, spec, or frozen decision instead
  of implementing it. The decisions in `docs/PLAN_MINING_DECISIONS.md` are frozen.
- **RH-11 dependency smuggling**: vendoring or shimming around a banned dependency.
- **RH-12 demo-path hardcoding**: special-casing fixtures so the happy path passes.
  Environment sniffing in product code is forbidden outright.

**Refusal is not delivery.** An implementation that only builds the guard or refusal path
is labeled refusal-only and stays open. It reads as unfinished, not shipped.

**Blocked means named.** If work is blocked on something external, say exactly what is
missing and what substitutes you are forbidden to fake it with. Waiting earns no credit.

**Evidence discipline.** Never silence stderr in a command whose output will be cited as
evidence. A close request without cited evidence is a debt, not a completion.

**Builds go through `rch`.** Compilation and test commands are offloaded to the remote
worker fleet. Never report a build result you did not observe.

**Ask whether a build is running by gating on the EXECUTABLE, never on argv text.** Only one
`next build` may run in this checkout at a time, so panes check before starting or before
touching `out/`. The check itself is the trap: a shell's own command line contains the
pipeline text, so `ps aux | grep -cE "[n]ext build"` matches the wrapper shells that are
running the search. Measured on 2026-09-22 with exactly one real build alive, it returned
**4**, of which four of the five matching lines were `/bin/zsh -c source ...` wrappers and
two of those had been created by that very command a second earlier. The `[n]ext` bracket
trick defeats a literal self-match and does nothing about a wrapper whose argv carries the
whole string, so the number is not merely wrong, it is unstable: measuring changes it.

Use the form that tests what is EXECUTING, not what is mentioned:

```bash
ps -eo pid,comm,args | awk '$2 ~ /(^|\/)node$/ && /\.bin\/next build/ {print $1}'
```

A build's `comm` is `node`; a wrapper's is a shell. Read the OUTPUT, not the exit code:
`awk` exits 0 with nothing to print, so empty output means no build and the exit status
means nothing here (see "A Tool's Exit Code Is Not Evidence Until You Know What It
Examined" above).

**This paragraph has now been wrong twice, and both wrong versions read as careful.** Until
2026-09-22 it said to use "the resolved binary path, which only a real invocation has" and
gave `pgrep -fl "node_modules/.bin/next build"` with the comment `# 1 line, the real build,
or nothing`. That was corrected the same day to `pgrep -fl "\.bin/next build$"`, which was
also wrong, and which this replaces. The closing sentence used to read: "when a process
check can match the process doing the checking, anchor it on something only the target can
contain." Anchoring is exactly what failed.

Measured on 2026-09-22 against a population built for the purpose - one plain build, one
build carrying a flag, one shell wrapper whose argv ends with the string:

| form | plain build | `next build --debug` | zsh wrapper |
|---|---|---|---|
| `pgrep -f "node_modules/.bin/next build"` | found | found | **matched** |
| `pgrep -f "\.bin/next build$"` | found | **MISSED** | **matched** |
| the `comm`-gated form above | found | found | correctly excluded |

The anchored form fails in BOTH directions: false-green on any added flag, because `build`
stops being the last word, and false-positive on a wrapper whose argv happens to end there.
False-green is the dangerous direction, since it says the slot is free while a build writes
`out/`.

One more trap the table does not show, and the reason the regex is `(^|/)node$` rather than
`== "node"`: on this machine `ps -eo comm` prints a bare `node` for some processes and a
full path for others, and zsh appears four ways (`zsh`, `-zsh`, `/bin/zsh`, `-/bin/zsh`).
An equality test against `"node"` would go false-green the day a build is invoked through an
absolute path. Match the basename.

**Five instances across four people, and every repair until this one lengthened the pattern
without changing its kind.** Two panes named zsh wrappers as builds; one read "3" from a
grep that matched its own pipeline; the anchored "fix" was then found false-green under a
flag. The durable proposition: **a substring match against argv cannot distinguish a process
from a process that MENTIONS one, and making the substring longer never fixes the kind of
error.** That is the same rule as "A gate that forbids a construct must read code, not text"
a few sections above, wearing different clothes - there the text that describes a construct
is not the construct, here the command line that names a program is not the program. When a
check can match the thing doing the checking, do not lengthen the pattern. Change what you
are matching ON.

**A probe goes in the session scratchpad, never under `src/`.** This is the enforcement half of
RULE 2 point 3, and the reason outranks tidiness: a file under `src/` is TYPECHECKED. On
2026-09-22 a spawn probe left in `src/testing/hygiene/` referenced `Bun.spawnSync`, which this
repository's ambient `Bun` type does not declare, so for about twenty minutes it was the sole
`error TS` and broke `bun run check:types` **for every pane**. It did not need anyone to run a
bare `git add -A` to do damage; it only needed to be compiled. Two panes independently placed a
spawn probe in that same directory within four minutes while chasing the same `EBADF` on
`posix_spawn '/usr/bin/git'`, which is a fact about how visible this norm is rather than about
either of them. If a probe is already in the tree, **`mv` it to your scratchpad; do not delete
it.** A move is not a deletion and RULE 1 does not block one, which matters because the moment a
probe lands in the repo nobody can remove it without the owner. Confirm the move three ways
rather than assuming it: the destination present with a byte count, the source directory holding
zero of those files, and `find src -name '<probe>*'` returning zero. The third check is not
redundant with the second - it is what caught a SECOND probe, belonging to another pane, that had
appeared four minutes after the first was moved.

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

The commands live in one place: **Verification Commands**, above, which states which are yours
before committing and which are central verify's. This section used to restate five of them without
that split, so it told you to run `typecheck`, `lint`, `test` and `build` after your own changes
while the other section says those four are the orchestrator's. Two statements of one rule drift
apart, and these two already had.

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

<!-- bv-agent-instructions-v4 -->

---

## Beads Workflow Integration

This project uses a Beads tracker—either the Go `bd` CLI or the Rust `br` CLI—for issue tracking, plus [beads_viewer](https://github.com/Dicklesworthstone/beads_viewer) (`bv`) for graph-aware triage. Issues are stored in `.beads/`. `bv` auto-discovers supported JSONL exports, including `.beads/issues.jsonl` and legacy `.beads/beads.jsonl`.

**Choose the tracker CLI from this repository's instructions and configuration.** Use `bd` commands in a Go Beads workspace and `br` commands in a beads_rust workspace. Do not run both trackers against the same workspace or infer the tracker solely from the JSONL filename.

### Using bv as an AI sidecar

bv is a graph-aware triage engine for Beads projects. Instead of parsing .beads/issues.jsonl / .beads/beads.jsonl directly or hallucinating graph traversal, use robot flags for deterministic, dependency-aware outputs with precomputed metrics (PageRank, betweenness, critical path, cycles, HITS, eigenvector, k-core).

**Scope boundary:** bv handles *what to work on* (triage, priority, planning). The selected tracker CLI (`bd` or `br`) handles creating, claiming, modifying, and closing beads.

**CRITICAL: Use ONLY --robot-* flags. Bare bv launches an interactive TUI that blocks your session.**

#### The Workflow: Start With Triage

**`bv --robot-triage` is your single entry point.** It returns everything you need in one call:
- `quick_ref`: at-a-glance counts + top 3 picks
- `recommendations`: ranked actionable items with scores, reasons, unblock info
- `quick_wins`: low-effort high-impact items
- `blockers_to_clear`: items that unblock the most downstream work
- `project_health`: status/type/priority distributions, graph metrics
- `commands`: copy-paste shell commands for next steps

```bash
bv --robot-triage        # THE MEGA-COMMAND: start here
bv --robot-next          # Minimal: just the single top pick + claim command

# Token-optimized output (TOON) for lower LLM context usage:
bv --robot-triage --format toon
```

Before claiming, verify current state with the selected tracker: `br show <id> --json`/`br ready --json` or `bd show <id> --json`/`bd ready --json`. `recommendations` can include graph-important blocked or assigned work; only `quick_ref.top_picks` and non-empty `claim_command` fields represent claimable work.

#### Other bv Commands

| Command | Returns |
|---------|---------|
| `--robot-plan` | Parallel execution tracks with unblocks lists |
| `--robot-priority` | Priority misalignment detection with confidence |
| `--robot-insights` | Full metrics: PageRank, betweenness, HITS, eigenvector, critical path, cycles, k-core |
| `--robot-alerts` | Stale issues, blocking cascades, priority mismatches |
| `--robot-suggest` | Hygiene: duplicates, missing deps, label suggestions, cycle breaks |
| `--robot-diff --diff-since <ref>` | Changes since ref: new/closed/modified issues |
| `--robot-graph [--graph-format=json\|dot\|mermaid]` | Dependency graph export |

#### Scoping & Filtering

```bash
bv --robot-plan --label backend              # Scope to label's subgraph
bv --robot-insights --as-of HEAD~30          # Historical point-in-time
bv --recipe actionable --robot-plan          # Pre-filter: ready to work (no blockers)
bv --recipe high-impact --robot-triage       # Pre-filter: top PageRank scores
```

### Tracker Commands for Issue Management

Use exactly one command family, matching the tracker configured for the repository.

#### Rust beads_rust (`br`)

```bash
br ready --json                       # Show issues ready to work (no blockers)
br list --status=open --json          # All open issues
br show <id> --json                   # Full issue details with dependencies
br create --title="..." --type=task --priority=2 --json
br update <id> --status=in_progress --json
br close <id> --reason="Completed" --json
br close <id1> <id2> --reason="Completed" --json
br sync --flush-only                  # Export DB to JSONL after Beads mutations
```

#### Go Beads (`bd`)

```bash
bd ready --json                       # Show issues ready to work
bd show <id> --json                   # Full issue details
bd create "..." -t task -p 2 --json
bd update <id> --claim --json         # Atomically claim work
bd close <id> --json
bd dep add <issue> <depends-on>
bd export --no-memories -o .beads/beads.jsonl  # Refresh the export read by bv
```

### Workflow Pattern

1. **Triage**: Run `bv --robot-triage` to find the highest-impact actionable work
2. **Verify**: Check the selected tracker's `show`/`ready` output before claiming
3. **Claim**: Use `br update <id> --status=in_progress --json` or `bd update <id> --claim --json`
4. **Work**: Implement the task
5. **Complete**: Use the selected tracker's `close` command
6. **Refresh for bv**: Run `br sync --flush-only` or the `bd export` command above so the JSONL export is current

### Key Concepts

- **Dependencies**: Issues can block other issues. `br ready --json` and `bd ready --json` show unblocked work.
- **Priority**: P0=critical, P1=high, P2=medium, P3=low, P4=backlog (use numbers 0-4, not words)
- **Types**: task, bug, feature, epic, chore, docs, question
- **Blocking**: Use `br dep add <issue> <depends-on>` or `bd dep add <issue> <depends-on>` to add dependencies

### Git Policy

Tracker commands do not grant permission to commit or push application code. Follow this repository's own git and tracker instructions before staging, committing, syncing, or pushing. If the repository says "commit only when asked," that rule overrides any generic workflow advice.

<!-- end-bv-agent-instructions -->
