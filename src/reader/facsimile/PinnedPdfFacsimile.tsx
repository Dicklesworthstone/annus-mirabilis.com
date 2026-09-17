/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: src/components/patents/PinnedPdfFacsimile.tsx
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 *
 * Modifications:
 * - Decoupled patent-specific properties to generic document and paper facsimiles.
 * - Replaced external icon library with inline SVG icons.
 * - Preserved client-only dynamic rendering, preview image fallback, and accessible status labels.
 */

"use client";

import Image from "next/image";
import type { RefObject } from "react";
import type { PinnedPdfFacsimileState } from "./pinnedPdfFacsimileState.ts";
import { usePinnedPdfFacsimile } from "./usePinnedPdfFacsimile.ts";

export interface PinnedPdfFacsimileProps {
  /** Canonical same-origin URL of the immutable source PDF. */
  readonly pdfUrl: string;
  /** Title or locator used in accessible labels and recovery copy. */
  readonly title: string;
  /**
   * A literal rendering of page 1 from the same pinned bytes. It is visible
   * before JavaScript/worker startup and remains available if rendering fails.
   */
  readonly previewUrl?: string | undefined;
  /** Allows a source link to open a later page when a caller has one. */
  readonly initialPage?: number;
}

function ChevronLeftIcon({ className = "w-4 h-4" }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <polyline
        points="15 18 9 12 15 6"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon({ className = "w-4 h-4" }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <polyline
        points="9 18 15 12 9 6"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RotateCcwIcon({ className = "w-4 h-4" }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <polyline points="1 4 1 10 7 10" strokeWidth={2} />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" strokeWidth={2} />
    </svg>
  );
}

function LoaderCircleIcon({ className = "w-4 h-4 animate-spin" }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

function FileTextIcon({ className = "w-4 h-4" }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeWidth={2} />
      <polyline points="14 2 14 8 20 8" strokeWidth={2} />
      <line x1="16" y1="13" x2="8" y2="13" strokeWidth={2} />
      <line x1="16" y1="17" x2="8" y2="17" strokeWidth={2} />
    </svg>
  );
}

function PinnedPdfPageViewport({
  canvasRef,
  title,
  previewUrl,
  state,
  viewportRef,
}: {
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
  readonly title: string;
  readonly previewUrl?: string | undefined;
  readonly state: PinnedPdfFacsimileState;
  readonly viewportRef: RefObject<HTMLDivElement | null>;
}) {
  const { pageCount, pageNumber, renderState } = state;
  const showPreview = Boolean(previewUrl) && (renderState !== "ready" || pageNumber === 1);
  const loadingLabel =
    pageCount > 0
      ? `Rendering original scanned page ${pageNumber} of ${pageCount}.`
      : "Loading the complete pinned original document.";
  const canvasLabel =
    pageCount > 0
      ? `${title} original scanned facsimile page ${pageNumber} of ${pageCount}`
      : `${title} original scanned facsimile page`;

  return (
    <div
      ref={viewportRef}
      className="relative flex min-h-[440px] w-full items-start justify-center overflow-auto rounded-xl border border-parchment-300 bg-ink-950 p-2 dark:border-ink-800 sm:min-h-[560px] sm:p-4"
    >
      {showPreview && previewUrl ? (
        <Image
          alt={`${title} original source facsimile, page 1`}
          className={`h-auto max-w-full bg-white shadow-lg transition-opacity duration-150 ${
            renderState === "ready" && pageNumber === 1
              ? "pointer-events-none absolute opacity-0"
              : "relative opacity-100"
          }`}
          data-testid="pinned-pdf-preview"
          height={1600}
          priority
          sizes="(min-width: 640px) 720px, calc(100vw - 2rem)"
          src={previewUrl}
          width={1200}
        />
      ) : null}
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={canvasLabel}
        className={`h-auto max-w-full bg-white shadow-lg transition-opacity duration-150 ${
          renderState === "ready"
            ? "relative opacity-100"
            : "pointer-events-none absolute opacity-0"
        }`}
        data-testid="pinned-pdf-canvas"
      />
      {renderState === "loading" && (
        <div
          role="status"
          aria-label={loadingLabel}
          className="absolute inset-0 flex flex-col items-center justify-center bg-ink-950/40 p-4 text-center backdrop-blur-xs"
        >
          <div className="flex items-center gap-2 rounded-lg border border-parchment-300/40 bg-ink-950/90 px-3 py-2 text-xs font-sans text-parchment-100 shadow-md">
            <LoaderCircleIcon className="h-4 w-4 animate-spin text-amber-500" />
            <span>{loadingLabel}</span>
          </div>
        </div>
      )}
      {renderState === "error" && (
        <div
          role="alert"
          className="absolute inset-0 flex flex-col items-center justify-center bg-ink-950/80 p-6 text-center text-parchment-100"
        >
          <p className="max-w-md text-sm font-sans">
            {state.errorMessage ?? "The facsimile page could not be rendered."}
          </p>
        </div>
      )}
    </div>
  );
}

export function PinnedPdfFacsimile({
  pdfUrl,
  title,
  previewUrl,
  initialPage = 1,
}: PinnedPdfFacsimileProps) {
  const {
    canvasRef,
    goToPage,
    pageInput,
    retry,
    setPageInput,
    state,
    submitPageInput,
    viewportRef,
  } = usePinnedPdfFacsimile({ initialPage, pdfUrl });

  return (
    <div className="flex flex-col space-y-3">
      {/* Viewer toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-parchment-300 dark:border-ink-800 bg-parchment-100/60 dark:bg-ink-900/60 p-2.5 sm:p-3 text-xs font-sans">
        <div className="flex items-center gap-2">
          <FileTextIcon className="w-4 h-4 text-amber-700 dark:text-amber-400" />
          <span className="font-semibold text-ink-950 dark:text-parchment-50">{title}</span>
        </div>

        {/* Page controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={state.pageNumber <= 1}
            onClick={() => goToPage(state.pageNumber - 1)}
            aria-label="Previous page"
            className="p-1.5 rounded-lg border border-parchment-300 dark:border-ink-700 disabled:opacity-40 hover:bg-parchment-200 dark:hover:bg-ink-800 cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>

          <form onSubmit={submitPageInput} className="flex items-center gap-1">
            <label htmlFor="facsimile-page-input" className="sr-only">
              Page number
            </label>
            <input
              id="facsimile-page-input"
              type="text"
              inputMode="numeric"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              className="w-10 rounded border border-parchment-300 dark:border-ink-700 bg-white dark:bg-ink-950 px-1 py-0.5 text-center font-mono text-xs"
            />
            <span className="text-ink-500 font-mono">/ {state.pageCount || "–"}</span>
          </form>

          <button
            type="button"
            disabled={state.pageCount > 0 && state.pageNumber >= state.pageCount}
            onClick={() => goToPage(state.pageNumber + 1)}
            aria-label="Next page"
            className="p-1.5 rounded-lg border border-parchment-300 dark:border-ink-700 disabled:opacity-40 hover:bg-parchment-200 dark:hover:bg-ink-800 cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>

          {state.renderState === "error" && (
            <button
              type="button"
              onClick={retry}
              aria-label="Retry rendering"
              className="ml-2 flex items-center gap-1 px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-700 text-[11px] font-mono cursor-pointer"
            >
              <RotateCcwIcon className="w-3 h-3" />
              <span>Retry</span>
            </button>
          )}
        </div>
      </div>

      <PinnedPdfPageViewport
        canvasRef={canvasRef}
        title={title}
        previewUrl={previewUrl}
        state={state}
        viewportRef={viewportRef}
      />
    </div>
  );
}
