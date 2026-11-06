import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { CSSMediaRule, CSSStyleRule, Window } from "happy-dom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { Stage } from "../../content/schemas/journey.ts";
import { JOURNEY_SHELVES } from "../../discovery/cards/journeyCards.ts";
import { Shelf } from "../../discovery/cards/Shelf.tsx";
import { DeskPrint } from "../../discovery/desk/DeskPrint.tsx";
import { DESK_INSTRUMENT_BINDINGS } from "../../discovery/desk/instruments.ts";
import { DESK_QUESTIONS } from "../../discovery/desk/model.ts";
import { loadDesk } from "../../discovery/desk/records.ts";
import { MassEnergyStage } from "../../discovery/massEnergy/MassEnergyStage.tsx";
import * as massEnergyStages from "../../discovery/massEnergy/stages.ts";
import { ROUTE_INDEX } from "../../discovery/routeIndex.ts";
import { getHistoricalShelfExample } from "../../experiments/shelf/historicalExample.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import TimelinePage from "../timeline/page.tsx";
import Desk1904Page, { metadata } from "./page.tsx";

const rootPath = resolve(import.meta.dirname, "../../..");
const desk = loadDesk(rootPath);
const html = renderToStaticMarkup(<Desk1904Page />);
const browser = new Window();
browser.document.body.innerHTML = html;
const document = browser.document;

