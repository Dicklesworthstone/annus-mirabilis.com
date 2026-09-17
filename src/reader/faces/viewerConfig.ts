/**
 * Viewer configuration for the PDF facsimile reading face (am-read-facsimile-face-er0).
 * Guarantees canvas-only rendering, disables text selection and text search layers,
 * ensures isEvalSupported: false, and points to the vendored same-origin worker.
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
