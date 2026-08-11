import Link from "next/link";
import { SERVICES } from "@/content/services";

export default function NotFound() {
  return (
    <section className="shell flex min-h-[70vh] flex-col justify-center py-32">
      <p className="eyebrow">404</p>
      <h1 className="t-display opsz-display mt-6 max-w-[14ch]">This page isn&rsquo;t here.</h1>
      <p className="t-lead mt-8 max-w-md">
        The link may be out of date. Everything we offer is on the home page, or pick a
        service below.
      </p>

      <div className="mt-12 flex flex-wrap gap-4">
        <Link href="/" className="btn btn-primary">
          Back to home
        </Link>
        <Link href="/#booking" className="btn btn-ghost">
          Build an appointment
        </Link>
      </div>

      <ul className="hairline mt-20 grid gap-x-10 gap-y-4 pt-8 sm:grid-cols-2 lg:grid-cols-4">
        {SERVICES.map((service) => (
          <li key={service.slug}>
            <Link
              href={`/services/${service.slug}`}
              className="link-draw font-display text-[1.125rem] font-light tracking-[-0.03em] text-ink"
            >
              {service.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
