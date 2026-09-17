import { describe, expect, test } from "bun:test";
import { type HarLog, analyzeTransferredBytes } from "./transferredBytes.ts";

describe("Transferred Bytes Analysis", () => {
  const fixtureHar: HarLog = {
    log: {
      entries: [
        {
          request: { url: "https://annus-mirabilis.com/" },
          response: {
            status: 200,
            headers: [{ name: "Content-Encoding", value: "br" }],
            content: { size: 45000, mimeType: "text/html" },
            bodySize: 12000,
            _transferSize: 12000,
          },
        },
        {
          request: { url: "https://annus-mirabilis.com/_next/static/chunks/main.js" },
          response: {
            status: 200,
            headers: [{ name: "Content-Encoding", value: "br" }],
            content: { size: 85000, mimeType: "application/javascript" },
            bodySize: 28000,
            _transferSize: 28000,
          },
        },
        {
          request: { url: "https://annus-mirabilis.com/_next/static/chunks/webpack.js" },
          response: {
            status: 200,
            headers: [{ name: "Content-Encoding", value: "gzip" }],
            content: { size: 10000, mimeType: "application/javascript" },
            bodySize: 3500,
            _transferSize: 3500,
          },
        },
        {
          request: { url: "https://annus-mirabilis.com/fonts/Newsreader.woff2" },
          response: {
            status: 304,
            headers: [],
            content: { size: 18000, mimeType: "font/woff2" },
            bodySize: 0,
            _transferSize: 0,
          },
        },
        {
          request: { url: "https://annus-mirabilis.com/_next/static/css/app.css" },
          response: {
            status: 200,
            headers: [{ name: "Content-Encoding", value: "br" }],
            content: { size: 15000, mimeType: "text/css" },
            bodySize: 4500,
            _transferSize: 4500,
          },
        },
      ],
    },
  };

  test("excludes cached entries (304 / transferSize 0)", () => {
    const analysis = analyzeTransferredBytes(fixtureHar);
    expect(analysis.cachedEntriesCount).toBe(1);
    expect(analysis.transferredEntriesCount).toBe(4);
  });

  test("separates script transfer from total transfer", () => {
    const analysis = analyzeTransferredBytes(fixtureHar);
    // scripts: 28000 + 3500 = 31500
    expect(analysis.scriptTransferBytes).toBe(31500);
    // total: 12000 (html) + 28000 (js) + 3500 (js) + 4500 (css) = 48000
    expect(analysis.totalTransferBytes).toBe(48000);
    expect(analysis.totalTransferBytes).toBeGreaterThan(analysis.scriptTransferBytes);
  });

  test("records content encodings present in HTTP responses", () => {
    const analysis = analyzeTransferredBytes(fixtureHar);
    expect(analysis.encodings).toEqual(["br", "gzip"]);
  });
});
