import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { prepareSr03Comparisons } from "../../content/sr03Comparison.ts";
import { ObserverControlledComparison } from "./ObserverControlledComparison.tsx";

const examples = await prepareSr03Comparisons(`source:sha256:${"a".repeat(64)}`);

describe("the observer comparison's reading surface", () => {
  const html = renderToStaticMarkup(
    <ObserverControlledComparison
      examples={examples}
      workerFactory={() => {
        throw new Error("Static reading must not create a worker.");
      }}
    />,
  );
  test("the actual worked pair and both explanations render before JavaScript", () => {
    expect(html).toContain("Static worked comparison");
    expect(html).toContain('data-comparison-phase="example"');
    expect(html).toContain('data-observer-readout="space"');
    expect(html).toContain(">12.5<");
    expect(html).toContain(">−7.5<");
    expect(html).toContain("not a length measurement");
    expect(html).toContain("8.00 ls long there");
    expect(html).toContain("<noscript>");
    expect(html).toContain('data-result-status="not-applicable"');
    expect(html).toContain("Download comparison record (JSON)");
  });
  test("common axes have non-color distinctions and the table exposes the same accepted readings", () => {
    expect(html).toContain('stroke-dasharray="8 5"');
    expect(html).toContain("Solid line and round marker");
    expect(html).toContain("dashed line and square marker");
    expect(html).toContain("Baseline in K");
    expect(html).toContain("Variant in k");
    expect(html).toContain("Held fixed (locked)");
    expect(html).toContain('aria-label="Same events, accepted observer readings" tabindex="0"');
  });
  test("changing physics is never mislabeled an observer-only action, and all controls are explicit", () => {
    expect(html).toContain("Relative frame speed");
    expect(html).toContain("Observer for the requested comparison</label>");
    expect(html).toContain("Choose a worked event pair</label>");
    expect(html).toContain("<fieldset disabled");
    expect(html).toContain("No calculation starts on arrival");
    expect(html).toContain("Re-described: Observer reading the same events from K to k.");
    expect(html).toContain("Physically changed: nothing.");
  });
});
