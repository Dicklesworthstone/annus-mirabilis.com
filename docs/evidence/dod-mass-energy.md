# Definition of Done Audit: Mass–Energy Equivalence (`ap-18-639`)

- **Bead:** `am-dod-mass-energy-oxh2`
- **Paper:** *Ist die Trägheit eines Körpers von seinem Energieinhalt abhängig?* (Ann. Phys. (4) 18, 639–641, 1905)
- **Bibliographic Key:** `ap-18-639`
- **Audited Build Identity:** local working tree at commit `e7658b6a98e40c4b586e79a24522d01857ef5ae6` (`git log -1`, run during this audit)
- **Audit Date:** 2026-09-16
- **Auditor:** `agent:MaroonTiger` (Automated Coding Agent, Wave Two), acting under BoldHarbor's bead assignment. This document contains no claim attributed to the project owner or to BoldHarbor beyond what is quoted verbatim from AGENTS.md or a bead.
- **Governance Reference:** [`docs/OWNERS.md`](../OWNERS.md)
- **Structured log:** `artifacts/test-logs/dod-mass-energy/20260916T160817Z-a9acceb7.jsonl` (`logRunId: 20260916T160817Z-a9acceb7`, 12 records, one per item below plus the three exit-evidence pieces, written through `am-test-logging-standard-l3cp`'s `TestLogger`)
- **Overall Status:** **NOT MET (0 of 9 items passed; exit evidence not met)**. This matches the orchestrator's stated expectation before the audit began: the mass-energy paper has no content, no facsimile, no source layers, and no instruments.

---

## Methodology and its stated limits

Every finding below carries an explicit proof class, per the project's proof hierarchy (AGENTS.md; RH-2 proof-class inflation is named there as a forbidden pattern): `field` (real hardware or live human study) > `live` (running-process inspection) > `capture-and-replay` > `unit` (automated test assertions) > `planted-red` > `static` (direct filesystem/schema inspection) > `desk-inference` (reasoning from documents, must say so) > `ABSENT` / `NOT PERFORMED`.

**Stated limitation, recorded rather than worked around.** This wave's standing code-first discipline instructs every lane not to run `bun run build`, the Playwright suites, or the full test suite individually, because the orchestrator runs one centralized batch verification. This bead's own text asks for verification against "the running site," meaning `bun run build` then `bun run start`. I did not run either. Every finding below is `static` (file, directory, and bead-registry inspection) or a `unit`-class citation of a specific existing test file, never a claim about a live build or a live browser session I did not run. Where the bead's Test Plan calls for a live e2e or build check I could not perform, the item is marked **NOT PERFORMED**, not passed.

I ran exactly one automated command myself, `bun run typecheck`, because it is cheap and explicitly sanctioned by this wave's discipline text. Its result is reported in Item 9 with the caveat that it reflects the current shared working tree (which includes other lanes' uncommitted, untracked in-progress files), not a clean commit.

---

## 1. Item 1: Provenance receipt

- **Requirement:** `docs/provenance/ap-18-639.md` exists and is complete: typed dates, a page map, comparison witnesses, translation credits, acceptance sections from review records.
- **Check performed:** `test -f docs/provenance/ap-18-639.md`; `ls docs/provenance/`.
- **Finding:** `docs/provenance/ap-18-639.md` is **ABSENT**. `docs/provenance/` contains only a `survey/` subdirectory, which holds `docs/provenance/survey/ap-18-639.md` (15 KB, last modified 2026-09-15T13:58:47Z) — a differently-named, differently-located planning survey document, not the receipt this item names. I did not treat the survey document as satisfying this item; it is at the wrong path and this bead's requirement is a specific file path.
- **Proof class:** `static` (direct file existence check).
- **Outcome:** **NOT MET**. No bead in the dependency list above owns this specific receipt file; flagging that `docs/provenance/ap-18-639.md` has no visible owning bead as a gap in its own right.

---

## 2. Item 2: Source layers (facsimile, ledger, German edition, English edition, gloss, alignment)

