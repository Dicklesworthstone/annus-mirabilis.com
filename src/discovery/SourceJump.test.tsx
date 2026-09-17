import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SourceJump } from "./SourceJump.tsx";
import { FIXTURE_JOURNEY_BROWNIAN } from "./testing/fixtureJourney.ts";

describe("SourceJump component rendering", () => {
  const jump = FIXTURE_JOURNEY_BROWNIAN.sourceJumps[0]!;

  test("renders jump label, pointer text, and correct href to the paper section", () => {
    const html = renderToStaticMarkup(<SourceJump jump={jump} />);

    expect(html).toContain("Read Section 4: On the movement of suspended particles");
    expect(html).toContain(
      "This is where the paper connects the diffusion coefficient to osmotic pressure.",
    );
    expect(html).toContain('href="/papers/brownian-motion/s4/#s4-p1"');
    expect(html).toContain("pred-bm-diffusion");
  });
});
