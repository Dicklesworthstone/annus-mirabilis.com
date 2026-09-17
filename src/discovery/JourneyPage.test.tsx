import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { JourneyPage } from "./JourneyPage.tsx";
import { FIXTURE_JOURNEY_BROWNIAN, FIXTURE_PARTIAL_JOURNEY } from "./testing/fixtureJourney.ts";

describe("JourneyPage container component rendering", () => {
  test("renders complete Brownian motion journey with data-theme slate and all sections", () => {
    const html = renderToStaticMarkup(<JourneyPage journey={FIXTURE_JOURNEY_BROWNIAN} />);

    expect(html).toContain('data-journey-id="brownian-motion"');
    expect(html).toContain('data-theme="slate"');
    expect(html).toContain("Suspended microscopic particles in a liquid at rest never settle into permanent stillness.");
    expect(html).toContain("How can the thermal agitation of invisible molecules produce observable microscopic motion?");
    expect(html).toContain("#card-osmotic-pressure");
    expect(html).toContain("The Consequential Move");
    expect(html).toContain("World Checks · Testing the Consequences");
    expect(html).toContain("Connecting to the 1905 Paper");
    expect(html).toContain("Entry Portals · Front &amp; Side Doors");
  });

  test("renders partial journey with declared pending elements banner", () => {
    const html = renderToStaticMarkup(<JourneyPage journey={FIXTURE_PARTIAL_JOURNEY} />);

    expect(html).toContain("Draft Journey · Pending Elements Declared");
    expect(html).toContain("worldChecks:");
    expect(html).toContain("Photoelectric and photoluminescence data checks in preparation.");
    expect(html).toContain("am-disc-journey-i-chain-n1lh");
  });
});
