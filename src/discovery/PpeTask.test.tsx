import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { PPE_TASK } from "./brownian/journeyII.ts";
import { PpeTask } from "./PpeTask.tsx";

/**
 * The reader's own try at the end of a journey (dispatch 276). It was a filled, bordered section of
 * three filled, bordered panels, under a red monospace "PREDICT · PERTURB · EXPLAIN", the
 * framework's name for the task, with "1. Predict" in red. Its heading already says it in the
 * reader's words: predict, change one thing, then explain.
 */
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");

describe("PpeTask", () => {
  const html = renderToStaticMarkup(<PpeTask task={PPE_TASK} />);

  test("asks the three things in order, in the reader's words", () => {
    const words = text(html);
    expect(words).toContain("Predict, change one thing, then explain");
    for (const part of [PPE_TASK.task, PPE_TASK.perturbPrompt, PPE_TASK.explainPrompt])
      expect(words).toContain(part.replace(/\s+/g, " "));
    expect(words).not.toMatch(/Predict · Perturb · Explain/i);
    expect(words.indexOf("Predict")).toBeLessThan(words.indexOf("Change one thing"));
    expect(words.indexOf("Change one thing")).toBeLessThan(words.lastIndexOf("Explain"));
  });

  test("it is styled by its stylesheet: no box of boxes, and nothing in the accent", () => {
    expect(html).not.toContain("style=");
    expect(html).toContain('class="journey-ppe"');
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "journeySkeleton.css"),
      "utf8",
    );
    const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(([, selector, body]) => ({
      selector: (selector ?? "").replace(/\/\*[\s\S]*?\*\//g, "").trim(),
      body: body ?? "",
    }));
    const own = rules.filter((r) => /\.journey-ppe\b/.test(r.selector));
    expect(own.length).toBeGreaterThan(0);
    for (const r of own) expect(r.body, r.selector).not.toContain("--accent");
    for (const r of own.filter((x) => /^\.journey-ppe\s*[\s>]\s*\S/.test(x.selector)))
      expect(/\b(border(-[a-z]+)?|background|box-shadow)\s*:/.test(r.body), r.selector).toBe(false);
  });
});
