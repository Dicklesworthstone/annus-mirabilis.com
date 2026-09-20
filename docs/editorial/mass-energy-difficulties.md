# Mass–Energy Paper Editorial Difficulties: Translation, Notation, Segmentation, and Verification Flags

Paper: `mass-energy`. Bibliographic key: `ap-18-639`. Journal citation: *Annalen der Physik* (4) 18, 639–641 (1905).  
Inventory bead: `am-edn-inventory-mass-energy-g2d`.

Every unit id and reading recorded below has been observed directly from rendered page images of the pinned facsimile (`public/papers/pdfs/ap-18-639.pdf`, SHA-256 `c4770702edca3047c324a92cc0a008e27355c236b3e5e0a87d75eea630ab5f19`), specifically `artifacts/page-images/ap-18-639/page-1.png` (p. 639), `page-2.png` (p. 640), and `page-3.png` (p. 641).

---

## 1. Translation difficulties

### Modality and qualification
Einstein phrases the derivations, deductions, and prospective applications with exact shades of modality that must not be flattened or modernized into anachronistic dogmatism:
- `s0-p1-s1`: "...führen zu einer sehr interessanten Folgerung, die hier abgeleitet werden soll." (prospective derivation: "lead to a very interesting conclusion, which shall be deduced here").
- `s0-p3-s1`: Quoted principle of relativity using modal "müssen" ("...müssen die Gesetze... dieselben sein...").
- `s0-p5-s2`: "wobei $V$ die Lichtgeschwindigkeit bedeutet."
- `s0-p7` (in the run formerly recorded as `s0-p9-s4`): "Wir können also setzen:" (deductive permission).
- `s0-p11-s1`: "Unter Vernachlässigung von Größen vierter und höherer Ordnung können wir setzen:" (explicit approximation qualification; the display itself omits an ellipsis).
- `s0-p12-s1`: "Aus dieser Gleichung folgt unmittelbar:" (immediate logical consequence).
- `s0-p12-s2`: "Gibt ein Körper die Energie $L$ in Form von Strahlung ab, so verkleinert sich seine Masse um $L/V^2$." (conditional / indicative deduction: "If a body gives off the energy $L$... its mass diminishes by $L/V^2$").
- `s0-p12-s3`: "Hierbei ist es offenbar unwesentlich..." (independence qualification).
- `s0-p13-s1`: "Die Masse eines Körpers ist ein Maß für dessen Energieinhalt..." (generalization; "gemessen wird" establishes the operational connection).
- `s0-p14-s1`: "Es ist nicht ausgeschlossen, daß bei Körpern, deren Energieinhalt in hohem Maße veränderlich ist (z. B. bei den Radiumsalzen), eine Prüfung der Theorie gelingen wird." (cautious empirical prospect: "It is not excluded that with bodies whose energy-content is variable to a high degree (e.g. with the radium salts), a test of the theory will succeed").
- `s0-p15-s1`: "Wenn die Theorie den Tatsachen entspricht, so überträgt die Strahlung Trägheit zwischen den emittierenden und absorbierenden Körpern." (strict conditional closure: "If the theory corresponds to the facts, then radiation transfers inertia between the emitting and absorbing bodies").

