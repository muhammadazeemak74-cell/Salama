import Link from "next/link";
import Wordmark, { BRAND_GREEN } from "@/components/Wordmark";

export default function Home() {
  return (
    <div style={{ minHeight: "100dvh" }}>
      <header
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: "1.5rem",
        }}
      >
        <Wordmark />
      </header>

      <main
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "2rem 1.5rem 4rem",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 20,
            padding: "2.5rem",
            boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
          }}
        >
          <h1
            style={{
              fontSize: "clamp(2rem, 6vw, 2.75rem)",
              lineHeight: 1.1,
              margin: "0 0 0.75rem",
              letterSpacing: "-0.02em",
            }}
          >
            AI food-safety logging and compliance for UAE kitchens.
          </h1>
          <p
            style={{
              fontSize: "1.1rem",
              color: "#475569",
              margin: "0 0 2rem",
              maxWidth: 560,
            }}
          >
            Kitchen staff log compliance events by voice from the browser. Each
            log is transcribed, checked against the Dubai Food Code, and stored
            as an immutable record.
          </p>

          <div style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap" }}>
            <Link
              href="/record"
              style={{
                display: "inline-block",
                background: BRAND_GREEN,
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "1.05rem",
                padding: "0.85rem 1.5rem",
                borderRadius: 12,
                textDecoration: "none",
              }}
            >
              Record a log
            </Link>
            <Link
              href="/dashboard"
              style={{
                display: "inline-block",
                background: "#ffffff",
                color: "#0f172a",
                fontWeight: 700,
                fontSize: "1.05rem",
                padding: "0.85rem 1.5rem",
                borderRadius: 12,
                border: "1px solid #cbd5e1",
                textDecoration: "none",
              }}
            >
              Manager dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
