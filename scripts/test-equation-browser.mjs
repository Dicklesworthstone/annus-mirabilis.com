import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";

/** Only real exported pages, rendered equation payloads and dedicated numerical owners. */
export async function checkEquationBrowser(browser, url, check) {
  const eqId = (name) => `eq-model-bm-${name}`;
  const card = (scope, name) => scope.locator(`[data-equation-id="${eqId(name)}"]`);
  const value = (scope, name, term) =>
    card(scope, name).locator(`[data-term-value="${eqId(name)}.t.${term}"]`);
  const staticContext = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 900 },
  });
  try {
    const page = await staticContext.newPage();
    await page.goto(`${url}/lab/bm-01/`);
    assert.equal(await page.locator("[data-equation-id]").count(), 3);
    assert.equal(await page.locator(".equation-mathml math").count(), 3);
    assert.ok(
      (
        await page
          .locator("[data-equation-values]")
          .evaluateAll((nodes) => nodes.map((n) => n.dataset.executionLabel))
      ).every((x) => x === "static"),
    );
    assert.match(await value(page, "rms", "diffusion").innerText(), /0\.42944/);
    assert.match(await value(page, "diffusivity", "viscosity").innerText(), /^1 mPa·s$/);
    const rms = card(page, "rms");
    await rms.getByText("Model assumptions and every term’s meaning", { exact: true }).click();
    assert.match(await rms.innerText(), /This is a unit check, not a proof/);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await rms.screenshot({ path: "artifacts/browser/equations-no-js-320.png" });
    check(
      "equations: three worked equations, meanings, accepted values and MathML remain readable without JavaScript",
    );
  } finally {
    await staticContext.close();
  }

  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } }),
    page = await context.newPage();
  const errors = [];
  let workers = 0;
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("worker", () => workers++);
  try {
    await page.goto(`${url}/lab/bm-01/`);
    const lab = page.locator('[data-instrument-id="bm-01"]').first();
    const rms = card(lab, "rms"),
      diffusion = card(lab, "diffusivity"),
      _speed = card(lab, "apparent-speed");
    const apply = lab.getByRole("button", { name: "Apply trial settings", exact: true });
    await page.waitForFunction(
      () => !document.querySelector('[data-instrument-id="bm-01"] button[type="submit"]').disabled,
    );
    await rms.getByRole("button", { name: "Why a square root? operation", exact: true }).waitFor();
    // Since ad178896 the trial form sits in the closed "Experiment settings" drawer.
    await lab.locator("details.experiment-settings > summary").click();
    assert.equal(workers, 0);
    assert.equal(await lab.getAttribute("data-execution-label"), "static");
    const identity = async (target) =>
      target.evaluate((el) => ({
        run: el.dataset.runId,
        version: el.dataset.snapshotVersion,
        draws: el.dataset.recordingDraws,
      }));
    const original = await identity(lab);
    const formula = rms.locator(".equation-formula");
    await formula.focus();
    await formula.press("Enter");
    assert.equal(await rms.getAttribute("data-selected-node-id"), `${eqId("rms")}.op.equality`);
    await formula.press("ArrowDown");
    assert.equal(await rms.getAttribute("data-selected-node-id"), `${eqId("rms")}.t.rms`);
    await formula.press("ArrowRight");
    assert.equal(await rms.getAttribute("data-selected-node-id"), `${eqId("rms")}.op.squareRoot`);
    assert.match(
      await rms.locator(".equation-inspector").innerText(),
      /positive square root has units of length/,
    );
    await formula.press("ArrowDown");
    assert.equal(await rms.getAttribute("data-selected-node-id"), `${eqId("rms")}.op.meanSquare`);
    await formula.press("ArrowUp");
    assert.equal(await rms.getAttribute("data-selected-node-id"), `${eqId("rms")}.op.squareRoot`);
    await formula.press("Escape");
    assert.equal(await rms.getAttribute("data-selected-node-id"), null);
    await formula.press("Tab");
    assert.notEqual(
      await page.evaluate(() => document.activeElement.className),
      "equation-formula",
    );
    assert.deepEqual(await identity(lab), original);
    assert.equal(workers, 0);
    check(
      "equations: keyboard traversal selects actual expression operations without creating or mutating a trial",
    );

    assert.ok(
      (
        await rms
          .locator(".equation-visual svg")
          .evaluateAll((nodes) => nodes.map((el) => getComputedStyle(el).pointerEvents))
      ).every((value) => value === "none"),
    );
    await rms.locator('.equation-visual [data-term="eq-model-bm-rms.t.diffusion"]').click();
    assert.equal(await rms.getAttribute("data-selected-node-id"), `${eqId("rms")}.t.diffusion`);
    await page.waitForFunction(
      () =>
        document.querySelector(
          '[data-equation-id="eq-model-bm-diffusivity"] .equation-visual [data-term="eq-model-bm-diffusivity.t.diffusion"]',
        ).dataset.selected === "true",
    );
    assert.equal(
      await lab
        .locator('[data-output="diffusionCoefficient"]')
        .evaluate((el) => getComputedStyle(el).outlineStyle),
      "solid",
    );
    await rms.getByRole("button", { name: "Patterns instead of colour", exact: true }).click();
    assert.equal(await rms.getAttribute("data-pattern"), "true");
    assert.ok(
      (
        await rms
          .locator(".equation-visual .am-role-result")
          .evaluateAll((nodes) => nodes.map((el) => getComputedStyle(el).textDecorationStyle))
      ).every((style) => style === "double"),
    );
    await diffusion.getByRole("button", { name: "Dynamic viscosity term", exact: true }).click();
    await diffusion
      .getByRole("button", { name: "Edit this input in the laboratory", exact: true })
      .click();
    assert.equal(await page.evaluate(() => document.activeElement.name), "eta");
    assert.deepEqual(await identity(lab), original);
    assert.equal(workers, 0);
    check(
      "equations: pointer inspection, shared quantity highlighting, monochrome patterns and input focus preserve accepted science",
    );

    async function accepted(action, target = lab) {
      const before = await identity(target),
        instance = await target.getAttribute("data-instance-id");
      await action();
      await page.waitForFunction(
        ({ instance, version }) => {
          const el = [...document.querySelectorAll('[data-instrument-id="bm-01"]')].find(
            (el) => el.dataset.instanceId === instance,
          );
          return (
            el?.dataset.pending === "false" && Number(el.dataset.snapshotVersion) > Number(version)
          );
        },
        { instance, version: before.version },
        { timeout: 15000 },
      );
    }
    await lab.locator('[name="M"]').fill("40");
    await lab.locator('[name="H"]').fill("4");
    await lab.locator('[name="eta"]').fill("2");
    assert.match(await value(lab, "diffusivity", "viscosity").innerText(), /^1 mPa·s$/);
    assert.match(await value(lab, "rms", "diffusion").innerText(), /0\.42944/);
    await accepted(() => apply.click());
    assert.equal(workers, 1);
    assert.match(await value(lab, "diffusivity", "viscosity").innerText(), /^2 mPa·s$/);
    assert.match(await value(lab, "rms", "diffusion").innerText(), /0\.21472/);
    assert.equal(await lab.getAttribute("data-execution-label"), "host");
    const acceptedIdentity = await identity(lab),
      instance = await lab.getAttribute("data-instance-id");
    for (const snapshot of await lab.locator("[data-equation-values]").evaluateAll((nodes) =>
      nodes.map((el) => ({
        run: el.dataset.runId,
        version: el.dataset.snapshotVersion,
        instance: el.dataset.instanceId,
        label: el.dataset.executionLabel,
      })),
    ))
      assert.deepEqual(snapshot, {
        run: acceptedIdentity.run,
        version: acceptedIdentity.version,
        instance,
        label: "host",
      });
    check(
      "equations: actual worker outputs update all equations with one accepted identity, never draft settings",
    );

    const oldRms = await value(lab, "rms", "rms").innerText();
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
    assert.equal(await value(lab, "rms", "rms").innerText(), oldRms);
    assert.deepEqual(await identity(lab), acceptedIdentity);
    assert.match(
      await rms.locator("[data-retained-state]").innerText(),
      /Previous accepted settings.*request refused/,
    );
    await accepted(() =>
      lab
        .getByRole("button", { name: "Observe the recorded time 0.02 seconds.", exact: true })
        .click(),
    );
    assert.equal((await identity(lab)).run, acceptedIdentity.run);
    await lab.locator('[name="interval"]').fill("0");
    await accepted(() => apply.click());
    assert.equal(
      await value(lab, "apparent-speed", "apparentSpeed").getAttribute("data-value-kind"),
      "status",
    );
    assert.match(
      await value(lab, "apparent-speed", "apparentSpeed").innerText(),
      /positive observation interval/,
    );
    assert.equal(await value(lab, "rms", "rms").innerText(), "0 μm");
    check(
      "equations: refused observations retain their original values and zero-time apparent speed stays explicitly undefined",
    );

    await lab.locator('[name="interval"]').fill("1");
    await lab.locator('[name="d"]').selectOption("3");
    await accepted(() => apply.click());
    assert.equal(await value(lab, "rms", "rms").innerText(), oldRms);
    const resultCell = await lab
      .locator('[data-output="sampleRms"] [data-quantity-id="rmsDisplacement1d"]')
      .innerText();
    assert.equal(await value(lab, "rms", "rms").innerText(), resultCell);
    const unchanged = await identity(lab);
    await page
      .getByRole("button", { name: "Open a second separate ensemble", exact: true })
      .click();
    const second = page.locator('[data-instrument-id="bm-01"]').nth(1);
    await card(second, "rms")
      .getByRole("button", { name: "Diffusion coefficient term", exact: true })
      .click();
    assert.equal(await rms.getAttribute("data-selected-node-id"), null);
    assert.match(await value(second, "rms", "diffusion").innerText(), /0\.42944/);
    assert.match(await value(lab, "rms", "diffusion").innerText(), /0\.21472/);
    assert.deepEqual(await identity(lab), unchanged);
    assert.equal(workers, 1);
    await page
      .getByRole("button", { name: "Close the second tracer ensemble", exact: true })
      .click();
    check(
      "equations: canonical coordinate RMS is not replaced by a vector or sample statistic, and separate placements stay isolated",
    );

    await rms.getByRole("button", { name: "Why a square root? operation", exact: true }).click();
    const audit = await new AxeBuilder({ page })
      .include('[data-instrument-id="bm-01"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      audit.violations.filter((v) => ["serious", "critical"].includes(v.impact)).map((v) => v.id),
      [],
    );
    await rms.screenshot({ path: "artifacts/browser/equations-desktop.png" });
    await page.setViewportSize({ width: 320, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await rms.screenshot({ path: "artifacts/browser/equations-interactive-320.png" });
    check(
      "equations: selected operations and live values remain accessible and reflow at 320 pixels",
      { violations: audit.violations.map((v) => v.id), manualScreenReaderReview: "not performed" },
    );

    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto(`${url}/papers/brownian-motion/?detail=1`);
    await page.locator('[data-reader-root][data-enhanced="true"]').waitFor();
    const passage = page.locator("#arg-bm-observable"),
      readerRms = card(passage, "rms");
    assert.match(await readerRms.locator("[data-equation-values]").innerText(), /Symbolic here/);
    const workersBefore = workers;
    await readerRms
      .getByRole("button", { name: "Why a square root? operation", exact: true })
      .click();
    const help = readerRms.locator(".equation-inspector [data-foundation]");
    await help.click();
    await page.locator("dialog[open]").waitFor();
    await page.waitForFunction(
      () => document.activeElement.id === "clarification-bridge-squaring-square-roots",
    );
    const triggerId = await help.getAttribute("id");
    assert.ok(triggerId);
    await page.keyboard.press("Escape");
    await page.locator("[data-clarification-dialog]").waitFor({ state: "hidden" });
    await page.waitForFunction((id) => document.activeElement.id === id, triggerId);
    assert.equal(
      await readerRms.getAttribute("data-selected-node-id"),
      `${eqId("rms")}.op.squareRoot`,
    );
    assert.equal(workers, workersBefore);
    assert.deepEqual(errors, []);
    check(
      "equations: operation prerequisites use the real return stack without assuming a live trial or losing the selected equation",
    );
  } catch (error) {
    await page
      .screenshot({ path: "artifacts/browser/equations-failure.png", fullPage: true })
      .catch(() => {});
    await writeFile(
      "artifacts/browser/equations-failure.json",
      JSON.stringify({ url: page.url(), errors, message: String(error) }, null, 2),
    );
    throw error;
  } finally {
    await context.close();
  }
}
