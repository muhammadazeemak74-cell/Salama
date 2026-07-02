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
      ? "bg-gold text-onyx hover:bg-gold-light hover:shadow-[0_0_30px_rgba(198,161,91,0.35)]"
      : "border border-gold/40 text-off-white hover:border-gold hover:bg-gold/10";

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
