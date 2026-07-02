import { fleetImages } from "./images";

export type DriveMode = "Chauffeured / Self-Drive" | "Chauffeured Only";

export interface FleetCar {
  slug: string;
  make: string;
  model: string;
  tagline: string;
  seats: number;
  driveMode: DriveMode;
  fromPriceAed: number;
  image: string;
  halo?: boolean;
}

export const fleet: FleetCar[] = [
  {
    slug: "cadillac-escalade",
    make: "Cadillac",
    model: "Escalade",
    tagline: "Full-size American presence",
    seats: 6,
    driveMode: "Chauffeured / Self-Drive",
    fromPriceAed: 1800,
    image: fleetImages.cadillacEscalade,
  },
  {
    slug: "gmc-yukon-denali",
    make: "GMC",
    model: "Yukon Denali",
    tagline: "Effortless space, quiet ride",
    seats: 6,
    driveMode: "Chauffeured / Self-Drive",
    fromPriceAed: 1600,
    image: fleetImages.gmcYukonDenali,
  },
  {
    slug: "mercedes-s-class",
    make: "Mercedes-Benz",
    model: "S-Class",
    tagline: "The executive standard",
    seats: 4,
    driveMode: "Chauffeured / Self-Drive",
    fromPriceAed: 2200,
    image: fleetImages.mercedesSClass,
  },
  {
    slug: "mercedes-v-class",
    make: "Mercedes-Benz",
    model: "V-Class",
    tagline: "Group & airport transfers",
    seats: 7,
    driveMode: "Chauffeured Only",
    fromPriceAed: 1400,
    image: fleetImages.mercedesVClass,
  },
  {
    slug: "bmw-7-series",
    make: "BMW",
    model: "7 Series",
    tagline: "German precision, first class",
    seats: 4,
    driveMode: "Chauffeured / Self-Drive",
    fromPriceAed: 2000,
    image: fleetImages.bmw7Series,
  },
  {
    slug: "range-rover-autobiography",
    make: "Range Rover",
    model: "Autobiography",
    tagline: "Command the city and the coast",
    seats: 4,
    driveMode: "Chauffeured / Self-Drive",
    fromPriceAed: 2500,
    image: fleetImages.rangeRover,
  },
  {
    slug: "rolls-royce-ghost",
    make: "Rolls-Royce",
    model: "Ghost",
    tagline: "The signature arrival",
    seats: 3,
    driveMode: "Chauffeured Only",
    fromPriceAed: 5500,
    image: fleetImages.rollsRoyceGhost,
    halo: true,
  },
];
