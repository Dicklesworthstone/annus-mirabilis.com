/**
 * The two refusals sourceMarkup raises while the German face is rendered, and the control that
 * shows the renderer does not refuse everything.
 *
 * Both are build-time data failures: they stop the static render and name the block, instead of
 * serving the ledger's TeX as text or putting an equation's id on the wrong formula.
 */

import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { renderSourceMarkup, SourceMarkupError } from "./sourceMarkup.tsx";

function refusalOf(run: () => unknown): SourceMarkupError | undefined {
  try {
    run();
  } catch (error) {
    if (error instanceof SourceMarkupError) return error;
    throw error;
  }
  return undefined;
}

describe("sourceMarkup refusals", () => {
  test("source-math-malformed: a formula the ledger's KaTeX policy rejects stops the render", () => {
    const refusal = refusalOf(() =>
      renderSourceMarkup("Es ist $\\frac{1}{$ und so fort.", "s9-p9"),
    );
    expect(refusal?.code).toBe("source-math-malformed");
    // The message names the block, so the build log says where to look.
    expect(refusal?.message).toContain("s9-p9");
  });

  test("source-display-ids-mismatch: an id list that disagrees with the text's displays stops the render", () => {
    const refusal = refusalOf(() =>
      renderSourceMarkup("daß $$ a = b, $$ wenn $$ c = d. $$ Hieraus", "s9-p9", ["s9-eq1"]),
    );
    expect(refusal?.code).toBe("source-display-ids-mismatch");
    expect(refusal?.message).toContain("1 display equation id(s) for 2 display formula(s)");
  });

  test("control: well-formed mathematics typesets, keeps its ids, and leaves no TeX", () => {
    const html = renderToStaticMarkup(
      <p>
        {renderSourceMarkup("ist $\\varphi$ und $$ \\delta S = 0, $$ wenn", "s9-p9", ["s9-eq1"])}
      </p>,
    );
    expect(html).toContain('id="s9-eq1"');
    expect(html.match(/class="katex"/g)?.length).toBe(2);
    const visible = html
      .replace(/<annotation\b[^>]*>[\s\S]*?<\/annotation>/g, " ")
      .replace(/<[^>]+>/g, " ");
    expect(visible).not.toContain("$");
    expect(visible).not.toMatch(/\\[a-zA-Z]+/);
  });
});
