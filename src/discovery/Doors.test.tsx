import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { Doors } from "./Doors.tsx";
import { FIXTURE_JOURNEY_BROWNIAN } from "./testing/fixtureJourney.ts";

describe("Doors component rendering", () => {
  const doors = FIXTURE_JOURNEY_BROWNIAN.doors;

  test("renders front door and side doors with shared arrival equation ID", () => {
    const html = renderToStaticMarkup(<Doors doors={doors} />);

    expect(html).toContain("From Brownian steps to molecular reality");
    expect(html).toContain("The arithmetic of independent coin tosses");
    expect(html).toContain("eq-bm-diffusion-coefficient");
    expect(html).toContain("door-bm-front");
    expect(html).toContain("door-bm-arithmetic");
    expect(html).toContain("entrance-brownian-motion");
  });

  /*
   * The ways into a result read like a book (dispatch 276). They were a filled, bordered section
   * of filled, bordered door cards, under a red monospace "ENTRY PORTALS · FRONT & SIDE DOORS", with
   * the front door ringed in the accent and stamped "FRONT DOOR · PRIMARY ROUTE" in red.
   */
  const readable = {
    ...doors,
    frontDoor: { ...doors.frontDoor, href: "/papers/brownian-motion/s4/#s4-p1" },
  };

  test("it is styled by its stylesheet: the doors are the one container, and nothing is in the accent", () => {
    const html = renderToStaticMarkup(<Doors doors={readable} />);
    expect(html).not.toContain("style=");
    expect(html).toContain('class="journey-doors"');
    expect(html).toContain('class="journey-door"');
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "journeySkeleton.css"),
      "utf8",
    );
    const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(([, selector, body]) => ({
      selector: (selector ?? "").replace(/\/\*[\s\S]*?\*\//g, "").trim(),
      body: body ?? "",
    }));
    const doorRules = rules.filter((r) => /\.journey-doors?\b/.test(r.selector));
    expect(doorRules.length).toBeGreaterThan(0);
    for (const r of doorRules) expect(r.body, r.selector).not.toContain("--accent");
    for (const r of rules.filter((x) => /^\.journey-doors(\s|$|>)/.test(x.selector)))
      expect(/\b(border(-[a-z]+)?|background|box-shadow)\s*:/.test(r.body), r.selector).toBe(false);
  });

  test("its labels are in the reader's words", () => {
    const words = renderToStaticMarkup(<Doors doors={readable} />)
      .replace(/<[^>]+>/g, " ")
      .replace(/&#x27;/g, "'");
    expect(words).not.toMatch(/Entry portals/i);
    expect(words).not.toMatch(/Primary route/i);
    expect(words).toContain("The paper's route");
    expect(words).toContain("Another route");
  });
});
