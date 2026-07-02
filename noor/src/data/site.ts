export const site = {
  name: "NOOR",
  tagline: "Arrive in light.",
  hook: "Private chauffeur & luxury fleet for travellers arriving in Dubai.",
  whatsappNumber: "971500000000",
  get whatsappLink() {
    return `https://wa.me/${this.whatsappNumber}?text=${encodeURIComponent(
      "Hi NOOR, I'd like to reserve a chauffeur."
    )}`;
  },
  phoneDisplay: "+971 4 000 0000",
  phoneLink: "tel:+97140000000",
  rating: 4.9,
  fleetSize: "25+ vehicles",
  arrivalsHandled: "8,000+ arrivals handled",
  languages: "English & Arabic-speaking chauffeurs",
  hours: "Available 24/7",
  instagramHandle: "@noor.dubai",
  coverage: [
    "DXB",
    "DWC",
    "Downtown",
    "Marina",
    "Palm Jumeirah",
    "Business Bay",
    "DIFC",
    "Abu Dhabi",
  ],
  promises: ["24/7", "Flight-tracked", "All-inclusive", "No hidden fees"],
};
