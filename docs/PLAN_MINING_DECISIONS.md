# Plan mining decisions

A record of the decisions taken while converting
[`COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md`](../COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_MERGED.md)
into the task graph in `.beads/`, and while mining the superseded
[`COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_ASTRA_V2.md`](../COMPREHENSIVE_PLAN_FOR_ANNUS_MIRABILIS_SITE_ASTRA_V2.md)
draft for material the master plan did not carry.

The beads are the executable work queue and each one stands on its own. This file
exists for the decisions that leave no trace in them. An accepted proposal becomes
bead text and needs no separate record; a declined proposal becomes nothing, so
without this file a later reader of the drafts re-opens a settled question and the
same argument is had twice.

Do not reverse an entry here without new evidence. Where an entry names a bead, that
bead's own text is authoritative and this file is the reasoning behind it.

## Plan corrections

Always spell these out in bead text, never as "plan correction N".

- **Coal card:** about 0.27–0.39 μg lost per kilogram burned.
- **Light-complex adversarial fixture:** uses longitudinal rays and a ray transverse in the moving frame.
- **WASM exports:**
  - `brownian_frames` kernels have documented per-step variance (kernel 2 versus 3 is resolved in the capability audit).
  - Refusals come in a typed envelope.
  - `philox_normals` takes explicit stream arguments.
- **Historical attributions:**
  - The "not a mean velocity" warning is attributed to Einstein 1906 unless the 1905 facsimile shows it.
  - The dissertation's 2.1×10²³ and 6.6×10²³ come from different data sets, because N ∝ √k.
- **Notation and physics:**
  - §3's printed auxiliary x′ = x − vt gets a distinct modern glyph.
  - About 10¹⁹ to 10²⁰ molecular kicks per second.
  - The magnet-and-conductor EMF agrees only to first order in v/c. In the magnet's rest frame the coil's charges feel q v×B; in the coil's rest frame that effect is the electric field E′ = γ v×B.
- **Paper 1 printed values:**
  - The 4.3 V fixture follows the printed representation: the gram-equivalent charge E = 9.6·10³ in electromagnetic CGS, with Π·10⁻⁸ in volts (4.34 V); the esu route is a documented modern restatement.
  - α = 6.10×10⁻⁵⁷ reproduces the printed N; if the print shows 10⁻⁵⁶, record a suspected misprint.
- **Displacement fixture:** 0.795 μm at 1 s and 6.16 μm at 60 s with Einstein's printed constants (6.15 μm with modern k_B), printed "about 0.8" and "about 6"; never a bare "6.1 μm".

## Contracts

- Logging:
  - `logRunId` names one execution of a test suite; `runId` is the experiment realization.
  - One tolerance module, `src/units/tolerance.ts`, owned by `am-ver-tolerance-module-ho90`.
- Readings ownership: equations beads own displayed-equation R0–R3; instrument beads own caption R0–R3; readings beads own paragraph, heading, footnote, and closing readings and depend on the equations beads.
- Runtime:
  - Harness DOM contract: `data-reader-root`, `data-ready`, `data-view`, `data-instance-id`, `data-run-id`, `data-snapshot-version`, `data-input-revision`, `data-accepted-input-revision`, `data-pending`, `data-execution-label`, `data-refusal-code`.
  - Refusal code for the FTCS diffusion-number limit: `ftcs-unstable`. Execution outcome name: `budget-exhausted`.
  - The five named teaching tapes are authored by BM-01, BM-07, SR-03, ME-01, and LQ-05.
- Content ids and sources:
  - Inline math ids are `s<n>-p<m>-s<k>-m<i>`.
  - Receipts go through `am-src-receipt-format-npo5`.
  - Publication decisions: publish, pin-local-only, reference-only.
- Editorial workflow:
  - Glosses are per paper.
  - German reviews use `am-edn-review-packet-ee9t` and review records.
  - Comprehension rounds are per paper, consolidated by `am-edit-comprehension-rounds-tcgi`.
  - Interaction families beyond the interval family are built after the slice freeze in `am-inst-interaction-families-m2ps`.

## Rulings made while polishing the beads

