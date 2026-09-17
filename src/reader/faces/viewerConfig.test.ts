import { describe, expect, it } from "bun:test";
import { DEFAULT_PDFJS_WORKER_SRC, getFacsimileViewerConfig } from "./viewerConfig.ts";

describe("viewerConfig (am-read-facsimile-face-er0)", () => {
  it("disables text and annotation layers, disables find, and sets isEvalSupported: false", () => {
    const config = getFacsimileViewerConfig();
    expect(config.renderTextLayer).toBe(false);
    expect(config.renderAnnotationLayer).toBe(false);
    expect(config.enableFind).toBe(false);
    expect(config.isEvalSupported).toBe(false);
    expect(config.noTextSelection).toBe(true);
    expect(config.disableAutoFetch).toBe(true);
    expect(config.disableStream).toBe(true);
    expect(config.workerSrc).toBe(DEFAULT_PDFJS_WORKER_SRC);
  });

  it("supports custom workerSrc and cMapUrl overrides while preserving security constraints", () => {
    const customConfig = getFacsimileViewerConfig({
      workerSrc: "/custom/pdf.worker.min.mjs",
      cMapUrl: "/custom/cmaps/",
    });
    expect(customConfig.workerSrc).toBe("/custom/pdf.worker.min.mjs");
    expect(customConfig.cMapUrl).toBe("/custom/cmaps/");
    expect(customConfig.renderTextLayer).toBe(false);
    expect(customConfig.renderAnnotationLayer).toBe(false);
    expect(customConfig.enableFind).toBe(false);
    expect(customConfig.isEvalSupported).toBe(false);
  });
});
