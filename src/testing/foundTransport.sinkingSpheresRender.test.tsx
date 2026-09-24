import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SinkingSpheres } from "../components/foundations/SinkingSpheres.tsx";
import { checkVoice } from "../content/checks/voice/index.ts";

/** am-found-transport-thermo-smv3: the sinking-sphere table as a reader gets it. */

const html = renderToStaticMarkup(<SinkingSpheres />);
const text = html
  .replace(/<[^>]+>/g, " ")
  .replace(/&#x27;|&#39;/g, "'")
  .replace(/\s+/g, " ");

describe("the sinking-sphere table", () => {
  test("five rows with row headers, the lesson's sphere named in the caption", () => {
    expect(html).toContain('data-foundation-construction="viscosity-stokes-drag"');
    expect(html.match(/<th scope="row">/g)?.length).toBe(5);
    expect(text).toContain("The 0.5 μm row is the lesson's sphere");
    expect(text).toContain("Drag at 1 μm/s, 10⁻¹⁵ N");
    expect(text).toContain(" 9.42 ");
    expect(text).toContain(" 18.8 ");
    expect(text).toContain("10 h");
    expect(text).toContain("1.5 min");
  });

  test("the regime range, from the smallest and largest rows", () => {
    expect(text).toContain("between 7 × 10⁻⁹ and 5 × 10⁻⁵ of its viscous resistance");
  });

  test("the voice lint finds no error", () => {
    const errors = checkVoice(text, { context: "prose" }).filter((f) => f.severity === "error");
    expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
  });
});
