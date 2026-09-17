# Manual Accessibility Confirmation Script: Interlinear Gloss Face (`?view=gloss`)

This protocol is for human accessibility testers evaluating the interlinear gloss reading face (`?view=gloss`) across assistive technologies, input modalities, and browser platforms.

> [!IMPORTANT]
> Agents are never permitted to record manual test results. Results must be executed and signed by a named human tester and committed to `docs/accessibility/runs/gloss-face-<date>-<tester>.md`.

---

## 1. Test Environment Matrix

Execute this protocol across the following combinations:
- **Screen Readers**:
  - macOS VoiceOver with Safari
  - Windows NVDA with Firefox
  - Windows JAWS with Chrome
  - iOS VoiceOver with Mobile Safari
- **Visual & Contrast Modes**:
  - Windows High Contrast / Forced Colors Mode
  - Grayscale display emulation
  - Zoom to 200% and 400%
  - 320px viewport mobile width
- **Input Modes**:
  - Full keyboard-only navigation (no mouse or touch)
  - Switch access / Voice Control

---

## 2. Test Steps and Invariants

### A. Non-Interleaving Speech Order
1. Navigate to `/papers/mass-energy/?view=gloss`.
2. Move focus to the first sentence (`me-p1-s1`).
3. Trigger the three semantic sentence actions in order:
   - **Action 1 ("Read the German sentence")**: Verify screen reader reads continuous German without English word interjections. Verify `lang="de"` is respected by speech synthesizer.
   - **Action 2 ("Read the word glosses")**: Verify screen reader reads word gloss pairs sequentially.
   - **Action 3 ("Read the aligned English translation")**: Verify screen reader reads the continuous English translation.
4. **Invariant**: Speech synthesizer must never alternate German word, English word, German word in one breath.

### B. "Show the Reasoning Words" Toggle & Modality Marking
1. Tab to the "Show the reasoning words" checkbox toggle.
2. Toggle it ON using `Space` or `Enter`.
3. Verify that a fourth action, **Action 4 ("Read the reasoning words")**, is appended to the sentence actions.
4. **Invariant**: Actions 1, 2, and 3 must remain completely unchanged in wording and order.
5. In the visual render, verify that marked tokens (e.g., *es sei* under `konjunktiv-i`, *so verkleinert sich* under `consequence`):
   - Have bold weight and distinct underline styling.
   - Display a visible text badge `[supposition]`, `[consequence]`, `[premise]`.
   - **Invariant**: The marking must be clearly distinguishable in grayscale and forced colors without relying on color alone.
6. Open the in-place disclosure "List the reasoning words in this sentence":
   - Verify it expands a real `<ol>` list.
   - Verify the items appear in the exact chronological token order of the sentence.

### C. Entry-Link Slot Navigation
1. If the entry-link slot is configured (e.g. "Read the foundation on German physics sentences"), tab to it.
2. Activate the link: verify navigation to the target foundation.
3. Follow the return caption ("Back to the gloss face at the same sentence"): verify focus returns precisely to the source sentence.
4. If unconfigured: verify no empty element, dead link, or broken layout appears.

### D. Coverage Notices for Unglossed Content
1. Navigate to a sentence/section without gloss records (e.g. `me-p2-s2`).
2. Verify that the German text is displayed with a clear notice: "Gloss not yet available for this section."
3. Follow the link "Read in parallel face": verify seamless jump to the parallel face.

### E. Responsive & Print Layout
1. Resize the browser viewport to 320 CSS pixels:
   - Verify all word pairs wrap cleanly without horizontal scrollbars or clipping.
   - Verify font size and line height remain legible.
2. Open Print Preview (`Cmd+P` / `Ctrl+P`):
   - Verify German and English gloss pairs stay grouped vertically without orphan words.
   - Verify reasoning-words weight and underline marks are retained on printed paper.
   - Verify interactive navigation buttons and screen lists are omitted from print.
