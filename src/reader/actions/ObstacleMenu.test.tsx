import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ObstacleMenu } from "./ObstacleMenu.tsx";
import { OBSTACLE_KIND_IDS } from "./passageActions.schema.ts";

describe("ObstacleMenu", () => {
  test("a hard passage offers every kind; missing answers are unavailable, not invented", () => {
    const html = renderToStaticMarkup(
      <ObstacleMenu
        hard
        passageId="arg-bm-observable"
        passageLabel="Zero average is not no movement"
        responses={{
          algebraicMove: {
            explanation: "Square first.",
            foundationLinks: [
              {
                foundationId: "bridge-squaring-square-roots",
                callingAnchor: "arg-bm-observable",
                returnCaption: "Return to the argument.",
              },
            ],
          },
        }}
      />,
    );
    expect(html).toContain("What is getting in the way?");
    expect(html).toContain("data-obstacle-menu");
    for (const kind of OBSTACLE_KIND_IDS) {
      expect(html).toContain(`data-obstacle-kind="${kind}"`);
    }
    expect(html).toContain("Square first.");
    expect(html).toContain("/foundations/bridge-squaring-square-roots/");
    expect(html).toContain('data-foundation="bridge-squaring-square-roots"');
    expect(html).toContain("data-obstacle-unavailable");
    expect(html).toContain("This answer is not yet authored for this passage.");
    expect(html).not.toContain("see the foundations page");
  });

  test("a hard passage with no authored answers still offers every kind as unavailable", () => {
    const html = renderToStaticMarkup(
      <ObstacleMenu hard passageId="arg-hard" passageLabel="A hard step" responses={undefined} />,
    );
    expect(html).toContain("What is getting in the way?");
    for (const kind of OBSTACLE_KIND_IDS) {
      expect(html).toContain(`data-obstacle-kind="${kind}"`);
      expect(html).toContain("data-obstacle-unavailable");
    }
    expect(html).not.toContain("see the foundations page");
  });

  test("planted negative: no menu when the passage is not hard and has no responses", () => {
    const html = renderToStaticMarkup(
      <ObstacleMenu hard={false} passageId="arg-x" passageLabel="x" responses={undefined} />,
    );
    expect(html).toBe("");
  });
});
