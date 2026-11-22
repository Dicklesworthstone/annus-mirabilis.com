import { expect, test } from "bun:test";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { PaperReader } from "./PaperReader.tsx";

test("Brownian section 2 includes its configuration-to-pressure argument in the exported page", async () => {
  const html = await exportMarkup(await PaperReader({ section: "s2" }));
  const argumentStart = html.indexOf('id="arg-bm-kinetic-justification"');
  const chainStart = html.indexOf('id="bm-osmotic-derivation"');
  expect(argumentStart).toBeGreaterThanOrEqual(0);
  expect(chainStart).toBeGreaterThan(argumentStart);
  expect(chainStart).toBeLessThan(html.indexOf("</article>", argumentStart));
  expect(html.match(/data-osmotic-step=/g)).toHaveLength(6);
  expect(html).toContain("Remove independence: many constituents, one locked cluster");
  expect(html).not.toContain("katex-error");
  expect(html).not.toContain('<div hidden id="S:');
});

test("the Brownian introduction links to the full section 2 chain without repeating it", async () => {
  const html = await exportMarkup(await PaperReader());
  expect(html).toContain('href="/papers/brownian-motion/s2/#bm-osmotic-derivation"');
  expect(html).not.toContain('id="bm-osmotic-derivation"');
});
