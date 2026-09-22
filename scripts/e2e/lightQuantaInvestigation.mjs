import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { decodeLightInvestigationSettings } from "../../src/discovery/lightQuanta/transfer.ts";

// Real built route only. No DOM substitute is allowed for a navigation failure.
const base = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const url = new URL("/discover/light-quanta/investigate/", base).href;
const directory = resolve("artifacts/browser/light-quanta-investigation");
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [1440, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [],
      requests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto(url, { waitUntil: "networkidle" });
      const root = page.locator("[data-light-investigation]");
      await page.waitForFunction(
        () =>
          document.querySelector("[data-light-investigation]")?.getAttribute("data-ready") ===
          "true",
      );
      const value = (quantity, column) =>
        root
          .locator(`[data-comparison-quantity="${quantity}"] td`)
          .nth(column)
          .locator("[data-value]")
          .getAttribute("data-value");
      const version = await root.getAttribute("data-snapshot-version");
      page.on("request", (request) => requests.push(request.url()));
      await root
        .getByLabel("Optional prediction: what will change, and why?")
        .fill("Power changes rate, not the energy per emitted electron.");
      await root
        .getByLabel("Investigate independent radiation quanta as a further physical hypothesis.")
        .check();
      assert.equal(await root.getAttribute("data-snapshot-version"), version);
      const oldEnergy = await value("maxKineticEnergy", 1),
        oldRate = Number(await value("emissionRate", 1));
      await root
        .getByRole("button", { name: "Double the accepted optical power", exact: true })
        .click();
      assert.equal(await value("maxKineticEnergy", 1), oldEnergy);
      assert.equal(Number(await value("emissionRate", 1)), 2 * oldRate);
      assert.equal(Number(await value("emissionRate", 0)), oldRate);
      assert.equal(
        await root.locator("[data-changed-settings]").innerText(),
        "Changed settings: Incident optical power.",
      );
      const accepted = await root.getAttribute("data-snapshot-version");
      const frequency = root.getByLabel("Frequency (THz)", { exact: true });
      await frequency.fill("NaN");
      assert.equal(
        await root
          .getByRole("button", { name: "Double the accepted optical power", exact: true })
          .isDisabled(),
        true,
      );
      await root.getByRole("button", { name: "Apply investigation settings", exact: true }).click();
      assert.equal(await root.getAttribute("data-snapshot-version"), accepted);
      assert.equal(await root.getByRole("alert").isVisible(), true);
      await root.getByRole("button", { name: "Restore worked settings", exact: true }).click();
      await root.getByLabel("Reference temperature (K)", { exact: true }).fill("10000");
      await root.getByRole("button", { name: "Apply investigation settings", exact: true }).click();
      assert.equal(await root.locator("[data-inference-blocked]").isVisible(), true);
      assert.equal(
        await root
          .locator('[data-comparison-quantity="effectiveIndependentCount"] td')
          .last()
          .locator('[data-result-status="outside-domain"]')
          .count(),
        1,
      );
      assert.equal(
        await root
          .locator('[data-comparison-quantity="maxKineticEnergy"] td')
          .last()
          .locator('[data-result-status="value"]')
          .count(),
        1,
      );
      await root.getByRole("button", { name: "Restore worked settings", exact: true }).click();
      await root.getByLabel("Exit cost (eV)", { exact: true }).fill("6");
      await root.getByRole("button", { name: "Apply investigation settings", exact: true }).click();
      assert.equal(
        await root
          .locator('[data-comparison-quantity="maxKineticEnergy"] td')
          .last()
          .locator('[data-result-status="not-applicable"]')
          .count(),
        1,
      );
      await root.getByRole("button", { name: "Restore worked settings", exact: true }).click();
      await root.getByLabel("Collector potential (V)", { exact: true }).fill("-0.1");
      await root.getByRole("button", { name: "Apply investigation settings", exact: true }).click();
      assert.equal(
        await root
          .locator('[data-comparison-quantity="photocurrent"] td')
          .last()
          .locator('[data-result-status="underdetermined"]')
          .count(),
        1,
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      await frequency.fill("660");
      await root.getByRole("button", { name: "Apply investigation settings", exact: true }).click();
      const sourceCount = Number(await value("effectiveIndependentCount", 1));
      const handoff = await root.locator("[data-coefficient-handoff]").getAttribute("href");
      // Unapplied edits must not leak into either share format.
      await frequency.fill("999");
      await page.evaluate(() =>
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async () => {
              throw new Error("clipboard blocked");
            },
          },
        }),
      );
      await root
        .getByRole("button", { name: "Share accepted investigation settings", exact: true })
        .click();
      const sharedHref = await root.getByLabel(/Settings link for snapshot/).inputValue();
      const linked = decodeLightInvestigationSettings(new URL(sharedHref).search);
      assert.equal(linked.kind, "settings");
      assert.equal(linked.parameters.frequency, 660e12);
      const downloadPromise = page.waitForEvent("download");
      await root
        .getByRole("button", { name: "Export accepted comparison as JSON", exact: true })
        .click();
      const downloaded = await downloadPromise;
      const evidence = JSON.parse(await readFile(await downloaded.path(), "utf8"));
      assert.equal(evidence.current.parameters.frequency, 660e12);
      assert.equal(evidence.privateNotesIncluded, false);
      assert.equal(JSON.stringify(evidence).includes("Power changes rate"), false);
      const restore = await context.newPage();
      try {
        await restore.goto(sharedHref, { waitUntil: "networkidle" });
        const restored = restore.locator("[data-light-investigation]");
        await restore.waitForFunction(
          () =>
            document.querySelector("[data-light-investigation]")?.getAttribute("data-dirty") ===
            "true",
        );
        assert.equal(
          await restored.getByLabel("Frequency (THz)", { exact: true }).inputValue(),
          "660",
        );
        assert.equal(await restored.getAttribute("data-snapshot-version"), "1");
        await restored
          .getByRole("button", { name: "Apply investigation settings", exact: true })
          .click();
        assert.equal(await restored.getAttribute("data-dirty"), "false");
        await restore.goto(new URL(handoff, base).href, { waitUntil: "networkidle" });
        const entry = restore.locator("[data-coefficient-shared-settings]");
        assert.equal(await entry.isVisible(), true);
        await entry
          .getByRole("button", { name: "Apply linked coefficient settings", exact: true })
          .click();
        assert.equal(await entry.count(), 0);
        const countText = await restore
          .locator('tr[data-quantity-id="effectiveIndependentCount"] td')
          .last()
          .innerText();
        assert.equal(countText, sourceCount.toExponential(6));
      } finally {
        await restore.close();
      }
      assert.deepEqual(requests, []);
      await page.screenshot({
        path: resolve(directory, `investigation-${width}.png`),
        fullPage: true,
      });
      results.push({ width, passed: true });
    } catch (error) {
      results.push({ width, passed: false, message: String(error), errors });
      await writeFile(resolve(directory, `failure-${width}.html`), await page.content());
      throw error;
    } finally {
      await context.close();
    }
  }
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 900 },
  });
  try {
    const page = await context.newPage();
    await page.goto(url);
    assert.equal(
      await page.locator("[data-light-investigation]").getAttribute("data-execution-label"),
      "static",
    );
    assert.equal(await page.locator("[data-comparison-quantity]").count(), 12);
    assert.equal(
      await page
        .getByRole("button", { name: "Apply investigation settings", exact: true })
        .isDisabled(),
      true,
    );
    await page
      .getByText("Read the explanations without making a prediction", { exact: true })
      .click();
    assert.equal(
      await page.getByText("Partial transfer would instead", { exact: false }).isVisible(),
      true,
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    results.push({ mode: "no-javascript", passed: true });
  } finally {
    await context.close();
  }
} finally {
  await writeFile(resolve(directory, "results.json"), JSON.stringify(results, null, 2));
  await browser.close();
}
