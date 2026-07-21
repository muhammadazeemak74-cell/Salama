import Link from "next/link";
import type { ReactNode } from "react";

interface ButtonProps {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
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
    "group inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium tracking-wide transition-all duration-300 whitespace-nowrap";

  const styles: Record<string, string> = {
    primary:
      "bg-orange text-white shadow-[0_10px_30px_-12px_rgba(242,163,60,0.8)] hover:bg-orange-deep hover:shadow-[0_14px_36px_-12px_rgba(242,163,60,0.9)] hover:-translate-y-0.5",
    secondary:
      "border border-teal/45 text-ink hover:border-teal hover:bg-teal/8 hover:-translate-y-0.5",
    ghost: "text-ink/70 hover:text-ink",
  };

  return (
    <Link
      href={href}
      className={`${base} ${styles[variant]} ${className}`}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </Link>
  );
}
