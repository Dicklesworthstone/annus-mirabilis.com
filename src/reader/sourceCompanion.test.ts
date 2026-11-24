import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { installDom, uninstallDom } from "../testing/reactDom.ts";
import {
  BROWNIAN_GERMAN_SOURCE_HREF,
  extractSourceCompanion,
  followSourceCompanionLink,
} from "./sourceCompanion.ts";

// Structural adversarial fixtures test the HTML boundary. The companion's actual German words
// and formulas are exercised separately against every bound target in BrownianSourceEdition.
const page = (body: string) => `<main data-reader-root data-face="german">${body}</main>`;
const block = (body: string) => `<div data-block-wrapper="s4-p1"><p id="s4-p1">${body}</p></div>`;

beforeEach(installDom);
afterEach(uninstallDom);

describe("canonical source fragment boundary", () => {
  test("active content and inert controls are removed while safe source links and mathematical markup remain", () => {
    const html = page(
      block(`Text
      <script>window.bad = true</script><iframe src="https://example.com"></iframe>
      <a href="javascript:alert(1)" onclick="alert(1)">unsafe</a>
      <a href="data:text/html,bad" ping="https://example.com/ping">unsafe data</a>
      <a href="/sources/#printed-correction">Correction record</a>
      <button data-align-sentences-control="true">Align sentences</button>
      <button data-action="show-aligned-target">Show English translation</button>
      <button disabled class="term-chip" aria-pressed="false">Quantity legend</button>
      <span onmouseover="bad()" style="background:url(javascript:bad())">Unsafe style</span>
      <span style="vertical-align:-0.5em">Preserved math layout</span>
      <math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mi>x</mi><annotation encoding="application/x-tex">x</annotation></semantics></math>
      <svg><animate attributeName="href" values="javascript:bad()"/><use href="https://example.com/image.svg#p"/><path d="M0 0L1 1"/></svg>`),
    );
    const fragment = extractSourceCompanion(html, "s4-p1", document, "column");
    assert.ok(fragment);
    expect(fragment.querySelector("script, iframe, button, animate")).toBeNull();
    expect(fragment.querySelector("[onclick], [onmouseover], [ping]")).toBeNull();
    expect(fragment.querySelector('a[href^="javascript:"], a[href^="data:"]')).toBeNull();
    expect(fragment.querySelector("use")?.hasAttribute("href")).toBe(false);
    expect(fragment.querySelector("path")?.getAttribute("d")).toBe("M0 0L1 1");
    expect(fragment.textContent).toContain("Quantity legend");
    expect(fragment.textContent).not.toContain("Align sentences");
    expect(fragment.textContent).not.toContain("Show English translation");
    expect(fragment.querySelector('a[href="/sources/#printed-correction"]')).not.toBeNull();
    expect(fragment.querySelector('span[style="vertical-align:-0.5em"]')).not.toBeNull();
    expect(fragment.querySelector('[style*="url"]')).toBeNull();
    expect(fragment.querySelector("math mi")?.textContent).toBe("x");
    expect(fragment.querySelector('annotation[encoding="application/x-tex"]')?.textContent).toBe(
      "x",
    );
  });

  test("one note travels with each source reference and every copied ID and ID reference belongs to its slot", () => {
    const html = page(
      block(`<span id="s4-p1-s1" aria-describedby="note-1 outside">Text</span>
      <sup id="ref-note-1"><a data-footnote-ref="note-1" href="#footnote-note-1" aria-describedby="footnote-note-1">1</a></sup>
      <a href="${BROWNIAN_GERMAN_SOURCE_HREF}#s4-p1-s1">Sentence</a>`) +
        `<ol><li id="footnote-note-1" data-footnote-id="note-1"><span id="note-1"></span>Note text
      <a href="#ref-note-1">Back</a></li></ol>`,
    );
    const column = extractSourceCompanion(html, "s4-p1", document, "column");
    const sheet = extractSourceCompanion(html, "s4-p1", document, "sheet");
    assert.ok(column && sheet);
    expect(column.querySelectorAll("[data-footnote-id]").length).toBe(1);
    expect(column.querySelector('[id="column-s4-p1-s1"]')?.getAttribute("aria-describedby")).toBe(
      "column-note-1",
    );
    expect(column.querySelector('[data-footnote-ref="note-1"]')?.getAttribute("href")).toBe(
      "#column-footnote-note-1",
    );
    expect(column.querySelector('a[href="#column-s4-p1-s1"]')).not.toBeNull();
    expect(column.querySelector('a[href="#column-ref-note-1"]')).not.toBeNull();
    const ids = [...column.querySelectorAll("[id]"), ...sheet.querySelectorAll("[id]")].map(
      (node) => node.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("a directly selected note contains its whole text and sends an out-of-excerpt backlink to the canonical page", () => {
    const html = page(
      '<ol><li id="footnote-note-1" data-footnote-id="note-1"><span id="note-1"></span>The complete note.<a href="#ref-note-1">Back</a></li></ol>',
    );
    const fragment = extractSourceCompanion(html, "note-1", document, "direct");
    assert.ok(fragment);
    expect(fragment.querySelector("ol > li")?.textContent).toContain("The complete note.");
    expect(fragment.querySelector("a")?.getAttribute("href")).toBe(
      `${BROWNIAN_GERMAN_SOURCE_HREF}#ref-note-1`,
    );
  });

  test("missing targets, a wrong face, unresolved footnotes and duplicate source IDs refuse instead of guessing", () => {
    expect(
      extractSourceCompanion(page(block("Text")), "another-paragraph", document, "slot"),
    ).toBeNull();
    expect(
      extractSourceCompanion(
        '<main data-face="english"><div data-block-wrapper="s4-p1">Text</div></main>',
        "s4-p1",
        document,
        "slot",
      ),
    ).toBeNull();
    expect(
      extractSourceCompanion(
        page(block('<a data-footnote-ref="missing" href="#footnote-missing">1</a>')),
        "s4-p1",
        document,
        "slot",
      ),
    ).toBeNull();
    expect(
      extractSourceCompanion(
        page(block('<span id="s4-p1">Duplicated identity</span>')),
        "s4-p1",
        document,
        "slot",
      ),
    ).toBeNull();
    expect(
      extractSourceCompanion(page(block("Text")), "s4-p1", document, "invalid prefix"),
    ).toBeNull();
  });

  test("a footnote jump stays inside the companion without changing the reading URL or viewport", () => {
    window.history.replaceState({}, "", "/papers/brownian-motion/s4/#argument-kept");
    const surface = document.createElement("aside");
    surface.setAttribute("data-reader-companion-column", "");
    const body = extractSourceCompanion(
      page(block('<a href="#s4-p1">Return</a>')),
      "s4-p1",
      document,
      "column",
    );
    assert.ok(body);
    surface.append(body);
    document.body.append(surface);
    const link = body.querySelector("a");
    const destination = body.querySelector<HTMLElement>("p[id]");
    assert.ok(link && destination);
    surface.getBoundingClientRect = () => ({ top: 20 }) as DOMRect;
    destination.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
    let scrolls = 0;
    window.scrollBy = () => {
      scrolls++;
    };
    const before = window.location.href;
    body.addEventListener("click", (event) => followSourceCompanionLink(event, body));
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(destination);
    expect(surface.scrollTop).toBe(80);
    expect(window.location.href).toBe(before);
    expect(scrolls).toBe(0);
    const modified = new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true });
    link.dispatchEvent(modified);
    expect(modified.defaultPrevented).toBe(false);
  });
});
