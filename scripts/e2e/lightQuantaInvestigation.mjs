import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { decodeLightInvestigationSettings } from "../../src/discovery/lightQuanta/transfer.ts";

// Real built route only. No DOM substitute is allowed for a navigation failure.
const base = process.env.BASE_URL ?? "http://127.0.0.1:3000";

/**
 * WHAT OPERATING THE INVESTIGATION IS ALLOWED TO FETCH: its own code, from its own origin, and
 * nothing else.
 *
 * THIS REPLACED `assert.deepEqual(requests, [])`, AND THE REASON IS MEASURED RATHER THAN ASSUMED.
 * That assertion answered two questions at once: whether operating the investigation sends reader
 * data or fetches a computed result, and whether it loads any further CODE. The first is what the
 * assertions around it are about and it holds. The second is false ON PURPOSE -- this repository
 * code-splits deliberately, and `LazyInlineTracerLab` is the written-up case of moving a component
 * behind an expansion to stay inside the reading-face budget -- so the old form asserted against a
 * design the project had already chosen, and was red for that reason alone.
 *
 * MEASURED 2026-10-25 against the 765-page build, at BOTH widths the suite drives, identically:
 * 7 requests after readiness, all of resourceType `script`, all same-origin
 * `/_next/static/chunks/*.js`, 0 page errors, and **0 requests that are not a same-origin static
 * script**. The seven are stable across runs: 744, 4019, 8316, 7396 (shared chunks) and 6550, 2031,
 * 5518 (the dot-hash form webpack gives a dynamic import).
 *
 * WHAT THIS STILL FORBIDS, which is the whole of the proposition worth keeping: any request to
 * another origin, any `fetch` or `xhr` of data, any JSON or content record, any WASM, any image or
 * font, any POST, and any request to a hosted model. AGENTS.md: "No hosted language model sits in
 * the reading path at launch", "no third-party scripts, fingerprinting, advertising", and the
 * physics is owned by the kernel rather than a server. None of those can pass this predicate.
 *
 * The COUNT is reported and not asserted, per AGENTS.md "A Count Is For Reporting, Not For
 * Asserting": freezing 7 would break on correct work the first time a chunk boundary moved, while
 * the property holds at any number.
 */
const ORIGIN = new URL(base).origin;
function isOwnCode(request) {
  if (request.type !== "script") return false;
  if (!request.url.startsWith(`${ORIGIN}/`)) return false;
  const path = request.url.slice(ORIGIN.length).split("?")[0];
  return path.startsWith("/_next/static/") && path.endsWith(".js");
}

/*
 * THE PREDICATE IS DRIVEN IN BOTH DIRECTIONS BEFORE IT IS TRUSTED. Narrowing an assertion is
 * precisely where a gate goes quietly permissive, and a predicate that returned true for everything
 * would turn the two checks below into decoration while leaving them green. Each negative is a class
 * the project forbids somewhere else in writing, named here so the old mechanism survives as an
 * explicit refusal rather than only as a deleted line.
 */
assert.equal(isOwnCode({ type: "script", url: `${ORIGIN}/_next/static/chunks/744-a.js` }), true);
assert.equal(
  isOwnCode({ type: "fetch", url: `${ORIGIN}/_next/static/chunks/744-a.js` }),
  false,
  "a fetch of a path named like a chunk is data, not code",
);
assert.equal(
  isOwnCode({ type: "xhr", url: `${ORIGIN}/content/light-quanta.json` }),
  false,
  "a content record fetched at runtime",
);
assert.equal(
  isOwnCode({ type: "script", url: "https://example.com/_next/static/chunks/a.js" }),
  false,
  "another origin, however it is spelled",
);
assert.equal(
  isOwnCode({ type: "script", url: `${ORIGIN}/wasm/fs_annus.js` }),
  false,
  "a loader outside _next/static",
);
assert.equal(
  isOwnCode({ type: "image", url: `${ORIGIN}/figures/plates/pages/ap-17-132/132.webp` }),
  false,
  "a plate",
);
assert.equal(
  isOwnCode({ type: "fetch", url: `${ORIGIN}/api/explain` }),
  false,
  "a hosted model in the reading path",
);
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
      // The resource TYPE is recorded with the url, not just the url, because the assertion below
      // turns on it: a `fetch()` of a path ending `.js` is resourceType "fetch", not "script", so
      // data cannot be smuggled past this check by naming it like a chunk.
      page.on("request", (request) =>
        requests.push({ url: request.url(), type: request.resourceType() }),
      );
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
      const foreign = requests.filter((r) => !isOwnCode(r));
      assert.deepEqual(
        foreign.map((r) => `${r.type} ${r.url}`),
        [],
        "operating the investigation must fetch nothing but its own code from its own origin",
      );
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
        const countCell = restore
          .locator('tr[data-quantity-id="effectiveIndependentCount"] td')
          .last();
        console.log(
          `[PROBE] outerHTML=${JSON.stringify(await countCell.evaluate((el) => el.outerHTML))}`,
        );
        console.log(`[PROBE] innerText=${JSON.stringify(await countCell.innerText())}`);
        console.log(`[PROBE] sourceCount=${sourceCount}`);
        assert.equal(await countCell.innerText(), sourceCount.toExponential(6));
      } finally {
        await restore.close();
      }
      const foreignAfterShare = requests.filter((r) => !isOwnCode(r));
      assert.deepEqual(
        foreignAfterShare.map((r) => `${r.type} ${r.url}`),
        [],
        "sharing and restoring must fetch nothing but this origin's own code",
      );
      // Reported, not asserted. Printed per width so a run that examined nothing is visible.
      console.log(
        `[light quanta] width ${width}: ${requests.length} request(s) after readiness, all same-origin static scripts`,
      );
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
// The census, in the form the other standalone suites print, because the lane that drives this file
// reads what it says it examined rather than its exit code.
console.log(`${results.length} light-quanta investigation browser cases passed.`);
