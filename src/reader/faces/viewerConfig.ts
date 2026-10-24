/**
 * Viewer configuration for the PDF facsimile reading face (am-read-facsimile-face-er0).
 * Guarantees canvas-only rendering, disables text selection and text search layers,
 * ensures isEvalSupported: false, and points to the vendored same-origin worker.
 *
 * NO PRODUCTION MODULE IMPORTS THIS, AND THE LIVE VIEWER IS NOT THE KIND OF VIEWER IT CONFIGURES
 * (am-50bk, triaged 2026-10-24). The facsimile a reader opens is `src/reader/facsimile/`:
 * `usePinnedPdfFacsimile.ts` imports pdfjs-dist dynamically, sets
 * `GlobalWorkerOptions.workerSrc` and calls `getDocument` with four options of its own, then
 * renders to a canvas itself. It never constructs a pdf.js viewer, so most of the object below
 * (`renderTextLayer`, `renderAnnotationLayer`, `enableFind`, `noTextSelection`) configures a
 * component this codebase does not use. Canvas-only rendering and the absent text layer are
 * properties of how that hook draws, not settings it passes.
 *
 * TWO THINGS HERE ARE STILL WORTH READING BEFORE DELETING ANYTHING. The worker URL is declared
 * twice: `DEFAULT_PDFJS_WORKER_SRC` here and `PDFJS_WORKER_URL` in
 * `src/reader/facsimile/pinnedPdfFacsimileState.ts:14`, the same literal string in two files.
 * And `isEvalSupported: false` appears only here: the live `getDocument` call passes `url`,
 * `wasmUrl`, `disableAutoFetch`, `disableRange` and `disableStream` and leaves
 * `isEvalSupported` at its default, so pdf.js may still attempt the eval path that the
 * deployed Content-Security-Policy refuses (`script-src 'self' 'unsafe-inline'
 * 'wasm-unsafe-eval'`, no `unsafe-eval`). Passing it explicitly is a one-line change to the live
 * hook and is reported to am-read-facsimile-face-er0 rather than made here, because the browser
 * lane cannot run in this checkout and a facsimile change should be seen rendering.
 */

export interface FacsimileViewerConfig {
  readonly renderTextLayer: false;
  readonly renderAnnotationLayer: false;
  readonly enableFind: false;
  readonly isEvalSupported: false;
  readonly workerSrc: string;
  readonly cMapUrl?: string | undefined;
  readonly cMapPacked: boolean;
  readonly disableAutoFetch: boolean;
  readonly disableStream: boolean;
  readonly noTextSelection: true;
}

export interface ViewerConfigOptions {
  readonly workerSrc?: string | undefined;
  readonly cMapUrl?: string | undefined;
}

export const DEFAULT_PDFJS_WORKER_SRC = "/pdfjs/pdf.worker.min.mjs";

export function getFacsimileViewerConfig(options: ViewerConfigOptions = {}): FacsimileViewerConfig {
  return {
    renderTextLayer: false,
    renderAnnotationLayer: false,
    enableFind: false,
    isEvalSupported: false,
    workerSrc: options.workerSrc ?? DEFAULT_PDFJS_WORKER_SRC,
    ...(options.cMapUrl ? { cMapUrl: options.cMapUrl } : {}),
    cMapPacked: true,
    disableAutoFetch: true,
    disableStream: true,
    noTextSelection: true,
  };
}
