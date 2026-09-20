import assert from "node:assert/strict";
import test from "node:test";
import { getLogger, newRunIdentity } from "../../testing/log/logger.ts";
import { assertShareFormNoLeaks, ShareFormError } from "./shareForms.ts";

const logRunId = newRunIdentity();
const logger = getLogger("permalink", logRunId);

const MEDIA_LEAK_EXAMPLES = [
  { field: "fileName", value: "microscope_recording_20260916_patient_004.avi" },
  { field: "blobUrl", value: "blob:https://annus-mirabilis.com/1234-5678-9abc" },
  { field: "filePath", value: "/home/agent/Desktop/brownian_particles.mp4" },
  { field: "localPath", value: "C:\\Users\\student\\data\\camera_capture.png" },
];

for (const { field, value } of MEDIA_LEAK_EXAMPLES) {
  test(`shareForms.media: local media "${field}" (${value}) is refused across all share forms`, () => {
    // 1. Passage link
    assert.throws(
      () =>
        assertShareFormNoLeaks("passage-link", {
          params: { view: "parallel" },
          mediaValues: { [field]: value },
        }),
      (err: unknown) => {
        assert.ok(err instanceof ShareFormError);
        assert.equal(err.code, "media-leak-refused");
        return true;
      },
    );

    // 2. Experiment preset
    assert.throws(
      () =>
        assertShareFormNoLeaks("experiment-preset", {
          params: { tape: "abc" },
          mediaValues: { [field]: value },
        }),
      (err: unknown) => {
        assert.ok(err instanceof ShareFormError);
        assert.equal(err.code, "media-leak-refused");
        return true;
      },
    );

    // 3. Notebook export
    assert.throws(
      () =>
        assertShareFormNoLeaks("notebook-export", {
          mediaValues: { [field]: value },
        }),
      (err: unknown) => {
        assert.ok(err instanceof ShareFormError);
        assert.equal(err.code, "media-leak-refused");
        return true;
      },
    );

    // 4. In payload
    assert.throws(
      () =>
        assertShareFormNoLeaks("experiment-preset", {
          payload: {
            tapeVersion: 2,
            experimentId: "bm-07",
            customMedia: { [field]: value },
          },
        }),
      (err: unknown) => {
        assert.ok(err instanceof ShareFormError);
        return true;
      },
    );
  });
}

test("shareForms.media: clean payload with no local media passes verification", () => {
  assert.doesNotThrow(() =>
    assertShareFormNoLeaks("experiment-preset", {
      params: { tape: "validEncodedTape" },
      payload: {
        tapeVersion: 2,
        experimentId: "bm-01",
        mode: "bm-01:default",
      },
    }),
  );

  logger.log({
    testId: "share-forms-media-privacy-protection",
    beadId: "am-inst-permalink-tape-s677",
    outcome: "passed",
    message: "Local media paths, filenames, and blob URLs strictly excluded from all share forms",
  });
});
