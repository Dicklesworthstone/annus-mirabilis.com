# Brownian motion: translation, notation, segmentation, and verification flags

Paper: brownian-motion. Bibliographic key: `ap-17-549`. Inventory bead: `am-edn-inventory-brownian-slg`.

## Provenance and Facsimile Note

The inventory in this bead is conducted directly from authentic high-resolution page scans extracted from the parent volume: `artifacts/page-images/ap-17-549-CORRECTED/parent-173.png` through `parent-184.png` (printed pages 549–560).

> **Receipt page-map refinement deferral (am-cf6m):** Refinement of `docs/provenance/ap-17-549.md` front-matter `pageMap` is deferred to defect bead `am-cf6m` (P0) because `public/papers/pdfs/ap-17-549.pdf` currently contains Leyden jar pages (printed 508–519) instead of Einstein's paper (printed 549–560). Pinned PDF, facsimile source YAML, and receipt digest must not be altered here.

## Translation difficulties

1. **Modality and qualification:** Modality terms that carry Einstein's epistemic care must survive in translation:
   - *müssen* ("ausführen müssen", `s0-p1-s1`)
   - *können* ("nachgewiesen werden können", `s0-p1-s1`)
   - *offenbar* ("Es muß offenbar angenommen werden", `s4-p2-s1`)
   - *mit genügender Annäherung* (`s2-p5-s2`)
   - *unter diesen Annahmen* / *in erster Annäherung*.

2. **Introduction conditional statements:** The four conditional statements of §0 are segmented into separate sentence IDs:
   - `s0-p1-s2`: possibility of identity with so-called Brownian molecular motion (*"Es ist möglich, daß die hier zu behandelnden Bewegungen mit der sogenannten „Brownschen Molekularbewegung“ identisch sind;"*).
   - `s0-p1-s3`: statement of uncertainty regarding available observational literature (*"die mir erreichbaren Angaben über letztere sind jedoch so ungenau, daß ich mir hierüber kein Urteil bilden konnte."*).
   - `s0-p2-s1`: conditional consequence for thermodynamics and atom size (*"Wenn sich die hier zu behandelnde Bewegung samt den für sie zu erwartenden Gesetzmäßigkeiten wirklich beobachten läßt, so ist die klassische Thermodynamik schon für mikroskopisch unterscheidbare Räume nicht mehr als genau gültig anzusehen und es ist dann eine exakte Bestimmung der wahren Atomgröße möglich."*).
   - `s0-p2-s2`: consequence if prediction fails (*"Erwiese sich umgekehrt die Voraussage dieser Bewegung als unzutreffend, so wäre damit ein schwerwiegendes Argument gegen die molekularkinetische Auffassung der Wärme gegeben."*).

3. **Period terminology:**
   - *molekularkinetische Theorie der Wärme*: `masthead-title`, `s0-p1-s1`
   - *Brownsche Molekularbewegung*: `s0-p1-s2`
   - *osmotischer Druck*: `s1`, `s1-p1-s2`
   - *semipermeabele Wand*: `s1-p1-s2`, `s1-p2-s1`
   - *ungeordnete Bewegung*: `s1-p3-s3`, `s4`, `s4-p1-s1`
   - *mittlere Verschiebung*: `s4-p12-s1`, `s5`, `s5-p2-s3`

## Notation difficulties

1. **Dangerous collisions:**
   - $k \to \eta$: viscosity of liquid, not Boltzmann's constant. First printed in §3: `s3-p6-s1` (p. 555); in §5: `s5-p1-s1` (p. 559); numerical value `s5-p2-s1` ($k = 1{,}35 \cdot 10^{-2}$).
   - $P \to a$: particle radius, not pressure. First printed in §3: `s3-p6-s1` (p. 555); in §5: `s5-p1-s1` (p. 559).
   - $\nu \to n$: number density, not frequency. First printed in §1: `s1-p3-s4` (p. 550), display `eq-s1-d2` (p. 551).
   - $N$: Avogadro's number ($6 \cdot 10^{23}$). First printed in §1: `s1-p3-s4` (display `eq-s1-d2`, p. 551); numerical value `s5-p2-s1` (p. 559).
   - $R$: molar gas constant. First printed in §1: `s1-p1-s2` (display `eq-s1-d1`, p. 550). Symbolic only; no numerical value is printed in paper 2.
   - $\varphi(\Delta)$: displacement transition probability kernel. First printed in §4: `s4-p4-s3` (p. 556, display `eq-s4-d1`).
   - $\tau$: observation time interval. First printed in §4: `s4-p3-s1` (p. 556).
   - $K$: force acting on particle. First printed in §3: `s3-p1-s2` (p. 554).
   - $D$: diffusion coefficient. First printed in §3: `s3-p6-s1` (p. 555); in §4: `eq-s4-d9` (p. 558); in §5: `s5-p1-s1` (p. 559).
   - $p$: osmotic pressure. First printed in §1: `s1-p1-s2` (display `eq-s1-d1`, p. 550).
   - $\lambda_x$: mean displacement along the $X$-axis ($\sqrt{\overline{x^2}}$). First printed in §4: `s4-p11-s3` (p. 559, display `eq-s4-d12`).

