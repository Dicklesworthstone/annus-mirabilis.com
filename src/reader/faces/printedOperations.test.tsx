import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import {
  clearAnnouncement,
  getAnnouncementCount,
  setLiveRegionElement,
} from "../../a11y/announce.ts";
import EquationPage from "../../app/equations/[paper]/[display]/page.tsx";
import { compilePrintedDisplay } from "../../equations/printed/displayTerms.ts";
import {
  checkPaperDisplays,
  type PrintedDisplayPayload,
  printedDisplays,
} from "../../equations/printed/paperDisplays.ts";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { attachExplainerFragments } from "./ExplainerFragments.tsx";
import { PrintedDisplayTerms } from "./PrintedDisplayTerms.tsx";

const prepared = await printedDisplays(process.cwd(), ["mass-energy"], []);
if (prepared.problems.length) throw new Error("The real printed displays must compile cleanly.");
const displays = prepared.displays;
function display(id: string): PrintedDisplayPayload {
  const found = displays.find((d) => d.display === id);
  if (!found?.semantics) throw new Error("Missing source semantics for " + id);
  return found;
}
function formula(d: PrintedDisplayPayload, inline = false) {
  return (
    <PrintedDisplayTerms display={d} inline={inline}>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: trusted KaTeX output from the real source compiler is the test subject. */}
      <span className="source-equation" dangerouslySetInnerHTML={{ __html: d.html }} />
    </PrintedDisplayTerms>
  );
}

let container: HTMLDivElement;
let root: Root | undefined;
beforeEach(async () => {
  await installDom();
  setLiveRegionElement(null);
  clearAnnouncement();
  container = document.createElement("div");
  document.body.append(container);
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  clearAnnouncement();
  setLiveRegionElement(null);
  await uninstallDom();
});

function element<T extends Element = HTMLElement>(selector: string): T {
  const found = container.querySelector<T>(selector);
  if (!found) throw new Error("Missing element " + selector);
  return found;
}
function handler(target: Element, name: string): (event: any) => void {
  const key =
    Object.keys(target).find((k) => k.startsWith("__reactProps$")) ??
    Object.keys(element(".printed-operation-explorer")).find((k) => k.startsWith("__reactProps$"));
  if (!key) throw new Error("No React props on the mounted element.");
  const action = (target as unknown as Record<string, Record<string, unknown>>)[key]?.[name];
  if (typeof action !== "function") throw new Error("Missing mounted handler " + name);
  return action as (event: any) => void;
}
async function mount(d = display("eq-s0-d7")) {
  root = createRoot(container);
  await act(async () => root?.render(formula(d)));
}
async function open() {
  const link = element(".printed-operation-toggle");
  await act(async () => handler(link, "onClick")({ preventDefault() {} }));
}
async function choose(id: string) {
  const select = element<HTMLSelectElement>(".printed-operation-choice select");
  await act(async () => {
    select.value = id;
    handler(select, "onChange")({ currentTarget: select });
  });
}

describe("the operation reference works before JavaScript", () => {
  test("operation wrappers preserve visual text, operators, spacing and physical term counts", async () => {
    const checked = await checkPaperDisplays(process.cwd(), "mass-energy");
    if (!checked) throw new Error("The source displays must be checked.");
    for (const d of checked.displays) {
      const old = document.createElement("div");
      old.innerHTML = compilePrintedDisplay(d).html;
      const current = document.createElement("div");
      const built = displays.find((item) => item.display === d.display && item.latex === d.latex);
      if (!built) throw new Error("Every printed variant must compile.");
      current.innerHTML = built.html;
      expect(current.querySelector(".katex-html")?.textContent).toBe(
        old.querySelector(".katex-html")?.textContent,
      );
      for (const selector of [".mbin", ".mrel", ".mspace", "[data-term]"])
        expect(current.querySelectorAll(".katex-html " + selector).length).toBe(
          old.querySelectorAll(".katex-html " + selector).length,
        );
    }
  });
  test("each source form has a real, distinct permanent link and no dormant controls", () => {
    for (const d of displays) {
      const html = renderToStaticMarkup(formula(d));
      expect(html).toContain(`href="/equations/mass-energy/${d.display}/#operations"`);
      expect(html).toContain('class="printed-operation-toggle"');
      expect(html).not.toContain("<select");
      expect(html).not.toContain("data-operation-selected");
      expect(html).toContain(d.spoken);
    }
  });

  test("the page-wide explanation dispatcher leaves an unhydrated operation link alone", () => {
    container.innerHTML = renderToStaticMarkup(formula(display("eq-s0-d7")));
    const detach = attachExplainerFragments(container);
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    element(".printed-operation-toggle").dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(element(".printed-operation-panel").hasAttribute("data-open")).toBe(false);
    detach();
  });

  test("the real equation pages render every authored operation and their prerequisites without hydration", async () => {
    for (const d of [...new Map(displays.map((entry) => [entry.display, entry])).values()]) {
      const html = renderToStaticMarkup(
        await EquationPage({
          params: Promise.resolve({ paper: "mass-energy", display: d.display }),
        }),
      );
      expect(html).toContain('id="operations"');
      expect(html).toContain("Read it aloud");
      expect(html).toContain(d.spoken);
      for (const operation of d.semantics?.operations ?? []) {
        expect(html).toContain('data-operation-note="' + operation.id + '"');
        expect(html).toContain(`href="/foundations/${operation.foundation}/"`);
        expect(html).toContain(operation.foundationTitle);
      }
      expect(html).toContain(d.semantics?.next.href ?? "missing next-step link");
    }
  });

  test("inline displays keep phrasing markup and block displays permit their existing div", () => {
    const d = display("eq-s0-d7");
    const inline = renderToStaticMarkup(<p>Before {formula(d, true)} after.</p>);
    container.innerHTML = inline;
    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(container.querySelector("p .printed-operation-explorer")?.tagName).toBe("SPAN");
    expect(container.querySelector("p div")).toBeNull();
    const block = renderToStaticMarkup(
      <PrintedDisplayTerms display={d} inline={false}>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: the real compiled KaTeX fixture exercises the source block's existing markup. */}
        <div className="equation-body" dangerouslySetInnerHTML={{ __html: d.html }} />
      </PrintedDisplayTerms>,
    );
    container.innerHTML = block;
    expect(element(".printed-operation-explorer").tagName).toBe("DIV");
    expect(element(".equation-body").parentElement?.tagName).toBe("DIV");
  });
});

