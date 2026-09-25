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

  test("the code behind the numbers is named by what it computes, not by an internal role", () => {
    // The four links read "Historical radiation owner", "Brownian inference owner", "Joint
    // viscosity–diffusion owner" and "Snapshot composition" (dispatch 218).
    const start = text.indexOf("the code behind the numbers");
    expect(start).toBeGreaterThan(0);
    const disclosure = text.slice(
      start,
      text.indexOf("How the page gathers these results", start) + 40,
    );
    for (const name of [
      "The molecular number from Planck's radiation constants",
      "The molecular number from Brownian displacements",
      "Molecular size and number from viscosity and diffusion",
      "How the page gathers these results",
    ]) {
      expect(disclosure.replaceAll("&#x27;", "'")).toContain(name);
    }
    expect(disclosure).not.toMatch(/\bowner\b|\bsnapshot\b|instance-scoped/i);
  });

  test("no estimate is marked closest and no combined statistic is named", () => {
    expect(text).not.toMatch(/closest|best value|weighted mean|Do not average/i);
  });
});