- **Requirement:** Pinned facsimile, reviewed diplomatic ledger, German edition, English edition, complete word-level gloss, and many-to-many alignment all share one SHA-256 and pass the edition tests; the source manifest reports every block covered.
- **Check performed:** `find public/papers`; `find content -iname "*mass-energy*" -o -iname "*ap-18-639*"`; `find content -maxdepth 3 -type d`.
- **Finding:**
  - `public/papers/` does not exist at all in this repository (`find` reported "No such file or directory"). No facsimile PDF exists for any paper, including mass-energy.
  - No `content/papers/mass-energy.json` exists; `content/papers/` contains only `brownian-motion.json`.
  - No `content/arguments/mass-energy/` or `content/equations/mass-energy/` directories exist; `content/arguments/` and `content/equations/` contain only `brownian-motion/` subdirectories.
  - The one content record that does exist for any paper, `content/papers/brownian-motion.json`, self-declares `"status": "explanation-preview"`, `"sourceStatus": "in-preparation"`, and a `sourceNotice` field stating verbatim: *"This is newly authored explanatory text in modern notation, with editorial review pending. It is not the German source, an English translation, or a complete edition of the paper. The reviewed source faces and pinned facsimile remain in preparation."* This is quoted, not paraphrased, and establishes that even the most advanced paper in this repository has no reviewed source face yet — mass-energy has no paper record of any kind.
  - `content/quantities/mass-energy.yaml` exists, but is a canonical-quantity registry file (dimensions, units, formatting) owned by `am-ref-constants-xik`/the quantity-registry bead, not a source, translation, or gloss record.
- **Proof class:** `static` (directory and file existence checks).
- **Outcome:** **NOT MET / ABSENT**. Every sub-requirement of this item is absent.

---

## 3. Item 3: Readings and equations

- **Requirement:** R0–R3 for every paragraph/statement/footnote/closing block (`am-me-readings-69bo`); full `Equation` records for every displayed/inline equation (`am-me-equations-0mgx`); printed-glyph conformance; the §8-import derivation chain; caption readings for ME-01/02/03 and the box extension; the readings-ownership audit reporting no `owner-unassigned`/`owner-conflict`, with per-owner files under `content/editorial/readings-owners/`.
- **Check performed:** `br show am-me-readings-69bo`, `br show am-me-equations-0mgx` (status only); `find content/editorial/readings-owners`.
- **Finding:**
  - `am-me-readings-69bo` (readings) and `am-me-equations-0mgx` (equations): both bead status **open**, zero comments — no work has been reported against either.
  - `content/editorial/readings-owners/` **does not exist as a directory** (`find` reported "No such file or directory"). No owner-assignment files exist for any paper, so the "no `owner-unassigned`" condition cannot be evaluated because the mechanism it depends on has not been built.
  - No equation records exist for mass-energy (§2 above already establishes `content/equations/` has only a `brownian-motion/` subdirectory).
- **Proof class:** `static` (bead-registry and directory checks).
- **Outcome:** **NOT MET / ABSENT**.

---

## 4. Item 4: Results and misconceptions

- **Requirement:** Seven result cards, each with a decoder and a live probe; a misconception ledger with at least five (seven authored) entries with instrument presets.
- **Check performed:** `br show am-me-results-cards-c6mf`, `br show am-me-misconceptions-tr18` (status only); content directory search for mass-energy result/misconception records (none found in the §2 tree walk).
- **Finding:** `am-me-results-cards-c6mf` and `am-me-misconceptions-tr18` are both **open**, zero comments. No result or misconception content exists under `content/` for mass-energy (confirmed by the same directory walk as Item 2, which found no mass-energy-specific content directories at all).
- **Proof class:** `static`.
- **Outcome:** **NOT MET / ABSENT**.

---

## 5. Item 5: Instruments ME-01, ME-02, ME-03, and box mode `me-03:box-1906`

