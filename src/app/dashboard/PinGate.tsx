"use client";

import { useState } from "react";

export default function PinGate() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || pin.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        // Reload so the server re-renders the (now authorised) dashboard.
        window.location.reload();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? "Incorrect PIN");
      setPin("");
      setBusy(false);
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        background: "#0b1220",
        color: "#f8fafc",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 380,
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Manager Dashboard</h1>
        <p style={{ color: "#94a3b8", margin: 0 }}>Enter PIN</p>

        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          aria-label="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          style={{
            fontSize: "2rem",
            letterSpacing: "0.5rem",
            textAlign: "center",
            padding: "0.9rem 1rem",
            borderRadius: 12,
            border: "2px solid #334155",
            background: "#1e293b",
            color: "#f8fafc",
            outline: "none",
          }}
        />

        {error && (
          <p role="alert" style={{ color: "#fca5a5", margin: 0, fontWeight: 600 }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || pin.length === 0}
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            padding: "0.9rem 1rem",
            borderRadius: 12,
            border: "none",
            cursor: busy || pin.length === 0 ? "default" : "pointer",
            background: busy || pin.length === 0 ? "#1d4ed8aa" : "#2563eb",
            color: "#ffffff",
          }}
        >
          {busy ? "Checking…" : "Enter"}
        </button>
      </form>
    </main>
  );
}
