import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import FieldFrameChangePage from "../app/lab/sr-08/page.tsx";
import { FieldFrameChangeLab } from "../components/lab/sr08/FieldFrameChangeLab.tsx";
import { createSr08Session, type PreparedSr08Example } from "../experiments/sr08/session.ts";
import rawExample from "../generated/sr08-example.json";

const example = rawExample as unknown as PreparedSr08Example;

describe("SR-08 Field Frame Change Lab View & Route (am-sr-08-field-frame-change-5ibt)", () => {
  test("server component page renders without JavaScript and includes worked case", () => {
    const html = renderToStaticMarkup(<FieldFrameChangePage />);
    expect(html).toContain("Fields transform together");
    expect(html).toContain("Special relativity · Electrodynamics §6");
    expect(html).toContain("Worked case (readable without JavaScript)");
    expect(html).toContain('data-instrument-id="sr-08"');
    expect(html).toContain("Transformation ledger");
    expect(html).toContain("E² − c²B²");
  });

  test("FieldFrameChangeLab component renders vector diagram and controls", () => {
    const html = renderToStaticMarkup(<FieldFrameChangeLab example={example} />);
    expect(html).toContain('data-instrument-id="sr-08"');
    expect(html).toContain("Stationary frame K");
    expect(html).toContain("Moving frame k");
    expect(html).toContain("Pure E at 0.6c");
    expect(html).toContain("Pure B at 10 m/s");
    expect(html).toContain("Null field invariant");
    expect(html).toContain("Predict: Appearing magnetic field");
  });

  test("session initializes and computes transformed fields", () => {
    const session = createSr08Session("test-sr08", example);
    const snap = session.getSnapshot().accepted;
    expect(snap).toBeDefined();
    expect(snap?.experimentId).toBe("sr-08");

    const eMov = snap?.outputs.find((o) => o.quantityId === "electricFieldMoving");
    expect(eMov?.status).toBe("value");
    if (eMov?.status === "value" && eMov.value instanceof Float64Array) {
      expect(eMov.value[1]).toBeCloseTo(1.25, 6);
    }
  });
});
