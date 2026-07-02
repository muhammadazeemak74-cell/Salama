const GRADIENTS = [
  "linear-gradient(135deg, #0d1230 0%, #2c2f6e 45%, #9b7bf0 100%)",
  "linear-gradient(135deg, #0a0e27 0%, #14406b 50%, #4dd9e8 100%)",
  "linear-gradient(135deg, #1a1030 0%, #6b3f8f 55%, #ffab5e 100%)",
  "linear-gradient(135deg, #0a0e27 0%, #2c2f6e 40%, #4dd9e8 75%, #ffab5e 100%)",
];

interface GradientFallbackProps {
  index?: number;
  label?: string;
  className?: string;
}

/**
 * Tasteful placeholder shown when Unsplash has no key or the fetch fails —
 * never a broken image. TODO: swap for the client's own fleet photography.
 */
export function GradientFallback({
  index = 0,
  label,
  className = "",
}: GradientFallbackProps) {
  const gradient = GRADIENTS[index % GRADIENTS.length];
  return (
    <div
      className={`relative flex h-full w-full items-center justify-center ${className}`}
      style={{ backgroundImage: gradient }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_60%)]" />
      {label && (
        <span className="relative text-xs uppercase tracking-[0.3em] text-pearl/50">
          {label}
        </span>
      )}
    </div>
  );
}