- **Requirement:** Dispatcher case and instance-scoped owner; tape identity with the four named teaching tapes; honest execution label and `notModeled`; predict mode with the five named prompts; show-the-code; action contract; embed route verified by the `am-inst-embed-route-rnyg` sweep with a cited `logRunId` and coverage summary; 320 px layout, keyboard operation, reduced motion.
- **Check performed:** `find src/experiments -maxdepth 1 -type d`; `find . -iname "*me-01*" -o -iname "*me01*" -o -iname "*me-02*" -o -iname "*me02*" -o -iname "*me-03*" -o -iname "*me03*"` (excluding `node_modules`/`.git`); `find src/app/lab -maxdepth 1 -type d`; `find artifacts/test-logs -iname "*embed*"`.
- **Finding:**
  - `src/experiments/` contains instrument directories `bm01`, `bm05`, `bm06`, `bm07`, `bm08` and shared infrastructure directories (`commands`, `digest`, `identity`, `permalink`, `predict`, `provenance`, `results`, `scheduler`, `states`, `store`, `streams`, `tape`, `tapes`). **No `me01`, `me02`, or `me03` directory exists.**
  - The repository-wide search for "me-01"/"me01"/"me-02"/"me02"/"me-03"/"me03" (case-sensitive substrings) returned exactly one hit, inside a compiled WASM build artifact filename (`artifacts/wasm-build/.../eceqwx199r2fme03xtmvl5al0.o`) — a coincidental hash substring, not an actual ME-03 artifact. I am naming this explicitly so it is not mistaken for evidence of anything: it is a false positive I checked and ruled out.
  - `src/app/lab/` contains only `bm-01`, `bm-05`, `bm-06`, `bm-07`, `bm-08`. No `/lab/me-01`, `/lab/me-02`, or `/lab/me-03` route exists.
  - `artifacts/test-logs/` contains no `embed` directory or file of any kind, at any path. There is no coverage summary to cite because no embed sweep has ever run.
  - No `Mc^2`/`γMc^2` energy-initialization code exists anywhere under `src/physics` (checked by grep across `src/physics`); this is not evidence of a passing non-circularity check, because there is no mass-energy energy-ledger code to check in the first place. Recording this as **NOT APPLICABLE (no code exists to evaluate)**, not as a pass, per this bead's own instruction not to mark an item passed on absence of counter-evidence.
- **Proof class:** `static` (directory and repository-wide search).
- **Outcome:** **NOT MET / ABSENT**. None of ME-01, ME-02, ME-03, or the box mode exist in any form.

---

## 6. Item 6: Journey IV

- **Requirement:** Front door (Einstein's two ledgers); both side doors (no-algebra first encounter `entrance-mass-energy` at `#entry-mass-energy`, and the programmer's 1906 box); six dated/sourced shelf cards; the Poincaré-fluid-vs-energy-has-inertia fork; live check steps; an accepted `physics-math` review record on the chain's `move.r0Summary`.
- **Check performed:** `find src/app/discover -maxdepth 2`; `br show` on `am-me-first-encounter-kejt`, `am-me-03-box-extension-kiei`, `am-disc-journey-iv-shelf-ff7g`, `am-disc-journey-iv-chain-wwrz`, `am-me-review-physics-1t2l` (status only).
- **Finding:**
  - `src/app/discover/` contains only `brownian-motion/page.tsx`. **No `/discover/mass-energy` route exists.**
  - `am-me-first-encounter-kejt`, `am-me-03-box-extension-kiei`, `am-disc-journey-iv-shelf-ff7g`, `am-disc-journey-iv-chain-wwrz`, `am-me-review-physics-1t2l`: all **open**, zero comments each.
  - Separately, `bun run typecheck` (run for Item 9, see below) surfaced 5 real type errors in an untracked, uncommitted directory `src/testing/entrances/` and an untracked `content/arguments/brownian-motion/entrance-brownian-motion.json`. These are in-progress files from a different lane building the generic "entrance" mechanism for **brownian-motion**, not mass-energy; I am noting them only because they are the closest thing to entrance-mechanism work visible anywhere in the tree right now, and they are (a) not for this paper and (b) not yet passing typecheck. They are not evidence toward this item.
- **Proof class:** `static` (route directory check, bead-registry check) plus one directly-observed `unit`-adjacent typecheck run (see Item 9) for the tangential entrance-mechanism note.
- **Outcome:** **NOT MET / ABSENT**.

---

## 7. Item 7: Margin

- **Requirement:** Six required historian's-margin records and the boundary note on later derivations, with primary sources.
- **Check performed:** `find content/foundations content/arguments -iname "*mass*energy*" -o -iname "*me-*"`; `br show am-me-margin-entries-kfg5`.
- **Finding:** No matching files found. `am-me-margin-entries-kfg5` is **open**, zero comments.
- **Proof class:** `static`.
- **Outcome:** **NOT MET / ABSENT**.

---

## 8. Item 8: Tour

