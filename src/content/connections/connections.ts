/**
 * THE CONNECTIONS AMONG THE FOUR PAPERS (dispatch 253): content/connections/connections.yaml.
 *
 * One record, read by the Connections page's map (src/app/connections/ConnectionMap.tsx) and by the
 * result cards' "Where this is used later" (src/content/results/resultCards.ts), so the map and the
 * cards cannot disagree. Until dispatch 253 the four connections were a constant inside the map
 * component, and no card could cite one.
 *
 * Only a connection of kind `borrows` records a use: a result card of one paper (`uses.from`) that
 * a card of a later paper uses (`uses.to`). The other kinds join papers without one using the
 * other, so they carry no `uses`, and a card can never claim one as a use.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYaml } from "../provenance/yaml.ts";
import { PAPER_SLUGS } from "../schemas/source.pure.ts";

export const CONNECTIONS_PATH = join("content", "connections", "connections.yaml");

/** From evidence to resemblance: a borrowed premise, one number reached twice, shared maths, later physics. */
export const CONNECTION_KINDS = ["borrows", "same-number", "same-maths", "later"] as const;
export type ConnectionKind = (typeof CONNECTION_KINDS)[number];

export type ResultRef = Readonly<{ paper: string; result: string }>;

export type ConnectionUse = Readonly<{
  /** The card whose result crosses to the later paper. */
  from: ResultRef;
  /** The card, in the later paper, that uses it. */
  to: ResultRef;
  /** What the `from` card says under "Where this is used later". */
  text: string;
}>;

export type Connection = Readonly<{
  id: string;
  kind: ConnectionKind;
  label: string;
  what: string;
  /** The paper slugs the connection joins, in received order. */
  papers: readonly string[];
  uses?: ConnectionUse | undefined;
}>;

export class ConnectionsError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`[connections] ${message} (${code})`);
    this.name = "ConnectionsError";
    this.code = code;
  }
}

const ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const PAPERS = new Set<string>(PAPER_SLUGS);

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

function resultRef(value: unknown, where: string): ResultRef {
  const o = (value ?? {}) as Record<string, unknown>;
  const paper = text(o.paper);
  const result = text(o.result);
  if (!PAPERS.has(paper))
    throw new ConnectionsError(
      "connection-use-unknown-paper",
      `${where}: "${paper}" is no paper slug.`,
    );
  if (!ID.test(result))
    throw new ConnectionsError(
      "connection-use-invalid-result",
      `${where}: "${result}" is no card id.`,
    );
  return { paper, result };
}

/** The file's connections, each checked; every problem is refused by name, with the connection. */
export function parseConnections(raw: unknown): readonly Connection[] {
  const list = (raw as { connections?: unknown } | null)?.connections;
  if (!Array.isArray(list))
    throw new ConnectionsError(
      "connections-invalid-file",
      `${CONNECTIONS_PATH} must hold one list, connections.`,
    );
  const seen = new Set<string>();
  return list.map((entry, i) => {
    const o = (entry ?? {}) as Record<string, unknown>;
    const id = text(o.id);
    const at = `connection ${id || `#${i + 1}`}`;
    const label = text(o.label);
    const what = text(o.what);
    if (!ID.test(id) || !label || !what)
      throw new ConnectionsError(
        "connection-invalid-field",
        `${at}: an id in kebab case, a label and a line saying what it joins are required.`,
      );
    if (seen.has(id))
      throw new ConnectionsError("connection-duplicate-id", `${at}: the id is used twice.`);
    seen.add(id);
    const kind = text(o.kind) as ConnectionKind;
    if (!CONNECTION_KINDS.includes(kind))
      throw new ConnectionsError(
        "connection-unknown-kind",
        `${at}: kind "${kind}" is not one of ${CONNECTION_KINDS.join(", ")}.`,
      );
    const papers = Array.isArray(o.papers) ? o.papers.map(text) : [];
    const unknown = papers.find((p) => !PAPERS.has(p));
    if (papers.length < 2 || unknown !== undefined)
      throw new ConnectionsError(
        "connection-unknown-paper",
        `${at}: papers must name two or more paper slugs${unknown === undefined ? "" : `; "${unknown}" is none`}.`,
      );
    if ((kind === "borrows") !== (o.uses !== undefined))
      throw new ConnectionsError(
        "connection-use-mismatch",
        `${at}: a connection records a use exactly when its kind is borrows.`,
      );
    let uses: ConnectionUse | undefined;
    if (o.uses !== undefined) {
      const u = o.uses as Record<string, unknown>;
      const from = resultRef(u.from, `${at} uses.from`);
      const to = resultRef(u.to, `${at} uses.to`);
      const said = text(u.text);
      if (
        !said ||
        !papers.includes(from.paper) ||
        !papers.includes(to.paper) ||
        from.paper === to.paper
      )
        throw new ConnectionsError(
          "connection-use-invalid",
          `${at}: a use joins two of the connection's papers, one to the other, and says in words how.`,
        );
      uses = { from, to, text: said };
    }
    return { id, kind, label, what, papers, ...(uses ? { uses } : {}) };
  });
}

/** The repository's connections; none where the file does not exist. */
export function loadConnections(root: string = process.cwd()): readonly Connection[] {
  const path = join(root, CONNECTIONS_PATH);
  if (!existsSync(path)) return [];
  return parseConnections(parseYaml(readFileSync(path, "utf8")));
}
