import type { ReactNode } from "react";

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-teal-deep">
      <span className="inline-block h-px w-8 bg-orange" aria-hidden="true" />
      {children}
    </p>
  );
}
