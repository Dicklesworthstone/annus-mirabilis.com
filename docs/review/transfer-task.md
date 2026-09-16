# Transfer-Task Reviewer Brief

This brief governs the pedagogical review of interactive challenges, predict-perturb-explain tasks, and conceptual transfer exercises.

## Evidence Format

Transfer-task review records must contain:
- `reviewer`: stable reviewer ID from `docs/OWNERS.md`
- `role`: `transfer-task-reviewer`
- `scope`: paper slug and covered challenge IDs
- `revisions`: git revisions of transfer task records and interactive components
- `date`: ISO 8601 completion date
- `result`: `accepted`, `accepted-with-changes`, `rejected`, `needs-rereview`
- `notes`: pedagogical evaluation, distractor analysis, explanation scaffolding
- `file`: output record path under `content/reviews/<slug>/transfer-task.yaml`

## The Four Transfer Checks

Reviewers evaluate every learning challenge across four distinct dimensions:
1. **Cross-Journey Exercises:** Challenges that bridge source reading, historical discovery, and numerical experimentation without creating conceptual silos.
2. **Predict-Perturb-Explain Tasks:** Interactive prompts that ask the reader to predict an outcome before changing a physical parameter, preventing passive observation.
3. **Teach-Back Prompts:** Prompts that test deep understanding by asking the reader to explain why a plausible alternative or historical misconception fails under specific constraints.
4. **Revisit Cards, Paired-Learning Sheets, and Capstone Templates:** Synthesizing exercises that connect early 1905 arguments to later developments across the four papers.

## Independence Rule

The transfer-task reviewer must be an education-minded evaluator who did not author the specific transfer tasks under review.

## Sign-off

The reviewer tests all interactive exercise paths and signs off in `content/reviews/<slug>/transfer-task.yaml`.
