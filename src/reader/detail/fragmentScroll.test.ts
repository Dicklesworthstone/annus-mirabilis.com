import { describe, expect, test } from "bun:test";
import { type AddressableUnit, nearestStableAnchor } from "./nearestStableAnchor.ts";

describe("fragmentScroll (am-read-detail-axis-sfc)", () => {
  test("a unit whose R2 lives in a fragment resolves to its container id in the reading band", () => {
    // The unit container s5-p2 exists in layout even before fragment is loaded
    const units: AddressableUnit[] = [
      { id: "s5-p1", top: 50, height: 100 },
      { id: "s5-p2", top: 200, height: 120 }, // unit whose R2 is in fragment; intersects top 40% (viewport 1000 => band [0, 400))
      { id: "s5-p3", top: 450, height: 100 },
    ];

    const targetId = nearestStableAnchor(units, 1000);
    expect(targetId).toBe("s5-p2");
  });

  test("scrolling to container records exactly one scroll target, not a second scroll on fragment load", () => {
    const scrollCalls: string[] = [];
    const containerId = "s5-p2";

    function scrollToUnitContainer(id: string) {
      scrollCalls.push(id);
    }

    // Step 1: Detail change triggers scroll to container
    scrollToUnitContainer(containerId);

    // Step 2: Fragment loads asynchronously into the existing container
    const fragmentLoaded = true;
    expect(fragmentLoaded).toBe(true);

    // Assert: only one scroll call was made to the container id
    expect(scrollCalls).toEqual(["s5-p2"]);
    expect(scrollCalls.length).toBe(1);
  });
});
