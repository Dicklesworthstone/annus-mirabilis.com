import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { extractTypeScriptExport } from "../../content/kernel/extractTypeScript.ts";
import { computeBm01StokesEinsteinTrace } from "../../content/kernel/trace.ts";
import BROWNIAN from "../../generated/brownian-equations.json";
import PRINTED from "../../generated/printed-displays.json";
import { ShowTheCode } from "./ShowTheCode.tsx";

/*
  One colour per quantity reaches the code (owner's ruling, 2026-09-22): an identifier and a trace
  row take the colour their quantity has in the paper's equations, the same var(--q-n) the formula
  uses. Before, identifiers took a hue hashed from the id (dark green on the dark theme) and trace
  rows the three role colours, so viscosity was ochre in the equation and brown beside it. The
  colour now comes from src/generated/quantity-colours-by-paper.css, keyed by the root's data-paper and
  the element's quantity id, so the component ships no colour map in its JavaScript.
*/
const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const extracted = extractTypeScriptExport({
  root,
  modulePath: "src/content/kernel/__fixtures__/ts/target.ts",
  exportName: "evaluateStokesEinstein",
  revision: "fixture",
});
const listing = {
  displayRole: "reference-implementation" as const,
  language: "ts" as const,
  exportName: "evaluateStokesEinstein",
  filePath: extracted.filePath,
  revision: extracted.revision,
  sourceHash: extracted.sourceHash,
  source: extracted.source,
  words: "Take the temperature and the viscosity and compute the diffusion coefficient.",
  equationId: "eq-model-bm-diffusivity",
  independentReferences: [] as { experimentId: string; quantityId: string }[],
  identifierBindings: [
    { kernelFunction: "evaluateStokesEinstein", identifier: "eta", quantityId: "viscosity" },
  ],
  trace: computeBm01StokesEinsteinTrace(),
};

/** The opening tag of the first element carrying this quantity id with this tag name. */
function openTag(html: string, tag: string, quantityId: string): string {
  const match = new RegExp(`<${tag}\\b[^>]*data-quantity-id="${quantityId}"[^>]*>`).exec(html);
  expect(match).not.toBeNull();
  return match?.[0] ?? "";
}

// The per-paper rules live in their own sheet, which ShowTheCode imports (am-ywtb).
const SHEET = readFileSync(
  fileURLToPath(new URL("../../generated/quantity-colours-by-paper.css", import.meta.url)),
  "utf8",
);
const rule = (paper: string, quantityId: string) =>
  new RegExp(
    `\\[data-paper="${paper}"\\] \\[data-quantity-id="${quantityId}"\\] \\{ --qc: var\\(--q-\\d\\);`,
  );

describe("show-the-code uses the paper's quantity colours, from CSS", () => {
  test("the root names its paper, read from the listing's equation id", () => {
    const html = renderToStaticMarkup(<ShowTheCode listings={[listing]} />);
    // Attribute order is not the claim: the root also carries its id, the target of "Show the code".
    expect(html).toMatch(/<details[^>]*class="show-the-code"[^>]*data-paper="brownian-motion"/);
  });

  test("an identifier and a trace row carry their quantity, and no hashed or role hue", () => {
    const html = renderToStaticMarkup(<ShowTheCode listings={[listing]} />);
    expect(openTag(html, "span", "viscosity")).toContain('class="kernel-ident"');
    expect(openTag(html, "span", "viscosity")).not.toMatch(/hsl\(/);
    expect(openTag(html, "tr", "viscosity")).not.toMatch(/style=/);
    // The colour the two take is the Brownian paper's colour for viscosity.
    expect(SHEET).toMatch(rule("brownian-motion", "viscosity"));
  });

  test("a quantity no Brownian equation shows keeps the ink: the sheet gives it no colour", () => {
    // The example used to be molarGasConstant, until D = RT/(6 pi eta a N) put R in a Brownian
    // equation and the sheet correctly coloured it. The property holds for any quantity, so it is
    // checked for all of them: the sheet colours exactly the quantities Brownian shows, in its
    // model equations and, since dispatch 224, in its printed displays (content/display-terms/).
    // A fixed list of "unshown" quantities went stale the day those displays were bound.
    type Termed = { terms: readonly { quantityId: string }[] };
    const model = new Set(
      (BROWNIAN.equations as readonly Termed[]).flatMap((e) => e.terms.map((t) => t.quantityId)),
    );
    const printed = new Set(
      (PRINTED.displays as readonly (Termed & { paper: string })[])
        .filter((d) => d.paper === "brownian-motion")
        .flatMap((d) => d.terms.map((t) => t.quantityId)),
    );
    const shown = new Set([...model, ...printed]);
    const coloured = new Set(
      [
        ...SHEET.matchAll(
          /\[data-paper="brownian-motion"\] \[data-quantity-id="([^"]+)"\] \{ --qc: var\(--q-\d\);/g,
        ),
      ].map((m) => m[1]),
    );
    expect(shown.size).toBeGreaterThan(0);
    expect([...coloured].sort()).toEqual([...shown].sort());
    // Identity, not census: gamma belongs to papers 3 and 4 and is never a Brownian quantity.
    expect(shown.has("lorentzFactor")).toBe(false);
    expect(SHEET).not.toMatch(rule("brownian-motion", "lorentzFactor"));
    // The positive case: the printed nu of §§ 1 to 3 (and f in § 4) is the number density, which
    // only the printed displays show, and the sheet colours it.
    expect(printed.has("numberDensity")).toBe(true);
    expect(model.has("numberDensity")).toBe(false);
    expect(SHEET).toMatch(rule("brownian-motion", "numberDensity"));
  });

  test("a listing that names no paper takes its laboratory's, as bm-05's and bm-06's do", () => {
    const bare = { ...listing, equationId: undefined, independentReferences: [] };
    const html = renderToStaticMarkup(<ShowTheCode listings={[bare]} instrumentId="bm-05" />);
    expect(html).toMatch(/<details[^>]*class="show-the-code"[^>]*data-paper="brownian-motion"/);
    // The listing's own equation still decides when it names one.
    const own = renderToStaticMarkup(<ShowTheCode listings={[listing]} instrumentId="sr-11" />);
    expect(own).toMatch(/data-paper="brownian-motion"/);
  });

  test("a listing whose paper cannot be told names none", () => {
    const html = renderToStaticMarkup(
      <ShowTheCode listings={[{ ...listing, equationId: undefined }]} />,
    );
    expect(html).not.toContain("data-paper=");
  });
});
