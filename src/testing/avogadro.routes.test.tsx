import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import AvogadroLabPage from "../app/lab/avogadro-lab/page.tsx";

/**
 * am-disc-avogadro-lab-pfi7, criterion 12: each route names its source and date and says whether it
 * is an independent estimate or a consistency check. Until 0d304828 the table named the methods only,
 * and called the Brownian row alone a consistency check.
 *
 * UPDATED 2026-10-05 (am-muyh). Two assertions read "Consistency check." and the rows now say "Modern SI
 * consistency check.", so both were red. The content is the improvement and the test was the stale half:
 * WHICH constant set makes a route a consistency check rather than a measurement is the substance of the
 * distinction, because in the 2019 SI the gas constant is defined from the molecular number and the
 * Boltzmann constant, so a diffusion calculation under that set cannot independently measure a defined
 * quantity. AGENTS.md states exactly that: "In the modern set R = N_A k_B and N_A is exact by definition,
 * so these are not three independent uncertain inputs."
 *
 * So the assertions are not merely repointed at the new wording. They now require the CONSTANT SET to be
 * named beside the verdict, which is the claim the row is making and the thing a future reword must not
 * drop. A row that said only "Consistency check." would now fail, which is the direction this change
 * moves the gate.
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
    // The constant set is named, because that is what makes it a check rather than a measurement.
    expect(row).toContain("Modern SI consistency check.");
    expect(row).not.toContain("Independent estimate");
  });

  test("the viscosity route is the dissertation, 1905 with the 1911 correction, and a consistency check", () => {
    const row = rowOf("Viscosity and solute diffusion");
    expect(row).toContain("Dissertation · 1905, coefficient corrected 1911");
    expect(row).toContain("Modern SI consistency check");
    expect(row).not.toContain("Independent estimate");
  });
});
