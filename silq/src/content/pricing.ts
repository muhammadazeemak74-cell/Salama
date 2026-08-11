export type PriceRow = {
  name: string;
  /** Starting price in AED. */
  from: number;
  /** Short qualifier shown in muted type beside the name. */
  note?: string;
};

export type PriceGroup = {
  title: string;
  rows: PriceRow[];
};

/**
 * Market-benchmarked starting prices. TODO(owner): confirm each line before
 * launch — these are researched estimates, not your quoted rates.
 */
export const PRICE_GROUPS: PriceGroup[] = [
  {
    title: "Cutting & styling",
    rows: [
      { name: "Haircut & blow-dry", from: 250 },
      { name: "Kids' haircut", from: 150, note: "Under 12" },
      { name: "Blow-dry & styling", from: 180 },
      { name: "Updo / occasion styling", from: 350 },
      { name: "Bridal hair", from: 1200, note: "Includes trial" },
    ],
  },
  {
    title: "Colour",
    rows: [
      { name: "Root touch-up", from: 250 },
      { name: "Full colour", from: 450 },
      { name: "Balayage / Ombré", from: 550 },
      { name: "Highlights / Babylights", from: 650 },
      { name: "Toner", from: 250 },
    ],
  },
  {
    title: "Treatments",
    rows: [
      { name: "Hair treatment / mask", from: 200 },
      { name: "Hair spa", from: 250 },
      { name: "Hair botox", from: 550 },
      { name: "Keratin / protein", from: 750 },
    ],
  },
  {
    title: "Threading",
    rows: [{ name: "Threading (brows)", from: 40 }],
  },
];

export const formatAed = (amount: number): string =>
  `AED ${amount.toLocaleString("en-AE")}`;
