export interface Service {
  index: string;
  title: string;
  description: string;
}

export const services: Service[] = [
  {
    index: "01",
    title: "Airport Transfers",
    description:
      "DXB and DWC, meet & greet at the gate, live flight tracking so your car is ready the moment you land.",
  },
  {
    index: "02",
    title: "Chauffeur by the Hour or Day",
    description:
      "A dedicated driver and vehicle on standby for meetings, shopping, or a full day exploring the city.",
  },
  {
    index: "03",
    title: "City Tours & Sightseeing",
    description:
      "A curated route through Downtown, the Marina, and Palm Jumeirah, paced however you like.",
  },
  {
    index: "04",
    title: "Intercity (Abu Dhabi)",
    description:
      "Comfortable point-to-point travel between emirates in a quiet cabin built for working or resting.",
  },
  {
    index: "05",
    title: "Corporate & Events",
    description:
      "Reliable, on-time transport for executive visits, conferences, and multi-stop itineraries.",
  },
  {
    index: "06",
    title: "Weddings & VIP",
    description:
      "Discreet, white-glove transport for weddings and galas, coordinated door-to-door.",
  },
];
