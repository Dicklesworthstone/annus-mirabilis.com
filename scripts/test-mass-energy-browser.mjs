import assert from "node:assert/strict";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const root = resolve("out");
const types = {".html":"text/html; charset=utf-8", ".js":"application/javascript", ".css":"text/css", ".json":"application/json", ".woff2":"font/woff2", ".svg":"image/svg+xml"};
const server = createServer(async (req, res) => {
  try {
    let file = resolve(root, `.${decodeURIComponent(new URL(req.url, "http://localhost").pathname)}`);
    if (file !== root && !file.startsWith(root + sep)) throw new Error("outside root");
    if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
    res.setHeader("Content-Type", types[extname(file)] ?? "application/octet-stream");
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end("Not found"); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const evidence = [];
const check = name => { evidence.push({check:name, outcome:"passed"}); console.log(JSON.stringify(evidence.at(-1))); };
await mkdir("artifacts/browser", {recursive:true});
try {
  const context = await browser.newContext({viewport:{width:1280,height:900}, reducedMotion:"reduce"});
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(String(error)));
  await page.goto(`${url}/papers/mass-energy/`);
  const entrance = page.locator('#entry-mass-energy[data-encounter-ready="true"]');
  await entrance.waitFor();
  assert.equal(await page.locator('article[data-unit^="arg-me-"]').count(), 8);
  assert.ok((await page.locator("math").count()) > 0);
  assert.equal(await entrance.locator("[data-body-energy]").count(), 4);
  assert.match(await entrance.locator('[data-body-energy="rest-before"]').innerText(), /unknown/);
  await entrance.getByRole("button", {name:"Align the accounts",exact:true}).focus();
  await page.keyboard.press("Enter");
  assert.equal(await entrance.getAttribute("data-encounter-phase"), "1");
  await entrance.getByRole("button", {name:"Next step",exact:true}).click();
  assert.equal(await entrance.getAttribute("data-encounter-phase"), "2");
  assert.equal(Number(await entrance.locator('[data-encounter-live] [data-owner-id="massEnergy.subtractionDifference"]').getAttribute("data-value")), 2.5);
  await entrance.getByRole("button", {name:"Next step",exact:true}).click();
  await entrance.getByRole("checkbox").uncheck();
  assert.equal(await entrance.locator("[data-encounter-live] [data-kinetic-status]").getAttribute("data-kinetic-status"), "underdetermined");
  await entrance.getByRole("button", {name:"1 percent of light speed",exact:true}).click();
  assert.equal(await entrance.getAttribute("data-encounter-phase"), "3");
  assert.ok(!(await entrance.getByRole("checkbox").isChecked()));
  check("the published second paper has eight passages, semantic math and an operable conditional subtraction");

  const help = entrance.locator("#me-entrance-work-energy");
  await help.click();
  await page.locator('dialog[open] [data-foundation-panel="work-energy"]').waitFor();
  assert.match(await page.locator("[data-compass-question]").innerText(), /without changing speed/);
  await page.locator("dialog[open] [data-reader-close]").click();
  await page.waitForFunction(() => document.activeElement?.id === "me-entrance-work-energy");
  assert.equal(await entrance.getAttribute("data-encounter-scenario"), "slow");
  assert.equal(await entrance.getAttribute("data-encounter-phase"), "3");
  assert.ok(!(await entrance.getByRole("checkbox").isChecked()));
  check("foundation detour restores exact focus without losing scenario, step or premise");

  await page.setViewportSize({width:320,height:900});
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  const audit = await new AxeBuilder({page}).include("#entry-mass-energy").withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
  assert.equal(audit.violations.length, 0, JSON.stringify(audit.violations));
  await page.screenshot({path:"artifacts/browser/mass-energy-320.png",fullPage:true});
  check("320-pixel reading has no page overflow and the entrance passes the automated accessibility audit");

  assert.match(await entrance.getByRole("link", {name:/Less guidance:/}).getAttribute("href"), /premise=relaxed/);
  assert.equal(await entrance.getByRole("link", {name:/Continue with the slow traveler/}).count(), 0);
  await entrance.getByRole("checkbox").check();
  await entrance.getByRole("link", {name:/Continue with the slow traveler/}).click();
  const lab = page.locator('[data-instrument-id="me-02"][data-settings-ready="true"]');
  await lab.waitFor();
  assert.equal(await lab.locator('input[name="beta"]').inputValue(), "0.01");
  assert.equal(await lab.locator('input[name="emittedEnergy"]').inputValue(), "10");
  assert.equal(await lab.locator('select[name="energyUnit"]').inputValue(), "joule");
  await lab.getByRole("button", {name:"Skip prediction",exact:true}).click();
  assert.match(await lab.locator('[data-quantity-id="kineticEnergyDifference"]').first().innerText(), /0\.00050004/);
  const link = await lab.locator("[data-settings-permalink]").getAttribute("href");
  assert.match(link, /beta=0\.01/);
  assert.match(link, /L=10/);
  assert.match(link, /unit=joule/);
  await page.goto(`${url}/lab/me-02/?beta=0.01junk&L=10`);
  await page.locator('[data-settings-ready="true"]').waitFor();
  assert.match(await page.locator('[data-instrument-id="me-02"] [role="alert"]').innerText(), /unchanged/);
  assert.equal(await page.locator('input[name="beta"]').inputValue(), "0.6");
  check("coefficient continuation restores the exact slow example and refuses malformed links");
  assert.deepEqual(errors, []);
  await context.close();

  const noJs = await browser.newContext({javaScriptEnabled:false, viewport:{width:320,height:900}});
  const staticPage = await noJs.newPage();
  await staticPage.goto(`${url}/papers/mass-energy/`);
  const staticEntrance = staticPage.locator("#entry-mass-energy");
  await staticEntrance.locator(".me-static-solution > summary").click();
  assert.match(await staticEntrance.locator(".me-static-solution").innerText(), /2\.5 J/);
  assert.match(await staticEntrance.locator(".me-static-solution").innerText(), /0\.0005000375031 J/);
  assert.ok(await staticEntrance.getByRole("button", {name:"Align the accounts",exact:true}).isDisabled());
  assert.ok(await staticPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  check("both worked examples and the complete explanatory paper remain available without JavaScript");
  await noJs.close();
} catch (error) {
  evidence.push({outcome:"failed",message:error instanceof Error ? error.stack : String(error)});
  throw error;
} finally {
  await writeFile("artifacts/browser/mass-energy-checks.json", `${JSON.stringify(evidence,null,2)}\n`);
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
