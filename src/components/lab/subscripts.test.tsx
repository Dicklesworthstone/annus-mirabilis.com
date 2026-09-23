import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { withScripts, withSubscripts } from "./subscripts.tsx";

const html = (text: string) => renderToStaticMarkup(<>{withSubscripts(text)}</>);

describe("withSubscripts", () => {
  test("typesets a braced subscript and keeps the text after it on the line", () => {
    expect(html("3k_{B}T")).toBe("3k<sub>B</sub>T");
    expect(html("n_{eff} = NE/(Rβν)")).toBe("n<sub>eff</sub> = NE/(Rβν)");
  });

  test("typesets every braced subscript in a string", () => {
    expect(html("E/n_{eff} and (3/2)k_{B}T")).toBe("E/n<sub>eff</sub> and (3/2)k<sub>B</sub>T");
  });

  // The bare form cannot say where the subscript ends: k_BT could be k_{BT} or k_{B} times T. A
  // helper that guessed would print a wrong quantity with confidence, so it guesses nothing.
  test("leaves the bare programmer form untouched rather than guessing its extent", () => {
    expect(withSubscripts("3k_BT")).toBe("3k_BT");
    expect(html("3k_BT")).toBe("3k_BT");
  });

  test("returns a string with no subscript as the same string", () => {
    const plain = "Ratio of the two";
    expect(withSubscripts(plain)).toBe(plain);
  });
});

const scripts = (text: string) => renderToStaticMarkup(<>{withScripts(text)}</>);

describe("withScripts", () => {
  test("raises a braced superscript and lowers a braced subscript", () => {
    expect(scripts("V^{2} and F_{0}")).toBe("V<sup>2</sup> and F<sub>0</sub>");
  });

  test("nests: a superscript may carry a subscript", () => {
    expect(scripts("V^{N_{p}}")).toBe("V<sup>N<sub>p</sub></sup>");
    expect(scripts("(V/V₀)^{NE/(Rβν)}")).toBe("(V/V₀)<sup>NE/(Rβν)</sup>");
  });

  // An unclosed brace cannot say where its script ends, so the text is left as written.
  test("leaves an unclosed script and the bare programmer forms as written", () => {
    expect(scripts("open ^{ never closed")).toBe("open ^{ never closed");
    expect(withScripts("V^2 and k_BT")).toBe("V^2 and k_BT");
  });
});
