import { describe, expect, test } from "bun:test";
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
});
