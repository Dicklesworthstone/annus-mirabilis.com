# Study Routes Specification

The comprehension-testing protocol establishes exactly four standardized routes. Every round report, participant code, review record, and script uses these four route identifiers verbatim.

---

## 1. `no-algebra`
- **Target Audience:** Readers unfamiliar with algebra, rusty in mathematical notation, or preferring conceptual and visual explanations.
- **Active Projections:**
  - Conceptual Bridges (`content/foundations/bridge-*.json`)
  - Overview Reading (R1)
  - Show-Every-Step Prose Reading (R2 steps in words)
  - Interactive 2D Instruments (Canvas/SVG visuals with plain unit readouts)
  - 15-Minute Guided Conceptual Tour
- **Success Outcome:** Reader explains the physical mechanism, predicts qualitative effects of changes, and distinguishes assumptions from empirical evidence without symbolic calculation.

---

## 2. `nonvisual`
- **Target Audience:** Blind and low-vision readers, keyboard-only users, switch-access users, and assistive technology evaluators.
- **Active Projections:**
  - Textual Equivalents for all mathematical expressions and diagrams
  - Screen Reader live regions and semantic headings
  - Keyboard focus management and accessible sliders with typed inputs
  - Action contracts with spoken summaries
- **Success Outcome:** Reader navigates full paper content, receives real-time telemetry announcements, and answers all rubric probes using screen reader or keyboard alone.

---

## 3. `full-derivation`
- **Target Audience:** Readers with mathematical preparation seeking full analytical transparency.
- **Active Projections:**
  - Full Explanation (R2 full) with formal KaTeX math and MathML
  - Step-by-Step Derivation Chains with marked non-obvious moves (`isMove`)
  - Symbol concordance linking historical German notation to modern SI standards
  - Source German diplomatic ledger alignment
- **Success Outcome:** Reader reproduces every intermediate step, identifies physical premises, and critiques approximations and boundary conditions.

---

## 4. `low-cost-phone`
- **Target Audience:** Mobile visitors accessing the site on entry-level Android/iOS smartphones over mobile network connections.
- **Active Projections:**
  - Responsive mobile layout without horizontal overflow
  - Touch-friendly controls and responsive canvas rendering
  - Low memory footprint (no heavy 3D rendering in initial viewport)
- **Success Outcome:** Reader smoothly loads and interacts with instruments, reads formulas without zoom corruption, and completes all tasks without frame drop or memory crash.
