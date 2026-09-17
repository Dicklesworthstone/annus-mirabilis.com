import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import BrownianInvestigationPage from "../../app/discover/brownian-motion/investigate/page.tsx";
import { decodeBm01Settings } from "../../experiments/bm01/permalink.ts";
import tracerExample from "../../generated/bm01-example.json";

/** Uses the real prepared examples and stores. Rendering must not construct a browser Worker. */
describe("Brownian investigation: server-rendered, readable without JavaScript", () => {
  const html = renderToStaticMarkup(<BrownianInvestigationPage />);

  test("composes one tracer instrument and one spreading instrument", () => {
    expect(html.match(/data-instrument-id="bm-01"/gu)?.length).toBe(1);
    expect(html.match(/data-instrument-id="bm-06"/gu)?.length).toBe(1);
    expect(html).toContain("One trial. Two questions. Evidence you can keep.");
  });

  test("offers an explicit coefficient transfer rather than starting a hidden live binding", () => {
    expect(html).toContain("Copy D from investigation-");
    expect(html).toContain("not a fitted value from the sample");
    expect(html).toContain("do not silently update the spreading lab");
  });

  test("renders a completed baseline, unit-bearing comparisons and a no-script explanation", () => {
    expect(html).toContain("Pinned baseline versus current completed result");
    expect(html).toContain("Sample coordinate RMS");
    expect(html).toContain("Sample mean square");
    expect(html).toContain("μm²");
    expect(html).toContain("1 times the baseline");
    expect(html).toContain("1 of 12 results pinned");
    expect(html).toContain("<noscript>");
    expect(html).toContain("JavaScript is off");
    expect(html).not.toContain("Awaiting a completed result");
  });

  test("does not gate the explanation on a prediction or require dragging a slider", () => {
    expect(html).toContain("Optional prediction");
    expect(html).toContain("<details>");
    expect(html).toContain("Why displacement, rather than an intrinsic Brownian speed?");
    expect(html).not.toContain('type="range"');
    expect(html).toContain("Return to the baseline interval");
  });

  test("the full-tracer link decodes to the exact accepted settings, without a double question mark", () => {
    const match = html.match(/href="(\/lab\/bm-01\/\?[^"]+)"/u);
    expect(match).not.toBeNull();
    const url = new URL(match![1]!.replaceAll("&amp;", "&"), "https://example.test");
    const decoded = decodeBm01Settings(url.search);
    expect(decoded.kind).toBe("settings");
    if (decoded.kind === "settings") expect(decoded.parameters).toEqual(tracerExample.parameters);
  });

  test("exports are clearly scoped to synthetic, pinned, page-local evidence", () => {
    expect(html).toContain("Export notebook JSON");
    expect(html).toContain("Export notebook CSV");
    expect(html).toContain("export it before");
    expect(html).toContain("source digest and snapshot identity");
    expect(html).toContain("not experimental measurements");
  });
});
