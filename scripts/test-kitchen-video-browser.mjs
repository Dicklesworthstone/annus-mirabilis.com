import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { chromium } from "playwright";
import {
  VIDEO_FIXTURE_BASE64,
  VIDEO_FIXTURE_SHA256,
} from "../src/testing/fixtures/kitchen/videoFixture.mjs";

const bytes = Buffer.from(VIDEO_FIXTURE_BASE64, "base64");
assert.equal(createHash("sha256").update(bytes).digest("hex"), VIDEO_FIXTURE_SHA256);
const root = resolve("out"),
  evidence = [];
const types = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".woff2": "font/woff2",
};
const server = createServer(async (req, res) => {
  try {
    let file = resolve(
      root,
      `.${decodeURIComponent(new URL(req.url, "http://localhost").pathname)}`,
    );
    if (!file.startsWith(root + sep)) throw Error("outside root");
    if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
    res.setHeader("Content-Type", types[extname(file)] ?? "application/octet-stream");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; media-src 'self' blob:; worker-src 'self'; connect-src 'self'",
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
await mkdir("artifacts/browser", { recursive: true });
const check = (name) => {
  evidence.push({ check: name, outcome: "passed" });
  console.log(JSON.stringify(evidence.at(-1)));
};
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } }),
    errors = [],
    requests = [];
  let workers = 0;
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("worker", () => workers++);
  page.on("request", (r) => requests.push({ url: r.url(), method: r.method() }));
  await page.goto(`${origin}/lab/bm-07/kitchen/`);
  const ui = page.locator("[data-local-video]");
  await ui.getByLabel("Local video", { exact: true }).waitFor();
  assert.equal(workers, 0);
  assert.equal(await ui.locator("video").getAttribute("src"), null);
  await ui
    .getByLabel("Local video", { exact: true })
    .setInputFiles({ name: "private-test-chart.mp4", mimeType: "video/mp4", buffer: bytes });
  await ui.getByLabel("Confirmed nominal frame rate").fill("10");
  await ui.getByLabel("Requested sampling interval").selectOption("0.5");
  await ui.getByRole("button", { name: "Open selected local video", exact: true }).click();
  await ui.locator("[data-captured-frame]").waitFor();
  assert.match(
    await ui.locator("[data-captured-frame]").innerText(),
    /actual time 0 s.*frame-callback/,
  );
  assert.equal(workers, 0);
  check(
    "a selected blob video decodes locally with actual frame timing and no inference worker yet",
  );
  async function point(mark, x, y = 20) {
    await ui.getByLabel("Observation", { exact: true }).selectOption(mark);
    await ui.getByLabel("X (source pixels)", { exact: true }).fill(String(x));
    await ui.getByLabel("Y (source pixels)", { exact: true }).fill(String(y));
    await ui.getByRole("button", { name: "Record point", exact: true }).click();
  }
  for (const x of [9, 10, 11]) await point("x-a", x);
  for (const x of [29, 30, 31]) await point("x-b", x);
  await ui.getByLabel("Known mark separation").fill("2");
  await ui.getByRole("button", { name: "Calibrate X", exact: true }).click();
  assert.match(await ui.locator("[data-video-calibration]").innerText(), /X: 10 px\/µm/);
  assert.match(await ui.locator("[data-video-calibration]").innerText(), /Y: not calibrated/);
  for (let i = 0; i < 10; i++) await point("stationary", 20 + (i % 2 ? 1 : -1));
  const positions = [10, 18, 13, 32, 12, 30];
  for (let i = 0; i < 6; i++) {
    if (i) {
      await ui.getByRole("button", { name: "Next sample", exact: true }).click();
      await page.waitForFunction(
        (t) =>
          document
            .querySelector("[data-captured-frame]")
            ?.textContent.includes(`actual time ${t} s`),
        i * 0.5,
      );
    }
    await point("particle", positions[i]);
  }
  check("repeated same-frame calibration and stationary clicks feed a real six-position track");
  await ui.getByLabel("Exposure duration").fill("0");
  const downloadPromise = page.waitForEvent("download");
  await ui.getByRole("button", { name: "Download analysis CSV", exact: true }).click();
  const download = await downloadPromise;
  const csv = await readFile(await download.path(), "utf8");
  assert.match(csv, /requested_time_s,timing_source,presented_frames,frame_id/);
  assert.match(csv, /# radius_um=\n/);
  assert.match(csv, /# pixel_aspect_ratio=\n/);
  assert.ok(
    !csv.includes("private-test-chart") &&
      !csv.includes("blob:") &&
      !csv.includes(VIDEO_FIXTURE_BASE64),
  );
  const lab = page.locator('[data-instrument-id="bm-07-kitchen"]');
  await ui.getByRole("button", { name: "Analyze captured observations", exact: true }).click();
  await page.waitForFunction(
    () =>
      !!document
        .querySelector('[data-instrument-id="bm-07-kitchen"]')
        ?.getAttribute("data-document-digest"),
  );
  assert.ok(workers > 0);
  const digest = await lab.getAttribute("data-document-digest");
  await ui.getByLabel("Exposure duration").fill("unknown");
  await ui.getByRole("button", { name: "Analyze captured observations", exact: true }).click();
  assert.equal(await lab.getAttribute("data-document-digest"), digest);
  assert.match(await ui.locator("[data-video-failure]").innerText(), /finite decimal/);
  check(
    "CSV exports preserve capture provenance and failed declarations cannot replace accepted analysis",
  );
  await ui
    .getByRole("button", { name: "Stop and release video; keep annotations", exact: true })
    .click();
  assert.equal(await ui.locator("video").getAttribute("src"), null);
  assert.equal(await lab.getAttribute("data-document-digest"), digest);
  assert.match(await ui.getByText(/22 observations/).innerText(), /22 observations/);
  assert.equal(
    await ui
      .getByRole("button", { name: "Download raw annotations JSON", exact: true })
      .isEnabled(),
    true,
  );
  assert.ok(
    requests.every(
      (r) => r.method === "GET" && (r.url.startsWith(origin) || r.url.startsWith("blob:")),
    ),
  );
  assert.deepEqual(errors, []);
  await page.setViewportSize({ width: 320, height: 900 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: "artifacts/browser/kitchen-video-320.png", fullPage: true });
  check(
    "releasing media preserves annotations and accepted results, with no uploads or narrow-screen overflow",
  );
  await page.close();
} finally {
  await writeFile("artifacts/browser/kitchen-video-checks.json", JSON.stringify(evidence, null, 2));
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
