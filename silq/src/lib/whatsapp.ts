import { WHATSAPP_BASE } from "@/content/site";

/**
 * Builds a wa.me deep link with a pre-filled message.
 * Every CTA on the site goes through here so the number is only defined once.
 */
export function whatsappLink(message: string): string {
  return `${WHATSAPP_BASE}?text=${encodeURIComponent(message)}`;
}

export function enquiryMessage(serviceName: string): string {
  return `Hi SILQ — I'd like to enquire about ${serviceName}. Could you tell me availability and pricing?`;
}

export const GENERAL_ENQUIRY = "Hi SILQ — I'd like to book an appointment at home.";
