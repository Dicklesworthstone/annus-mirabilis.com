import { describe, expect, test } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { exportMarkup } from "./exportMarkup.ts";

/**
 * A lab page with controls tells a reader without JavaScript, before the first control, that the
 * controls need it. Swept on live on 2026-09-24 with scripts disabled: eight labs showed presets,
 * prediction choices and Apply buttons that could not respond, with no word why (fixed in
 * 281d1d7a). Two of them did carry a noscript block that named JavaScript, but at the foot of the
 * lab after every control, which is why this checks order and not presence.
 */
const APP = fileURLToPath(new URL("../app/", import.meta.url));

function pages(dir: string, base: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = `${dir}${name}`;
    if (statSync(full).isDirectory()) return pages(`${full}/`, `${base}${name}/`);
    return name === "page.tsx" ? [base] : [];
  });
}

/**
 * Where the first interactive control and the first noscript notice naming JavaScript sit in the
 * markup, or -1. A control inside a noscript block does not count, and neither does a disabled
 * button or a hidden input.
 */
export function noscriptOrder(html: string): { control: number; notice: number } {
  const blocks = [...html.matchAll(/<noscript>([\s\S]*?)<\/noscript>/g)];
  const notice = blocks.find((m) => /JavaScript/.test(m[1] ?? ""))?.index ?? -1;
  // Blank noscript bodies (keeping length) so a control drawn for no-script readers is not counted.
  const outside = html.replace(/<noscript>[\s\S]*?<\/noscript>/g, (m) => " ".repeat(m.length));
  const control =
    outside.search(
      /<button(?![^>]*\bdisabled\b)[\s>]|<input(?![^>]*type="hidden")[\s>]|<select[\s>]|<textarea[\s>]/,
    ) ?? -1;
  return { control, notice };
}

describe("a lab page says its controls need JavaScript before the first control", () => {
  test("the check reads order, ignores noscript content and disabled controls", () => {
    expect(
      noscriptOrder("<noscript><p>JavaScript is off.</p></noscript><button>Go</button>"),
    ).toEqual({
      control: 46,
      notice: 0,
    });
    // The notice after the control: the pre-281d1d7a shape of LQ-05 and LQ-07.
    const late = noscriptOrder(
      "<button>Go</button><noscript><p>(JavaScript disabled)</p></noscript>",
    );
    expect(late.notice).toBeGreaterThan(late.control);
    expect(noscriptOrder('<button disabled="">Go</button><input type="hidden">').control).toBe(-1);
    expect(noscriptOrder("<noscript><button>Go</button></noscript>").control).toBe(-1);
    expect(
      noscriptOrder("<noscript><p>Scripts are off.</p></noscript><select></select>").notice,
    ).toBe(-1);
  });

  test("every lab page with a control carries the notice first", async () => {
    const routes = pages(`${APP}lab/`, "lab/").sort();
    const missing: string[] = [];
    let withControls = 0;
    for (const rel of routes) {
      const mod = await import(`${APP}${rel}page.tsx`);
      const out = mod.default({ params: Promise.resolve({}), searchParams: Promise.resolve({}) });
      const html = await exportMarkup(out instanceof Promise ? await out : out);
      const { control, notice } = noscriptOrder(html);
      if (control < 0) continue;
      withControls += 1;
      if (notice < 0 || notice > control)
        missing.push(
          `${rel}: ${notice < 0 ? "no noscript notice" : "notice after the first control"}`,
        );
    }
    console.log(
      `[noscript notice] ${routes.length} lab pages, ${withControls} with controls; ${missing.length} without a notice first`,
    );
    expect(withControls).toBeGreaterThan(30);
    expect(missing).toEqual([]);
  });
});
