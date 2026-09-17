# Third-Party Software and Asset Notices

This document contains third-party software, typeface, library, and artifact notices for dependencies included in or used to build `annus-mirabilis.com`.

## Scope and Honesty Declaration

The third-party material listed below is used in annus-mirabilis.com under the respective licenses.
This inventory does not state or imply rights to scans, photographs, historical datasets, the German source text, the English translation, or original explanatory prose. Rights to those layers are recorded in their respective provenance receipts (`docs/provenance/`) and rights records.

## 1. Production NPM Dependencies

| Package / Asset | Version | License | Source Path | Notes / Reference |
|---|---|---|---|---|
| @next/env | 15.5.25 | MIT | `node_modules/@next/env` |  |
| @swc/helpers | 0.5.15 | Apache-2.0 | `node_modules/@swc/helpers` | File: `node_modules/@swc/helpers/LICENSE` |
| argparse | 2.0.1 | Python-2.0 | `node_modules/argparse` | File: `node_modules/argparse/LICENSE` |
| caniuse-lite | 1.0.30001810 | CC-BY-4.0 | `node_modules/caniuse-lite` | File: `node_modules/caniuse-lite/LICENSE` |
| client-only | 0.0.1 | MIT | `node_modules/client-only` |  |
| commander | 8.3.0 | MIT | `node_modules/commander` | File: `node_modules/commander/LICENSE` |
| js-yaml | 4.1.0 | MIT | `node_modules/js-yaml` | File: `node_modules/js-yaml/LICENSE` |
| katex | 0.18.4 | MIT | `node_modules/katex` | File: `node_modules/katex/LICENSE` |
| nanoid | 3.3.19 | MIT | `node_modules/nanoid` | File: `node_modules/nanoid/LICENSE` |
| next | 15.5.25 | MIT | `node_modules/next` | File: `node_modules/next/license.md` |
| picocolors | 1.1.1 | ISC | `node_modules/picocolors` | File: `node_modules/picocolors/LICENSE` |
| postcss | 8.5.26 | MIT | `node_modules/postcss` | File: `node_modules/postcss/LICENSE` |
| react | 19.0.0 | MIT | `node_modules/react` | File: `node_modules/react/LICENSE` |
| react-dom | 19.0.0 | MIT | `node_modules/react-dom` | File: `node_modules/react-dom/LICENSE` |
| scheduler | 0.25.0 | MIT | `node_modules/scheduler` | File: `node_modules/scheduler/LICENSE` |
| source-map-js | 1.2.1 | BSD-3-Clause | `node_modules/source-map-js` | File: `node_modules/source-map-js/LICENSE` |
| styled-jsx | 5.1.6 | MIT | `node_modules/styled-jsx` | File: `node_modules/styled-jsx/license.md` |
| tslib | 2.8.1 | 0BSD | `node_modules/tslib` | File: `node_modules/tslib/LICENSE.txt` |

## 2. Typefaces and Fonts

| Package / Asset | Version | License | Source Path | Notes / Reference |
|---|---|---|---|---|
| Jetbrains Mono (JetBrainsMono-Variable.ttf) | variable | OFL-1.1 | `public/fonts/jetbrains-mono/JetBrainsMono-Variable.ttf` | File: `public/fonts/jetbrains-mono/OFL.txt` |
| Newsreader (Newsreader-Variable.ttf) | variable | OFL-1.1 | `public/fonts/newsreader/Newsreader-Variable.ttf` | File: `public/fonts/newsreader/OFL.txt` |
| Plus Jakarta Sans (PlusJakartaSans-Variable.ttf) | variable | OFL-1.1 | `public/fonts/plus-jakarta-sans/PlusJakartaSans-Variable.ttf` | File: `public/fonts/plus-jakarta-sans/OFL.txt` |

## 3. Compiled WebAssembly Artifacts

| Package / Asset | Version | License | Source Path | Notes / Reference |
|---|---|---|---|---|
| fs-annus-diffusion (FrankenSim WASM artifact) | 5bbbfae | MIT with OpenAI/Anthropic Rider | `public/wasm/fs-annus-diffusion/105d7ffc15414de5` | FrankenSim upstream revision 5bbbfae6f7de614422f6f97f5798a3e00f8ad813; capabilities: [] |

