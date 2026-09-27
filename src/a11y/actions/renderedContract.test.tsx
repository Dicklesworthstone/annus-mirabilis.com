/**
 * EVERY INSTRUMENT'S ACTIONS, READ AGAINST ITS RENDERED PAGE (am-jioj).
 *
 * The population is every experiment manifest that declares actions and has a laboratory route, and
 * the pages are rendered here rather than described: `src/app/lab/<id>/page.tsx` is imported and
 * rendered exactly as `labReadingsReachable.test.tsx` renders the labs it checks.
 *
 * The planted negative below is the reason this file exists. Strip the tables out of a rendered
 * laboratory whose manifest promises one, and the prose audit still passes it, because the promise is
 * a sentence containing the word "table". This is not hypothetical: me-01 shipped that way, declaring
 * a view of kind `table` and two actions reading "the moving ledger values in the table", with no
 * table on the page (fixed in 4ca45e03).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { auditInstrumentManifestContracts } from "../../a11y/actions/contractAudit.ts";
import type { ActionContract } from "../../a11y/actions/types.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { auditRenderedActions, promisedAffordances } from "./renderedContract.ts";

const ROOT = process.cwd();
const MANIFESTS = join(ROOT, "content", "experiments");

type Instrument = Readonly<{
  id: string;
  route: string;
  actions: readonly ActionContract[];
  manifest: Record<string, unknown>;
}>;

/** Every manifest with actions, paired with the laboratory route that renders it. */
function instrumentsWithPages(): { instruments: Instrument[]; withoutPage: string[] } {
  const instruments: Instrument[] = [];
  const withoutPage: string[] = [];
  for (const file of readdirSync(MANIFESTS)) {
    if (!file.endsWith(".yaml") || file.startsWith("tapes")) continue;
    const manifest = strictParse(readFileSync(join(MANIFESTS, file), "utf8"), "yaml") as Record<
      string,
      unknown
    >;
    if (!manifest || typeof manifest !== "object" || !Array.isArray(manifest.actions)) continue;
    const id = String(manifest.id ?? file.replace(/\.yaml$/, ""));
    const route = join(ROOT, "src", "app", "lab", id, "page.tsx");
    if (!existsSync(route)) {
      withoutPage.push(id);
      continue;
    }
    instruments.push({
      id,
      route,
      actions: manifest.actions as readonly ActionContract[],
      manifest,
    });
  }
  return { instruments: instruments.sort((a, b) => a.id.localeCompare(b.id)), withoutPage };
}

async function renderLab(route: string): Promise<HTMLElement> {
  const mod = (await import(route)) as { default: (props: Record<string, unknown>) => unknown };
  const element = await mod.default({ params: Promise.resolve({}) });
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(element as never);
  return host;
}

const { instruments, withoutPage } = instrumentsWithPages();

describe("an instrument's actions are kept by its page, not by its prose", () => {
  beforeAll(async () => {
    await installDom();
  });
  afterAll(async () => {
    await uninstallDom();
  });

  test("the population is named, and it is not empty", () => {
    console.log(
      `[action contracts] ${instruments.length} instruments with actions and a laboratory page: ${instruments.map((i) => i.id).join(", ")}`,
    );
    console.log(
      `[action contracts] ${withoutPage.length} manifests with actions and no laboratory route, not read here: ${withoutPage.join(", ") || "none"}`,
    );
    expect(instruments.length).toBeGreaterThan(0);
    // The three the reality check named, so a population that silently lost one is visible.
    for (const id of ["me-01", "bm-01", "lq-08"])
      expect([id, instruments.some((i) => i.id === id)]).toEqual([id, true]);
  });

  test("every promised affordance is on the page that promises it", async () => {
    let examined = 0;
    let verified = 0;
    const unclassified: string[] = [];
    const failures: string[] = [];
    for (const instrument of instruments) {
      const page = await renderLab(instrument.route);
      const report = auditRenderedActions(instrument.id, instrument.actions, page);
      examined += report.examined;
      verified += report.verified;
      unclassified.push(...report.unclassified.map((a) => `${instrument.id} ${a}`));
      failures.push(...report.diagnostics.map((d) => d.message));
    }
    // Printed beside the verdict: a run that examined nothing would otherwise read exactly like a
    // clean one.
    console.log(
      `[action contracts] ${examined} promised affordances examined against the rendered DOM, ${verified} found on the page, ${failures.length} absent`,
    );
    console.log(
      `[action contracts] ${unclassified.length} actions whose wording names no affordance this vocabulary knows, so the page cannot answer for them: ${unclassified.join(", ") || "none"}`,
    );
    expect(failures).toEqual([]);
    expect(examined).toBeGreaterThan(30);
    expect(verified).toBe(examined);
  });

  test("Planted Negative: a laboratory that loses its table goes red, and the prose audit does not notice", async () => {
    const me01 = instruments.find((i) => i.id === "me-01");
    if (!me01) throw new Error("me-01 is not in the population, so this plant proves nothing");
    // The plant is the historical defect itself: me-01's page without a table, which is what shipped.
    const page = await renderLab(me01.route);
    const tables = [...page.querySelectorAll("table")];
    expect(tables.length).toBeGreaterThan(0);
    for (const table of tables) table.remove();
    expect(page.querySelectorAll("table").length).toBe(0);
    // A ledger is also read from a dl, so the plant must remove that reading too or the audit is
    // answering with a different element than the one the plant took away.
    for (const list of [...page.querySelectorAll("dl")]) list.remove();

    const promisingTable = me01.actions.filter((a) =>
      promisedAffordances(a.equivalentAffordance ?? "").includes("table"),
    );
    expect(promisingTable.length).toBeGreaterThan(0);

    const report = auditRenderedActions(me01.id, me01.actions, page);
    const absent = report.diagnostics.filter((d) => d.code === "action-affordance-absent");
    expect(absent.length).toBeGreaterThan(0);
    expect(absent.every((d) => d.instrumentId === "me-01")).toBe(true);
    expect(absent.some((d) => d.message.includes("a table of values"))).toBe(true);

    // And the audit this replaces: the same manifest, with the same page stripped bare, passes.
    const prose = auditInstrumentManifestContracts(me01.manifest);
    expect(prose.filter((d) => d.actionId && d.code !== "result-outputs-mismatch")).toEqual([]);
    console.log(
      `[action contracts] plant: me-01 with ${tables.length} table(s) removed -> ${absent.length} affordance(s) reported absent by the rendered audit, ${prose.length} by the prose audit`,
    );
  });
});
