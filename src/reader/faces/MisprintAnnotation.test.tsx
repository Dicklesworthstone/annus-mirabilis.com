/**
 * A marked misprint on the German face (dispatch 262): the printed word stays, its note says what
 * was meant, and a retracted record marks nothing.
 *
 * The blocks are the real content records, validated as the compiler validates them, and the notes
 * come from the real receipts (misprints.ts). misprintMarkers.test.ts checks which records are
 * marked; this file checks what a marked word renders.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { misprintNotes } from "../../content/provenance/misprints.ts";
import { parseYaml } from "../../content/provenance/yaml.ts";
import { type Inline, plainText, validateInline } from "../../content/schemas/inlines.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { renderInlines } from "./inlines.tsx";

function block(path: string): { inlines: Inline[]; diplomaticText: string } {
  const y = parseYaml(readFileSync(path, "utf8")) as {
    inlines: unknown[];
    diplomaticText: string;
  };
  return {
    inlines: y.inlines.map((node, i) => validateInline(node, `${path}.inlines[${i}]`)),
    diplomaticText: y.diplomaticText,
  };
}
const MARKED = [
  ["content/source-blocks/special-relativity/part-2.yaml", "err-typo-p907-1", "Eektrodynamischer"],
  ["content/source-blocks/special-relativity/s7.yaml", "err-typo-p910-1", "Doppeler"],
  ["content/source-blocks/brownian-motion/s4-p10.yaml", "err-typo-p558-1", "Koordinaten"],
] as const;
/** Visible text of server markup: tags removed, entities for the characters these blocks use. */
function visibleText(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

describe("a printed misprint on the German face", () => {
  test("marking changes no German character, as data and as served", () => {
    for (const [path, recordId, printed] of MARKED) {
      const b = block(path);
      expect(plainText(b.inlines), path).toBe(b.diplomaticText);
      const html = renderToStaticMarkup(renderInlines(b.inlines));
      expect(html, path).toContain(`data-misprint="${recordId}"`);
      expect(html, path).toContain(`>${printed}</a>`);
      // Without JavaScript the printed word is a link to its record, and no button hides it.
      expect(html, path).toContain(`href="/sources/#${recordId}"`);
      expect(html, path).not.toContain("<button");
      // The text a reader sees is the printed text: the note is not in the served markup. Blocks
      // with inline mathematics serve KaTeX markup, so only the math-free heading is compared.
      if (!b.inlines.some((n) => n.kind === "math"))
        expect(visibleText(html), path).toBe(b.diplomaticText);
    }
  });

  describe("once the page has hydrated", () => {
    let container: HTMLElement;
    beforeEach(async () => {
      await installDom();
      container = createContainer();
    });
    afterEach(async () => {
      removeContainer(container);
      await uninstallDom();
    });

    test("err-typo-p907-1 opens its note: so printed, the reading meant, and the record's reason", async () => {
      const note = misprintNotes().get("err-typo-p907-1");
      expect(note?.reading).toBe("Elektrodynamischer");
      const root = createRoot(container);
      await act(async () => {
        root.render(<h2>{renderInlines(block(MARKED[0][0]).inlines)}</h2>);
      });
      const trigger = container.querySelector<HTMLButtonElement>(
        '[data-misprint-trigger="err-typo-p907-1"]',
      );
      expect(trigger?.textContent).toBe("Eektrodynamischer");
      expect(trigger?.getAttribute("aria-expanded")).toBe("false");
      // Closed, the heading reads as printed.
      expect(container.textContent).toBe("II. Eektrodynamischer Teil.");
      await act(async () => {
        trigger?.click();
      });
      const opened = container.querySelector('[data-misprint-note="err-typo-p907-1"]');
      expect(trigger?.getAttribute("aria-expanded")).toBe("true");
      expect(opened?.textContent).toContain("So printed. Read: Elektrodynamischer.");
      expect(opened?.textContent).toContain("Dropped 'l' in the part heading");
      expect(opened?.querySelector("i")?.textContent).toBe("Elektrodynamischer");
      expect(opened?.querySelector("a")?.getAttribute("href")).toBe("/sources/#err-typo-p907-1");
      await act(async () => root.unmount());
    });
  });

  test("validateInline refuses a misprint without its word or its record (misprint-without-record)", () => {
    const valid = { kind: "misprint", text: "Eektrodynamischer", recordId: "err-typo-p907-1" };
    expect(validateInline(valid, "ok")).toEqual(valid as Inline);
    for (const bad of [
      { kind: "misprint", text: "", recordId: "err-typo-p907-1" },
      { kind: "misprint", text: "Eektrodynamischer" },
      { kind: "misprint", text: "Eektrodynamischer", recordId: "Err Typo" },
    ]) {
      let code: unknown;
      try {
        validateInline(bad, "bad");
      } catch (error) {
        code = (error as { code?: unknown }).code;
      }
      expect(code, JSON.stringify(bad)).toBe("misprint-without-record");
    }
  });

  describe("a misprint inside an inline formula (dispatch 270)", () => {
    // Relativity s6-p3 prints (X', Y' Z') with the comma after Y' dropped (err-typo-p908-1).
    const PATH = "content/source-blocks/special-relativity/s6-p3.yaml";
    const ID = "err-typo-p908-1";

    test("keeps the printed LaTeX and the block's text, and without JavaScript links the set formula to its record", () => {
      const b = block(PATH);
      const marker = b.inlines.find((n) => n.kind === "misprint" && n.recordId === ID) as
        | { math?: { latex?: string } }
        | undefined;
      expect(marker?.math?.latex).toBe("(X', Y' Z')");
      expect(plainText(b.inlines)).toBe(b.diplomaticText);
      const html = renderToStaticMarkup(renderInlines(b.inlines));
      const link = html.split(`data-misprint="${ID}"`)[1]?.split("</a>")[0] ?? "";
      expect(html).toContain(`href="/sources/#${ID}"`);
      // The formula is set by KaTeX inside the link, as any inline formula is, never as TeX text.
      expect(link).toContain('class="inline-math"');
      expect(link).toContain("katex");
      expect(html).not.toContain("<button");
    });

    test("opens its note: the formula as printed, and the formula meant", async () => {
      await installDom();
      const container = createContainer();
      try {
        const note = misprintNotes().get(ID);
        expect(note?.formula).toEqual({ printed: "(X', Y' Z')", reading: "(X', Y', Z')" });
        const root = createRoot(container);
        await act(async () => {
          root.render(<p>{renderInlines(block(PATH).inlines)}</p>);
        });
        const trigger = container.querySelector<HTMLButtonElement>(
          `[data-misprint-trigger="${ID}"]`,
        );
        expect(trigger?.querySelector(".katex")).not.toBeNull();
        expect(trigger?.getAttribute("aria-label")).toContain("so printed; read");
        await act(async () => {
          trigger?.click();
        });
        const opened = container.querySelector(`[data-misprint-note="${ID}"]`);
        expect(opened?.textContent).toContain("So printed: ");
        expect(opened?.textContent).toContain("The comma between the second and third components");
        const formulas = [...(opened?.querySelectorAll(".katex") ?? [])];
        expect(formulas.length).toBe(2);
        const tex = formulas.map((f) => f.querySelector("annotation")?.textContent);
        expect(tex).toEqual(["(X', Y' Z')", "(X', Y', Z')"]);
        await act(async () => root.unmount());
      } finally {
        removeContainer(container);
        await uninstallDom();
      }
    });

    test("validateInline refuses a misprint whose formula is a display, is missing, or comes with text", () => {
      const valid = {
        kind: "misprint",
        recordId: ID,
        math: { kind: "math", latex: "(X', Y' Z')" },
      };
      expect(validateInline(valid, "ok")).toEqual(valid as Inline);
      const codeOf = (bad: unknown) => {
        try {
          validateInline(bad, "bad");
        } catch (error) {
          return (error as { code?: unknown }).code;
        }
        return "accepted";
      };
      for (const bad of [
        { kind: "misprint", recordId: ID, math: { kind: "math", latex: "x", display: true } },
        { kind: "misprint", recordId: ID, math: { kind: "text", text: "x" } },
        { kind: "misprint", recordId: ID, math: "x" },
        { kind: "misprint", recordId: ID, text: "x", math: { kind: "math", latex: "x" } },
      ])
        expect(codeOf(bad), JSON.stringify(bad)).toBe("misprint-formula-not-inline");
      for (const recordId of [undefined, "Err Typo"])
        expect(codeOf({ kind: "misprint", recordId, math: { kind: "math", latex: "x" } })).toBe(
          "misprint-formula-without-record",
        );
    });
  });

  test("a retracted record, or an id no receipt holds, renders the word and no marker", () => {
    // err-typo-p899-1 is retracted: the printed H is capital Eta, and correct.
    expect(misprintNotes().has("err-typo-p899-1")).toBe(false);
    for (const recordId of ["err-typo-p899-1", "err-typo-p000-9"]) {
      const html = renderToStaticMarkup(renderInlines([{ kind: "misprint", text: "H", recordId }]));
      expect(html, recordId).not.toContain("data-misprint");
      expect(html, recordId).not.toContain("<a");
      expect(visibleText(html), recordId).toBe("H");
    }
  });
});
