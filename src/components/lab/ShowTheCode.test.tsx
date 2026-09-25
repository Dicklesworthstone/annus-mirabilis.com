import { describe, expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { extractTypeScriptExport } from "../../content/kernel/extractTypeScript.ts";
import { computeBm01StokesEinsteinTrace } from "../../content/kernel/trace.ts";
import { KERNEL_BEAD_ID, KERNEL_DISPLAY_ROLE_LABELS } from "../../content/kernel/types.ts";
import type { CompiledEquation } from "../../equations/viewTypes.ts";
import bm01Equations from "../../generated/bm01-equations.json";
import { getLogger } from "../../testing/log/logger.ts";
import { equationsByListing, ShowTheCode } from "./ShowTheCode.tsx";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const logger = getLogger("show-the-code");

const extracted = extractTypeScriptExport({
  root,
  modulePath: "src/content/kernel/__fixtures__/ts/target.ts",
  exportName: "evaluateStokesEinstein",
  revision: "fixture",
});

const bindings = [
  {
    kernelFunction: "evaluateStokesEinstein",
    identifier: "D",
    quantityId: "diffusionCoefficient",
  },
  {
    kernelFunction: "evaluateStokesEinstein",
    identifier: "eta",
    quantityId: "viscosity",
  },
] as const;

const baseListing = {
  displayRole: "reference-implementation" as const,
  language: "ts" as const,
  exportName: "evaluateStokesEinstein",
  filePath: extracted.filePath,
  revision: extracted.revision,
  sourceHash: extracted.sourceHash,
  source: `${extracted.source}\n// <script>alert(1)</script>`,
  words: "Take the temperature and the viscosity and compute the diffusion coefficient.",
  equationId: "eq-model-bm-diffusivity",
  independentReferences: [] as { experimentId: string; quantityId: string }[],
  identifierBindings: [...bindings],
  trace: computeBm01StokesEinsteinTrace(),
};

const compiled = bm01Equations.equations as unknown as CompiledEquation[];
const diffusivity = compiled.find((e) => e.id === "eq-model-bm-diffusivity");
if (!diffusivity)
  throw new Error("eq-model-bm-diffusivity is missing from the generated equations");
const withMaths = { evaluateStokesEinstein: [diffusivity] };

/**
 * A Mathematics heading with no equation under it (dispatch 178: it stood on every laboratory).
 * True when some Mathematics panel holds no equation block.
 */
function emptyMathematics(html: string): boolean {
  return [...html.matchAll(/data-tab="mathematics">([\s\S]*?)<\/section><section/g)].some(
    (m) => !(m[1] ?? "").includes('class="show-the-code-maths"'),
  );
}

describe("ShowTheCode", () => {
  test("renders three static sections without JavaScript and escapes planted script", () => {
    const html = renderToStaticMarkup(
      <ShowTheCode listings={[baseListing]} equations={withMaths} explorerHref="#lab-model" />,
    );
    expect(html).toContain("In words");
    expect(html).toContain("Mathematics");
    expect(html).toContain("Implementation");
    expect(html).toContain('data-tab="words"');
    expect(html).toContain('data-tab="mathematics"');
    expect(html).toContain('data-tab="implementation"');
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain('data-quantity-id="diffusionCoefficient"');
    expect(html).toContain('data-quantity-id="viscosity"');
    expect(html).toContain(KERNEL_DISPLAY_ROLE_LABELS["reference-implementation"]);
    expect(html).toContain('data-equation-ref="eq-model-bm-diffusivity"');
    expect(html).not.toContain('data-equation-id="eq-model-bm-diffusivity"');
    // No raw LaTeX a reader could see. The Mathematics panel now carries the compiled MathML, whose
    // <annotation encoding="application/x-tex"> holds the TeX for assistive tools and is never
    // displayed; everything else is checked as before.
    expect(html).toContain('annotation encoding="application/x-tex"');
    expect(html.replace(/<annotation\b[^>]*>[\s\S]*?<\/annotation>/g, "")).not.toContain("\\frac");
    logger.log({
      testId: "show-the-code-static",
      beadId: KERNEL_BEAD_ID,
      outcome: "passed",
      message: "Static disclosure renders three tabs and escapes a planted script",
    });
  });

  test("header claims the current snapshot only when provenance names the function", () => {
    const claimed = renderToStaticMarkup(
      <ShowTheCode
        listings={[baseListing]}
        producedCurrentSnapshot={true}
        snapshotFunctionName="evaluateStokesEinstein"
      />,
    );
    const denied = renderToStaticMarkup(
      <ShowTheCode
        listings={[baseListing]}
        producedCurrentSnapshot={true}
        snapshotFunctionName="someoneElse"
      />,
    );
    expect(claimed).toContain("This is the function that produced the current snapshot.");
    expect(denied).not.toContain("This is the function that produced the current snapshot.");
    expect(denied).toContain("This function computes the listed outputs when it runs.");
    logger.log({
      testId: "show-the-code-snapshot-header",
      beadId: KERNEL_BEAD_ID,
      outcome: "passed",
      message: "Snapshot claim is gated on per-output provenance",
      extra: { producedCurrentSnapshot: true },
    });
  });

  test("independentReferences render as how-this-number-is-checked links, and an empty list renders nothing", () => {
    const withRefs = renderToStaticMarkup(
      <ShowTheCode
        listings={[
          {
            ...baseListing,
            independentReferences: [{ experimentId: "bm-01", quantityId: "diffusionCoefficient" }],
          },
        ]}
      />,
    );
    const empty = renderToStaticMarkup(<ShowTheCode listings={[baseListing]} />);
    expect(withRefs).toContain("how this number is checked");
    expect(withRefs).toContain("/verification/bm-01/diffusionCoefficient");
    expect(empty).not.toContain("how this number is checked");
    logger.log({
      testId: "independent-references",
      beadId: KERNEL_BEAD_ID,
      outcome: "passed",
      message: "Verification links render only when named",
      extra: { independentReferenceCount: 1 },
    });
  });

  test("trace markup does not change when a later snapshot is described", () => {
    const first = renderToStaticMarkup(<ShowTheCode listings={[baseListing]} />);
    const second = renderToStaticMarkup(
      <ShowTheCode
        listings={[baseListing]}
        producedCurrentSnapshot={true}
        snapshotFunctionName="evaluateStokesEinstein"
      />,
    );
    const table = (html: string) => html.slice(html.indexOf("<table"), html.indexOf("</table>"));
    expect(table(first)).toBe(table(second));
    logger.log({
      testId: "trace-independence",
      beadId: KERNEL_BEAD_ID,
      outcome: "passed",
      message: "Trace markup is independent of the accepted snapshot header",
    });
  });

  test("matching snapshotSourceDigest renders code implementation cleanly", () => {
    const html = renderToStaticMarkup(
      <ShowTheCode
        listings={[baseListing]}
        producedCurrentSnapshot={true}
        snapshotFunctionName="evaluateStokesEinstein"
        snapshotSourceDigest={baseListing.sourceHash}
      />,
    );
    expect(html).toContain("This is the function that produced the current snapshot.");
    expect(html).not.toContain("data-refusal-code");
    expect(html).toContain("evaluateStokesEinstein");
    expect(html).toContain("data-quantity-id");
  });

  test("mismatched snapshotSourceDigest produces a typed refusal and refuses to render code", () => {
    const html = renderToStaticMarkup(
      <ShowTheCode
        listings={[baseListing]}
        producedCurrentSnapshot={true}
        snapshotFunctionName="evaluateStokesEinstein"
        snapshotSourceDigest="sha256:0000000000000000000000000000000000000000000000000000000000000000"
      />,
    );
    expect(html).toContain("Listing refused: Source hash does not match current snapshot.");
    expect(html).toContain('data-refusal-code="stale-kernel-listing"');
    expect(html).toContain("Source listing refused:");
    expect(html).toContain(
      "does not match the digest of the source that produced the current snapshot",
    );
    // Code tokens and trace should NOT be displayed when refused
    expect(html).not.toContain("<code data-language");
    expect(html).not.toContain("<table");
  });

  test("trace rows carrying quantityId use role tokens and rows carrying opId link to operation explanations", () => {
    const html = renderToStaticMarkup(<ShowTheCode listings={[baseListing]} />);
    expect(html).toContain('data-quantity-id="diffusionCoefficient"');
    expect(html).toContain('class="am-role-result"');
    expect(html).toContain('data-quantity-id="viscosity"');
    expect(html).toContain('class="am-role-input"');
    expect(html).toContain('data-quantity-id="molarGasConstant"');
    expect(html).toContain('class="am-role-constant"');
    expect(html).toContain('data-op-id="eq-model-bm-diffusivity.op.drag"');
    expect(html).toContain('href="#eq-model-bm-diffusivity.op.drag"');
    expect(html).toContain('data-op-id="eq-model-bm-diffusivity.op.equality"');
    expect(html).toContain('href="#eq-model-bm-diffusivity.op.equality"');
    expect(html).toContain('data-op-id="eq-model-bm-rms.op.squareRoot"');
    expect(html).toContain('href="#eq-model-bm-rms.op.squareRoot"');
    logger.log({
      testId: "stc-trace-role-tokens-and-op-links",
      beadId: KERNEL_BEAD_ID,
      outcome: "passed",
      message: "ShowTheCode renders trace rows with role tokens and opId links",
    });
  });
});

describe("no pinned listing, no disclosure", () => {
  test("ShowTheCode with no listing renders nothing", () => {
    expect(renderToStaticMarkup(<ShowTheCode listings={[]} />)).toBe("");
  });

  test("a lab whose instrument has no pinned listing draws no empty 'Show the code' box", async () => {
    // SR-11 asks getKernelListingsForInstrument("sr-11"), which has no entry: until this, its page
    // carried a "Show the code" disclosure that opened onto nothing.
    const { MovingMirrorLab } = await import("./sr11/MovingMirrorLab.tsx");
    const { DEFAULT_PREPARED_EXAMPLE } = await import("../../experiments/sr11/session.ts");
    const html = renderToStaticMarkup(<MovingMirrorLab example={DEFAULT_PREPARED_EXAMPLE} />);
    expect(html).not.toContain('class="show-the-code"');
    // ShowTheCodeColour.test.tsx holds the other side: BM-01, with pinned listings, still draws it.
  });
});

describe("the Mathematics section shows the equations a function computes, or nothing (dispatch 178)", () => {
  test("with equations: a tab and a heading over each equation, coloured and linked to the lab's explorer", () => {
    const html = renderToStaticMarkup(
      <ShowTheCode listings={[baseListing]} equations={withMaths} explorerHref="#lab-model" />,
    );
    expect(html).toContain('href="#stc-evaluateStokesEinstein-mathematics"');
    expect(html).toContain("<h3>Mathematics</h3>");
    expect(html).toMatch(/class="show-the-code-maths"[^>]*data-paper="brownian-motion"/);
    // The formula's terms carry their quantity ids, so the per-paper sheet colours them.
    expect(html).toMatch(
      /data-term="eq-model-bm-diffusivity\.t\.[^"]+" data-quantity-id="viscosity"/,
    );
    expect(html).toContain('href="#lab-model"');
    expect(html).toContain(`Explore ${diffusivity.title} term by term`);
    // Not a second explorer: the lab renders that once (am-w7rx).
    expect(html).not.toContain('class="semantic-equation"');
    expect(emptyMathematics(html)).toBe(false);
  });

  test("without equations: no Mathematics tab, heading or section", () => {
    const html = renderToStaticMarkup(<ShowTheCode listings={[baseListing]} />);
    expect(html).not.toContain("Mathematics");
    expect(html).not.toContain('data-tab="mathematics"');
    expect(html).not.toContain("-mathematics");
    expect(html).toContain('data-tab="words"');
    expect(html).toContain('data-tab="implementation"');
    expect(emptyMathematics(html)).toBe(false);
  });

  test("a listing gets only the equation it names, by exact id, and none when it names none", () => {
    const listings = [
      baseListing,
      { ...baseListing, exportName: "unnamed", equationId: undefined },
      { ...baseListing, exportName: "prefix", equationId: "eq-model-bm-diff" },
    ];
    const byListing = equationsByListing(listings, compiled);
    expect(byListing.evaluateStokesEinstein?.map((e) => e.id)).toEqual(["eq-model-bm-diffusivity"]);
    expect(byListing.unnamed).toEqual([]);
    expect(byListing.prefix).toEqual([]);
  });

  test("negative: the detector catches a Mathematics heading with nothing under it", () => {
    const planted =
      '<section id="x-mathematics" class="show-the-code-panel" data-tab="mathematics"><h3>Mathematics</h3></section><section';
    expect(emptyMathematics(planted)).toBe(true);
  });
});
