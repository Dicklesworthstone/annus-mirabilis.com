# Manual Accessibility Verification Protocol & Assistive Technology Matrix

**Document Version:** 1.0 (2026-09-17)  
**Standard:** WCAG 2.2 Level A & AA Baseline  
**Owning Bead:** `am-a11y-baseline-1cg5`

---

## 1. Assistive Technology & Platform Matrix

Every paper release and major interactive instrument must be verified across the primary assistive technology matrix below:

| Assistive Technology | Browser | Platform / OS | Primary Use & Validation Focus |
|---|---|---|---|
| **VoiceOver** | Safari 18+ | macOS 15+ (Sonoma/Sequoia) | Rotor navigation, MathML equations, live region announcements, term exploration |
| **VoiceOver** | Mobile Safari | iOS 18+ (iPhone/iPad) | Single-touch exploration, touch slider warning, rotor headings, Dynamic Type |
| **NVDA** | Firefox (latest) | Windows 11 | Full speech output of mathematical ladders, table navigation, language switching (`lang="de"`) |
| **NVDA** | Chrome (latest) | Windows 11 | ARIA live regions, canvas instrument fallbacks, skip links |
| **JAWS** | Chrome (latest) | Windows 11 | Virtual cursor navigation, slider controls, landmark navigation |
| **TalkBack** | Chrome (latest) | Android 14+ | Linear touch exploration, parameter stepper buttons, focus order |
| **Keyboard Only** | Chrome / Safari / Firefox | Any desktop | Visible focus rings (no obscuring), Tab/Shift+Tab trap in overlays, character shortcuts |
| **Screen Magnification** | System / Browser Zoom | Desktop & Mobile | 200% and 400% zoom without horizontal scrolling or clipped text under spacing overrides |
| **Forced Colors** | OS High Contrast Mode | Windows / macOS | All lines, points, and terms distinguishable without color (dashes, markers, text labels) |
| **Reduced Motion** | System preference | Any | All physics animations pause immediately, state preserved, stepping enabled |
| **Switch Control** | System Switch | iOS / macOS / Android | Single-switch and two-switch navigation of telemetry and parameter steppers |
| **Voice Control** | System Voice Control | iOS / macOS | Numbered labels and accessible names match visible button text |
| **Refreshable Braille** | Braille display | Windows / macOS | Unified English Braille (UEB) mathematical output for spoken-form formulas |

---

## 2. Touch Slider Pattern Warning

> [!WARNING]
> Standard HTML `<input type="range">` and custom ARIA sliders on mobile touch screens can be difficult to operate precisely with swipe gestures alone and may trigger unintended page scrolling.
>
> **Mandatory Design Requirement:** Beside every continuous slider, the interface MUST provide:
> 1. Explicit increment (`+`) and decrement (`-`) stepper buttons with at least 24×24 px target size.
> 2. A direct numeric text input allowing exact value entry.
> 3. Spoken feedback via `announce()` on value commit.

---

## 3. Scripted Reasoning Tasks

Manual evaluation is organized around **scientific reasoning tasks**, not just cosmetic UI audits:

### Task 1: Compare Event Times (Special Relativity §1–§2)
- **Goal:** Determine whether two light signals emitted simultaneously in the stationary frame arrive simultaneously at moving detectors.
- **Protocol:** Navigate to `/papers/special-relativity#s2`. Using keyboard or screen reader only, inspect the clock synchronization table. Adjust the frame velocity $v/c$ using stepper buttons.
- **Success Criteria:** The reader can read the coordinate difference $\Delta t' = \gamma (t - vx/c^2)$ without looking at the visual Minkowski diagram.

### Task 2: Choose a Displacement Statistic (Brownian Motion §4)
- **Goal:** Contrast signed displacement $\sum \Delta x = 0$ with mean-square displacement $\overline{\Delta^2} = 2Dt$.
- **Protocol:** Open `/lab/bm-01`. Activate the nonvisual telemetry stepper. Step 100 particles for 60 seconds.
- **Success Criteria:** The user hears the signed mean announced as near zero ($0.0 \pm 0.1\ \mu\text{m}$) and the RMS distance announced as $7.9\ \mu\text{m}$, demonstrating why signed average obscures motion while RMS reveals it.

### Task 3: Inspect Conservation Balance (Light Quanta §8 & Mass-Energy §1)
- **Goal:** Verify that energy emitted in radiation reduces body mass by $L/c^2$.
- **Protocol:** Navigate to `/papers/mass-energy#s1`. Open the energy ledger table.
- **Success Criteria:** Table rows read cleanly with column headers, showing exact energy quantities and dimensional balance.

