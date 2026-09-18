import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { PaperPage } from "./PaperPage.tsx";
import { listReadablePapers } from "./paperRoutes.ts";

async function compiledPaperId(): Promise<string> {
  const papers = await listReadablePapers();
  expect(papers.length).toBeGreaterThan(0);
  const paperId = papers[0];
  if (paperId === undefined) throw new Error("no compiled papers");
  return paperId;
}

/**
 * Derives the exact set of `data-*` attributes queried from the DOM by ReaderController.
 * Extracts:
 * 1. Attribute selectors inside querySelector, querySelectorAll, and closest calls.
 * 2. Attribute names passed to hasAttribute calls.
 */
export function deriveReaderControllerQueriedAttributes(source: string): Set<string> {
  const attributes = new Set<string>();

  // Extract from querySelector, querySelectorAll, closest:
  // e.g. root.querySelector<HTMLDialogElement>("[data-clarification-dialog]")
  // e.g. event.target.closest("[data-foundation],[data-view-link],...")
  const selectorPattern =
    /(?:querySelector(?:All)?|closest)(?:\s*<[^>]+>)?\s*\(\s*[`'"]([^`'"]+)[`'"]/g;
  for (const match of source.matchAll(selectorPattern)) {
    const selector = match[1];
    if (!selector) continue;
    for (const attrMatch of selector.matchAll(/data-[a-z0-9-]+/g)) {
      attributes.add(attrMatch[0]);
    }
  }

  // Extract from hasAttribute calls:
  // e.g. control.hasAttribute("data-foundation")
  const hasAttrPattern = /hasAttribute\s*\(\s*[`'"](data-[a-z0-9-]+)[`'"]/g;
  for (const match of source.matchAll(hasAttrPattern)) {
    const attr = match[1];
    if (attr) {
      attributes.add(attr);
    }
  }

  return attributes;
}

describe("PaperPage", () => {
  test("main reading shell is a ready reader root for the reading face", async () => {
    const paperId = await compiledPaperId();
    const html = renderToStaticMarkup(await PaperPage({ paperId }));
    expect(html).toContain("data-reader-root");
    expect(html).toContain('data-ready="true"');
    expect(html).toContain('data-view="reading"');
    expect((html.match(/data-reader-root/g) ?? []).length).toBe(1);
  });

  test("section-scoped reading shell preserves all three readiness contract attributes", async () => {
    const paperId = await compiledPaperId();
    const payload = await (await import("../content/server.ts")).loadPaper(paperId);
    const section = payload.paper.sections[0]?.id;
    if (section === undefined) throw new Error("compiled paper has no sections");
    const html = renderToStaticMarkup(await PaperPage({ paperId, section }));
    expect(html).toContain("data-reader-root");
    expect(html).toContain('data-ready="true"');
    expect(html).toContain('data-view="reading"');
    expect((html.match(/data-reader-root/g) ?? []).length).toBe(1);
  });

  test("rendered markup satisfies all data-* contract attributes queried by ReaderController", async () => {
    const controllerPath = resolve(dirname(fileURLToPath(import.meta.url)), "ReaderController.tsx");
    const controllerSource = await readFile(controllerPath, "utf8");
    const queriedAttributes = deriveReaderControllerQueriedAttributes(controllerSource);

    // Hard floor baseline: ReaderController's contract requires these 15 attributes.
    // If ReaderController introduces new queries, the derivation will automatically
    // add them to queriedAttributes, enforcing self-maintenance.
    const baselineContract = [
      "data-clarification-dialog",
      "data-compass-idea",
      "data-compass-question",
      "data-copy-fallback",
      "data-copy-passage",
      "data-detail-control",
      "data-foundation",
      "data-foundation-panel",
      "data-lens-control",
      "data-reader-anchor",
      "data-reader-announcement",
      "data-reader-back",
      "data-reader-close",
      "data-reader-root",
      "data-view-link",
    ] as const;

    for (const attr of baselineContract) {
      expect(queriedAttributes.has(attr)).toBe(true);
    }

    const paperId = await compiledPaperId();
    const html = renderToStaticMarkup(await PaperPage({ paperId }));

    // Every attribute queried by ReaderController must appear in PaperPage's rendered markup
    const missingFromMarkup: string[] = [];
    for (const attr of queriedAttributes) {
      if (!html.includes(attr)) {
        missingFromMarkup.push(attr);
      }
    }

    expect(missingFromMarkup).toEqual([]);
  });
});
