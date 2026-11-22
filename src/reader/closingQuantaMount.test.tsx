import { expect, test } from "bun:test";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { PaperPage } from "./PaperPage.tsx";

test("the actual section routes serve their own closing-consequence derivation", async () => {
  for (const [section, anchor, other] of [
    ["s7", "lq-fluorescence-derivation", "lq-ionization-derivation"],
    ["s9", "lq-ionization-derivation", "lq-fluorescence-derivation"],
  ] as const) {
    const html = await exportMarkup(await PaperPage({ paperId: "light-quanta", section }));
    expect(html).toContain("data-reader-root");
    expect(html).toContain('id="' + anchor + '"');
    expect(html).not.toContain('id="' + other + '"');
  }
});

test("the whole-paper route links to both complete arguments without embedding both detailed readers", async () => {
  const html = await exportMarkup(await PaperPage({ paperId: "light-quanta" }));
  for (const [section, anchor] of [
    ["s7", "lq-fluorescence-derivation"],
    ["s9", "lq-ionization-derivation"],
  ] as const) {
    expect(html).toContain('href="/papers/light-quanta/' + section + '/#' + anchor + '"');
    expect(html).not.toContain('id="' + anchor + '"');
  }
});
