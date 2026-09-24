import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
export async function checkCameraBrowser(browser, url, check) {
  const route = "/lab/bm-08/";
  const staticContext = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 900 },
  });
  try {
    const page = await staticContext.newPage();
    await page.goto(url + route);
    const lab = page.locator('[data-instrument-id="bm-08"]');
    assert.equal(
      await lab.locator('[data-output="naiveInterval"]').getAttribute("data-result-status"),
      "not-applicable",
    );
    assert.ok(
      Number(await lab.locator('[data-output="pairInterval"]').getAttribute("data-upper")) > 0,
    );
    assert.ok((await page.locator("#camera-model math").count()) >= 5);
    await lab.getByText("Read all accepted frame positions", { exact: true }).click();
    assert.equal(await lab.locator("[data-camera-frames] tbody tr").count(), 202);
    assert.ok(
      await lab.getByRole("button", { name: "Apply camera settings", exact: true }).isDisabled(),
    );
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: "artifacts/browser/camera-no-js-320.png", fullPage: true });
    check(
      "BM-08: camera observations, admitted intervals, complete tables and equations remain readable without JavaScript",
    );
  } finally {
    await staticContext.close();
  }
  const context = await browser.newContext({ viewport: { width: 1280, height: 950 } }),
    page = await context.newPage();
  let workers = 0;
  const errors = [];
  page.on("worker", () => workers++);
  page.on("pageerror", (e) => errors.push(String(e)));
  const value = (lab, id) => lab.locator(`[data-output="${id}"]`).first();
  const number = async (lab, id) => Number(await value(lab, id).getAttribute("data-value"));
  const rows = async (lab) =>
    lab
      .locator("[data-camera-frames] tbody tr")
      .evaluateAll((nodes) => nodes.map((n) => [...n.children].map((c) => c.textContent)));
  const identity = async (lab) =>
    lab.evaluate((el) => ({
      run: el.dataset.runId,
      version: el.dataset.snapshotVersion,
      witness: el.dataset.latentWitness,
      draws: el.dataset.recordingDraws,
    }));
  async function action(lab, fn) {
    const version = await lab.getAttribute("data-snapshot-version"),
      instance = await lab.getAttribute("data-instance-id");
    await fn();
    await page.waitForFunction(
      ({ instance, version }) => {
        const el = [...document.querySelectorAll('[data-instrument-id="bm-08"]')].find(
          (e) => e.dataset.instanceId === instance,
        );
        return el && el.dataset.snapshotVersion !== version && el.dataset.pending === "false";
      },
      { instance, version },
      { timeout: 60000 },
    );
  }
  const apply = (lab) =>
    action(lab, () =>
      lab.getByRole("button", { name: "Apply camera settings", exact: true }).click(),
    );
  const preset = (lab, name) =>
    action(lab, () => lab.getByRole("button", { name, exact: true }).click());
  try {
    await page.goto(url + route);
    const lab = page.locator('[data-instrument-id="bm-08"]').first();
    await page.waitForFunction(
      () => !document.querySelector('[data-instrument-id="bm-08"] button[type="submit"]').disabled,
    );
    assert.equal(workers, 0);
    assert.match(await lab.locator(".badge").innerText(), /Static worked example/);
    const staticRows = await rows(lab);
    await apply(lab);
    assert.equal(workers, 1);
    assert.deepEqual(await rows(lab), staticRows);
    const initial = await identity(lab);
    assert.equal(initial.draws, "32896");
    assert.equal(await number(lab, "pairDegrees"), 98);
    assert.ok(
      (
        await lab
          .locator("[data-snapshot-version]")
          .evaluateAll((nodes) => nodes.map((n) => n.dataset.snapshotVersion))
      ).every((v) => v === initial.version),
    );
    check(
      "BM-08: explicit apply starts one real worker and publishes coherent frame, plot and interval snapshots",
    );

    await preset(lab, "No camera error · same path");
    const idealRows = await rows(lab),
      idealCentered = await number(lab, "centeredD");
    assert.ok(idealRows.every((r) => r[2] === r[3] && r[3] === r[4]));
    assert.equal(await value(lab, "naiveInterval").getAttribute("data-result-status"), null);
    assert.equal(
      await value(lab, "speedCrossover").getAttribute("data-result-status"),
      "not-applicable",
    );
    await preset(lab, "Noise only · same path");
    assert.ok((await number(lab, "expectedCovariance")) < 0);
    assert.notDeepEqual(await rows(lab), idealRows);
    assert.equal(
      await value(lab, "naiveInterval").getAttribute("data-result-status"),
      "not-applicable",
    );
    await preset(lab, "Exposure only · same path");
    assert.ok((await number(lab, "expectedCovariance")) > 0);
    assert.ok((await rows(lab)).some((r) => r[2] !== r[3]));
    const changed = await identity(lab);
    assert.equal(changed.run, initial.run);
    assert.equal(changed.witness, initial.witness);
    assert.equal(changed.draws, initial.draws);
    assert.equal(await lab.getAttribute("data-request-draws"), "0");
    check(
      "BM-08: noise and exposure alter observations and correlation without replacing the underlying path; zero camera error restores ideal positions",
    );

    await preset(lab, "No camera error · same path");
    await preset(lab, "Add stage drift · same path");
    assert.ok(Math.abs((await number(lab, "centeredD")) - idealCentered) < 1e-25);
    assert.ok((await number(lab, "naiveD")) > (await number(lab, "centeredD")));
    assert.equal(
      await value(lab, "naiveInterval").getAttribute("data-result-status"),
      "not-applicable",
    );
    assert.equal(await value(lab, "centeredInterval").getAttribute("data-result-status"), null);
    assert.equal((await identity(lab)).witness, initial.witness);
    check(
      "BM-08: fitting drift removes stage drift but does not silently admit the zero-drift procedure",
    );

    await preset(lab, "Noise only · same path");
    const cameraRows = await rows(lab),
      beforeInterval = await value(lab, "pairInterval").getAttribute("data-upper");
    await lab.locator('[name="noiseMethod"]').selectOption("known");
    await lab.locator('[name="coverage"]').fill("90");
    await apply(lab);
    assert.deepEqual(await rows(lab), cameraRows);
    assert.equal(await lab.getAttribute("data-measurement-draws"), "0");
    assert.equal(await lab.getAttribute("data-request-draws"), "0");
    assert.notEqual(await value(lab, "pairInterval").getAttribute("data-upper"), beforeInterval);
    check(
      "BM-08: changing noise knowledge or confidence level reuses observed frames without new stream evaluations",
    );

    const prior = await identity(lab);
    await lab.locator('[name="exposure"]').fill("0.3");
    await lab.getByRole("button", { name: "Apply camera settings", exact: true }).click();
    // The refusal surfaces twice by design: the execution-currency chrome marks the
    // accepted readouts stale, and the notice explains it. Naming each surface is
    // stronger than an attribute selector that matched either one and, under
    // Playwright strict mode, neither.
    await lab.locator('.notice[data-refusal-code="off-replay-grid"]').waitFor();
    await lab
      .locator('[data-currency-state="refused"][data-refusal-code="off-replay-grid"]')
      .waitFor();
    assert.deepEqual(await identity(lab), prior);
    await preset(lab, "Use the preceding recorded exposure");
    assert.equal(await lab.locator('[name="exposure"]').inputValue(), "0.25");
    const repaired = await identity(lab);
    await lab.locator('[name="M"]').fill("1000");
    await lab.locator('[name="dt"]').selectOption("4");
    await lab.getByRole("button", { name: "Apply camera settings", exact: true }).click();
    await lab.getByRole("button", { name: "Restore accepted settings", exact: true }).waitFor();
    assert.deepEqual(await identity(lab), repaired);
    await preset(lab, "Restore accepted settings");
    assert.equal(await lab.locator('[name="M"]').inputValue(), "100");
    check(
      "BM-08: off-grid and overlong observations preserve accepted results, with an executable exposure repair and no hidden truncation",
    );

    const primaryRows = await rows(lab),
      primary = await identity(lab);
    await preset(lab, "Run 100 camera experiments");
    assert.equal(await lab.locator("[data-coverage-table] tbody tr").count(), 100);
    assert.deepEqual(await rows(lab), primaryRows);
    assert.equal((await identity(lab)).run, primary.run);
    assert.equal((await identity(lab)).witness, primary.witness);
    assert.equal(await lab.getAttribute("data-measurement-draws"), "0");
    assert.ok(Number(await lab.getAttribute("data-coverage-draws")) > 0);
    const coverage = await lab
      .locator("[data-coverage-table] tbody tr")
      .evaluateAll((nodes) => nodes.map((n) => [...n.children].map((c) => c.textContent)));
    assert.equal(
      coverage.filter((r) => r[5] === "Yes").length,
      await number(lab, "coveragePairCount"),
    );
    assert.equal(
      coverage.filter((r) => r[3] === "Empty set").length,
      await number(lab, "coverageEmptyCount"),
    );
    await lab
      .locator(".camera-coverage-counts")
      .locator("..")
      .screenshot({ path: "artifacts/browser/camera-coverage-desktop.png" });
    check(
      "BM-08: all 100 repeated procedures and empty-set flags are retained while the primary observation stays unchanged",
    );

    const beforeExport = await identity(lab),
      event = page.waitForEvent("download");
    await lab.getByRole("button", { name: "Download accepted camera frames", exact: true }).click();
    const download = await event;
    await download.saveAs("artifacts/browser/camera-frames.csv");
    const csv = await readFile("artifacts/browser/camera-frames.csv", "utf8");
    assert.match(csv, /# Synthetic camera data; not historical or empirical observations/);
    assert.match(csv, /# source source:sha256:[a-f0-9]{64}/);
    assert.equal(
      csv
        .trim()
        .split("\n")
        .filter((l) => !l.startsWith("#")).length,
      203,
    );
    assert.deepEqual(await identity(lab), beforeExport);
    check(
      "BM-08: CSV exports every accepted SI coordinate with source and seed provenance without changing the experiment",
    );

    await lab.getByText("3 · Change the physical setup", { exact: true }).click();
    await lab.locator('[name="seed"]').fill("9007199254740993");
    await apply(lab);
    const big = await identity(lab);
    assert.notEqual(big.run, initial.run);
    assert.notEqual(big.witness, initial.witness);
    await lab.locator('[name="seed"]').fill("bad");
    // The tape's share control replaced the older share button (38999). Its selectable field holds
    // the ?tape= link once the browser has encoded it; settings travel inside the tape.
    const urlField = lab.getByTestId("selectable-url");
    await urlField.waitFor();
    let link = "";
    for (let i = 0; i < 100 && !link.includes("?tape="); i++) {
      link = await urlField.inputValue();
      if (!link.includes("?tape=")) await page.waitForTimeout(50);
    }
    assert.match(link, /\/lab\/bm-08\/\?tape=/);
    // The seed travels in the tape, and coverage experiments never do (workerLabDraftTapes.test.tsx).
    const shared = await context.newPage();
    let sharedWorkers = 0;
    shared.on("worker", () => sharedWorkers++);
    await shared.goto(link);
    await shared
      .getByText("The shared link's settings are in the form. Apply them to calculate.", {
        exact: false,
      })
      .first()
      .waitFor();
    assert.equal(await shared.locator('[name="seed"]').inputValue(), "9007199254740993");
    assert.equal(sharedWorkers, 0);
    assert.match(await shared.locator(".badge").innerText(), /Static worked example/);
    await shared.close();
    await lab.locator('[name="seed"]').fill("9007199254740992");
    await apply(lab);
    assert.notEqual((await identity(lab)).witness, big.witness);
    check(
      "BM-08: full-width neighboring seeds remain distinct; shared links use accepted settings without autoplay or coverage work",
    );

    const first = await identity(lab);
    await page
      .getByRole("button", { name: "Open a separate camera laboratory", exact: true })
      .click();
    const second = page.locator('[data-instrument-id="bm-08"]').nth(1);
    await preset(second, "Exposure only · same path");
    assert.equal(workers, 2);
    assert.deepEqual(await identity(lab), first);
    assert.notEqual(
      await second.getAttribute("data-instance-id"),
      await lab.getAttribute("data-instance-id"),
    );
    await page.getByRole("button", { name: "Close the second camera", exact: true }).click();
    check("BM-08: separate placements own independent workers, settings and camera snapshots");

    await lab.locator("details[open]").evaluateAll((nodes) => {
      nodes.forEach((n) => {
        n.removeAttribute("open");
      });
    });
    const audit = await new AxeBuilder({ page })
      .include("#main")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      audit.violations
        .filter((v) => ["serious", "critical"].includes(v.impact))
        .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      [],
    );
    await lab.locator(".lab-columns").screenshot({ path: "artifacts/browser/camera-desktop.png" });
    await page.setViewportSize({ width: 320, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await lab
      .locator(".lab-results")
      .screenshot({ path: "artifacts/browser/camera-interactive-320.png" });
    await lab.getByText("Read all accepted frame positions", { exact: true }).click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.emulateMedia({ media: "print" });
    assert.ok(!(await lab.locator("form").isVisible()));
    assert.ok(await lab.locator(".camera-intervals").isVisible());
    await page.emulateMedia({ media: "screen" });
    assert.deepEqual(errors, []);
    check("BM-08: 320px reflow, readable overflow tables, print and automated accessibility", {
      violations: audit.violations.map((v) => v.id),
      manualScreenReaderReview: "not performed",
    });
  } catch (error) {
    await writeFile(
      "artifacts/browser/camera-failure.json",
      JSON.stringify(
        { url: page.url(), errors, body: await page.locator("body").innerText() },
        null,
        2,
      ),
    );
    await page.screenshot({ path: "artifacts/browser/camera-failure.png", fullPage: true });
    throw error;
  } finally {
    await context.close();
  }
}
