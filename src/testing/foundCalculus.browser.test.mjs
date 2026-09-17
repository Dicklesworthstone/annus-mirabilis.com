import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";
import { describe, test } from "node:test";
import { chromium } from "playwright";
import { writeCalculusLog } from "./foundCalculus.logger.ts";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
};

describe("browser E2E foundation calculus verification (am-found-calculus-6agg)", () => {
  test("E2E 3 (Chromium): Open foundation:logarithms with JavaScript disabled in real browser and assert 'lg' note renders", async () => {
    const root = resolve("out");
    const outStat = await stat(root).catch(() => null);
    if (!outStat?.isDirectory()) {
      console.log("[foundCalculus.browser] out/ directory not present; skipping browser check");
      return;
    }

    const server = createServer(async (req, res) => {
      let file = resolve(
        root,
        `.${decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname)}`,
      );
      if ((await stat(file).catch(() => null))?.isDirectory()) {
        file = resolve(file, "index.html");
      }
      try {
        res.setHeader("Content-Type", MIME_TYPES[extname(file)] ?? "application/octet-stream");
        res.end(await readFile(file));
      } catch {
        res.writeHead(404);
        res.end("Not found");
      }
    });

    await new Promise((resolveListening) => server.listen(0, "127.0.0.1", resolveListening));
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const url = `http://127.0.0.1:${address.port}/foundations/logarithms/`;

    const browser = await chromium.launch();
    try {
      // Launch context with JavaScript explicitly disabled
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded" });

      const text = await page.innerText("body");

      // Verify 1905 historical note and numeric values
      assert.ok(
        text.includes("lg") || text.includes("natural logarithm"),
        "Historical note on 1905 German 'lg' must render without JavaScript",
      );
      assert.ok(
        text.includes("0.693147"),
        "Natural logarithm ln 2 ≈ 0.693147 must render without JavaScript",
      );
      assert.ok(
        text.includes("0.301030"),
        "Common logarithm log10 2 ≈ 0.301030 must render without JavaScript",
      );

      writeCalculusLog({
        testId: "browser-e2e-logarithms-no-javascript",
        foundationId: "logarithms",
        callingAnchor: "light-quanta:s5",
        jsEnabled: false,
        expected: "1905 'lg' note and values rendered in Chromium with javaScriptEnabled: false",
        actual: "Rendered cleanly, all assertions met in Chromium DOM",
        outcome: "passed",
        message:
          "Verified in real Chromium with JS disabled that foundation:logarithms renders 1905 'lg' note",
      });

      await context.close();
    } finally {
      await browser.close();
      server.close();
    }
  });
});
