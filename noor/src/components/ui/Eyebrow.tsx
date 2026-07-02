import type { ReactNode } from "react";

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-gradient mb-4 text-xs font-medium uppercase tracking-[0.3em]">
      {children}
    </p>
  );
}
