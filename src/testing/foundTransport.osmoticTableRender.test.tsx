import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { OsmoticTable } from "../components/foundations/OsmoticTable.tsx";
import { checkVoice } from "../content/checks/voice/index.ts";

/** am-found-transport-thermo-smv3: the selective-partition table as a reader gets it. */

const html = renderToStaticMarkup(<OsmoticTable />);
const text = html
  .replace(/<[^>]+>/g, " ")
  .replace(/&#x27;|&#39;/g, "'")
  .replace(/\s+/g, " ");

describe("the selective-partition table", () => {
  test("four rows with row headers, powers of ten, and the crowded row refused in words", () => {
    expect(html).toContain('data-foundation-construction="free-energy-osmotic-pressure"');
    expect(html.match(/<th scope="row">/g)?.length).toBe(4);
    expect(text).toContain("6.02 × 10²⁵");
    expect(text).toContain("2.4 × 10⁵");
    expect(text).toContain("10¹⁵");
    expect(text).not.toContain("1.00 × 10¹⁵");
    expect(text).toContain("not given: too crowded for the dilute law");
  });

  test("the laboratory is linked, never embedded", () => {
    expect(html).toContain('href="/lab/bm-02/"');
    expect(html).not.toContain("<iframe");
  });

  test("the voice lint finds no error", () => {
    const errors = checkVoice(text, { context: "prose" }).filter((f) => f.severity === "error");
    expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
  });
});
