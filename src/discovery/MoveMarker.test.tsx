import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { MoveMarker } from "./MoveMarker.tsx";
import { FIXTURE_JOURNEY_BROWNIAN } from "./testing/fixtureJourney.ts";

/**
 * The move marker names the move as the move and says it in the reader's words (dispatch 276).
 *
 * Until then it printed the summary's review state beside the link ("draft", against
 * D-2026-09-25-no-review-status-banners), the chain and step ids when it had no link (the
 * build's names, which a reader cannot use), and a red monospace "THE MOVE" in a box with a 2px
 * accent border and a shadow, the loudest thing on every journey. The accent marks where a reader
 * is and what they point at; a box drawn in it reads as an error (globals.css, CALLOUTS).
 */
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

describe("MoveMarker", () => {
  const move = FIXTURE_JOURNEY_BROWNIAN.move;
  const draft = { ...move, r0Summary: { ...move.r0Summary, reviewState: "draft" as const } };

  test("names the move, gives its label and its summary, and links to the step", () => {
    const html = renderToStaticMarkup(<MoveMarker move={move} href="/papers/x/#arg" />);
    expect(text(html)).toContain("The move");
    expect(text(html)).toContain("Equipartition to Suspended Particles");
    expect(text(html)).toContain(
      "Treating suspended microscopic particles as gas molecules obeying the laws of heat relates their diffusion rate to Avogadro's number.",
    );
    expect(html).toContain('href="/papers/x/#arg"');
  });

  test("never prints the summary's review state, reviewed or draft", () => {
    for (const m of [move, draft]) {
      const words = text(renderToStaticMarkup(<MoveMarker move={m} href="/papers/x/#arg" />));
      expect(words).not.toMatch(/\bdraft\b/i);
      expect(words).not.toMatch(/\breviewed\b/i);
    }
  });

  test("without a link it prints no chain or step id", () => {
    const html = renderToStaticMarkup(<MoveMarker move={move} />);
    expect(html).not.toContain(move.chainId);
    expect(html).not.toContain(move.stepId);
    expect(html).not.toContain("<a ");
  });

  test("is styled by its stylesheet, which draws no accent box and no shadow", () => {
    const html = renderToStaticMarkup(<MoveMarker move={move} href="/papers/x/#arg" />);
    expect(html).not.toContain("style=");
    expect(html).toContain('class="move-marker"');
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "journeySkeleton.css"),
      "utf8",
    );
    const rules = [...css.matchAll(/(\.move-marker[^{]*)\{([^}]*)\}/g)];
    expect(rules.length).toBeGreaterThan(0);
    for (const [, selector, body] of rules) {
      expect(`${selector}{${body}}`).not.toContain("--accent");
      expect(`${selector}{${body}}`).not.toContain("box-shadow");
    }
  });
});
