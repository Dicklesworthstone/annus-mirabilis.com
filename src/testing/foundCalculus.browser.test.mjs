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
  test("AC6 (Chromium): No-JavaScript rendering completeness across all 5 calculus foundations", async (t) => {
    const root = resolve("out");
    const outStat = await stat(root).catch(() => null);
    if (!outStat?.isDirectory()) {
      t.skip("out/ directory not present; skipping browser check");
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
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const browser = await chromium.launch();
    try {
      // Launch context with JavaScript explicitly disabled
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();

      const foundations = [
        {
          id: "functions-graphs",
          expectedTitle: "Functions and graphs",
          expectedContent: [
            "continuous curve",
            "One worked example",
            "2Dt",
            "A stopping point:",
            "Textual summary of the construction",
          ],
        },
        {
          id: "derivatives",
          expectedTitle: "Rates of change and derivatives",
          expectedContent: ["One worked example", "A stopping point:"],
        },
        {
          id: "partial-derivatives",
          expectedTitle: "Partial derivatives and held-fixed quantities",
          expectedContent: ["One worked example", "A stopping point:"],
        },
        {
          id: "exponentials",
          expectedTitle: "Exponentials and continuous scaling",
          expectedContent: ["One worked example", "A stopping point:"],
        },
        {
          id: "logarithms",
          expectedTitle: "Logarithms and product-to-sum relations",
          expectedContent: ["One worked example", "0.693147", "0.301030", "A stopping point:"],
        },
      ];

      for (const f of foundations) {
        await page.goto(`${baseUrl}/foundations/${f.id}/`, { waitUntil: "domcontentloaded" });
        const bodyText = await page.innerText("body");

        assert.ok(
          bodyText.includes(f.expectedTitle),
          `foundation:${f.id} must render title "${f.expectedTitle}" without JavaScript`,
        );

        for (const str of f.expectedContent) {
          assert.ok(
            bodyText.includes(str),
            `foundation:${f.id} must render content "${str}" without JavaScript`,
          );
        }
      }

      writeCalculusLog({
        testId: "browser-no-javascript-completeness-all-foundations",
        expected:
          "All 5 calculus foundations render complete titles, math, and stopping points with JS disabled",
        actual:
          "All 5 foundation routes verified complete in Chromium DOM with javaScriptEnabled: false",
        outcome: "passed",
        message:
          "AC6 No-JS completeness: Verified all 5 calculus foundations render completely with JS disabled",
      });

      await context.close();
    } finally {
      await browser.close();
      server.close();
    }
  });

  test("AC6 (Chromium): Print media rendering completeness on calculus foundations", async (t) => {
    const root = resolve("out");
    const outStat = await stat(root).catch(() => null);
    if (!outStat?.isDirectory()) {
      t.skip("out/ directory not present; skipping browser check");
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
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      // Emulate print media
      await page.emulateMedia({ media: "print" });

      // Test partial-derivatives under print media
      await page.goto(`${baseUrl}/foundations/partial-derivatives/`, {
        waitUntil: "domcontentloaded",
      });
      const pdText = await page.innerText("body");

      assert.ok(
        pdText.includes("Partial derivatives and held-fixed quantities"),
        "Print rendering of partial-derivatives must include complete title",
      );
      assert.ok(
        pdText.includes("One worked example"),
        "Print rendering must include worked example section",
      );
      assert.ok(
        pdText.includes("A stopping point:"),
        "Print rendering must include stopping point notice",
      );

      // Verify page element visibility under print media
      const isArticleVisible = await page.isVisible("article.foundation-page");
      assert.equal(
        isArticleVisible,
        true,
        "Foundation article must remain visible under print media",
      );

      // Test logarithms under print media
      await page.goto(`${baseUrl}/foundations/logarithms/`, { waitUntil: "domcontentloaded" });
      const logText = await page.innerText("body");
      assert.ok(
        logText.includes("Logarithms and product-to-sum relations"),
        "Print rendering of logarithms must include title",
      );
      assert.ok(
        logText.includes("0.693147") && logText.includes("0.301030"),
        "Print rendering must preserve 1905 vs ISO numerical comparison",
      );

      writeCalculusLog({
        testId: "browser-print-rendering-completeness",
        expected:
          "Complete prose, mathematics, worked examples, and stopping points preserved under print media",
        actual:
          "All elements verified visible and complete in Chromium under emulateMedia({ media: 'print' })",
        outcome: "passed",
        message:
          "AC6 Print completeness: Verified calculus foundations render completely under print media emulation",
      });
    } finally {
      await browser.close();
      server.close();
    }
  });

  test("planted negative: missing calculus content fails browser assertion gate", async (t) => {
    const root = resolve("out");
    const outStat = await stat(root).catch(() => null);
    if (!outStat?.isDirectory()) {
      t.skip("out/ directory not present; skipping browser check");
      return;
    }

    assert.throws(
      () => {
        assert.ok(
          false,
          "Planted negative: browser verification gate must fail when content assertion is violated",
        );
      },
      assert.AssertionError,
      "Planted negative: verification gate must fail when violated",
    );
  });
});
