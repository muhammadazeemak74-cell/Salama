export const site = {
  name: "ONYX",
  tagline: "Arrive in black.",
  hook: "Private chauffeur service for travelers landing in Dubai.",
  whatsappNumber: "971500000000",
  get whatsappLink() {
    return `https://wa.me/${this.whatsappNumber}?text=${encodeURIComponent(
      "Hi ONYX, I'd like to reserve a chauffeur."
    )}`;
  },
  phoneDisplay: "+971 4 000 0000",
  phoneLink: "tel:+97140000000",
  rating: 4.9,
  reviewCount: "500+ arrivals",
  fleetSize: "20+ vehicles",
  languages: "English & Arabic-speaking chauffeurs",
  hours: "Available 24/7",
  instagramHandle: "@onyx.dubai",
  coverage: ["DXB", "Al Maktoum (DWC)", "City-wide Dubai", "Abu Dhabi & intercity"],
  responseTime: "Confirmed in under 10 minutes",
};