- **Gas constant and N.** The quantity registry (`am-not-quantity-registry-2f7`) decides these ids. The gas constant is `molarGasConstant`; `gasConstant` is a rejected spelling. A printed constant symbol binds the constant quantity, so Einstein's N binds `avogadroConstant`, and the constant set supplies its value (the printed 6×10²³ under `einstein-1905-brownian-printed`). Only inference outputs, which carry an uncertainty, bind `avogadroNumberEstimate`. This supersedes earlier routed items that said `gasConstant` or "`avogadroNumberEstimate` for the 1905 N". Exactness lives in the constant-set entry, never in the quantity. A mixed scenario names the modern entry it uses (as `diffusion-einstein-1905-modern-kb` does), and the epistemic check rejects only a historical molecular-count inference that resolves N or k_B from `modern-si-2019`.
- **Readings ownership files.** Equations beads own displayed-equation and derivation-step readings, instrument beads own caption readings, and readings beads own paragraph, heading, footnote, and closing readings. Each owning bead declares its targets in its own file, `content/editorial/readings-owners/<ownerBeadId>.yaml`, never in a shared file, and adds it in the same change as its first reading texts. The readings audit reports `owner-unassigned` and `owner-conflict`.
- **First-encounter ids and anchors.** Each paper's first-encounter record has the id `entrance-<paper slug>` and renders on `/papers/<paper slug>` at `#entry-<paper slug>`: `#entry-light-quanta`, `#entry-brownian-motion`, `#entry-special-relativity`, `#entry-mass-energy`. The short `#entry-brownian` and the bare `#entrance` are retired.
- **The viscosity coefficient in the dissertation.** Einstein prints k for the viscosity itself, both in the dissertation (k* = k(1 + φ)) and in the Brownian paper (k = 1.35·10⁻² for water). Visitor text never calls the coefficient of φ "k". Say "the coefficient of φ" and give its values: 1 in the 1906 printing, 5/2 after the 1911 correction. The modern symbol [η] appears only in modern-notation layers, marked as modern. Code keeps the parameter name `factor`. N scales as the square root of the coefficient. Since 4.15 × √2.5 ≈ 6.56, the 1911 value appears to reuse the 1906 supplement's inputs (verify on ap-34-591).
- **Log path placeholder.** Log files are `artifacts/test-logs/<suite>/<log-run-id>.jsonl`; a path never contains `<logRunId>`.
- **Fifteen-minute tours.**
  - Tours use no symbols in text, captions, or table headers.
  - They mount instruments with the dispatcher's `tour` presentation and cite prompts, presets, and tapes by id.
  - A journey's move is rendered from that journey chain's reviewed `move.r0Summary`, never from tour-authored text.

- **Photographs and likeness (owner decision, 2026-09-14).** Commit 678cc68 from the user's other session records that Einstein name and likeness restrictions do not apply to this free, open-source site, and that public-domain photographs of Einstein are welcome anywhere with a source credit (archive, photographer, date). Lucien Chavan's portrait of about 1905 (ETH-Bibliothek Zürich, Bildarchiv, Portr_05937) is the placeholder. The decision is recorded in `am-gov-decision-license-rights-tps` and `am-src-rights-policy-1dp`; never bring back the older no-photograph or year-only-branding text. Letters are still paraphrased, and scan and translation rights are unchanged.

## Rulings made in the later polishing passes

- **R in the printed-historical sets.** $R = 8.31\times10^{7}$ erg mol⁻¹ K⁻¹ is an editorial input in both printed-historical sets. Paper 2 does not print $R$, and paper 1 §2 appears not to print it either. No bead calls it "printed in the light-quanta paper" unless the light-quanta facsimile shows a printed $R$.
- **Instrument-scoped ids.**
  - Mode addresses use a colon, `<instrumentId>:<mode>`, only for modes a manifest declares: `lq-02:1904`, `sr-04:1904`, `sr-02:apparatus`, `bm-04:kicks-off`, `bm-07:kitchen`, `me-03:box-1906`, and the later `bm-01:underdamped`. `lq-08:count-model` is not a declared mode, so examples use declared ones. The list is not closed: any mode an instrument's manifest declares may keep its colon, including one a later bead adds (`sr-03:optical-appearance`), provided it is declared before use. Negative examples are expected and correct in the schemas and audits, where an undeclared colon id or a preset written in mode form is shown as the failure the check reports.
  - Preset ids use a hyphen, `<instrumentId>-<slug>` (`sr-03-boost-0.6c`, `lq-08-intensity-probe`, `me-03-sealed-lamp-and-mirror`). A preset is registered in its instrument's manifest and may be backed by a scenario record with the same id. The earlier colon forms (`lq-08:intensity-probe`, `me-03:card-coal`) were renamed across the graph; backlog lines written earlier may still show them.
  - Predict-prompt ids use `<instrumentId>-predict-<slug>` (`sr-09-predict-approaching`).
  - Tape ids equal their file names under `content/experiments/tapes/`: lowercase words and digits joined by hyphens. The five named teaching tapes are `einstein-0-8-micron`, `perrins-count`, `the-boost-to-0.6c`, `the-two-pulses`, and `the-locked-positions`.
  - In every id segment a dot is allowed only between two digits. The id scheme bead records all four grammars in `docs/CONTENT_IDS.md`.
