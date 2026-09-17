export type SchedulerMark = Readonly<{
  name: string;
  detail: Readonly<Record<string, unknown>>;
}>;

export function readSchedulerMark(mark: SchedulerMark): {
  instanceId: string;
  actionIndex: number;
  snapshotVersion: number;
} {
  const { instanceId, actionIndex, snapshotVersion } = mark.detail;
  if (typeof snapshotVersion !== "number") {
    throw new Error(`performance mark "${mark.name}" detail lacks snapshotVersion`);
  }
  if (typeof instanceId !== "string" || typeof actionIndex !== "number") {
    throw new Error(`performance mark "${mark.name}" detail is missing instanceId or actionIndex`);
  }
  return { instanceId, actionIndex, snapshotVersion };
}
