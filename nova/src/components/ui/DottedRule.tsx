/** The signature dotted-path motif, echoed as a hairline divider. */
export function DottedRule({
  className = "",
  animated = false,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <div
      className={`dotted-rule ${animated ? "dotted-rule-animated" : ""} ${className}`}
      aria-hidden="true"
    />
  );
}
