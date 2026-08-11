export type Testimonial = {
  quote: string;
  name: string;
  detail: string;
};

/**
 * TODO(owner): Replace all three with real, attributable client reviews before
 * launch. Keep the format — first name, area, and the service they booked. Do
 * not add star ratings or review counts unless they can be evidenced.
 */
export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "She told me on WhatsApp that I would need two sessions to get where I wanted. Every salon before that had said one, taken my money, and got it wrong.",
    name: "Placeholder — replace",
    detail: "Balayage · Dubai Marina",
  },
  {
    quote:
      "Four hours of keratin in my own kitchen, and my floors were cleaner when she left than when she arrived. I have not blow-dried my hair since.",
    name: "Placeholder — replace",
    detail: "Keratin · Arabian Ranches",
  },
  {
    quote:
      "Booked at nine in the evening after the children were down. That is the entire reason I will not go back to a salon.",
    name: "Placeholder — replace",
    detail: "Cut & colour · Al Barsha",
  },
];