### Period vocabulary and first-use unit IDs
- *Trägheit* (inertia): first used in title `masthead-title` ("Ist die Trägheit..."), also in `s0-p15-s1`.
- *Energieinhalt* (energy-content): first used in title `masthead-title`, also in `s0-p13-s1`, `s0-p14-s1`.
- *Ruheenergie* (rest energy): **NEVER printed anywhere in this paper**. Modern treatments that introduce rest energy as an initial postulate distort Einstein's argument, which works entirely with energy balances and offsets ($C$) without defining absolute rest energy.
- *Relativitätsprinzip* (principle of relativity): first used in `s0-p2-s1`, and explicitly printed in parentheses at the end of `s0-p3-s1`.
- *Maxwell-Hertzsche Gleichungen*: first used in `s0-p2-s1`.
- *Lichtgeschwindigkeit* (speed of light): first used in `s0-p5-s2` (denoted by $V$, not $c$).
- *ebene Lichtwellen* (plane light waves): first used in `s0-p5-s1`.
- *Lichtmenge* (quantity of light): first used in `s0-p7-s1` ("...sende eine Lichtmenge $L/2$...").
- *Lichtkomplex*: **does not occur** in this paper; Einstein uses *System von ebenen Lichtwellen* (`s0-p5-s1`) and *Lichtmenge* (`s0-p7-s1`).
- *gleichförmige Paralleltranslation* (uniform parallel translation): first used in `s0-p2-s1`, also `s0-p5-s1`, `s0-p6-s1`.
- *Energieprinzip* (principle of energy / conservation of energy): first used in `s0-p7-s4` ("...welches nach dem Energieprinzip für beide Koordinatensysteme gelten muß...").
- *lebendige Kraft*: historically synonymous with kinetic energy in 19th-century German texts, but **not printed** in this paper; Einstein consistently uses *kinetische Energie* ($K$).
- *kinetische Energie* (kinetic energy): first used in `s0-p7` ("...die kinetische Energie des Körpers...", denoted by $K$; in the run formerly recorded as `s0-p9-s2`).
- *Masse* (mass): first used in `s0-p12-s2` ("...so verkleinert sich seine Masse um $L/V^2$"), and in `s0-p13-s1` ("Die Masse eines Körpers...").
- *Strahlung* (radiation): first used in `s0-p12-s2` ("...in Form von Strahlung..."), and in `s0-p15-s1` ("...so überträgt die Strahlung Trägheit...").
- *Radiumsalze* (radium salts): first used in `s0-p14-s1` ("...z. B. bei den Radiumsalzen...").
- *Erg* and *Grammen*: printed units of energy and mass in `s0-p13-s1`.

---

## 2. Notation difficulties

