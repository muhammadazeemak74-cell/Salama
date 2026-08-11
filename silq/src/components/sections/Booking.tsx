"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useSafeReducedMotion } from "@/lib/use-reduced-motion";
import { BOOKING, HAIR_LENGTHS, TIME_PREFERENCES } from "@/content/copy";
import { AREAS } from "@/content/areas";
import { SERVICES } from "@/content/services";
import { getImage } from "@/content/images";
import { PHONE_DISPLAY, SITE, WHATSAPP_NUMBER } from "@/content/site";
import { GENERAL_ENQUIRY, whatsappLink } from "@/lib/whatsapp";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { RevealBlock, RevealText } from "@/components/motion/RevealText";

type Answers = {
  service: string;
  length: string;
  when: string;
  area: string;
  name: string;
};

const EMPTY: Answers = { service: "", length: "", when: "", area: "", name: "" };

/**
 * Five-step booking builder. Entirely client-side: nothing is stored, nothing
 * is transmitted, and the only outcome is a pre-filled WhatsApp deep link the
 * visitor sends themselves. That is how this market actually converts.
 */
export function Booking() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const reducedMotion = useSafeReducedMotion();

  const image = getImage("booking-block");
  const serviceNames = useMemo(() => SERVICES.map((service) => service.name), []);

  const steps = [
    { key: "service" as const, legend: "Which service?", options: serviceNames },
    { key: "length" as const, legend: "How long is your hair?", options: [...HAIR_LENGTHS] },
    { key: "when" as const, legend: "When suits you?", options: [...TIME_PREFERENCES] },
    { key: "area" as const, legend: "Which area of Dubai?", options: [...AREAS] },
  ];

  const isNameStep = step === steps.length;
  const currentValue = isNameStep ? answers.name : answers[steps[step].key];
  const canContinue = currentValue.trim().length > 0;

  const message = useMemo(
    () =>
      [
        "Hi SILQ — I'd like to book an appointment at home.",
        "",
        `Service: ${answers.service || "—"}`,
        `Hair length: ${answers.length || "—"}`,
        `Preferred time: ${answers.when || "—"}`,
        `Area: ${answers.area || "—"}`,
        `Name: ${answers.name || "—"}`,
      ].join("\n"),
    [answers],
  );

  const select = (key: keyof Answers, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <section id="booking" className="on-dark relative overflow-hidden">
      <div aria-hidden className="absolute inset-0">
        <Image
          src={image.src}
          alt=""
          fill
          sizes="100vw"
          placeholder="blur"
          blurDataURL={image.blurDataURL}
          className="object-cover opacity-[0.14]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-sable via-sable/90 to-sable/70" />
      </div>

      <div className="shell relative py-24 lg:py-36">
        <div className="lg:grid lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <RevealBlock>
              <p className="eyebrow">{BOOKING.eyebrow}</p>
            </RevealBlock>
            <RevealText
              as="h2"
              lines={[BOOKING.heading]}
              className="t-section opsz-display mt-6"
              delay={0.05}
            />
            <RevealBlock delay={0.12}>
              <p className="t-lead mt-8 max-w-md">{BOOKING.intro}</p>
            </RevealBlock>

            <RevealBlock delay={0.18}>
              <div className="hairline mt-12 pt-8">
                <p className="text-[0.9375rem]">{BOOKING.escapeHatch}</p>
                <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3">
                  <a
                    href={whatsappLink(GENERAL_ENQUIRY)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-draw text-champagne"
                  >
                    WhatsApp {PHONE_DISPLAY}
                  </a>
                  <a href={`tel:+${WHATSAPP_NUMBER}`} className="link-draw text-champagne/70">
                    Call instead
                  </a>
                </div>
                <p className="mt-4 text-[0.8125rem]">{SITE.hours.label}</p>
              </div>
            </RevealBlock>
          </div>

          <div className="mt-16 lg:col-span-6 lg:col-start-7 lg:mt-0">
            <div className="border border-champagne/20 bg-ink/30 p-6 backdrop-blur-sm sm:p-10">
              {/* Progress */}
              <ol className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {BOOKING.steps.map((label, index) => {
                  const state = index === step ? "current" : index < step ? "done" : "todo";
                  return (
                    <li
                      key={label}
                      aria-current={state === "current" ? "step" : undefined}
                      className={`text-[0.6875rem] uppercase tracking-[0.18em] transition-colors duration-300 ${
                        state === "current"
                          ? "text-champagne"
                          : state === "done"
                            ? "text-champagne/50"
                            : "text-bone/25"
                      }`}
                    >
                      <span className="tnum">{String(index + 1).padStart(2, "0")}</span>{" "}
                      {label}
                    </li>
                  );
                })}
              </ol>

              <div className="mt-8 h-px w-full bg-champagne/15">
                <motion.div
                  className="h-px bg-champagne"
                  initial={false}
                  animate={{ width: `${((step + 1) / (steps.length + 1)) * 100}%` }}
                  transition={{ duration: reducedMotion ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  initial={reducedMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: reducedMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-10"
                >
                  {isNameStep ? (
                    <div>
                      <label
                        htmlFor="booking-name"
                        className="block font-display text-[1.5rem] font-light tracking-[-0.03em] text-bone"
                      >
                        And your name?
                      </label>
                      <input
                        id="booking-name"
                        type="text"
                        autoComplete="given-name"
                        value={answers.name}
                        onChange={(event) => select("name", event.target.value)}
                        placeholder="First name"
                        className="mt-6 w-full border-b border-champagne/30 bg-transparent pb-3 font-display text-[1.75rem] font-light tracking-[-0.03em] text-bone placeholder:text-bone/25 focus:border-champagne focus:outline-none"
                      />

                      <div className="mt-10 border border-champagne/15 p-5">
                        <p className="text-[0.6875rem] uppercase tracking-[0.18em] text-champagne/60">
                          Your message
                        </p>
                        <pre className="mt-4 whitespace-pre-wrap font-sans text-[0.9375rem] leading-relaxed text-bone/80">
                          {message}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <fieldset>
                      <legend className="font-display text-[1.5rem] font-light tracking-[-0.03em] text-bone">
                        {steps[step].legend}
                      </legend>

                      <div className="mt-7 flex flex-wrap gap-2.5">
                        {steps[step].options.map((option) => {
                          const key = steps[step].key;
                          const checked = answers[key] === option;
                          return (
                            <label
                              key={option}
                              className={`cursor-pointer rounded-full border px-4 py-2.5 text-[0.875rem] transition-colors duration-300 has-[:focus-visible]:outline has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-champagne ${
                                checked
                                  ? "border-champagne bg-champagne text-ink"
                                  : "border-champagne/25 text-bone/75 hover:border-champagne/70 hover:text-bone"
                              }`}
                            >
                              <input
                                type="radio"
                                name={key}
                                value={option}
                                checked={checked}
                                onChange={() => select(key, option)}
                                className="sr-only"
                              />
                              {option}
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  )}
                </motion.div>
              </AnimatePresence>

              <div className="mt-12 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setStep((value) => Math.max(0, value - 1))}
                  disabled={step === 0}
                  className="text-[0.9375rem] text-bone/50 transition-colors duration-300 enabled:hover:text-bone disabled:opacity-30"
                >
                  {BOOKING.back}
                </button>

                {isNameStep ? (
                  <MagneticButton
                    href={canContinue ? whatsappLink(message) : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`btn btn-primary ${canContinue ? "" : "pointer-events-none opacity-40"}`}
                  >
                    {BOOKING.submit}
                  </MagneticButton>
                ) : (
                  <MagneticButton
                    onClick={() => setStep((value) => value + 1)}
                    disabled={!canContinue}
                    className="btn btn-primary disabled:pointer-events-none disabled:opacity-40"
                  >
                    {BOOKING.next}
                  </MagneticButton>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
