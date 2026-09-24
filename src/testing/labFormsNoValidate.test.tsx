import { describe, expect, test } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { ComponentType, ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * A lab form whose inputs are numbers must leave validation to the lab. Without `noValidate` the
 * browser checks `min`, `max` and `step` itself and blocks the submit with its own bubble ("Value
 * must be less than or equal to 0.95."), so the lab's refusal, which names the control and says
 * what to enter, never reaches the reader. A number input with no `step` also defaults to step 1,
 * so the browser refused every decimal. Measured on live on 2026-09-23: sr-09 and sr-13 showed the
 * browser's bubble and no lab sentence; sr-02, which validates as the reader types, showed its own.
 *
 * The check reads the rendered HTML of every lab page, not the source, so a comment or a string
 * that mentions a form cannot satisfy or trip it.
 */
const LAB_ROOT = fileURLToPath(new URL("../app/lab", import.meta.url));

/** Dynamic route segments need params to render, so they are skipped and reported by name. */
const skippedDynamic: string[] = [];

function pageFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name.startsWith("[")) {
        skippedDynamic.push(relative(LAB_ROOT, path));
        continue;
      }
      out.push(...pageFiles(path));
    } else if (name === "page.tsx") out.push(path);
  }
  return out;
}

async function renderPage(file: string): Promise<string> {
  const mod = (await import(file)) as { default: ComponentType | (() => Promise<ReactElement>) };
  const element = await (mod.default as () => ReactElement | Promise<ReactElement>)();
  return renderToStaticMarkup(element);
}

/** Every form in the markup that holds a number input or a ranged input, and whether it opts out. */
export function numericForms(html: string): { noValidate: boolean; opening: string }[] {
  const forms: { noValidate: boolean; opening: string }[] = [];
  for (const m of html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/g)) {
    const attrs = m[1] ?? "";
    const body = m[2] ?? "";
    const numeric = /<input\b[^>]*(\btype="number"|\bmin="|\bmax="|\bstep=")/.test(body);
    if (numeric)
      forms.push({ noValidate: /\bnovalidate\b/i.test(attrs), opening: `<form${attrs}>` });
  }
  return forms;
}

describe("lab forms leave number validation to the lab (noValidate)", () => {
  test("the detector sees a missing noValidate and accepts a present one (positive control)", () => {
    expect(numericForms('<form><input type="number" step="0.1"/></form>')).toEqual([
      { noValidate: false, opening: "<form>" },
    ]);
    expect(numericForms('<form novalidate=""><input type="number"/></form>')[0]?.noValidate).toBe(
      true,
    );
    expect(numericForms('<form><input type="text"/></form>')).toEqual([]);
  });

  test("every rendered lab form with a number input sets noValidate", async () => {
    const files = pageFiles(LAB_ROOT);
    const failures: string[] = [];
    const unrendered: string[] = [];
    let rendered = 0;
    let numeric = 0;
    for (const file of files) {
      let html: string;
      try {
        html = await renderPage(file);
      } catch (error) {
        unrendered.push(`${relative(LAB_ROOT, file)}: ${String(error).slice(0, 80)}`);
        continue;
      }
      rendered += 1;
      for (const form of numericForms(html)) {
        numeric += 1;
        if (!form.noValidate) failures.push(`${relative(LAB_ROOT, file)}: ${form.opening}`);
      }
    }
    console.log(
      `[lab forms] rendered ${rendered} of ${files.length} lab pages; ${numeric} numeric forms; ${failures.length} without noValidate; ${unrendered.length} unrendered; ${skippedDynamic.length} dynamic segments skipped${skippedDynamic.length ? ` (${skippedDynamic.join(", ")})` : ""}`,
    );
    for (const u of unrendered) console.log(`  unrendered: ${u}`);
    // Not vacuous: most lab pages render server-side, and many carry a numeric form.
    expect(rendered).toBeGreaterThan(files.length / 2);
    expect(numeric).toBeGreaterThan(10);
    expect(failures).toEqual([]);
  });
});
