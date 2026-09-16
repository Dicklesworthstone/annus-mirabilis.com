# Comprehension-Testing Protocol & Rubric

**Annus Mirabilis** (`annus-mirabilis.com`) · Interactive Critical Edition and Discovery Laboratory

---

## 1. Purpose & Stance

The fifth release question for Annus Mirabilis is whether an authored explanation helps a reader overcome the specific obstacle it was written for (§17.1). Only human readers can answer this question.

This protocol governs all empirical reader testing across the project, including:
- Brownian motion reference slice rounds and acceptance scenarios (§17.5, §17.6)
- Complete per-paper comprehension rounds
- Assistive technology and disabled-reader co-design rounds
- Fifteen-minute tour tests
- Cross-paper verification rounds
- Final launch product test

### The Non-Judgmental Stance
1. **The participant is never being tested.** The site and its explanations are being tested.
2. An incorrect explanation or stumbling point is actionable information about the design and copy of the edition, never a reflection of the reader's intelligence or capability.
3. Facilitators maintain a calm, supportive, neutral demeanor. Think-aloud prompts encourage exploration without hinting at answers.
4. Satisfaction scores, completion rates, and time on page are not substitutes for genuine comprehension (Deslauriers et al., PNAS 116, 2019).

---

## 2. Participants

### Recruitment & Starting Points
Participants are recruited across diverse backgrounds to discover obstacles:
- **No algebra or graph fluency:** Readers who have not used algebraic symbols or coordinate graphs since early schooling.
- **Rusty mathematical preparation:** Readers who previously studied mathematics or physics but have forgotten technical procedures.
- **Non-native English readers:** Readers engaging with English translations and glosses as a second language.
- **Technically trained but physics-unfamiliar:** Readers with strong reasoning skills (e.g. software engineers, physicians, chemists) encountering relativistic or thermodynamic concepts.
- **Strong mathematical preparation:** Mathematicians or theoretical physicists exploring historical derivations and notation concordances.
- **Disabled readers:** Blind or low-vision readers using screen readers (NVDA, JAWS, VoiceOver), keyboard/switch users, and neurodivergent readers using their own assistive setups.
- **Low-cost phone users:** Readers accessing the edition on mobile networks using entry-level mobile devices.

### Anti-Profiling Policy
- No diagnosis, credential, test score, or placement level is ever collected or stored.
- Personas (physician, programmer, engineer, student) are editorial lenses for authors, never categories into which participants are placed.
- Participants are never assigned a level or forced to declare a profession.

---

## 3. Routes

All study sessions, participant codes, and round reports use exactly four standardized route identifiers:

1. `no-algebra`: First encounter, intuitive bridges, overview reading, show-every-step prose reading, interactive 2D instruments, and the 15-minute conceptual tour.
2. `nonvisual`: Screen reader, Braille display, keyboard or switch navigation, textual semantic equivalents, aria-live action announcements, and no graphical reliance.
3. `full-derivation`: Detailed mathematical explanation, step-by-step algebraic/calculus derivation chains, symbol-by-symbol notation concordance, and source-to-modern comparison.
4. `low-cost-phone`: Real entry-level smartphone devices on cellular data networks testing layout, responsiveness, and touch interaction.

---

## 4. Consent

### Principles & Accessible Formats
Participation is strictly voluntary, accessible, and compensated. Consent documents are provided in four accessible formats:
- Plain Language Form (`docs/comprehension/materials/consent-plain-language.md`)
- Semantic Screen-Reader HTML (`docs/comprehension/materials/consent-screen-reader.html`)
- High-Contrast Large-Print (`docs/comprehension/materials/consent-large-print.md`)
- Easy-Read Summary (`docs/comprehension/materials/consent-easy-read.md`)

### Core Protections
- **Right to stop:** Participants may pause or terminate the session at any moment without penalty or loss of compensation.
- **Data minimization:** Only pseudonymous participant codes are stored. No real names, email addresses, or phone numbers enter the repository.
- **Recordings:** Screen/audio recording requires optional, explicit secondary consent and is stored in private off-repo project storage with a defined retention schedule.
- **Distress procedure:** If a participant exhibits fatigue or discomfort, the facilitator immediately pauses the task, offers a break, and reaffirms the participant's right to stop.

---

## 5. Participant Codes and Reuse

### Participant Code Specification
Every participant session receives a deterministic pseudonymous code of the form:
`<paper>-<route>-<YYYYMMDD>-<nn>`

Examples:
- `brownian-motion-nonvisual-20270412-03`
- `brownian-motion-full-derivation-20270412-01`
- `brownian-motion-slice-low-cost-phone-20270412-11`

### Rules on Reuse
- The link between a participant code and real personal identity is maintained privately by the facilitator outside the repository.
- A participant who completes a round on a paper is **not** re-recruited for the final product test of that same paper.
- Verification rounds for blocking barriers recruit fresh participants to avoid learning-effect contamination.

