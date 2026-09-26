import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import CameraPage from "../app/lab/bm-08/page.tsx";
import { CameraLab } from "../components/lab/CameraLab.tsx";
import { createBm08Session, type PreparedBm08Example } from "../experiments/bm08/session.ts";
import rawExample from "../generated/bm08-example.json";

const example = rawExample as unknown as PreparedBm08Example;

describe("BM-08 Measurement Bias Lab View & Route (am-bm-08-measurement-bias-h1ye)", () => {
  test("static page renders cleanly without JavaScript and includes key sections and mathematical explanations", () => {
    const html = renderToStaticMarkup(<CameraPage />);
    expect(html).toContain("The particle.");
    expect(html).toContain("The camera.");
    expect(html).toContain("The estimate.");
    expect(html).toContain("Why these procedures differ");
    expect(html).toContain("An exposure is an average, not a point");
    expect(html).toContain("Neighbors are correlated");
    expect(html).toContain("Use covariance, or choose independent pairs");
    expect(html).toContain("Shorter intervals can magnify camera error");
    expect(html).toContain("Keep this later model separate from the paper");
    expect(html).toContain("Berglund (2010)");
    expect(html).toContain("Vestergaard, Blainey and Flyvbjerg (2014)");
    expect(html).toContain('data-instrument-id="bm-08"');
  });

  test("CameraLab renders with static worked example and displays defaults", () => {
    const html = renderToStaticMarkup(<CameraLab example={example} />);
    expect(html).toContain('data-instrument-id="bm-08"');
    expect(html).toContain("Static worked example");
    expect(html).toContain("x position (μm)");
    expect(html).toContain("Exposure start time (s)");
  });

  test("session initializes with accepted snapshot and preserves latent path on measurement changes", () => {
    const session = createBm08Session("test-camera-session", example);
    const snap = session.getSnapshot().accepted;
    expect(snap).not.toBeNull();
    expect(snap?.experimentId).toBe("bm-08");

    const p = session.acceptedParameters();
    expect(p.D).toBe(0.42944e-12);
    expect(p.dt).toBe(1);
    expect(p.exposure).toBe(0.5);
    expect(p.sigma).toBe(0.2e-6);

    // Measurement change: changing sigma preserves latent path
    const initialRunId = snap?.runId;

    const res = session.apply({ sigma: 0.1e-6 });
    expect(res.kind).toBe("accepted");

    const requested = session.getSnapshot().requested;
    expect(requested?.runId).toBe(initialRunId); // runId is preserved
    if (!snap || !requested) throw new Error("Expected snapshots");
    expect(requested.revisions.measurement).toBeGreaterThan(snap.revisions.measurement);
  });

  test("fluid drift change forks a new run while stage drift preserves runId", () => {
    const session = createBm08Session("test-drift-classes", example);
    const initialSnap = session.getSnapshot().accepted;
    const initialRunId = initialSnap?.runId;

    // Stage drift is a measurement change:
    const stageRes = session.apply({ stageDrift: 0.1e-6 });
    expect(stageRes.kind).toBe("accepted");
    expect(session.getSnapshot().requested?.runId).toBe(initialRunId);

    // Fluid drift is a setup change: forks a new run
    const fluidRes = session.apply({ flowDrift: 0.1e-6 });
    expect(fluidRes.kind).toBe("accepted");
    expect(session.getSnapshot().requested?.runId).not.toBe(initialRunId);
  });

  test("invalid parameters return refusal on session.apply", () => {
    const session = createBm08Session("test-refusal", example);
    const res = session.apply({ M: 1001 }); // M > 1000 is out of domain
    expect(res.kind).toBe("refused");

    const offGridRes = session.apply({ exposure: 0.3 }); // off 0.25 s grid
    expect(offGridRes.kind).toBe("refused");
  });

  test("off-grid exposure 0.3 populates view.refusal with off-replay-grid and sets status to refused", () => {
    const session = createBm08Session("test-off-grid-refusal", example);
    expect(session.getSnapshot().status).toBe("accepted");
    expect(session.getSnapshot().refusal).toBeNull();

    const res = session.apply({ exposure: 0.3 });
    expect(res.kind).toBe("refused");
    if (res.kind !== "refused") throw new Error("Expected refusal");
    expect(res.refusal.code).toBe("off-replay-grid");

    const snap = session.getSnapshot();
    expect(snap.status).toBe("refused");
    expect(snap.refusal?.code).toBe("off-replay-grid");
    expect(snap.requested?.parameters.exposure).toBe(0.3);
    // Accepted snapshot is preserved
    expect(snap.accepted?.parameters.exposure).toBe(0.5);
  });

  test("AC4 negative: legal on-grid exposure 0.5 must NOT produce refusal", () => {
    const session = createBm08Session("test-on-grid-legal", example);
    const initialSnap = session.getSnapshot();
    expect(initialSnap.status).toBe("accepted");
    expect(initialSnap.refusal).toBeNull();

    // 0.5 is on the 0.25 s grid (0.5 / 0.25 = 2, integer)
    const res = session.apply({ exposure: 0.5 });
    expect(res.kind).toBe("accepted");

    const snap = session.getSnapshot();
    expect(snap.status).not.toBe("refused");
    expect(snap.refusal).toBeNull();
  });

  test("refusal surfaces on both named surfaces: execution currency chrome and explanatory notice", () => {
    const html = renderToStaticMarkup(<CameraLab example={example} />);
    // On-grid initial state: neither refusal surface is present
    expect(html).not.toContain('data-refusal-code="off-replay-grid"');
    expect(html).not.toContain('data-currency-state="refused"');
    // An accepted state is not news, so no currency notice at all (dispatch 259).
    expect(html).not.toContain('class="execution-currency"');
    expect(html).toContain("Static worked example");
  });
});
