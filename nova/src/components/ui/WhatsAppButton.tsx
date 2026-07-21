import { Button } from "./Button";
import { WhatsAppIcon } from "./BrandIcons";
import { site } from "@/data/content";

/** The site's single, repeated call to action. */
export function WhatsAppButton({
  label = "Reservar por WhatsApp",
  variant = "primary",
  className = "",
}: {
  label?: string;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  return (
    <Button href={site.whatsappLink} external variant={variant} className={className}>
      <WhatsAppIcon className="h-4 w-4" />
      {label}
    </Button>
  );
}
