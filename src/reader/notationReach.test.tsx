/**
 * THE LETTERS CONTROL SAYS HOW FAR IT REACHES (am-read-perspective-toggle-abd). A paper joins the
 * notation toggle only when the control switches something, and the control's own help text gives
 * the count from the built payload, so on Brownian motion, where it redraws one formula of
 * eighteen, it does not read as a full rendering in Einstein's letters.
 */
import { describe, expect, test } from "bun:test";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { NOTATION_TOGGLE_PAPERS } from "./navigation/state.ts";
import { PaperPage } from "./PaperPage.tsx";
import { PaperReader } from "./PaperReader.tsx";
import { notationReach, notationReachLine, paperEquations } from "./paperEquations.ts";

describe("the reach, counted on the built payload", () => {
  test("every paper with the control has formulas, and the control redraws at least one", () => {
    expect(NOTATION_TOGGLE_PAPERS.length).toBeGreaterThan(0);
    for (const paper of NOTATION_TOGGLE_PAPERS) {
      const r = notationReach(paper);
      if (!r) throw new Error(`${paper} has the control but no reach`);
      console.log(`[notation reach] ${paper}: ${notationReachLine(r)}`);
      expect([paper, r.of > 0, r.switched > 0]).toEqual([paper, true, true]);
      expect(r.switched + r.same + r.held).toBe(r.of);
    }
  });

  test("Brownian motion's molar diffusivity is one formula it redraws: D = RT/(6πkPN)", () => {
    const molar = paperEquations("brownian-motion").get("eq-model-bm-diffusivity-molar");
    expect(molar?.notationForm?.state).toBe("printed");
    const printed = molar?.notationForm?.state === "printed" ? molar.notationForm.plainLatex : "";
    for (const letter of ["k", "P", "N"]) expect(printed).toMatch(new RegExp(`\\b${letter}\\b`));
    expect(printed).not.toContain("N_A");
  });

  test("a paper without the control has no reach, so nothing counts its formulas as his", () => {
    expect(NOTATION_TOGGLE_PAPERS).not.toContain("mass-energy");
    expect(notationReach("mass-energy")).toBeNull();
  });
});

describe("the help text", () => {
  test("says how many formulas change, how many are already his, and how many stay", () => {
    expect(notationReachLine({ switched: 1, same: 1, held: 16, of: 18 })).toBe(
      "Einstein's letters change 1 of this paper's 18 formulas. 1 is already in his letters, and 16 stay in today's letters, with a note saying so.",
    );
    expect(notationReachLine({ switched: 12, same: 0, held: 28, of: 40 })).toBe(
      "Einstein's letters change 12 of this paper's 40 formulas. 28 stay in today's letters, with a note saying so.",
    );
    expect(notationReachLine({ switched: 3, same: 2, held: 0, of: 5 })).toBe(
      "Einstein's letters change 3 of this paper's 5 formulas. 2 are already in his letters.",
    );
    expect(notationReachLine({ switched: 1, same: 0, held: 1, of: 2 })).toBe(
      "Einstein's letters change 1 of this paper's 2 formulas. 1 stays in today's letters, with a note saying so.",
    );
  });

  test("the Brownian page shows the control with its reach, and the select is described by it", async () => {
    const r = notationReach("brownian-motion");
    if (!r) throw new Error("Brownian motion has no reach");
    const html = await exportMarkup(await PaperReader({}));
    expect(html).toContain("data-notation-control");
    const help = /<p class="fine" id="([^"]+)" data-notation-reach="true">([^<]*)<\/p>/.exec(html);
    expect(help?.[2]).toBe(notationReachLine(r).replace(/'/g, "&#x27;"));
    expect(help?.[2]).toContain(`${r.switched} of this paper&#x27;s ${r.of} formulas`);
    const select = /<select[^>]*data-notation-control[^>]*>/.exec(html)?.[0] ?? "";
    expect(select).toContain(`aria-describedby="${help?.[1]}"`);
  });

  test("a paper without the control shows neither the control nor a reach line", async () => {
    const html = await exportMarkup(await PaperPage({ paperId: "mass-energy" } as never));
    expect(html).toContain("data-detail-control");
    expect(html).not.toContain("data-notation-control");
    expect(html).not.toContain("data-notation-reach");
  });
});
