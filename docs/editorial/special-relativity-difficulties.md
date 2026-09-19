# Special Relativity Paper Editorial Difficulties: Translation, Notation, Segmentation, and Verification Flags

Paper: `special-relativity`. Bibliographic key: `ap-17-891`. Journal citation: *Annalen der Physik* (4) 17, 891–921 (1905).  
Inventory bead: `am-edn-inventory-relativity-0u9`.

Every unit id, printed text passage, and equation recorded below has been observed directly from rendered 200-DPI page images of the pinned facsimile (`public/papers/pdfs/ap-17-891.pdf`, SHA-256 `60d21d560f6a3c87e581ac25016306d9bcb748e530fa2751652b84986da5296c`), specifically `artifacts/page-images/ap-17-891/page-01.png` (p. 891) through `page-31.png` (p. 921).

---

## 1. Translation difficulties

### Modality and qualification that must survive
Einstein phrases the foundation, physical arguments, stipulations, and approximations with exact nuances of modality and qualification that must never be flattened, modernized, or turned into dogmatic assertions:
- `s0-p2`: Raising of a conjecture (*Vermutung*) to a presupposition (*Voraussetzung*): "...zu der Vermutung führen... Diese Vermutung... zu einer Voraussetzung erheben...".
- `s0-p2`: The second presupposition introduced as "only apparently incompatible" (*nur scheinbar unverträgliche*): "...die mit ihr nur scheinbar unverträgliche Voraussetzung einzuführen, daß sich das Licht im leeren Raume stets mit einer bestimmten, vom Bewegungszustande des emittierenden Körpers unabhängigen Geschwindigkeit $V$ fortpflanze."
- `s0-p2`: The ether declared superfluous "insofar as" (*insofern als*) no absolutely stationary space is needed: "Die Einführung eines „Lichtäthers“ wird sich insofern als überflüssig erweisen, als weder ein mit besonderen Eigenschaften ausgestatteter „absolut ruhender Raum“ eingeführt...".
- `s0-p3`: The explicit statement that the entire theory rests on kinematics of the rigid body is part of the body text (not a footnote): "Die zu entwickelnde Theorie stützt sich — wie jede andere Elektrodynamik — auf die Kinematik des starren Körpers...".
- `s1-p7`: The definition of simultaneity established by stipulation / convention (*durch Festsetzung* / *wir setzen fest*): "Wir haben bisher für den Punkt $A$ eine „A-Zeit“, für den Punkt $B$ eine „B-Zeit“ definiert, aber keine für $A$ und $B$ gemeinsame „Zeit“... Wir setzen also fest, daß die Zeit, welche das Licht braucht, um von $A$ nach $B$ zu gelangen, gleich ist der Zeit, welche es braucht, um von $B$ nach $A$ zu gelangen...".
- `s1-p10`: Constancy of the round-trip light speed stipulated "in accordance with experience" (*in Übereinstimmung mit der Erfahrung*): "Wir setzen der Erfahrung gemäß außerdem voraus, daß die Größe $\frac{2AB}{t'_A - t_A} = V$ eine universelle Konstante... sei."
- `s3-p1`: Linearity of transformation equations justified by the homogeneity attributed to space and time: "Zunächst ist klar, daß die Gleichungen linear sein müssen wegen der Homogeneitätseigenschaften, welche wir Raum und Zeit beilegen."
- `s4-p6`: Dilation approximation qualified strictly to fourth and higher orders: "Unter Vernachlässigung von Größen vierter und höherer Ordnung..." (never "to first order" or "to second order").
- `s4-p7`: Polygonal path generalization assumed for continuously curved paths: "Gilt das für einen polygonalen Linienzug bewiesene Resultat auch für eine kontinuierlich gekrümmte Linie, so erhält man den Satz:...".
- `s4-p8`: Equator clock remark qualified by "under otherwise identical conditions" (*unter sonst gleichen Bedingungen*): "...so läuft dieselbe nach dem eben gefundenen Resultat langsamer als eine an einem der Erdpole befindliche, unter sonst gleichen Bedingungen befindliche Uhr...".

