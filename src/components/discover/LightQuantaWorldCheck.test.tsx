import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LIGHT_QUANTA_LATER_EVIDENCE } from "../../content/lightQuantaShelf.ts";
import { WORLD_CHECK } from "../../discovery/lightQuanta/journeyI.ts";
import {
  HISTORICAL_CHECK_EXAMPLE,
  PRINTED_STOPPING_CHECK,
} from "../../discovery/lightQuanta/worldCheck.ts";
import { createLq08Session, evaluateLq08 } from "../../experiments/lq08/session.ts";
import { encodeResult } from "../../experiments/results/codec.ts";
import { LightQuantaWorldCheck } from "./LightQuantaWorldCheck.tsx";

type Session = ReturnType<typeof createLq08Session>;
const check = (session?: Session) => (
  <LightQuantaWorldCheck
    example={HISTORICAL_CHECK_EXAMPLE}
    check={WORLD_CHECK}
    printedVolts={PRINTED_STOPPING_CHECK.volts}
    laterEvidence={LIGHT_QUANTA_LATER_EVIDENCE}
    session={session}
  />
);
const quantity = (html: string) =>
  /data-world-check-quantity="stoppingPotentialMagnitude">([^<]*)</.exec(html)?.[1];

/**
 * Journey I's check against the world (dispatch 142). A reader without JavaScript receives LQ-08 at
 * the §8 check, 1.03 × 10¹⁵ per second with the exit cost neglected: 4.26 V on today's constants,
 * beside the paper's 4.34 V from its own.
 */
describe("the check reads LQ-08's accepted snapshot", () => {
  test("the served readout is the snapshot's stopping potential, beside the printed figure", () => {
    const html = renderToStaticMarkup(check());
    expect(quantity(html)).toBe("4.26 V");
    expect(html).toContain("from the paper’s own constants, 4.34 V");
    expect(html).toContain('data-card-id="millikan-1916-photoelectric-h"');
    expect(html).toContain("Later evidence, not on the 1904 shelf");
  });

  test("it reads the snapshot rather than computing from the frequency", () => {
    const real = createLq08Session("world-check-altered", HISTORICAL_CHECK_EXAMPLE);
    const served = real.getServerSnapshot();
    const accepted = served.accepted;
    if (!accepted) throw new Error("the prepared session published nothing");
    const altered = {
      ...served,
      accepted: {
        ...accepted,
        outputs: accepted.outputs.map((o) =>
          o.quantityId === "stoppingPotentialMagnitude" && o.status === "value"
            ? { ...o, value: 3.5 }
            : o,
        ),
      },
    };
    const session: Session = {
      ...real,
      getSnapshot: () => altered,
      getServerSnapshot: () => altered,
    };
    expect(quantity(renderToStaticMarkup(check(session)))).toBe("3.5 V");
  });

  test("below the threshold the owner's own reason is shown, not a zero", () => {
    const parameters = {
      ...HISTORICAL_CHECK_EXAMPLE.parameters,
      frequency: 3e14,
      workFunction: 2.2,
    };
    const outputs = evaluateLq08(parameters);
    const owner = outputs.find((o) => o.quantityId === "stoppingPotentialMagnitude");
    // The owner itself says not-applicable here; the readout must carry its words.
    expect(owner?.status).toBe("not-applicable");
    const below = createLq08Session("world-check-below", {
      ...HISTORICAL_CHECK_EXAMPLE,
      parameters,
      results: outputs.map(encodeResult),
    });
    const shown = quantity(renderToStaticMarkup(check(below)));
    expect(shown).toBe(owner?.status === "not-applicable" ? owner.reason : "no reason");
  });
});

describe("with no accepted snapshot the check refuses", () => {
  test("world-check-snapshot-missing: it throws its code rather than show a potential the laboratory never produced", () => {
    const real = createLq08Session("world-check-refusal", HISTORICAL_CHECK_EXAMPLE);
    const empty = { ...real.getServerSnapshot(), accepted: null };
    const session: Session = { ...real, getSnapshot: () => empty, getServerSnapshot: () => empty };
    expect(() => renderToStaticMarkup(check(session))).toThrow("world-check-snapshot-missing");
    // Positive control: the same real session, snapshot intact, renders the readout.
    expect(renderToStaticMarkup(check(real))).toContain(
      'data-world-check-quantity="stoppingPotentialMagnitude"',
    );
  });
});
