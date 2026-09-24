import assert from "node:assert/strict";
import AxeBuilder from "@axe-core/playwright";

/** Exercises the real built application and its dedicated workers, not a fixture UI. */
export async function checkTracerBrowser(browser, url, check) {
  const noJs = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 900 },
  });
  const staticPage = await noJs.newPage();
  await staticPage.goto(`${url}/lab/bm-01/`);
  assert.equal(await staticPage.locator(".tracer-path").count(), 24);
  assert.ok(
    (
      await staticPage
        .locator("svg .axis")
        .evaluateAll((nodes) => nodes.map((n) => getComputedStyle(n).fill))
    ).every((fill) => fill === "none"),
  );
  assert.match(
    await staticPage.locator('[data-output="diffusionCoefficient"]').innerText(),
    /0\.42944/,
  );
  assert.ok(
    await staticPage
      .getByRole("button", { name: "Apply trial settings", exact: true })
      .isDisabled(),
  );
  assert.ok((await staticPage.locator("math").count()) >= 2);
  assert.ok(
    await staticPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
  );
  await staticPage.screenshot({ path: "artifacts/browser/tracers-no-js-320.png", fullPage: true });
  check("BM-01: seeded paths, statistics and mathematics readable without JavaScript at 320px");
  await noJs.close();

  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  let workers = 0;
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("worker", () => workers++);
  try {
    await page.goto(`${url}/lab/bm-01/`);
    const lab = page.locator('[data-instrument-id="bm-01"]').first();
    const apply = lab.getByRole("button", { name: "Apply trial settings", exact: true });
    await page.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled);
    assert.equal(workers, 0);
    assert.deepEqual(errors, []);
    check("BM-01: hydration creates no worker and preserves the prepared trial");
    // Since ad178896 the trial form sits in the closed "Experiment settings" drawer.
    await lab.locator("details.experiment-settings > summary").click();
    async function accepted(action, target = lab) {
      const before = Number(await target.getAttribute("data-snapshot-version"));
      const id = await target.getAttribute("data-instance-id");
      await action();
      await page.waitForFunction(
        ({ id, before }) => {
          const node = [...document.querySelectorAll('[data-instrument-id="bm-01"]')].find(
            (n) => n.dataset.instanceId === id,
          );
          return node?.dataset.pending === "false" && Number(node.dataset.snapshotVersion) > before;
        },
        { id, before },
        { timeout: 15000 },
      );
    }
    await lab.locator('[name="M"]').fill("40");
    await lab.locator('[name="H"]').fill("4");
    await lab.locator('[name="seed"]').fill("9007199254740993");
    await accepted(() => apply.click());
    assert.equal(workers, 1);
    assert.match(await lab.locator(".accepted-caption").innerText(), /9007199254740993/);
    const run = await lab.getAttribute("data-run-id"),
      draws = await lab.getAttribute("data-recording-draws");
    const originalPath = await lab.locator(".tracer-path").first().getAttribute("d");
    const originalMean = await lab.locator('[data-output="sampleMean"]').innerText();
    const versions = await lab
      .locator("[data-snapshot-version]")
      .evaluateAll((nodes) => nodes.map((n) => n.dataset.snapshotVersion));
    assert.ok(versions.every((v) => v === versions[0]));
    check("BM-01: a real browser worker publishes one snapshot with all 64 seed bits intact");

    await accepted(() =>
      lab.getByRole("button", { name: "Observe at 4 seconds", exact: true }).click(),
    );
    assert.equal(await lab.getAttribute("data-run-id"), run);
    assert.equal(await lab.getAttribute("data-recording-draws"), draws);
    assert.equal(await lab.getAttribute("data-recording-reused"), "1");
    assert.notEqual(await lab.locator(".tracer-path").first().getAttribute("d"), originalPath);
    await lab.locator('[name="d"]').selectOption("3");
    await lab.locator('[name="axis"]').selectOption("2");
    await lab.locator('[name="statistic"]').selectOption("apparent");
    await accepted(() => apply.click());
    assert.equal(await lab.getAttribute("data-run-id"), run);
    assert.equal(await lab.getAttribute("data-recording-draws"), draws);
    await lab.locator('[name="d"]').selectOption("1");
    await lab.locator('[name="axis"]').selectOption("0");
    await lab.locator('[name="interval"]').fill("1");
    await accepted(() => apply.click());
    assert.equal(await lab.locator(".tracer-path").first().getAttribute("d"), originalPath);
    assert.equal(await lab.locator('[data-output="sampleMean"]').innerText(), originalMean);
    check("BM-01: observation, axis, dimension and statistic changes reuse exactly the same trial");

    const zoomVersion = await lab.getAttribute("data-snapshot-version");
    await lab.getByRole("button", { name: "Toggle view magnification", exact: true }).click();
    assert.equal(await lab.getAttribute("data-snapshot-version"), zoomVersion);
    assert.equal(await lab.getAttribute("data-recording-draws"), draws);
    assert.equal(await lab.locator('[data-output="sampleMean"]').innerText(), originalMean);
    check("BM-01: viewport magnification changes no scientific result or random draw");

    await lab.locator('[name="interval"]').fill("0.015");
    await apply.click();
    // The refusal surfaces twice by design: the execution-currency chrome marks the
    // accepted readouts stale, and the notice explains it. Naming each surface is
    // stronger than an attribute selector that matched either one and, under
    // Playwright strict mode, neither.
    await lab.locator('.notice[data-refusal-code="off-replay-grid"]').waitFor();
    await lab
      .locator('[data-currency-state="refused"][data-refusal-code="off-replay-grid"]')
      .waitFor();
    assert.equal(await lab.getAttribute("data-snapshot-version"), zoomVersion);
    assert.equal(await lab.locator('[data-output="sampleMean"]').innerText(), originalMean);
    await accepted(() =>
      lab
        .getByRole("button", { name: "Observe the recorded time 0.02 seconds.", exact: true })
        .click(),
    );
    assert.equal(await lab.getAttribute("data-run-id"), run);
    check(
      "BM-01: off-grid observation is refused without relabeling the accepted trial, and repair works",
    );

    await lab.locator('[name="interval"]').fill("0");
    await accepted(() => apply.click());
    assert.match(
      await lab.locator('[data-output="apparentSpeed"]').innerText(),
      /positive interval/,
    );
    await lab.getByText("Sampling bands under the model", { exact: true }).click();
    assert.match(await lab.innerText(), /At the starting point, the spread is zero/);
    await lab.locator('[name="M"]').fill("1");
    await accepted(() => apply.click());
    assert.match(await lab.innerText(), /Use more than one tracer/);
    check("BM-01: zero-time and single-tracer limits have honest nonnumeric explanations");

    await lab.locator('[name="M"]').fill("40");
    await lab.locator('[name="interval"]').fill("1");
    await lab.locator('[name="seed"]').fill("9007199254740992");
    await accepted(() => apply.click());
    assert.notEqual(await lab.locator('[data-output="sampleMean"]').innerText(), originalMean);
    const acceptedSeed = await lab.locator(".accepted-caption").innerText();
    await lab.locator('[name="seed"]').fill("01");
    await apply.click();
    await lab.getByRole("alert").waitFor();
    assert.equal(await lab.locator(".accepted-caption").innerText(), acceptedSeed);
    // The tape's share control replaced "Share accepted trial" (38999). Its selectable field holds
    // the ?tape= link once the browser has encoded it; the seed travels inside the tape.
    const urlField = lab.getByTestId("selectable-url");
    await urlField.waitFor();
    let link = "";
    for (let i = 0; i < 100 && !link.includes("?tape="); i++) {
      link = await urlField.inputValue();
      if (!link.includes("?tape=")) await page.waitForTimeout(50);
    }
    assert.match(link, /\/lab\/bm-01\/\?tape=/);
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
    assert.equal(await shared.locator('[name="seed"]').inputValue(), "9007199254740992");
    assert.match(await shared.locator(".accepted-caption").innerText(), /seed 1905;/);
    assert.equal(sharedWorkers, 0);
    await shared.close();
    check(
      "BM-01: neighboring large seeds remain distinct and shared links use accepted settings without autoplay",
    );

    await page
      .getByRole("button", { name: "Open a second separate ensemble", exact: true })
      .click();
    const second = page.locator('[data-instrument-id="bm-01"]').nth(1);
    await second.locator("details.experiment-settings > summary").click();
    await second.locator('[name="M"]').fill("20");
    await second.locator('[name="H"]').fill("2");
    await second.locator('[name="seed"]').fill("42");
    const firstBefore = await lab.locator(".accepted-caption").innerText();
    await accepted(
      () => second.getByRole("button", { name: "Apply trial settings", exact: true }).click(),
      second,
    );
    assert.equal(workers, 2);
    assert.equal(await lab.locator(".accepted-caption").innerText(), firstBefore);
    assert.notEqual(
      await second.getAttribute("data-instance-id"),
      await lab.getAttribute("data-instance-id"),
    );
    await page
      .getByRole("button", { name: "Close the second tracer ensemble", exact: true })
      .click();
    check(
      "BM-01: separate instances own separate workers and cannot overwrite each other's trials",
    );

    const audit = await new AxeBuilder({ page })
      .include("#main")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      audit.violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => v.id),
      [],
    );
    check("BM-01: automated accessibility supplement", {
      violations: audit.violations.map((v) => v.id),
      manualScreenReaderReview: "not performed",
    });
    await page.setViewportSize({ width: 320, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: "artifacts/browser/tracers-320.png", fullPage: true });
    assert.deepEqual(errors, []);
    check("BM-01: interactive 320px reflow and no uncaught browser errors");
  } catch (error) {
    await page.screenshot({ path: "artifacts/browser/tracers-failure.png", fullPage: true });
    console.error("Tracer browser errors:", errors);
    throw error;
  } finally {
    await context.close();
  }
}