2. **Historical symbols of §§1–3:**
   - $V^*$ (partial volume): `s1-p1-s1`
   - $z$ (gram-molecules of solute): `s1-p1-s1`
   - $n$ (total particle count, distinct from $\nu$): `s1-p3-s4`
   - $p_1 \dots p_l$ (state variables): `s2-p1-s1`
   - $\varphi_\nu$ (rates of state variables): `s2-p1-s1`
   - $2\varkappa$ and $\lg$ (entropy expression): `s2-p1-s1`
   - $2\varkappa N = R$ (relation between $\varkappa$ and $R$): `s2-p1-s4`
   - $B$ (configuration integral) and $J$ (volume-independent factor): `s2-p1-s5`, `s2-p4-s3`
   - $\overline{E}$ and $E$ (mean energy and energy function): `s2-p1-s2`
   - $\delta F, \delta E, \delta S$ (virtual variations): `s3-p2-s2`
   - $\mu$ (mass of single particle): `s3-p7-s1`
   - $l$ (column length): `s3-p3-s1`

3. **Within-paper collisions:**
   - $\varphi_\nu$ (§2 rate of state variable) vs $\varphi(\Delta)$ (§4 transition kernel).
   - Printed $\mu$ (§3 mass of particle) vs modern mobility $\mu$.
   - $\lg$ (printed natural logarithm) vs modern ISO $\lg$ ($\log_{10}$).

4. **Printed unit words:**
   - *Mikron*: `s5-p2-s2` (display `eq-s5-d4`), `s5-p2-s3` (p. 559). Never printed with the Greek letter $\mu$.
   - *Sekunde*: `s5-p2-s1` (p. 559).
   - *Min.*: `s5-p2-s3` (p. 559).
   - *cm*: `s5-p2-s2` (p. 559).
   - *mm*: `s5-p2-s1` (p. 559).
   - *17° C.*: `s5-p2-s1` (p. 559).

## Segmentation decisions

1. **Sentence boundaries:**
   - `s0-p1`: Semicolon after *"identisch sind;"* splits into `s0-p1-s2` and `s0-p1-s3` to preserve the four conditional statements as separate sentence units.
   - Displays inside paragraphs: all recorded with `containedIn: <paragraphId>`.
   - Continuous sentences through displays: `s4-p4-s3` continues through three unnumbered displays (`eq-s4-d1`, `eq-s4-d2`, `eq-s4-d3`).
2. **Multi-line displays:** `eq-s4-d7` (two lines of integral expansion on p. 557) is counted as one display unit.
3. **Spanning paragraphs:**
   - `s1-p1` (pp. 549–550)
   - `s1-p3` (pp. 550–551)
   - `s2-p4` (pp. 552–553)
   - `s3-p5` (pp. 554–555)
   - `s3-p8` (pp. 555–556)
   - `s4-p8` (pp. 557–558)
   - `s4-p11` (pp. 558–559)
4. **Placement of closing hope:** Printed as the final paragraph of §5 on p. 560, id `s5-p4`.

## Verification flags

Each flag ends with a watch-list result (`pending`, `matches`, `differs`, or `not-found`) and, where applicable, the first-use unit id:

- `flag:s5-printed-numbers` matches `s5-p2-s1`
- `flag:s5-printed-units` matches `s5-p2-s2` Mikron
- `flag:r-not-printed` matches `s5-p1-s1`
- `flag:intro-uncertainty` matches `s0-p1-s3`
- `flag:velocity-warning` not-found
- `flag:s4-tau-coarse-graining` matches `s4-p3-s1`
- `flag:dates` matches `closing-dateline` `closing-received`

---

## Independent second read against the corrected renders (am-edn-inventory-brownian-slg, pane30, 2026-09-19)

Every statement below was read directly from `artifacts/page-images/ap-17-549-CORRECTED/parent-173.png`
through `parent-184.png`. The defective pin was not touched; `am-cf6m` keeps that repair.

