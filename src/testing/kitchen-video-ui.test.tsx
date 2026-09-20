import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { VideoTracker } from "../components/lab/kitchen/VideoTracker.tsx";

test("the static capture entrance opens no video, has no uploaded media and starts no analysis", () => {
  let analysis = 0;
  const html = renderToStaticMarkup(<VideoTracker onAnalyze={() => { analysis++; }} />);
  expect(analysis).toBe(0);
  expect(html).toContain('preload="none"');
  expect(html).not.toContain('src="blob:');
  expect(html).not.toContain('autoplay');
  expect(html).toContain("Nothing is saved automatically");
  expect(html).toContain("Exposure duration (seconds; blank means unknown)");
  expect(html).toContain("Verified pixel aspect ratio (blank means unknown)");
  expect(html).toContain("Calibrate measured axes before tracking");
  expect(html).toContain("2 seconds per read");
});

test("coordinate entry, loss, and export actions are named without relying on the canvas", () => {
  const html = renderToStaticMarkup(<VideoTracker disabled onAnalyze={() => {}} />);
  expect(html).toContain("X (source pixels)");
  expect(html).toContain("Y (source pixels)");
  expect(html).toContain("Record point");
  expect(html).toContain("Download raw annotations JSON");
  expect(html).toContain("Analyze captured observations");
  expect(html).toContain("Stop and release video; keep annotations");
  expect(html).toContain("Internal decoder work is not observable or counted");
  expect(html).toContain("Encoded rotation and pixel aspect are not independently verified");
});
