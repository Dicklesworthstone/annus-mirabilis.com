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
 * CORRECTED 2026-10-24, LATER THE SAME DAY, AND THE CORRECTION IS THE USEFUL PART. This docblock
 * said `isEvalSupported: false` appears only here while "the live `getDocument` call" leaves it at
 * its default, "so pdf.js may still attempt the eval path that the deployed Content-Security-Policy
 * refuses". The first half is true and the consequence is false: THERE IS NO LIVE CALL.
 *
 * Measured against the fresh build. No page or component imports `usePinnedPdfFacsimile` or
 * `PinnedPdfFacsimile`; the four files that name them (`pinnedPdfFacsimileState.ts`,
 * `usePinnedPdfFacsimile.ts`, this file, and `src/testing/clientGraph.ts`) each mention them in
 * prose with zero `import` statements. `grep -rl pdfjs out/_next/static/chunks/` returns NOTHING,
 * so pdf.js is in no chunk a reader downloads. The whole pdf.js path is a four-module unmounted
 * cluster, and `isEvalSupported` is moot until something mounts it.
 *
 * WHAT A READER ACTUALLY GETS, which is better than the viewer this file configures: the facsimile
 * face serves the plate as an `<img>`. On relativity's page that is
 * `/figures/plates/pages/ap-17-891/891.webp`, 640x990, 86 KB, `loading="lazy"`, with alt text, and
 * the file is in the build. An image needs no JavaScript, which is outcome 6 of AGENTS.md's
 * non-negotiables; a canvas painted by pdf.js would not. So the absence of a mounted pdf.js viewer
 * is a design that works, not a gap.
 *
 * THE ONE THING STILL WORTH READING BEFORE DELETING ANYTHING: the worker URL is declared twice,
 * `DEFAULT_PDFJS_WORKER_SRC` here and `PDFJS_WORKER_URL` in `pinnedPdfFacsimileState.ts:14`, the
 * same literal in two files that are both unmounted.
 *
 * HOW THE WRONG VERSION HAPPENED, since it is the instructive half: I read `getDocument`'s options
 * in `usePinnedPdfFacsimile.ts`, found `isEvalSupported` absent, and called the call site "live"
 * without asking whether anything reaches it. Reading a function body tells you what it would do.
 * It does not tell you that it runs.
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
