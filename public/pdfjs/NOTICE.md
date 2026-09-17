# PDF.js and WebAssembly Decoders Notice

Extracted from classic-patents.com
Source repository: https://github.com/Dicklesworthstone/classic-patents.com
Source path: public/pdfjs/
Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
Donor license: MIT License (with OpenAI/Anthropic Rider)
Preserved license text: /LICENSE

## Upstream Components and Licenses

The files in this directory are vendored from the PDF.js project (Mozilla Foundation):
- `pdf.worker.min.mjs`: Apache License 2.0 (Copyright Mozilla and individual contributors)

WebAssembly decoders and fallbacks located in `public/pdfjs/wasm/`:
- `jbig2.wasm`, `jbig2_nowasm_fallback.js`: Apache License 2.0 / BSD (see `LICENSE_JBIG2`, `LICENSE_PDFJS_JBIG2`)
- `openjpeg.wasm`, `openjpeg_nowasm_fallback.js`: BSD 2-Clause (see `LICENSE_OPENJPEG`, `LICENSE_PDFJS_OPENJPEG`)
- `qcms_bg.wasm`: MIT License (see `LICENSE_QCMS`, `LICENSE_PDFJS_QCMS`)
- `quickjs-eval.js`, `quickjs-eval.wasm`: MIT License

All assets are vendored locally to ensure zero third-party network requests during facsimile rendering.