## 4. Extracted Donor Modules (classic-patents.com)

| Package / Asset | Version | License | Source Path | Notes / Reference |
|---|---|---|---|---|
| docs/PAPER_E2E_HARNESS.md | da11ff4 | MIT with OpenAI/Anthropic Rider | `docs/PAPER_E2E_HARNESS.md` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| public/pdfjs | da11ff4 | MIT with OpenAI/Anthropic Rider | `public/pdfjs` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| scripts/app-router-architecture.test.ts | da11ff4 | MIT with OpenAI/Anthropic Rider | `scripts/app-router-architecture.test.ts` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| scripts/app-router-architecture.ts | da11ff4 | MIT with OpenAI/Anthropic Rider | `scripts/app-router-architecture.ts` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| scripts/deployment-target.test.ts | da11ff4 | MIT with OpenAI/Anthropic Rider | `scripts/deployment-target.test.ts` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| scripts/deployment-target.ts | da11ff4 | MIT with OpenAI/Anthropic Rider | `scripts/deployment-target.ts` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| scripts/deployment-verification.test.ts | da11ff4 | MIT with OpenAI/Anthropic Rider | `scripts/deployment-verification.test.ts` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| scripts/deployment-verification.ts | da11ff4 | MIT with OpenAI/Anthropic Rider | `scripts/deployment-verification.ts` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| scripts/e2e-paper-vertical-slices.ts | da11ff4 | MIT with OpenAI/Anthropic Rider | `scripts/e2e-paper-vertical-slices.ts` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| scripts/e2e/paper-e2e-contract.test.ts | da11ff4 | MIT with OpenAI/Anthropic Rider | `scripts/e2e/paper-e2e-contract.test.ts` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| scripts/e2e/paper-e2e-contract.ts | da11ff4 | MIT with OpenAI/Anthropic Rider | `scripts/e2e/paper-e2e-contract.ts` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| scripts/fixtures/deployment-target/corrupt-project.txt | da11ff4 | MIT with OpenAI/Anthropic Rider | `scripts/fixtures/deployment-target/corrupt-project.txt` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| scripts/fixtures/deployment-target/wrong-project.json | da11ff4 | MIT with OpenAI/Anthropic Rider | `scripts/fixtures/deployment-target/wrong-project.json` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| scripts/smoke-test-deployment.ts | da11ff4 | MIT with OpenAI/Anthropic Rider | `scripts/smoke-test-deployment.ts` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| scripts/verified-production-deploy.ts | da11ff4 | MIT with OpenAI/Anthropic Rider | `scripts/verified-production-deploy.ts` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| src/app/opengraph-image.tsx | da11ff4 | MIT with OpenAI/Anthropic Rider | `src/app/opengraph-image.tsx` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| src/content/coverage/coverageManifest.ts | da11ff4 | MIT with OpenAI/Anthropic Rider | `src/content/coverage/coverageManifest.ts` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| src/equations/colorPalette.ts | da11ff4 | MIT with OpenAI/Anthropic Rider | `src/equations/colorPalette.ts` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| src/equations/legacy/ColorizedEquation.tsx | da11ff4 | MIT with OpenAI/Anthropic Rider | `src/equations/legacy/ColorizedEquation.tsx` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| src/equations/legacy/equationTypes.ts | da11ff4 | MIT with OpenAI/Anthropic Rider | `src/equations/legacy/equationTypes.ts` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| src/equations/render/LatexRenderer.tsx | da11ff4 | MIT with OpenAI/Anthropic Rider | `src/equations/render/LatexRenderer.tsx` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| src/equations/valueFormatting.ts | da11ff4 | MIT with OpenAI/Anthropic Rider | `src/equations/valueFormatting.ts` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| src/experiments/paramAliases.ts | da11ff4 | MIT with OpenAI/Anthropic Rider | `src/experiments/paramAliases.ts` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| src/experiments/scheduler/tickScheduler.ts | da11ff4 | MIT with OpenAI/Anthropic Rider | `src/experiments/scheduler/tickScheduler.ts` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| src/experiments/tape/controlTape.ts | da11ff4 | MIT with OpenAI/Anthropic Rider | `src/experiments/tape/controlTape.ts` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| src/physics/energyLedger.ts | da11ff4 | MIT with OpenAI/Anthropic Rider | `src/physics/energyLedger.ts` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| src/physics/intervals.ts | da11ff4 | MIT with OpenAI/Anthropic Rider | `src/physics/intervals.ts` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| src/reader/facsimile/PinnedPdfFacsimile.tsx | da11ff4 | MIT with OpenAI/Anthropic Rider | `src/reader/facsimile/PinnedPdfFacsimile.tsx` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| src/reader/facsimile/pinnedPdfFacsimileState.ts | da11ff4 | MIT with OpenAI/Anthropic Rider | `src/reader/facsimile/pinnedPdfFacsimileState.ts` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| src/reader/facsimile/usePinnedPdfFacsimile.ts | da11ff4 | MIT with OpenAI/Anthropic Rider | `src/reader/facsimile/usePinnedPdfFacsimile.ts` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| src/reader/weave/predicates.ts | da11ff4 | MIT with OpenAI/Anthropic Rider | `src/reader/weave/predicates.ts` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| src/search/CommandPalette.tsx | da11ff4 | MIT with OpenAI/Anthropic Rider | `src/search/CommandPalette.tsx` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| src/testing/wasm/artifactHelpers.ts | da11ff4 | MIT with OpenAI/Anthropic Rider | `src/testing/wasm/artifactHelpers.ts` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| src/units/qty.ts | da11ff4 | MIT with OpenAI/Anthropic Rider | `src/units/qty.ts` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| src/visuals/three/StudioKernelChips.tsx | da11ff4 | MIT with OpenAI/Anthropic Rider | `src/visuals/three/StudioKernelChips.tsx` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| src/visuals/three/ThreeStudioScene.ts | da11ff4 | MIT with OpenAI/Anthropic Rider | `src/visuals/three/ThreeStudioScene.ts` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| src/workers/genericWasm.ts | da11ff4 | MIT with OpenAI/Anthropic Rider | `src/workers/genericWasm.ts` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| src/workers/transport.ts | da11ff4 | MIT with OpenAI/Anthropic Rider | `src/workers/transport.ts` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |
| src/workers/useGenericWasmSource.ts | da11ff4 | MIT with OpenAI/Anthropic Rider | `src/workers/useGenericWasmSource.ts` | Extracted from classic-patents.com at da11ff475902728fd8dd1d9db9f3af37c16ec8a5 |

