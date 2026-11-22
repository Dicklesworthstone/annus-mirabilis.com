"use client";

import { Component, type ComponentType, type ReactNode, useEffect, useState } from "react";
import { WorkedCaseUnavailable } from "./WorkedCase.tsx";

// Used by client-opened clarifications only. Tours pass their authored worked comparison to
// ExperimentDispatch instead, so no-script pages never depend on a suspended client chunk.
// This deferred data chunk imports no laboratory or numerical owner.
type Props = { instrumentId: string; mode: string | null };
type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; View: ComponentType<Props> }
  | { kind: "failed" };

class WorkedCaseBoundary extends Component<Props & { children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <WorkedCaseUnavailable instrumentId={this.props.instrumentId} mode={this.props.mode} />
    ) : (
      this.props.children
    );
  }
}

export function LazyWorkedCase({ instrumentId, mode }: Props) {
  const [loaded, setLoaded] = useState<LoadState>({ kind: "loading" });
  useEffect(() => {
    let cancelled = false;
    // Prepared display data and the live solver have independent loading lifecycles. Loading
    // this component does not suspend or wait for the live view's separate lazy boundary.
    void import("./PreparedWorkedCase.tsx").then(
      (module) => {
        if (!cancelled) setLoaded({ kind: "ready", View: module.default });
      },
      () => {
        if (!cancelled) setLoaded({ kind: "failed" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <WorkedCaseBoundary
      key={instrumentId + ":" + (mode ?? "")}
      instrumentId={instrumentId}
      mode={mode}
    >
      {loaded.kind === "ready" ? (
        <loaded.View instrumentId={instrumentId} mode={mode} />
      ) : loaded.kind === "failed" ? (
        <WorkedCaseUnavailable instrumentId={instrumentId} mode={mode} />
      ) : (
        <p role="status">
          Loading the prepared default example.{" "}
          <a href={"/lab/" + instrumentId + "/"}>Read the full laboratory</a>.
        </p>
      )}
    </WorkedCaseBoundary>
  );
}
