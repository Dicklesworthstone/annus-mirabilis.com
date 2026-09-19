# Mass-energy: notation verification log

Paper: mass-energy. Bibliographic key: `ap-18-639`. Notation bead: `am-not-entries-mass-energy-wq2`.
Inventory bead: `am-edn-inventory-mass-energy-g2d`. Concordance file: `content/notation/mass-energy.yaml`.

## Method

Direct visual inspection of the pinned facsimile `public/papers/pdfs/ap-18-639.pdf`, SHA-256
`c4770702edca3047c324a92cc0a008e27355c236b3e5e0a87d75eea630ab5f19`, which matches the digest recorded in
`docs/provenance/ap-18-639.md`. The three printed pages 639, 640 and 641 were re-rendered locally at 400 dpi
with `pdftoppm` and read as images. **No OCR was run and no text layer was extracted**, per the standing
prohibition in AGENTS.md. Every reading below is a statement about pixels on a named printed page.

Checked by: pane31 (agent), 2026-09-19. This is an agent reading, not the human German source review;
`reviewState` stays below `reviewed`.

**Why this log exists.** Before this pass, `content/notation/mass-energy.yaml` carried the header claim
"no pinned facsimile scan is currently committed in the repository", and every entry recorded
`checkedAgainst: "Pending facsimile scan (ap-18-639)"` while simultaneously asserting `printed: true`.
That pair is self-contradictory: it asserts a glyph is printed while recording that nothing was checked.
The bead's own warning applies: *do not let three documents that agree with one another (AGENTS.md, the plan,
the inventory) outweigh the facsimile; they share an origin.* Two entries turned out to be exactly that failure.

## 1. Required verification results

The bead requires a recorded result for beta, the explicit root, `l`, `l*`, and the coordinate-system names.

| Item | Result | Evidence |
|---|---|---|
| `beta` (the modern gamma) | **not-found** | Does not occur on p. 639, 640 or 641 in any role. Every Lorentz factor is written as an explicit radical. |
| Explicit radical `1/sqrt(1 - (v/V)^2)` | **matches** | Printed 6 times: p. 639 once (in the `l*` relation); p. 640 four times (twice inside the `H_0` bracket, once in the collapsed `= H_1 + L/sqrt(...)` line, once in the subtraction line); p. 641 once (the `K_0 - K_1` line). |
| `l` (plane-wave energy, stationary system) | **matches** | p. 639, lowercase italic `l`: "bezogen, die Energie `l`". Printed on p. 639 only. |
| `l*` (the same light complex in the moving system) | **matches** | p. 639, `l^* = l (1 - (v/V) cos phi)/sqrt(1 - (v/V)^2)`. Printed on p. 639 only. |
| Coordinate-system names | **differs from the expected `K`/`k`** | The systems are named **by their coordinates** throughout: `(x, y, z)` and `(xi, eta, zeta)`. p. 639 "das Koordinatensystem (x, y, z)" and "Koordinatensystem (xi, eta, zeta)"; p. 640 "im System (x, y, z)" and "System (xi, eta, zeta)"; p. 641 "in bezug auf (xi, eta, zeta)". |

## 2. Expected glyphs that are NOT printed, and therefore get no entry

Rule 4 of the bead: an expected glyph that is not printed is recorded here and gets no concordance entry.

- **`beta`** — not printed. AGENTS.md ("Einstein's $\beta$ is the modern $\gamma$ (paper 3; paper 4 is expected to
  write the factor out as an explicit radical, which the facsimile must confirm)"), the master plan, and the
  original inventory all name a paper-4 `beta`. The facsimile confirms the parenthetical, not the headline:
  there is no `beta` in this paper. No `beta` entry is authored and no printed-collision flag is raised for it
  in this paper. Raised with the user in a bead comment, as the bead requires.
- **`K` as a coordinate-system label** — not printed. `K` occurs in this paper **only** as kinetic energy
  (p. 640 "die kinetische Energie `K` des Koerpers"; p. 641 `K_0`, `K_1`). The stationary system is never called
  `K` here. `K`/`k` as system names belong to paper 3, *Zur Elektrodynamik bewegter Koerper*.
  The entry `me.K.stationarySystem` asserted this meaning with `printed: true` and `facsimilePage: 639`;
  it was removed in this pass, together with the within-paper collision it invented between the system label
  and `K_0`/`K_1`. That collision does not exist: there is only one meaning of `K` in this paper.
- **`k` (lowercase) as a coordinate-system label** — not printed. Lowercase `k` does not occur anywhere on
  pages 639-641 in any role. The entry `me.k.movingSystem` asserted it with `printed: true` and
  `facsimilePage: 639`; it was removed in this pass.
- **`E'`** — not printed. The body energies are `E_0`, `E_1` and the generic `E`; no primed energy appears.
- **`m` and `c^2`** — not printed. `E = mc^2` does not occur in this paper in any form. The mass statement is
  verbal plus `L/V^2` and `L/9.10^20`. The modern `m`-bearing symbols stay in `modernOnlySymbols`, which make
  no claim about the print.

