import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import RodSimultaneityPage from "../app/lab/sr-03/page.tsx";
import { type FrameId, RodStripPlot } from "../components/lab/RodSimultaneityPlots.tsx";
import { SR03_DEFAULTS } from "../experiments/sr03/definition.ts";
import { evaluateSr03 } from "../workers/operations/sr03.ts";
import { exportMarkup } from "./exportMarkup.ts";

/**
 * SR-03's verdict never calls a separation the rod's length unless it is one.
 *
 * The default pair is two platform marks 10 ls apart, simultaneous in K. The verdict said "their
 * separation is a distance in frame K: 10.00 ls" directly under a strip drawing the rod at 8.00 ls
 * in K, and a reader took 10 ls for the moving rod's length (live 095fe596, 390 and 1440 px).
 *
 * For every endpoint pair, rest frame and measuring frame at 0.6c, the owner's outputs are drawn
 * through the strip figure and its verdict is read against the strip for the measuring frame: a
 * verdict that names the rod's length gives the strip's number, and a verdict about readings that
 * are not the rod's ends says so and gives the rod's own length, the strip's number.
 */
const PAIRS = [
  "platform-simultaneous",
  "frame-simultaneous",
  "causal-timelike",
  "causal-lightlike",
  "causal-threshold",
  "custom",
] as const;
const FRAMES: readonly FrameId[] = ["K", "k"];

// Entities decoded: the markup writes "rod's" as "rod&#x27;s", and an undecoded match never fires.
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

async function stripFor(endpointPairId: string, rodRestFrame: FrameId, measuringFrame: FrameId) {
  const params = { ...SR03_DEFAULTS, endpointPairId, rodRestFrame, measuringFrame };
  const evaluated = await evaluateSr03(params);
  if (evaluated.kind !== "accepted") throw new TypeError(`SR-03 refused ${endpointPairId}`);
  const outputs = evaluated.data.outputs;
  const num = (id: string) => {
    const o = outputs.find((x) => x.quantityId === id);
    return o?.status === "value" && typeof o.value === "number" ? o.value : 0;
  };
  const meas = outputs.find((o) => o.quantityId === "measuredLength");
  const html = renderToStaticMarkup(
    <RodStripPlot
      endpointPairId={endpointPairId}
      rodRestFrame={rodRestFrame}
      measuringFrame={measuringFrame}
      v={params.v}
      L0={params.L0}
      measuredLength={
        meas?.status === "value" && typeof meas.value === "number" ? meas.value : null
      }
      isSimultaneous={!(meas?.status === "not-applicable" && meas.reason.includes("simultaneous"))}
      dxK={num("spatialSeparationK")}
      dtK={num("temporalSeparationK")}
      dxk={num("spatialSeparationKPrime")}
      dtk={num("temporalSeparationKPrime")}
    />,
  );
  const verdict = text(
    html.match(/<strong[^>]*data-rod-ends="[^"]*"[^>]*>([\s\S]*?)<\/strong>/)?.[1] ?? "",
  );
  const rodEnds = html.match(/data-rod-ends="(true|false)"/)?.[1] === "true";
  const label =
    measuringFrame === "K" ? "Frame K, the platform: " : "Frame k, moving at [0-9.]+c: ";
  const strip = text(html).match(new RegExp(`${label}([0-9.]+) ls`))?.[1];
  return { verdict, rodEnds, strip, measured: meas };
}

describe("SR-03's verdict and the rod it sits beside agree", () => {
  for (const pair of PAIRS)
    for (const rest of FRAMES)
      for (const measuring of FRAMES)
        test(`${pair}, rod at rest in ${rest}, measured in ${measuring}`, async () => {
          const { verdict, rodEnds, strip } = await stripFor(pair, rest, measuring);
          expect(strip).toBeDefined();
          // A separation called the rod's length is the length the strip draws.
          const called = verdict.match(/the rod's length there: ([0-9.]+) ls/)?.[1];
          if (called !== undefined) {
            expect(rodEnds).toBe(true);
            expect(called).toBe(strip);
          }
          if (!rodEnds) {
            // Readings that are not the rod's ends are never offered as its length, and the rod's
            // own length is given beside them.
            expect(verdict).not.toContain("the rod's length there:");
            expect(verdict).toContain(`is ${strip} ls long there`);
          }
          expect(verdict).not.toContain("separation is a distance in frame");
        });

  test("the default page names the platform marks and gives the rod 8.00 ls in K", async () => {
    const page = await RodSimultaneityPage({ searchParams: Promise.resolve({}) } as never);
    const html = text(await exportMarkup(page));
    // The sentence live 095fe596 showed beside a rod drawn at 8.00 ls in K.
    expect(html).not.toContain("separation is a distance in frame K: 10.00 ls");
    expect(html).toContain("two marks on the platform, not the rod's ends");
    expect(html).toContain("10.00 ls is the distance between them there, not the rod's length");
    expect(html).toContain("is 8.00 ls long there");
    expect(html).toContain("Frame K, the platform: 8.00 ls");
  });

  test("the rod's own ends, read at one time of K, give its length there", async () => {
    const { verdict, rodEnds, strip } = await stripFor("frame-simultaneous", "k", "K");
    expect(rodEnds).toBe(true);
    expect(strip).toBe("8.00");
    expect(verdict).toContain("the rod's length there: 8.00 ls");
  });
});