### Dangerous notation collisions
- $L$ denotes radiation energy emitted by the body (`s0-p7-s1`), NOT angular momentum, NOT Lagrangian, NOT length. (In paper 1 `ap-17-132`, $L$ denoted lightspeed; in paper 3 `ap-17-891`, light energy was $E$ or $l$; in paper 4 `ap-18-639`, emitted radiation energy is $L$).
- $V$ denotes the speed of light throughout (`s0-p5-s2`), NOT volume, NOT potential, NOT voltage.
- $K$ denotes kinetic energy (`s0-p7`, in the run formerly recorded as `s0-p9-s2` and `s0-p9-s4`), NOT force (*Kraft*), NOT Boltzmann's constant.
- $l$ and $l^*$ denote the energy of a plane light wave packet in the rest frame and moving frame, respectively (`s0-p5-s1`, `s0-p5-s2`), imported from paper 3 §8 (where it was $E$ and $E'$).
- $E_0, E_1$ denote the energy of the body in the rest coordinate system $(x, y, z)$ before and after emission (`s0-p6-s1`, `s0-p7-s1`).
- $H_0, H_1$ denote the energy of the body in the moving coordinate system $(\xi, \eta, \zeta)$ before and after emission (`s0-p6-s2`, `s0-p7-s2`).
- $C$ denotes an arbitrary additive constant in the relation between total energy difference $H - E$ and kinetic energy $K$ (`s0-p7`, in the run formerly recorded as `s0-p9-s3` and `s0-p9-s4`). It cancels exactly upon taking differences.

### First-use unit IDs of printed glyphs
- $v$: relative speed of coordinate system $(\xi, \eta, \zeta)$, first used in `s0-p5-s1`.
- $V$: speed of light, first used in `s0-p5-s2` and display `eq-s0-d1`.
- $\varphi$: angle between wave normal and system motion axis, first used in `s0-p5-s1` and display `eq-s0-d1`.
- $l, l^*$: light wave energy before/after coordinate transformation, first used in `s0-p5-s1` and display `eq-s0-d1`.
- $E_0, E_1$: rest-system body energies, first used in `s0-p6-s1` and `s0-p7-s1`.
- $H_0, H_1$: moving-system body energies, first used in `s0-p6-s2` and `s0-p7-s2`.
- $L$: emitted light energy quantity, first used in `s0-p7-s1`.
- $K_0, K_1$: kinetic energies before and after emission, first used in `s0-p7` (formerly recorded as `s0-p9-s4`).
- $C$: arbitrary additive constant, first used in `s0-p7` (formerly recorded as `s0-p9-s3`).

### Explicit statement on $\beta$
**The symbol $\beta$ is NOT printed anywhere in this paper.**  
Neither $\beta$ nor $\gamma$ appears in any form. Einstein writes out the explicit radical throughout:
$$\frac{1}{\sqrt{1 - (v/V)^2}}$$
Any editorial reconstruction or modern transcription that replaces the radical with $\beta$ or $\gamma$ falsifies the historical text.

### Printed forms of treatment-map results
1. `imported-result` (`s0-p4`, `s0-p5`, `eq-s0-d1`):
   $$l^* = l \frac{1 - \frac{v}{V}\cos\varphi}{\sqrt{1 - (v/V)^2}}$$
2. `equal-opposite-emissions` (`s0-p6`, `s0-p7`):
   Emission of two pulses in directions $\varphi$ and $\varphi + 180^\circ$, each having energy $L/2$ in coordinate system $(x, y, z)$.
3. `energy-balances` (`s0-p7`, which absorbed the retired `s0-p8`; `eq-s0-d2`, `eq-s0-d3`):
   $$E_0 = E_1 + \left[ \frac{L}{2} + \frac{L}{2} \right]$$
   $$H_0 = H_1 + \left[ \frac{L}{2} \frac{1 - \frac{v}{V}\cos\varphi}{\sqrt{1 - (v/V)^2}} + \frac{L}{2} \frac{1 + \frac{v}{V}\cos\varphi}{\sqrt{1 - (v/V)^2}} \right] = H_1 + \frac{L}{\sqrt{1 - (v/V)^2}}$$
4. `subtraction-kinetic-energy` (`s0-p7`, which absorbed the retired `s0-p8`, `s0-p9` and `s0-p10`; `eq-s0-d4`, `eq-s0-d5`, `eq-s0-d6`):
   $$(H_0 - E_0) - (H_1 - E_1) = L \left\{ \frac{1}{\sqrt{1 - (v/V)^2}} - 1 \right\}$$
   $$\begin{aligned} H_0 - E_0 &= K_0 + C, \\ H_1 - E_1 &= K_1 + C \end{aligned}$$
   $$K_0 - K_1 = L \left\{ \frac{1}{\sqrt{1 - (v/V)^2}} - 1 \right\}$$
5. `low-speed-expansion` (`s0-p11`, `eq-s0-d7`):
   $$K_0 - K_1 = \frac{L}{V^2} \frac{v^2}{2}$$
   *(Note: Printed exactly as above, with no trailing ellipsis $+ \dots$)*
6. `inertia-change-generalization` (`s0-p12`, `s0-p13`):
   Mass reduction $L/V^2$; numerical equivalence statement $L / (9 \cdot 10^{20})$ when energy is in Erg and mass in Grammen.
7. `empirical-closing-remarks` (`s0-p14`, `s0-p15`):
   Radium salts empirical proposal; radiation transferring inertia between emitter and absorber.
8. `dateline-receipt` (`closing-dateline`, `closing-received`):
   "Bern, September 1905." and "(Eingegangen 27. September 1905.)".

---

## 3. Segmentation decisions

### Paragraph and sentence census
The paper contains **12 paragraphs** and 27 sentences across its 3 printed pages. The count was 15
until the boundary audit of 2026-09-19; see "Indent versus flush" below and
`content/aliases/mass-energy.yaml`.

- **Page 639 (5 paragraphs, 8 sentences)**:
  - `s0-p1`: 1 sentence (`s0-p1-s1`, "Die Resultate einer jüngst in diesen Annalen..."). Contains footnote mark `1)`.
  - `s0-p2`: 1 sentence (`s0-p2-s1`, "Ich legte dort die Maxwell-Hertzschen Gleichungen...").
  - `s0-p3`: 1 sentence (`s0-p3-s1`, "Die Gesetze, nach denen sich die Zustände... (Relativitätsprinzip)."). It states the relativity principle, but it is **not** set as a block quotation: at 300% its first line carries the ordinary paragraph indent and all four of its continuation lines sit flush at the normal left margin, with the normal right margin. An earlier revision of this file called it "an indented block quotation in the original print"; that was wrong, and it is corrected here because a block quotation and an indented paragraph are distinguished by the continuation lines, which is the same discriminator the whole segmentation rests on.
  - `s0-p4`: 1 sentence (`s0-p4-s1`, "Gestützt auf diese Grundlagen²)..."). Contains footnote mark `2)` and reference `s0-p4-r1` to "l. c. § 8".
  - `s0-p5`: 4 sentences / 3 prose sentences around display `eq-s0-d1`:
    - `s0-p5-s1`: "Ein System von ebenen Lichtwellen..." ends at "...des Systems."
    - `s0-p5-s2`: "Bezieht man die Energie..." continues through display `eq-s0-d1` to "...wobei $V$ die Lichtgeschwindigkeit bedeutet."
    - `s0-p5-s3`: "Von diesem Resultat machen wir im folgenden Gebrauch."

- **Page 640 (2 paragraphs starting on page, 8 sentences)**:
  - `s0-p6`: 2 sentences:
    - `s0-p6-s1`: "Es befinde sich nun ein Körper..." ends at "...seine Energie auf das System $(x, y, z)$ bezogen $E_0$ sei."
    - `s0-p6-s2`: "Er bewege sich..." ends at "...dessen Energie auf $(\xi, \eta, \zeta)$ bezogen $H_0$ sei."
  - `s0-p7`: 4 sentences:
    - `s0-p7-s1`: "Dieser Körper sende..." ends at "...nach beiden entgegengesetzten Richtungen."
    - `s0-p7-s2`: "Diese Aussendung geschehe..." ends at "...relativ zum System $(x, y, z)$."
    - `s0-p7-s3`: "Für diesen Vorgang..." ends at "...beide Koordinatensysteme."
    - `s0-p7-s4`: "Wir haben demnach..." continues through displays `eq-s0-d2` and `eq-s0-d3` to end at "...angegebenen Relation:".
  - `s0-p7` continues, flush after `eq-s0-d3` (formerly the separate unit `s0-p8`, retired):
    - `s0-p7-s5`: "Durch Subtraktion erhält man aus diesen Gleichungen:" introducing display `eq-s0-d4`.
  - `s0-p7` continues again, flush after `eq-s0-d4` (formerly `s0-p9`, retired; this is the run that crosses onto p. 641).
    The sentence ids in this block and the next still read `s0-p9-s<k>`, in the retired namespace. They are
    left as printed rather than renumbered into `s0-p7-s<k>`, because renumbering them would invent a
    sentence sequence for the merged paragraph, and because no manifest can hold a sentence unit at all
    until the ruling on `am-xz2d` lands. Read them as locators into `s0-p7`, not as live ids:
    - (p. 640): "Die beiden in diesem Ausdruck auftretenden Differenzen... einfache physikalische Bedeutungen."
    - `s0-p9-s2` (p. 640): "$H$ und $E$ sind Energiewerte... solange er relativ zu $(x, y, z)$ ruht."
    - `s0-p9-s3` (spans p. 640 and p. 641): starts on p. 640 "Folglich muß $H - E$ der kinetischen Energie $K$ des Körpers... welche von der Wahl der willkürlichen addi-", continuing on p. 641 line 1 "tiven Konstanten der Energien $H$ und $E$ abhängt."

- **Page 641 (5 new paragraphs starting on page, 11 sentences)**:
  - `s0-p7` continuing from p. 640 (sentence ids below are in the retired `s0-p9` namespace; see the note under p. 640):
    - `s0-p9-s4`: "Wir können also setzen:" introducing display `eq-s0-d5`, followed by "...da $C$ sich während der Lichtaussendung nicht ändert."
    - `s0-p9-s5`: "Wir erhalten also:" introducing display `eq-s0-d6`.
  - `s0-p7` continues, flush after `eq-s0-d6` (formerly `s0-p10`, retired): 2 sentences:
    - "Die kinetische Energie des Körpers..." ends at "...ihrem Betrag."
    - "Die Differenz $K_0 - K_1$ hängt..." contains reference `s0-p7-r1` (formerly `s0-p10-r1`) to "l. c. § 10".
  - `s0-p11`: 1 sentence:
    - `s0-p11-s1`: "Unter Vernachlässigung von Größen vierter und höherer Ordnung können wir setzen:" introducing display `eq-s0-d7`.
  - `s0-p12`: 3 sentences:
    - `s0-p12-s1`: "Aus dieser Gleichung folgt unmittelbar:"
    - `s0-p12-s2`: "Gibt ein Körper die Energie $L$... so verkleinert sich seine Masse um $L/V^2$."
    - `s0-p12-s3`: "Hierbei ist es offenbar unwesentlich..." ends at "...geführt werden:".
  - `s0-p13`: 1 sentence:
    - `s0-p13-s1`: "Die Masse eines Körpers ist ein Maß für dessen Energieinhalt..."
  - `s0-p14`: 1 sentence:
    - `s0-p14-s1`: "Es ist nicht ausgeschlossen, daß bei Körpern... Prüfung der Theorie gelingen wird."
  - `s0-p15`: 1 sentence:
    - `s0-p15-s1`: "Wenn die Theorie den Tatsachen entspricht, so überträgt die Strahlung Trägheit..."

### Boundary across page breaks
- **Page break 639/640**: Sits cleanly between `s0-p5` (and bottom footnotes `s0-fn1`, `s0-fn2`) and `s0-p6`.
- **Page break 640/641**: Crosses inside paragraph `s0-p7`, splitting a sentence at the hyphenated word "addi-" (end of p. 640, line 31) and "tiven" (start of p. 641, line 1). The paragraph unit `s0-p7` carries two locators: `[{ page: 640 }, { page: 641 }]`. Until 2026-09-19 this span was recorded on `s0-p9`; that unit was a flush resumption of `s0-p7`, so the span belonged to `s0-p7` all along. The hyphenated word is the decisive evidence that the run is one paragraph.

### Indent versus flush: how a paragraph break is identified in this printing

**This is the rule to apply before adding or splitting any paragraph unit in this paper.** It is
recorded because three units were created against it and the error is invisible to any check that
only counts units: the per-page totals stayed self-consistent while the boundaries were wrong.

- A **new paragraph** begins with an indented first line, about **55 px at the 200 dpi render**
  (`artifacts/page-images/ap-18-639/page-*.png`), and the indent is present even when the paragraph
  starts at the very top of a page.
- A line that **resumes after a displayed equation** is set **flush to the left margin**. It is the
  same paragraph, however much prose follows and however many further displays it introduces.
- A line that **continues across a page break** is likewise flush, and is often provable
  independently by a hyphenated word split across the two pages (here "addi-" / "tiven").

Worked contrast on p. 640, which is where the error was made: "Es befinde sich nun im System" and
"Dieser Körper sende in einer" are indented and are genuine starts; "Durch Subtraktion erhält man
aus diesen Gleichungen:" and "Die beiden in diesem Ausdruck auftretenden Differenzen" sit flush at
the margin and are not. On p. 641 the same contrast holds between the flush "Die kinetische Energie
des Körpers" and the indented "Unter Vernachlässigung von Größen vierter und höherer Ordnung".

Read the left margin at 300% or more before deciding. At full-page scale the two cases are easy to
confuse, and the sibling papers record the same trap: light-quanta records its numbered-item folding
rule for the same reason.

**Item folding: no case occurs in this paper.** The sibling rule recorded for light-quanta folds a
numbered or lettered item into the sentence that introduces it, because such items are indented and
would otherwise read as paragraph starts. All three pages of this paper were read at 300% on
2026-09-19 and they print no numbered list, no lettered item, and no display carrying a printed
equation label. The rule is therefore stated as inapplicable rather than left silent: if a later
reading finds an item this census missed, the light-quanta rule governs it, and this line is the
record that nobody had found one.

**Full re-audit at 300%, 2026-09-19 (denominator: 25 of 25 units, 25 matched).** Every line of all
three pages was compared against known-flush and known-indented reference lines *on the same page*,
never against a remembered measurement or a full-page impression. Indent step measured on the page:
p. 639 flush 205 / indent 300, p. 640 flush 462 / indent 560, p. 641 flush 155 / indent 255, in the
coordinates of the 300% crops. Checked: 2 masthead units, 12 paragraphs (5 on 639, 2 on 640, 5 on
641), 2 footnote marks (both on 639), 7 displays, the date-line and the receipt line. **No defects.**

The three retirements of the earlier boundary audit are each confirmed at the flush line where the
spurious unit had been recorded: "Durch Subtraktion erhält man aus diesen Gleichungen:" (p. 640,
formerly `s0-p8`), "Die beiden in diesem Ausdruck auftretenden Differenzen" (p. 640, formerly
`s0-p9`), and "Die kinetische Energie des Körpers in bezug auf" (p. 641, formerly `s0-p10`).

A fourth line of the same shape, **"Aus dieser Gleichung folgt unmittelbar:" on p. 641**, is flush
and is correctly *not* recorded as a unit. It is named here because it is the one remaining place in
this paper where the same mistake could be made: it introduces the paper's two conclusion paragraphs
and reads like an opening.

Two page facts confirmed while reading, recorded so no later layer has to re-derive them: the
stacked pair `H_0 - E_0 = K_0 + C,` / `H_1 - E_1 = K_1 + C,` on p. 641 is **one** left-aligned
display (`eq-s0-d5`), as is the two-line `H_0 = H_1 + [...]` with its right-aligned continuation
`= H_1 + L/sqrt(1-(v/V)^2).` on p. 640 (`eq-s0-d3`). Counting either as two displays would inflate
the display census by two and is the display-side twin of the flush-line error.

---

## 4. Verification flags

Each flag below corresponds to an audited feature on the facsimile page images, verified against `ap-18-639.md`:

- `flag:watch-energy-l-lightspeed-v` matches Symbol $L$ denotes emitted radiation energy (not lightspeed as in paper 1) and $V$ denotes the speed of light throughout.
- `flag:watch-radical-vs-beta` matches Symbol $\beta$ is completely absent; only the explicit radical $1/\sqrt{1-(v/V)^2}$ is printed.
- `flag:watch-imported-light-relation-glyphs` matches Lowercase $l$ and $l^*$ are printed in display `eq-s0-d1`.
- `flag:watch-energy-symbols-and-constant-c` matches Rest energies $E_0, E_1$, moving energies $H_0, H_1$, kinetic energies $K_0, K_1$, and constant $C$ match exact printed forms.
- `flag:watch-fourth-order-statement` matches Exact printed phrasing in `s0-p11-s1` neglecting fourth and higher order quantities.
- `flag:watch-factor-9-10-20` matches Numerical factor statement $L / 9 \cdot 10^{20}$ with explicit units Erg and Grammen on p. 641. Recomputation in CGS: $(3 \times 10^{10}\ \text{cm/s})^2 = 9 \times 10^{20}\ \text{cm}^2/\text{s}^2$, exactly consistent with $V^2$.
- `flag:watch-radium-remark` matches Conditional empirical phrasing in `s0-p14-s1` regarding radium salts.
- `flag:watch-closing-inertia-remark` matches Strict conditional closure in `s0-p15-s1`.
- `flag:watch-footnotes` matches Footnotes 1 and 2 on page 639 verified verbatim against scan.
- `flag:watch-emc2-absence` matches The modern equation $E = mc^2$ does not appear anywhere in this paper.
- `flag:dates` matches Date-line "Bern, September 1905." and receipt date "(Eingegangen 27. September 1905.)" on p. 641.

### The crop-width trap: nominal magnification is not what reaches the eye

**A stored crop is shown at a capped width. Enlarging a full-page crop to 300% produces a file
about 3050 px wide, which is then displayed at 2000 px, so the printed indent step is seen at about
1.96x, not 3x. The resize factor in the command is not evidence about what was actually read.**

Measure it rather than trusting the figure. The body line pitch of these renders is **30 px at 1x**
on all four papers, so the zoom of any crop can be recovered after the fact:

```
file_zoom = (measured line pitch in the crop) / 30
eye_zoom  = file_zoom * min(crop_width, 2000) / crop_width
```

A crop narrower than about 660 px of the original page keeps a 300% enlargement under the cap
(660 x 3 = 1980), so it is read at its stated magnification. The left-margin window used for the
2026-09-19 re-reads is 520 px wide, giving 1560 px and a true 3.0x.

Applying this to the crops retained from the 2026-09-19 audits gives their real eye magnification:

| Crop set | Purpose | File zoom | Width | Eye zoom |
|---|---|---|---|---|
| narrow left-margin windows | the 300% re-reads | 2.97-3.00x | 1560 | **3.0x** |
| full-page 300% bands | the mass-energy audit | 2.95-3.00x | 3054 | **1.96x** |
| full-width page bands at 235-260% | five Brownian pages | 2.35-2.60x | 2402-2657 | **1.96x** |
| narrow strips at 250% | the relativity re-map | 2.43-2.55x | 804 | **2.5x** |
| page overviews | orientation only | 0.63-1.55x | 600-1300 | **under 2x** |

Two consequences worth stating plainly. A page overview is for finding a line, never for judging
its left edge. And a figure like "read at 300%" in an earlier note may describe the command rather
than the reading: where the crop was full width, halve it.
