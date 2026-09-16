# Participant Codes & Privacy Rules

## Format & Structure

All participant codes follow the rigid four-segment hyphenated pattern:
`<paper>-<route>-<YYYYMMDD>-<nn>`

Where:
- `<paper>` is one of the closed list of six paper slugs:
  - `light-quanta`
  - `brownian-motion`
  - `special-relativity`
  - `mass-energy`
  - `molecular-dimensions`
  - `brownian-motion-slice`
- `<route>` is one of the closed list of four route identifiers:
  - `no-algebra`
  - `nonvisual`
  - `full-derivation`
  - `low-cost-phone`
- `<YYYYMMDD>` is an 8-digit real calendar date (e.g. `20270412`, without internal hyphens)
- `<nn>` is a 2-digit sequential index (01 to 99)

### Valid Example Fixture
- `brownian-motion-nonvisual-20270412-03`
  - Paper: `brownian-motion`
  - Route: `nonvisual`
  - Date: `2027-04-12`
  - Index: `3`

---

## Privacy Precautions & Linking Keys

1. **No Personal Data in Code:** The code contains only the research context (paper, route, date, index).
2. **Key Storage:** The master key matching participant codes to personal names or emails is held exclusively by the human facilitator on secure, encrypted private storage outside this repository.
3. **No Repository Leakage:** No email addresses, phone numbers, or participant real names may ever be committed to any file in `docs/` or `content/`.
4. **Automated Verification:** The parser `src/testing/docs/participantCodes.ts` strictly validates all codes and ensures no parallel ad-hoc regular expressions exist in the codebase.
