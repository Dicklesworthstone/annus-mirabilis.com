/**
 * A printed display's term chip is a real link until JavaScript runs (dispatch 254): AGENTS.md says
 * "No-JavaScript readers get real links, never hydration-dependent buttons", and a disabled chip was
 * one. Each link opens the quantity's entry on /notation/ in the display's own scope, else the
 * paper's entry for it, else its row among the quantities with no entry. After mount the chip is the
 * button that pins the inspector, as before.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import NotationPage from "../../app/notation/page.tsx";
import type { PrintedDisplayPayload } from "../../equations/printed/paperDisplays.ts";
import printedPayload from "../../generated/printed-displays.json";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { PaperPage } from "../PaperPage.tsx";
import { PrintedDisplayTerms } from "./PrintedDisplayTerms.tsx";

const PAPERS = ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"] as const;
const FACES = ["german", "english", "parallel", "gloss"] as const;
const DISPLAYS = (printedPayload as unknown as { displays: readonly PrintedDisplayPayload[] })
  .displays;

const CHIP_LINK = /<a class="term-chip" href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/g;
const decodeEntities = (s: string) =>
  s
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");

describe("a printed display's term chips without JavaScript", () => {
  test("every chip on every face is a link to an id /notation/ has, one destination per link name", async () => {
    const notation = await exportMarkup(await NotationPage());
    const ids = new Set(
      [...notation.matchAll(/\sid="([^"]+)"/g)].map((m) => decodeEntities(m[1] ?? "")),
    );
    let links = 0;
    const targets = new Set<string>();
    const wrong: string[] = [];
    for (const paper of PAPERS)
      for (const face of FACES) {
        const html = await exportMarkup(await PaperPage({ paperId: paper, face } as never));
        const names = new Map<string, Set<string>>();
        for (const m of html.matchAll(CHIP_LINK)) {
          links++;
          const href = decodeEntities(m[1] ?? "");
          const label = /aria-label="([^"]*)"/.exec(m[2] ?? "")?.[1];
          const name = /<span class="equation-legend-name">([^<]*)<\/span>/.exec(m[3] ?? "")?.[1];
          const accessible = decodeEntities(label ?? name ?? "");
          if (!href.startsWith("/notation/#"))
            wrong.push(`${paper}/${face}: ${href} is not /notation/`);
          const id = href.slice("/notation/#".length);
          targets.add(id);
          if (!ids.has(id)) wrong.push(`${paper}/${face}: ${href} names no id on /notation/`);
          if (!accessible) wrong.push(`${paper}/${face}: a chip link to ${href} has no name`);
          else if (label && name && !label.startsWith(name))
            wrong.push(`${paper}/${face}: "${label}" does not begin with the visible "${name}"`);
          (names.get(accessible) ?? names.set(accessible, new Set()).get(accessible))?.add(href);
        }
        for (const [name, hrefs] of names)
          if (hrefs.size > 1)
            wrong.push(`${paper}/${face}: "${name}" links to ${[...hrefs].join(", ")}`);
        // No chip of a printed display is left a disabled button.
        if (
          /<button[^>]*class="term-chip"/.test(
            html.split('class="printed-display-terms"').slice(1).join(""),
          )
        )
          wrong.push(
            `${paper}/${face}: a printed display's chip is still a button before JavaScript`,
          );
      }
    // The denominator: every link examined, and how many places they open.
    console.log(
      `[chip links] ${links} chip links across ${PAPERS.length} papers x ${FACES.length} faces open ${targets.size} distinct places; /notation/ has ${ids.size} ids`,
    );
    expect(links).toBeGreaterThan(0);
    expect(wrong).toEqual([]);
  });

  test("a quantity with no concordance entry in its paper has its own row on /notation/", async () => {
    const rows = DISPLAYS.flatMap((d) =>
      d.legend.filter((l) => l.href.startsWith("/notation/#quantity-")).map((l) => l.href),
    );
    expect(rows.length).toBeGreaterThan(0);
    const notation = await exportMarkup(await NotationPage());
    expect(notation).toContain("In the printed equations, without an entry of their own");
    expect(notation).toContain('id="quantity-special-relativity-electricDeflectability"');
  });
});

describe("after mount, the chip is the button that pins", () => {
  const display = DISPLAYS.find(
    (d) => d.paper === "special-relativity" && d.display === "eq-s6-d4",
  );
  let container: HTMLElement;
  let root: Root;
  beforeEach(async () => {
    await installDom();
    container = createContainer();
    root = createRoot(container);
  });
  afterEach(async () => {
    act(() => root.unmount());
    removeContainer(container);
    await uninstallDom();
  });

  test("the server's links become enabled buttons, and none stays a link", async () => {
    if (!display) throw new Error("relativity's eq-s6-d4 is not in the payload");
    const element = (
      <PrintedDisplayTerms display={display} inline={false}>
        <span />
      </PrintedDisplayTerms>
    );
    const server = renderToStaticMarkup(element);
    const serverLinks = [...server.matchAll(CHIP_LINK)].length;
    expect(serverLinks).toBe(display.legend.length);
    expect(server).toContain('href="/notation/#sr.V.speedOfLight"');

    await act(async () => root.render(element));
    const chips = [...container.querySelectorAll(".term-chip")];
    expect(chips.length).toBe(display.legend.length);
    expect(chips.every((c) => c.tagName === "BUTTON" && !c.hasAttribute("disabled"))).toBe(true);
    expect(container.querySelector("a.term-chip")).toBeNull();
  });
});