### Long sentences and ambiguous references
- `s0-p1`: The opening sentence ("Daß die Elektrodynamik Maxwells... zu Asymmetrien führt, welche den Phänomenen nicht anzuhaften scheinen...") is a complex German hypotactic construction balancing the moving magnet with electric field against the moving conductor with electromotive force. In translation, the balance between *elektrisches Feld* and *elektromotorische Kraft* must remain strictly delineated.
- `s3-p3`: Long deduction establishing the differential equation for $\tau$ contains multiple clauses with conditional coordinates and light signal timings.
- `s6-p2`: Spans the page break 907/908 across the printed system of equations, maintaining antecedent references for the field vectors.

### Period vocabulary and first-use unit IDs
- *ruhendes System* (stationary system): first used in `s1-p1`.
- *Prinzip der Relativität* (principle of relativity): first used in `s0-p2`.
- *Lichtäther* (luminiferous ether): first used in `s0-p2`.
- *starrer Körper* (rigid body): first used in `s0-p3`.
- *elektromotorische Kraft* (electromotive force): first used in `s0-p1`.
- *Beobachter* (observer): first used in `s1-p10`.
- *Lichtkomplex* (finite plane light-wave packet): first used in `s8-p1`.
- *vollkommener Spiegel* (perfect mirror): first used in `s8-p6`.
- *Konvektionsstrom* (convection current): first used in `s9-p1`.
- *longitudinale Masse* (longitudinal mass): first used in `s10-p8`.
- *transversale Masse* (transverse mass): first used in `s10-p8`.
- *Kathodenstrahlen*: **NOT printed anywhere in this paper**. Einstein consistently refers to *Ionen*, *Elektronen*, or *elektrisch geladene Massenpunkte*, but the word *Kathodenstrahl* or *Kathodenstrahlen* does not appear. It must not be added from memory.

---

## 2. Notation difficulties

### Scoped glyphs and dangerous collisions
- $V \to c$: The speed of light in empty space is printed as uppercase letter $V$ throughout the entire paper (first used in `s1-p10` and display `eq-s1-d2`). It is never printed as modern $c$.
- $\beta \to \gamma$: The printed factor $\beta = 1/\sqrt{1 - (v/V)^2}$ (first printed on p. 900: already used in the display group `eq-s3-d15` and defined in `eq-s3-d16`; verified on `artifacts/page-images/ap-17-891/page-10.png`) represents the modern relativistic Lorentz factor $\gamma$. In 1905, $\beta$ denotes this dilation factor. The modern ratio $v/c$ (often denoted $\beta$ in modern textbooks) is printed as $v/V$ in this paper. This collision must be prominently highlighted on first use.
- $(\xi, \eta, \zeta, \tau) \to (x', y', z', t')$: Moving coordinate system coordinates are $\xi, \eta, \zeta$ and moving time is $\tau$ (first used in `s3-p1`). In modern relativity $\tau$ almost universally denotes invariant proper time; here, $\tau$ is simply the coordinate time of the moving frame $k$.
- Galilean auxiliary coordinate $x' = x - vt$: In §3 (`s3-p6`, p. 898, the paragraph beginning "Setzen wir $x' = x - vt$"; verified on `artifacts/page-images/ap-17-891/page-08.png`), Einstein introduces $x' = x - vt$ as an auxiliary coordinate measured from the origin of $k$ to simplify differentiation. This $x'$ is NOT the relativistic spatial coordinate of $k$ (which is $\xi = \beta x'$). Every occurrence of this auxiliary $x'$ must be distinguished from the moving coordinate.
- Field vectors: Electric field components are $(X, Y, Z)$ and magnetic field components are $(L, M, N)$ in Gaussian CGS units (first used in `s6-p1` and display `eq-s6-d1`). $N$ is the z-component of magnetic force, not Avogadro's number. $L$ is the x-component of magnetic force in §6, distinct from radiation energy $L$ in paper 4.
- $\varphi$: Angle between the wave normal of a light ray and the motion axis of the coordinate system (first used in `s7-p3` and display `eq-s7-d7`).
- $K$ and $k$: Coordinate systems: uppercase $K$ denotes the stationary system $(x, y, z, t)$, while lowercase $k$ denotes the moving system $(\xi, \eta, \zeta, \tau)$ (first used in `s1-p1` and `s3-p1`).
- §10 electron dynamic quantities:
  - Electron mass is printed as $\mu$ (first used in `s10-p1` and display `eq-s10-d1`), NOT $m$.
  - Electron charge is printed as $\varepsilon$ (first used in `s10-p1`), NOT $e$.
  - Deflectability relations: **printed.** The paper does name single-letter symbols for the deflectabilities. Verified on `artifacts/page-images/ap-17-891/page-30.png` (p. 920), relation 1 of the three "dem Experimente zugänglichen" properties prints: "...die Ermittelung der Geschwindigkeit des Elektrons aus dem Verhältnis der magnetischen Ablenkbarkeit $A_m$ und der elektrischen Ablenkbarkeit $A_e$ nach unserer Theorie für beliebige Geschwindigkeiten möglich ist durch Anwendung des Gesetzes:", followed by the display $\frac{A_m}{A_e} = \frac{v}{V}$ (`eq-s10-d9`, contained in `s10-p13`).
    - Printed definitions: $A_m$ is the *magnetische Ablenkbarkeit* and $A_e$ the *elektrische Ablenkbarkeit*; they are introduced in running text rather than by a display definition, and the only display in which they appear is `eq-s10-d9`.
    - Consequence: this is a **positive** result for the check owned by this bead. The reserved spellings `magneticDeflectability` and `electricDeflectability` in `am-not-quantity-registry-2f7` are printed quantities, so `am-sre-equations-2g3h` is required to add records for them.

