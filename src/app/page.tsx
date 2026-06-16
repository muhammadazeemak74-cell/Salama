import Link from "next/link";

export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "3rem 1.5rem" }}>
      <h1>Salama</h1>
      <p>
        AI food-safety compliance assistant for UAE food establishments. This is
        the Phase 1 scaffold.
      </p>
      <p>
        Kitchen staff log compliance events by voice from the browser. Open the{" "}
        <Link href="/record">voice recording screen</Link> to record a log; it
        is transcribed, interpreted against the Dubai Food Code, and stored as an
        immutable record.
      </p>
    </main>
  );
}
