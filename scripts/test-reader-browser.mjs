import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import AxeBuilder from "@axe-core/playwright";

/** Real static-export navigation and worker preservation; no mocked physics. */
export async function checkReaderBrowser(browser, url, check) {
  const route = "/papers/brownian-motion/";
  const firstId = "arg-bm-observable";
  const source = await readFile(`out${route}index.html`);
  assert.ok(
    gzipSync(source).length <= 250 * 1024,
    "Reader HTML exceeds the declared compressed budget.",
  );
  check("reader HTML includes every reading depth within the 250 KiB gzip budget", {
    gzipBytes: gzipSync(source).length,
  });

  const noJs = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 900 },
  });
  try {
    const page = await noJs.newPage();
    await page.goto(url + route);
    assert.equal(await page.locator(".reader-passage").count(), 6);
    const passage = page.locator(`#${firstId}`);
    assert.ok(await passage.locator('[data-reading="1"]').isVisible());
    assert.ok(!(await passage.locator('[data-reading="0"]').isVisible()));
    assert.ok(!(await passage.locator('[data-reading="2"]').isVisible()));
    assert.match(await page.locator("[data-source-status]").innerText(), /not the German source/);
    assert.ok((await page.locator("math").count()) > 10);
    await page.screenshot({ path: "artifacts/browser/reader-no-js-320-top.png" });
    await passage.locator(".local-steps summary").click();
    assert.match(await passage.locator(".local-steps").innerText(), /2\.236/);
    assert.ok(await passage.locator(".local-steps .foundation-inline").first().isVisible());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    check(
      "reader remains complete without JavaScript, including native derivation disclosures and 320px reflow",
    );
    await passage.getByRole("link", { name: /^Why\?:/u }).click();
    assert.match(new URL(page.url()).pathname, /foundations\/mean-variance-rms\/$/);
    assert.equal(await page.locator("h1").innerText(), "Mean, variance and RMS");
    assert.match(await page.locator("main").innerText(), /Where this lesson stops/);
    await page.locator('[data-foundation="bridge-negative-numbers-direction"]').click();
    assert.equal(await page.locator("h1").innerText(), "A sign records direction");
    await page.goBack();
    assert.equal(await page.locator("h1").innerText(), "Mean, variance and RMS");
    await page.goBack();
    assert.match(new URL(page.url()).pathname, new RegExp(`${route}$`));
    // Planted negative (am-10ba AC4): removing the Why? link from the route causes the check to fail
    await page.evaluate(() => {
      for (const a of document.querySelectorAll("#arg-bm-observable a")) {
        if (a.textContent?.trim() === "Why?") a.remove();
      }
    });
    assert.equal(
      await passage.getByRole("link", { name: /^Why\?:/u }).count(),
      0,
      "Planted negative: removing Why? link must leave 0 matches in passage",
    );
    await assert.rejects(
      async () => {
        await passage.getByRole("link", { name: /^Why\?:/u }).click({ timeout: 200 });
      },
      (err) => err?.name === "TimeoutError",
      "Planted negative: clicking missing Why? link must fail the check",
    );
    check(
      "no-JavaScript foundation links follow complete prerequisite pages and browser Back returns",
    );
  } finally {
    await noJs.close();
  }

  const beforeHydration = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  try {
    await beforeHydration.addInitScript(() => {
      localStorage.setItem("am:settings:v1:detail", "0");
    });
    await beforeHydration.route("**/_next/**/*.js", (request) => request.abort());
    const page = await beforeHydration.newPage();
    await page.goto(`${url}${route}?detail=steps`);
    assert.equal(await page.locator("html").getAttribute("data-detail"), "2");
    assert.ok(await page.locator(`#${firstId} [data-reading="2"]`).isVisible());
    assert.ok(await page.locator(".reader-controls [data-detail-control]").isDisabled());
    assert.ok(!(await page.locator("[data-reader-root]").getAttribute("data-enhanced")));
    await page.goto(url + route);
    assert.equal(await page.locator("html").getAttribute("data-detail"), "0");
    check("prepaint resolves explicit detail before storage without waiting for React hydration");
  } finally {
    await beforeHydration.close();
  }

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  try {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error("clipboard unavailable")) },
      });
      window.readerFocusLog = [];
      document.addEventListener("focusin", (event) => {
        window.readerFocusLog.push({ id: event.target.id, tag: event.target.tagName });
        if (window.readerFocusLog.length > 40) window.readerFocusLog.shift();
      });
    });
    const errors = [];
    let workers = 0;
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("worker", () => workers++);
    await page.goto(`${url}${route}?note=private&tape=private#${firstId}`);
    await page.locator('[data-reader-root][data-enhanced="true"]').waitFor();
    assert.equal(workers, 0);
    assert.deepEqual(errors, []);
    assert.equal(
      await page.locator('link[rel="canonical"]').getAttribute("href"),
      `https://annus-mirabilis.com${route}`,
    );
    const passage = page.locator(`#${firstId}`),
      dialog = page.locator("[data-clarification-dialog]");
    const local = passage.locator(".local-steps");
    await local.locator("summary").click();
    const detail = page.locator(".reader-controls [data-detail-control]");
    const historyLength = await page.evaluate(() => history.length);
    await detail.selectOption("0");
    assert.ok(await passage.locator('[data-reading="0"]').isVisible());
    await detail.selectOption("2");
    assert.ok(await passage.locator('[data-reading="2"]').isVisible());
    assert.notEqual(await local.getAttribute("open"), null);
    await detail.selectOption("1");
    assert.equal(await page.evaluate(() => history.length), historyLength);
    await page.locator(".reader-controls [data-lens-control]").check();
    assert.ok(await passage.locator('[data-reading="3"]').isVisible());
    await local.locator("summary").click();
    check(
      "three reading depths replace history without resetting local expansion; modern qualifications are independent",
    );

    await page.locator("#lab-bm-01 > details > summary").click();
    // The reader page carries two elements with this instrument id: an <a> that
    // links to /lab/bm-01, and the laboratory itself. .first() picked the link, so
    // every control below it was absent. The laboratory is the <section>.
    const lab = page.locator('section[data-instrument-id="bm-01"]');
    // The inline laboratory mounts on first opening; wait for it before polling its button.
    await lab.waitFor({ state: "attached" });
    await page.waitForFunction(
      () =>
        !document.querySelector('section[data-instrument-id="bm-01"] button[type="submit"]')
          .disabled,
    );
    assert.equal(workers, 0);
    // Since ad178896 the trial form sits in the closed "Experiment settings" drawer.
    await lab.locator("details.experiment-settings > summary").click();
    await lab.locator('input[name="eta"]').fill("2");
    await lab.getByRole("button", { name: "Apply trial settings", exact: true }).click();
    await page.waitForFunction(() =>
      document
        .querySelector('[data-output="diffusionCoefficient"]')
        .textContent.includes("0.21472"),
    );
    const accepted = await lab.evaluate((el) => ({
      run: el.dataset.runId,
      version: el.dataset.snapshotVersion,
      draws: el.dataset.recordingDraws,
      rms: el.querySelector('[data-output="sampleRms"]').textContent,
    }));
    assert.equal(workers, 1);
    check("reader embeds the real lazy tracer worker and publishes an explicitly requested trial");

    const why = passage.getByRole("link", { name: /^Why\?:/u });
    await why.click();
    await dialog.waitFor({ state: "visible" });
    assert.equal(await dialog.getAttribute("aria-labelledby"), "clarification-mean-variance-rms");
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "clarification-mean-variance-rms",
    );
    const rootTrigger = await why.getAttribute("id");
    const panel = dialog.locator('[data-foundation-panel="mean-variance-rms"]');
    const nestedLink = panel.locator('[data-foundation="bridge-negative-numbers-direction"]');
    await nestedLink.click();
    await page.waitForFunction(
      () => document.activeElement.id === "clarification-bridge-negative-numbers-direction",
    );
    assert.equal(await page.evaluate(() => history.state.annusReader.state.frames.length), 2);
    await dialog.locator("[data-detail-control]").selectOption("2");
    assert.equal(await page.evaluate(() => history.state.annusReader.state.frames.length), 2);
    const nestedTrigger = await nestedLink.getAttribute("id");
    await dialog.getByRole("button", { name: "Back one step", exact: true }).click();
    await page.waitForFunction((id) => document.activeElement.id === id, nestedTrigger);
    assert.equal(await page.locator("html").getAttribute("data-detail"), "2");
    await page.goBack();
    await dialog.waitFor({ state: "hidden" });
    await page.waitForFunction((id) => document.activeElement.id === id, rootTrigger);
    await page.goForward();
    await dialog.waitFor({ state: "visible" });
    assert.equal(await dialog.getAttribute("aria-labelledby"), "clarification-mean-variance-rms");
    check(
      "nested explanations restore trigger focus through Back/Forward and preserve the selected detail",
    );

    await dialog.getByRole("link", { name: "Argument synopsis", exact: true }).click();
    assert.equal(await page.locator("html").getAttribute("data-view"), "results");
    assert.ok(await dialog.isVisible());
    await page.goBack();
    assert.equal(await page.locator("html").getAttribute("data-view"), "reading");
    assert.ok(await dialog.isVisible());
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    const after = await lab.evaluate((el) => ({
      run: el.dataset.runId,
      version: el.dataset.snapshotVersion,
      draws: el.dataset.recordingDraws,
      rms: el.querySelector('[data-output="sampleRms"]').textContent,
    }));
    assert.deepEqual(after, accepted);
    assert.equal(workers, 1);
    check(
      "detail, face, clarification, Escape and browser history changes preserve the exact accepted laboratory snapshot",
    );

    // Opening from a scrolled-to passage must update the history entry we return to.
    const other = page.locator("#arg-bm-independent-steps");
    const otherWhy = other.getByRole("link", { name: /^Why\?:/u });
    await otherWhy.click();
    await dialog.waitFor({ state: "visible" });
    await page.goBack();
    await dialog.waitFor({ state: "hidden" });
    assert.equal(new URL(page.url()).hash, "#arg-bm-independent-steps");
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      await otherWhy.getAttribute("id"),
    );
    check("return history records the actual scrolled-to passage, not the last outline selection");

    await detail.selectOption("1");
    await passage.locator('[data-reading="1"] .foundation-link a').click();
    await dialog.waitFor({ state: "visible" });
    await dialog.getByRole("link", { name: "Argument synopsis", exact: true }).click();
    await dialog.getByRole("button", { name: "Return to the exact step", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    assert.equal(await page.evaluate(() => document.activeElement.id), firstId);
    check(
      "return from a changed face focuses the passage when its original inline trigger is hidden",
    );

    await detail.selectOption("1");
    await page.locator('.reader-controls [data-view-link="german"]').click();
    assert.match(await passage.locator("[data-face-source]").innerText(), /not yet available/);
    assert.ok(!(await passage.locator("[data-face-reading]").isVisible()));
    await page.locator('.reader-controls [data-view-link="reading"]').click();
    await passage.getByRole("button", { name: /^Copy a link to this passage:/u }).click();
    const copied = page.locator("[data-copy-fallback] input");
    await copied.waitFor({ state: "visible" });
    const href = new URL(await copied.inputValue());
    assert.equal(href.hash, `#${firstId}`);
    assert.equal(href.pathname, route);
    assert.ok(
      [...href.searchParams.keys()].every((key) => ["view", "detail", "lens"].includes(key)),
    );
    assert.ok(!href.href.includes("private"));
    check(
      "unavailable source faces never impersonate a translation, and clipboard fallback exports only public reading axes",
    );

    const mainAudit = await new AxeBuilder({ page })
      .include("#main")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    const mainSerious = mainAudit.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact),
    );
    assert.deepEqual(
      mainSerious.map((v) => v.id),
      [],
      // Name the offending elements: an id alone cannot be acted on.
      mainSerious
        .map((v) => `${v.id} -> ${v.nodes.map((n) => n.target.join(" ")).join(" ; ")}`)
        .join(" | "),
    );
    await why.click();
    await dialog.waitFor({ state: "visible" });
    const audit = await new AxeBuilder({ page })
      .include("[data-clarification-dialog]")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    const dialogSerious = audit.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact),
    );
    assert.deepEqual(
      dialogSerious.map((v) => v.id),
      [],
      // Name the offending elements: an id alone cannot be acted on.
      dialogSerious
        .map((v) => `${v.id} -> ${v.nodes.map((n) => n.target.join(" ")).join(" ; ")}`)
        .join(" | "),
    );
    await page.keyboard.press("Tab");
    assert.ok(
      await page.evaluate(() =>
        document.querySelector("[data-clarification-dialog]").contains(document.activeElement),
      ),
    );
    await page.setViewportSize({ width: 320, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.ok(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
    await page.screenshot({ path: "artifacts/browser/reader-clarification-320.png" });
    await dialog.getByRole("button", { name: "Return to the exact step", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    await page.waitForFunction((id) => document.activeElement.id === id, rootTrigger);
    await page.setViewportSize({ width: 1280, height: 900 });
    await passage.screenshot({ path: "artifacts/browser/reader-passage-desktop.png" });
    await page.emulateMedia({ media: "print" });
    assert.ok(await passage.locator('[data-reading="1"]').isVisible());
    assert.ok(!(await page.locator(".reader-controls").isVisible()));
    await page.emulateMedia({ media: "screen" });
    assert.deepEqual(errors, []);
    check(
      "reader and clarification accessibility, focus containment, mobile layout and print reading",
      {
        readerViolations: mainAudit.violations.map((v) => v.id),
        dialogViolations: audit.violations.map((v) => v.id),
        manualScreenReaderReview: "not performed",
      },
    );

    const jsonLink = await page
      .getByRole("link", { name: "The same explanation as data (JSON)", exact: true })
      .getAttribute("href");
    const data = await (await context.request.get(url + jsonLink)).json();
    assert.equal(data.paper.sourceStatus, "in-preparation");
    assert.equal(data.arguments.length, 6);
    assert.equal(data.foundations.length, 13);
    const markdownLink = await page
      .getByRole("link", { name: "Download the full explanation as Markdown", exact: true })
      .getAttribute("href");
    assert.match(
      await (await context.request.get(url + markdownLink)).text(),
      /not the German source/,
    );
    for (const f of data.foundations)
      assert.equal((await context.request.get(`${url}/foundations/${f.id}/`)).status(), 200);
    await page.goto(
      `${url}${route}s5/?detail=2&open=foundation:mean-variance-rms#arg-bm-inference`,
    );
    await page.locator("dialog[open]").waitFor();
    assert.equal(await page.locator(".reader-passage").count(), 2);
    await page.keyboard.press("Escape");
    await page.locator("[data-clarification-dialog]").waitFor({ state: "hidden" });
    assert.equal(new URL(page.url()).pathname, `${route}s5/`);
    assert.equal(await page.evaluate(() => document.activeElement.id), "arg-bm-inference");
    await page.goto(`${url}${route}?view=bogus&detail=constructor&open=foundation:missing`);
    await page.locator('[data-reader-root][data-enhanced="true"]').waitFor();
    assert.ok(!(await page.locator("[data-clarification-dialog]").isVisible()));
    assert.equal(await page.locator("html").getAttribute("data-view"), "reading");
    check(
      "static section routes, direct clarification links, all foundations and machine-readable exports resolve safely",
    );
  } catch (error) {
    const detail = await page
      .evaluate(() => ({
        url: location.href,
        active: document.activeElement?.id,
        history: history.state?.annusReader,
        dialogOpen: document.querySelector("[data-clarification-dialog]")?.open,
        focusLog: window.readerFocusLog,
        triggers: [...document.querySelectorAll('[id^="reader-trigger-"]')].map((el) => ({
          id: el.id,
          visible: el.getClientRects().length > 0,
          foundation: el.dataset.foundation,
        })),
      }))
      .catch(() => null);
    await writeFile(
      "artifacts/browser/reader-failure.json",
      JSON.stringify({ error: String(error), detail }, null, 2),
    );
    await page.screenshot({ path: "artifacts/browser/reader-failure.png" }).catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}
