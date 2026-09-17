/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: src/components/patents/pinnedPdfFacsimileState.test.ts
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 *
 * Modifications:
 * - Adapted to verify vendored public/pdfjs worker and decoders in Annus Mirabilis.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  clampPdfPage,
  createPinnedPdfFacsimileState,
  PDFJS_WASM_URL,
  pinnedPdfFacsimileReducer,
} from "./pinnedPdfFacsimileState.ts";

describe("pinned PDF facsimile state", () => {
  test("page changes and resize cannot label an earlier canvas ready", () => {
    let state = createPinnedPdfFacsimileState(1);
    state = pinnedPdfFacsimileReducer(state, { type: "document-loaded", pageCount: 8 });
    state = pinnedPdfFacsimileReducer(state, { type: "set-available-width", availableWidth: 720 });
    state = pinnedPdfFacsimileReducer(state, {
      type: "render-ready",
      pageNumber: 1,
      availableWidth: 720,
    });
    expect(state.renderState).toBe("ready");
    state = pinnedPdfFacsimileReducer(state, { type: "go-to-page", page: 8 });
    expect(state.pageNumber).toBe(8);
    expect(state.renderState).toBe("loading");
    state = pinnedPdfFacsimileReducer(state, {
      type: "render-ready",
      pageNumber: 1,
      availableWidth: 720,
    });
    expect(state.renderState).toBe("loading");
    state = pinnedPdfFacsimileReducer(state, {
      type: "render-ready",
      pageNumber: 8,
      availableWidth: 720,
    });
    expect(state.renderState).toBe("ready");
    state = pinnedPdfFacsimileReducer(state, { type: "go-to-page", page: 8 });
    expect(state.renderState).toBe("ready");
    state = pinnedPdfFacsimileReducer(state, { type: "set-available-width", availableWidth: 280 });
    state = pinnedPdfFacsimileReducer(state, {
      type: "render-ready",
      pageNumber: 8,
      availableWidth: 720,
    });
    expect(state.renderState).toBe("loading");
    state = pinnedPdfFacsimileReducer(state, {
      type: "render-ready",
      pageNumber: 8,
      availableWidth: 280,
    });
    expect(state.renderState).toBe("ready");
  });

  test("clamps page navigation and keeps the displayed input synchronized", () => {
    let state = createPinnedPdfFacsimileState(99);
    expect(state.pageNumber).toBe(1);
    expect(state.pageInput).toBe("1");

    state = pinnedPdfFacsimileReducer(state, { type: "document-loaded", pageCount: 8 });
    state = pinnedPdfFacsimileReducer(state, { type: "go-to-page", page: 6.9 });
    expect(state.pageNumber).toBe(6);
    expect(state.pageInput).toBe("6");

    state = pinnedPdfFacsimileReducer(state, {
      type: "go-to-page",
      page: Number.POSITIVE_INFINITY,
    });
    expect(state.pageNumber).toBe(1);
    expect(state.pageInput).toBe("1");
  });

  test("resets all coupled rendering state before a fresh document attempt", () => {
    let state = createPinnedPdfFacsimileState(1);
    state = pinnedPdfFacsimileReducer(state, { type: "document-loaded", pageCount: 4 });
    state = pinnedPdfFacsimileReducer(state, { type: "go-to-page", page: 4 });
    state = pinnedPdfFacsimileReducer(state, {
      type: "render-failed",
      errorMessage: "network failure",
    });
    state = pinnedPdfFacsimileReducer(state, { type: "retry" });
    state = pinnedPdfFacsimileReducer(state, { type: "reset-document", initialPage: 3 });

    expect(state.retryRevision).toBe(1);
    expect(state.pageCount).toBe(0);
    expect(state.pageNumber).toBe(1);
    expect(state.pageInput).toBe("1");
    expect(state.errorMessage).toBeNull();
    expect(state.renderState).toBe("loading");
  });

  test("handles malformed page inputs without producing an invalid page", () => {
    expect(clampPdfPage(Number.NaN, 4)).toBe(1);
    expect(clampPdfPage(-5, 4)).toBe(1);
    expect(clampPdfPage(10, 4)).toBe(4);
  });

  test("ships a vendored worker in public/pdfjs/ with matching version", () => {
    const workerSource = readFileSync(
      join(process.cwd(), "public/pdfjs/pdf.worker.min.mjs"),
      "utf8",
    );
    expect(workerSource).toContain("pdfjsVersion = 6.3.289");
    expect(workerSource).toContain("Apache License, Version 2.0");
  });

  test("ships the vendored PDF.js image decoders and licenses unchanged", () => {
    const servedDirectory = join(process.cwd(), "public", PDFJS_WASM_URL);
    const files = readdirSync(servedDirectory).sort();

    expect(files).toContain("jbig2.wasm");
    expect(files).toContain("jbig2_nowasm_fallback.js");
    expect(files).toContain("openjpeg.wasm");
    expect(files).toContain("LICENSE_JBIG2");
    expect(files).toContain("LICENSE_OPENJPEG");
  });
});
