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
    fromPriceAed: 2000,
    priceSuffix: "/ day",
    inclusions: [
      "Fuel & Salik tolls included",
      "Unlimited mileage within Dubai",
      "Complimentary water & Wi-Fi",
      "Child seats on request",
    ],
  },
  {
    period: "By the Week",
    fromPriceAed: 11500,
    priceSuffix: "/ week",
    inclusions: [
      "All Day-rate inclusions",
      "English & Arabic-speaking chauffeurs",
      "Mid-week vehicle swap on request",
      "Priority airport re-pickup",
    ],
    featured: true,
  },
  {
    period: "By the Month",
    fromPriceAed: 34000,
    priceSuffix: "/ month",
    inclusions: [
      "All Week-rate inclusions",
      "Dedicated chauffeur available",
      "Maintenance & servicing covered",
      "No hidden fees, ever",
    ],
  },
];