describe("source operations use actual compiled nodes", () => {
  test("the keyboard selector reaches the mass coefficient and Escape clears it with focus return", async () => {
    const d = display("eq-s0-d7");
    const coefficient = d.semantics?.operations.find((o) => o.path === "row1.right.args.0");
    if (!coefficient) throw new Error("The mass coefficient must be selectable.");
    await mount(d);
    await open();
    await choose(coefficient.id);
    expect(element("[data-operation-note]").getAttribute("data-operation-note")).toBe(
      coefficient.id,
    );
    expect(element("[data-operation-note]").textContent).toContain("Dimension: mass.");
    const selected = [...container.querySelectorAll("[data-operation-selected]")];
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.some((node) => node.getAttribute("data-op") === coefficient.id)).toBe(true);
    expect(selected.flatMap((node) => node.getAttribute("data-term") ?? []).sort()).toEqual(
      [...coefficient.termIds].sort(),
    );
    const select = element<HTMLSelectElement>("select");
    select.focus();
    await act(async () => {
      handler(
        element(".printed-operation-explorer"),
        "onKeyDown",
      )({
        key: "Escape",
        preventDefault() {},
        stopPropagation() {},
      });
    });
    expect(container.querySelectorAll("[data-operation-selected]")).toHaveLength(0);
    expect(element(".printed-operation-toggle").getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(element(".printed-operation-toggle"));
  });

  test("a fraction/root surface selects its exact operation and keeps the original MathML", async () => {
    const d = display("eq-s0-d1");
    const denominator = d.semantics?.operations.find(
      (o) => o.path === "row1.right.args.1.denominator",
    );
    if (!denominator) throw new Error("The source denominator must be selectable.");
    await mount(d);
    const before = element(".katex-mathml").outerHTML;
    const span = element('[data-op="' + denominator.id + '"]');
    await act(async () => {
      handler(
        element(".printed-operation-explorer"),
        "onClick",
      )({ target: span, preventDefault() {} });
    });
    expect(element("[data-operation-note]").textContent).toContain("speed-dependent denominator");
    expect(element<HTMLSelectElement>("select").value).toBe(denominator.id);
    expect(document.activeElement).toBe(element("select"));
    expect(element(".katex-mathml").outerHTML).toBe(before);
    expect(container.querySelectorAll(".katex [tabindex]")).toHaveLength(0);
  });

  test("a quantity term retains its quantity inspector without opening an operation", async () => {
    await mount();
    const term = element('.katex [data-quantity-id="emittedEnergyRestFrame"]');
    await act(async () => {
      handler(
        element(".printed-operation-explorer"),
        "onClick",
      )({ target: term, preventDefault() {} });
      handler(element("[data-term-highlight]"), "onClick")({ target: term });
    });
    expect(element(".printed-operation-toggle").getAttribute("aria-expanded")).toBe("false");
    expect(element("[data-term-highlight]").getAttribute("data-pinned-quantity-id")).toBe(
      "emittedEnergyRestFrame",
    );
    await open();
    // A real bubbling Escape reaches both the operation and quantity islands.
    await act(async () => {
      element("select").dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(element("[data-term-highlight]").hasAttribute("data-pinned-quantity-id")).toBe(false);
    expect(element(".printed-operation-toggle").getAttribute("aria-expanded")).toBe("false");
  });

  test("selection is announced once and modifier clicks preserve the permanent destination", async () => {
    await mount();
    const before = getAnnouncementCount();
    await open();
    expect(getAnnouncementCount()).toBe(before + 1);
    const current = element<HTMLSelectElement>("select").value;
    await choose(current);
    expect(getAnnouncementCount()).toBe(before + 1);
    let prevented = false;
    await act(async () => {
      handler(
        element(".printed-operation-toggle"),
        "onClick",
      )({
        ctrlKey: true,
        preventDefault() {
          prevented = true;
        },
      });
    });
    expect(prevented).toBe(false);
    expect(element(".printed-operation-toggle").getAttribute("href")).toBe(
      "/equations/mass-energy/eq-s0-d7/#operations",
    );
    expect(
      element(".printed-operation-explorer").querySelectorAll('[role="status"],[aria-live]'),
    ).toHaveLength(0);
  });
});
