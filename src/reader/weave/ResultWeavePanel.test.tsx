import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { WovenTracerLab } from "../../components/lab/WovenTracerLab.tsx";
import { createBm01Session, type PreparedBm01Example } from "../../experiments/bm01/session.ts";
import { createSr11Session } from "../../experiments/sr11/session.ts";
import example from "../../generated/bm01-example.json";
import { SR11_LAB_READER_WEAVE } from "./mirrorPassages.ts";
import { type ReaderWeaveBinding, SessionResultWeave } from "./SessionResultWeave.tsx";

test("the real prepared tracer example reaches the reader panel without starting another worker", () => {
  let workers = 0;
  const session = createBm01Session("weave-ssr", example as PreparedBm01Example, () => {
    workers++;
    throw new Error("SSR must not start a worker");
  });
  const before = session.getSnapshot().accepted;
  const html = renderToStaticMarkup(
    <WovenTracerLab example={example as PreparedBm01Example} session={session} />,
  );
  expect(workers).toBe(0);
  expect(session.getSnapshot().accepted).toBe(before);
  expect(html).toContain("What this trial points to in the paper");
  expect(html).toContain("Prepared worked example");
  expect(html).toContain("/papers/brownian-motion/view/german/#s4-p6-s9");
  expect(html).toContain("/papers/brownian-motion/view/english/#s4-p10-s7");
  expect(html).toContain("not empirical evidence");
  expect(html).not.toContain("sample size 400, seed 1905");
});

test("finite scalar availability has a readable description while ordinary thresholds retain their bounds", () => {
  const session = createSr11Session("finite-threshold-presentation");
  const binding: ReaderWeaveBinding = {
    ...SR11_LAB_READER_WEAVE,
    predicates: SR11_LAB_READER_WEAVE.predicates.map((predicate) =>
      predicate.id === "sr11-energy-balance"
        ? {
            ...predicate,
            conditions: [
              {
                kind: "threshold",
                quantityId: "workRate",
                direction: "at-least",
                enter: -Number.MAX_VALUE,
                exit: -Number.MAX_VALUE,
              },
              {
                kind: "threshold",
                quantityId: "frequencyRatio",
                direction: "at-least",
                enter: 0.2,
                exit: 0.1,
              },
            ],
          }
        : predicate,
    ),
  };
  const html = renderToStaticMarkup(<SessionResultWeave session={session} binding={binding} />);
  expect(html).toContain("workRate: a finite scalar reading.");
  expect(html).toContain("frequencyRatio: at-least; enter 0.2, exit 0.1.");
  expect(html).not.toContain("e+308");
});
