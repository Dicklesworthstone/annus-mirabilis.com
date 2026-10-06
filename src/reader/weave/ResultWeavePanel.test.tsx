import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { WovenTracerLab } from "../../components/lab/WovenTracerLab.tsx";
import { createBm01Session, type PreparedBm01Example } from "../../experiments/bm01/session.ts";
import example from "../../generated/bm01-example.json";

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
