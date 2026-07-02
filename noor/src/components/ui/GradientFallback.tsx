const GRADIENTS = [
  "linear-gradient(135deg, #0c0c0d 0%, #232325 55%, #4a4a4c 100%)",
  "linear-gradient(135deg, #131314 0%, #3a3a3c 55%, #b9bbbe 100%)",
  "linear-gradient(135deg, #0c0c0d 0%, #2c2c2e 50%, #6a6a6c 100%)",
  "linear-gradient(135deg, #17181a 0%, #3a3a3c 45%, #d6d6d2 100%)",
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
        <span className="relative text-xs uppercase tracking-[0.3em] text-bone/50">
          {label}
        </span>
      )}
    </div>
  );
}