- **Tool runs in logs.** Pipeline and tool artifact directories use `<tool-run-id>`. A record or log event that points at such a run carries it in the validated field `toolRunId`.
- **Fixture instruments.** The e2e harness owns the single fixture bundler and server (`scripts/e2e/fixtures/fixtureApps.ts`). A bead that needs an interactive fixture instrument registers a fixture application there. Nothing adds a fixture build, flag, route, or conditional import to the application.
- **Local storage.** `am-plat-local-storage-km8f` owns the namespace registry, one owner per namespace. Settings are single strings under `am:settings:v1:<key>` (for example `am:settings:v1:readingOnly`). A feature that saves documents registers its own namespace (`am:tours:v1`, `am:predictions:v1`, `am:notebook:v1`, `am:clarity:v1`) with its size limit and export and clear flags.
- **One fixture, one scenario id.** Paper 4's printed-factor fixture is `mass-energy-printed-factor`, owned by `am-ref-mass-energy-ht0`.
- **Capstone routes** are the top-level family `/capstones/<paper slug>`, beside `/tours`, `/connections`, and `/timeline`: `/capstones/light-quanta`, `/capstones/brownian-motion`, `/capstones/special-relativity`, and `/capstones/mass-energy`. The master plan's route table gives capstones no location, and `am-disc-capstones-infra-3352` owns the decision: it specifies `src/app/capstones/[paper]/page.tsx`, static params for the four slugs, one canonical URL per capstone, and a test that `/discover/<paper slug>/capstone` returns not-found. There is no nested alias. Consumers follow the owner, so the search index, the journey framework, and the design epic cite the top-level route. A coordinator ruling briefly said the opposite; it was withdrawn after reading the owner's specification.
- **Dependency text.** A Dependencies section never marks an existing edge as proposed. The stale "proposed" markers on existing edges were removed; fix any that remain.
- **Brownian gloss review.** The Brownian gloss units get their own human-gated German source review, `am-edn-review-german-gloss-brownian-1s9x`, because the Brownian German source review closes in Batch C, before the Batch D gloss exists.
- **Priorities raised.** `am-gov-owners-and-reviewers-hte` and `am-edit-review-records-hofz` are P0, because P0 slice gates need named owners and record-backed review states.
- **iPhone app beads.** The `am-app-*` beads belong to the iPhone app plan from the user's other session. They are out of scope for this polishing round: never revise them or propose edits to them.

- **No tenth light-quanta instrument.** ASTRA_V2 §7.9 proposes promoting paper 1 §2 to a core instrument "LQ-10: molecular number from radiation". Declined: AGENTS.md fixes the catalogue at 33 core rows, `am-lq-02-mode-allocation-vy60` already owns the Avogadro readout with its printed-value policy, the exponent discrepancy is already a tested fixture in three beads, and `am-disc-avogadro-lab-pfi7` is the cross-paper comparison laboratory. The incremental substance, the exact logarithmic sensitivities, the refusal to combine the two spectral constants without a declared covariance, and the disjoint classical and Wien limits, was folded into `am-lq-02-mode-allocation-vy60` instead.

## Rulings from the ASTRA_V2 mining

- **Five new beads were created**, each filling a gap nothing owned: `am-dataset-independence-registry-3dfb` (declared shared inputs and independence claims, motivated by the editorial gas constant appearing in two printed sets), `am-linked-experiment-groups-5t5s` (cross-instrument parameter identity, the consumer AGENTS.md's donor table assigns to the extracted aliasing module), `am-route-canonical-registry-57b6` (one registry and audit for canonical, indexing and sitemap facts that ten owners state in prose), `am-scholarly-metadata-mjrx` (bibliographic metadata with a validator that can never attribute the site's translation to Einstein), and the standard instrument card.
- **Declined as a new bead: the caveat-depth audit.** Its substance is adopted: a typed `scopeCritical` flag belongs in `am-cm-schemas-argument-llm`, and the audit that fails when a scope-changing qualification lives only at R3 belongs in `am-cm-audit-scripts-d34`, with the mass-energy additive constant, the Wien-regime restriction and the section 10 force convention as its first cases. One deliverable, one owner.
- **Conflicts declined:** a 34-row instrument catalogue or an LQ-10 row (three miners proposed it independently; the catalogue is a closed union of 33 ids with an exhaustiveness test); bibliographic-key route aliases (AGENTS.md fixes two identifier systems and keys never appear in URLs); renaming the Detail labels; removing the misconception and definition-length floors; zero-based scan page indices; a ReviewState without `machine-draft`; ASTRA's argument against rendering all four readings into static HTML; branching tours (`Tour.stops[].nextStopIds`, which would give every path its own time bound and its own test); tagging each reading with the learning goals it serves (the five accomplishments overlap and are not a ladder of worth); four hero signatures on the home page (the owner asked to keep the deployed placeholder design); remapping the batch letters (the graph's bead labels already use D = mass-energy, E = relativity kinematics, F = light quanta); a second Batch A editorial pilot on the short paper (one pilot carries the runtime contracts, and a source-only pilot cannot); and a free-text comment in the clarity signal's default record (free-text answers are never sent anywhere).

## Proposals rejected on purpose

Each of these was proposed in review and turned down:

- making review records wait for named reviewers;
- making every instrument depend on the `/lab` route;
- lowering the priority of critical-path root beads;
- making the embed route wait for the license decision (building proceeds; publication waits);
- creating the withdrawn `disc-ppe-framework` bead.

