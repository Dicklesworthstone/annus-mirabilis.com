import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { renderCameraMoments } from "./inferenceView.ts";

/** All interpolated content is escaped by the shared view renderer. */
export function CameraMomentTable({ snapshot }: { snapshot: AcceptedSnapshot }) {
  return <div {...{ dangerouslySetInnerHTML: { __html: renderCameraMoments(snapshot) } }} />;
}
