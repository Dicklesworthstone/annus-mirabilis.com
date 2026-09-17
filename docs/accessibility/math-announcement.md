# Mathematics Announcement Patterns and Accessibility Evaluation

- **Specification Bead:** `am-eq-spoken-forms-w4f`
- **Human Gate Dependent:** `am-eq-math-announcement-at-matrix-0al6`
- **Status:** Automated Candidate Patterns Implemented & Tested; Manual AT Verification Pending Human Gate.

---

## 1. Executive Summary and Principles

Per `AGENTS.md`: *"Each equation's accessible name is an AUTHORED spoken form (ClearSpeak style), because generated speech is often wrong for physics notation."*

Automated text-to-speech converters reading raw LaTeX or naive MathML produce misleading speech for 1905 physics notation (e.g. reading $V$ as volume instead of light speed, reading subscripts as multiplication, or flattening fractions to "d over d t").

This document records:
1. Three candidate announcement patterns implemented in `src/equations/accessibility/EquationAccessibility.tsx`.
2. Automated structural verification (single accessible-name source, visual HTML hidden).
3. Detailed manual verification scripts prepared for the assistive technology matrix.
4. An empty decision section reserved exclusively for the human gate bead `am-eq-math-announcement-at-matrix-0al6`.

> [!IMPORTANT]
> **Honesty Constraint:** Automated accessibility-tree snapshots verify DOM structure and accessible name calculation, but CANNOT prove real-world speech output across diverse screen reader engines. No pattern is declared permanently chosen until the human-gate AT matrix runs.

---

## 2. Candidate Announcement Patterns

### Pattern A: Visual `aria-hidden` + `.sr-only` Spoken Text Span
- **Architecture:**
  ```html
  <div class="am-eq-accessible pattern-A" role="group">
    <span class="sr-only" data-a11y-spoken-name="true">
      D, the diffusion coefficient, equals Boltzmann's constant k sub B times temperature T...
    </span>
    <div class="equation-visual" aria-hidden="true">...KaTeX HTML...</div>
    <div class="equation-mathml" aria-hidden="true">...MathML...</div>
  </div>
  ```
- **Rationale:** Universally supported by legacy and modern screen readers. Completely bypasses MathML parsing idiosyncrasies.

### Pattern B: Container `role="math"` with `aria-label`
- **Architecture:**
  ```html
  <figure class="am-eq-accessible pattern-B" role="math" aria-label="D, the diffusion coefficient, equals Boltzmann's constant k sub B...">
    <div class="equation-visual" aria-hidden="true">...KaTeX HTML...</div>
    <div class="equation-mathml" aria-hidden="true">...MathML...</div>
  </figure>
  ```
- **Rationale:** Clean semantic markup. Maps to the WAI-ARIA `math` role. Exactly one accessible name source.

### Pattern C: MathML Annotated with `aria-label` on `<math>`
- **Architecture:**
  ```html
  <div class="am-eq-accessible pattern-C">
    <div class="equation-visual" aria-hidden="true">...KaTeX HTML...</div>
    <div class="equation-mathml">
      <math aria-label="D, the diffusion coefficient, equals Boltzmann's constant k sub B..." display="block">
        ...
      </math>
    </div>
  </div>
  ```
- **Rationale:** Preserves native MathML DOM structure for readers with advanced MathML navigation enabled, while providing the authored ClearSpeak string via `aria-label`.

---

## 3. Structural Guarantees & Constraints

1. **KaTeX Visual HTML Hiding:**
   In all three patterns, `<div class="equation-visual" aria-hidden="true">` ensures that visual layout glyphs (e.g. fraction lines, sizing struts) never enter the accessibility tree.
2. **Single Name Source Enforcement:**
   Only one element per equation produces an accessible name, preventing double-voicing.
3. **No Redundant Heading Announcement:**
   When a visible equation title is present as a heading, the pattern does not repeat the title unnecessarily in the live formula name.
4. **Non-Tabbing Explorer (`TermExplorer`):**
   Individual equation symbols do NOT act as sequential tab stops in the page outline. The formula reads as a unified whole, with an optional keyboard-navigable Term Explorer that uses roving `tabindex` and exits cleanly with `Escape`.

---

## 4. Manual Assistive Technology Verification Scripts

The following test scripts are prepared for execution by `am-eq-math-announcement-at-matrix-0al6`:

### Script 1: VoiceOver on macOS (Safari)
1. Navigate to `/papers/brownian-motion?view=reading#bm-s3-e1`.
2. Press `Control + Option + Right Arrow` to move focus to the Einstein relation equation.
3. **Verify:** VoiceOver speaks the full authored ClearSpeak form clearly without voicing raw TeX or MathML fragments.
4. Press `Control + Option + Space` (or `Tab`) to enter the Term Explorer.
5. Press `Right Arrow` and `Down Arrow` to navigate terms.
6. **Verify:** Polite live region announces term name, role, unit, and value.
7. Press `Escape`.
8. **Verify:** Focus returns cleanly to the equation container.

### Script 2: NVDA on Windows (Firefox & Chrome)
1. Navigate with `Down Arrow` (Browse Mode) to the Lorentz factor equation in `/papers/special-relativity`.
2. **Verify:** NVDA speaks "beta, the Lorentz factor, equals 1 divided by the square root of 1 minus v squared over V squared".
3. Verify that changing perspective to Modern updates the spoken announcement to "gamma, the Lorentz factor...".

### Script 3: JAWS on Windows (Chrome & Edge)
1. Press `O` or `G` to navigate to equation containers.
2. Verify reading speed and pronunciation of Greek letters ($\eta$, $\tau$, $\lambda_x$, $\varphi$).
3. Test roving focus in `TermExplorer`.

### Script 4: TalkBack on Android (Chrome)
1. Swipe right to focus the mass-energy kinetic energy equation.
2. Verify TalkBack announces the equation once without doubling.

### Script 5: Orca on Linux (Firefox)
1. Navigate to the Wien law equation in `/papers/light-quanta`.
2. Verify speech synthesizer pronounces $\nu^3$ as "nu cubed" or "frequency cubed" without phonetic distortion.

---

## 5. Human Gate Decision Record

*(This section is intentionally empty and reserved for the human-gate bead `am-eq-math-announcement-at-matrix-0al6`)*

- **Selected Pattern:** `[RESERVED]`
- **Evaluation Date:** `[RESERVED]`
- **Evaluator:** `[RESERVED]`
- **Decision Rationale:** `[RESERVED]`
- **AT Matrix Results:** `[RESERVED]`
