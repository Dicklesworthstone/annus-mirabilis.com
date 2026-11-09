import { afterEach, beforeEach, expect, test } from "bun:test";
import { act, StrictMode, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { TracerLab } from "../../components/lab/TracerLab.tsx";
import example from "../../generated/bm01-example.json";
import {
  createContainer,
  emitTestIntersection,
  installDom,
  observedTestIntersections,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { createBm01Host } from "../../workers/host/bm01Host.ts";
import { createBm01Session, type PreparedBm01Example } from "../bm01/session.ts";

let root: Root | null = null;
let container: HTMLElement;
beforeEach(async () => {
  await installDom({ intersections: "manual" });
  container = createContainer();
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  removeContainer(container);
  await uninstallDom();
});

function laboratory(id: string) {
  let creations = 0;
  let disposals = 0;
  let requests = 0;
  const session = createBm01Session(id, example as PreparedBm01Example, () => {
    creations++;
    let deliver: ((message: unknown) => void) | undefined;
    const host = createBm01Host((message) => deliver?.(message), example.sourceDigest);
    return {
      send(message: unknown) {
        if ((message as { messageKind: string }).messageKind === "request") requests++;
        void host.receive(message);
      },
      listen(listener: (message: unknown) => void) {
        deliver = listener;
        queueMicrotask(() => host.hello());
        return () => {
          deliver = undefined;
        };
      },
      dispose() {
        disposals++;
        host.dispose();
      },
    };
  });
  return {
    session,
    get creations() {
      return creations;
    },
    get disposals() {
      return disposals;
    },
    get requests() {
      return requests;
    },
  };
}

const input = { ...example.parameters, M: 4, H: 1, interval: 0.2 };
async function settled(session: ReturnType<typeof createBm01Session>) {
  for (let attempt = 0; attempt < 200 && session.getSnapshot().pending; attempt++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  expect(session.getSnapshot().status).toBe("accepted");
}

test("the real TracerLab ref pauses and resumes the same worker, including StrictMode cleanup", async () => {
  const lab = laboratory("mounted-visibility");
  await act(async () =>
    root?.render(
      <StrictMode>
        <TracerLab example={example as PreparedBm01Example} session={lab.session} linked={false} />
      </StrictMode>,
    ),
  );
  const element = container.querySelector<HTMLElement>('[data-instrument-id="bm-01"]');
  expect(element).not.toBeNull();
  if (!element) throw new Error("TracerLab must render its laboratory region.");
  expect(observedTestIntersections()).toContain(element);
  await act(async () => {
    expect(lab.session.apply(input).kind).toBe("accepted");
  });
  expect(lab.creations).toBe(0);
  expect(element.dataset.labVisibility).toBe("off-screen");
  await act(async () => {
    expect(emitTestIntersection(element, true)).toBe(1);
  });
  await settled(lab.session);
  expect(lab.creations).toBe(1);
  expect(lab.requests).toBe(1);
  const run = lab.session.getSnapshot().accepted?.runId;
  await act(async () => {
    emitTestIntersection(element, false);
    lab.session.apply({ ...input, interval: 0.4 });
  });
  expect(lab.requests).toBe(1);
  expect(lab.disposals).toBe(0);
  await act(async () => {
    emitTestIntersection(element, true);
  });
  await settled(lab.session);
  expect(lab.requests).toBe(2);
  expect(lab.creations).toBe(1);
  expect(lab.session.getSnapshot().accepted?.runId).toBe(run);
  await act(async () => root?.unmount());
  root = null;
  expect(observedTestIntersections()).not.toContain(element);
  expect(emitTestIntersection(element, true)).toBe(0);
  expect(lab.disposals).toBe(1);
});

function SharedControls({ session }: { session: ReturnType<typeof createBm01Session> }) {
  const region = useRef<HTMLDivElement>(null);
  return (
    <div ref={region} data-shared-visibility-region>
      <TracerLab
        example={example as PreparedBm01Example}
        session={session}
        linked={false}
        visibilityRegion={region}
      />
      <button type="button" data-shared-apply onClick={() => session.apply(input)}>
        Recalculate the visible world check
      </button>
    </div>
  );
}

test("visible sibling controls can run the shared owner while its tracer region is off screen", async () => {
  const lab = laboratory("shared-visibility");
  await act(async () => root?.render(<SharedControls session={lab.session} />));
  const region = container.querySelector<HTMLElement>("[data-shared-visibility-region]");
  const tracer = container.querySelector<HTMLElement>('[data-instrument-id="bm-01"]');
  const button = container.querySelector<HTMLButtonElement>("[data-shared-apply]");
  if (!region || !tracer || !button) throw new Error("The shared composition must render.");
  expect(observedTestIntersections()).toContain(region);
  expect(observedTestIntersections()).not.toContain(tracer);
  await act(async () => {
    expect(emitTestIntersection(tracer, false)).toBe(0);
    expect(emitTestIntersection(region, true)).toBe(1);
    button.click();
  });
  await settled(lab.session);
  expect(lab.requests).toBe(1);
  expect(tracer.dataset.labVisibility).toBe("visible");
  await act(async () => {
    emitTestIntersection(region, false);
    button.click();
  });
  expect(lab.requests).toBe(1);
  expect(tracer.dataset.labVisibility).toBe("off-screen");
  expect(lab.session.getSnapshot().pending).toBe(true);
});