---

## 6. Procedure

For each tested argument or lesson:
1. **Advance targeted change:** State the targeted change in understanding prior to the session (Template: *"After this lesson the reader can..."*).
2. **Pre-explanation baseline question:** A brief question to observe starting conceptions without judgment.
3. **Exploration & interaction:** The reader navigates the passage, bridge, or instrument while thinking aloud. Neutral facilitator prompts:
   - *"What are you noticing here?"*
   - *"What do you expect will happen if this value changes?"*
   - *"Where would you look to see why this step holds?"*
4. **Post-explanation reconstruction:** Ask the reader to explain the core argument in their own words, a sketch, or an example.
5. **Transfer case:** Present a new scenario with altered parameters, geometry, or boundary conditions to observe conceptual transfer.
6. **Optional delayed revisit:** A 2-to-4 week follow-up to test durability of understanding.

---

## 7. Rubric

Observations are evaluated across six core dimensions by a human observer (never scored by keyword algorithms):

| Dimension | Observation Focus |
|---|---|
| **Meaning** | Can the reader say what physical quantity is measured or compared? |
| **Mechanism** | Can the reader explain the physical/logical connection rather than simply describe visual animations? |
| **Prediction** | Can the reader anticipate the effect of changing a parameter, geometry, or direction? |
| **Assumptions** | Can the reader identify which physical assumptions support the conclusion and when they break down? |
| **Evidence** | Can the reader distinguish an empirical observation from a simulated or derived consequence? |
| **Navigation** | Can the reader locate source passages and missing explanations independently? |

---

## 8. Accomplishments and Reach-Sets

The edition recognizes five distinct accomplishments. They are non-hierarchical activities reflecting what the visitor came to do today, never an ordered ladder or skill level.

| Accomplishment | Meaningful outcome in a round | What must remain within reach |
|---|---|---|
| **Appreciate** | The participant explains why the question mattered and what was surprising about the answer | A concrete example and the original passage |
| **Explain** | The participant reconstructs the main reasoning in words, a picture, or a small table | Definitions, the assumptions in force, and a bridge to the symbols |
| **Predict** | The participant anticipates how a specified change affects an observable, and says why | Units, a numerical example, and the model that applies |
| **Derive** | The participant reproduces the mathematical steps and identifies each premise | Every intermediate step, any alternative derivation, and the printed notation |
| **Critique** | The participant separates what follows, what is suggested, what has been measured, and what remains undetermined | Countermodels, uncertainty, primary sources, and later qualifications |

---

## 9. Stumbling-Point Codes

Facilitators record precise obstacles using five standardized codes paired with passage anchors (`#s<n>...`) or action IDs (`<instrument>:<action>`):

- `undefined-symbol`: Unclear notation, missing variable definition, or notation clash.
- `omitted-inference`: A non-obvious leap in reasoning without an available bridge or explanation.
- `misleading-visual-cue`: An illustration or visual encoding that suggests an incorrect physical intuition.
- `inaccessible-control`: An interactive slider, switch, or button inaccessible via keyboard or screen reader.
- `too-much-at-once`: Cognitive overload resulting from excessive simultaneous mathematical terms or controls.

---

## 10. Stop-Rule Observations

For innovation capabilities that expand only after observed readers succeed (§19.7):
- Capability ID (e.g. `variance-missing-step-explorer`, `predict-mode`, `show-the-code`)
- Obstacle description
- Number of participants who encountered the obstacle
- Number of participants who successfully resolved it and returned to the main argument
- Facilitator observations and recommendations

---

## 11. Question Banks

Question banks reside in `docs/comprehension/materials/question-banks/<paper-slug>.md`. Each paper provides at least four questions per route, linked to target anchors or action IDs.

---

## 12. Comparative Experiments

When comparing two alternative pedagogical presentations, facilitators submit a preregistration document specifying hypotheses, random assignment procedure, exclusion criteria, outcome measures, and uncertainty analysis prior to data collection.

---

## 13. Support-Ladder Evidence

Every journey stage provides a structured support ladder: `workedExample` → `partialComparison` → `prediction` → `explanation` → `transferCase`.

### Empirical Support Doctrine
- Default support levels are measured in reader rounds, not assumed by dogma.
- Literature shows that optimal guidance depends on task and population (e.g. Klahr & Nigam 2004 vs. Schwartz & Martin 2004).
- The edition makes only per-stage empirical claims: *"For this argument, readers in these rounds needed this much support."*
- Modifying a stage's default support level requires citing justifying round IDs.

---

## 14. Templates

The protocol includes complete templates for:
- Round Reports (`docs/comprehension/materials/round-report-template.md`)
- Public About Page Summary (`docs/comprehension/materials/public-summary-template.md`)
- Observation Sheets (`docs/comprehension/materials/observation-sheet.md`)
- Preregistration (`docs/comprehension/materials/preregistration-template.md`)