These are second-read findings, not contract flags. They use the `check:` prefix deliberately so
they are not parsed by `parseDifficultyFlags`: `DIFFICULTY_FLAG_KEYS` in
`src/content/editions/brownianInventory.ts` defines the seven `flag:` keys this bead owes, and
`brownian.manifest.test.ts` asserts that count exactly. Extending that list is a gate change and
belongs in its own commit, not inside inventory work. Promote any of these to a `flag:` key by
adding it to `DIFFICULTY_FLAG_KEYS` and raising the expected count in the same change.


### Confirmed correct

- `check:masthead` matches `masthead-title` `masthead-author` — parent-173 prints article `5.` and
  "Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in ruhenden
  Flüssigkeiten suspendierten Teilchen; von A. Einstein."
- `check:display-counts-per-page` matches — the per-page display-equation counts are correct on all
  twelve pages (549:0, 550:1, 551:4, 552:2, 553:7, 554:5, 555:6, 556:3, 557:5, 558:4, 559:5, 560:1).
- `check:footnote-list` matches `s2-fn1` `s2-fn2` `s3-fn1` — exactly three footnotes, on printed 551,
  553 and 555. `s2-fn1`'s mark sits on the §2 heading itself, which the manifest records correctly
  as `containedIn: s2`.
- `check:bibliographic-references` matches `s2-fn1-r1` `s2-fn1-r2` `s2-fn2-r1` `s3-fn1-r1` — the
  printed citation strings match the manifest byte for byte, including "Ann. d. Phys. 9. p. 417.
  1902", "11. p. 170. 1903" and "G. Kirchhoff, Vorlesungen über Mechanik, 26. Vorlesung § 4".
- `check:repeated-printed-label` matches `eq-s3-1` `eq-s4-1` — the label `(1)` is printed twice, in §3
  (p. 554) and again in §4 (p. 558), and both correctly take section-qualified ids.
- `check:s5-printed-numbers` matches `s5-p2` — p. 559 prints $N = 6\cdot10^{23}$, water at 17° C,
  $k = 1{,}35\cdot10^{-2}$, particle diameter $0{,}001$ mm, and $\lambda_x = 8\cdot10^{-5}$ cm
  $= 0{,}8$ Mikron; the next line prints "ca. 6 Mikron" for one minute.
