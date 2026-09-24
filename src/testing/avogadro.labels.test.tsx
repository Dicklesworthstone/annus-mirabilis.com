import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import AvogadroLabPage from "../app/lab/avogadro-lab/page.tsx";

/**
 * am-disc-avogadro-lab-pfi7: the modern row carries the bead's exact label, and the page gives the
 * reason for never combining the rows (covariance and model discrepancy) rather than an instruction
 * with no reason. Nothing is marked closest and no combined statistic is named.
 */
describe("Avogadro lab: the modern row and the uncombined rows", () => {
  const html = renderToStaticMarkup(<AvogadroLabPage />);
  const text = html.replace(/<[^>]+>/g, "");

  test("the modern row reads 'Defined exactly in the 2019 SI, not measured'", () => {
    const row = html.slice(
      html.indexOf("Modern reference"),
      html.indexOf("</tr>", html.indexOf("Modern reference")),
    );
    expect(row.length).toBeGreaterThan(0);
    expect(row.replace(/<[^>]+>/g, "")).toContain("Defined exactly in the 2019 SI, not measured");
  });

  test("the page says why the rows are not combined: covariance and model discrepancy", () => {
    const i = text.indexOf("These rows are not combined into one number.");
    expect(i).toBeGreaterThan(0);
    const reason = text.slice(i, text.indexOf(". The modern gas constant", i));
    expect(reason).toContain("covariance");
    expect(reason).toContain("model discrepancy");
    expect(reason).toContain("gas constant");
    expect(reason).toContain("Stokes drag");
  });

  test("no estimate is marked closest and no combined statistic is named", () => {
    expect(text).not.toMatch(/closest|best value|weighted mean|Do not average/i);
  });
});