## 5. Vendored Browser Assets

| Package / Asset | Version | License | Source Path | Notes / Reference |
|---|---|---|---|---|
| PDF.js | upstream | Apache-2.0 | `public/pdfjs` | Mozilla Foundation (Apache License 2.0) |

## 6. Build and Test Tooling (devDependencies)

| Package / Asset | Version | License | Source Path | Notes / Reference |
|---|---|---|---|---|
| @axe-core/playwright | 4.10.1 | MPL-2.0 | `node_modules/@axe-core/playwright` | File: `node_modules/@axe-core/playwright/LICENSE` |
| @biomejs/biome | 2.5.8 | MIT OR Apache-2.0 | `node_modules/@biomejs/biome` |  |
| @happy-dom/global-registrator | 20.14.5 | MIT | `node_modules/@happy-dom/global-registrator` | File: `node_modules/@happy-dom/global-registrator/LICENSE` |
| @types/js-yaml | 4.0.9 | MIT | `node_modules/@types/js-yaml` | File: `node_modules/@types/js-yaml/LICENSE` |
| @types/katex | 0.16.7 | MIT | `node_modules/@types/katex` | File: `node_modules/@types/katex/LICENSE` |
| @types/node | 22.13.4 | MIT | `node_modules/@types/node` | File: `node_modules/@types/node/LICENSE` |
| @types/react | 19.0.0 | MIT | `node_modules/@types/react` | File: `node_modules/@types/react/LICENSE` |
| @types/react-dom | 19.0.0 | MIT | `node_modules/@types/react-dom` | File: `node_modules/@types/react-dom/LICENSE` |
| playwright | 1.62.1 | Apache-2.0 | `node_modules/playwright` | File: `node_modules/playwright/LICENSE` |
| typescript | 5.7.3 | Apache-2.0 | `node_modules/typescript` | File: `node_modules/typescript/LICENSE.txt` |
