// Shared KitchenGuard wordmark: a shield-check icon (brand green) + the name.
// No hooks or browser APIs, so it can be used from server and client pages.

export const BRAND_GREEN = "#16a34a"; // emerald-600
export const BRAND_GREEN_DARK = "#15803d"; // emerald-700 (hover/active)

export default function Wordmark({
  tone = "dark",
  size = 26,
}: {
  tone?: "light" | "dark";
  size?: number;
}) {
  const textColor = tone === "light" ? "#f8fafc" : "#0f172a";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.55rem",
        userSelect: "none",
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={BRAND_GREEN}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
      <span
        style={{
          fontWeight: 800,
          fontSize: size * 0.78,
          letterSpacing: "-0.01em",
          color: textColor,
        }}
      >
        Kitchen<span style={{ color: BRAND_GREEN }}>Guard</span>
      </span>
    </span>
  );
}
