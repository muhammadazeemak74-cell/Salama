import type { ReactNode } from "react";
import { RevealBlock, RevealText } from "@/components/motion/RevealText";

/**
 * Shared section opener: eyebrow, masked display heading, optional standfirst.
 * Keeps vertical rhythm identical across every section on the page.
 */
export function SectionHeading({
  eyebrow,
  heading,
  intro,
  children,
  className,
  align = "start",
}: {
  eyebrow: string;
  heading: string;
  intro?: string;
  children?: ReactNode;
  className?: string;
  align?: "start" | "center";
}) {
  return (
    <div
      className={`${align === "center" ? "mx-auto max-w-3xl text-center" : ""} ${className ?? ""}`}
    >
      <RevealBlock>
        <p className="eyebrow">{eyebrow}</p>
      </RevealBlock>

      <RevealText
        as="h2"
        lines={[heading]}
        className="t-section opsz-display mt-6"
        delay={0.05}
      />

      {intro ? (
        <RevealBlock delay={0.12}>
          <p className={`t-lead mt-8 max-w-2xl ${align === "center" ? "mx-auto" : ""}`}>
            {intro}
          </p>
        </RevealBlock>
      ) : null}

      {children}
    </div>
  );
}
