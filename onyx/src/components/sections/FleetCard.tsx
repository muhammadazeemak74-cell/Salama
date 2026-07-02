"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Image from "next/image";
import type { MouseEvent } from "react";
import type { FleetCar } from "@/data/fleet";

export function FleetCard({ car }: { car: FleetCar }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [8, -8]), {
    stiffness: 300,
    damping: 30,
  });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-8, 8]), {
    stiffness: 300,
    damping: 30,
  });

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function handleMouseLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformPerspective: 800 }}
      className={`panel group relative flex h-full flex-col overflow-hidden rounded-2xl ${
        car.halo ? "ring-1 ring-gold/50" : ""
      }`}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden">
        <Image
          src={car.image}
          alt={`${car.make} ${car.model}`}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-onyx via-onyx/10 to-transparent" />
        {car.halo && (
          <span className="absolute right-4 top-4 rounded-full bg-gold px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-onyx">
            Signature
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-6">
        <p className="text-xs uppercase tracking-[0.25em] text-gold">
          {car.make}
        </p>
        <h3 className="font-display text-2xl text-off-white">{car.model}</h3>
        <p className="text-sm text-off-white/60">{car.tagline}</p>
        <div className="mt-3 flex items-center justify-between text-xs text-off-white/70">
          <span>{car.seats} seats</span>
          <span>{car.driveMode}</span>
        </div>
        <div className="mt-auto flex items-baseline justify-between border-t border-gold/15 pt-4">
          <span className="text-[11px] uppercase tracking-widest text-off-white/50">
            From
          </span>
          <span className="font-display text-xl text-gold-light">
            AED {car.fromPriceAed.toLocaleString()}
            <span className="text-xs text-off-white/50"> /day</span>
          </span>
        </div>
      </div>
    </motion.div>
  );
}
