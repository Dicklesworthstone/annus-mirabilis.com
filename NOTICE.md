# NOTICE

Attribution and licensing terms by content layer for Annus Mirabilis (`annus-mirabilis.com`).

---

## Historical German text

The historical German texts of Albert Einstein's 1905–1906 papers in *Annalen der Physik* are in the public domain worldwide.
- **Publication dates:** 1905–1906 (*Annalen der Physik*, 4th series, volumes 17, 18, and 19).
- **Author:** Albert Einstein (14 March 1879 – 18 April 1955).
- **Basis:** Published over 70 years after the death of the author and well past all applicable statutory copyright terms in Germany, Switzerland, the United States, and internationally.

---

## Facsimile scans

Facsimile page scans are not the historical text itself. The pinned scans are Internet Archive preservation copies of the bound *Annalen der Physik* volumes; each scan's source, retrieval date and SHA-256 are recorded in its provenance receipt. No publisher PDF is pinned.
- **Terms:** Per-asset terms are recorded in each scan's provenance receipt, `docs/provenance/<key>.md`, and in `SourceAsset.rights`; the publication basis is docs/DECISIONS.md D-2026-09-24-scan-rights.
- **Code License Exclusion:** Facsimile scans are NEVER covered by the repository code license.

---

## English translation

The new English translations in this edition are created directly from the historical German text.
- **Copyright:** Copyright (c) 2026 Jeffrey Emanuel and contributors.
- **License:** MIT License with OpenAI/Anthropic Rider (see `LICENSE`).

---

## Explanatory prose

All new explanatory prose, reading levels (R0–R3), historian's margin notes, foundation articles, bridge guides, misconception analyses, and commentary.
- **Copyright:** Copyright (c) 2026 Jeffrey Emanuel and contributors.
- **License:** MIT License with OpenAI/Anthropic Rider (see `LICENSE`).

---

## Code

All application source code, components, compilers, test suites, and scripts in this repository.
- **Copyright:** Copyright (c) 2026 Jeffrey Emanuel and contributors.
- **License:** MIT License with OpenAI/Anthropic Rider. See `LICENSE` for complete terms.

---

## FrankenSim artifacts

WebAssembly artifacts and compiled physics kernels extracted or generated from FrankenSim.
- **Source:** https://github.com/Dicklesworthstone/frankensim
- **Copyright:** Copyright (c) 2026 Jeffrey Emanuel.
- **License:** MIT License with OpenAI/Anthropic Rider.

---

## Fonts

All typography assets used in Annus Mirabilis are open-source fonts:
- **Newsreader:** SIL Open Font License 1.1 (Production Type / Lucas Sharp).
- **Plus Jakarta Sans:** SIL Open Font License 1.1 (Tokotype / Gumpita Rahayu).
- **JetBrains Mono:** SIL Open Font License 1.1 (JetBrains).
- **KaTeX Fonts:** SIL Open Font License 1.1 (KaTeX Authors).

---

## Third-party runtime libraries

Third-party open-source libraries incorporated into or used by Annus Mirabilis are licensed under their respective permissive licenses:
- Runtime dependencies (package.json `dependencies`): `next` (MIT), `react` (MIT), `react-dom` (MIT), `katex` (MIT), `js-yaml` (MIT)
- Development tools (package.json `devDependencies`): `typescript` (Apache-2.0), `@biomejs/biome` (MIT OR Apache-2.0), `playwright` (Apache-2.0), `@axe-core/playwright` (MPL-2.0), `@happy-dom/global-registrator` (MIT), and the `@types/*` packages (MIT)
- Each license above is read from the package's own `package.json` in `node_modules`. The site has no Tailwind, PostCSS or Autoprefixer dependency, and uses no Three.js, pdf.js, Zod or MiniSearch package.

---

## Images and figures

- **Authored figures and SVGs:** Copyright (c) 2026 Jeffrey Emanuel and contributors. Licensed under MIT License with OpenAI/Anthropic Rider.
- **Photographs:** Public-domain historical photographs, such as the patent-office portrait of Albert Einstein, about 1905, held by ETH-Bibliothek Zürich, Bildarchiv (Portr_05937, doi:10.3932/ethz-a-000495740). ETH's record gives the photographer as unknown; the portrait is often attributed to Lucien Chavan. Per the project owner's decision (2026-09-14), public-domain photographs are credited to their archival source.

---

## Historical datasets

Raw empirical data and experimental measurements from historical publications (Perrin 1908/1909, Bancelin 1911, Millikan 1913/1916, etc.) are objective scientific facts and belong in the public domain. Curated digital dataset representations, schemas, and companion annotations are licensed under the MIT License with OpenAI/Anthropic Rider.

---

## Attribution

When quoting, exporting, or embedding content from Annus Mirabilis, include the following verbatim attribution:

```text
Annus Mirabilis (annus-mirabilis.com), critical edition and translation by Jeffrey Emanuel and contributors, based on Albert Einstein (1905).
```

### Extracted Donor Files (classic-patents.com)

Attribution for files extracted from donor projects that cannot carry a source-code comment block (JSON, plain text, and other non-commentable formats). TypeScript, TSX, JavaScript, and CSS files carry their own header comment instead; see `docs/DONOR_AUDIT.md` section 9 for the template and policy. Every entry below also has a row in `docs/DONOR_AUDIT.md` section 11.

- **Source repository:** https://github.com/Dicklesworthstone/classic-patents.com
- **Pinned commit:** `da11ff475902728fd8dd1d9db9f3af37c16ec8a5`
- **License:** MIT License (with OpenAI/Anthropic Rider). Preserved unmodified at `/LICENSE`.

| File | Donor source path | Modifications |
|---|---|---|
| `scripts/fixtures/deployment-target/corrupt-project.txt` | `scripts/fixtures/deployment-target/corrupt-project.txt` | None; the invalid-JSON fixture content is unchanged. |
| `scripts/fixtures/deployment-target/wrong-project.json` | `scripts/fixtures/deployment-target/wrong-project.json` | `projectName` changed from the donor's `classic-patents.com` to a neutral `wrong-project`, since a donor identity string may not appear in this repository outside an attribution comment (docs/DONOR_AUDIT.md section 10). `projectId` and `orgId` changed to distinct placeholder values for the same reason. |
| `docs/PAPER_E2E_HARNESS.md` | `docs/PATENT_E2E_HARNESS.md` | Adapted for papers instead of patents; replaced the patent-catalogue "what a scenario proves" section with the harness's current infrastructure-only status and the new vertical-slice journey contract. This attribution is repeated inline in the document's own body, since Markdown prose is more visible there than a hidden comment. |
