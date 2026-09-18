import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TracerComparison, TracerLab } from "../components/lab/TracerLab.tsx";
import { BM01_DEFAULTS, type Bm01Parameters } from "../experiments/bm01/definition.ts";
import { createBm01Session } from "../experiments/bm01/session.ts";
import type { ExperimentView } from "../experiments/store/instanceStore.ts";
import example from "../generated/bm01-example.json";
import { createBm01Host } from "../workers/host/bm01Host.ts";

/**
 * Multi-instance isolation and non-interference tests for BM-01 (am-bm-01-tracer-ensemble-hdly AC 4):
 * - Proves two concurrent instances on one page maintain completely disjoint state.
 * - Genuine non-interference check: mutating instance A advances A to a new snapshot version,
 *   while instance B is asserted to be 100% UNCHANGED (deep-equal to its initial accepted state).
 * - Mutating instance B advances B, while instance A's modified state is preserved without rollback or cross-contamination.
 * - TracerComparison and TracerLab render with distinct instance IDs and collision-free form IDs.
 */

function createTestChannel(sourceDigest: string) {
  return () => {
    let onMessage: ((m: unknown) => void) | null = null;
    let onError: (() => void) | null = null;
    const host = createBm01Host((msg) => {
      onMessage?.(structuredClone(msg));
    }, sourceDigest);
    return {
      send(message: unknown) {
        void host.receive(structuredClone(message)).catch(() => {
          onError?.();
        });
      },
      listen(message: (m: unknown) => void, error: () => void) {
        onMessage = message;
        onError = error;
        queueMicrotask(() => host.hello());
        return () => {
          onMessage = null;
          onError = null;
        };
      },
      dispose() {
        host.dispose();
      },
    };
  };
}

function waitForSnapshot(
  session: ReturnType<typeof createBm01Session>,
  predicate: (snap: ExperimentView) => boolean,
  timeoutMs = 5000,
): Promise<ExperimentView> {
  const current = session.getSnapshot();
  if (predicate(current)) return Promise.resolve(current);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Timeout waiting for snapshot condition after ${timeoutMs}ms`));
    }, timeoutMs);

    const unsubscribe = session.subscribe(() => {
      const snap = session.getSnapshot();
      if (predicate(snap)) {
        clearTimeout(timer);
        unsubscribe();
        resolve(snap);
      }
    });
  });
}

describe("bm01.multiInstance: Multi-Instance Non-Interference (AC 4)", () => {
  test("mutating instance A updates A while instance B remains completely unchanged", async () => {
    const channelFactory = createTestChannel(example.sourceDigest);

    const sessionA = createBm01Session("bm01-inst-alpha", example, channelFactory);
    const sessionB = createBm01Session("bm01-inst-beta", example, channelFactory);

    try {
      const snapA1 = sessionA.getSnapshot();
      const snapB1 = sessionB.getSnapshot();

      expect(snapA1.accepted?.instanceId).toBe("bm01-inst-alpha");
      expect(snapB1.accepted?.instanceId).toBe("bm01-inst-beta");
      expect(snapA1.accepted?.snapshotVersion).toBe(1);
      expect(snapB1.accepted?.snapshotVersion).toBe(1);

      // Store baseline B reference to assert strict immutability after A is mutated
      const initialAcceptedB = snapB1.accepted;
      const initialParamsB = { ...(snapB1.accepted?.parameters as Bm01Parameters) };

      // Mutate instance A: observation interval 1 s -> 4 s
      const paramsA = snapA1.accepted?.parameters as Bm01Parameters;
      const applyResultA = sessionA.apply({ ...paramsA, interval: 4 });
      expect(applyResultA.kind).toBe("accepted");

      // Wait for session A to accept the new measurement
      const snapA2 = await waitForSnapshot(
        sessionA,
        (s) => s.status === "accepted" && s.accepted?.snapshotVersion === 2,
      );
      expect(snapA2.accepted?.instanceId).toBe("bm01-inst-alpha");
      expect((snapA2.accepted?.parameters as Bm01Parameters).interval).toBe(4);
      expect(snapA2.accepted?.revisions.measurement).toBe(1);

      // NON-INTERFERENCE ASSERTION: Instance B MUST remain at snapshotVersion 1,
      // with identical parameters, inputs, outputs, and status.
      const snapBAfterAMutation = sessionB.getSnapshot();
      expect(snapBAfterAMutation.status).toBe("accepted");
      expect(snapBAfterAMutation.accepted?.snapshotVersion).toBe(1);
      expect(snapBAfterAMutation.accepted?.instanceId).toBe("bm01-inst-beta");
      expect((snapBAfterAMutation.accepted?.parameters as Bm01Parameters).interval).toBe(1);
      expect(snapBAfterAMutation.accepted).toBe(initialAcceptedB);
      expect(snapBAfterAMutation.accepted?.parameters).toEqual(initialParamsB);

      // Now mutate instance B independently: change viscosity eta
      const paramsB = snapB1.accepted?.parameters as Bm01Parameters;
      const applyResultB = sessionB.apply({ ...paramsB, eta: 0.002 });
      expect(applyResultB.kind).toBe("accepted");

      const snapB2 = await waitForSnapshot(
        sessionB,
        (s) => s.status === "accepted" && s.accepted?.snapshotVersion === 2,
      );
      expect(snapB2.accepted?.instanceId).toBe("bm01-inst-beta");
      expect((snapB2.accepted?.parameters as Bm01Parameters).eta).toBe(0.002);
      expect((snapB2.accepted?.parameters as Bm01Parameters).interval).toBe(1); // B's interval unchanged

      // Verify instance A was NOT contaminated by B's mutation
      const snapAAfterBMutation = sessionA.getSnapshot();
      expect(snapAAfterBMutation.accepted?.snapshotVersion).toBe(2);
      expect((snapAAfterBMutation.accepted?.parameters as Bm01Parameters).interval).toBe(4);
      expect((snapAAfterBMutation.accepted?.parameters as Bm01Parameters).eta).toBe(BM01_DEFAULTS.eta);
    } finally {
      sessionA.disconnect();
      sessionB.disconnect();
    }
  });

  test("TracerComparison renders two separate instances with distinct instance IDs", () => {
    const html = renderToStaticMarkup(createElement(TracerComparison, { example }));

    // By default, comparison toggle is present
    expect(html).toContain("Open a second separate ensemble");
    expect(html).toContain('data-instrument-id="bm-01"');

    // Rendering two explicit TracerLab instances on one page
    const twoLabsHtml = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(TracerLab, {
          example,
          instanceId: "inst-primary",
          title: "Primary Ensemble",
        }),
        createElement(TracerLab, {
          example,
          instanceId: "inst-secondary",
          title: "Secondary Ensemble",
          equationScope: "compare",
        }),
      ),
    );

    // Both distinct instance IDs are present
    expect(twoLabsHtml).toContain('data-instance-id="inst-primary"');
    expect(twoLabsHtml).toContain('data-instance-id="inst-secondary"');
    expect(twoLabsHtml).toContain("Primary Ensemble");
    expect(twoLabsHtml).toContain("Secondary Ensemble");

    // Form element IDs are properly namespaced by instance
    expect(twoLabsHtml).toContain('id="inst-primary-T"');
    expect(twoLabsHtml).toContain('id="inst-secondary-T"');
    expect(twoLabsHtml).toContain('for="inst-primary-T"');
    expect(twoLabsHtml).toContain('for="inst-secondary-T"');
  });
});
