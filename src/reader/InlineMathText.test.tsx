import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { InlineMathText } from "./InlineMathText.tsx";

const render = (text: string) =>
  renderToStaticMarkup(
    <p>
      <InlineMathText text={text} />
    </p>,
  );

describe("InlineMathText", () => {
  test("inline mathematics is typeset, with MathML for assistive technology, and no delimiter survives", () => {
    const html = render(String.raw`the classical mean energy \(k_B T\) per mode`);
    expect(html).toContain('class="katex"');
    expect(html).toContain("<math");
    expect(html).toContain("the classical mean energy ");
    expect(html).not.toContain(String.raw`\(`);
    expect(html).not.toContain(String.raw`\)`);
    // The TeX survives only as MathML's own annotation, which is not displayed; what the eye
    // gets is a typeset subscript.
    expect(html.split("k_B T").length - 1).toBe(1);
    expect(html).toContain('<annotation encoding="application/x-tex">k_B T</annotation>');
    expect(html).toContain('class="msupsub"');
  });

  test("the words around the mathematics stay escaped text", () => {
    const html = render(String.raw`R & N <are> constants: \(R = N k\)`);
    expect(html).toContain("R &amp; N &lt;are&gt; constants: ");
  });

  test("text with no inline mathematics renders exactly as before", () => {
    expect(render("energy per unit volume")).toBe("<p>energy per unit volume</p>");
  });

  test("malformed mathematics fails the render instead of reaching a reader", () => {
    expect(() => render(String.raw`a broken \(\frac{1}{\) here`)).toThrow();
  });
});
