/**
 * Accessible equivalents for passage actions (am-read-passage-actions-vbe).
 * Declared against the shared action-contract validator so a drag-only or
 * pointer-only copy/obstacle action is a typed refusal, not a missed review.
 */
import {
  type ActionContract,
  validateActionContract,
} from "../../accessibility/actionContracts.ts";

export const PASSAGE_ACTION_CONTRACTS: readonly ActionContract[] = Object.freeze([
  validateActionContract({
    actionId: "copy-passage-link",
    family: "measurement",
    question: "How do I send someone this exact sentence?",
    inputs: ["anchor"],
    commandClass: "presentation-change",
    acceptedResult: { outputs: ["copiedUrl"], allowedStatuses: ["value"] },
    visualAffordance: "Press Copy a link to this passage",
    equivalentAffordance:
      "Select the real link to the passage URL, or copy from the labeled read-only field",
    announcement: "Link to the passage copied.",
    modalities: ["keyboard", "direct-entry", "screen-reader"],
  }),
  validateActionContract({
    actionId: "name-obstacle",
    family: "derivations",
    question: "What is getting in the way of following this passage?",
    inputs: ["obstacleKind"],
    commandClass: "presentation-change",
    acceptedResult: { outputs: ["obstacleResponse"], allowedStatuses: ["value", "not-applicable"] },
    visualAffordance: "Open the obstacle menu and choose a named difficulty",
    equivalentAffordance:
      "Select one of the six named obstacles from the disclosure list, or follow its real link",
    announcement:
      "Opened the authored response for that obstacle, or recorded that none exists yet.",
    modalities: ["keyboard", "screen-reader"],
  }),
  validateActionContract({
    actionId: "open-example",
    family: "derivations",
    question: "Can I see one concrete instance before the general claim?",
    inputs: ["exampleId"],
    commandClass: "presentation-change",
    acceptedResult: { outputs: ["example"], allowedStatuses: ["value", "not-applicable"] },
    visualAffordance: "Press Show me one example first",
    equivalentAffordance: "Select the real link to the authored example or foundation page",
    announcement: "Opened the worked example for this passage.",
    modalities: ["keyboard", "screen-reader"],
  }),
]);
