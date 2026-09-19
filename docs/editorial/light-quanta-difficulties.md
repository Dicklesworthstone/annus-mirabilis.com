# Light quanta: translation, notation, segmentation, and verification flags

Paper: light-quanta. Bibliographic key: `ap-17-132`. Inventory bead: `am-edn-inventory-light-quanta-skp`.

This inventory is compiled from direct visual inspection of 200-DPI page images rendered from the pinned facsimile `public/papers/pdfs/ap-17-132.pdf` (SHA-256 `494f074dcb7e7def98f16c0196cd01f096b63a924704d53d46ef4f718b54f79e`). Every unit id and reading cited below corresponds to verified printed text on pages 132–148 of *Annalen der Physik* (4) 17.

## 1. Translation difficulties

Modality and qualification must survive in translation: the central claim is explicitly designated an "heuristic point of view" (*heuristischer Gesichtspunkt*, `masthead-title`), not a deductive certainty or complete quantum electrodynamics. Conditional and restrictive phrasing ("suggests," "must," "under these assumptions," "to this approximation," "so far as I can see") distinguishes inferences from established law.

Period terms requiring precise lexical annotations on first use:
- *heuristischer Gesichtspunkt* (heuristic point of view): `masthead-title`
- *Undulationstheorie* (wave theory of light): `s0-p1`
- *Energiequanten* (energy quanta): `s0-p3`
- *Kathodenstrahlen* (cathode rays): `s0-p3`
- *schwarze Strahlung* (black-body radiation): `s0-p3`
- *Resonatoren* (resonators): `s1-p1`
- *dynamisches Gleichgewicht* (dynamic equilibrium): `s1-p1`
- *Elementarquanta* (elementary quanta): `s2` (heading)
- *Grenzgesetz* (limiting law): `s4` (heading)
- *Boltzmannsches Prinzip* (Boltzmann's principle): `s4-p5`
- *statistische Wahrscheinlichkeit* (statistical probability): `s1-fn3` and `s5-p1`
- *Stokessche Regel* (Stokes's rule): `s7` (heading)
- *Photolumineszenz* (photoluminescence): `s0-p3` and `s7-p1`
- *Kathodenlumineszenz* (cathode luminescence): `s8-p9`
- *Grammäquivalent* (gram-equivalent): `s1-p3` and `s8-p3`
- *Ionisierungsspannung* (ionization potential): `s9-p3`

## 2. Notation difficulties

Dangerous collisions and period conventions to flag on first use:

- $R$ and $N$: $R$ is the molar gas constant ($8.31\times 10^7\ \text{erg}\cdot\text{mol}^{-1}\cdot\text{K}^{-1}$), first use `s1-p3`; $N$ is Avogadro's number ("Anzahl der wirklichen Moleküle in einem Grammäquivalent"), first use `s1-p3`. No numerical value of $R$ is printed anywhere in the paper, so $R$ is an editorial input. $N$ is likewise never printed as an input, but its computed value $6{,}17\cdot 10^{23}$ is printed as the result of `eq-s2-d6` on p. 137, so $N$ is an output of §2, not a given.
- $\beta$: Wien's second radiation constant ($\beta = h/k_B = 4{,}866\cdot 10^{-11}\ \text{s}\cdot\text{K}$), first use `s2-p2`. Not to be confused with relativistic velocity ratio $\beta = v/c$ in paper 3.
- $L$: Speed of light in vacuum in §§1–2 ($3\times 10^{10}\ \text{cm/s}$), first use `s1-p4` (p. 135) and `s2-p3` (p. 137). In §9 (`s9-p3`, p. 148), $L$ is reused for the absorbed light quantity ("absorbierte Lichtmenge $L$"), a within-paper collision.
- $E$: Radiation energy in §4 (`s4-p3`) and §6 (`s6-p1`); average resonator energy $\bar{E}$ in §1 (`s1-p3`); system energy in §5 footnote 1 (`s5-fn1`); charge of a gram-equivalent of monovalent ions in §8 (`s8-p3`, $E = 9{,}6\cdot 10^3$ electromagnetic CGS / abcoulombs per mol).
- $P$, $P'$, and $p$: $P$ is electron escape work (work function) in §8 (`s8-p2`); $P'$ is the potential of this quantity of negative electricity in §8 (`s8-p3`); $p$ is gas pressure in §5 footnote 1 (`s5-fn1`).
- $\alpha$: Wien's first constant in §2 (`s2-p2`, printed as $6{,}10\cdot 10^{-56}$). In §1 footnote 2 (`s1-fn3`), $\alpha_\nu$ represents Fourier phase angles.
- $\Pi$: Stopping potential magnitude in §8 (`s8-p3`), with $\Pi\varepsilon$ electron work and $\Pi E$ molar work.
- $\varepsilon$: Electron charge ("elektrische Masse des Elektrons") in §8 (`s8-p3`).
- $\varrho$ or $\varrho_\nu$: Radiation energy density per unit frequency interval, first use `s1-p4`.
- $\varphi$: Spectral entropy density function in §§3–4 (`s3-p2`); entropy-probability functional relation in §5 (`s5-p2`).
- $T$: Absolute temperature in §§1–6; in §1 footnote 2 (`s1-fn3`), $T$ denotes an observation time interval for Fourier expansion.
- $\lambda$: Lagrange multiplier in §3 variational optimization (`s3-p3`), not wavelength.
- "lg": Natural logarithm throughout ($\ln$), first use `s4-p2`. Modern ISO standard uses $\lg$ for $\log_{10}$, so this requires clear editorial disambiguation.
- Units: §8 operates in electromagnetic CGS units where $E = 9{,}6\cdot 10^3$ abcoulomb/equiv and $\Pi\cdot 10^{-8}$ converts abvolts to volts.

Treatment-map printed forms:
- §1: $\varrho_\nu = \frac{R}{N}\frac{8\pi\nu^2}{L^3}T$; $\int_0^\infty\varrho_\nu\,d\nu = \infty$ (`eq-s1-d7`, `eq-s1-d8`)
- §2: $N = \frac{\beta}{\alpha}\frac{8\pi R}{L^3} = 6{,}17\cdot 10^{23}$ (`eq-s2-d6`)
- §3: $\frac{\partial\varphi}{\partial\varrho} = \frac{1}{T}$ (`eq-s3-d8`)
- §4: $S - S_0 = \frac{E}{\beta\nu}\lg\left(\frac{v}{v_0}\right)$ (`eq-s4-d5`)
- §5: $S - S_0 = \frac{R}{N}\lg W$; $W = \left(\frac{v}{v_0}\right)^n$ (`eq-s5-d6`, `eq-s5-d7`)
- §6: $W = \left(\frac{v}{v_0}\right)^{\frac{N}{R}\frac{E}{\beta\nu}}$; energy quanta $R\beta\nu/N$; mean energy $3\frac{R}{N}T$ (`eq-s6-d4`, `eq-s6-d5`)
- §7: $\frac{R}{N}\beta\nu_2 \leqq \frac{R}{N}\beta\nu_1$ or $\nu_2 \leqq \nu_1$ (`eq-s7-d1`, `eq-s7-d2`)
- §8: $\Pi\varepsilon = \frac{R}{N}\beta\nu - P$; $\Pi E = R\beta\nu - P'$ (`eq-s8-d2`, `eq-s8-d3`)
- §9: $R\beta\nu \geqq J$; $j = \frac{L}{R\beta\nu}$ (`eq-s9-d1`, `eq-s9-d3`)

## 3. Segmentation decisions

Sentence boundaries and paragraph splits decided under `docs/editorial/SEGMENTATION.md`:
- Displays inside paragraphs do not terminate sentences unless followed by a capitalized initial letter; equations like `eq-s1-d1` and `eq-s4-d5` sit inside running sentences.
- Multi-line displays grouped under one concept are counted as single display units: `eq-s5-d1` (system of two equations for $S_1$ and $S_2$) and `eq-s5-d5` (three logarithmic forms for $\varphi_1, \varphi_2, \varphi$).
- Paragraphs crossing page breaks keep one canonical ID and multiple locators:
  - `s0-p2`: pages 132–133
  - `s1-p1`: pages 133–134
  - `s1-p3`: pages 134–135
  - `s3-p2`: pages 137–138
  - `s3-p4`: pages 138–139
  - `s4-p5`: pages 139–140
  - `s5-p2`: pages 140–141
  - `s5-p4`: pages 141–142
  - `s6-p1`: pages 142–143
  - `s6-p4`: pages 143–144
  - `s8-p2`: pages 145–146
  - `s8-p6`: pages 146–147
  - `s9-p1`: pages 147–148
- **Printed numbered items fold into the paragraph that introduces them.** A run of
  printed enumerated items (`1.`, `2.`, or `a)`, `b)`) is NOT a unit of its own: the
  introducing sentence and the items it governs are one paragraph unit, and the sentence
  ids run on through the items. This decides several counts in this paper and is recorded
  here because `docs/editorial/SEGMENTATION.md` does not state it.

  **The precedent, verified rather than assumed.** Neither SEGMENTATION.md nor the
  brownian or relativity difficulties files state this rule in words, so it was read off
  the relativity manifest against the relativity facsimile. *Zur Elektrodynamik bewegter
  Körper* p. 895 prints, after the §2 heading: an introducing paragraph ending
  "...welche beiden Prinzipien wir folgendermaßen definieren.", then the indented item
  "1. Die Gesetze, nach denen sich die Zustände...", then the indented item
  "2. Jeder Lichtstrahl bewegt sich...", which runs on into the display
  "Geschwindigkeit = Lichtweg / Zeitdauer". `content/source-blocks/special-relativity/manifest.yaml`
  records exactly ONE paragraph unit, `s2-p1`, before `eq-s2-d1`. Two separately numbered
  items therefore cannot each hold a unit there; they are already folded. The same page
  prints the operations `a)` and `b)` under "...ermitteln denken:", and they likewise sit
  inside `s2-p2` rather than taking units.

  The brownian half of the precedent could NOT be checked the same way: the pinned
  `public/papers/pdfs/ap-17-549.pdf` is the wrong page range. Its pdf pages 1-4 render as
  printed 508-511 of L. Hermann's "Kombinationen von Kapazitäten und Selbstinduktionen",
  not Einstein's 549-560, while `docs/provenance/ap-17-549.md` maps pdf 1-12 onto printed
  549-560. That defect is already known and owned by `am-cf6m`, and `am-edn-inventory-brownian-slg`
  works from `artifacts/page-images/ap-17-549-CORRECTED/`; it is named here only to say why
  relativity, not brownian, is cited as the operative precedent.

- **Where the convention bites in this paper: §7's close on p. 145.** Page 145 opens with
  the introducing paragraph "Abweichungen von der Stokesschen Regel sind nach der
  dargelegten Auffassung der Phänomene in folgenden Fällen denkbar:", then the indented
  item "1. wenn die Anzahl der gleichzeitig in Umwandlung begriffenen Energiequanten..."
  ending in a semicolon, then the indented item "2. wenn das erzeugende (oder erzeugte)
  Licht nicht von derjenigen energetischen Beschaffenheit ist..." ending in a full stop,
  then a fresh paragraph "Die letztgenannte Möglichkeit verdient besonderes Interesse."
  Under the convention above, §7 contributes TWO paragraph units on p. 145, not four:
  the introducing paragraph carries both numbered items, and "Die letztgenannte" is the
  second unit. Without the convention the same page reads as four.

- **That boundary is now repaired (2026-09-19).** Page 144 ends a complete paragraph,
  "...unterhalb welcher das Licht unfaehig waere, lichterregend zu wirken.", so nothing runs
  over the break; "Abweichungen..." begins a new, indented paragraph at the head of p. 145.
  Two defects followed from that and both are fixed:
  - `s7-p2` carried locators 144 AND 145 although it is the paragraph that ends on 144. The
    spurious 145 locator is removed, and `s7-p2` is no longer one of the paper's page-crossing
    paragraphs, which fall from 14 to 13.
  - The second indented paragraph on p. 145, "Die letztgenannte Moeglichkeit verdient
    besonderes Interesse.", had NO unit at all. It is now `s7-p4`. Indentation was measured
    the same way pane30 measured the mass-energy boundaries: "Abweichungen", the items "1."
    and "2.", and "Die letztgenannte" all carry the paragraph indent, while §7's earlier
    "Dies ist die bekannte Stokessche Regel." is set flush and is therefore a resumption of
    `s7-p1` after its two displays, not a paragraph of its own.

  Adding `s7-p4` does not break the freeze. No id is retired, renumbered or given a new
  meaning: `s7-p4` was simply unused, and it sits in printed order after `s7-p3`. No alias is
  required, because nothing was retired or split. The unit total moves 128 -> 129 and the
  snapshot is regenerated in the same commit. This is a paragraph-granularity repair and is
  independent of the sentence-unit and inline-math-unit question escalated on the bead.


- Footnotes are block-level units without internal sentence IDs; no footnote spans across a page boundary in this paper.
- Displays printed inside footnotes:
  - In `s1-fn3`: Fourier expansion `eq-s1-d3`, probability differential `eq-s1-d4`, and independence factorization `eq-s1-d5`.
  - In `s5-fn1`: thermodynamic differential relation `eq-s5-d9` and ideal gas law `eq-s5-d10`.

## 4. Verification flags

Each flag begins with `flag:<key>` and a watch-list status (`pending`, `matches`, `differs`, or `not-found`):

- `flag:s2-constants` matches the comparison witness, which also reads the exponent -56. Printed on p. 136: alpha = 6,10 . 10^-56 (`eq-s2-d2`) and beta = 4,866 . 10^-11 (`eq-s2-d3`); printed on p. 137: N = 6,17 . 10^23 (`eq-s2-d6`). The printed alpha does not reproduce the printed N: recomputed N = 6.1705e23 for alpha = 6.10e-57 against N = 6.1705e22 for the printed alpha = 6.10e-56, a factor of ten. The exponent -57 (Planck's 1901 value) is therefore the only one consistent with the printed N, so the printed -56 is a suspected typographical error. This inventory records the printed reading only; the typographical-error decision belongs to the ledger bead `am-src-ledger-light-quanta-sxi` and the receipt's `typographicalErrors`, both out of scope here. First use s2-p2.
- `flag:s2-r-and-l-not-printed` matches neither numeral R nor L is printed in §2 or elsewhere; hydrogen mass printed as 1,62 . 10^-24 g; first use s2-p3
- `flag:s8-printed-check` matches printed charge quantity E = 9,6 . 10^3 emu (gram-equivalent charge); recomputed Pi = 4.3385 V; modern esu check gives 4.3057 V (at 299.792458 V/statvolt) and 4.3087 V (at 300 V/statvolt); first use s8-p3
- `flag:s8-result-line` matches printed Pi . 10^7 = 4,3 Volt with exponent 7; first use s8-p5
- `flag:fn-displays` matches displays inside footnotes: s1-fn3 contains eq-s1-d3, eq-s1-d4, eq-s1-d5; s5-fn1 contains eq-s5-d9, eq-s5-d10; first use s1-fn3
- `flag:s3-variational-displays` matches variational displays with delta and Lagrange multiplier lambda; first use s3-p3
- `flag:s6-mean-energy` matches mean quantum energy display 3(R/N)T; first use s6-p3
- `flag:s8-inequalities` matches partial-transfer inequality eq-s8-d4 and cathode-luminescence inequality eq-s8-d5; first use s8-p8
- `flag:s9-count-relation` matches count relation j = L/(R beta nu) (`eq-s9-d3`, p. 148) and both printed bounds, each with its printed input. Lower bound (`eq-s9-d2`, `s9-p2`): R beta nu = 6,4 . 10^12 Erg >= J, from Lenard's printed largest effective wavelength for air, ca. 1,9 . 10^-5 cm. Upper bound (`s9-p3`): J <= 9,6 . 10^12, from Stark's printed smallest measured ionization potential for air at platinum anodes, ca. 10 Volt. In this section L is the absorbed light quantity ("der absorbierten Lichtmenge L"), not the speed of light of SS 1-2. First use s9-p2.
- `flag:glyph-collisions` matches scoped collisions for L, E, P/P'/p, phi, T, alpha_nu, lambda, lg; first uses s1-p4, s1-p3, s8-p2, s3-p2, s1-p3, s1-fn3, s3-p3, s4-p2
- `flag:s7-thermal-caveat` matches explicit thermal caveat in §7 regarding Wien regime validity at extreme temperatures; first use s7-p2
- `flag:no-ultraviolet-catastrophe` matches phrase ultraviolet catastrophe does not appear in 1905 print; first use s1-p6
- `flag:footnote-citations` matches citations in footnotes to Drude, Planck, Lenard, Stark; first use s1-fn1
- `flag:dates` matches dateline Bern, den 17. März 1905 and receipt note Eingegangen 18. März 1905; first use closing-dateline