- `check:s5-printed-units` matches `s5-p2` — *Mikron* and *Sek.* appear as printed.
- `check:notation-collisions` matches `s3-p6` — p. 555 prints "Kugelradius $P$" and
  "Reibungskoeffizienten $k$" in one sentence, confirming both dangerous collisions ($k$ is
  viscosity, not Boltzmann's constant; $P$ is radius, not pressure). $D$ and $\mu$ (particle mass)
  are printed in `s3-p7`; $\nu$ as number density in `s1-p3` ("$n/V^* = \nu$"); $\varphi(\Delta)$ in
  `s4-p4`; $\tau$ as an observation interval in `s4-p3`; $K$ as a force in `s3-p1`.
- `check:s2-printed-symbols` matches `s2-p1` — $p_1 \ldots p_l$ with rates $\varphi_\nu$, the entropy
  written with $2\varkappa$ and "lg", the relation $2\varkappa N = R$, both $\bar{E}$ and $E$, the
  configuration integral $B$ and its volume-independent factor $J$, and the virtual variation
  $\delta$ are all printed as the bead expected. $V^*$ and $z$ are printed in `s1-p1` (p. 549).
- `check:closing-hope` matches `s5-p4` — p. 560 prints "Möge es bald einem Forscher gelingen, die
  hier aufgeworfene, für die Theorie der Wärme wichtige Frage zu entscheiden!" as the final
  paragraph of §5, before the date-line.
- `check:dates` matches `closing-dateline` `closing-received` — "Bern, Mai 1905." and
  "(Eingegangen 11. Mai 1905.)".
- `check:no-acknowledgment` not-found — confirmed on p. 560: the paper carries no acknowledgment, as
  the bead expected. This is a deliberate negative result, not an unchecked box.

### `check:paragraph-over-split` differs — five spurious paragraph units — **REPAIRED 2026-09-19**

**This is a defect in the inventory, not in the facsimile.** On three pages the manifest records a
paragraph unit where the printing has no paragraph break. The 1905 setting indents the first line of
every new paragraph by about 55 px at this render scale and sets a line that merely resumes after a
display flush to the left margin. Measured left-edge offsets against the page's own body margin
confirm it; the indented starts on p. 554 measure +55, +53 and +58 px, while "Es werde angenommen",
"Die gesuchte Gleichgewichtsbedingung" and "Die letzte Gleichung sagt aus" all measure +1 to +5 px.

| Spurious unit | Page | Printed text it wrongly splits off | Belongs to |
|---|---|---|---|
| `s2-p6` | 553 | "Aus dieser und aus der zuletzt gefundenen Gleichung folgt aber" | `s2-p5` |
| `s3-p3` | 554 | "Es werde angenommen, daß die Flüssigkeit senkrecht zur X-Achse…" | `s3-p2` |
| `s3-p4` | 554 | "Die gesuchte Gleichgewichtsbedingung ist also:" | `s3-p2` |
| `s4-p7` | 557 | "Diese Entwicklung können wir unter dem Integral vornehmen…" | `s4-p6` |
| `s4-p8` | 557 | "Auf der rechten Seite verschwindet wegen $\varphi(x) = \varphi(-x)$…" | `s4-p6` |

The true paragraph-start counts per page are 549:3, 550:2, 551:1, 552:3, **553:3**, **554:3**,
555:3, 556:4, **557:2**, 558:3, 559:3, 560:2. The manifest and its test assert 4, 5 and 4 on the
three bold pages. True paragraph total is **32**, not 37.

The error is not a convention applied consistently: `s4-p6` correctly absorbs two flush resumptions
("Nun können wir aber…", "Ferner entwickeln wir…") and then `s4-p7`/`s4-p8` split at the next two,
and p. 551, p. 555, p. 556 and p. 558 fold their flush resumptions correctly. Displays, footnotes and
reference occurrences are unaffected and remain correct.

**Repaired on 2026-09-19**, after the p. 557 case was re-confirmed at 280% magnification. Nothing was
deleted and nothing was renumbered: the five ids are retired as `merged` in
`content/aliases/brownian-motion.yaml`, survivors keep their numbers, and the sequence deliberately
jumps `s2-p5` → `s2-p7`, `s3-p2` → `s3-p5` and `s4-p6` → `s4-p9`. `s4-p6` took over the 557–558 span
that had been recorded on `s4-p8`. The displays that hung off retired units were re-pointed:
`eq-s2-d9` → `s2-p5`; `eq-s3-d2`, `eq-s3-d3`, `eq-s3-1`, `eq-s3-d4` → `s3-p2`; `eq-s4-d7`,
`eq-s4-d8`, and also `eq-s4-d9` and `eq-s4-1` on p. 558 → `s4-p6`. Totals moved from 92 units and 37
paragraphs to **87 units and 32 paragraphs**, and the per-page start counts for 553, 554 and 557 are
now 3, 3 and 2.

### Indent versus flush: how a paragraph break is identified in this printing

**Apply this before adding or splitting any paragraph unit in this paper.** It is recorded because
five units were created against it, and because the error is invisible to any check that only counts
units: the per-page totals stayed self-consistent while the boundaries were wrong.

- A **new paragraph** begins with an indented first line, about **55 px at the 200 dpi render**
  (`artifacts/page-images/ap-17-549-CORRECTED/parent-173.png` … `parent-184.png`), and the indent is
  present even when the paragraph starts at the top of a page.
- A line that **resumes after a displayed equation** is set **flush to the left margin**, however
  much prose follows it and however many further displays it introduces. Measured on p. 554: the
  real starts sit at +55, +53 and +58 px while the flush resumptions sit at +1 to +5 px.
- A line that **continues across a page break** is likewise flush.
- Printed **numbered or lettered list items** (`1.`, `2.`, `a)`, `b)`) are indented but are *not*
  separate paragraphs: they fold into the sentence that introduces them. See
  `flag:segmentation:numbered-list-items-folded` above, and the sibling rule recorded for
  light-quanta.

Worked contrast on p. 554, which is where two of the five errors were made: "In einer Flüssigkeit
seien suspendierte Teilchen" and "Es sei ν die Anzahl der suspendierten Teilchen" are indented and
are genuine starts; "Es werde angenommen, daß die Flüssigkeit senkrecht zur X-Achse", "Die gesuchte
Gleichgewichtsbedingung ist also:" and "Die letzte Gleichung sagt aus" sit flush and are not. On
p. 557 the same contrast holds between the indented "Wir untersuchen nun" and "Es sei ν = f(x,t)" and
the flush "Diese Entwicklung können wir unter dem Integral vornehmen" and "Auf der rechten Seite
verschwindet".

Read the left margin at 300% or more before deciding. At full-page scale the two cases are easy to
confuse: during the audit two calls made from full-page reads were wrong and the magnified check
reversed them.

### `check:test-claims-unperformed-scan-check` differs

`src/content/editions/brownian.manifest.test.ts` introduces `expectedParagraphStartsPerPage` with the
comment "Verified paragraph start counts per page from scans". Those numbers equal what the manifest
already contains, so the assertion cannot fail for the defect above, and three of its twelve values
(553, 554, 557) are contradicted by the corrected renders. The comment claims a proof class the test
does not have. The neighbouring display and footnote tables were checked against the renders and are
correct. The golden must not be edited on its own: it is only wrong because the data is wrong, and
regenerating it to match would hide the defect rather than fix it.

### `check:reference-id-grammar-inconsistent-across-papers` differs

This paper's reference occurrence ids are sentence-scoped (`s3-p5-s1-r1`, `s3-p8-s1-r1`,
`s4-p10-s5-r1`, `s5-p1-s1-r1`, `s5-p1-s2-r1`) while the relativity manifest uses paragraph-scoped
ids (`s6-p2-r1`). Both are in tree. The sentence segments named here (`-s1-`, `-s5-`) do not exist as
units in any manifest, because the canonical format has no `sentence` kind, so these ids reference a
unit class that cannot be addressed. The same gap is recorded for the relativity paper as
`check:blocking:sentence-units-unrepresentable`; it is one decision for `am-cm-source-manifest-6qa`
across all four papers, and it should also settle which grammar reference occurrence ids use.

