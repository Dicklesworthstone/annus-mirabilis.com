import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  contentIdFromDomId,
  hashTargetInPane,
  paneDataAnchor,
  paneDomId,
  SECONDARY_PANE_PREFIX,
} from "./paneIds.ts";

const IDS = ["s4-p2-s1", "s4-p2-s2", "eq-s4-1", "s4-fn1"] as const;

describe("pane DOM ids are unique in split view", () => {
  test("the primary pane uses the bare content id", () => {
    expect(paneDomId("s4-p2-s1", "primary")).toBe("s4-p2-s1");
    expect(paneDataAnchor("s4-p2-s1", "primary")).toBeUndefined();
  });

  test("the secondary pane prefixes pane-b-- and carries data-anchor", () => {
    expect(paneDomId("s4-p2-s1", "secondary")).toBe(`${SECONDARY_PANE_PREFIX}s4-p2-s1`);
    expect(paneDataAnchor("s4-p2-s1", "secondary")).toBe("s4-p2-s1");
  });

  test("PLANTED: single and split markup have no duplicate ids", () => {
    const single = IDS.map((id) => paneDomId(id, "primary"));
    expect(new Set(single).size).toBe(single.length);

    const split = [
      ...IDS.map((id) => paneDomId(id, "primary")),
      ...IDS.map((id) => paneDomId(id, "secondary")),
    ];
    expect(new Set(split).size).toBe(split.length);
    expect(split).toContain("s4-p2-s1");
    expect(split).toContain(`${SECONDARY_PANE_PREFIX}s4-p2-s1`);
  });

  test("hash navigation in the secondary pane resolves through data-anchor, not the prefixed id as the content id", () => {
    expect(hashTargetInPane("#s4-p2-s1", "secondary")).toBe(`${SECONDARY_PANE_PREFIX}s4-p2-s1`);
    expect(contentIdFromDomId(hashTargetInPane("#s4-p2-s1", "secondary"))).toBe("s4-p2-s1");
  });
});

describe("domIds.integration: rendered split HTML", () => {
  test("a two-pane render never repeats an id attribute", () => {
    const html = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(
          "div",
          { "data-pane": "primary" },
          ...IDS.map((id) => createElement("p", { id: paneDomId(id, "primary"), key: id }, id)),
        ),
        createElement(
          "div",
          { "data-pane": "secondary" },
          ...IDS.map((id) =>
            createElement(
              "p",
              {
                id: paneDomId(id, "secondary"),
                "data-anchor": paneDataAnchor(id, "secondary"),
                key: `b-${id}`,
              },
              id,
            ),
          ),
        ),
      ),
    );
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].flatMap((m) =>
      m[1] === undefined ? [] : [m[1]],
    );
    expect(ids.length).toBe(IDS.length * 2);
    expect(new Set(ids).size).toBe(ids.length);
    expect(html).toContain(`data-anchor="s4-p2-s1"`);
  });
});
