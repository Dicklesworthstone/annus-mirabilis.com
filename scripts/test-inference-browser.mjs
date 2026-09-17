import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
export async function checkInferenceBrowser(browser, url, check) {
  const route = "/lab/bm-07/";
  const staticContext = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 900 },
  });
  try {
    const page = await staticContext.newPage();
    await page.goto(url + route);
    const lab = page.locator('[data-instrument-id="bm-07"]');
    assert.equal(
      await lab
        .locator('[data-output="avogadroNumberEstimate"]')
        .getAttribute("data-result-status"),
      "underdetermined",
    );
    assert.ok(
      Number(
        await lab
          .locator('[data-output="diffusionCoefficientEstimate"]')
          .getAttribute("data-value"),
      ) > 0,
    );
    assert.ok((await page.locator("#inference-argument math").count()) >= 3);
    await lab.getByText("Read all compatible pairs", { exact: true }).click();
    assert.equal(await lab.locator(".inference-family tbody tr").count(), 41);
    await lab.getByText("Inspect the accepted observations", { exact: true }).click();
    assert.equal(
      await lab
        .getByRole("table", {
          name: "All selected synthetic positions and increments; μm and seconds",
          exact: true,
        })
        .locator("tbody tr")
        .count(),
      51,
    );
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await lab
      .locator(".inference-family")
      .screenshot({ path: "artifacts/browser/inference-no-js-320.png" });
    check(
      "BM-07: no-JavaScript reading retains the calculated family, all observations, derivation and MathML",
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
  const identity = async (lab) =>
    lab.evaluate((el) => ({
      run: el.dataset.runId,
      version: el.dataset.snapshotVersion,
      draws: el.dataset.recordingDraws,
      request: el.dataset.requestDraws,
    }));
  const value = (lab, id) => lab.locator(`[data-output="${id}"]`).first();
  const scalar = async (lab, id) => Number(await value(lab, id).getAttribute("data-value"));
  const bounds = async (lab, id) => [
    Number(await value(lab, id).getAttribute("data-lower")),
    Number(await value(lab, id).getAttribute("data-upper")),
  ];
  const paths = async (lab) =>
    lab
      .locator("[data-coordinate]")
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("points")));
  async function action(lab, fn) {
    const version = await lab.getAttribute("data-snapshot-version");
    await fn();
    await page.waitForFunction(
      ({ instance, version }) => {
        const el = [...document.querySelectorAll('[data-instrument-id="bm-07"]')].find(
          (e) => e.dataset.instanceId === instance,
        );
        return el && el.dataset.snapshotVersion !== version && el.dataset.pending === "false";
      },
      { instance: await lab.getAttribute("data-instance-id"), version },
    );
  }
  const apply = async (lab) =>
    action(lab, () =>
      lab.getByRole("button", { name: "Apply inference settings", exact: true }).click(),
    );
  try {
    await page.goto(url + route);
    const lab = page.locator('[data-instrument-id="bm-07"]').first();
    await page.waitForFunction(
      () => !document.querySelector('[data-instrument-id="bm-07"] button[type="submit"]').disabled,
    );
    assert.equal(workers, 0);
    assert.match(await lab.locator(".badge").innerText(), /Static worked example/);
    const initialPaths = await paths(lab);
    await apply(lab);
    assert.equal(workers, 1);
    assert.deepEqual(await paths(lab), initialPaths);
    assert.equal(await scalar(lab, "degreesOfFreedom"), 100);
    const first = await identity(lab);
    assert.equal(first.draws, "16385");
    assert.match(await lab.locator(".badge").innerText(), /Synthetic recovery/);
    check(
      "BM-07: hydration starts no worker; explicit apply reproduces the prepared seeded data with one real owner",
    );

    await action(lab, () =>
      lab.getByRole("button", { name: "Use declared generator conditions", exact: true }).click(),
    );
    const n = await scalar(lab, "avogadroNumberEstimate"),
      ci = await bounds(lab, "molecularInterval");
    assert.ok(n > 0 && ci[0] < ci[1]);
    await lab.locator('input[name="a"]').fill("7");
    assert.equal(await scalar(lab, "avogadroNumberEstimate"), n);
    await action(lab, () =>
      lab.getByRole("button", { name: "Assume twice the radius · same data", exact: true }).click(),
    );
    assert.equal(await scalar(lab, "avogadroNumberEstimate"), n / 2);
    assert.deepEqual(await paths(lab), initialPaths);
    assert.equal((await identity(lab)).run, first.run);
    assert.equal((await identity(lab)).request, "0");
    await action(lab, () =>
      lab.getByRole("button", { name: "Return to the unidentified family", exact: true }).click(),
    );
    assert.equal(
      await value(lab, "avogadroNumberEstimate").getAttribute("data-result-status"),
      "underdetermined",
    );
    check(
      "BM-07: declaring and changing radius changes inference, not observations, run identity or random draws",
    );

    await action(lab, () =>
      lab.getByRole("button", { name: "Use declared generator conditions", exact: true }).click(),
    );
    await lab.locator('[name="M"]').fill("20");
    await lab.locator('[name="d"]').selectOption("1");
    await lab.locator('[name="dt"]').fill("2");
    await apply(lab);
    assert.equal(await lab.locator("[data-coordinate]").count(), 1);
    assert.equal(await scalar(lab, "degreesOfFreedom"), 20);
    await lab.locator('[name="M"]').fill("50");
    await lab.locator('[name="d"]').selectOption("2");
    await lab.locator('[name="dt"]').fill("1");
    await apply(lab);
    assert.deepEqual(await paths(lab), initialPaths);
    assert.equal((await identity(lab)).request, "0");
    assert.equal((await identity(lab)).run, first.run);
    check(
      "BM-07: sample count, coordinate dimension and observation spacing remeasure one fixed path and return exactly",
    );

    await lab.locator('[name="estimator"]').selectOption("drift-centered");
    await apply(lab);
    const centered = await bounds(lab, "diffusionInterval");
    assert.equal(await scalar(lab, "degreesOfFreedom"), 98);
    await lab.locator('[name="estimator"]').selectOption("maximum-likelihood-centered");
    await apply(lab);
    assert.deepEqual(await bounds(lab, "diffusionInterval"), centered);
    assert.equal(await scalar(lab, "diffusionBiasFactor"), 0.98);
    await lab.locator('[name="M"]').fill("1");
    await apply(lab);
    assert.equal(
      await value(lab, "diffusionCoefficientEstimate").getAttribute("data-result-status"),
      "underdetermined",
    );
    assert.ok(
      await lab
        .getByRole("button", { name: "Run 100 hypothetical experiments", exact: true })
        .isDisabled(),
    );
    await lab.locator('[name="estimator"]').selectOption("independent-increment-known-zero-drift");
    await apply(lab);
    assert.equal(
      await value(lab, "inverseBiasFactor").getAttribute("data-result-status"),
      "not-applicable",
    );
    await lab.locator('[name="M"]').fill("50");
    await apply(lab);
    check(
      "BM-07: fitted-drift estimators use the right degrees of freedom and rescaling, with honest small-sample limits",
    );

    const prior = await identity(lab);
    await lab.locator('[name="dt"]').fill(".3");
    await lab.getByRole("button", { name: "Apply inference settings", exact: true }).click();
    const repair = lab.getByRole("button", {
      name: "Use the nearest available interval on the quarter-second recording grid.",
      exact: true,
    });
    await repair.waitFor();
    assert.deepEqual(await identity(lab), prior);
    await action(lab, () => repair.click());
    assert.equal(await lab.locator('[name="dt"]').inputValue(), "0.25");
    const repaired = await identity(lab);
    await lab.locator('[name="M"]').fill("1000");
    await lab.locator('[name="dt"]').fill("2");
    await lab.getByRole("button", { name: "Apply inference settings", exact: true }).click();
    await lab.getByRole("button", { name: "Restore accepted settings", exact: true }).waitFor();
    assert.deepEqual(await identity(lab), repaired);
    await action(lab, () =>
      lab.getByRole("button", { name: "Restore accepted settings", exact: true }).click(),
    );
    await lab.locator('[name="dt"]').fill("1");
    await apply(lab);
    assert.deepEqual(await paths(lab), initialPaths);
    check(
      "BM-07: invalid observation windows preserve accepted data and the offered repair works without truncating the sample",
    );

    const conditional = await bounds(lab, "molecularInterval");
    await lab.locator('[name="intervalKind"]').selectOption("combined");
    await apply(lab);
    const combined = await bounds(lab, "molecularInterval");
    assert.ok(combined[0] < conditional[0] && combined[1] > conditional[1]);
    assert.deepEqual(await bounds(lab, "conditionalInterval"), conditional);
    assert.ok(
      await lab
        .getByRole("button", { name: "Run 100 hypothetical experiments", exact: true })
        .isDisabled(),
    );
    await lab.getByText("Declare input uncertainty", { exact: true }).click();
    await lab.locator('[name="inputCoverage"]').fill("0");
    await apply(lab);
    assert.equal(
      await value(lab, "molecularInterval").getAttribute("data-result-status"),
      "not-applicable",
    );
    assert.ok((await scalar(lab, "avogadroNumberEstimate")) > 0);
    await lab.locator('[name="inputCoverage"]').fill("99");
    await lab.locator('[name="intervalKind"]').selectOption("conditional");
    await apply(lab);
    check(
      "BM-07: combined uncertainty widens the conditional result; missing coverage never earns a confidence guarantee",
    );

    await action(lab, () =>
      lab.getByRole("button", { name: "Run 100 hypothetical experiments", exact: true }).click(),
    );
    const dc = await scalar(lab, "diffusionCoveringCount");
    assert.equal(dc, await scalar(lab, "molecularCoveringCount"));
    assert.equal(await lab.locator('[data-coverage-kind="diffusion"] circle').count(), 100);
    assert.equal(await lab.getAttribute("data-coverage-draws"), "80100");
    assert.deepEqual(await paths(lab), initialPaths);
    const diffusionIntervals = await lab
      .locator('[data-coverage-kind="diffusion"] svg')
      .innerHTML();
    await action(lab, () =>
      lab.getByRole("button", { name: "Assume twice the radius · same data", exact: true }).click(),
    );
    assert.equal(
      await lab.locator('[data-coverage-kind="diffusion"] svg').innerHTML(),
      diffusionIntervals,
    );
    assert.ok((await scalar(lab, "molecularCoveringCount")) < dc);
    assert.deepEqual(await paths(lab), initialPaths);
    await lab
      .locator(".inference-coverage-grid")
      .screenshot({ path: "artifacts/browser/inference-coverage-desktop.png" });
    check(
      "BM-07: all 100 hypothetical intervals are retained; a wrong radius changes molecular coverage without changing the original path",
    );

    const beforeReveal = await identity(lab);
    await lab.getByRole("button", { name: "Reveal generating values", exact: true }).click();
    assert.ok((await scalar(lab, "generatorMolecularNumber")) >= 3e23);
    assert.deepEqual(await identity(lab), beforeReveal);
    assert.equal(workers, 1);
    const downloadEvent = page.waitForEvent("download");
    await lab.getByRole("button", { name: "Download accepted observations", exact: true }).click();
    const download = await downloadEvent;
    await download.saveAs("artifacts/browser/inference-observations.csv");
    const csv = await readFile("artifacts/browser/inference-observations.csv", "utf8");
    assert.equal(csv.trim().split("\n").length, 53);
    assert.match(csv, /synthetic-observations/);
    assert.ok(!csv.includes(String(await scalar(lab, "generatorMolecularNumber"))));
    check(
      "BM-07: revealing the hidden answer and exporting every SI observation make no numerical request",
    );

    await lab.getByText("Change the synthetic generator", { exact: true }).click();
    await lab.locator('[name="seed"]').fill("9007199254740993");
    await apply(lab);
    assert.equal(await lab.locator("[data-hidden-answer]").count(), 0);
    assert.notEqual((await identity(lab)).run, first.run);
    const largeSeedPaths = await paths(lab);
    await lab.locator('[name="seed"]').fill("bad");
    await lab.getByRole("button", { name: "Copy accepted inference link", exact: true }).click();
    const link = await lab.getByLabel("Accepted inference link", { exact: true }).inputValue();
    assert.equal(new URL(link).searchParams.get("seed"), "9007199254740993");
    assert.equal(new URL(link).searchParams.get("coverageTrials"), "0");
    const shared = await context.newPage();
    let sharedWorkers = 0;
    shared.on("worker", () => sharedWorkers++);
    await shared.goto(link);
    await shared.getByText(/Shared settings are loaded as a draft/).waitFor();
    assert.equal(sharedWorkers, 0);
    assert.equal(
      await shared.locator('[data-instrument-id="bm-07"]').getAttribute("data-radius-known"),
      "false",
    );
    await shared.close();
    await lab.locator('[name="seed"]').fill("9007199254740992");
    await apply(lab);
    assert.notDeepEqual(await paths(lab), largeSeedPaths);
    check(
      "BM-07: neighboring full-u64 seeds stay distinct and accepted-settings links never auto-run or copy invalid drafts",
    );

    const primary = await identity(lab);
    await page
      .getByRole("button", { name: "Open a second independent inference laboratory", exact: true })
      .click();
    const second = page.locator('[data-instrument-id="bm-07"]').nth(1);
    await action(second, () =>
      second
        .getByRole("button", { name: "Use declared generator conditions", exact: true })
        .click(),
    );
    assert.equal(workers, 2);
    assert.deepEqual(await identity(lab), primary);
    assert.notEqual(
      await second.getAttribute("data-instance-id"),
      await lab.getAttribute("data-instance-id"),
    );
    await page
      .getByRole("button", { name: "Close second inference laboratory", exact: true })
      .click();
    check(
      "BM-07: independent placements own separate workers, settings and accepted inference snapshots",
    );

    await lab.locator(".inference-controls details[open]").evaluateAll((nodes) => {
      for (const n of nodes) n.removeAttribute("open");
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
    await page.setViewportSize({ width: 320, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await lab
      .locator(".inference-family")
      .screenshot({ path: "artifacts/browser/inference-interactive-320.png" });
    await page.setViewportSize({ width: 1280, height: 950 });
    await lab
      .locator(".lab-columns")
      .screenshot({ path: "artifacts/browser/inference-desktop.png" });
    await page.emulateMedia({ media: "print" });
    assert.ok(await lab.locator(".inference-family").isVisible());
    assert.ok(!(await lab.locator("form").isVisible()));
    await page.emulateMedia({ media: "screen" });
    assert.deepEqual(errors, []);
    check("BM-07: interactive 320px reflow, print reading and automated accessibility", {
      violations: audit.violations.map((v) => v.id),
      manualScreenReaderReview: "not performed",
    });

    await page.goto(`${url}/papers/brownian-motion/#arg-bm-inference`);
    await page.locator('[data-reader-root][data-enhanced="true"]').waitFor();
    const passage = page.locator("#arg-bm-inference");
    assert.equal(
      await passage
        .getByRole("link", { name: "Try it: Molecular-number inference", exact: true })
        .getAttribute("href"),
      route,
    );
    await passage.getByRole("link", { name: /^Why\?:/u }).click();
    const dialog = page.locator("dialog[open]");
    await dialog.waitFor();
    assert.equal(await dialog.getAttribute("aria-labelledby"), "clarification-error-and-inference");
    await page.keyboard.press("Escape");
    await page.locator("[data-clarification-dialog]").waitFor({ state: "hidden" });
    const whyId = await passage.getByRole("link", { name: /^Why\?:/u }).getAttribute("id");
    await page.waitForFunction((id) => document.activeElement?.id === id, whyId);
    check(
      "BM-07: the paper links to the instrument and opens a returnable uncertainty-and-inference foundation",
    );
  } catch (error) {
    await writeFile(
      "artifacts/browser/inference-failure.json",
      JSON.stringify(
        { url: page.url(), errors, body: await page.locator("body").innerText() },
        null,
        2,
      ),
    );
    await page.screenshot({ path: "artifacts/browser/inference-failure.png", fullPage: true });
    throw error;
  } finally {
    await context.close();
  }
}
