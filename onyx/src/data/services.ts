export interface Service {
  index: string;
  title: string;
  description: string;
}

export const services: Service[] = [
  {
    index: "01",
    title: "Airport Arrivals",
    description:
      "Meet & greet at DXB and Al Maktoum. Your chauffeur tracks the flight, waits at the gate, and handles every bag from belt to boot.",
  },
  {
    index: "02",
    title: "Chauffeur by the Hour or Day",
    description:
      "A dedicated driver and vehicle on standby for meetings, shopping, or a full day exploring the city — on your schedule.",
  },
  {
    index: "03",
    title: "City & Intercity Transfers",
    description:
      "Point-to-point across Dubai, or a comfortable run to Abu Dhabi and beyond, in a quiet cabin built for working or resting.",
  },
  {
    index: "04",
    title: "Events & VIP",
    description:
      "Discreet transport for weddings, galas, and executive visits, coordinated door-to-door with a fleet that matches the occasion.",
  },
];
