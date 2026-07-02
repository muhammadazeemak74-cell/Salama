export type DriveMode = "Chauffeured / Self-Drive" | "Chauffeured Only";

export interface FleetCar {
  slug: string;
  make: string;
  model: string;
  tagline: string;
  seats: number;
  driveMode: DriveMode;
  /** Placeholder AED/day rate — flag for client to confirm before launch. */
  fromPriceAed: number;
  /** Unsplash search query for this model's placeholder photo. */
  imageQuery: string;
  halo?: boolean;
  mostBooked?: boolean;
}

export const fleet: FleetCar[] = [
  {
    slug: "mercedes-s-class",
    make: "Mercedes-Benz",
    model: "S-Class",
    tagline: "The most-booked airport car",
    seats: 3,
    driveMode: "Chauffeured / Self-Drive",
    fromPriceAed: 2000,
    imageQuery: "Mercedes S-Class",
    mostBooked: true,
  },
  {
    slug: "bmw-7-series",
    make: "BMW",
    model: "7 Series",
    tagline: "German precision, first class",
    seats: 3,
    driveMode: "Chauffeured / Self-Drive",
    fromPriceAed: 2000,
    imageQuery: "BMW 7 Series",
  },
  {
    slug: "range-rover-autobiography",
    make: "Range Rover",
    model: "Autobiography",
    tagline: "Command the city and the coast",
    seats: 4,
    driveMode: "Chauffeured / Self-Drive",
    fromPriceAed: 2500,
    imageQuery: "Range Rover Autobiography",
  },
  {
    slug: "mercedes-v-class",
    make: "Mercedes-Benz",
    model: "V-Class",
    tagline: "Groups & airport transfers",
    seats: 7,
    driveMode: "Chauffeured Only",
    fromPriceAed: 1800,
    imageQuery: "Mercedes V-Class van",
  },
  {
    slug: "cadillac-escalade",
    make: "Cadillac",
    model: "Escalade",
    tagline: "Full-size American presence",
    seats: 6,
    driveMode: "Chauffeured / Self-Drive",
    fromPriceAed: 2200,
    imageQuery: "Cadillac Escalade",
  },
  {
    slug: "bentley-flying-spur",
    make: "Bentley",
    model: "Flying Spur",
    tagline: "Handcrafted British luxury",
    seats: 3,
    driveMode: "Chauffeured Only",
    fromPriceAed: 3800,
    imageQuery: "Bentley Flying Spur",
  },
  {
    slug: "rolls-royce-ghost",
    make: "Rolls-Royce",
    model: "Ghost",
    tagline: "The signature arrival",
    seats: 3,
    driveMode: "Chauffeured Only",
    fromPriceAed: 4000,
    imageQuery: "Rolls-Royce Ghost",
    halo: true,
  },
  {
    slug: "rolls-royce-cullinan",
    make: "Rolls-Royce",
    model: "Cullinan",
    tagline: "The halo SUV",
    seats: 4,
    driveMode: "Chauffeured Only",
    fromPriceAed: 4800,
    imageQuery: "Rolls-Royce Cullinan",
    halo: true,
  },
];
