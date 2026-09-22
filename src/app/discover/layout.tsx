import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  other: {
    "data-route-theme": "kramgasse-night",
    "route-theme": "kramgasse-night",
  },
};

export default function DiscoverLayout({ children }: { children: ReactNode }) {
  return (
    <div data-route-theme="kramgasse-night" style={{ display: "contents" }}>
      {children}
    </div>
  );
}
