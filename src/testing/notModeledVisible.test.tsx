import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { exportMarkup } from "./exportMarkup.ts";

/**
 * AGENTS.md: an instrument's notModeled is "shown as a plain line". On 2026-09-24 BM-01, BM-04,
 * BM-05 and BM-08 showed their limits nowhere a reader could see without opening a disclosure, and
 * a printed /lab/bm-01 had none (fixed in 0be9b273). The labs without a manifest had the same gap:
 * LQ-02, the Avogadro lab and light-thread kept their limits inside a closed disclosure, and two
 * shelves worded them in ways no one could find (d24d8aec, 2673c1a4, 0fb35e68). Every lab page that
 * renders an instrument root must show a not-modelled statement outside any closed <details>,
 * except the two below, each for a stated reason.
 */
const EXCEPT: Readonly<Record<string, string>> = {
  "bm-07/kitchen/": "no model is run until a reader loads their own observations",
  "what-can-you-infer/":
    "a reasoning workbench whose assumptions are stated in visible prose, not as a model's omissions",
};
const LAB = fileURLToPath(new URL("../app/lab/", import.meta.url));
const MANIFESTS = fileURLToPath(new URL("../../content/experiments/", import.meta.url));
const STATEMENT = /not modell?ed|leaves out/i;

/** HTML with every closed <details> removed, innermost first; an open one stays. */
function withoutClosedDisclosures(html: string): string {
  let previous = "";
  let out = html;
  while (out !== previous) {
    previous = out;
    out = out.replace(/<details\b(?![^>]*\sopen)[^>]*>(?:(?!<details\b)[\s\S])*?<\/details>/g, "");
  }
  return out;
}

describe("a lab shows what it does not model, without a disclosure", () => {
  test("closed disclosures are removed, nested ones too, and an open one is kept", () => {
    expect(withoutClosedDisclosures("<details><summary>a</summary>Not modeled: x</details>")).toBe(
      "",
    );
    expect(
      withoutClosedDisclosures("<details><details>Not modeled: x</details> y</details>z"),
    ).toBe("z");
    expect(withoutClosedDisclosures("<details open>Not modeled: x</details>")).toContain(
      "Not modeled",
    );
  });

  test("every lab page with an instrument renders a visible not-modelled statement", async () => {
    const pages = (dir: string, base: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const full = `${dir}${name}`;
        if (statSync(full).isDirectory()) return pages(`${full}/`, `${base}${name}/`);
        return name === "page.tsx" ? [base] : [];
      });
    const ids = pages(LAB, "");
    const hidden: string[] = [];
    const slack: string[] = [];
    let instruments = 0;
    let manifestBacked = 0;
    for (const id of ids) {
      const mod = await import(`${LAB}${id}page.tsx`);
      const out = mod.default({ params: Promise.resolve({}), searchParams: Promise.resolve({}) });
      const html = (await exportMarkup(out instanceof Promise ? await out : out)).replace(
        /<!-- -->/g,
        "",
      );
      if (!html.includes("data-instrument-id=")) continue;
      instruments += 1;
      if (existsSync(`${MANIFESTS}${id.replace(/\/$/, "")}.yaml`)) manifestBacked += 1;
      const visible = STATEMENT.test(withoutClosedDisclosures(html));
      if (!visible && !(id in EXCEPT)) hidden.push(id);
      // The exceptions may only shrink: an excepted page that now states its limits leaves the list.
      if (visible && id in EXCEPT) slack.push(id);
    }
    console.log(
      `[not modeled] ${instruments} lab pages with an instrument (${manifestBacked} with a manifest); ${hidden.length} with no visible statement`,
    );
    expect(manifestBacked).toBeGreaterThan(25);
    expect(hidden).toEqual([]);
    expect(slack).toEqual([]);
  });
});