### `check:receipt-page-map-never-refined` — **REPAIRED 2026-09-19**

The acceptance line "counts reconcile with the receipt's page map and `SourceAsset.pageMapping`, and
both are refined" was unmet, and no gate said so. All twelve front-matter `pageMap` entries in
`docs/provenance/ap-17-549.md` still carried the pre-refinement stub: no `refinedBy`,
`displayEquations: {numbered: [], unnumbered: 0}` on every page against the manifest's 43 displays,
`footnoteMarks: []` on the three pages that carry a mark, and `sectionIds` omitting `s0` on 549,
`s2` on 551, `s3` on 556 and `s4` on 559. The `## Page map` body was one sentence where the
relativity receipt has 31 per-page entries. Reconciled field by field, the committed receipt
disagreed with the manifest in 33 places.

The consumer this starved is `resolveEquationPage` in `src/content/provenance/receiptSchema.ts`,
which answers which facsimile page a display sits on by reading `displayEquations.numbered` and
`displayEquations.unnumberedIds`. With the stub in place it returned `null` for all 43 Brownian
displays, and nothing noticed, because nothing asked.

**Repair.** The front matter and the body were rewritten in the relativity format from the manifest,
and all twelve pages were then re-read on the corrected renders at 155 to 260 percent
(`artifacts/page-images/ap-17-549-CORRECTED/parent-173` to `parent-184`) to confirm the manifest
itself before it was copied into evidence: section spread, paragraph starts, display count and
printed label, footnote marks. Two readings are worth recording. The stub claimed the printed `(1)`
was on p. 551; it is on p. 554, and p. 551 prints no numbered equation at all. Page 557's
`f + ∂f/∂t · τ = …` runs over two lines and is one display, not two, matching the stacked-display
rule recorded above; p. 554's `oder` and p. 555's `oder` are flush connectives between displays, not
paragraph starts.

**Why page 549 is not stamped.** `receipt-pagemap-refined-no-unnumbered-ids` in
`src/content/provenance/checkReceipt.ts` rejects a `refinedBy` stamp on an entry whose
`unnumberedIds` is empty, so a page that prints no display equation cannot be marked refined however
carefully it was read. Page 549 prints none, so it keeps the unstamped form and eleven of twelve
entries carry the stamp. The same rule explains the three unstamped entries in the relativity
receipt (891, 892, 893) and the three in the light-quanta receipt (132, 133, 145): all six are
zero-display pages, not pages nobody checked. This is a real limitation of the receipt format and it
belongs to the checker's owner, not to an inventory bead; nothing here edits that rule.

**Gate.** `reconcilePageMapAgainstManifest` in `src/content/editions/brownianInventory.ts` compares
every entry against the manifest across sections, numbered labels, unnumbered display ids, footnote
marks and the stamp, and `brownian.manifest.test.ts` asserts it returns nothing. Run against the
committed stub it returns 33 mismatches, so the assertion has a falsifying case. Five planted
negatives cover the classes separately, including the mirror case of stamping the zero-display page,
which the checker would reject.

**Related, not repaired here.** Check 4 of `src/content/editions/editionContract.ts` reports
"Manifest per-page counts and receipt pageMap match" from `options.perPageCountsMatch !== false`.
No production caller ever computes that option; only `editionContract.test.ts` passes `false`. The
check therefore reports a match for every edition without comparing anything, and it is the check
that would have caught this defect. It belongs to `am-edn-alignment-tooling-do1`.
