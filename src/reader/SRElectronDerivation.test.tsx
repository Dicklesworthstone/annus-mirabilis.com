import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { srElectronChains } from "../equations/derivations/srElectron.ts";
import { SRElectronDerivation } from "./SRElectronDerivation.tsx";

for (const part of ["conventions", "work"] as const) {
  test(`electron ${part} shows its complete draft argument without hydration`, () => {
    const html = renderToStaticMarkup(<SRElectronDerivation part={part} activeDetail="2" />);
    expect(html).toContain(`id="sr-electron-${part}-derivation"`);
    expect(html).toContain('data-review="draft"');
    expect(html).toContain("<math");
    expect(html).not.toContain("katex-error");
    const chains = part === "work" ? srElectronChains.slice(3) : srElectronChains.slice(0, 3);
    for (const chain of chains)
      for (const step of chain.steps) {
        expect(html).toContain(`data-step-id="${step.id}"`);
        expect(html).toContain(`id="${step.sourceAnchor}"`);
      }
    expect(html).toContain("Show every step here");
    if (part === "conventions") {
      expect(html).toContain("Momentary rest frame");
      expect(html).toContain("Later comparison:");
    } else expect(html).toContain("additive rest energy");
  });
}
