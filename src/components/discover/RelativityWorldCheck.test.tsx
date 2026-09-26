import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SPECIAL_RELATIVITY_LATER_EVIDENCE } from "../../content/specialRelativityShelf.ts";
import { WORLD_CHECK } from "../../discovery/relativity/journeyIII.ts";
import {
  CHECK_PRESET_ID,
  MOVING_CLOCK_CHECK_EXAMPLE,
} from "../../discovery/relativity/worldCheck.ts";
import { SR05_PRESETS } from "../../experiments/sr05/definition.ts";
import { createSr05Session } from "../../experiments/sr05/session.ts";
import { RelativityWorldCheck } from "./RelativityWorldCheck.tsx";

type Session = ReturnType<typeof createSr05Session>;
const check = (session?: Session) => (
  <RelativityWorldCheck
    example={MOVING_CLOCK_CHECK_EXAMPLE}
    check={WORLD_CHECK}
    laterEvidence={SPECIAL_RELATIVITY_LATER_EVIDENCE}
    session={session}
  />
);
const quantity = (html: string, id: string) =>
  new RegExp(`data-world-check-quantity="${id}">([^<]*)<`).exec(html)?.[1];

/**
 * Journey III's check against the world (dispatch 260). A reader without JavaScript receives SR-05
 * at its first preset, one clock at 0.6c for 10 s of the resting clocks: 8 s on the moving clock.
 */
describe("the check reads SR-05's accepted snapshot", () => {
  test("the served readout is the snapshot's two clock readings and the loss per second", () => {
    const html = renderToStaticMarkup(check());
    expect(quantity(html, "coordinateTime")).toBe("10 s");
    expect(quantity(html, "properTime")).toBe("8 s");
    expect(quantity(html, "dilationLossExact")).toBe("0.2 s");
    // The embedded laboratory and the readout share one session: one SR-05 on the check.
    expect(html.match(/data-instrument-id="sr-05"/g)?.length).toBe(1);
  });

  test("it opens at the registered preset, one clock in a straight line, not the lab's default", () => {
    // Were the preset renamed, worldCheck.ts would fall back to SR-05's default, out and back, which
    // also reads 8 s for 10 s: only the parameters tell the two apart.
    expect(SR05_PRESETS[CHECK_PRESET_ID]).toBeDefined();
    expect(MOVING_CLOCK_CHECK_EXAMPLE.parameters).toEqual(
      SR05_PRESETS[CHECK_PRESET_ID]?.parameters ?? {},
    );
    expect(MOVING_CLOCK_CHECK_EXAMPLE.parameters.worldlinePreset).toBe("inertial");
    expect(renderToStaticMarkup(check())).toContain("in a straight line");
  });

  test("it reads the snapshot rather than computing from the speed", () => {
    const real = createSr05Session("world-check-altered", MOVING_CLOCK_CHECK_EXAMPLE);
    const served = real.getServerSnapshot();
    const accepted = served.accepted;
    if (!accepted) throw new Error("the prepared session published nothing");
    const altered = {
      ...served,
      accepted: {
        ...accepted,
        outputs: accepted.outputs.map((o) =>
          o.quantityId === "properTime" && o.status === "value" ? { ...o, value: 7.5 } : o,
        ),
      },
    };
    const session: Session = {
      ...real,
      getSnapshot: () => altered,
      getServerSnapshot: () => altered,
    };
    // A readout computed from the speed would still say 8 s; the snapshot says 7.5.
    expect(quantity(renderToStaticMarkup(check(session)), "properTime")).toBe("7.5 s");
  });

  test("the later measurement is a card beside it, stated in words, with no number of its own", () => {
    const html = renderToStaticMarkup(check());
    expect(html).toContain("Later evidence, not on the 1904 shelf");
    expect(html).toContain('data-card-id="ives-stilwell-1938-moving-atomic-clock"');
    const said = /data-world-check-later-measurement[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1] ?? "";
    expect(said).toContain("Ives and Stilwell");
    expect(said).toContain("no table");
    // Stated without data: the sentence's only numbers are two years, theirs and the shelf's.
    expect(said.replace(/<[^>]+>/g, "").match(/\d+(\.\d+)?/g)).toEqual(["1938", "1904"]);
  });
});

describe("with no accepted snapshot the check refuses", () => {
  test("world-check-snapshot-missing: it throws its code rather than show a reading the laboratory never produced", () => {
    // A real session whose snapshot reports nothing accepted, the state a store is in before its
    // first result is published: an embedder's session is the route into this site.
    const real = createSr05Session("world-check-refusal", MOVING_CLOCK_CHECK_EXAMPLE);
    const empty = { ...real.getServerSnapshot(), accepted: null };
    const session: Session = { ...real, getSnapshot: () => empty, getServerSnapshot: () => empty };
    expect(() => renderToStaticMarkup(check(session))).toThrow("world-check-snapshot-missing");
    // Positive control: the same real session, snapshot intact, renders the readout.
    expect(renderToStaticMarkup(check(real))).toContain('data-world-check-quantity="properTime"');
  });
});
