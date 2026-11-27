import { afterEach, beforeEach, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { loadWalkthroughCatalogue } from "../../content/walkthroughs.ts";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { createMe03Session } from "../me03/session.ts";
import { ME03_TAPE } from "../me03/tape.ts";
import { compareRecordedReading, currentCheckpointReadings } from "./checkpointReadings.ts";
import { useLabTapeLink } from "./LabTapeLink.tsx";
import { WalkthroughPlayer } from "./WalkthroughPlayer.tsx";

const catalogue = loadWalkthroughCatalogue();
const box = catalogue.walkthroughs.find((entry) => entry.tapeId === "the-1906-box");
assert.ok(box);
const stop = box.checkpoints[0];
assert.ok(stop);
const recorded = stop.expectedDisplayValues?.find((reading) => reading.outputId === "centerOfMassShift");
assert.ok(recorded);
const load = async () => catalogue;

let root: Root;
let host: HTMLElement;
beforeEach(async () => {
  await installDom();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  await uninstallDom();
});

test("inspect, calculate and change the accepted laboratory without keeping an obsolete comparison", async () => {
  const session = createMe03Session("box-comparison");
  function Laboratory() {
    const link = useLabTapeLink(ME03_TAPE, session, session.acceptedParameters(), true, undefined, {
      restoreFromLocation: false,
    });
    assert.ok(link.walkthrough);
    return <WalkthroughPlayer target={link.walkthrough} owner={link.readoutOwner} load={load} />;
  }
  window.history.replaceState({}, "", "/lab/me-03/?walkthrough=the-1906-box&stop=1");
  const before = session.getSnapshot();
  await act(async () => root.render(<Laboratory />));
  expect(session.getSnapshot()).toBe(before);
  const panel = () => host.querySelector("[data-checkpoint-readings]");
  expect(panel()?.querySelectorAll("dt").length).toBe(2);
  expect(panel()?.querySelector("[data-checkpoint-lab-reading]")).toBeNull();

  const click = async (name: string) => {
    const button = [...host.querySelectorAll("button")].find((node) => node.textContent?.trim() === name);
    assert.ok(button);
    await act(async () => button.click());
  };
  await click("Calculate these settings as a new run");
  const values = () => [...(panel()?.querySelectorAll("[data-checkpoint-lab-reading] data") ?? [])]
    .map((element) => Number(element.getAttribute("value")));
  expect(values()).toEqual([-1.1126500560536185e-17, -1.1126500560536185e-17]);

  await act(async () => {
    session.apply({ ...session.acceptedParameters(), pulseEnergy: 2 });
  });
  expect(values()).toEqual([]);
  expect(panel()?.textContent).toContain("needs a final laboratory result");
  await click("Inspect next checkpoint");
  expect(panel()?.querySelector("[data-checkpoint-lab-reading]")).toBeNull();
  await click("Restore checkpoint");
  expect(values()).toEqual([-1.1126500560536185e-17, 0]);
});

test("match only the final request, exact field, units and constant set", () => {
  const session = createMe03Session("scientific-identity");
  session.apply({ ...session.acceptedParameters(), mode: "box-1906", assignLightMass: false });
  const view = session.getSnapshot();
  const read = (candidate: typeof view) =>
    currentCheckpointReadings(candidate, ME03_TAPE, "me-03", stop.settings);
  const publication = read(view);
  assert.ok(publication && view.requested);
  expect(read({ ...view, pending: true })).toBeNull();
  expect(read({ ...view, status: "refused" })).toBeNull();
  expect(read({ ...view, requested: { ...view.requested, runId: "replaced" } })).toBeNull();
  expect(compareRecordedReading(recorded, publication).kind).toBe("value");
  for (const changed of [
    { ...recorded, constantSetId: "historical" },
    { ...recorded, unit: "cm" },
    { ...recorded, outputId: "someOtherOutput", label: "centerOfMassShift" },
  ]) expect(compareRecordedReading(changed, publication).kind).toBe("unavailable");
  const output = publication.outputs.find((result) => result.quantityId === recorded.outputId);
  assert.ok(output);
  expect(compareRecordedReading(recorded, { ...publication, outputs: [output, output] }).kind)
    .toBe("unavailable");
});
