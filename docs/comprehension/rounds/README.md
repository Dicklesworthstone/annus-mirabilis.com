# Comprehension Testing Rounds Directory

This directory stores verified comprehension testing round reports across all papers and routes.

## Report Requirements & Validation
Every round report placed in this directory must:
1. Comply with `docs/comprehension/materials/round-report-template.md`.
2. Include complete YAML front matter containing `paper`, `route`, `date`, `buildCommit`, `anchors`, and `facilitator`.
3. Use pseudonymous participant codes strictly validated by `parseParticipantCode` (from `src/testing/docs/participantCodes.ts`).
4. Contain NO personal data (no email addresses, real names, or phone numbers).
5. Be validated automatically by `src/testing/docs/roundReports.test.ts`.