### Printed forms of treatment-map results
1. **Introduction (`s0`)**:
   - The two postulates stated verbatim in `s0-p2`.
2. **§1 Simultaneity (`s1`)**:
   - Synchronism condition (`eq-s1-d1`): $t_B - t_A = t'_A - t_B$.
   - Round-trip speed (`eq-s1-d2`): $\frac{2AB}{t'_A - t_A} = V$.
3. **§2 Lengths and times (`s2`)**:
   - Moving rod chase times, printed as **two separate displays** on facing pages, so two units: `eq-s2-d2` (p. 896) $t_B - t_A = \frac{r_{AB}}{V - v}$, and `eq-s2-d3` (p. 897, introduced by the connecting word "und") $t'_A - t_B = \frac{r_{AB}}{V + v}$.
4. **§3 Coordinate transformation (`s3`)**:
   - Final transformation, one printed display (`eq-s3-d25`, p. 902, contained in `s3-p19`): $\tau = \beta\left(t - \frac{v}{V^2}x\right)$, $\xi = \beta(x - vt)$, $\eta = y$, $\zeta = z$. The four lines are printed as a single stacked display and are therefore one unit, not two.
   - Lorentz factor, a separate printed display after the connecting word "wobei" (`eq-s3-d26`, p. 902): $\beta = \frac{1}{\sqrt{1 - \left(\frac{v}{V}\right)^2}}$.
   - Note: `eq-s3-d19` is **not** the time transformation. Verified on `artifacts/page-images/ap-17-891/page-11.png` (p. 901), `eq-s3-d19` is the double-application/reciprocity display $t' = \varphi(-v)\beta(-v)\left\{\tau + \frac{v}{V^2}\xi\right\} = \varphi(v)\varphi(-v)t$ with its $x'$, $y'$, $z'$ companions. The p. 902 order is `eq-s3-d20` $\varphi(v)\varphi(-v) = 1$; `eq-s3-d21`/`eq-s3-d22` the rod endpoint coordinates; `eq-s3-d23` $\frac{l}{\varphi(v)} = \frac{l}{\varphi(-v)}$; `eq-s3-d24` $\varphi(v) = \varphi(-v)$; then `eq-s3-d25` and `eq-s3-d26`.
5. **§4 Physical meaning (`s4`)**:
   - Contracted ellipsoid (`eq-s4-d1`): $\frac{\xi^2}{1 - v^2/V^2} + \eta^2 + \zeta^2 = R^2$.
   - Dilation approximation (`s4-p6`): $t(1 - \sqrt{1 - (v/V)^2}) = \frac{1}{2} t (v/V)^2$ neglecting magnitudes of fourth and higher order.
6. **§5 Velocity addition (`s5`)**:
   - Parallel addition (`eq-s5-d3`): $U = \frac{v + w}{1 + \frac{vw}{V^2}}$.
   - Direction cosine / angle transformations (`eq-s5-d5`, `eq-s5-d6`, `eq-s5-d7`, `eq-s5-d8`, `eq-s5-d9`).
7. **§6 Maxwell–Hertz transformation (`s6`)**:
   - Field transformations (`eq-s6-d5`, `eq-s6-d8`, `eq-s6-d9`):
     $X' = X$, $Y' = \beta(Y - \frac{v}{V}N)$, $Z' = \beta(Z + \frac{v}{V}M)$,
     $L' = L$, $M' = \beta(M + \frac{v}{V}Z)$, $N' = \beta(N - \frac{v}{V}Y)$.
8. **§7 Doppler and aberration (`s7`)**:
   - Transformed frequency (`eq-s7-d7`): $\nu' = \nu \frac{1 - \cos\varphi \frac{v}{V}}{\sqrt{1 - (v/V)^2}}$.
   - Aberration formula (`eq-s7-d8`): $\cos\varphi' = \frac{\cos\varphi - \frac{v}{V}}{1 - \frac{v}{V}\cos\varphi}$.
9. **§8 Light energy and radiation pressure (`s8`)**:
   - Light complex energy ratio (`eq-s8-d4`, exported result):
     $\frac{E'}{E} = \frac{\frac{A'^2}{8\pi}S'}{\frac{A^2}{8\pi}S} = \frac{1 - \frac{v}{V}\cos\varphi}{\sqrt{1 - (\frac{v}{V})^2}}$.
   - Radiation pressure on moving mirror (`eq-s8-d14`):
     $P = 2 \cdot \frac{A^2}{8\pi} \frac{(\cos\varphi - \frac{v}{V})^2}{1 - (\frac{v}{V})^2}$.
10. **§9 Convection currents (`s9`)**:
    - Transformed Maxwell equations with convection currents (`eq-s9-d1`..`eq-s9-d4`).
11. **§10 Electron dynamics (`s10`)**:
    - Equations of motion (`eq-A`):
      $\frac{d^2 x}{d t^2} = \frac{\varepsilon}{\mu} \frac{1}{\beta^3} X$,
      $\frac{d^2 y}{d t^2} = \frac{\varepsilon}{\mu} \frac{1}{\beta} \{ Y - \frac{v}{V} N \}$,
      $\frac{d^2 z}{d t^2} = \frac{\varepsilon}{\mu} \frac{1}{\beta} \{ Z + \frac{v}{V} M \}$.
    - Longitudinal and transverse masses (`eq-s10-d5`, `eq-s10-d6`):
      $\text{Longitudinale Masse} = \frac{\mu}{\left(\sqrt{1 - (v/V)^2}\right)^3}$,
      $\text{Transversale Masse} = \frac{\mu}{1 - (v/V)^2}$.
    - Kinetic energy (`eq-s10-d8`, exported result):
      $W = \int \varepsilon X dx = \int_0^v \beta^3 v dv = \mu V^2 \left\{ \frac{1}{\sqrt{1 - (\frac{v}{V})^2}} - 1 \right\}$.
12. **Closing (`closing`)**:
    - Acknowledgment to Michele Besso (`closing-ack`).
    - Date-line "Bern, Juni 1905." (`closing-dateline`).
    - Journal receipt date "(Eingegangen 30. Juni 1905.)" (`closing-received`).

---

## 3. Segmentation decisions

### Paragraph and sentence census
The paper contains 101 paragraphs and 98 display equations across 31 printed pages (pp. 891–921):
- **Introduction (`s0`, pp. 891–892)**: 3 paragraphs (`s0-p1`..`s0-p3`), 0 displays, 0 footnotes.
- **Part I: Kinematischer Teil (`part-1`, p. 892)**:
  - **§1 (`s1`, pp. 892–895)**: 11 paragraphs (`s1-p1`..`s1-p11`), 2 displays (`eq-s1-d1`, `eq-s1-d2`), 1 footnote (`s1-fn1` on p. 893).
  - **§2 (`s2`, pp. 895–897)**: 8 paragraphs (`s2-p1`..`s2-p8`), 3 displays (`eq-s2-d1`..`eq-s2-d3`), 1 footnote (`s2-fn1` on p. 896).
  - **§3 (`s3`, pp. 897–902)**: 19 paragraphs (`s3-p1`..`s3-p19`), 26 displays (`eq-s3-d1`..`eq-s3-d26`), 0 footnotes.
  - **§4 (`s4`, pp. 903–905)**: 8 paragraphs (`s4-p1`..`s4-p8`), 6 displays (`eq-s4-d1`..`eq-s4-d6`), 1 footnote (`s4-fn1` on p. 903).
  - **§5 (`s5`, pp. 905–907)**: 8 paragraphs (`s5-p1`..`s5-p8`), 9 displays (`eq-s5-d1`..`eq-s5-d9`), 0 footnotes.
- **Part II: Elektrodynamischer Teil (`part-2`, p. 907)**:
  - **§6 (`s6`, pp. 907–910)**: 8 paragraphs (`s6-p1`..`s6-p8`), 9 displays (`eq-s6-d1`..`eq-s6-d9`), 1 footnote (`s6-fn1` on p. 909).
  - **§7 (`s7`, pp. 910–912)**: 7 paragraphs (`s7-p1`..`s7-p7`), 12 displays (`eq-s7-d1`..`eq-s7-d12`), 0 footnotes.
  - **§8 (`s8`, pp. 913–915)**: 12 paragraphs (`s8-p1`..`s8-p12`), 14 displays (`eq-s8-d1`..`eq-s8-d14`), 0 footnotes.
  - **§9 (`s9`, pp. 916–917)**: 3 paragraphs (`s9-p1`..`s9-p3`), 4 displays (`eq-s9-d1`..`eq-s9-d4`), 0 footnotes.
  - **§10 (`s10`, pp. 917–921)**: 14 paragraphs (`s10-p1`..`s10-p14`), 13 displays (`eq-s10-d1`..`eq-s10-d3`, `eq-A`, `eq-s10-d4`..`eq-s10-d12`), 0 footnotes.
- **Closings (p. 921)**: 3 units (`closing-ack`, `closing-dateline`, `closing-received`).

### Grouping of displayed equations in §6 and §9
In accordance with the specification ("each §6 and §9 printed display is one unit"), groups of Maxwell-Hertz field component equations printed under a single system are treated as one display unit:
- `eq-s6-d1`: System of 6 equations for empty space in stationary frame $K$ (p. 907).
- `eq-s6-d2`: Transformed system of 6 equations spanning across the page break from p. 907 to p. 908.
- `eq-s6-d4`: System of 6 equations in moving frame $k$ (p. 908).
- `eq-s6-d5`: System of 6 field transformation equations with factor $\psi(v)$ (p. 908).
- `eq-s9-d1`: System of 6 Maxwell equations with convection currents in $K$ (p. 916).
- `eq-s9-d3`: Transformed system of 6 Maxwell equations with convection currents in $k$ (p. 916).

### Units spanning page breaks
1. Paragraphs crossing page breaks (24 units):
   - `s0-p2` (pp. 891–892)
   - `s1-p7` (pp. 893–894)
   - `s1-p11` (pp. 894–895)
   - `s2-p2` (pp. 895–896)
   - `s2-p7` (pp. 896–897)
   - `s3-p3` (pp. 897–898)
   - `s3-p13` (pp. 899–900)
   - `s3-p15` (pp. 900–901)
   - `s3-p18` (pp. 901–902)
   - `s4-p5` (pp. 903–904)
   - `s4-p8` (pp. 904–905)
   - `s5-p3` (pp. 905–906)
   - `s5-p7` (pp. 906–907)
   - `s6-p2` (pp. 907–908)
   - `s6-p6` (pp. 909–910)
   - `s7-p2` (pp. 910–911)
   - `s7-p4` (pp. 911–912)
   - `s8-p4` (pp. 913–914)
   - `s8-p9` (pp. 914–915)
   - `s9-p2` (pp. 916–917)
   - `s10-p4` (pp. 917–918)
   - `s10-p7` (pp. 918–919)
   - `s10-p10` (pp. 919–920)
   - `s10-p13` (pp. 920–921)
2. Display equation crossing a page break (1 unit):
   - `eq-s6-d2`: Starts on p. 907 (first 4 lines of transformed equations) and concludes on p. 908 (final 2 lines).

---

## 4. Verification flags

Each flag below corresponds to an audited feature on the facsimile page images, verified against `ap-17-891.md`:

- `flag:watch-speed-of-light-v` matches Printed uppercase letter $V$ denotes the speed of light throughout the paper rather than modern $c$.
- `flag:watch-simultaneity-definition` matches Section 1 clock synchronization definition $t_B - t_A = t'_A - t_B$ on p. 893 (`eq-s1-d1`).
- `flag:watch-rod-chase-times` matches Section 2 moving rod transit times, but they are two printed displays, not one: $r_{AB} / (V - v)$ on p. 896 (`eq-s2-d2`) and $r_{AB} / (V + v)$ on p. 897 (`eq-s2-d3`).
- `flag:watch-coord-transforms` matches Section 3 coordinate transformation system ($\xi, \eta, \zeta, \tau$) with $\beta = 1/\sqrt{1 - v^2/V^2}$ on pp. 897–902 (`eq-s3-d19`, `eq-s3-d20`).
- `flag:watch-velocity-composition` matches Section 5 velocity addition law on pp. 905–907 (`eq-s5-d3`, `eq-s5-d5`).
- `flag:watch-field-transforms` matches Section 6 Maxwell-Hertz field component transformations under boost on pp. 907–910 (`eq-s6-d5`).
- `flag:watch-light-energy` matches Section 8 light complex energy transformation $E'/E$ on p. 913 (`eq-s8-d4`).
- `flag:watch-electron-masses` matches Section 10 longitudinal mass $\mu/(1 - v^2/V^2)^{3/2}$ and transverse mass $\mu/(1 - v^2/V^2)$ on pp. 919–921 (`eq-s10-d5`, `eq-s10-d6`).
- `flag:watch-besso-acknowledgment` matches Closing acknowledgment to Michele Besso and date-line "Bern, Juni 1905." followed by "(Eingegangen 30. Juni 1905.)" on p. 921 (`closing-ack`, `closing-dateline`, `closing-received`).
- `flag:footnotes` matches exactly 4 footnotes: s1-fn1, s2-fn1, s4-fn1, s6-fn1; s0 has no footnotes.
- `flag:watch-fourth-order-statement` matches Exact printed phrasing in `s4-p6` neglecting fourth and higher order magnitudes ("Unter Vernachlässigung von Größen vierter und höherer Ordnung...").
- `flag:watch-equator-clock` matches Equator clock remark qualification under otherwise identical conditions ("unter sonst gleichen Bedingungen") in `s4-p8`.
- `flag:watch-spelling-doppeler`: the misspelling is **in the heading itself**. Verified on `artifacts/page-images/ap-17-891/page-20.png` (p. 910), the section heading prints "§ 7. Theorie des **Doppelerschen** Prinzips und der Aberration." The expected wording *Doppler'schen* is **not** printed, and the printed genitive is *Prinzips*, not *Prinzipes*. The body sentence on p. 911 (`page-21.png`) likewise prints "Dies ist das **Doppelersche** Prinzip für beliebige Geschwindig-". The ledger and the German edition keep both as printed; the receipt's `typographicalErrors` records the heading with layer `source`. Nothing silently corrects it.
- `flag:watch-typos` matches Verified printed typographical errors in the original 1905 journal text:
  1. `s3-p10-s1` (p. 899): Prints "auf die H- und Z-Achse" instead of Y-Achse.
  2. `s3-p19-s1` (p. 902): Prints "Stück der H-Achse" instead of Y-Achse.
  3. `part-2` heading (p. 907): Prints "II. Eektrodynamischer Teil." (missing 'l' in Elektrodynamischer).
  4. `s6-p5` display (p. 909): Notation switches between $\psi(v)$ and $\varphi(v)$ across displays.
  5. `s10-p10` display (p. 920): Middle integral $\int_0^v \beta^3 v dv$ drops mass factor $\mu$ before the equals sign.

---

## 5. Blocking flags

A blocking flag is a required deliverable this bead could not produce because a dependency cannot
express it. It is recorded here exactly as a translation difficulty is recorded, and it is not a
licence to invent a representation.

### `flag:blocking:sentence-units-unrepresentable`

**Owner of the blockage:** `am-cm-source-manifest-6qa` (source manifest format and compiler).
**Raised by:** `am-edn-inventory-relativity-0u9`, 2026-09-19.
**Status:** open. `ap-17-891` is **not** fully inventoried while this is open.

This bead's "Units to inventory" table requires two unit classes that the canonical manifest format
cannot currently express:

| Required unit | Id grammar | State |
|---|---|---|
| Sentences | `s<n>-p<m>-s<k>` | not inventoried, not frozen |
| Substantive inline equations and nontrivial symbol occurrences | `s<n>-p<m>-s<k>-m<i>` | not inventoried, not frozen |

**Why it is blocked, precisely.** `MANIFEST_UNIT_KINDS` in `src/content/manifest/types.ts` lists
`masthead`, `masthead-title`, `masthead-author`, `heading`, `part-heading`, `section-heading`,
`paragraph`, `equation`, `display-equation`, `inline-equation`, `footnote`, `citation`,
`closing-dateline`, `closing-ack`, `closing-received`, `closing`. There is no `sentence` kind.
`ManifestLocator` addresses `{page, column?, line?, region?}`, which locates a unit on a page rather
than a span inside a paragraph, so a sentence-scoped unit has no locator that distinguishes it from
its paragraph. `inline-equation` does exist as a kind, but the id grammar this bead mandates for it
is derived from a sentence id, so it is blocked on the same decision rather than on a separate one.

**What was done instead.** Every unit class the format *can* express was inventoried from the page
images and frozen: masthead title and author, both part headings, all ten section headings, 101
paragraphs, 98 display equations, 4 footnotes, 25 internal reference occurrences across 16 units,
and the three closing units. The manifest header carries a `FREEZE SCOPE` block naming exactly which
kinds are frozen and which are not, so the freeze cannot be misread as a whole-paper freeze.

**What must not happen.** No `sentence` kind may be invented in this paper's manifest, and no
sentence-like id may be smuggled in under `paragraph` or `inline-equation`. The four consumers of
these ids (`am-edn-german-edition-relativity-9p5`, `am-not-entries-relativity-f6e`,
`am-me-equations-0mgx`, `am-edn-german-edition-mass-energy-srv`) must not be told the paper is fully
inventoried until the format owner rules.

**Resolution paths, for the format owner to choose between.** (1) Add a `sentence` kind with a
span-capable locator and allow sentence-derived inline-math ids. (2) Rule that sentences are an
alignment-layer concern owned by `am-edn-alignment-tooling-do1` and `docs/editorial/SEGMENTATION.md`
rather than manifest units, and amend the four inventory beads so their acceptance criteria stop
requiring them. Either way the decision belongs in `docs/PLAN_MINING_DECISIONS.md`, because all four
papers are affected identically: no paper's manifest carries sentence units.

### `flag:segmentation:numbered-list-items-folded`

**Status:** not blocking. Recorded because it is an undocumented rule that governs paragraph ids.

The manifest folds printed, separately indented numbered and lettered list items into the paragraph
that introduces them, rather than giving each its own paragraph id. Verified occurrences:

- §1 p. 894: the items `1.` and `2.` ("Wenn die Uhr in $B$ synchron mit der Uhr in $A$ läuft...")
  belong to `s1-p8`, which introduces them with "daß also allgemein die Beziehungen gelten:".
- §2 p. 895: the two principles `1.` and `2.` belong to `s2-p1`, which introduces them with
  "welche beiden Prinzipien wir folgendermaßen definieren:".
- §2 pp. 895–896: the operations `a)` and `b)` belong to `s2-p2`.
- §10 pp. 920–921: the three relations `1.`, `2.` and `3.` belong to `s10-p13`, which introduces
  them with "Wir wollen nun die aus dem Gleichungssystem (A) resultierenden, dem Experimente
  zugänglichen Eigenschaften der Bewegung des Elektrons aufzählen."

This rule is what makes the per-page paragraph counts reconcile (for example p. 894 has five
paragraph units, not seven). Whoever builds the German edition blocks must apply the same rule or
the paragraph ids will shift. If the rule is ever reversed, it is an alias operation in
`content/aliases/special-relativity.yaml`, never a silent renumbering.

## 6. Corrections to first-use and equation ids in sections 1 and 2 above

These were found by reading the page images against the ids and are corrected in place above; they
are listed together here because `am-not-entries-relativity-f6e` scopes its concordance entries to
first-use ids and would otherwise inherit them.

| Item | Recorded as | Printed reality |
|---|---|---|
| $\beta$ first use | `s3-p18`, `eq-s3-d19` | p. 900: $\beta$ is already used in the display group `eq-s3-d15` and defined in `eq-s3-d16` |
| Galilean auxiliary $x' = x - vt$ first use | `s3-p4` | `s3-p6` (p. 898), the paragraph beginning "Setzen wir $x' = x - vt$" |
| $A_m$, $A_e$ | asserted absent | printed on p. 920, display `eq-s10-d9` |
| §7 heading spelling | `Doppler'schen` | `Doppelerschen` (p. 910) |
| §3 transformation result | `eq-s3-d19` / `eq-s3-d20` | `eq-s3-d25` (group) and `eq-s3-d26` ($\beta$), both p. 902 |
| §2 rod chase times | both under `eq-s2-d2` | two separate printed displays: `eq-s2-d2` (p. 896) and `eq-s2-d3` (p. 897) |

---

## 7. Indent versus flush: how a paragraph break is identified in this printing

**Apply this before adding or splitting any paragraph unit in this paper.** It is recorded because
sixteen units were wrong against it, and because the error is invisible to any check that only
counts: 101 recorded paragraph starts against 93 printed ones, twelve spurious partly cancelling
four missing, with every per-page total internally self-consistent.

- A **new paragraph** begins with an indented first line, about **55 px at the 200 dpi render**
  (`artifacts/page-images/ap-17-891/page-01.png` … `page-31.png`), and the indent is present even
  when the paragraph starts at the very top of a page. p. 892 and p. 936 both begin that way.
- A line that **resumes after a displayed equation** is set **flush to the left margin**, however
  much prose follows it and however many further displays it introduces.
- A line that **continues across a page break** is likewise flush. p. 893, p. 899 and p. 913 each
  open flush and are continuations, which is why three page-spans were missing.
- Printed **numbered or lettered list items** (`1.`, `2.`, `a)`, `b)`) are indented but are *not*
  separate paragraphs: they fold into the sentence that introduces them. This governs §1 p. 894,
  §2 p. 895, §6 p. 909 and §10 p. 920, and the sibling rule is recorded for light-quanta and for
  brownian.
- **Stacked equations that are left-aligned with each other**, with no text between them, are ONE
  display, not several. The pair `∂τ/∂y = 0` and `∂τ/∂z = 0` on p. 899 is the case that matters
  here: it looks like two displays at page scale and is one at 280 percent. The same convention
  makes the mass-energy `H₀−E₀` / `H₁−E₁` pair a single unit.

Worked contrast on p. 901, where three paragraphs were missing: "Zur Zeit t = τ = 0", "Diese
Gleichung transformieren wir", "Die betrachtete Welle ist also", "In den entwickelten
Transformationsgleichungen", "Wir führen zu diesem Zwecke noch" and "Da die Beziehungen zwischen
x'" are each indented and each is a paragraph. On p. 913, by contrast, "Nennt man S das Volumen"
and "Nennt man also E die im ruhenden" sit flush and are not.

**Read the left margin at 300 percent or more before deciding, and do not decide from a full page.**
Two lessons are recorded here at cost. First, in the original audit of this paper the line at the
top of p. 893 was seen to look flush and was then called a start anyway, because treating it as a
start made §1 total eleven paragraphs and agree with a number already written in this file. Fitting
the evidence to the expected total is what produced the defect. Second, a later sweep at 130 percent
produced three false positives — p. 911, p. 918 and p. 920 were each flagged and each turned out
clean at 250 percent. Strip-scale reading is good enough to find candidates and not good enough to
decide them.
