export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "3rem 1.5rem" }}>
      <h1>Salama</h1>
      <p>
        AI food-safety compliance assistant for UAE food establishments. This is
        the Phase 1 scaffold.
      </p>
      <p>
        The WhatsApp Cloud API webhook is wired at{" "}
        <code>/api/webhook/whatsapp</code>. Incoming messages are logged to the
        server console; AI processing is not implemented yet.
      </p>
    </main>
  );
}
