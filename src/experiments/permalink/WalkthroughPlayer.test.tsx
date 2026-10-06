import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LabTapeLink } from "./LabTapeLink.tsx";
import { WalkthroughPlayer } from "./WalkthroughPlayer.tsx";
import type { WalkthroughTarget } from "./walkthroughActions.ts";

const target: WalkthroughTarget = {
  kind: "session",
  experimentId: "me-01",
  restore: () => {
    assert.fail("Rendering must never start a replay.");
  },
};

test("the player initially offers a named disclosure and readable fallback without loading data", () => {
  let loads = 0;
  const html = renderToStaticMarkup(
    <WalkthroughPlayer
      target={target}
      load={async () => {
        loads++;
        return { walkthroughs: [], problems: [] };
      }}
    />,
  );
  assert.match(html, /<summary>Explore recorded walkthroughs<\/summary>/);
  assert.match(html, /href="\/tapes\/"/);
  assert.match(html, /data-walkthrough-player="me-01"/);
  assert.equal(loads, 0);
  assert.doesNotMatch(html, /data-walkthrough-outcome/);
});

test("server markup keeps a real reading link but no hydration-dependent checkpoint controls", () => {
  const html = renderToStaticMarkup(
    <LabTapeLink
      link={{
        notice: "",
        shareTape: null,
        walkthrough: target,
      }}
    />,
  );
  assert.match(html, /href="\/tapes\/"/);
  assert.doesNotMatch(html, /<button|<select|data-walkthrough-player/);
});

test("a disabled secondary instance has no walkthrough surface", () => {
  const html = renderToStaticMarkup(<LabTapeLink link={{ notice: "", shareTape: null }} />);
  assert.doesNotMatch(html, /walkthrough|<button|<select/);
});
