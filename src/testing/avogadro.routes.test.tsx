import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import AvogadroLabPage from "../app/lab/avogadro-lab/page.tsx";

/**
 * am-disc-avogadro-lab-pfi7, criterion 12: each route names its source and date and says whether it
 * is an independent estimate or a consistency check. Until 0d304828 the table named the methods only,
 * and called the Brownian row alone a consistency check.
 */
describe("Avogadro lab: route, date and kind on every row", () => {
  const html = renderToStaticMarkup(AvogadroLabPage());
  const rowOf = (method: string) => {
    const start = html.indexOf(`<th scope="row">${method}`);
    return start < 0
      ? ""
      : html.slice(start, html.indexOf("</tr>", start)).replace(/<[^>]+>/g, " ");
  };

  test("the radiation route is the light paper's §2, 1905, and an independent estimate", () => {
    const row = rowOf("Radiation constants");
    expect(row).toContain("Light paper §2 · 1905");
    expect(row).toContain("Independent estimate.");
  });

  test("the Brownian route is the Brownian paper's §5, and a consistency check under the 2019 SI", () => {
    const row = rowOf("Brownian displacement");
    expect(row).toContain("Brownian paper §5");
    expect(row).toContain("Consistency check.");
  });

  test("the viscosity route is the dissertation, 1905 with the 1911 correction, and a consistency check", () => {
    const row = rowOf("Viscosity and solute diffusion");
    expect(row).toContain("Dissertation · 1905, coefficient corrected 1911");
    expect(row).toContain("Consistency check");
    expect(row).not.toContain("Independent estimate");
  });
});
