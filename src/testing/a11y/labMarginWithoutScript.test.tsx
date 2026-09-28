/**
 * AN INSTRUMENT'S HISTORIAN'S MARGIN IS REACHABLE, WITH OR WITHOUT A SCRIPT (am-4ms3).
 *
 * It was not. R3 was `<p data-detail="3" hidden>` revealed only by `html[data-lens="modern"]`, and
 * measured 2026-09-27 a laboratory page mounts no ReaderController and carries no
 * `[data-lens-control]`, while src/reader/detail/prepaint.ts sets `data-lens="paper"` on every page.
 * So the margin of all 43 instruments was reachable only by typing `?lens=modern` into the address
 * bar, and the readingsWithoutScript exemption that recorded the gap has been removed rather than
 * edited, which is what closes this.
 *
 * WHAT THIS ASSERTS, and why each is a property rather than a census. That no laboratory still
 * carries the old shape; that every margin a laboratory does render is CLOSED (offered, not shown,
 * which is the whole of the objection the hidden paragraph was answering), not hidden, and carries
 * real text; and that the number of them is large, reported rather than frozen, because a count
 * that has to be edited when an instrument gains a caption is a test that breaks on correct work.
 *
 * WHAT IT DOES NOT CLAIM. Rendering here is not the built page (exportMarkup's own docblock says
 * where the two differ), and no assertion here is about how the disclosure looks or where it sits.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";
import { blankComments } from "../../content/audits/ownerTests.ts";
import { exportMarkup } from "../exportMarkup.ts";

const APP = fileURLToPath(new URL("../../app/", import.meta.url));
const SRC = fileURLToPath(new URL("../../", import.meta.url));

function pages(dir: string, base: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = `${dir}${name}`;
    if (statSync(full).isDirectory()) return pages(`${full}/`, `${base}${name}/`);
    return name === "page.tsx" ? [base] : [];
  });
}

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = `${dir}${name}`;
    if (statSync(full).isDirectory()) return sources(`${full}/`);
    return name.endsWith(".tsx") && !name.includes(".test.") ? [full] : [];
  });
}

/** R3 as it used to be written: a paragraph, with the attribute anywhere inside the tag. */
const OLD_SHAPE = /<p\s[^>]*data-detail="3"/;

describe("a laboratory's historian's margin", () => {
  test("the sweep reads code and not the prose about it", () => {
    // This file and LabMargin.tsx both QUOTE the old shape while explaining why it went, and the
    // first run of the sweep below named them as offenders. A gate that forbids a construct cannot
    // read raw source (AGENTS.md), so comments are blanked first, and the stripper is proved here
    // in both directions rather than trusted: a construct in a comment must not match, the same
    // construct in code must, and neither comment form may swallow the code beside it.
    const inComment = blankComments('// <p data-detail="3" hidden>\nconst a = 1;');
    expect(OLD_SHAPE.test(inComment)).toBe(false);
    expect(inComment).toContain("const a = 1;");
    const inCode = blankComments('const x = <p data-detail="3" hidden>{r3}</p>;');
    expect(OLD_SHAPE.test(inCode)).toBe(true);
    expect(blankComments('const b = 2; // <p data-detail="3">')).toContain("const b = 2;");
    expect(blankComments('/* <p data-detail="3"> */ const c = 3;')).toContain("const c = 3;");
  });

  test("no laboratory still carries R3 as a hidden paragraph", () => {
    const files = sources(SRC);
    expect(files.length).toBeGreaterThan(100);
    // The attribute may sit after a className, which is how RodSimultaneityLab's escaped a first
    // pass of this sweep: the pattern allows anything before it inside the tag.
    const old = files
      .filter((f) => OLD_SHAPE.test(blankComments(readFileSync(f, "utf8"))))
      .map((f) => f.slice(SRC.length));
    expect(old).toEqual([]);
  });

  test("every margin a laboratory renders is a closed disclosure with real text", async () => {
    const routes = pages(`${APP}lab/`, "lab/").sort();
    expect(routes.length).toBeGreaterThan(30);
    const problems: string[] = [];
    let withMargin = 0;
    for (const rel of routes) {
      const mod = await import(`${APP}${rel}page.tsx`);
      const out = mod.default({ params: Promise.resolve({}), searchParams: Promise.resolve({}) });
      const html = await exportMarkup(out instanceof Promise ? await out : out);
      const { document } = new Window();
      document.body.innerHTML = html;
      const margins = [...document.querySelectorAll("details.lab-margin")];
      if (margins.length === 0) continue;
      if (margins.length > 1) problems.push(`${rel}: ${margins.length} margins`);
      withMargin += 1;
      for (const margin of margins) {
        if (margin.hasAttribute("hidden")) problems.push(`${rel}: the margin is hidden`);
        // Closed: a reader is offered the modern material rather than shown it.
        if (margin.hasAttribute("open")) problems.push(`${rel}: the margin is open by default`);
        if ((margin.querySelector("summary")?.textContent ?? "").trim().length < 4)
          problems.push(`${rel}: the margin has no summary`);
        const body = (margin.textContent ?? "").trim();
        if (body.length < 80) problems.push(`${rel}: the margin holds ${body.length} characters`);
      }
    }
    console.log(`[lab margin] ${routes.length} lab pages, ${withMargin} render a margin`);
    expect(problems).toEqual([]);
    // Non-vacuity on purpose: every assertion above passes over zero margins.
    expect(withMargin).toBeGreaterThan(30);
  });
});
