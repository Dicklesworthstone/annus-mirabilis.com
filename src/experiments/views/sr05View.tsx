import { useState } from "react";
import { MovingClocksLab } from "../../components/lab/sr05/MovingClocksLab.tsx";
import example from "../../generated/sr05-example.json";
import type { ExperimentViewProps } from "../dispatch.tsx";
import { validateSr05Parameters } from "../sr05/parameters.ts";
import { createSr05Session } from "../sr05/session.ts";
import { PreparedExampleNotice } from "./PreparedExampleNotice.tsx";
import "./clarificationLabStyles.ts";

const checked = validateSr05Parameters(example.parameters);
const prepared = checked.kind === "accepted" ? { ...example, parameters: checked.data } : null;

export default function Sr05ClarificationView({ instanceId }: ExperimentViewProps) {
  const [session] = useState(() => (prepared ? createSr05Session(instanceId, prepared) : null));
  if (!prepared || !session) return <PreparedExampleNotice id="sr-05" />;
  return <MovingClocksLab example={prepared} session={session} restoreFromLocation={false} />;
}