/** Read actual JSX attributes, so a commented example cannot credit a nonexistent route anchor. */
function journeyAnchors(slug: string): ReadonlySet<string> {
  const file = join(rootPath, "src/app/discover", slug, "page.tsx");
  const syntax = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const ids = new Set<string>();
  const renderedStages: string[] = [];
  let rendersShelf = false;
  function visit(node: ts.Node) {
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(syntax) === "id" &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    ) {
      ids.add(node.initializer.text);
    }
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(syntax) === "Shelf"
    ) {
      rendersShelf ||= node.attributes.properties.some(
        (attribute) =>
          ts.isJsxAttribute(attribute) &&
          attribute.name.getText(syntax) === "cards" &&
          attribute.initializer !== undefined &&
          ts.isJsxExpression(attribute.initializer) &&
          attribute.initializer.expression !== undefined &&
          ts.isIdentifier(attribute.initializer.expression) &&
          attribute.initializer.expression.text.endsWith("_SHELF_CARDS"),
      );
    }
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(syntax) === "MassEnergyStage"
    ) {
      for (const attribute of node.attributes.properties) {
        if (
          ts.isJsxAttribute(attribute) &&
          attribute.name.getText(syntax) === "stage" &&
          attribute.initializer &&
          ts.isJsxExpression(attribute.initializer) &&
          attribute.initializer.expression &&
          ts.isIdentifier(attribute.initializer.expression)
        ) {
          renderedStages.push(attribute.initializer.expression.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(syntax);

  // The mass-energy route renders its first five stages through this shared component. Resolve
  // the stage variables the actual page passes, then inspect their real HTML rather than assuming ids.
  for (const name of renderedStages) {
    // biome-ignore lint/performance/noDynamicNamespaceImportAccess: this test resolves the stage identifiers read from the actual route AST
    const stage = massEnergyStages[name as keyof typeof massEnergyStages];
    expect(
      stage && !Array.isArray(stage),
      `${slug}: ${name} must resolve to a rendered stage`,
    ).toBe(true);
    if (!stage || Array.isArray(stage)) continue;
    const fragment = document.createElement("div");
    fragment.innerHTML = renderToStaticMarkup(<MassEnergyStage stage={stage as Stage} />);
    for (const element of fragment.querySelectorAll("[id]")) ids.add(element.id);
  }
  expect(rendersShelf, `${slug} must actually render its source shelf`).toBe(true);
  const shelf = JOURNEY_SHELVES.find((entry) => entry.journey === slug);
  expect(shelf, `${slug} must have its actual source shelf`).toBeDefined();
  if (shelf) {
    const fragment = document.createElement("div");
    fragment.innerHTML = renderToStaticMarkup(<Shelf cards={shelf.shelf} />);
    for (const element of fragment.querySelectorAll("[id]")) ids.add(element.id);
  }
  return ids;
}

describe("the complete 1904 desk before any interactive bundle loads", () => {
  test("all five objects include the actual questions, responses, source links, and learning tools", () => {
    expect(metadata.alternates?.canonical).toBe("/1904/");
    expect(document.querySelector(".desk-reconstruction")?.textContent).toBe(desk.reconstruction);
    const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(desk.objects.map((object) => object.id)).toEqual([
      "object-spectrum",
      "object-microscope",
      "object-clocks",
      "object-conductor-magnet",
      "object-energy-ledger",
    ]);
    for (const object of desk.objects) {
      const element = document.getElementById(object.id);
      expect(element, object.id).not.toBeNull();
      expect(element?.textContent).toContain(object.unresolved);
      for (const [index, question] of DESK_QUESTIONS.entries()) {
        expect(element?.textContent).toContain(question);
        expect(element?.textContent).toContain(object.responses[index]);
      }
      for (const id of object.cardIds)
        expect(element?.querySelector(`a[href="#card-${id}"]`)).not.toBeNull();
      for (const slug of object.foundations)
        expect(element?.querySelector(`a[href="/foundations/${slug}/"]`)).not.toBeNull();
      expect(element?.querySelector(`a[href="/discover/${object.journey}/"]`)).not.toBeNull();
    }
  });

  test("every admitted card is fully present, with later evidence and imports excluded", () => {
    const rows = [...document.querySelectorAll("[data-desk-entry]")];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.map((row) => row.getAttribute("data-desk-entry")).sort()).toEqual(
      desk.catalogue.map((entry) => entry.card.id).sort(),
    );
    for (const { card } of desk.catalogue) {
      const row = document.getElementById(`desk-entry-${card.id}`);
      const detail = row?.querySelector(`#card-${card.id}`);
      expect(row?.hasAttribute("hidden")).toBe(false);
      expect(detail?.tagName).toBe("DETAILS");
      expect(detail?.textContent).toContain(card.proposition);
      expect(detail?.getAttribute("data-status")).toBe(card.status);
      if (card.limits) expect(detail?.textContent).toContain(card.limits);
      if (card.status === "parallel-work") {
        expect(detail?.textContent).toContain("not available to a 1904 reader");
        expect(detail?.textContent).toContain(card.parallelWorkBasis);
      }
    }
    for (const shelf of JOURNEY_SHELVES) {
      for (const card of [
        ...shelf.laterEvidence,
        ...shelf.shelf.filter((card) => card.admittedImport),
      ]) {
        expect(
          document.getElementById(`card-${card.id}`),
          `${card.id} must stay outside the desk`,
        ).toBeNull();
      }
    }
  });

  test("each strict instrument binding has a readable owner example while the live region stays empty", () => {
    expect(Object.keys(DESK_INSTRUMENT_BINDINGS).sort()).toEqual(
      ["lq-02", "sr-04", "shelf-michelson-morley", "shelf-fizeau", "shelf-maxwell-galilean"].sort(),
    );
    for (const binding of Object.values(DESK_INSTRUMENT_BINDINGS)) {
      const experiment = document.querySelector(`[data-desk-experiment="${binding.instrumentId}"]`);
      expect(experiment).not.toBeNull();
      expect(experiment?.getAttribute("data-loading-policy")).toBe("explicit");
      const worked = experiment?.querySelector(".desk-worked-case");
      expect(worked?.hasAttribute("open")).toBe(true);
      expect(worked?.querySelector("table")).not.toBeNull();
      const example = worked?.querySelector(`[data-instrument-id="${binding.instrumentId}"]`);
      expect(example).not.toBeNull();
      expect(example?.getAttribute("data-mode-id") ?? example?.getAttribute("data-mode")).toBe(
        binding.modeId,
      );
      expect(example?.getAttribute("data-preset-id")).toBe(binding.presetId);
      expect(experiment?.querySelector(".desk-live")?.childElementCount).toBe(0);
      expect(experiment?.querySelector(".desk-experiment-actions")?.hasAttribute("hidden")).toBe(
        true,
      );
      expect(experiment?.querySelector(`a[href="${binding.standalonePath}"]`)).not.toBeNull();
      expect(existsSync(join(rootPath, "src/app", binding.standalonePath, "page.tsx"))).toBe(true);
    }
    expect(document.querySelector(".desk-catalogue-filters")?.hasAttribute("hidden")).toBe(true);
    expect(document.querySelector("canvas, iframe, video")).toBeNull();
    expect(
      document.querySelector('[data-desk-experiment="signed-displacement"] table')?.textContent,
    ).toContain("Squared displacement");
    expect(document.querySelector(".desk-pressure-example")?.textContent).toContain(
      "no calculation of a change in the emitter's inertia",
    );
  });

  test("the static cases expose the actual historical observables without numeric modern calibration", () => {
    const allocation = document.querySelector('[data-desk-experiment="lq-02"]');
    expect(
      allocation
        ?.querySelector('[data-output="energyUpToCutoff"]')
        ?.getAttribute("data-result-status"),
    ).toBe("symbolic");
    expect(allocation?.querySelector('[data-output="planckNumber"]')?.textContent).toContain(
      "6.175",
    );
    const rays = document.querySelector('[data-desk-experiment="sr-04"]');
    expect(rays?.textContent).toContain("Right-going ray");
    expect(rays?.textContent).toContain("Left-going ray");
    expect(rays?.textContent).toContain("ether-frame prediction");
    for (const id of [
      "shelf-michelson-morley",
      "shelf-fizeau",
      "shelf-maxwell-galilean",
    ] as const) {
      const example = getHistoricalShelfExample(id);
      const element = document.querySelector(`[data-desk-experiment="${id}"]`);
      for (const reading of example.readings) {
        const output = element?.querySelector(`[data-output="${reading.id}"]`);
        expect(output, `${id}: ${reading.id}`).not.toBeNull();
        expect(output?.textContent).not.toContain("Reading unavailable");
      }
      expect(element?.textContent).toContain("not historical measurements");
    }
    const worked = [...document.querySelectorAll(".desk-worked-case")]
      .map((element) => element.innerHTML)
      .join("\n");
    expect(worked).not.toMatch(
      /299792458|2\.99792458|modern-si-2019|laterSpeed|laterIncrement|Laue|rapidity/,
    );
  });

  test("every local fragment resolves to a real object or catalogue element", () => {
    const links = [...document.querySelectorAll('a[href^="#"]')];
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const hash = link.getAttribute("href") ?? "";
      if (hash === "#") continue; // The native empty fragment returns to the document's top.
      expect(document.getElementById(decodeURIComponent(hash.slice(1))), hash).not.toBeNull();
    }
  });

  test("source and admitted-stage backlinks land on real journey anchors", () => {
    const anchors = new Map(ROUTE_INDEX.map((route) => [route.slug, journeyAnchors(route.slug)]));
    let stageLinks = 0;
    for (const { card, journeys } of desk.catalogue) {
      const row = document.getElementById(`desk-entry-${card.id}`);
      for (const journey of journeys) {
        expect(
          row?.querySelector(`a[href="/discover/${journey}/#card-${card.id}"]`),
        ).not.toBeNull();
        for (const admitted of card.admittedStages ?? []) {
          const stage = admitted.replace(/^stage-/, "step-");
          const href = `/discover/${journey}/#${stage}`;
          expect(row?.querySelector(`a[href="${href}"]`), `${card.id}: ${href}`).not.toBeNull();
          const route = ROUTE_INDEX.find((entry) => entry.slug === journey);
          const title = route?.steps[Number(stage.slice(5)) - 1];
          expect(title, href).toBeDefined();
          expect(row?.querySelector(`a[href="${href}"]`)?.textContent).toContain(title);
          stageLinks++;
        }
      }
    }
    expect(stageLinks).toBeGreaterThan(0);
    const links = [...document.querySelectorAll('a[href^="/discover/"]')];
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const url = new URL(link.getAttribute("href") ?? "", "https://annus-mirabilis.com");
      const slug = url.pathname.split("/")[2];
      const known = anchors.get(slug as (typeof ROUTE_INDEX)[number]["slug"]);
      expect(known, url.pathname).toBeDefined();
      if (url.hash) expect(known?.has(decodeURIComponent(url.hash.slice(1))), url.href).toBe(true);
    }
  });

  test("timeline and foundation destinations resolve to existing static content", () => {
    const timeline = document.createElement("div");
    timeline.innerHTML = renderToStaticMarkup(<TimelinePage />);
    const timeLinks = [...document.querySelectorAll('a[href^="/timeline/#"]')];
    expect(timeLinks.length).toBeGreaterThan(0);
    for (const link of timeLinks) {
      const href = link.getAttribute("href") ?? "";
      const id = new URL(href, "https://annus-mirabilis.com").hash.slice(1);
      expect(timeline.querySelector(`[id="${id}"]`), href).not.toBeNull();
    }
    expect(existsSync(join(rootPath, "src/app/foundations/[concept]/page.tsx"))).toBe(true);
    const foundations = [...document.querySelectorAll('a[href^="/foundations/"]')];
    expect(foundations.length).toBeGreaterThan(0);
    for (const link of foundations) {
      const slug = new URL(
        link.getAttribute("href") ?? "",
        "https://annus-mirabilis.com",
      ).pathname.split("/")[2];
      const foundation = JSON.parse(
        readFileSync(join(rootPath, "content/foundations", `${slug}.json`), "utf8"),
      );
      expect(foundation.id).toBe(slug);
      expect(foundation.kind).toBe("foundation");
      expect(link.textContent).toBe(foundation.title);
    }
  });

  test("print CSS reveals every source and closed answer while hiding live controls", () => {
    const style = document.createElement("style");
    style.textContent = readFileSync(join(rootPath, "src/app/1904/desk.css"), "utf8");
    document.head.append(style);
    const print = [...(style.sheet?.cssRules ?? [])].flatMap((rule) =>
      rule instanceof CSSMediaRule && rule.media.mediaText === "print"
        ? [...rule.cssRules].filter((child): child is CSSStyleRule => child instanceof CSSStyleRule)
        : [],
    );
    expect(print.length).toBeGreaterThan(0);
    const declaration = (selector: string, property: string) =>
      print
        .find((rule) =>
          rule.selectorText
            .split(",")
            .map((part) => part.trim())
            .includes(selector),
        )
        ?.style.getPropertyValue(property);
    expect(declaration(".desk-catalogue-list > [hidden]", "display")).toBe("list-item");
    expect(declaration(".desk-page details::details-content", "content-visibility")).toBe(
      "visible",
    );
    expect(declaration(".desk-page details:not([open]) > :not(summary)", "display")).toBe("block");
    for (const selector of [".desk-experiment-actions", ".desk-catalogue-filters", ".desk-live"]) {
      expect(declaration(selector, "display"), selector).toBe("none");
    }
  });
});

