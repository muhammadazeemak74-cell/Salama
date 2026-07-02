import Link from "next/link";
import type { ReactNode } from "react";

interface ButtonProps {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  external?: boolean;
  className?: string;
}

export function Button({
  href,
  children,
  variant = "primary",
  external,
  className = "",
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-medium tracking-wide transition-all duration-300 whitespace-nowrap";
  const styles =
    variant === "primary"
      ? "bg-amber text-midnight hover:bg-amber-light hover:shadow-[0_0_30px_rgba(255,171,94,0.35)]"
      : "border border-cyan-light/30 text-pearl hover:border-cyan-light hover:bg-cyan-light/10";

  return (
    <Link
      href={href}
      className={`${base} ${styles} ${className}`}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </Link>
  );
}
