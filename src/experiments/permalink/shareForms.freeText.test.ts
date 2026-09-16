import assert from "node:assert/strict";
import test from "node:test";
import { getLogger, newRunIdentity } from "../../testing/log/logger.ts";
import { assertShareFormNoLeaks, ShareFormError } from "./shareForms.ts";

const logRunId = newRunIdentity();
const logger = getLogger("permalink", logRunId);

test("shareForms.freeText: free text in URL-producing form (passage-link) refuses serialization", () => {
  assert.throws(
    () =>
      assertShareFormNoLeaks("passage-link", {
        params: { view: "parallel" },
        freeTextValues: { readerComment: "I think Einstein was onto something here." },
      }),
    (err: unknown) => {
      assert.ok(err instanceof ShareFormError);
      assert.equal(err.code, "free-text-refused");
      assert.ok(err.message.includes("readerComment"));
      return true;
    },
  );
});

test("shareForms.freeText: free text in URL-producing form (experiment-preset) refuses serialization", () => {
  assert.throws(
    () =>
      assertShareFormNoLeaks("experiment-preset", {
        params: { tape: "abc" },
        freeTextValues: { studentAnnotation: "My lab partner and I observed 100 particles." },
      }),
    (err: unknown) => {
      assert.ok(err instanceof ShareFormError);
      assert.equal(err.code, "free-text-refused");
      assert.ok(err.message.includes("studentAnnotation"));
      return true;
    },
  );
});

test("shareForms.freeText: notebook-export permits free text", () => {
  // Should NOT throw
  assert.doesNotThrow(() =>
    assertShareFormNoLeaks("notebook-export", {
      freeTextValues: { readerComment: "Notes from seminar discussion on Brownian motion." },
    }),
  );

  logger.log({
    testId: "share-forms-free-text-boundary",
    beadId: "am-inst-permalink-tape-s677",
    outcome: "passed",
    message:
      "Free text refused in URL forms (passage-link, experiment-preset) and admitted in file export",
  });
});