describe("printing preserves the desk reader's disclosure choices", () => {
  beforeEach(installDom);
  afterEach(uninstallDom);

  test("beforeprint opens desk disclosures and afterprint restores only those it opened", async () => {
    const fixture = createContainer();
    fixture.innerHTML =
      '<article class="desk-page"><details id="closed"><summary>Question</summary><p>Answer</p></details><details id="open" open><summary>Source</summary><p>Evidence</p></details></article><details id="outside"><summary>Elsewhere</summary></details>';
    const mount = createContainer();
    const reactRoot = createRoot(mount);
    try {
      await act(async () => reactRoot.render(<DeskPrint />));
      window.dispatchEvent(new Event("beforeprint"));
      expect(fixture.querySelector<HTMLDetailsElement>("#closed")?.open).toBe(true);
      expect(fixture.querySelector<HTMLDetailsElement>("#open")?.open).toBe(true);
      expect(fixture.querySelector<HTMLDetailsElement>("#outside")?.open).toBe(false);
      window.dispatchEvent(new Event("afterprint"));
      expect(fixture.querySelector<HTMLDetailsElement>("#closed")?.open).toBe(false);
      expect(fixture.querySelector<HTMLDetailsElement>("#open")?.open).toBe(true);
    } finally {
      await act(async () => reactRoot.unmount());
      removeContainer(mount);
      removeContainer(fixture);
    }
  });
});
