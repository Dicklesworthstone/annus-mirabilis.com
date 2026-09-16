import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import Sr02Page from "../../app/lab/sr-02/page.tsx";
import { encodeResult } from "../../experiments/results/codec.ts";
import { SR02_APPARATUS_CAPTIONS, SR02_DEFAULTS } from "../../experiments/sr02/definition.ts";
import { DEFAULT_PREPARED_EXAMPLE, snapshotOutputs } from "../../experiments/sr02/session.ts";
import { MagnetConductorLab } from "./MagnetConductorLab.tsx";

describe("MagnetConductorLab: static rendering (no JavaScript)", () => {
  const html = renderToStaticMarkup(<MagnetConductorLab example={DEFAULT_PREPARED_EXAMPLE} />);

  test("renders the 10 m/s snapshot numbers from the owner, not placeholders", () => {
    expect(html).toContain("1");
    expect(html).toContain("electromotiveForceMagnetFrame");
    expect(html).toContain('data-slice-frame="K"');
  });

  test("has an instrument root addressable as sr-02", () => {
    expect(html).toContain('data-instrument-id="sr-02"');
  });

  test("declares a host execution label", () => {
    expect(html).toContain('data-execution-label="host"');
  });

  test("includes a noscript notice", () => {
    expect(html).toContain("<noscript>");
    expect(html).toContain("JavaScript is off");
  });

  test("notModeled is present, non-empty, and shown as a plain line", () => {
    expect(html).toContain("Not modeled:");
    expect(html).toContain("conductor resistance");
  });

  test("the action contract is typed entry and named buttons, not a slider", () => {
    expect(html).not.toContain('type="range"');
    expect(html).toContain('inputMode="decimal"');
    expect(html).toContain("Show 10 m/s");
    expect(html).toContain("Show 0.6c");
    expect(html).toContain("Path along the motion");
  });

  test("renders no script tags itself", () => {
    expect(html).not.toContain("<script");
  });
});

describe("sr-02:apparatus", () => {
  const apparatusExample = {
    ...DEFAULT_PREPARED_EXAMPLE,
    parameters: { ...SR02_DEFAULTS, mode: "apparatus" as const, resolution: "withheld" as const },
    results: snapshotOutputs({ ...SR02_DEFAULTS, mode: "apparatus" }).map(encodeResult),
  };
  const html = renderToStaticMarkup(<MagnetConductorLab example={apparatusExample} />);

  test("renders by the mode id and never displays a computed field value", () => {
    expect(html).toContain('data-instrument-id="sr-02:apparatus"');
    expect(html).toContain('data-execution-label="static"');
    expect(html).toContain(SR02_APPARATUS_CAPTIONS.magnetMoves);
    expect(html).toContain(SR02_APPARATUS_CAPTIONS.observation);
    expect(html).not.toContain("electromotiveForceMagnetFrame");
  });

  test("withheld resolution sits in a closed native disclosure", () => {
    expect(html).toContain("<details");
    expect(html).not.toContain("<details open");
    expect(html).toContain("How the 1905 paper removes this asymmetry");
    expect(html).toContain('data-resolution="section-6"');
  });

  test("shown resolution opens the disclosure", () => {
    const shown = renderToStaticMarkup(
      <MagnetConductorLab
        example={{
          ...apparatusExample,
          parameters: { ...apparatusExample.parameters, resolution: "shown" },
        }}
      />,
    );
    expect(shown).toContain("<details open");
    expect(shown).toContain('data-resolution="section-6"');
  });
});

describe("SR-02 route", () => {
  test("the page renders the laboratory and the argument", () => {
    const html = renderToStaticMarkup(<Sr02Page />);
    expect(html).toContain('data-instrument-id="sr-02"');
    expect(html).toContain("The same relative motion");
    expect(html).toContain('id="magnet-conductor-argument"');
    expect(html).toContain("Not modeled:");
  });
});
