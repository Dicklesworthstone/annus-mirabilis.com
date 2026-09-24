import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { exportMarkup } from "./exportMarkup.ts";

/**
 * AGENTS.md: an instrument's notModeled is "shown as a plain line". On 2026-09-24 BM-01, BM-04,
 * BM-05 and BM-08 showed their limits nowhere a reader could see without opening a disclosure, and
 * a printed /lab/bm-01 had none (fixed in 0be9b273). Every lab route /lab/<id>/ whose instrument
 * has a manifest, content/experiments/<id>.yaml, must render a not-modelled statement outside any
 * closed <details>. Routes without a manifest (light-thread, lq-02, the shelves, the Avogadro lab,
 * what-can-you-infer) and sub-routes such as the kitchen are outside this rule; the not-modelled
 * duty is the manifest's.
 */
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

describe("a lab with a manifest shows what it does not model, without a disclosure", () => {
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

  test("every manifest-backed lab route renders a visible not-modelled statement", async () => {
    const ids = readdirSync(LAB).filter(
      (name) =>
        statSync(`${LAB}${name}`).isDirectory() &&
        existsSync(`${LAB}${name}/page.tsx`) &&
        existsSync(`${MANIFESTS}${name}.yaml`),
    );
    const hidden: string[] = [];
    for (const id of ids) {
      const mod = await import(`${LAB}${id}/page.tsx`);
      const out = mod.default({ params: Promise.resolve({}), searchParams: Promise.resolve({}) });
      const html = (await exportMarkup(out instanceof Promise ? await out : out)).replace(
        /<!-- -->/g,
        "",
      );
      if (!STATEMENT.test(withoutClosedDisclosures(html))) hidden.push(id);
    }
    console.log(
      `[not modeled] ${ids.length} manifest-backed lab routes; ${hidden.length} with no visible statement`,
    );
    expect(ids.length).toBeGreaterThan(25);
    expect(hidden).toEqual([]);
  });
});
