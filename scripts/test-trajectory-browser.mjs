import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

// Browser fixtures are arithmetic examples, not manufactured experimental data.
const csv = "track,time,x,y\nA,0,0,0\nA,1,1,2\nA,2,4,1";
const labSelector = ".measured-trajectory-lab";
async function downloadText(page, name) {
  const arriving = page.waitForEvent("download");
  await page.getByRole("button", { name, exact: true }).click();
  const download = await arriving;
  const stream = await download.createReadStream();
  assert.ok(stream, "The browser must produce an actual downloadable file.");
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

/** Runs against the real generated route and reference owner, not a UI mock. */
export async function checkTrajectoryBrowser(browser, url, check) {
  await mkdir("artifacts/browser", { recursive: true });
  const staticContext = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 900 },
  });
  try {
    const page = await staticContext.newPage();
    await page.goto(`${url}/lab/brownian-data/`);
    await page.getByRole("heading", { name: "A small, explicit data format" }).waitFor();
    assert.ok(await page.getByRole("button", { name: "Apply observations and assumptions", exact: true }).isDisabled());
    assert.ok(await page.getByRole("heading", { name: "An interval is not an authenticity certificate" }).isVisible());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: "artifacts/browser/trajectory-no-js-320.png", fullPage: true });
    check("trajectory format and model limitations survive disabled JavaScript at 320px");
  } finally {
    await staticContext.close();
  }

  const context = await browser.newContext({
    viewport: { width: 320, height: 900 },
    reducedMotion: "reduce",
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const errors = [], dataTransfers = [];
  page.on("pageerror", error => errors.push(String(error)));
  page.on("request", request => {
    if (!["GET", "HEAD"].includes(request.method())) dataTransfers.push(request.url());
  });
  try {
    await page.goto(`${url}/lab/brownian-data/`);
    const lab = page.locator(labSelector);
    await page.locator(`${labSelector}[data-ready="true"]`).waitFor();
    const apply = lab.getByRole("button", { name: "Apply observations and assumptions", exact: true });
    await lab.getByLabel("Or paste CSV text", { exact: true }).fill(csv);
    await lab.getByLabel("Time unit", { exact: true }).selectOption("s");
    await lab.getByLabel("Position unit", { exact: true }).selectOption("um");
    await apply.click();
    await lab.locator('[data-accepted-run="1"]').waitFor();
    assert.equal(await lab.locator('[data-accepted-run="1"]').getAttribute("data-result-status"), "unavailable");
    assert.equal(await lab.locator("table.inference-summary").count(), 0);
    assert.equal(await lab.locator(".trajectory-inspection tbody tr").count(), 3);
    check("unknown observation assumptions allow inspection but produce no fabricated estimate");

    await lab.getByLabel("I am explicitly assuming independent, isotropic Gaussian increments.", { exact: true }).check();
    await lab.locator('input[name="localizationNanometres"]').fill("0");
    await lab.locator('input[name="exposureMilliseconds"]').fill("0");
    await lab.getByLabel("Were observations selected, censored or motion-filtered?", { exact: true }).selectOption("no");
    await lab.getByLabel("Estimator", { exact: true }).selectOption("independent-increment-known-zero-drift");
    await apply.click();
    await lab.locator('[data-accepted-run="2"]').waitFor();
    const result = lab.locator('[data-accepted-run="2"]');
    assert.equal(await result.getAttribute("data-result-status"), "analyzed");
    assert.match(await result.getByRole("row", { name: /^Diffusion estimate / }).innerText(), /1\.87500e-12/);
    assert.equal(await result.locator('[data-semantic-kind="consistency-check"]').count(), 0);
    check("the real host estimates the declared 2D arithmetic fixture in canonical SI");

    await lab.getByLabel("Or paste CSV text", { exact: true }).fill("time,x\n0,0\n0,1");
    const report = JSON.parse(await downloadText(page, "Download accepted analysis and observations (JSON)"));
    assert.equal(report.trajectory.points.length, 3);
    assert.equal(report.trajectory.points[2].time, 2);
    assert.ok(Math.abs(report.result.estimate.dHat - 1.875e-12) < 1e-25);
    assert.equal(report.result.molecular, null);
    assert.equal(report.sourceKind, "user-supplied-not-independently-verified");
    assert.equal(report.assumptions.estimator, "independent-increment-known-zero-drift");
    await apply.click();
    await lab.getByRole("alert").waitFor();
    assert.equal(await lab.getAttribute("data-snapshot-version"), "2");
    assert.match(await lab.getByRole("alert").innerText(), /strictly increase/);
    check("download and refused edits retain accepted observations, parameters and results together");

    const rows = ["track,time,x,y"];
    for (let i = 0; i < 53; i++) rows.push(`A,${i},${i},${2 * i}`, `B,${i},${100 + i},${200 + i}`);
    await lab.getByLabel("Local CSV file (maximum 256 KiB)", { exact: true }).setInputFiles({
      name: "trajectory-arithmetic-fixture.csv", mimeType: "text/csv", buffer: Buffer.from(rows.join("\n")),
    });
    await lab.getByText("File loaded into the draft only.", { exact: false }).waitFor();
    await lab.getByLabel("For multiple tracks, I am assuming the same drift and diffusion coefficient for all particles.", { exact: true }).check();
    await apply.click();
    await lab.locator('[data-accepted-run="3"]').waitFor();
    const inspector = lab.locator(".trajectory-inspection");
    assert.equal(await inspector.locator("tbody tr").count(), 25);
    assert.equal(await inspector.locator("circle").count(), 25);
    await inspector.getByRole("button", { name: "Next positions", exact: true }).click();
    assert.match(await inspector.getByRole("status").innerText(), /positions 26–50 of 53/);
    await inspector.getByRole("button", { name: "Next positions", exact: true }).click();
    assert.equal(await inspector.locator("tbody tr").count(), 3);
    assert.equal(await inspector.locator("circle").count(), 3);
    await inspector.getByLabel("Track to inspect", { exact: true }).selectOption("B");
    await inspector.getByLabel("Coordinate to plot", { exact: true }).selectOption("1");
    assert.match(await inspector.getByRole("status").innerText(), /Track B: positions 1–25/);
    assert.equal(await lab.getAttribute("data-snapshot-version"), "3");
    const si = await downloadText(page, "Download accepted SI observations (CSV)");
    assert.equal(si.trim().split("\r\n").length, 107);
    assert.equal(si.split("\r\n")[0], "track_id,time_s,x_m,y_m");
    check("all track positions remain inspectable and exportable without selecting or resampling inference data");

    await lab.getByLabel("Local CSV file (maximum 256 KiB)", { exact: true }).setInputFiles({
      name: "invalid-utf8.csv", mimeType: "text/csv", buffer: Buffer.from([0xc3, 0x28]),
    });
    await lab.getByRole("alert").waitFor();
    assert.equal(await lab.getAttribute("data-snapshot-version"), "3");
    assert.match(await lab.getByRole("alert").innerText(), /could not be read/);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: "artifacts/browser/trajectory-accepted-320.png", fullPage: true });
    assert.deepEqual(dataTransfers, []);
    assert.deepEqual(errors, []);
    check("invalid UTF-8 preserves accepted data; the 320px reduced-motion route sends no data requests");

    await lab.getByRole("button", { name: "Clear imported data", exact: true }).click();
    assert.equal(await lab.getAttribute("data-snapshot-version"), "0");
    assert.equal(await lab.locator("[data-accepted-run]").count(), 0);
    assert.equal(await lab.getByLabel("Or paste CSV text", { exact: true }).inputValue(), "");
    check("clear removes the imported recording and accepted result from the page");
  } catch (error) {
    try { await page.screenshot({ path: "artifacts/browser/trajectory-failure.png", fullPage: true }); }
    catch { /* Preserve the original acceptance failure even if capture fails. */ }
    throw error;
  } finally {
    await context.close();
  }
}
