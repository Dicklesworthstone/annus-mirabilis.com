# Cloud OCR dispatch

The orchestrator (`scripts/ocr-ledgers.ts`) talks to cloud OCR only through
the injected port `CloudOcrAdapter` / `OcrDispatchPort` in
`scripts/ocr-adapters/types.ts`.

This file does **not** invent a vendor command, auth scheme, or output
format. Those answers belong to `am-src-ocr-dispatch-interface-m1ur` and
are waiting on the user. Until they exist, the orchestrator must refuse
rather than guess.

## Port (decided)

A job is one bibliographic key, one PDF, an inclusive PDF page range, a
render DPI, and instruction text. It never spans more than one paper.
Each chunk checkpoints to disk before the next chunk is submitted.
Resume reads those checkpoints and does not resubmit completed pages.

A dispatch returns, per page: recognized text, model identity, a
`toolRunId`, and never a confidence token that could be mistaken for
editorial acceptance. Drafts are research evidence only. Mathematics is
retyped by a human editor against page images.

## Adapter seam (unimplemented)

There is exactly one implementation seam: `OCR_ADAPTER` / `--adapter`, or
an injected `adapter` object in tests.

| Condition | Refusal |
|---|---|
| No adapter configured | `NO_ADAPTER` |
| Name matches a local OCR engine | `FORBIDDEN_ADAPTER_NAME` |
| `fixture` when `NODE_ENV` is not `test` | `FIXTURE_ADAPTER_OUTSIDE_TEST` |
| Named adapter has no committed module | `NO_ADAPTER` |
| `pdftoppm` not on PATH | `RENDERER_UNAVAILABLE` |

Page-image rendering uses `pdftoppm` (poppler-utils). That is rendering, not
OCR. If the binary is missing the orchestrator refuses with
`RENDERER_UNAVAILABLE` and does not fall back to a local OCR engine, parsed
PDF text, or a silent mock image.

There is no local adapter and no configuration value that can select one.
If the cloud path is unavailable the orchestrator pauses, keeps
checkpoints, and prints a `br comments add` line. It never falls back to
Tesseract, focr, OCRmyPDF, parsed PDF text, or a different vision model.

Expected worker identity named by AGENTS.md: `gpt-5.6-luna`. Binding that
identity to a live command is not decided here.
