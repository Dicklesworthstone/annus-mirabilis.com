import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getReviewStateCheck, resetReviewStateCheck } from "../../editions/reviewState.ts";
import { parseOwners } from "../../owners/parseOwners.ts";
import { validateReviewRecord } from "../../schemas/review.ts";
import { createRecordBackedReviewStateCheck, ReviewStore } from "./editionReviewState.ts";

const FIXTURE_OWNERS = `| id | displayName | roles | scope | status | consentToBeNamed | assignedBy | assignedOn |
|---|---|---|---|---|---|---|---|
| jemanuel | Jeffrey Emanuel | editorial-owner,implementation-owner | light-quanta | assigned | yes | agent:BoldHarbor | 2026-09-16 |
| rev-de-valid | German Reviewer | german-source-reviewer | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| rev-phys-only | Physics Reviewer | physics-math-reviewer | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| trans-person | Translator | translator | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| check-editor | Checking Editor | checking-editor | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| gloss-person | Glossator | glossator | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
| edn-editor | Edition Editor | edition-editor | brownian-motion | assigned | yes | jemanuel | 2026-09-16 |
`;

const registry = parseOwners(FIXTURE_OWNERS);

describe("editionReviewState", () => {
  it("passes accepted german-source record covering revision 3 and unitHash", () => {
    const store = new ReviewStore();
    const record = validateReviewRecord(
      {
        id: "rev-de-01",
        reviewType: "german-source",
        reviewer: "rev-de-valid",
        date: "2026-09-16",
        result: "accepted",
        scope: [
          {
            recordId: "unit-01",
            translationRevision: 3,
            unitHash: "hash-333",
          },
        ],
      },
      { ownersRegistry: registry },
    );
    store.register(record);

    const check = createRecordBackedReviewStateCheck(store, () => registry);

    // Matching revision and unitHash -> ok
    const resPass = check({
      unitId: "unit-01",
      paper: "brownian-motion",
      layer: "translation",
      revision: 3,
      unitHash: "hash-333",
    });
    assert.equal(resPass.ok, true);

    // Revision 4 -> fails review-record-stale
    const resStaleRev = check({
      unitId: "unit-01",
      paper: "brownian-motion",
      layer: "translation",
      revision: 4,
      unitHash: "hash-333",
    });
    assert.equal(resStaleRev.ok, false);
    assert.equal(resStaleRev.code, "review-record-stale");

    // Changed unitHash -> fails review-record-stale
    const resStaleHash = check({
      unitId: "unit-01",
      paper: "brownian-motion",
      layer: "translation",
      revision: 3,
      unitHash: "hash-changed-444",
    });
    assert.equal(resStaleHash.ok, false);
    assert.equal(resStaleHash.code, "review-record-stale");
  });

  it("fails review-self-review when reviewer equals translator, checking editor, glossator, or edition editor", () => {
    const store = new ReviewStore();
    const check = createRecordBackedReviewStateCheck(store, () => registry);

    // Register review by rev-de-valid
    const record = validateReviewRecord(
      {
        id: "rev-de-02",
        reviewType: "german-source",
        reviewer: "rev-de-valid",
        date: "2026-09-16",
        result: "accepted",
        scope: [{ recordId: "unit-self", translationRevision: 1 }],
      },
      { ownersRegistry: registry },
    );
    store.register(record);

    // Reviewer equals translator
    const resTrans = check({
      unitId: "unit-self",
      paper: "brownian-motion",
      layer: "translation",
      revision: 1,
      translatorId: "rev-de-valid",
    });
    assert.equal(resTrans.ok, false);
    assert.equal(resTrans.code, "review-self-review");

    // Reviewer equals checking editor
    const resCheckEd = check({
      unitId: "unit-self",
      paper: "brownian-motion",
      layer: "translation",
      revision: 1,
      checkingEditorId: "rev-de-valid",
    });
    assert.equal(resCheckEd.ok, false);
    assert.equal(resCheckEd.code, "review-self-review");

    // Reviewer equals glossator
    const resGloss = check({
      unitId: "unit-self",
      paper: "brownian-motion",
      layer: "gloss",
      revision: 1,
      glossatorId: "rev-de-valid",
    });
    assert.equal(resGloss.ok, false);
    assert.equal(resGloss.code, "review-self-review");

    // Reviewer listed in edition editors
    const resEdnEd = check({
      unitId: "unit-self",
      paper: "brownian-motion",
      layer: "german",
      revision: 1,
      editionEditors: ["rev-de-valid"],
    });
    assert.equal(resEdnEd.ok, false);
    assert.equal(resEdnEd.code, "review-self-review");
  });

  it("fails review-reviewer-unknown when reviewer not in OWNERS.md", () => {
    const store = new ReviewStore();
    const record = validateReviewRecord(
      {
        id: "rev-unknown-01",
        reviewType: "german-source",
        reviewer: "unknown-person",
        date: "2026-09-16",
        result: "accepted",
        scope: [{ recordId: "unit-unknown", translationRevision: 1 }],
      },
      { ownersRegistry: registry, skipOwnerRoleCheck: true },
    );
    store.register(record);

    const check = createRecordBackedReviewStateCheck(store, () => registry);
    const res = check({
      unitId: "unit-unknown",
      paper: "brownian-motion",
      layer: "translation",
      revision: 1,
    });
    assert.equal(res.ok, false);
    assert.equal(res.code, "review-reviewer-unknown");
  });

  it("fails review-reviewer-role when reviewer lacks german-source-reviewer role", () => {
    const store = new ReviewStore();
    const record = validateReviewRecord(
      {
        id: "rev-wrong-role-01",
        reviewType: "german-source",
        reviewer: "rev-phys-only", // holds only physics-math-reviewer
        date: "2026-09-16",
        result: "accepted",
        scope: [{ recordId: "unit-wrong-role", translationRevision: 1 }],
      },
      { ownersRegistry: registry, skipOwnerRoleCheck: true },
    );
    store.register(record);

    const check = createRecordBackedReviewStateCheck(store, () => registry);
    const res = check({
      unitId: "unit-wrong-role",
      paper: "brownian-motion",
      layer: "translation",
      revision: 1,
    });
    assert.equal(res.ok, false);
    assert.equal(res.code, "review-reviewer-role");
  });

  it("fails review-record-missing when no record exists for unit", () => {
    const store = new ReviewStore();
    const check = createRecordBackedReviewStateCheck(store, () => registry);
    const res = check({
      unitId: "nonexistent-unit",
      paper: "brownian-motion",
      layer: "translation",
      revision: 1,
    });
    assert.equal(res.ok, false);
    assert.equal(res.code, "review-record-missing");
  });

  it("fails with review-records-not-available when strict default check is active", () => {
    resetReviewStateCheck();
    const check = getReviewStateCheck();
    const res = check({
      unitId: "unit-01",
      paper: "brownian-motion",
      layer: "translation",
      revision: 1,
    });
    assert.equal(res.ok, false);
    assert.equal(res.code, "review-records-not-available");
  });
});