## 3. Printed glyphs confirmed, with the page that establishes each meaning

| Glyph | Meaning as printed | Page | Establishing text |
|---|---|---|---|
| `V` | speed of light in empty space | 639 | "wobei `V` die Lichtgeschwindigkeit bedeutet" |
| `v` | speed of the moving system along the x axis | 639 | "dessen Ursprung sich mit der Geschwindigkeit `v` laengs der x-Achse bewegt" |
| `(x, y, z)` | the stationary coordinate system | 639 | "auf das Koordinatensystem (x, y, z) bezogen" |
| `(xi, eta, zeta)` | the moving coordinate system | 639 | "Koordinatensystem (xi, eta, zeta) ein" |
| `l` | energy of the plane-wave light complex, stationary system | 639 | "die Energie `l`" |
| `l*` | the same light complex measured in the moving system | 639 | the displayed relation |
| `phi` (cited relation) | angle between the wave normal and the x axis | 639 | "bilde den Winkel `phi` mit der x-Achse des Systems" |
| `phi` (emission) | angle of the emitted wave direction with the x axis | 640 | "in einer mit der x-Achse den Winkel `phi` bildenden Richtung" |
| `L` | total energy emitted as radiation | 640, 641 | "Lichtwellen von der Energie `L`/2 ... und gleichzeitig eine gleich grosse Lichtmenge"; p. 641 "die Energie `L` in Form von Strahlung ab" |
| `L/2` | each of the two opposed pulses | 640 | the emission paragraph and the `E_0` equation |
| `E_0`, `E_1` | body energy before / after emission, system (x, y, z) | 640 | "dessen Energie ... `E_0` sei"; "Nennen wir `E_1` bez. `H_1`" |
| `H_0`, `H_1` | the same body's energies in system (xi, eta, zeta) | 640 | "sei die Energie des Koerpers `H_0`" |
| `H`, `E` (generic) | the two energies of one body in the two systems | 640, 641 | "Differenzen von der Form `H - E`"; p. 641 "der Energien `H` und `E`" |
| `K` | kinetic energy of the body with respect to (xi, eta, zeta) | 640 | "von der kinetischen Energie `K` des Koerpers in bezug auf das andere System (System (xi, eta, zeta))" |
| `K_0`, `K_1` | kinetic energy before / after emission | 641 | `H_0 - E_0 = K_0 + C`, `H_1 - E_1 = K_1 + C` |
| `C` | the additive constant | 640, 641 | "nur durch eine additive Konstante `C` unterscheiden kann"; "da `C` sich waehrend der Lichtaussendung nicht aendert" |
| `L/V^2` | the decrease in the body's mass | 641 | "so verkleinert sich seine Masse um `L/V^2`" |
| `9 . 10^20` | the erg-and-gram conversion factor | 641 | "so aendert sich die Masse in demselben Sinne um `L/9.10^20`, wenn die Energie in Erg und die Masse in Grammen gemessen wird" |

## 4. Other printed readings relevant to later layers

- **The low-speed step** is stated as "Unter Vernachlaessigung von Groessen vierter und hoeherer Ordnung"
  (p. 641): fourth and higher order, with **no printed ellipsis**. Confirms the witness against the plan.
- **The printed low-speed result** is arranged as `K_0 - K_1 = (L/V^2)(v^2/2)` (p. 641), that is, `L/V^2`
  as one factor and `v^2/2` as the other. The entry `me.half_L_v2_over_V2.quadraticKineticDifference` records
  the algebraically equal but differently arranged `1/2 (L/V^2) v^2`; the printed arrangement is the one above,
  and the equation record owner (`am-me-equations-0mgx`) should build the tree in the printed order.
- **Internal cross-references** to the relativity paper are printed as "(l. c. Paragraph 8)" on p. 639 and
  "(l. c. Paragraph 10)" on p. 641. Footnote 1 on p. 639 reads "A. Einstein, Ann. d. Phys. 17. p. 891. 1905."
- **The date-line is month precision**: "Bern, September 1905." with no day. The receipt line is
  "(Eingegangen 27. September 1905.)". Any record giving the date-line a day precision is wrong.
- **Article number** 13 is printed before the title on p. 639; it is journal furniture, not a manifest unit.

## 5. Decisions recorded for the concordance

- **`L` renders as `E_{emit}`, not `E`.** The bead asks for `L -> E` and allows a distinct modern glyph if a
  reviewer judges `E` confusing beside the printed `E_0` and `E_1`. It is confusing, and worse, it is not
  injective: the paper also prints a generic `E`, which already renders as `E`. Two entries in scope `me-s0`
  rendering to `E` would be a `modern-glyph-collision`. `E_{emit}` is therefore chosen, and the decision is
  recorded in that entry's `verification.decision`.
- **`K` (generic) binds `kineticEnergy`**, not `kineticEnergyBefore`, per the bead's requirement list.
- **The `K` collision is cross-paper only.** With `me.K.stationarySystem` gone there is no within-paper
  collision for `K` in this paper. The remaining collisions are genuine and cross-paper: the stationary system
  `K` of paper 3 and the force `K` of paper 2.