### Task 4: Explain an Equation Step (Derivation Chains)
- **Goal:** Traverse from Einstein's diffusion differential equation $\frac{\partial f}{\partial t} = D \frac{\partial^2 f}{\partial x^2}$ to the Gaussian solution $f(x,t) = \frac{n}{\sqrt{4\pi D t}} e^{-\frac{x^2}{4Dt}}$.
- **Protocol:** Focus the derivation accordion. Navigate step by step using Enter/Space.
- **Success Criteria:** Each mathematical step is announced with its historical premise and justification.

---

## 4. Mathematics Accessibility Verification

1. **Single Announcement Rule:** A displayed formula with an authored `spokenForm` is announced exactly ONCE by the screen reader. Visual KaTeX HTML and duplicate labels must carry `aria-hidden="true"`, while the container provides the authored spoken representation or clean MathML.
2. **Term Explorer Entry/Exit:** Entering an equation's term explorer via Enter/Space moves focus to the first term badge. Pressing Escape restores focus to the parent equation container.
3. **Language Switching in Bilingual Faces:** German source passages carry `lang="de"`, triggering proper German voice pronunciation; English translation blocks carry `lang="en"`.
4. **Color-Free Term Identification:** Under grayscale or forced-colors mode, equation terms and graph curves remain distinct through their subscript labels, border shapes, or stroke dash patterns (solid, dashed, dotted).

---

## 5. Single-Pointer Operation Protocol

- **3D Scene Manipulation:** Every 3D laboratory scene provides single-pointer pan/tilt buttons and preset perspective buttons (XY, XZ, comoving, laboratory) alongside drag/orbit controls.
- **Facsimile Viewer:** Zooming and panning high-resolution scans is operable via single-tap `[+]`, `[-]`, and directional pan buttons.
- **Pointer Cancellation:** Custom sliders and draggable dividers commit values only on `pointerup` within the interactive target; dragging outside or receiving `pointercancel` aborts the interaction cleanly without committing state.

---

## 6. Verification Results Template

When conducting manual or co-design evaluation sessions, record results in `docs/accessibility/runs/<YYYYMMDD>-<tester-id>.md` using this template:

```markdown
# Accessibility Evaluation Run Report

- **Date:** YYYY-MM-DD
- **Tester:** [Name / Identifier] (Role: [Blind reader / Low-vision / Motor-impaired / Agent automated pilot])
- **Tools & Versions:** [e.g. VoiceOver Safari macOS 15.2, NVDA 2024.3 Firefox 132]
- **Paper / Exhibit Evaluated:** [e.g. Brownian Motion §1–§5, Laboratory BM-01]

## Tasks Evaluated

| Task # | Task Description | Outcome (Pass / Partial / Fail) | Severity (Critical / Serious / Moderate / Minor) | Barrier Description | Follow-up Bead |
|---|---|---|---|---|---|
| 1 | Clock sync table comparison | Pass | None | — | — |
| 2 | Telemetry stepper RMS check | Pass | None | — | — |

## Observations & Recommendations
- [Detailed notes on clarity, speech cadence, navigation rhythm, or cognitive obstacles]
```

---

## 7. Pilot Run Record (Automated & Scripted Agent Walkthrough)

- **Date:** 2026-09-17
- **Tester:** Antigravity Agent Automated Baseline Sweep
- **Tools & Engines:** Happy-DOM, Bun Test Runner, Biome A11y Rules, Pure Algorithm Checks (`scripts/a11y/checks.ts`)
- **Evaluated Scope:** Application Shell, bilingual reading layout, live region announcement engine, focus trap and restoration stack, reduced motion subscribers, pointer cancellation controller, and WCAG 2.2 55-criteria mapping.

### Pilot Results Summary

| Check / Task | Evaluated Mechanism | Automated Outcome | Notes |
|---|---|---|---|
| 1. Criteria Mapping | `docs/accessibility/wcag-22-map.yaml` | **PASS (55/55)** | 55 criteria mapped to rules/checks or justified not-applicable reasons. |
| 2. Live Announcements | `src/a11y/announce.ts` | **PASS** | Debounced, atomic live regions; politeness levels verified. |
| 3. Focus Stack & Restoration | `src/a11y/focus.ts` | **PASS** | Scope push/pop restores focus to trigger elements across nested layers. |
| 4. Tab Trapping | `src/a11y/focus.ts` | **PASS** | Forward and backward Tab wraps inside dialog boundaries. |
| 5. Reduced Motion | `src/a11y/reducedMotion.ts` | **PASS** | Respects system media query and site `data-reduced-motion` attribute. |
| 6. Pointer Cancellation | `src/a11y/pointer.ts` | **PASS** | Commits on valid release inside bounds; aborts on cancel / outside release. |
| 7. Focus Obscuring Check | `scripts/a11y/checks.ts` | **PASS** | 9-point sampling detects 100% obscured targets and passes unobstructed targets. |
| 8. Target Size Check | `scripts/a11y/checks.ts` | **PASS** | Enforces 24×24 px minimum or 24 px spacing exception. |
| 9. Language of Parts | `scripts/a11y/checks.ts` | **PASS** | Validates `lang="de"` on German original text blocks. |
| 10. Link Purpose & Page Titles | `scripts/a11y/checks.ts` | **PASS** | Flags vague links ("here", "more") and ensures unique route titles. |

