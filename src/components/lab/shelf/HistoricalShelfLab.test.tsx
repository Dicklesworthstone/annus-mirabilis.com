import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SHELF_IDS } from "../../../experiments/shelf/definition.ts";
import { getHistoricalShelfExample } from "../../../experiments/shelf/historicalExample.ts";
import { HistoricalShelfLab } from "./HistoricalShelfLab.tsx";

describe("historical optical comparisons render complete worked cases without scripts", () => {
  for (const instrumentId of SHELF_IDS) {
    test(`${instrumentId} renders the actual owner readings, limitations, and native controls`, () => {
      const html = renderToStaticMarkup(<HistoricalShelfLab instrumentId={instrumentId} />);
      const example = getHistoricalShelfExample(instrumentId);
      expect(html).toContain('data-mode="1904"');
      expect(html).toContain('data-mode-locked="true"');
      expect(html).toContain('data-execution-label="static"');
      expect(html).toContain("Static worked example");
      expect(html).toContain("<fieldset disabled=");
      expect(html).toContain("<table>");
      expect(html).toContain("Not modeled:");
      expect(html).toContain("Link to these accepted settings");
      expect(html).toContain(`/lab/${instrumentId}/1904/?shelf=`);
      expect(html).not.toMatch(/299792458|modern-si-2019|laterSpeed|laterIncrement|Laue|rapidity/);
      for (const reading of example.readings) {
        expect(html).toContain(`data-output="${reading.id}"`);
      }
    });
  }

  test("the Lorentz comparison carries its historical label, and all visible speeds remain ratios", () => {
    const maxwell = renderToStaticMarkup(
      <HistoricalShelfLab instrumentId="shelf-maxwell-galilean" />,
    );
    expect(maxwell).toContain("Lorentz&#x27;s 1904 substitution");
    expect(maxwell).toContain("Forward wave: normalised residual");
    expect(maxwell).toContain("Backward wave: normalised residual");
    const fizeau = renderToStaticMarkup(<HistoricalShelfLab instrumentId="shelf-fizeau" />);
    expect(fizeau).toContain('name="waterSpeedFractionOfC"');
    expect(fizeau).not.toContain('name="waterSpeed"');
    expect(fizeau).not.toContain('name="showLater"');
    expect(fizeau).toContain("Difference of beam times (m/c)");
    expect(fizeau).toContain("Return speed against the flow (c)");
  });
});
