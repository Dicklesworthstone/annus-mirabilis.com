# Facilitators and Testers Brief

This brief governs human study sessions, comprehension rounds, accessibility co-design rounds, and real-device verification.

## Evidence Format

Facilitation and test records must contain:
- `reviewer`: facilitator or tester ID from `docs/OWNERS.md`
- `role`: one of `accessibility-codesign-facilitator`, `comprehension-facilitator`, `real-device-tester`
- `scope`: paper slug or test domain (e.g. `brownian-motion:slice-comprehension`)
- `date`: ISO 8601 session date
- `result`: `accepted`, `accepted-with-changes`, `rejected`, `needs-rereview`
- `notes`: summary of observed user hurdles, device-specific telemetry, assistive tech feedback
- `file`: session log path under `content/reviews/<slug>/comprehension-rounds.yaml` or real-device test reports

## Participant Privacy & Anonymity

To protect user privacy and dignify study participants:
- **Participants are NEVER named in this repository.**
- All participants are identified exclusively via anonymous participant codes following the standard format:
  `<paper>-<route>-<YYYYMMDD>-<nn>`
  (e.g. `brownian-motion-r2-20260916-01`).
- No demographic diagnoses, credentials, or private personal data are stored.

## Session Protocols & References

1. **Comprehension Rounds:** Facilitators observe readers interacting with R0, R2, and R3 reading faces without intervening, noting conceptual friction points.
2. **Accessibility Co-Design Protocol:** Facilitators follow the accessibility manual protocol (`docs/accessibility/manual-protocol.md`) working with disabled readers using their native screen readers and assistive devices.
3. **Real-Device Testing:** Real-device testers follow the real-device checklist (`docs/testing/real-device/README.md`) testing on physical hardware (phones, tablets, e-readers).

## Sign-off

Facilitators compile anonymized session observations and sign off in the relevant review and test logs.
