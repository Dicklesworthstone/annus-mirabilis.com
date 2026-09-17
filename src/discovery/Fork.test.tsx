import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Fork } from "./Fork.tsx";
import { FIXTURE_JOURNEY_BROWNIAN } from "./testing/fixtureJourney.ts";

describe("Fork component rendering", () => {
  const forkObservable = FIXTURE_JOURNEY_BROWNIAN.forks[0]!;
  const forkMechanism = FIXTURE_JOURNEY_BROWNIAN.forks[1]!;

  test("renders fork question and varies explanation", () => {
    const html = renderToStaticMarkup(<Fork fork={forkObservable} />);

    expect(html).toContain(
      "Which observable quantity should be measured to characterize the motion?",
    );
    expect(html).toContain("The branches vary what quantity is defined as the primary observable.");
    expect(html).toContain("arg-fork-observable");
  });

  test("renders all branches with labels, hypotheses, and outcomes", () => {
    const html = renderToStaticMarkup(<Fork fork={forkObservable} />);

    expect(html).toContain("Appren-velocity trajectory tracking");
    expect(html).toContain("Exner");
    expect(html).toContain("#card-exner-1900");
    expect(html).toContain("Mean-square displacement scaling");
    expect(html).toContain("The route taken in the 1905 paper");
  });

  test("renders dead-end-on-constraint outcome with constraint link", () => {
    const html = renderToStaticMarkup(<Fork fork={forkMechanism} />);

    expect(html).toContain("Ambient environmental vibrations");
    expect(html).toContain("Constrained by physical contradiction");
    expect(html).toContain("#card-gouy-1888");
  });
});
