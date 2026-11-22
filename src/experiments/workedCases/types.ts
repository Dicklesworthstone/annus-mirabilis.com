/** Prepared reading-only content, extracted from the laboratory's own default render. */
export const WORKED_CASE_SCHEMA_VERSION = 1;

export type WorkedCaseRun = Readonly<{ t: string; s?: "sup" | "sub" }>;

export type WorkedCaseCell = Readonly<{
  content: readonly WorkedCaseRun[];
  header: boolean;
  colSpan: number;
  rowSpan: number;
}>;

export type WorkedCaseTable = Readonly<{
  caption: string;
  headings: readonly (readonly WorkedCaseCell[])[];
  rows: readonly (readonly WorkedCaseCell[])[];
  omittedRows: number;
}>;

export type WorkedCaseStatement = Readonly<{
  kind: "calculation" | "qualitative";
  content: readonly WorkedCaseRun[];
}>;

export type PreparedInstrumentWorkedCase = Readonly<{
  kind: "prepared";
  address: string;
  instrumentId: string;
  mode: string | null;
  origin: "prepared-default";
  title: string;
  settings: readonly Readonly<{ label: string; value: string }>[];
  omittedSettings: number;
  notes: readonly string[];
  statements: readonly WorkedCaseStatement[];
  omittedStatements: number;
  tables: readonly WorkedCaseTable[];
  omittedTables: number;
  notModeled: readonly string[];
  sources: readonly Readonly<{ href: string; label: string }>[];
}>;

export type UnavailableInstrumentWorkedCase = Readonly<{
  kind: "unavailable";
  address: string;
  reason: string;
}>;

export type InstrumentWorkedCase = PreparedInstrumentWorkedCase | UnavailableInstrumentWorkedCase;

export type InstrumentWorkedCaseIndex = Readonly<{
  schemaVersion: typeof WORKED_CASE_SCHEMA_VERSION;
  cases: Readonly<Record<string, InstrumentWorkedCase>>;
}>;

/** An addressed mode never inherits another mode's prepared numbers. */
export function findWorkedCase(
  index: InstrumentWorkedCaseIndex,
  address: string,
): InstrumentWorkedCase | undefined {
  if (index.schemaVersion !== WORKED_CASE_SCHEMA_VERSION) return undefined;
  const result = index.cases[address];
  return result?.address === address ? result : undefined;
}
