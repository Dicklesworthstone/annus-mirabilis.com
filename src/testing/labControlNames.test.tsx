import { describe, expect, test } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";
import { exportMarkup } from "./exportMarkup.ts";

/**
 * Every form control on a lab or embed page has an accessible name: a wrapping label, a label
 * pointing at its id, aria-label or aria-labelledby. On 2026-09-24 SR-03's three range sliders had
 * none, on the lab page and in its embed. The visible label pointed at the number field beside
 * each slider, so a screen reader announced an unnamed slider (fixed in fffcb64c).
 */
const APP = fileURLToPath(new URL("../app/", import.meta.url));

function pages(dir: string, base: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = `${dir}${name}`;
    if (statSync(full).isDirectory()) return pages(`${full}/`, `${base}${name}/`);
    return name === "page.tsx" ? [base] : [];
  });
}

/** Descriptions of the controls in `html` that have no accessible name. */
function unnamedControls(html: string): string[] {
  const window = new Window();
  const doc = window.document;
  doc.body.innerHTML = html;
  const unnamed: string[] = [];
  for (const el of doc.querySelectorAll("input:not([type=hidden]), select, textarea")) {
    const id = el.getAttribute("id");
    const named =
      el.closest("label") !== null ||
      (id !== null && doc.querySelector(`label[for="${id.replace(/"/g, '\\"')}"]`) !== null) ||
      Boolean(el.getAttribute("aria-label")) ||
      Boolean(el.getAttribute("aria-labelledby"));
    if (!named) unnamed.push(`${el.tagName.toLowerCase()}[type=${el.getAttribute("type")}]#${id}`);
  }
  window.close();
  return unnamed;
}

describe("every form control on a lab or embed page has an accessible name", () => {
  test("the check accepts each way of naming a control and flags a bare one", () => {
    expect(
      unnamedControls(
        '<label>A <input id="a"></label><label for="b">B</label><input id="b">' +
          '<input id="c" aria-label="C"><input id="d" aria-labelledby="x"><select id="e"></select>',
      ),
    ).toEqual(["select[type=null]#e"]);
  });

  test("no rendered lab or embed page has an unnamed control", async () => {
    const routes = [...pages(`${APP}lab/`, "lab/"), ...pages(`${APP}embed/`, "embed/")].sort();
    const found: string[] = [];
    let renders = 0;
    for (const rel of routes) {
      const mod = await import(`${APP}${rel}page.tsx`);
      const list: object[] =
        rel.includes("[") && mod.generateStaticParams ? await mod.generateStaticParams() : [{}];
      for (const params of list) {
        const out = mod.default({
          params: Promise.resolve(params),
          searchParams: Promise.resolve({}),
        });
        const html = await exportMarkup(out instanceof Promise ? await out : out);
        renders += 1;
        for (const control of unnamedControls(html))
          found.push(`${rel}${rel.includes("[") ? JSON.stringify(params) : ""}: ${control}`);
      }
    }
    console.log(
      `[control names] ${renders} lab and embed renders; ${found.length} unnamed controls`,
    );
    expect(renders).toBeGreaterThan(60);
    expect(found).toEqual([]);
  });
});
