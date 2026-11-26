import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createShelfSession } from "../../../experiments/shelf/session.ts";
import { evaluateShelfOptics } from "../../../experiments/shelfOptics/evaluation.ts";
import { HistoricalShelfPage } from "./HistoricalShelfPage.tsx";
import { MichelsonMorleyComparison } from "./MichelsonMorleyComparison.tsx";

const instrumentId = "shelf-michelson-morley";

test("the 1904 reader can compare two accepted predictions with the authors' published limits without scripts", () => {
  const html = renderToStaticMarkup(<HistoricalShelfPage instrumentId={instrumentId} />);
  expect(html).toContain('data-mm-source-scale="true"');
  expect(html).toContain("michelson.pdf#page=5");
  expect(html).toContain("0.02 fringe");
  expect(html).toContain("0.01 fringe");
  expect(html).toMatch(/Without contraction<\/th><td>0\.4<\/td><td>At or above the limit/);
  expect(html).toMatch(/With longitudinal contraction<\/th><td>0<\/td><td>Below the limit/);
});

test("a changed modern setup changes the prediction while the 1887 upper limits stay fixed", () => {
  const modern = evaluateShelfOptics({ instrumentId, armLength: 11, wavelength: 5.5e-7, beta: 1e-5 });
  const html = renderToStaticMarkup(<MichelsonMorleyComparison modern={modern} />);
  expect(html).toContain('data-mm-source-scale="false"');
  expect(html).toMatch(/Without contraction<\/th><td>0\.004<\/td><td>Below the limit/);
  expect(html).toContain("0.02 fringe");
  expect(html).toContain("0.01 fringe");
});

test("a withheld historical model value never looks like zero", () => {
  const snapshot = createShelfSession(instrumentId, "1904", "bounds").getSnapshot().accepted;
  if (!snapshot) throw new Error("Missing worked case");
  const historical = { ...snapshot, outputs: snapshot.outputs.filter((o) => o.quantityId !== "etherShift") };
  const html = renderToStaticMarkup(<MichelsonMorleyComparison historical={historical} />);
  expect(html).toMatch(/Without contraction<\/th><td>Unavailable<\/td><td>No accepted shift/);
  expect(html).toMatch(/With longitudinal contraction<\/th><td>0<\/td><td>Below the limit/);
});
