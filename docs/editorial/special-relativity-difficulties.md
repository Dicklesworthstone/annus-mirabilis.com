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
- $\beta \to \gamma$: The printed factor $\beta = 1/\sqrt{1 - (v/V)^2}$ (first introduced in `s3-p18` and display `eq-s3-d19`) represents the modern relativistic Lorentz factor $\gamma$. In 1905, $\beta$ denotes this dilation factor. The modern ratio $v/c$ (often denoted $\beta$ in modern textbooks) is printed as $v/V$ in this paper. This collision must be prominently highlighted on first use.
- $(\xi, \eta, \zeta, \tau) \to (x', y', z', t')$: Moving coordinate system coordinates are $\xi, \eta, \zeta$ and moving time is $\tau$ (first used in `s3-p1`). In modern relativity $\tau$ almost universally denotes invariant proper time; here, $\tau$ is simply the coordinate time of the moving frame $k$.
- Galilean auxiliary coordinate $x' = x - vt$: In §3 (`s3-p4`), Einstein introduces $x' = x - vt$ as an auxiliary coordinate measured from the origin of $k$ to simplify differentiation. This $x'$ is NOT the relativistic spatial coordinate of $k$ (which is $\xi = \beta x'$). Every occurrence of this auxiliary $x'$ must be distinguished from the moving coordinate.
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
   - Moving rod chase times (`eq-s2-d2`): $t_B - t_A = \frac{r_{AB}}{V - v}$, $t'_A - t_B = \frac{r_{AB}}{V + v}$.
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
- `flag:watch-rod-chase-times` matches Section 2 moving rod transit times $r_{AB} / (V - v)$ and $r_{AB} / (V + v)$ on p. 896 (`eq-s2-d2`).
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
