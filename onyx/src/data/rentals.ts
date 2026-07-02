export interface RentalTier {
  period: string;
  fromPriceAed: number;
  priceSuffix: string;
  inclusions: string[];
  featured?: boolean;
}

export const rentalTiers: RentalTier[] = [
  {
    period: "By the Day",
    fromPriceAed: 1800,
    priceSuffix: "/ day",
    inclusions: [
      "Chauffeured or self-drive",
      "Fuel & comprehensive insurance",
      "Meet & greet on request",
      "Free cancellation, 24h notice",
    ],
  },
  {
    period: "By the Week",
    fromPriceAed: 10500,
    priceSuffix: "/ week",
    inclusions: [
      "All Day-rate inclusions",
      "Dedicated chauffeur available",
      "Unlimited mileage in-emirate",
      "Mid-week vehicle swap on request",
    ],
    featured: true,
  },
  {
    period: "By the Month",
    fromPriceAed: 32000,
    priceSuffix: "/ month",
    inclusions: [
      "All Week-rate inclusions",
      "Maintenance & servicing covered",
      "Priority booking & concierge line",
      "Replacement vehicle guarantee",
    ],
  },
];
