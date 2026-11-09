import { afterEach, expect, test } from "bun:test";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { installDom, uninstallDom } from "../testing/reactDom.ts";
import { PaperPage } from "./PaperPage.tsx";
import { PaperReader } from "./PaperReader.tsx";

const cases = [
  {
    paperId: "brownian-motion",
    section: "s3",
    argument: "arg-bm-diffusivity",
    id: "bm-equilibrium-derivation",
    steps: 7,
  },
  {
    paperId: "brownian-motion",
    section: "s4",
    argument: "arg-bm-diffusion-equation",
    id: "bm-source-diffusion-derivation",
    steps: 8,
  },
  {
    paperId: "light-quanta",
    section: "s4",
    argument: "arg-lq-fixed-band-volume",
    id: "lq-wien-entropy-derivation",
    steps: 11,
  },
  {
    paperId: "light-quanta",
    section: "s6",
    argument: "arg-lq-entropy-correspondence",
    id: "lq-entropy-correspondence-derivation",
    steps: 4,
  },
  {
    paperId: "special-relativity",
    section: "s8",
    argument: "arg-sr-light-complex",
    id: "sr-light-complex-derivation",
    steps: 5,
  },
] as const;

let domInstalled = false;
afterEach(async () => {
  if (!domInstalled) return;
  domInstalled = false;
  await uninstallDom();
});

for (const entry of cases) {
  test(`${entry.paperId} ${entry.section} exposes the complete derivation within its argument`, async () => {
    // Render before installing a DOM: this exercises the same server path as a static export.
    const page =
      entry.paperId === "brownian-motion"
        ? await PaperReader({ section: entry.section })
        : await PaperPage(entry);
    const html = await exportMarkup(page);
    await installDom();
    domInstalled = true;
    const doc = new DOMParser().parseFromString(html, "text/html");
    const chain = doc.getElementById(entry.id);
    expect(chain).not.toBeNull();
    expect(chain?.closest("article")?.id).toBe(entry.argument);
    expect(chain?.closest("[hidden]")).toBeNull();
    expect(chain?.querySelectorAll("[data-step-id]").length).toBe(entry.steps);
    expect(chain?.querySelectorAll("[data-is-move=true]").length).toBeGreaterThan(0);
    expect(chain?.querySelectorAll("math").length).toBeGreaterThanOrEqual(entry.steps * 2);
    expect(chain?.querySelector(".katex-error")).toBeNull();
    // The existing reader controls select data-reading. Each step participates in those axes,
    // and its own native disclosure keeps the detailed reason reachable without hydration.
    for (const step of chain?.querySelectorAll("[data-step-id]") ?? []) {
      for (const reading of ["0", "1", "2"]) {
        expect(
          step.querySelector(`[data-reading="${reading}"]`)?.textContent?.trim().length,
        ).toBeGreaterThan(0);
      }
      expect(step.querySelector("details.step-local-steps > summary")?.textContent).toBe(
        "Show every step here",
      );
      const source = step.querySelector("a.step-source-link")?.getAttribute("href");
      expect(source?.startsWith("#")).toBe(true);
      expect(doc.getElementById(source?.slice(1) ?? "")).not.toBeNull();
    }
    expect(html).not.toContain('<div hidden id="S:');
  });
}

for (const paperId of new Set(cases.map((entry) => entry.paperId))) {
  test(`${paperId} introduction links to section chains without duplicating their payload`, async () => {
    const page = paperId === "brownian-motion" ? await PaperReader() : await PaperPage({ paperId });
    const html = await exportMarkup(page);
    await installDom();
    domInstalled = true;
    const doc = new DOMParser().parseFromString(html, "text/html");
    for (const entry of cases.filter((entry) => entry.paperId === paperId)) {
      const href = `/papers/${entry.paperId}/${entry.section}/#${entry.id}`;
      const link = doc.querySelector(`a[href="${href}"]`);
      expect(link?.closest("article")?.id).toBe(entry.argument);
      expect(doc.getElementById(entry.id)).toBeNull();
    }
  });
}