> [!NOTE]
> Human co-design testing with screen-reader users, refreshable braille displays, switch controls, and motor-impaired readers is scheduled under `am-bm-slice-a11y-codesign-3xuq` and `am-a11y-disabled-reader-rounds-jkjr`. As an AI agent, this pilot records only automated and simulated programmatic verifications.

---

## 8. The iPhone and iPad App (`am-app-accessibility-4h2o`)

The app shows the same edition inside a web view, with a small native chrome around it: the
page-actions button and its menu, the Contents sheet (papers and outlines, Discover routes,
instruments) and the "Your data on this device" sheet. The website's own checks above still
govern the edition's pages; this section is about the native chrome and about how the edition
behaves inside the app.

### 8.1 What automated tests establish, and what they cannot

`ios/AnnusMirabilisUITests/AccessibilityUITests.swift` runs Apple's accessibility audit
(`performAccessibilityAudit`, all audit types) on every native screen. It runs at the default text
size in the light theme, and at the largest accessibility size (AX5) in the dark theme. An issue on a
native control fails the run. The issues it passes over are attached to every run, with the reason:
DEBUG-only test probes; bar buttons, which stop growing by the system's design and offer the Large
Content Viewer instead; the edition's own web content on the reading screen; and one label the audit
misreads. The audit says the Discover route's "Open the route" text cannot change size and may be
clipped. At the largest size it wraps onto two lines, whole, so a dedicated test measures it instead:
its text must grow to more than twice its default height and stay inside its button.

These tests run in the iOS Simulator with VoiceOver off. They cannot establish:

- what VoiceOver says, or where its focus lands;
- that the rotor lists the page's headings as headings. The tests show only that the headings are in
  the accessibility tree;
- that Voice Control and Switch Control can reach every control;
- how equations are announced (section 4 applies inside the app too).

Each of those needs a person with the assistive technology on a real device, as below. None has
been performed yet.

### 8.2 Reasoning tasks on a device

Run on an iPhone and, where noted, an iPad, with the app installed from the build under review.
Record results in the section 6 template, naming the device, the iOS version and the build.

1. **VoiceOver, into a passage and back.** Open the page-actions menu, then Contents, then Papers,
   choose Brownian motion, then §4. *Expected:* VoiceOver announces the new page and its focus
   moves into it. The heading rotor lists the page's headings, §4 among them. Close a sheet
   without choosing: focus returns to the page-actions button.
2. **VoiceOver, an equation in §4.** Explore the displayed equation for the diffusion coefficient.
   *Expected:* the authored spoken form, read once, with no duplicate announcement (section 4).
3. **Largest text size.** Settings, Accessibility, Display & Text Size, Larger Text, at the largest
   size. Open every native screen. *Expected:* no essential label is truncated and nothing needs
   horizontal scrolling. The page's type size follows at the edition's largest step (150 percent);
   the page-actions button grows to 64 points and a long press shows its Large Content Viewer.
4. **Voice Control.** Say "Show names". *Expected:* each native control's spoken name matches its
   visible text. Examples: "Page actions", "Contents", "Your data on this device", each
   paper, route and instrument by its title, "Export all of it (JSON)".
5. **Switch Control.** Using item scanning, reach every item in the page-actions menu. Open
   Contents, move through all three tabs, and export the reader's data. *Expected:* no native
   action needs a gesture.
6. **Reduce Motion.** Settings, Accessibility, Motion, Reduce Motion on. Open and close each sheet.
   *Expected:* the system's reduced transitions. The native chrome adds no motion of its own, and
   the edition's pages follow `prefers-reduced-motion` (section 1, Reduced Motion row).
7. **Keyboard on iPad.** With a hardware keyboard: Tab and the arrow keys move through the
   native controls. *Not yet built:* Command-K (search) and Command-F (find) shortcuts and their
   entries in the shortcut overlay.