- **Requirement:** A fifteen-minute tour exists, and a reader with no physics background completed it and stated the claim in one sentence (`am-me-review-reader-l6iy`).
- **Check performed:** `br show am-me-review-reader-l6iy` (status only); `docs/OWNERS.md` role lookup for mass-energy.
- **Finding:** `am-me-review-reader-l6iy` ("Non-physicist R2 readability review and fifteen-minute tour test for mass-energy") is **open**, zero comments. In `docs/OWNERS.md`, the row `open-tour-tester-mass-energy | | tour-tester | mass-energy | open: recruiting | not-applicable | agent:BoldHarbor | 2026-09-16` shows this role is unfilled — quoted directly from the file, not paraphrased. No tour has been taken by anyone; there is no tour to take, because there is no content.
- **Proof class:** `static` (bead status, direct quotation of `docs/OWNERS.md`).
- **Outcome:** **NOT PERFORMED**.

---

## 9. Item 9: Gates and acceptance

- **Requirement:** Green `verify-content`, typecheck, lint, format check, build, `ubs --diff`, WASM artifact verification, and the Playwright suite `am-me-e2e-qbbm` in every lane; editorial acceptance recorded in the receipt with reviewer names.
- **Check performed and results, each named individually and honestly:**
  - `bun run typecheck`: **RAN MYSELF**, at the working tree described above. Exit code 2. 5 `error TS...` lines, all inside the untracked `src/testing/entrances/` directory described in Item 6 (not committed, not related to mass-energy). I did not stash or otherwise touch that peer lane's uncommitted files to get a "clean" number; this is the honest, directly-observed result of running the command against the tree as I found it. Proof class: `unit`/`static` (I ran the command and read its output myself, just now).
  - `scripts/verify-content.ts`: file **exists** (`test -f` confirmed). I did not run it, per this wave's code-first discipline (it is invoked as part of `bun run typecheck`/`prepare:content`, which I did run once above; I did not run it as a standalone gate separately). Proof class: `static` (existence only).
  - `scripts/verify-wasm-artifacts.ts`: file **does not exist** (`test -f` confirmed absent). This exact gate cannot currently be green because the script it names has not been written.
  - `scripts/run-scenarios.ts`: file **does not exist** (`test -f` confirmed absent). The mass-energy scenario re-run this bead's Test Plan asks for (`bun scripts/run-scenarios.ts --owner mass-energy`, including `mass-energy-printed-factor`) cannot be performed; the runner script itself is absent.
  - `bun run build`, `bun run lint`, `bun run format:check` (repository-wide), `ubs --diff`, the Playwright suite `am-me-e2e-qbbm`: **NOT PERFORMED by me**, per this wave's standing instruction not to run builds or browser suites individually. I am not citing BoldHarbor's separately-reported aggregate numbers ("typecheck 0, format 0, 1788+ tests passing, 12 beads closed") as evidence for THIS item, because those numbers describe the whole repository at a different, unspecified commit and say nothing about mass-energy specifically; reusing them here would be exactly the kind of desk inference dressed as a direct observation this session has twice already had to retract. If the orchestrator's own centrally-verified numbers are wanted as evidence for this item, they should be cited by the orchestrator, with their own recorded commit and run id.
  - `ubs` binary: confirmed present on `PATH` (`which ubs`) but not invoked.
  - Editorial acceptance: **NOT PERFORMED**. `docs/OWNERS.md` shows `open-german-source-mass-energy`, `open-physics-math-mass-energy`, and `open-r2-readability-mass-energy` all at `open: recruiting` (quoted directly from the file), so none of German fidelity, physics review, or R2 readability review has a named reviewer, let alone a completed review.
- **Proof class:** mixed, each line labeled individually above; the only `unit`-class result I generated myself is the typecheck run.
- **Outcome:** **NOT MET**. Two of the seven named scripts do not exist yet; the ones I could cheaply check myself are either absent or (for typecheck) failing due to unrelated in-progress work; the rest were not performed under this wave's own discipline; no editorial acceptance has been recorded.

---

## Batch D exit evidence

