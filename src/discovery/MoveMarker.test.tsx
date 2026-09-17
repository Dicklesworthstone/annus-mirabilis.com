import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MoveMarker } from "./MoveMarker.tsx";
import { FIXTURE_JOURNEY_BROWNIAN } from "./testing/fixtureJourney.ts";

describe("MoveMarker component rendering", () => {
  const move = FIXTURE_JOURNEY_BROWNIAN.move;

  test("renders move label, chain/step ID, plain language summary, and reviewed badge", () => {
    const html = renderToStaticMarkup(<MoveMarker move={move} />);

    expect(html).toContain("Equipartition to Suspended Particles");
    expect(html).toContain("chain-bm-diffusion");
    expect(html).toContain("bm-step-move-osmotic");
    expect(html).toContain("Treating suspended microscopic particles as gas molecules obeying the laws of heat relates their diffusion rate to Avogadro&#x27;s number.");
    expect(html).toContain("reviewed");
  });
});
