"use client";

import type React from "react";
import { useCallback, useEffect, useState } from "react";
import type { FormattedPageEntry } from "./pageMap.ts";

export interface FacsimileViewerProps {
  readonly pdfUrl: string;
  readonly currentPage: number;
  readonly totalPages: number;
  readonly pageEntry?: FormattedPageEntry | undefined;
  readonly paperTitle: string;
  readonly onPageChange: (newPage: number) => void;
  readonly className?: string | undefined;
}

export function FacsimileViewer({
  pdfUrl,
  currentPage,
  totalPages,
  pageEntry,
  paperTitle,
  onPageChange,
  className,
}: FacsimileViewerProps) {
  const [zoom, setZoom] = useState<number>(100);
  const [inputPage, setInputPage] = useState<string>(String(currentPage));

  useEffect(() => {
    setInputPage(String(currentPage));
  }, [currentPage]);

  const handlePrev = useCallback(() => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  }, [currentPage, onPageChange]);

  const handleNext = useCallback(() => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  }, [currentPage, totalPages, onPageChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "Home") {
        e.preventDefault();
        onPageChange(1);
      } else if (e.key === "End") {
        e.preventDefault();
        onPageChange(totalPages);
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setZoom((z) => Math.min(z + 25, 250));
      } else if (e.key === "-") {
        e.preventDefault();
        setZoom((z) => Math.max(z - 25, 50));
      } else if (e.key === "0") {
        e.preventDefault();
        setZoom(100);
      }
    },
    [handlePrev, handleNext, onPageChange, totalPages],
  );

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(inputPage, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      onPageChange(parsed);
    } else {
      setInputPage(String(currentPage));
    }
  };

  const printedLabel = pageEntry?.printedPageLabel ?? String(currentPage);
  const accessibleLabel = `${paperTitle}, printed page ${printedLabel} (PDF page ${currentPage} of ${totalPages})`;

  return (
    <section
      className={`facsimile-viewer ${className ?? ""}`}
      onKeyDown={handleKeyDown}
      aria-label={`Facsimile viewer for ${paperTitle}`}
    >
      <div className="facsimile-viewer-toolbar" role="toolbar" aria-label="Viewer controls">
        <div className="toolbar-group nav-group">
          <button
            type="button"
            className="toolbar-btn btn-prev"
            onClick={handlePrev}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            ← Prev
          </button>

          <form onSubmit={handlePageInputSubmit} className="page-indicator-form">
            <label htmlFor="facsimile-page-input" className="sr-only">
              Page number
            </label>
            <input
              id="facsimile-page-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={inputPage}
              onChange={(e) => setInputPage(e.target.value)}
              onBlur={() => {
                const parsed = parseInt(inputPage, 10);
                if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
                  onPageChange(parsed);
                } else {
                  setInputPage(String(currentPage));
                }
              }}
              className="toolbar-page-input"
              aria-label="Current PDF page"
            />
            <span className="toolbar-total-pages">/ {totalPages}</span>
          </form>

          <button
            type="button"
            className="toolbar-btn btn-next"
            onClick={handleNext}
            disabled={currentPage >= totalPages}
            aria-label="Next page"
          >
            Next →
          </button>
        </div>

        <div className="toolbar-group zoom-group">
          <button
            type="button"
            className="toolbar-btn btn-zoom-out"
            onClick={() => setZoom((z) => Math.max(z - 25, 50))}
            disabled={zoom <= 50}
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="toolbar-zoom-label" aria-live="polite">
            {zoom}%
          </span>
          <button
            type="button"
            className="toolbar-btn btn-zoom-in"
            onClick={() => setZoom((z) => Math.min(z + 25, 250))}
            disabled={zoom >= 250}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className="toolbar-btn btn-zoom-reset"
            onClick={() => setZoom(100)}
            disabled={zoom === 100}
            aria-label="Reset zoom"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="facsimile-canvas-container" data-zoom={zoom} aria-label={accessibleLabel}>
        <div className="facsimile-page-frame" style={{ width: `${zoom}%` }}>
          <div className="facsimile-page-preview" aria-hidden="true">
            <div className="facsimile-page-header-info">
              <span>PDF Page {currentPage}</span>
              <span>Printed: {printedLabel}</span>
            </div>
            <canvas
              className="facsimile-render-canvas"
              data-page={currentPage}
              data-pdf-url={pdfUrl}
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
