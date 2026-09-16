# Definition of Done Audit: Special Relativity (`ap-17-891`)

- **Bead:** `am-dod-relativity-105y`
- **Paper:** *Zur Elektrodynamik bewegter Körper* (Ann. Phys. (4) 17, 891–921, 1905)
- **Bibliographic Key:** `ap-17-891`
- **Audited Build Identity:** local working tree at commit `1253ca6e1dd14747febbbaa6eb5341c76da26bb9` (`git log -1`, run during this audit)
- **Audit Date:** 2026-09-16
- **Auditor:** `agent:MaroonTiger` (Automated Coding Agent, Wave Two). No claim in this document is attributed to the project owner or to BoldHarbor beyond text quoted verbatim from AGENTS.md, a bead, or `docs/OWNERS.md`.
- **Governance Reference:** [`docs/OWNERS.md`](../OWNERS.md)
- **Structured log:** `artifacts/test-logs/audit-dod-special-relativity/20260916T185948Z-34f29267.jsonl` (`logRunId: 20260916T185948Z-34f29267`, 21 records covering the 9 items, 4 exit-evidence pieces, 4 corrections-register entries, 2 optional studios, and the 2 notation hazards, gitignored, written through `am-test-logging-standard-l3cp`'s `TestLogger`)
- **Overall Status:** **NOT MET (0 of 9 paper-facing items met)**, with one important qualification: real, tested physics-reference-layer and quantity-registry groundwork for this paper exists (kinematics, constants, frame-tagged quantity ids), even though no instrument, no content record, and no reader-facing surface for this paper exists yet. Both are reported precisely below so neither is overstated.

---

## Methodology and its stated limits

Proof-class hierarchy, as in the mass-energy audit (`docs/evidence/dod-mass-energy.md`): `field` > `live` > `capture-and-replay` > `unit` > `planted-red` > `static` > `desk-inference` > `ABSENT` / `NOT PERFORMED`. This wave's code-first discipline forbids running `bun run build`, `bun run start`, or the Playwright suites individually; I did not run any of them. Every finding below is `static` (file/directory/bead-status inspection, or a direct quotation) or `unit` (a specific test file I located and can name, without re-running the full suite myself). Field and live checks are marked **NOT AVAILABLE**, not attempted, not inferred.

---

## 1. Item 1: Provenance receipt

- **Requirement:** `docs/provenance/ap-17-891.md` with typed dates, page map, comparison witnesses, translation credits.
- **Check performed:** `test -f docs/provenance/ap-17-891.md`; `ls docs/provenance/`.
- **Finding:** **ABSENT**. `docs/provenance/` contains only a `survey/` subdirectory holding `docs/provenance/survey/ap-17-891.md`, a differently-named planning survey at a different path — not this receipt.
- **Proof class:** `static`.
- **Outcome:** **NOT MET**.

---

## 2. Item 2: Source layers

- **Requirement:** Pinned facsimile, reviewed diplomatic ledger, German edition, English edition, gloss units, many-to-many alignment, all sharing one SHA-256.
- **Check performed:** `find public -maxdepth 2 -type d`; `find content -maxdepth 2 -type d`; `find content -iname "*special-relativity*" -o -iname "*ap-17-891*"`.
- **Finding:** No `public/papers/` directory exists at all (confirmed absent for every paper, not only this one). `public/edition/` exists but is git-ignored (`.gitignore` line 85) and holds content-addressed compiled build output, not a pinned facsimile. `content/papers/` contains only `brownian-motion.json`; no `content/papers/special-relativity.json` exists. No source-block, translation, or gloss content exists anywhere under `content/` for this paper.
- **Proof class:** `static`.
- **Outcome:** **NOT MET / ABSENT**.

---

## 3. Item 3: Readings and equations

- **Requirement:** R0–R3 for every paragraph/heading/footnote/closing block from six named readings beads; full `Equation` records from two named beads; SR-01–SR-13 caption readings.
- **Check performed:** `br show` (status only) on `am-srk-readings-intro-s2-00vk`, `am-srk-readings-s3-odqp`, `am-srk-readings-s4-s5-njsh`, `am-sre-readings-s6-c5i4`, `am-sre-readings-s7-s8-lpje`, `am-sre-readings-s9-s10-3myq`, `am-srk-equations-30cq`, `am-sre-equations-2g3h`.
- **Finding:** All eight beads are **open**. No `content/arguments/special-relativity/` or `content/equations/special-relativity/` directory exists (confirmed by the same tree walk as Item 2 — `content/arguments/` and `content/equations/` each contain only a `brownian-motion/` subdirectory).
- **Proof class:** `static`.
- **Outcome:** **NOT MET / ABSENT**.

---

## 4. Item 4: Results and misconceptions

- **Requirement:** Fourteen result cards (`am-sr-results-cards-k9ck`); an eight-entry misconception ledger (`am-sr-misconceptions-cyci`).
- **Check performed:** `br show` (status only) on both beads; content directory search (none found).
- **Finding:** Both beads **open**, zero comments. No result-card or misconception content exists anywhere under `content/` for this paper.
- **Proof class:** `static`.
- **Outcome:** **NOT MET / ABSENT**.

---

## 5. Item 5: Instruments SR-01 through SR-13

- **Requirement:** Dispatcher case, instance-scoped owner, tape identity, fixtures, preset scenarios, execution label, `notModeled`, predict mode, show-the-code, action contract, embed route, 320 px/keyboard/reduced-motion, specific mode tests (`sr-04:1904`, `sr-02:apparatus`), the `the-boost-to-0.6c` tape, real-owner parity runs for SR-01/SR-03/SR-08, and a full rendered-embed sweep.
- **Check performed:** `find src/experiments -maxdepth 1 -type d`; repository-wide search for `sr-01`…`sr-13`/`sr01`…`sr13` substrings (excluding `node_modules`, `.git`); `find src/app/lab -maxdepth 1 -type d`; `test -f src/experiments/interactions/parity.suite.ts`; `find artifacts/test-logs -iname "*embed*"`.
- **Finding:**
  - **No `src/experiments/sr01`…`sr13` directory exists.** The full instrument directory list under `src/experiments/` is: `bm01, bm05, bm06, bm07, bm08`, plus shared infrastructure (`commands, digest, identity, permalink, predict, provenance, results, scheduler, states, store, streams, tape, tapes`). No `src/app/lab/sr-*` route exists either (only `bm-01, bm-05, bm-06, bm-07, bm-08`).
  - **One precise, important disambiguation.** A repository-wide search for `sr-02` surfaced four `artifacts/test-logs/scenarios/*/failures/sr-02-emf-first-order-agreement.json` records, tracing to `src/testing/scenario-fixtures/passing/self-test-discrimination-indistinguishable.yaml`. I read that fixture directly: its own `description` field states verbatim *"Self-test of first-order agreement. Not a device measurement,"* and its `owner`/hypothesis owners are `selfTest.magnetFrameEmf` / `selfTest.conductorFrameEmf` — this is a **scenario-registry self-test fixture** (testing the scenario runner's own indeterminate-verdict detection near a tolerance boundary), reusing SR-02's real-world topic (magnet-and-conductor descriptions) as a realistic example id. It is infrastructure self-test content, not an SR-02 instrument, not SR-02 physics, and not evidence toward this item. Recording this precisely so it is never mistaken for SR-02 coverage.
  - `src/experiments/interactions/parity.suite.ts` (the exported family parity suite this item requires SR-01/SR-03/SR-08 to re-run against real owners): **directory does not exist** (`src/experiments/interactions` absent).
  - `artifacts/test-logs/` contains no `embed` file or directory of any kind. No rendered-embed sweep has ever run for any instrument, relativity or otherwise.
  - **Real, adjacent physics-reference-layer progress exists**, worth recording precisely because it is not nothing and not an instrument either: `src/physics/reference/kinematics.ts` and `src/physics/reference/kinematics/{constraints,concordance,types,mode1904}.ts` exist, with a matching test suite under `src/testing/kinematics/` (`kinematics.factors.test.ts`, `kinematics.boosts.test.ts`, `kinematics.composition.test.ts`, `kinematics.velocity.test.ts`, `kinematics.galilean.test.ts`, `kinematics.consequences.test.ts`, `kinematics.constraints.test.ts`, and more — I did not re-run them myself, so their current pass/fail state is **NOT AVAILABLE** from me; I am citing their existence, not their result). A `mode1904.ts` file exists, matching this item's `sr-04:1904` mode language, but there is no SR-04 instrument, dispatcher, or route to mount it — this is reference-layer groundwork, not the instrument the item asks for.
- **Proof class:** `static` (directory and repository-wide search) + `static` citation of specific test file paths (not their results).
- **Outcome:** **NOT MET**. None of SR-01 through SR-13 exist as instruments. The underlying kinematics reference module and its test suite are real and worth the owning beads' attention when SR-04 is eventually built, but they do not satisfy this item.

---

## 6. Item 6: Discovery journey (Journey III)

- **Requirement:** Front door, side doors including the no-algebra first encounter `entrance-special-relativity`, the nagging-fact embed, dated/sourced shelf cards including Bradley 1729, worked forks, live check steps.
- **Check performed:** `find src/app/discover -maxdepth 1 -type d`; `br show` (status only) on `am-srk-first-encounter-471z`, `am-disc-journey-iii-shelf-5z6q`, `am-disc-journey-iii-chain-hpr7`.
- **Finding:** `src/app/discover/` contains only `brownian-motion/`. No `/discover/special-relativity` route exists. All three named beads are **open**, zero comments.
- **Proof class:** `static`.
- **Outcome:** **NOT MET / ABSENT**.

---

## 7. Item 7: Margin

- **Requirement:** Records (a)–(h), reception/confirmation records, each cited by a reading, with primary sources and named human acceptance.
- **Check performed:** `br show am-sr-margin-entries-tn4l` (status only); content directory search (none found in the Item 2/3 tree walks).
- **Finding:** Bead **open**, zero comments. No margin content exists.
- **Proof class:** `static`.
- **Outcome:** **NOT MET / ABSENT**.

---

## 8. Item 8: Tour

- **Requirement:** Fifteen-minute tour exists; a non-physicist reader completed it and stated the claim in one sentence (`am-sr-review-reader-qff7`).
- **Check performed:** `br show am-sr-review-reader-qff7` (status only); `docs/OWNERS.md` role lookup.
- **Finding:** Bead **open**, zero comments. `docs/OWNERS.md` row (quoted verbatim): `| open-r2-readability-special-relativity | | r2-readability-reviewer | special-relativity | open: recruiting | not-applicable | agent:BoldHarbor | 2026-09-16 |`. No tour exists to take.
- **Proof class:** `static`.
- **Outcome:** **NOT PERFORMED**.

---

## 9. Item 9: Gates and editorial acceptance

- **Requirement:** `verify-content`, typecheck, lint, format, build, `ubs --diff`, WASM artifact test, the `special-relativity` scenario runner, and both Playwright suites green at the audited commit; German fidelity, R2 readability, and physics review recorded with reviewer names.
- **Check performed and results, individually:**
  - `bun run typecheck`: **NOT RUN** for this audit. I ran it once for the mass-energy audit two sessions ago against a different commit; re-citing that result here would misattribute a different commit's state to this one, which is exactly the kind of stale-evidence-as-current-evidence this project's provenance rules forbid. Recording as **NOT AVAILABLE FROM ME** for this specific commit, not as a pass or a fail.
  - `scripts/verify-wasm-artifacts.ts`, `scripts/run-scenarios.ts`: existence not re-checked in this pass; not re-citing the mass-energy audit's finding (both absent at that earlier commit) as current, for the same reason above.
  - `bun run build`, `bun run lint`, `bun run format:check`, `ubs --diff`, `am-srk-e2e-4qkd`, `am-sre-e2e-xmj6`: **NOT PERFORMED**, per this wave's standing discipline against individual builds and browser suites.
  - Editorial acceptance: **NOT PERFORMED**. `docs/OWNERS.md` shows, quoted verbatim: `open-german-source-special-relativity | ... | open: recruiting`, `open-physics-math-special-relativity | ... | open: recruiting`, `open-r2-readability-special-relativity | ... | open: recruiting`. No reviewer is named for any of the three required reviews, so the item's specific sub-requirement (naming the single German review record that also covers the gloss, and the physics review record that also covers Journey III's move summary) cannot be met — those records do not exist.
- **Proof class:** `static` (bead/`docs/OWNERS.md` inspection); explicit **NOT AVAILABLE** for every automated gate, stated as such rather than filled in from a different commit's history.
- **Outcome:** **NOT MET**.

---

## Batch G exit evidence

- **All ten sections covered:** No section-coverage manifest exists for this paper (Item 2/3 findings). **NOT MET**.
- **Sign and frame test list** (field transforms, invariants, general force law, Doppler, aberration, light-complex factors, mirror balance/interception, neutral conductor, analytic continuity, both electron conventions): no relativity-specific test files matching these names were found under `src/testing/` in this pass beyond the kinematics suite named in Item 5, which covers kinematics (factors, boosts, composition, velocity, Galilean deviation, constraints, consequences) but not the electrodynamics-side items (fields, waves, force law) this list also requires. **NOT MET**.
- **Depth parity for §§6–10 vs. §§1–5, stated in the physics reviewer's record:** no physics review record exists (Item 9). **NOT MET**.
- **`am-srk-exit-audit-4owh` (Batch E evidence) cited:** bead status checked — **open**, zero comments. Nothing to cite.

---

## Corrections register

Checked individually; several show real, verifiable progress at the quantity-registry and physics-reference layer, reported precisely rather than folded into a single "not met" for the whole section.

- **Harmonized frame-tagged quantity ids, no legacy spelling surviving.** `content/quantities/legacy-spellings.yaml` exists and explicitly rejects bare `lightSpeed`, `chargeDensity`, `propagationAngle`, and `lightComplexEnergy` in favor of frame-tagged ids (`chargeDensityStationary`/`chargeDensityMoving`, `propagationAngleStationary`/`propagationAngleMoving`, `lightComplexEnergyStationary`/`lightComplexEnergyMoving`). I checked `content/quantities/*.yaml` for any surviving bare `- id: lightSpeed`, `- id: chargeDensity`, `- id: propagationAngle`, or `- id: lightComplexEnergy` entry and found **none**. I separately checked the "retired electron-mass ids" the corrections register names (`massCoefficientLongitudinal`, `longitudinalMassSource`, `massCoefficientTransverseComoving`, `transverseMassSource`, `massLossCoefficient`, listed in `legacy-spellings.yaml`) for surviving bare `id:` entries and found **none**; the retained id `electronMass` is a distinct, non-legacy quantity (Section 10's electron mass in the equations of motion) and is not one of the ids this correction names for retirement. **Proof class: `static` (grep over every `content/quantities/*.yaml` file). Outcome: MET, as far as the quantity registry alone is concerned** — I did not check "any relativity manifest, scenario, or tape" beyond the quantity files themselves, because no relativity manifests, scenarios, or tapes exist yet to check (Items 2–5).
- **Missing pre-1905 light-speed constant set (`am-ref-constants-xik`).** `src/physics/reference/constants.ts` implements a named, typed refusal `no-pre-1905-light-speed-set` (`grep` confirmed at lines 453–456 and documented at line 520–521: *"no constant set holding a pre-1905 light speed is registered"*), triggered inside a 1904-mode guard. This is not the constant set itself; it is an honest, explicit refusal in place of a silent gap or a wrong substitution, which is what AGENTS.md's typed-refusal philosophy asks for. **Proof class: `static`. Outcome: the absence is now handled honestly; the constant set itself is still absent.**
- **`am-ref-kinematics-tjq` (Galilean deviation, medium increment, near-light shortfall helpers):** bead **open** with 2 comments recording a BATCH_PENDING claiming `kinematics.ts` and seven named test files landed at commit `3b351e5`. I did not re-run those tests myself in this audit; citing their existence only. **Proof class: `static` (bead comment + file existence). Outcome: reported progress exists; independently unverified by me.**
- **`am-ref-waves-r53`, `am-ref-fields-6l9`** (oblique mirror incidence, SR-10 countermodel, mirror-frame ledger, aberration-fixture label; analytic continuity, plane-wave residuals, general force law, SR-02's `gammaMinusOne`, moving-sphere total charge): both beads **open, zero comments**. **NOT MET.**
- **All other named corrections** (printed $4\pi$ in §9's $\rho$; the §1 concession footnote vs. margin record (g); §3's printed $\varphi$; §10 relations as printed; Bradley's figures on `bradley-1729-aberration`; the `the-boost-to-0.6c` tape owner; SR-04's `sr-04:1904` mode and SR-02's apparatus mode): **NOT MET / ABSENT.** None of the content, margin, or instrument records these corrections attach to exist yet (Items 2–7), so the corrections themselves have nothing to attach to.

---

## Optional studios

- `am-srk-sphere-clock-studio-lpxr`, `am-sre-field-lines-studio-4882`: **open**, zero comments each (`br show`, status only). Neither is built. Recorded per the bead's instruction, without affecting the nine verdicts above.

---

## Notation hazards for whoever authors this paper (recorded now so they are not rediscovered the hard way)

Two collisions are named explicitly in AGENTS.md's "The Notation Concordance" section and apply directly to this paper. Quoted verbatim, not paraphrased, because the exact wording is the safeguard:

1. **β vs. γ.** *"Einstein's $\beta$ is the modern $\gamma$ (paper 3; paper 4 is expected to write the factor out as an explicit radical, which the facsimile must confirm...)"* (AGENTS.md, line 498). Any component, equation record, or reading that renders Einstein's printed $\beta$ in this paper must bind it to the modern Lorentz factor $\gamma$, never to the modern $\beta = v/c$. A silent find-and-replace of the glyph would be exactly the "global find-and-replace is unacceptable" failure AGENTS.md's Notation Concordance section forbids one paragraph earlier.
2. **The §3 auxiliary $x'$ is not the moving-frame coordinate.** *"In paper 3 §3 Einstein also writes $x' = x - vt$ for a Galilean auxiliary coordinate, which is not the moving-frame coordinate; wherever the moving-frame $x'$ also appears, the modern notation form gives the auxiliary a distinct glyph."* (AGENTS.md, line 500). §3 uses $x'$ twice for two different things — the Galilean auxiliary in the transition step, and (elsewhere in the derivation) the genuine moving-frame spatial coordinate. Whoever authors §3's argument records, equation records, and notation-concordance entries must give the auxiliary a distinct symbol in the modern notation form, or a reader following the "toggle to modern notation" feature will silently see the wrong quantity relabeled as the Lorentz-boosted coordinate. I checked `src/physics/reference/kinematics/*.ts` (the one place in the repository that currently does relativity kinematics math) for any symbol resembling this collision; it defines Lorentz-transform helpers generically (boosts, velocity composition) without binding to the paper's printed glyphs at all, so this hazard has not yet been triggered — but it has also not yet been guarded against, because no notation-concordance record for this paper exists (Item 2/3). This is a live hazard for the bead that eventually authors §3, not a currently-observed defect.

---

## Gap Matrix & Owning Beads

| Item | Category | Status | Proof class | Owning open bead(s) |
|---|---|---|---|---|
| 1 | Provenance receipt | NOT MET | static | none visible — unowned gap |
| 2 | Source layers | NOT MET / ABSENT | static | `am-edn-gloss-relativity-na8d`, `am-edn-review-german-relativity-0sr` |
| 3 | Readings & equations | NOT MET / ABSENT | static | `am-srk-readings-intro-s2-00vk`, `am-srk-readings-s3-odqp`, `am-srk-readings-s4-s5-njsh`, `am-sre-readings-s6-c5i4`, `am-sre-readings-s7-s8-lpje`, `am-sre-readings-s9-s10-3myq`, `am-srk-equations-30cq`, `am-sre-equations-2g3h` |
| 4 | Results & misconceptions | NOT MET / ABSENT | static | `am-sr-results-cards-k9ck`, `am-sr-misconceptions-cyci` |
| 5 | Instruments SR-01..13 | NOT MET | static | `am-inst-embed-route-rnyg`, `am-inst-show-the-code-4brv` (+ per-instrument beads not individually enumerated in this bead's dependency list) |
| 6 | Journey III | NOT MET / ABSENT | static | `am-srk-first-encounter-471z`, `am-disc-journey-iii-shelf-5z6q`, `am-disc-journey-iii-chain-hpr7` |
| 7 | Margin | NOT MET / ABSENT | static | `am-sr-margin-entries-tn4l` |
| 8 | Tour | NOT PERFORMED | static | `am-sr-review-reader-qff7` |
| 9 | Gates & acceptance | NOT MET | static | `am-sr-review-physics-omj8`, `am-sr-review-reader-qff7`, `am-edn-review-german-relativity-0sr` |
| Exit | Batch G exit evidence | NOT MET | static | `am-srk-exit-audit-4owh` |
| Corrections: quantity ids | Corrections register | MET (registry-only scope) | static | — |
| Corrections: pre-1905 light speed | Corrections register | Honest refusal in place; set itself absent | static | `am-ref-constants-xik` |
| Corrections: kinematics helpers | Corrections register | Reported landed, unverified by me | static | `am-ref-kinematics-tjq` |
| Corrections: waves/fields | Corrections register | NOT MET | static | `am-ref-waves-r53`, `am-ref-fields-6l9` |
| Corrections: content-attached items | Corrections register | NOT MET / ABSENT | static | (attach to Items 2–7's beads once content exists) |
| Optional studios | — | Both unbuilt | static | `am-srk-sphere-clock-studio-lpxr`, `am-sre-field-lines-studio-4882` |

---

## Conclusion

All nine per-paper items and all pieces of Batch G exit evidence are **NOT MET**. No special-relativity content, facsimile, source layer, reading, equation record, result card, misconception, instrument (SR-01 through SR-13), Journey III route, margin entry, tour, or editorial review exists. This matches the orchestrator's stated expectation.

Two things are worth carrying forward rather than losing in a flat "nothing exists" summary: first, real physics-reference-layer and quantity-registry work for this paper's underlying mathematics already exists and is not nothing (kinematics helpers, the frame-tagged quantity harmonization, the honest pre-1905-light-speed refusal) — it simply has no instrument, content, or reader-facing surface built on top of it yet. Second, the two notation hazards named above (β/γ, and the §3 auxiliary $x'$) are live risks for whoever authors this paper's content, recorded here with their exact AGENTS.md citations so they do not have to be rediscovered.

`am-dod-relativity-105y` should **remain open**. Nothing in this audit closes it or any bead it depends on; only the orchestrator closes beads.
