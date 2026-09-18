import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  other: {
    "data-route-theme": "slate",
    "route-theme": "slate",
  },
};

export default function DiscoverLayout({ children }: { children: ReactNode }) {
  return (
    <div data-route-theme="slate" style={{ display: "contents" }}>
      {children}
    </div>
  );
}