- **A noncircular derivation, confirmed by `am-ver-no-circularity-audit-6vj`.** Bead status: **open**, zero comments (`br show`). No circularity audit has been performed for mass-energy because there is no mass-energy derivation to audit yet. Separately, I searched `src/physics` for any code that initializes a body's energy as `Mc²` or `γMc²` (the exact circular pattern AGENTS.md's "No circular explanations" section names) and found none — because no mass-energy physics code of any kind exists. Recording this precisely as **NOT APPLICABLE**, not as a pass: the absence of the forbidden pattern is trivially true only because the code that could contain it does not exist. **This requirement is not met**, and I am recording it here explicitly so a later reviewer does not read "no circular pattern found" as "audited and clean."
- **The exact, Taylor, and proxy comparison ($0.25L$ vs. $0.18L$ at $0.6c$; printed-factor readout $L/9\times10^{20}$ vs. $c^2$; ratio 1.0013851).** `scripts/run-scenarios.ts` does not exist (Item 9); no ME-02 fixtures exist (Item 5); no comparison record exists anywhere in `content/` for mass-energy (Item 2/4 tree walks). **NOT MET / ABSENT**.
- **The full prose and every qualification** (additive-constant/Newtonian premises, independence from a body's qualities, the §10 comparison, the conditional radium remark, the conditional closing sentence about radiation conveying inertia). No mass-energy prose of any kind exists in `content/` (Item 2). **NOT MET / ABSENT**.

---

## Gap Matrix & Owning Beads

| Item | Category | Status | Proof class | Owning open bead(s) |
|---|---|---|---|---|
| 1 | Provenance receipt | NOT MET (file absent) | static | none visible — flagging as an unowned gap |
| 2 | Source layers (facsimile/ledger/DE/EN/gloss/alignment) | NOT MET / ABSENT | static | `am-edn-gloss-mass-energy-g0y`, `am-edn-review-german-mass-energy-w3y` |
| 3 | Readings & equations | NOT MET / ABSENT | static | `am-me-readings-69bo`, `am-me-equations-0mgx` |
| 4 | Results & misconceptions | NOT MET / ABSENT | static | `am-me-results-cards-c6mf`, `am-me-misconceptions-tr18` |
| 5 | Instruments ME-01/02/03 + box mode | NOT MET / ABSENT | static | `am-me-03-box-extension-kiei`, `am-inst-embed-route-rnyg`, `am-inst-show-the-code-4brv` |
| 6 | Journey IV | NOT MET / ABSENT | static | `am-me-first-encounter-kejt`, `am-disc-journey-iv-shelf-ff7g`, `am-disc-journey-iv-chain-wwrz`, `am-me-review-physics-1t2l` |
| 7 | Margin | NOT MET / ABSENT | static | `am-me-margin-entries-kfg5` |
| 8 | Tour | NOT PERFORMED | static | `am-me-review-reader-l6iy` |
| 9 | Gates & acceptance | NOT MET | unit + static | `am-ver-no-circularity-audit-6vj` (2 of 7 named scripts absent: `verify-wasm-artifacts.ts`, `run-scenarios.ts`) |
| Exit: noncircularity | Batch D exit | NOT MET (not applicable — nothing to audit) | static | `am-ver-no-circularity-audit-6vj` |
| Exit: exact/Taylor/proxy comparison | Batch D exit | NOT MET / ABSENT | static | (no dedicated bead found under the mass-energy epic in this audit's dependency list) |
| Exit: full prose & qualifications | Batch D exit | NOT MET / ABSENT | static | `am-me-margin-entries-kfg5` and the source-layer beads above |

---

## Conclusion

Every one of the nine per-paper items and all three pieces of Batch D exit evidence are **NOT MET**. The mass-energy paper has no provenance receipt at its required path, no facsimile, no reviewed source or translation, no readings, no equation records, no result or misconception content, none of ME-01/ME-02/ME-03 or the 1906 box mode, no Journey IV route or content, no margin entries, no tour, and no completed editorial review of any kind. Two of the nine scripts this bead's own gate list names (`scripts/verify-wasm-artifacts.ts`, `scripts/run-scenarios.ts`) do not exist in the repository at all. This matches the orchestrator's stated expectation exactly.

**Recorded for later reference so it is not lost, per the assignment:** the mass-energy energy ledger, whenever it is built, must never initialize a body's energy with $Mc^2$ or $\gamma Mc^2$. Deriving mass-energy equivalence from a formula that already assumes it is the named circular explanation AGENTS.md forbids under "No circular explanations": *"Deriving mass–energy equivalence with a body-energy formula that already assumes it (initializing $E_0 = Mc^2$ or $\gamma Mc^2$)"* is listed there as one of four explicitly prohibited circles, each requiring "a compiler or review check." No such check exists yet (`am-ver-no-circularity-audit-6vj` is open); this requirement should not be closed against mass-energy without one.

`am-dod-mass-energy-oxh2` should **remain open**. Nothing in this audit closes it or any of the beads it depends on; per the swarm's credit rules, only the orchestrator closes beads.
