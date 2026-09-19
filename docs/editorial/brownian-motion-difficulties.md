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
