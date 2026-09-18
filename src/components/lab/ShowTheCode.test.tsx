import { describe, expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { extractTypeScriptExport } from "../../content/kernel/extractTypeScript.ts";
import { computeBm01StokesEinsteinTrace } from "../../content/kernel/trace.ts";
import { KERNEL_BEAD_ID, KERNEL_DISPLAY_ROLE_LABELS } from "../../content/kernel/types.ts";
import { getLogger } from "../../testing/log/logger.ts";
import { ShowTheCode } from "./ShowTheCode.tsx";

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

describe("ShowTheCode", () => {
  test("renders three static sections without JavaScript and escapes planted script", () => {
    const html = renderToStaticMarkup(<ShowTheCode listings={[baseListing]} />);
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
    expect(html).not.toContain("\\frac");
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
