/** Live BM-05: accepted worker results, prediction gating, local playback and no-script reading. */
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { type Browser, chromium, type Page } from "playwright";
import { assertOutFreshness } from "../../src/testing/outFreshness.ts";
import { dismissPredictMode } from "./predictMode.ts";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const out = resolve(root, "out");
const types: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
};

async function serveBuild() {
  assertOutFreshness(out, root);
  const server = createServer((request, response) => {
    void (async () => {
      let path = resolve(out, `.${new URL(request.url ?? "/", "http://localhost").pathname}`);
      if (path !== out && !path.startsWith(`${out}${sep}`)) throw new Error("Invalid path");
      if ((await stat(path)).isDirectory()) path = resolve(path, "index.html");
      const body = await readFile(path);
      response.writeHead(200, {
        "content-type": types[extname(path)] ?? "application/octet-stream",
      });
      response.end(body);
    })().catch(() => {
      response.writeHead(404);
      response.end("Not found");
    });
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

type ObservedWindow = Window & { walkWorkerRequests?: number };

async function scientificState(page: Page) {
  return page
    .locator('[data-instrument-id="bm-05"]')
    .first()
    .evaluate((element) => ({
      runId: element.getAttribute("data-run-id"),
      snapshotVersion: element.getAttribute("data-snapshot-version"),
      draws: element.getAttribute("data-recording-draws"),
      requestedDraws: element.getAttribute("data-request-draws"),
      selectedStep: element.getAttribute("data-selected-step"),
      values: [...element.querySelectorAll("span[data-quantity-id][data-value]")].map((node) => [
        node.getAttribute("data-quantity-id"),
        node.getAttribute("data-value"),
      ]),
      requests: (window as ObservedWindow).walkWorkerRequests ?? 0,
    }));
}

test("BM-05 replays its accepted walk without recalculating or revealing a prediction early", {
  timeout: 90_000,
}, async () => {
  const served = process.env.E2E_BASE_URL
    ? { origin: process.env.E2E_BASE_URL.replace(/\/$/, ""), server: undefined }
    : await serveBuild();
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
        : {}),
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(() => {
      (window as ObservedWindow).walkWorkerRequests = 0;
      const send = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function (message, ...rest) {
        if (message?.messageKind === "request")
          (window as ObservedWindow).walkWorkerRequests =
            ((window as ObservedWindow).walkWorkerRequests ?? 0) + 1;
        return Reflect.apply(send, this, [message, ...rest]);
      };
    });
    const page = await context.newPage();
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(error.message));
    await page.goto(`${served.origin}/lab/bm-05/`);
    const player = page.locator("[data-walk-playback]").first();
    await player.locator("form:not([hidden])").waitFor({ state: "attached" });
    assert.equal(await player.isVisible(), false, "the prediction must hide paths and their table");
    assert.ok((await dismissPredictMode(page)) > 0, "a real prediction was dismissed");
    await page.getByLabel("Observe after (whole steps)", { exact: true }).fill("40");
    await page.getByRole("button", { name: "Apply walk settings", exact: true }).click();
    await page
      .locator('[data-instrument-id="bm-05"][data-selected-step="40"][data-pending="false"]')
      .waitFor();
    const accepted = await scientificState(page);
    assert.ok(accepted.requests > 0, "the new recording must come from the real worker path");
    assert.ok(accepted.values.length > 0, "there must be scientific values to preserve");
    await player.scrollIntoViewIfNeeded();
    await player.getByRole("button", { name: "Go to start", exact: true }).click();
    await player.getByRole("button", { name: "Play recorded walks", exact: true }).click();
    await page.waitForFunction(
      () =>
        Number(
          document.querySelector("[data-walk-playback] figure")?.getAttribute("data-playback-time"),
        ) > 0,
    );
    await player.getByRole("button", { name: "Pause walk playback", exact: true }).click();
    await player.getByLabel("Go to model time (seconds)", { exact: true }).fill("0.15");
    await player.getByRole("button", { name: "Go to time", exact: true }).click();
    assert.equal(Number(await player.locator("figure").getAttribute("data-recorded-time")), 0.1);
    await player
      .getByText("Read the recorded walker positions as a table", { exact: true })
      .click();
    const projections = await player.evaluate((element) => ({
      markers: [...element.querySelectorAll("[data-walker-index]")].map((node) =>
        node.getAttribute("data-displacement-metres"),
      ),
      rows: [...element.querySelectorAll("tbody td[data-displacement-metres]")].map((node) =>
        node.getAttribute("data-displacement-metres"),
      ),
    }));
    assert.ok(projections.rows.length > 0);
    assert.deepEqual(projections.rows, projections.markers);
    await player.getByLabel(/Recorded point \(1 to/).fill("3");
    await player.getByRole("button", { name: "Go to recorded point", exact: true }).click();
    assert.equal(Number(await player.locator("figure").getAttribute("data-recorded-time")), 0.2);
    await player.getByLabel("Go to model time (seconds)", { exact: true }).fill("-1");
    await player.getByRole("button", { name: "Go to time", exact: true }).click();
    assert.equal(await player.locator(".notice.error").isVisible(), true);
    assert.equal(Number(await player.locator("figure").getAttribute("data-recorded-time")), 0.2);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(
      () =>
        (document.querySelector("[data-walk-playback] button") as HTMLButtonElement | null)
          ?.disabled,
    );
    await player.getByRole("button", { name: "Next recorded point", exact: true }).click();
    assert.ok(Number(await player.locator("figure").getAttribute("data-recorded-time")) > 0.2);
    assert.deepEqual(
      await scientificState(page),
      accepted,
      "playback must not change any scientific state or post a worker request",
    );
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      const box = await player.evaluate((element) => ({
        width: element.clientWidth,
        content: element.scrollWidth,
      }));
      assert.ok(
        box.width > 0 && box.content <= box.width + 1,
        `walk playback fits ${width}px: ${JSON.stringify(box)}`,
      );
    }
    assert.deepEqual(failures, []);
    console.log(
      JSON.stringify({
        case: "accepted-walk-playback",
        jsEnabled: true,
        outcome: "pass",
        examinedWalks: projections.rows.length,
        workerRequests: accepted.requests,
      }),
    );
    await context.close();

    const noScript = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 320, height: 900 },
    });
    const staticPage = await noScript.newPage();
    await staticPage.goto(`${served.origin}/lab/bm-05/`);
    const staticPlayer = staticPage.locator("[data-walk-playback]").first();
    assert.equal(await staticPlayer.isVisible(), true);
    assert.equal(await staticPlayer.locator("form").isVisible(), false);
    await staticPlayer
      .getByText("Read the recorded walker positions as a table", { exact: true })
      .click();
    assert.ok((await staticPlayer.locator("tbody tr").count()) > 0);
    assert.equal(await staticPlayer.locator("table").isVisible(), true);
    console.log(
      JSON.stringify({
        case: "complete-walk-without-javascript",
        jsEnabled: false,
        outcome: "pass",
      }),
    );
    await noScript.close();
  } finally {
    await browser?.close();
    const server = served.server;
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((done) => server.close(() => done()));
    }
  }
});
